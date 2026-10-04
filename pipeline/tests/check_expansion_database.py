"""Exercise unchanged P4 migrations/upsert, PostgREST and P3 on a fresh native DB.

No existing database or .env is used. The temporary server binds to loopback,
uses new ports, and stops in finally. All fixtures remain outside released data.
"""
from __future__ import annotations
import argparse
from datetime import datetime, timezone
import hashlib
import json
import os
from pathlib import Path
import subprocess
import sys
import tempfile

import psycopg
from psycopg.rows import dict_row
from check_native_postgres import HIDDEN, TABLES, free_port, normalized, read_json, run, wait_api

ROOT = Path(__file__).resolve().parents[2]


def schema_state(conn):
    rows = conn.execute("""select table_name,column_name,data_type,is_nullable,column_default
        from information_schema.columns where table_schema='public'
        order by table_name,ordinal_position""").fetchall()
    rows += conn.execute("""select conrelid::regclass::text as table_name,conname,
        pg_get_constraintdef(oid) as definition from pg_constraint
        where connamespace='public'::regnamespace order by conrelid::regclass::text,conname""").fetchall()
    rows += conn.execute("""select tablename,policyname,roles::text,cmd,qual,with_check
        from pg_policies where schemaname='public' order by tablename,policyname""").fetchall()
    return hashlib.sha256(json.dumps(rows, sort_keys=True, default=str).encode()).hexdigest()


