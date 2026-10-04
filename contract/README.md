# Contract

`contract.json` holds the enums everyone codes against: node types, edge types, evidence tiers, roles.

Rules:
- Change it only after telling the team. P4 owns the file.
- When it changes, update `web/src/types.ts` (hand-mirrored) and SQL check constraints through a new numbered migration; do not edit an already applied migration.
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

## P4 platform additions (2026-10-04)

The graph format and `contract.json` enums remain unchanged. Text slug IDs and `nodes.name` are the implemented team contract; do not replace them with the Blueprint's illustrative UUID/`canonical_name` fields. P1's graph continues to load through P3's unchanged `loadGraph(): Promise<Graph>`.

The additive HTTP/RPC interfaces are documented in [platform-api.md](platform-api.md), with TypeScript types in [platform.ts](platform.ts). They cover cited explanations, slice coverage, draft extraction and contribution review. User roles, organizations, contacts, contributions and caches live in separate platform tables rather than extra graph fields.

Funding remains a projection of award asset metadata: `asset.props.funder`, fiscal year, project ID and investigator IDs, joined through the existing `asset_disease` relation. This P4 decision avoids introducing a funder node or relation in this release. Shared funding is not a mechanism match or evidence of treatment response. A later dedicated funding relation requires an explicit enum change and mirrored P2/P3 updates.

`confidence: null` stays unknown, never zero. Contradicting edges remain visible but cannot form positive explanation routes. Curator-approved contributions retain tier D provenance with `status: verified`; clients must label them as reviewed contributions rather than always saying tier D is pending. The conservative explanation/no-route APIs currently support sourced A/B routes and explicitly inferred C explanations; D additions remain available for graph/evidence review.
