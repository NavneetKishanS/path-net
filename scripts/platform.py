"""P4 operator commands. Run from any directory; never expose operator keys to Vite."""
from __future__ import annotations

import argparse
import hashlib
import json
import os
from pathlib import Path
import subprocess
import sys
from urllib.parse import urlsplit

ROOT = Path(__file__).resolve().parents[1]
TABLES = {
    "nodes": ("id", "type", "name", "synonyms", "ext_ids", "props"),
    "edges": ("id", "src", "dst", "type", "tier", "confidence", "stance", "status", "note"),
    "evidence": ("id", "edge_id", "source_type", "source_url", "pmid", "snippet", "retrieved_at"),
    "clusters": ("id", "label", "mechanism"),
    "node_cluster": ("node_id", "cluster_id"),
}
ROLES = ("family", "group_leader", "scout", "researcher", "admin")


def load_env() -> None:
    """Simple KEY=value files only; environment wins; no shell interpolation."""
    path = ROOT / ".env"
    if path.exists():
        for line in path.read_text(encoding="utf-8-sig").splitlines():
            line = line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            key, value = line.split("=", 1)
            key, value = key.strip(), value.strip()
            if len(value) >= 2 and value[0] == value[-1] and value[0] in "\"'":
                value = value[1:-1]
            if key.replace("_", "").isalnum():
                os.environ.setdefault(key, value)


def required(key: str) -> str:
    value = os.environ.get(key, "").strip()
    if not value:
        raise ValueError(f"Set {key} in the process environment or local .env first.")
    return value


def connect():
    import psycopg
    return psycopg.connect(required("DATABASE_URL"))


def migrate() -> None:
    """Apply each numbered migration once; reject edits to applied migrations."""
    with connect() as conn, conn.cursor() as cur:
        cur.execute("select pg_advisory_xact_lock(7340214)")
        cur.execute("create schema if not exists pathnet_private")
        cur.execute("revoke all on schema pathnet_private from public")
        cur.execute("""create table if not exists pathnet_private.migrations
            (name text primary key, sha256 text not null, applied_at timestamptz default now())""")
        for file in sorted((ROOT / "supabase/migrations").glob("*.sql")):
            raw = file.read_bytes()
            # Canonical newlines make the ledger portable across Git checkouts.
            source = raw.decode("utf-8-sig").replace("\r\n", "\n")
            digest = hashlib.sha256(source.encode()).hexdigest()
            cur.execute("select sha256 from pathnet_private.migrations where name=%s", (file.name,))
            previous = cur.fetchone()
            if previous:
                if previous[0] != digest:
                    raise ValueError(f"Applied migration changed: {file.name}; add a new migration instead.")
                print(f"Already applied: {file.name}")
                continue
            cur.execute(source)
            cur.execute("insert into pathnet_private.migrations(name,sha256) values (%s,%s)", (file.name, digest))
            print(f"Applied: {file.name}")
        cur.execute("notify pgrst, 'reload schema'")


def upsert_graph(cur, graph: dict) -> None:
    from psycopg import sql
    from psycopg.types.json import Jsonb
    for table, columns in TABLES.items():
        keys = ("node_id", "cluster_id") if table == "node_cluster" else ("id",)
        updates = [c for c in columns if c not in keys]
        conflict = sql.SQL("do update set {} ").format(sql.SQL(",").join(
            sql.SQL("{}=excluded.{}").format(sql.Identifier(c), sql.Identifier(c)) for c in updates
        )) if updates else sql.SQL("do nothing")
        statement = sql.SQL("insert into public.{} ({}) values ({}) on conflict ({}) {}").format(
            sql.Identifier(table), sql.SQL(",").join(map(sql.Identifier, columns)),
            sql.SQL(",").join(sql.Placeholder() for _ in columns),
            sql.SQL(",").join(map(sql.Identifier, keys)), conflict,
        )
        for row in graph[table]:
            values = [Jsonb(row[c]) if c in ("ext_ids", "props", "mechanism") else row[c] for c in columns]
            cur.execute(statement, values)


