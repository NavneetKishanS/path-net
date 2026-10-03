# Contract

`contract.json` holds the enums everyone codes against: node types, edge types, evidence tiers, roles.

Rules:
- Change it only after telling the team. P4 owns the file.
- When it changes, update `web/src/types.ts` (hand-mirrored) and `supabase/migrations/0001_graph.sql` (check constraints).
- Ids are short readable slugs (`dis_stxbp1`, `gene_stxbp1`). Prefer stable ontology ids in `ext_ids` (MONDO, HGNC, HPO, PMID), not in `id`.

## Graph file format (`data/seed/graph.json`)

```
{ "nodes":        [{ id, type, name, synonyms[], ext_ids{}, props{} }],
  "edges":        [{ id, src, dst, type, tier, confidence, stance, status, note }],
  "evidence":     [{ id, edge_id, source_type, source_url, pmid, snippet, retrieved_at }],
  "clusters":     [{ id, label, mechanism{} }],
  "node_cluster": [{ node_id, cluster_id }] }
```

Evidence rule: an edge without an evidence row is shown as "no evidence yet". A `source_type` of `placeholder` is shown as a placeholder. Never invent a source URL.
