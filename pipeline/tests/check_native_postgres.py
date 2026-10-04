"""Exercise the unchanged P1 loader against native PostgreSQL and PostgREST.

This optional acceptance check creates a fresh local cluster under --work-dir.
It installs no service, never reads .env, and never uses an existing database.
Supply portable/native PostgreSQL binaries, PostgREST, and existing web modules.
Use --hold-seconds to keep the API available for a separate browser check.
Runtime binaries, logs, cluster files, and the default result stay outside the repository.
--report-file optionally copies the credential-free result to an explicit audit path.
This verifies the P1 five-table migration, not P4's later auth/RLS migrations.
"""
from __future__ import annotations

import argparse
from datetime import date, datetime, timezone
import hashlib
import json
import os
from pathlib import Path
import shutil
import socket
import struct
import subprocess
import sys
import tempfile
import time
from urllib.error import URLError
from urllib.request import urlopen

import psycopg
from psycopg.rows import dict_row

ROOT = Path(__file__).resolve().parents[2]
TABLES = ("nodes", "edges", "evidence", "clusters", "node_cluster")
HIDDEN = {"creationflags": subprocess.CREATE_NO_WINDOW} if os.name == "nt" else {}


def free_port() -> int:
    with socket.socket() as sock:
        sock.bind(("127.0.0.1", 0))
        return sock.getsockname()[1]


def run(command, *, env=None, cwd=None, timeout=90) -> str:
    result = subprocess.run(command, cwd=cwd, env=env, text=True,
                            encoding="utf-8", errors="replace", capture_output=True,
                            timeout=timeout, **HIDDEN)
    if result.returncode:
        # This harness supplies only an isolated, password-free loopback URI.
        raise RuntimeError(f"{Path(command[0]).name} failed ({result.returncode}): "
                           + (result.stderr or result.stdout)[-3000:])
    return result.stdout.strip()


def normalized(rows: list[dict], table: str) -> list[dict]:
    result = []
    for row in rows:
        row = dict(row)
        for key, value in row.items():
            if isinstance(value, date):
                row[key] = value.isoformat()
        if table == "edges" and row["confidence"] is not None:
            row["confidence"] = struct.unpack("f", struct.pack("f", row["confidence"]))[0]
        result.append(row)
    return sorted(result, key=lambda x: json.dumps(x.get("id", [x.get("node_id"), x.get("cluster_id")]), sort_keys=True))


def read_json(url: str):
    with urlopen(url, timeout=5) as response:
        return json.load(response)