def seed() -> None:
    """Upsert reviewed P1 rows; preserve contributed edges, role assignments and audit history."""
    from psycopg.types.json import Jsonb
    subprocess.run([sys.executable, str(ROOT / "pipeline/validate_graph.py")], cwd=ROOT,
                   env={**os.environ, "DATA_DIR": str(ROOT / "data")}, check=True)
    graph = json.loads((ROOT / "data/seed/graph.json").read_text(encoding="utf-8"))
    coverage = json.loads((ROOT / "data/seed/coverage.json").read_text(encoding="utf-8"))
    with connect() as conn, conn.cursor() as cur:
        upsert_graph(cur, graph)
        cur.execute("""insert into public.coverage_cache(cache_key,audience,payload)
            values ('p1-slice-v1','family',%s) on conflict (cache_key)
            do update set payload=excluded.payload,created_at=now()""", (Jsonb(coverage),))
    print("Seed upsert complete: " + ", ".join(f"{len(graph[t])} {t}" for t in TABLES))


def cache(input_path: Path) -> None:
    """Replace superseded responses for each supplied audience and ordered path."""
    from psycopg.types.json import Jsonb
    bundle = json.loads(input_path.read_text(encoding="utf-8"))
    if set(bundle) != {"explanation_cache", "coverage_cache"}:
        raise ValueError("Expected explanation_cache and coverage_cache arrays from build_platform_cache.mjs.")
    with connect() as conn, conn.cursor() as cur:
        for row in bundle["explanation_cache"]:
            # A refreshed graph changes the key even when the requested path is unchanged.
            # Keep other paths and audiences, including their independent cache entries.
            cur.execute("""delete from public.explanation_cache
                where audience=%s and edge_ids=%s and cache_key<>%s""",
                (row["audience"], row["edge_ids"], row["cache_key"]))
            cur.execute("""insert into public.explanation_cache(cache_key,edge_ids,audience,payload)
                values (%s,%s,%s,%s) on conflict(cache_key) do update
                set edge_ids=excluded.edge_ids,audience=excluded.audience,payload=excluded.payload,created_at=now()""",
                (row["cache_key"], row["edge_ids"], row["audience"], Jsonb(row["payload"])))
        for row in bundle["coverage_cache"]:
            cur.execute("""insert into public.coverage_cache(cache_key,audience,payload)
                values (%s,%s,%s) on conflict(cache_key) do update
                set audience=excluded.audience,payload=excluded.payload,created_at=now()""",
                (row["cache_key"], row["audience"], Jsonb(row["payload"])))
    print(f"Loaded {len(bundle['explanation_cache'])} explanations and {len(bundle['coverage_cache'])} coverage snapshots.")


def safe_base_url() -> str:
    value = required("SUPABASE_URL").rstrip("/")
    parsed = urlsplit(value)
    if not parsed.hostname or (parsed.scheme != "https" and not (parsed.scheme == "http" and parsed.hostname in {"localhost", "127.0.0.1"})) or parsed.username or parsed.password or parsed.query or parsed.fragment or parsed.path:
        raise ValueError("SUPABASE_URL must be an HTTPS origin (HTTP allowed on loopback).")
    return value


def request_api(method: str, route: str, *, admin=False, bearer=None, **kwargs):
    import requests
    key = required("SUPABASE_SERVICE_ROLE_KEY" if admin else "SUPABASE_ANON_KEY")
    response = requests.request(method, safe_base_url() + route,
        headers={"apikey": key, "Authorization": "Bearer " + (bearer or key)}, timeout=30, allow_redirects=False, **kwargs)
    if not 200 <= response.status_code < 300:
        # Auth responses and request URLs can contain secrets; report only status.
        raise RuntimeError(f"Supabase request failed: {method} {route.split('?')[0]} HTTP {response.status_code}")
    return response.json() if response.content else None


