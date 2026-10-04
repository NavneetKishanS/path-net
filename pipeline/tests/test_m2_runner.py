"""Offline acceptance checks for the isolated, finite M2 staging runner."""
import hashlib
import json
import os
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest
from unittest.mock import patch


sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from run_m2 import inventory, run_once


class M2RunnerTests(unittest.TestCase):
    def setUp(self):
        self.temporary = tempfile.TemporaryDirectory()
        self.addCleanup(self.temporary.cleanup)
        self.workspace = Path(self.temporary.name)
        self.project = self.workspace / "release"
        self.stage = self.workspace / "candidate"
        files = {
            "pipeline/fetch_slice.py": "# Fixture acquisition entry point.\n",
            "pipeline/build_graph.py": "# Fixture build entry point.\n",
            "pipeline/validate_graph.py": "# Fixture validation entry point.\n",
            "pipeline/audit_cache.py": "# Fixture cache audit entry point.\n",
            "pipeline/common.py": "# Fixture shared source.\n",
            "contract/graph.schema.json": '{"type": "object"}\n',
            "data/raw/source/record.json": '{"id": "release-record"}\n',
            "data/curation/source.json": '{"version": "released"}\n',
            "data/seed/graph.json": '{"nodes": [], "edges": []}\n',
            "data/seed/provenance.json": '{"sources": []}\n',
        }
        for relative, contents in files.items():
            target = self.project / relative
            target.parent.mkdir(parents=True, exist_ok=True)
            target.write_text(contents, encoding="utf-8")
        self.calls = []

    def success(self, argv, cwd, env):
        self.calls.append((list(argv), Path(cwd), dict(env)))
        return subprocess.CompletedProcess(argv, 0, stdout="fixture step completed\n", stderr="")

    def receipt_on_disk(self):
        path = self.stage / "receipt.json"
        self.assertTrue(path.is_file(), "Every attempted run must leave a durable receipt")
        return json.loads(path.read_text(encoding="utf-8"))

    def assert_steps(self, expected_scripts):
        scripts = [next(Path(arg).name for arg in argv if str(arg).endswith(".py"))
                   for argv, _, _ in self.calls]
        self.assertEqual(scripts, expected_scripts)

    def test_inventory_records_content_hash_size_and_relative_paths(self):
        contents = b"original release bytes\x00\xff"
        nested = self.workspace / "inventory/nested/record.bin"
        nested.parent.mkdir(parents=True)
        nested.write_bytes(contents)
        empty = nested.parent.parent / "empty.txt"
        empty.write_bytes(b"")

        snapshot = inventory(nested.parent.parent)

        self.assertEqual(set(snapshot), {"nested/record.bin", "empty.txt"})
        self.assertEqual(snapshot["nested/record.bin"]["sha256"], hashlib.sha256(contents).hexdigest())
        self.assertEqual(snapshot["nested/record.bin"]["size"], len(contents))
        self.assertEqual(snapshot["empty.txt"]["size"], 0)

    def test_replay_is_finite_and_leaves_release_bytes_unchanged(self):
        before = inventory(self.project / "data")

        receipt = run_once(self.project, self.stage, runner=self.success)

        self.assertEqual(receipt["status"], "complete")
        self.assertTrue(receipt["release_unchanged"])
        self.assertEqual(receipt["candidate_changes"], [])
        self.assertEqual(inventory(self.project / "data"), before)
        self.assertEqual(inventory(self.stage / "data"), before)

        for name in ("release_inventory.json", "release_inventory_after.json"):
            stored = json.loads((self.stage / name).read_text(encoding="utf-8"))
            self.assertEqual(stored, before)
        self.assert_steps(["fetch_slice.py", "build_graph.py", "validate_graph.py", "audit_cache.py"])
        self.assertNotIn("--refresh", self.calls[0][0])
        self.assertIn("--offline", self.calls[0][0])
        self.assertIn("--check-raw", self.calls[2][0])
        self.assertEqual(len(receipt["steps"]), 4)
        self.assertTrue(all(step["returncode"] == 0 for step in receipt["steps"]))
        self.assertTrue(all(step["name"] and step["status"] for step in receipt["steps"]))
        self.assertEqual(self.receipt_on_disk(), receipt)
        self.assertTrue(list(self.stage.rglob("*.log")), "Stage must retain the child output logs")

    def test_existing_funding_sidecar_is_rebuilt_before_cache_audit(self):
        (self.project / "pipeline/build_funding_projection.py").write_text("# Fixture projection.\n", encoding="utf-8")
        (self.project / "data/seed/funding_overlap.json").write_text('{"groups": []}\n', encoding="utf-8")
        receipt = run_once(self.project, self.stage, runner=self.success)
        self.assertEqual(receipt["status"], "complete")
        self.assert_steps(["fetch_slice.py", "build_graph.py", "validate_graph.py", "build_funding_projection.py", "audit_cache.py"])
        self.assertEqual(receipt["candidate_changes"], [])

    def test_children_use_staged_code_and_override_inherited_data_directory(self):
        with patch.dict(os.environ, {"DATA_DIR": str(self.project / "data")}):
            run_once(self.project, self.stage, runner=self.success)

        for argv, cwd, env in self.calls:
            self.assertEqual(cwd.resolve(), self.stage.resolve())
            self.assertEqual(Path(env["DATA_DIR"]).resolve(), (self.stage / "data").resolve())
            script = next(Path(arg) for arg in argv if str(arg).endswith(".py"))
            if not script.is_absolute():
                script = cwd / script
            self.assertTrue(script.resolve().is_relative_to(self.stage.resolve()))
            self.assertTrue(script.is_file())
        self.assertTrue((self.stage / "contract/graph.schema.json").is_file())
        self.assertTrue((self.stage / "pipeline/common.py").is_file())

    def test_offline_guard_is_active_inside_an_actual_python_child(self):
        def guarded_child(argv, cwd, env):
            result = self.success(argv, cwd, env)
            if len(self.calls) == 1:
                probe = subprocess.run(
                    [sys.executable, "-c",
                     "import socket; "
                     "assert socket.getaddrinfo.__module__ == 'sitecustomize', 'offline guard missing'; "
                     "socket.getaddrinfo('example.org', 443)"],
                    cwd=cwd, env=env, capture_output=True, text=True, check=False, timeout=15,
                )
                self.assertNotEqual(probe.returncode, 0)
                self.assertIn("RuntimeError: M2 offline acceptance prohibits network access", probe.stderr)
            return result

        receipt = run_once(self.project, self.stage, runner=guarded_child)

        self.assertEqual(receipt["status"], "complete")
        self.assertEqual(len(self.calls), 4)

    def test_environment_files_are_not_cloned_and_output_secrets_are_redacted(self):
        secret = "m2-fixture-private-api-key-719"
        for relative in (".env", "pipeline/.env"):
            (self.project / relative).write_text("NCBI_API_KEY=" + secret, encoding="utf-8")

        def noisy_child(argv, cwd, env):
            self.calls.append((list(argv), Path(cwd), dict(env)))
            self.assertEqual(env["NCBI_API_KEY"], secret)
            return subprocess.CompletedProcess(
                argv, 0,
                stdout="Request https://example.invalid/?api_key=" + secret + "\n",
                stderr="credential=" + secret + "\n",
            )

        with patch.dict(os.environ, {"NCBI_API_KEY": secret}):
            receipt = run_once(self.project, self.stage, runner=noisy_child)

        self.assertFalse(list(self.stage.rglob(".env")))
        self.assertNotIn(secret, json.dumps(receipt))
        logs = list(self.stage.rglob("*.log"))
        self.assertTrue(logs)
        for path in [self.stage / "receipt.json", *logs]:
            self.assertNotIn(secret, path.read_text(encoding="utf-8"))

    def test_secret_file_in_raw_release_is_rejected_without_cloning_it(self):
        source_env = self.project / "data/raw/.env"
        source_env.write_text("NCBI_API_KEY=fixture-private-raw-key", encoding="utf-8")
        before = inventory(self.project / "data")

        receipt = run_once(self.project, self.stage, runner=self.success)

        self.assertEqual(receipt["status"], "failed")
        self.assertTrue(receipt["release_unchanged"])
        self.assertEqual(self.calls, [])
        self.assertFalse(list(self.stage.rglob(".env")))
        self.assertEqual(inventory(self.project / "data"), before)
        self.assertEqual(self.receipt_on_disk(), receipt)

    def test_acquisition_failure_stops_build_and_validation_and_persists_receipt(self):
        before = inventory(self.project / "data")

        def failed_child(argv, cwd, env):
            self.calls.append((list(argv), Path(cwd), dict(env)))
            return subprocess.CompletedProcess(argv, 23, stdout="acquisition unavailable\n", stderr="")

        receipt = run_once(self.project, self.stage, runner=failed_child)

        self.assertEqual(receipt["status"], "failed")
        self.assertTrue(receipt["release_unchanged"])
        self.assert_steps(["fetch_slice.py"])
        self.assertEqual(len(receipt["steps"]), 1)
        self.assertEqual(receipt["steps"][0]["returncode"], 23)
        self.assertEqual(receipt["steps"][0]["status"], "failed")
        self.assertEqual(self.receipt_on_disk(), receipt)
        self.assertEqual(inventory(self.project / "data"), before)

    def test_runner_exception_becomes_a_durable_failure(self):
        secret = "m2-fixture-exception-private-key-831"

        def broken_child(argv, cwd, env):
            self.calls.append((list(argv), Path(cwd), dict(env)))
            raise OSError("could not start child: " + secret)

        with patch.dict(os.environ, {"NCBI_API_KEY": secret}):
            receipt = run_once(self.project, self.stage, runner=broken_child)

        self.assertEqual(receipt["status"], "failed")
        self.assertTrue(receipt["release_unchanged"])
        self.assert_steps(["fetch_slice.py"])
        self.assertEqual(self.receipt_on_disk(), receipt)
        self.assertNotIn(secret, json.dumps(receipt))
        for path in self.stage.rglob("*.log"):
            self.assertNotIn(secret, path.read_text(encoding="utf-8"))

    def test_changed_candidate_sources_require_review_without_changing_release(self):
        before = inventory(self.project / "data")

        def changed_child(argv, cwd, env):
            result = self.success(argv, cwd, env)
            if len(self.calls) == 1:
                data = Path(env["DATA_DIR"])
                (data / "raw/source/record.json").write_text('{"id": "candidate-record"}\n', encoding="utf-8")
                (data / "curation/source.json").write_text('{"version": "candidate"}\n', encoding="utf-8")
            return result

        receipt = run_once(self.project, self.stage, runner=changed_child)

        self.assertEqual(receipt["status"], "pending_review")
        self.assertTrue(receipt["release_unchanged"])
        self.assertTrue(receipt["candidate_changes"])
        self.assertEqual(inventory(self.project / "data"), before)
        self.assertIn("--offline", self.calls[0][0])
        self.assert_steps(["fetch_slice.py", "build_graph.py", "validate_graph.py", "audit_cache.py"])
        self.assertEqual(self.receipt_on_disk(), receipt)

    def test_json_newlines_are_restored_after_each_successful_child(self):
        baseline = {
            "raw/source/metadata.json": b'{\n  "id": "released-metadata"\n}\n',
            "curation/source.json": b'{\n  "version": "released"\n}\n',
            "seed/graph.json": b'{\n  "nodes": [],\n  "edges": []\n}\n',
        }
        for relative, body in baseline.items():
            (self.project / "data" / relative).write_bytes(body)
        before = inventory(self.project / "data")
        source_paths = ["raw/source/metadata.json", "curation/source.json"]

        def newline_child(argv, cwd, env):
            result = self.success(argv, cwd, env)
            data = Path(env["DATA_DIR"])
            if len(self.calls) == 1:
                for relative in source_paths:
                    (data / relative).write_bytes(baseline[relative].replace(b"\n", b"\r\n"))
            elif len(self.calls) == 2:
                for relative in source_paths:
                    self.assertEqual((data / relative).read_bytes(), baseline[relative])
                relative = "seed/graph.json"
                (data / relative).write_bytes(baseline[relative].replace(b"\n", b"\r\n"))
            elif len(self.calls) == 3:
                self.assertEqual((data / "seed/graph.json").read_bytes(), baseline["seed/graph.json"])
            return result

        receipt = run_once(self.project, self.stage, runner=newline_child)

        self.assertEqual(receipt["status"], "complete")
        self.assertTrue(receipt["release_unchanged"])
        self.assertEqual(receipt["candidate_changes"], [])
        self.assertEqual(inventory(self.project / "data"), before)
        self.assertEqual(inventory(self.stage / "data"), before)
        expected_restorations = [source_paths, ["seed/graph.json"], [], []]
        self.assertEqual(len(receipt["steps"]), len(expected_restorations))
        for step, expected in zip(receipt["steps"], expected_restorations):
            self.assertEqual(sorted(step["format_only_restorations"]), sorted(expected))
            self.assertEqual(step["format_only_restoration_count"], len(expected))
        self.assertEqual(receipt["format_only_restoration_count"], 3)
        self.assertEqual(self.receipt_on_disk(), receipt)

    def test_other_json_formatting_changes_still_require_review(self):
        relative = "curation/source.json"
        baseline = b'{"version": "released"}\n'
        reformatted = b'{\r\n  "version": "released"\r\n}\r\n'
        self.assertEqual(json.loads(baseline), json.loads(reformatted))
        (self.project / "data" / relative).write_bytes(baseline)
        before = inventory(self.project / "data")

        def reformatted_child(argv, cwd, env):
            result = self.success(argv, cwd, env)
            if len(self.calls) == 1:
                (Path(env["DATA_DIR"]) / relative).write_bytes(reformatted)
            return result

        receipt = run_once(self.project, self.stage, runner=reformatted_child)

        self.assertEqual(receipt["status"], "pending_review")
        self.assertTrue(receipt["release_unchanged"])
        self.assertEqual(inventory(self.project / "data"), before)
        self.assertEqual((self.stage / "data" / relative).read_bytes(), reformatted)
        self.assertEqual([change["path"] for change in receipt["candidate_changes"]], [relative])
        for step in receipt["steps"]:
            self.assertEqual(step["format_only_restorations"], [])
            self.assertEqual(step["format_only_restoration_count"], 0)
        self.assertEqual(receipt["format_only_restoration_count"], 0)
        self.assertEqual(self.receipt_on_disk(), receipt)

    def test_raw_body_and_text_newline_changes_still_require_review(self):
        baseline = b"first source line\nsecond source line\n"
        changed = baseline.replace(b"\n", b"\r\n")
        paths = ["raw/source/response.body", "raw/source/page.txt"]
        for relative in paths:
            (self.project / "data" / relative).write_bytes(baseline)
        before = inventory(self.project / "data")

        def raw_text_child(argv, cwd, env):
            result = self.success(argv, cwd, env)
            if len(self.calls) == 1:
                for relative in paths:
                    (Path(env["DATA_DIR"]) / relative).write_bytes(changed)
            return result

        receipt = run_once(self.project, self.stage, runner=raw_text_child)

        self.assertEqual(receipt["status"], "pending_review")
        self.assertTrue(receipt["release_unchanged"])
        self.assertEqual(inventory(self.project / "data"), before)
        self.assertEqual(sorted(change["path"] for change in receipt["candidate_changes"]), sorted(paths))
        for relative in paths:
            self.assertEqual((self.stage / "data" / relative).read_bytes(), changed)
        for step in receipt["steps"]:
            self.assertEqual(step["format_only_restorations"], [])
            self.assertEqual(step["format_only_restoration_count"], 0)
        self.assertEqual(receipt["format_only_restoration_count"], 0)
        self.assertEqual(self.receipt_on_disk(), receipt)

    def test_failed_child_keeps_its_json_newline_changes_for_inspection(self):
        relative = "raw/source/record.json"
        baseline = b'{\n  "id": "release-record"\n}\n'
        changed = baseline.replace(b"\n", b"\r\n")
        (self.project / "data" / relative).write_bytes(baseline)
        before = inventory(self.project / "data")

        def failed_newline_child(argv, cwd, env):
            self.calls.append((list(argv), Path(cwd), dict(env)))
            (Path(env["DATA_DIR"]) / relative).write_bytes(changed)
            return subprocess.CompletedProcess(argv, 23, stdout="failed after writing candidate\n", stderr="")

        receipt = run_once(self.project, self.stage, runner=failed_newline_child)

        self.assertEqual(receipt["status"], "failed")
        self.assertTrue(receipt["release_unchanged"])
        self.assert_steps(["fetch_slice.py"])
        self.assertEqual(inventory(self.project / "data"), before)
        self.assertEqual((self.stage / "data" / relative).read_bytes(), changed)
        self.assertEqual([change["path"] for change in receipt["candidate_changes"]], [relative])
        self.assertEqual(receipt["steps"][0]["format_only_restorations"], [])
        self.assertEqual(receipt["steps"][0]["format_only_restoration_count"], 0)
        self.assertEqual(receipt["format_only_restoration_count"], 0)
        self.assertEqual(self.receipt_on_disk(), receipt)

    def test_unexpected_release_modification_prevents_success(self):
        before = inventory(self.project / "data")

        def changed_release(argv, cwd, env):
            result = self.success(argv, cwd, env)
            if len(self.calls) == 1:
                (self.project / "data/raw/source/record.json").write_text(
                    '{"id": "unexpected-external-change"}\n', encoding="utf-8")
            return result

        receipt = run_once(self.project, self.stage, runner=changed_release)

        self.assertEqual(receipt["status"], "failed")
        self.assertFalse(receipt["release_unchanged"])
        self.assertEqual(self.receipt_on_disk(), receipt)
        stored_before = json.loads((self.stage / "release_inventory.json").read_text(encoding="utf-8"))
        stored_after = json.loads((self.stage / "release_inventory_after.json").read_text(encoding="utf-8"))
        self.assertEqual(stored_before, before)
        self.assertEqual(stored_after, inventory(self.project / "data"))
        self.assertNotEqual(stored_before, stored_after)

    def test_existing_stage_is_rejected_without_overwriting_its_contents(self):
        self.stage.mkdir()
        sentinel = self.stage / "keep.txt"
        sentinel.write_text("existing user content", encoding="utf-8")

        with self.assertRaises(ValueError):
            run_once(self.project, self.stage, runner=self.success)

        self.assertEqual(sentinel.read_text(encoding="utf-8"), "existing user content")
        self.assertEqual(self.calls, [])

    def test_refresh_is_rejected_before_creating_a_stage(self):
        with self.assertRaises(ValueError):
            run_once(self.project, self.stage, refresh=True, runner=self.success)

        self.assertFalse(self.stage.exists())
        self.assertEqual(self.calls, [])

    def test_source_junction_is_rejected_before_hashing_or_copying(self):
        for target in (self.project / "pipeline", self.project / "data/raw/source"):
            with self.subTest(target=target):
                with patch.object(Path, "is_junction", lambda path: path == target, create=True):
                    with patch("run_m2.release_inventory") as hash_release:
                        with self.assertRaisesRegex(ValueError, "junction"):
                            run_once(self.project, self.stage, runner=self.success)
                        hash_release.assert_not_called()
        self.assertFalse(self.stage.exists())
        self.assertEqual(self.calls, [])

    def test_stage_within_release_is_rejected_before_any_child_runs(self):
        before = inventory(self.project)
        for destination in (self.project, self.project / "data/new-stage", self.project / "pipeline/new-stage"):
            with self.subTest(destination=destination), self.assertRaises(ValueError):
                run_once(self.project, destination, runner=self.success)

        self.assertEqual(self.calls, [])
        self.assertEqual(inventory(self.project), before)


if __name__ == "__main__":
    unittest.main()