def wait_api(api: str, process) -> None:
    deadline = time.monotonic() + 30
    while time.monotonic() < deadline:
        if process.poll() is not None:
            raise RuntimeError("PostgREST exited before becoming ready; inspect postgrest.log")
        try:
            if isinstance(read_json(api + "/nodes?limit=1"), list):
                return
        except (URLError, TimeoutError, ValueError):
            time.sleep(0.25)
    raise RuntimeError("PostgREST did not become ready within 30 seconds")


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--pg-bin", type=Path, required=True)
    parser.add_argument("--postgrest", type=Path, required=True)
    parser.add_argument("--web-modules", type=Path, required=True)
    parser.add_argument("--work-dir", type=Path, required=True)
    parser.add_argument("--report-file", type=Path)
    parser.add_argument("--node", default=shutil.which("node"))
    parser.add_argument("--hold-seconds", type=int, default=0)
    args = parser.parse_args()
    if not args.node or args.hold_seconds < 0:
        parser.error("Node.js is required and --hold-seconds must be nonnegative")
    args.work_dir = args.work_dir.resolve()
    if args.work_dir.is_relative_to(ROOT):
        parser.error("--work-dir must sit outside the repository")
    args.work_dir.mkdir(parents=True, exist_ok=True)
    runtime = Path(tempfile.mkdtemp(prefix="p1-native-", dir=args.work_dir)).resolve()
    if not runtime.is_relative_to(args.work_dir):
        raise RuntimeError("Temporary cluster escaped its explicitly supplied work directory")
    cluster = runtime / "cluster"
    suffix = ".exe" if os.name == "nt" else ""
    pg_ctl = str(args.pg_bin.resolve() / ("pg_ctl" + suffix))
    initdb = str(args.pg_bin.resolve() / ("initdb" + suffix))
    postgres = str(args.pg_bin.resolve() / ("postgres" + suffix))
    binary_version = run([postgres, "--version"])
    pg_port, api_port = free_port(), free_port()
    while api_port == pg_port:
        api_port = free_port()
    base_uri = f"postgresql://postgres@127.0.0.1:{pg_port}/"
    uri = base_uri + "pathnet_p1_m1?sslmode=disable"
    api = f"http://127.0.0.1:{api_port}"
    graph_bytes = (ROOT / "data/seed/graph.json").read_bytes()
    graph = json.loads(graph_bytes)
    if len(graph["nodes"]) < 15 or any(n["props"].get("placeholder") for n in graph["nodes"]):
        raise AssertionError("M1 requires at least 15 real nodes")
    result = {"checked_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
              "runtime": "native PostgreSQL; not PGlite or Docker", "binary_version": binary_version,
              "graph_file_sha256": hashlib.sha256(graph_bytes).hexdigest(),
              "counts": {t: len(graph[t]) for t in TABLES}, "loads": [],
              "api_url": api, "runtime_dir": str(runtime)}
    api_process = None
    api_log = None
    try:
        run([initdb, "-D", str(cluster), "-U", "postgres", "--encoding=UTF8",
             "--locale=C", "--auth=trust", "--no-instructions"])
        # Windows background PostgreSQL processes may inherit a pipe handle;
        # capture to a file so communicate() cannot wait for the server's EOF.
        with (runtime / "pg_ctl-start.log").open("w", encoding="utf-8") as startup_log:
            started = subprocess.run([pg_ctl, "-D", str(cluster), "-l", str(runtime / "postgres.log"),
                                      "-w", "-t", "30", "-o", f"-h 127.0.0.1 -p {pg_port}", "start"],
                                     stdout=startup_log, stderr=subprocess.STDOUT, timeout=45, **HIDDEN)
        if started.returncode:
            raise RuntimeError("pg_ctl startup failed; inspect the isolated runtime logs")
        with psycopg.connect(base_uri + "postgres?sslmode=disable", autocommit=True) as conn:
            conn.execute("create database pathnet_p1_m1")
        with psycopg.connect(uri) as conn:
            conn.execute((ROOT / "supabase/migrations/0001_graph.sql").read_text(encoding="utf-8-sig"))
            result["server_version"] = conn.execute("select version()").fetchone()[0]
            result["server_version_num"] = int(conn.execute("show server_version_num").fetchone()[0])
            if result["server_version_num"] < 160000:
                raise AssertionError("Acceptance requires native PostgreSQL 16 or later")
        seed_env = {**os.environ, "DATABASE_URL": uri, "DATA_DIR": str(ROOT / "data")}
        for attempt in range(1, 3):
            output = run([sys.executable, str(ROOT / "pipeline/load_seed.py")], env=seed_env, cwd=ROOT)
            with psycopg.connect(uri, row_factory=dict_row) as conn:
                for table in TABLES:
                    rows = conn.execute(f"select * from public.{table}").fetchall()
                    if normalized(rows, table) != normalized(graph[table], table):
                        raise AssertionError(f"{table} did not round-trip exactly on load {attempt}")
                conn.execute("set role anon")
                for table in TABLES:
                    count = conn.execute(f"select count(*) as n from public.{table}").fetchone()["n"]
                    if count != len(graph[table]):
                        raise AssertionError(f"anon count mismatch in {table}")
            result["loads"].append({"attempt": attempt, "loader_output": output,
                                    "all_five_tables_exact": True, "anon_reads_passed": True})
        print("PASS: native PostgreSQL, unchanged seed loader twice, all five exact round-trips and anon reads.", flush=True)
        api_env = {**os.environ, "PGRST_DB_URI": uri, "PGRST_DB_SCHEMAS": "public",
                   "PGRST_DB_ANON_ROLE": "anon", "PGRST_SERVER_HOST": "127.0.0.1",
                   "PGRST_SERVER_PORT": str(api_port), "PGRST_DB_CONFIG": "false",
                   # The official Windows PostgREST ZIP needs PostgreSQL's libpq DLLs.
                   "PATH": str(args.pg_bin.resolve()) + os.pathsep + os.environ.get("PATH", "")}
        api_log = (runtime / "postgrest.log").open("w", encoding="utf-8")
        api_process = subprocess.Popen([str(args.postgrest.resolve())], env=api_env,
                                       stdout=api_log, stderr=subprocess.STDOUT, **HIDDEN)
        wait_api(api, api_process)
        for table in TABLES:
            if normalized(read_json(api + "/" + table), table) != normalized(graph[table], table):
                raise AssertionError(f"PostgREST {table} did not round-trip exactly")
        result["postgrest_version"] = run([str(args.postgrest.resolve()), "--version"], env=api_env)
        result["postgrest_all_five_tables_exact"] = True
        result["app_loader_probe"] = run([args.node, str(ROOT / "pipeline/tests/check_app_load.mjs"),
                                           "--api-url", api, "--web-modules", str(args.web_modules.resolve())], cwd=ROOT)
        result["status"] = "passed"
        (runtime / "result.json").write_text(json.dumps(result, indent=2), encoding="utf-8")
        if args.report_file:
            args.report_file.parent.mkdir(parents=True, exist_ok=True)
            args.report_file.write_text(json.dumps(result, indent=2), encoding="utf-8")
        print(json.dumps(result, indent=2), flush=True)
        if args.hold_seconds:
            print(f"READY for browser check: VITE_DATA_SOURCE=rest VITE_API_URL={api}; "
                  f"holding for {args.hold_seconds} seconds", flush=True)
            deadline = time.monotonic() + args.hold_seconds
            while time.monotonic() < deadline:
                if api_process.poll() is not None:
                    raise RuntimeError("PostgREST exited during the browser-check window")
                time.sleep(1)
    finally:
        if api_process is not None and api_process.poll() is None:
            api_process.terminate()
            try:
                api_process.wait(timeout=10)
            except subprocess.TimeoutExpired:
                api_process.kill()
                api_process.wait(timeout=10)
        if api_log is not None:
            api_log.close()
        if (cluster / "postmaster.pid").exists():
            run([pg_ctl, "-D", str(cluster), "-m", "fast", "-w", "-t", "15", "stop"], timeout=25)
        print("Temporary PostgreSQL/PostgREST stopped; isolated logs and result retained.", flush=True)


if __name__ == "__main__":
    main()