def demo_users() -> None:
    """Explicit operator provisioning only; no email sent, existing passwords never reset."""
    accounts = []
    for role in ROLES:
        email = required(f"DEMO_{role.upper()}_EMAIL")
        password = required(f"DEMO_{role.upper()}_PASSWORD")
        if "@" not in email or len(password) < 12:
            raise ValueError(f"Provide a valid demo email and password of 12+ characters for {role}.")
        accounts.append((role, email, password))
    if len({email.casefold() for _, email, _ in accounts}) != len(ROLES):
        raise ValueError("Each role needs a different demo email.")
    users = {}
    for page in range(1, 1001):
        result = request_api("GET", f"/auth/v1/admin/users?page={page}&per_page=100", admin=True)
        batch = result.get("users", [])
        users.update({u.get("email", "").casefold(): u for u in batch})
        if len(batch) < 100:
            break
    else:
        raise ValueError("User inventory exceeds the supported bound; provision through Supabase dashboard.")
    # Check every existing identity before provisioning anything. Never take over a real account.
    for role, email, _ in accounts:
        existing = users.get(email.casefold())
        if existing and existing.get("app_metadata", {}).get("pathnet_demo_role") != role:
            raise ValueError(f"Existing identity for {role} is not a matching PathNet demo account.")
    with connect() as conn, conn.cursor() as cur:
        for role, email, password in accounts:
            user = users.get(email.casefold())
            if not user:
                user = request_api("POST", "/auth/v1/admin/users", admin=True, json={
                    "email": email, "password": password, "email_confirm": True,
                    "app_metadata": {"pathnet_demo_role": role},
                })
            cur.execute("insert into public.user_roles(user_id,role) values (%s,%s) on conflict(user_id) do update set role=excluded.role", (user["id"], role))
            print(f"Demo identity provisioned: {role}")


def smoke_auth() -> None:
    """Read-only cloud/local Supabase check with five real Auth tokens (no writes)."""
    for role in ROLES:
        session = request_api("POST", "/auth/v1/token?grant_type=password", json={
            "email": required(f"DEMO_{role.upper()}_EMAIL"),
            "password": required(f"DEMO_{role.upper()}_PASSWORD"),
        })
        token = session["access_token"]
        actual = request_api("POST", "/rest/v1/rpc/pathnet_role", bearer=token, json={})
        if actual != role:
            raise ValueError(f"Role mismatch for {role}.")
        rows = request_api("GET", "/rest/v1/edges?status=eq.verified&select=id&limit=1", bearer=token)
        if not rows:
            raise ValueError(f"No verified graph visible for {role}.")
        print(f"PASS Auth login, database role, verified graph: {role}")


def doctor() -> None:
    print("Local graph: " + ("available" if (ROOT / "data/seed/graph.json").exists() else "missing"))
    for key in ("DATABASE_URL", "SUPABASE_URL", "SUPABASE_ANON_KEY", "SUPABASE_SERVICE_ROLE_KEY", "OPENAI_API_KEY"):
        print(key + ": " + ("configured" if os.environ.get(key) else "not configured"))
    print("No connections made. Configured values are not a verified deployment.")


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("command", choices=("doctor", "migrate", "seed", "cache", "demo-users", "smoke-auth"))
    parser.add_argument("--input", type=Path, default=ROOT / ".venv/p4-platform-cache.json", help="Offline cache bundle for the cache command")
    args = parser.parse_args()
    load_env()
    commands = {"doctor": doctor, "migrate": migrate, "seed": seed, "cache": lambda: cache(args.input), "demo-users": demo_users, "smoke-auth": smoke_auth}
    try:
        commands[args.command]()
    except (ValueError, RuntimeError) as exc:
        parser.exit(1, f"{exc}\n")
    except Exception as exc:
        # Driver/network exceptions may embed URLs and credentials.
        parser.exit(1, f"{type(exc).__name__}: operation failed; inspect connectivity/configuration locally. No secrets logged.\n")


if __name__ == "__main__":
    main()