def assert_tables(conn, expected):
    for table in TABLES:
        actual = conn.execute(f"select * from public.{table}").fetchall()
        if normalized(actual, table) != normalized(expected[table], table):
            raise AssertionError(f"SQL mismatch in {table}")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--pg-bin", type=Path, required=True)
    parser.add_argument("--postgrest", type=Path, required=True)
    parser.add_argument("--web-modules", type=Path, required=True)
    parser.add_argument("--work-dir", type=Path, required=True)
    parser.add_argument("--report-file", type=Path, required=True)
    args = parser.parse_args()
    work_dir = args.work_dir.resolve()
    if work_dir.is_relative_to(ROOT) or work_dir == ROOT:
        parser.error("Runtime must be outside the candidate")
    work_dir.mkdir(parents=True, exist_ok=True)
    runtime = Path(tempfile.mkdtemp(prefix="expansion-", dir=work_dir)).resolve()
    cluster = runtime / "cluster"
    suffix = ".exe" if os.name == "nt" else ""
    pg_ctl = str(args.pg_bin.resolve() / f"pg_ctl{suffix}")
    initdb = str(args.pg_bin.resolve() / f"initdb{suffix}")
    pg_port, api_port = free_port(), free_port()
    while api_port == pg_port:
        api_port = free_port()
    uri = f"postgresql://postgres@127.0.0.1:{pg_port}/pathnet_expansion?sslmode=disable"
    admin_uri = f"postgresql://postgres@127.0.0.1:{pg_port}/postgres?sslmode=disable"
    api = f"http://127.0.0.1:{api_port}"
    graph_bytes = (ROOT / "data/seed/graph.json").read_bytes()
    graph = json.loads(graph_bytes)
    env = {k: v for k, v in os.environ.items() if k.upper() in
           {"PATH", "SYSTEMROOT", "WINDIR", "TEMP", "TMP", "COMSPEC", "PATHEXT", "PYTHONIOENCODING", "SYSTEMDRIVE"}}
    env.update(DATABASE_URL=uri, DATA_DIR=str(ROOT / "data"), PYTHONIOENCODING="utf-8")
    report = {"checked_at": datetime.now(timezone.utc).isoformat(), "status": "running",
              "runtime": "isolated native PostgreSQL and PostgREST; unchanged P4 upsert",
              "graph_file_sha256": hashlib.sha256(graph_bytes).hexdigest(),
              "candidate_counts": {table: len(graph[table]) for table in TABLES},
              "runtime_dir": str(runtime), "api_url": api, "checks": {}}
    process, api_log = None, None

    def operator(command, *extra):
        output = run([sys.executable, str(ROOT / "scripts/platform.py"), command, *extra], cwd=ROOT, env=env)
        with (runtime / "operator.log").open("a", encoding="utf-8") as log:
            log.write(command + "\n" + output + "\n")

    try:
        run([initdb, "-D", str(cluster), "-U", "postgres", "--encoding=UTF8", "--locale=C", "--auth=trust", "--no-instructions"], env=env)
        with (runtime / "pg_ctl-start.log").open("w", encoding="utf-8") as log:
            started = subprocess.run([pg_ctl, "-D", str(cluster), "-l", str(runtime / "postgres.log"),
                                      "-w", "-t", "30", "-o", f"-h 127.0.0.1 -p {pg_port}", "start"],
                                     stdout=log, stderr=subprocess.STDOUT, env=env, timeout=45, **HIDDEN)
        if started.returncode:
            raise RuntimeError("Isolated native PostgreSQL startup failed")
        with psycopg.connect(admin_uri, autocommit=True) as conn:
            conn.execute("create database pathnet_expansion")
        operator("migrate")
        operator("migrate")
        with psycopg.connect(uri, row_factory=dict_row) as conn:
            report["server_version"] = conn.execute("select version() as value").fetchone()["value"]
            before_schema = schema_state(conn)
            assert conn.execute("select count(*) as n from pathnet_private.migrations").fetchone()["n"] == 2
        for _ in range(2):
            operator("seed")
            with psycopg.connect(uri, row_factory=dict_row) as conn:
                assert_tables(conn, graph)
        report["checks"]["two_exact_sql_round_trips"] = True
        api_env = {**env, "PGRST_DB_URI": uri, "PGRST_DB_SCHEMAS": "public", "PGRST_DB_ANON_ROLE": "anon",
                   "PGRST_SERVER_HOST": "127.0.0.1", "PGRST_SERVER_PORT": str(api_port), "PGRST_DB_CONFIG": "false",
                   "PATH": str(args.pg_bin.resolve()) + os.pathsep + env.get("PATH", "")}
        api_log = (runtime / "postgrest.log").open("w", encoding="utf-8")
        process = subprocess.Popen([str(args.postgrest.resolve())], env=api_env, stdout=api_log, stderr=subprocess.STDOUT, **HIDDEN)
        wait_api(api, process)
        for table in TABLES:
            if normalized(read_json(f"{api}/{table}"), table) != normalized(graph[table], table):
                raise AssertionError(f"Unpaged REST response truncated or changed {table}")
        report["checks"]["five_exact_rest_tables_without_truncation"] = True
        report["postgrest_version"] = run([str(args.postgrest.resolve()), "--version"], env=api_env)
        report["app_loader_probe"] = run(["node", str(ROOT / "pipeline/tests/check_app_load.mjs"),
                                          "--api-url", api, "--web-modules", str(args.web_modules.resolve())], cwd=ROOT, env=env)
        report["checks"]["unchanged_p3_loadGraph_rest"] = True
        cache_file = runtime / "platform-cache.json"
        run(["node", str(ROOT / "scripts/build_platform_cache.mjs"), "--output", str(cache_file)], cwd=ROOT, env=env)
        operator("cache", "--input", str(cache_file))
        expected_cache = json.loads(cache_file.read_text(encoding="utf-8"))
        with psycopg.connect(uri, row_factory=dict_row) as conn:
            assert conn.execute("select count(*) as n from public.explanation_cache").fetchone()["n"] == 20
            actual_cache = conn.execute("select cache_key,edge_ids,audience,payload from public.explanation_cache order by cache_key").fetchall()
            assert actual_cache == sorted(expected_cache["explanation_cache"], key=lambda r: r["cache_key"])
        report["checks"]["twenty_existing_persona_explanations"] = True
        # Use existing contribution RPCs to model data that an upsert must retain.
        with psycopg.connect(uri, row_factory=dict_row) as conn:
            conn.execute("insert into public.user_roles(user_id,role) values('10000000-0000-0000-0000-000000000001','admin')")
            conn.execute("insert into public.organizations(id,name) values('20000000-0000-0000-0000-000000000001','Synthetic isolated test organization')")
            conn.execute("insert into public.organization_members(user_id,org_id) values('10000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000001')")
            conn.execute("set role authenticated")
            conn.execute("set request.jwt.claims = '{\"sub\":\"10000000-0000-0000-0000-000000000001\"}'")
            contribution = conn.execute("select (public.submit_contribution(%s,%s,%s,%s,%s)).id as id",
                                        ("group_stxbp1_foundation", "dis_stxbp1", "group_disease", "https://example.test/test-fixture", "Synthetic isolated reload fixture; not production evidence.")).fetchone()["id"]
            edge_id = conn.execute("select (public.review_contribution(%s,'approve','Isolated test only')).edge_id as id", (contribution,)).fetchone()["id"]
            conn.execute("reset role")
            preserved = {t: conn.execute(f"select * from public.{t}").fetchall() for t in
                         ("user_roles", "organizations", "organization_members", "contributions", "professional_contact_records")}
            expected_graph = {t: conn.execute(f"select * from public.{t}").fetchall() for t in TABLES}
        for _ in range(2):
            operator("seed")
            with psycopg.connect(uri, row_factory=dict_row) as conn:
                assert_tables(conn, expected_graph)
                for table, rows in preserved.items():
                    assert rows == conn.execute(f"select * from public.{table}").fetchall(), f"Lost platform rows in {table}"
                assert schema_state(conn) == before_schema, "Seed changed schema/constraints/RLS"
                assert conn.execute("select payload from public.coverage_cache where cache_key='p1-slice-v1'").fetchone()["payload"] == json.loads((ROOT / "data/seed/coverage.json").read_text(encoding="utf-8"))
        assert any(e["id"] == edge_id for e in read_json(api + "/edges"))
        report["checks"].update(two_upserts_preserve_approved_contribution_and_roles=True,
                               schema_constraints_rls_unchanged=True, updated_coverage_cache=True,
                               approved_contribution_visible_via_rest=True)
        report["status"] = "passed"
    except Exception as exc:
        report["status"] = "failed"
        report["failure_type"] = type(exc).__name__
        raise
    finally:
        if process and process.poll() is None:
            process.terminate()
            try:
                process.wait(timeout=10)
            except subprocess.TimeoutExpired:
                process.kill(); process.wait(timeout=10)
        if api_log:
            api_log.close()
        if (cluster / "postmaster.pid").exists():
            run([pg_ctl, "-D", str(cluster), "-m", "fast", "-w", "-t", "15", "stop"], env=env, timeout=25)
        report["temporary_servers_stopped"] = True
        args.report_file.parent.mkdir(parents=True, exist_ok=True)
        args.report_file.write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
        print(json.dumps(report, indent=2), flush=True)


if __name__ == "__main__":
    main()
