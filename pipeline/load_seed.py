"""Load data/seed/graph.json into Postgres. Safe to re-run: it replaces the graph tables.

    docker compose run --rm seed          # inside docker
    python load_seed.py                   # locally (needs DATABASE_URL, default localhost:54322)
"""
import psycopg
from psycopg.types.json import Jsonb

from common import DATABASE_URL, SEED_FILE, load_seed


def main() -> None:
    g = load_seed()
    with psycopg.connect(DATABASE_URL) as conn, conn.cursor() as cur:
        cur.execute("truncate evidence, node_cluster, clusters, edges, nodes cascade")
        for n in g["nodes"]:
            cur.execute(
                "insert into nodes (id,type,name,synonyms,ext_ids,props) values (%s,%s,%s,%s,%s,%s)",
                (n["id"], n["type"], n["name"], n.get("synonyms", []), Jsonb(n.get("ext_ids", {})), Jsonb(n.get("props", {}))),
            )
        for e in g["edges"]:
            cur.execute(
                "insert into edges (id,src,dst,type,tier,confidence,stance,status,note) values (%s,%s,%s,%s,%s,%s,%s,%s,%s)",
                (e["id"], e["src"], e["dst"], e["type"], e["tier"], e.get("confidence"), e.get("stance", "supports"), e.get("status", "unverified"), e.get("note")),
            )
        for ev in g.get("evidence", []):
            cur.execute(
                "insert into evidence (id,edge_id,source_type,source_url,pmid,snippet,retrieved_at) values (%s,%s,%s,%s,%s,%s,%s)",
                (ev["id"], ev["edge_id"], ev.get("source_type"), ev.get("source_url"), ev.get("pmid"), ev.get("snippet"), ev.get("retrieved_at")),
            )
        for c in g.get("clusters", []):
            cur.execute("insert into clusters (id,label,mechanism) values (%s,%s,%s)", (c["id"], c["label"], Jsonb(c.get("mechanism", {}))))
        for nc in g.get("node_cluster", []):
            cur.execute("insert into node_cluster (node_id,cluster_id) values (%s,%s)", (nc["node_id"], nc["cluster_id"]))
    print(
        f"Loaded {SEED_FILE.name}: {len(g['nodes'])} nodes, {len(g['edges'])} edges, "
        f"{len(g.get('evidence', []))} evidence rows, {len(g.get('clusters', []))} clusters."
    )


if __name__ == "__main__":
    main()
