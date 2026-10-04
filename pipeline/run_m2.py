"""Run one finite M2 source replay and acceptance pass in an isolated copy.

The released raw caches, curation and graph are read-only inputs. No candidate
is merged back. A complete pinned cache is replayed with network sockets blocked;
any changed staged source remains pending review.
This command does not launch a background process or schedule future work.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import re
import shutil
import subprocess
import sys
import uuid
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
RELEASE_DIRS = ("raw", "curation", "seed")


def utc_now() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds").replace("+00:00", "Z")


def linked(path: Path) -> bool:
    return path.is_symlink() or getattr(path, "is_junction", lambda: False)()


def inventory(root: Path) -> dict:
    """Hash bytes without interpreting or copying any field into a receipt."""
    if linked(root):
        raise ValueError("Symlinks and junctions are not supported in an isolated M2 snapshot")
    result = {}
    for path in sorted(root.rglob("*")):
        if linked(path):
            raise ValueError("Symlinks and junctions are not supported in an isolated M2 snapshot")
        if path.is_file():
            body = path.read_bytes()
            result[path.relative_to(root).as_posix()] = {"size": len(body), "sha256": hashlib.sha256(body).hexdigest()}
    return result


def release_inventory(project: Path) -> dict:
    result = {}
    for folder in RELEASE_DIRS:
        for name, record in inventory(project / "data" / folder).items():
            result[f"{folder}/{name}"] = record
    return result


def differences(before: dict, after: dict) -> list[dict]:
    return [{"path": name, "change": "added" if name not in before else "removed" if name not in after else "modified"}
            for name in sorted(before.keys() | after.keys()) if before.get(name) != after.get(name)]


def restore_json_line_endings(data_dir: Path, baselines: dict[str, bytes]) -> list[str]:
    """Restore exact release bytes only for physical JSON newline differences.

    Do not parse/reserialize JSON: whitespace, ordering, escapes, values and
    source bodies remain subject to the normal byte-integrity review.
    """
    restored = []
    for relative, original in baselines.items():
        path = data_dir / relative
        if not path.is_file():
            continue
        if linked(path) or not path.resolve().is_relative_to(data_dir.resolve()):
            raise ValueError("Staged JSON restoration cannot follow links outside the candidate")
        candidate = path.read_bytes()
        if candidate != original and candidate.replace(b"\r\n", b"\n") == original.replace(b"\r\n", b"\n"):
            path.write_bytes(original)
            restored.append(relative)
    return restored


def atomic_json(path: Path, value: dict) -> None:
    temporary = path.with_suffix(path.suffix + ".tmp")
    temporary.write_text(json.dumps(value, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    temporary.replace(path)


def redact(text: str, environment: dict) -> str:
    """Remove configured secrets and common credential-bearing URL parameters."""
    values = [str(value) for name, value in environment.items()
              if re.search(r"KEY|TOKEN|PASSWORD|SECRET|DATABASE_URL", name, re.I) and len(str(value)) >= 4]
    for value in sorted(set(values), key=len, reverse=True):
        text = text.replace(value, "[REDACTED]")
    text = re.sub(r"(?i)([?&](?:api_?key|token|access_token|password|secret)=)[^&\s\"'<>]+", r"\1[REDACTED]", text)
    return re.sub(r"(?i)(authorization\s*[:=]\s*(?:bearer\s+)?)[^\s\"'<>]+", r"\1[REDACTED]", text)


def run_command(argv: list[str], cwd: Path, env: dict):
    # Source clients already have finite request timeouts and bounded retries.
    # Capture first, then redact before saving or displaying any child output.
    return subprocess.run(argv, cwd=cwd, env=env, stdout=subprocess.PIPE, stderr=subprocess.STDOUT,
                          text=True, encoding="utf-8", errors="replace", check=False)


def check_stage(project: Path, stage: Path) -> None:
    if stage == project or stage in project.parents:
        raise ValueError("Stage must not be the released project or its ancestor")
    if project in stage.parents and project / ".runtime" not in stage.parents:
        raise ValueError("An in-project stage must be under .runtime, outside released files")
    if stage.exists():
        raise ValueError("Stage must be a new path; existing candidates are never overwritten")
    for folder in ("pipeline", "contract", *(f"data/{name}" for name in RELEASE_DIRS)):
        source = project / folder
        if not source.is_dir():
            raise ValueError(f"Missing required release folder: {folder}")
        if linked(source) or any(linked(path) for path in source.rglob("*")):
            raise ValueError("Symlinked or junction-linked release inputs cannot be copied into M2 staging")


def run_once(project_root: Path, stage: Path, refresh: bool = False, group_backend: str = "direct", runner=None) -> dict:
    project = Path(project_root).resolve()
    stage = Path(stage).resolve()
    if group_backend not in {"direct", "brightdata"}:
        raise ValueError("Unknown group backend")
    if refresh:
        raise ValueError("M2 acceptance is offline; fresh acquisitions require a separate reviewed run")
    check_stage(project, stage)
    before = release_inventory(project)
    stage.mkdir(parents=True)
    (stage / "logs").mkdir()
    atomic_json(stage / "release_inventory.json", before)
    receipt = {
        "schema_version": 1, "started_at": utc_now(), "status": "running", "mode": "offline_replay",
        "requested_group_backend": group_backend, "project_root": str(project), "stage_root": str(stage),
        "release_unchanged": None, "steps": [], "candidate_changes": [], "publication": "never_automatic",
        "scope": "One finite foreground pass; overnight unattended execution was waived by the user",
        "network_policy": "Socket connections and name resolution denied in every staged Python child",
    }
    atomic_json(stage / "receipt.json", receipt)
    environment = os.environ.copy()
    environment["DATA_DIR"] = str(stage / "data")
    environment["PYTHONIOENCODING"] = "utf-8"
    environment["PYTHONDONTWRITEBYTECODE"] = "1"
    execute = runner or run_command
    try:
        for folder in ("pipeline", "contract", *(f"data/{name}" for name in RELEASE_DIRS)):
            shutil.copytree(project / folder, stage / folder, ignore=shutil.ignore_patterns("__pycache__", "*.pyc", ".env", ".env.*"))
        copied = release_inventory(stage)
        if copied != before:
            raise ValueError("Staged input copy differs from the initial release inventory")
        json_baselines = {name: (stage / "data" / name).read_bytes() for name in before if Path(name).suffix.lower() == ".json"}
        if any(hashlib.sha256(body).hexdigest() != before[name]["sha256"] for name, body in json_baselines.items()):
            raise ValueError("JSON baseline differs from the initial release inventory")
        guard = stage / ".offline_guard"
        guard.mkdir()
        (guard / "sitecustomize.py").write_text(
            'import socket\n'
            'def _deny(*args, **kwargs):\n'
            '    raise RuntimeError("M2 offline acceptance prohibits network access")\n'
            'socket.socket.connect = _deny\n'
            'socket.socket.connect_ex = _deny\n'
            'socket.create_connection = _deny\n'
            'socket.getaddrinfo = _deny\n', encoding="utf-8")
        # Child fetch_slice subprocesses inherit this guard and the staged DATA_DIR.
        environment["PYTHONPATH"] = str(guard)
        commands = [
            ("acquire_or_replay", "fetch_slice.py", ["--offline", "--group-backend", group_backend]),
            ("build_candidate", "build_graph.py", []),
            ("validate_candidate", "validate_graph.py", ["--check-raw"]),
            ("audit_cache", "audit_cache.py", ["--report", str(stage / "data" / "acceptance" / "cache-audit.json")]),
        ]
        if (stage / "data" / "seed" / "funding_overlap.json").is_file():
            commands.insert(3, ("build_funding_projection", "build_funding_projection.py", []))
        for name, script, arguments in commands:
            step = {"name": name, "status": "running", "started_at": utc_now(), "returncode": None,
                    "log": f"logs/{name}.log", "format_only_restorations": [], "format_only_restoration_count": 0}
            receipt["steps"].append(step)
            atomic_json(stage / "receipt.json", receipt)
            result = execute([sys.executable, str(stage / "pipeline" / script), *arguments], cwd=stage, env=environment)
            output = result.stdout or ""
            if isinstance(output, bytes):
                output = output.decode("utf-8", errors="replace")
            (stage / step["log"]).write_text(redact(output, environment), encoding="utf-8")
            if result.returncode == 0:
                restored = restore_json_line_endings(stage / "data", json_baselines)
                step.update(format_only_restorations=restored, format_only_restoration_count=len(restored))
            step.update(returncode=result.returncode, status="passed" if result.returncode == 0 else "failed", completed_at=utc_now())
            atomic_json(stage / "receipt.json", receipt)
            if result.returncode:
                receipt["status"] = "failed"
                break
        else:
            receipt["status"] = "complete"
    except (Exception, KeyboardInterrupt) as exc:
        receipt["status"] = "failed"
        # Exception messages may contain URLs or third-party output. Record type
        # only; source-specific diagnostics belong in already-redacted logs.
        receipt["failure_type"] = type(exc).__name__
        if receipt["steps"] and receipt["steps"][-1]["status"] == "running":
            receipt["steps"][-1].update(status="failed", completed_at=utc_now())
    finally:
        after = release_inventory(project)
        atomic_json(stage / "release_inventory_after.json", after)
        receipt["release_unchanged"] = before == after
        receipt["release_changes"] = differences(before, after)
        candidate = release_inventory(stage)
        receipt["candidate_changes"] = differences(before, candidate)
        receipt["source_changes"] = [row for row in receipt["candidate_changes"] if row["path"].startswith(("raw/", "curation/"))]
        if not receipt["release_unchanged"]:
            receipt["status"] = "failed"
            receipt["failure_type"] = "ReleasedInputsChanged"
        elif receipt["status"] == "complete" and receipt["candidate_changes"]:
            receipt["status"] = "pending_review"
        receipt["completed_at"] = utc_now()
        receipt["release_file_count"] = len(before)
        receipt["candidate_file_count"] = len(candidate)
        receipt["format_only_restoration_count"] = sum(step["format_only_restoration_count"] for step in receipt["steps"])
        atomic_json(stage / "candidate_inventory.json", candidate)
        atomic_json(stage / "receipt.json", receipt)
    return receipt


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--stage", type=Path, help="A new staging path; default is .runtime/m2/run-<UTC>-<id>")
    args = parser.parse_args()
    stage = args.stage or ROOT / ".runtime" / "m2" / (datetime.now(timezone.utc).strftime("run-%Y%m%dT%H%M%SZ-") + uuid.uuid4().hex[:8])
    try:
        receipt = run_once(ROOT, stage)
    except ValueError as exc:
        parser.error(str(exc))
    print(f"M2 {receipt['status']}; released inputs unchanged: {receipt['release_unchanged']}; receipt: {stage.resolve() / 'receipt.json'}")
    if receipt["status"] != "complete":
        raise SystemExit(1)


if __name__ == "__main__":
    main()
