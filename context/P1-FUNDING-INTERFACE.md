# P1 administrative funding overlap interface

Recorded: **2026-10-04 (Europe/Berlin)**. This is a deterministic, source-checked P1 report derived from existing rows. It does not add graph nodes, relations, enum values, SQL tables or fields to `graph.json`.

The technical basis is [the published P1 contract's funding policy](https://github.com/NavneetKishanS/path-net/blob/3b38ca0d40b33042f7a61c7bc04c5f632bd9cdcd/contract/README.md#p4-platform-additions-2026-10-04), at observed `p1/data` head `3b38ca0d40b33042f7a61c7bc04c5f632bd9cdcd`: funding remains in award-asset `props.funder`, fiscal-year/project metadata and existing `asset_disease` relationships. The isolated checkout's older contract guide is not the policy authority for this report. This document records compatibility with the published policy; it does not claim a new human P4 sign-off. A new funding API or P3 screen remains separate consumer work.

## Produce and inspect

From the repository root, with the pipeline requirements installed:

```powershell
python pipeline/build_funding_projection.py
python -m unittest discover -s pipeline/tests -p 'test_funding_projection.py' -v
```

The CLI uses the existing `common.DATA_DIR` default and accepts `--data-dir /path/to/data`. It reads that directory's complete `seed/graph.json` and `seed/provenance.json`, reviewed curation inputs and the referenced original NIH records. It writes only `seed/funding_overlap.json`, as UTF-8 with deterministic LF line endings. The Python entry point is `build_funding_projection(data_dir) -> dict`; it performs no writes. Neither interface needs a database, network connection, model or credentials.

The original graph, provenance, coverage, demo paths, raw caches and curation stay unchanged. The sidecar is outside P2's six-field PubMed inputs and P3/P4's five-table `loadGraph()` interface. It is not passed to `explain-path` as an edge or route.

## Consumer shape

The top-level fields are `schema_version`, `kind`, `graph_sha256`, `graph_file_sha256`, `provenance_sha256`, `provenance_file_sha256`, `summary`, `count_units`, `groups` and `limitations`. `kind` is **`administrative_funding_overlap`**. These are report fields, not additions to the graph contract.

Each group identifies the source provider, agency code, funding institute code/name/abbreviation and recorded funding fiscal year. It lists `members`, distinct `application_ids` and `core_project_numbers`, and their separate counts. Each member carries:

- Existing `asset_id`, `disease_id`, supporting `edge_ids` and `evidence_ids`, with the original edge scope notes.
- The annual `application_id`, `core_project_num` and application's fiscal year.
- The recorded source URL/retrieval date and `funding_source`: original raw path/hash, canonical raw/source-record hashes and exact `agency_ic_fundings[index]` locators.

A consumer joins those existing IDs to the graph already returned by `loadGraph()`. It should display **Recorded funding overlap — administrative association**, keep source links and scope notes available, and show the report's limitations. The current platform API has no funding endpoint; this report does not implement one.

## Current source mapping

All four selected applications have recorded FY2026 funding from **NIH / NS / NINDS — National Institute of Neurological Disorders and Stroke**. The current result is one funding group, four application/asset/disease memberships, four distinct applications and four distinct core projects.

| Application / asset | Core project | Existing disease target | Original source |
| --- | --- | --- | --- |
| `11261066` / `asset_nih_11261066` | `R01NS131319` | `dis_scn8a` | [NIH RePORTER](https://reporter.nih.gov/project-details/11261066) |
| `11317220` / `asset_nih_11317220` | `K08NS121601` | `dis_scn2a_dee` | [NIH RePORTER](https://reporter.nih.gov/project-details/11317220) |
| `11322512` / `asset_nih_11322512` | `F31NS141322` | `dis_stxbp1` | [NIH RePORTER](https://reporter.nih.gov/project-details/11322512) |
| `11381904` / `asset_nih_11381904` | `R01NS137587` | `dis_kcnq2` | [NIH RePORTER](https://reporter.nih.gov/project-details/11381904) |

Only source-cited, verified, supporting A/B `asset_disease` edges enter the report. Investigator-only awards are not automatically included. Funding is checked against the original `agency_ic_fundings` array, not the administering institute. Every selected member's reviewed source locator and raw SHA-256 must match; missing evidence, stale graph/provenance bindings, changed metadata or raw records fail before output is written.

## Counting and scientific scope

Applications are deduplicated by `appl_id`; core projects are deduplicated separately by `core_project_num`. Two applications with the same core and fiscal year can be annual records, supplements or subprojects, so core/year is not an application identifier. Repeated evidence does not multiply awards. Distinct supported disease memberships remain visible without being counted as distinct applications. No costs are summed, and this interface makes no currency-unit assumption.

The report describes a dated, selected source snapshot. It does not establish current award availability: STXBP1 application `11322512` records `is_active=true` while its project end date is 2026-05-22. Shared funding is not evidence of shared biology, treatment response, trial eligibility or approved collaboration. Source-linked conditions can be broader than the disease node's phenotype scope; retain each edge's qualification.

Canonical graph/provenance digests use the existing `validate_graph.digest` convention. Exact graph/provenance file hashes and original source hashes also remain visible. The report is deterministic for identical input bytes; its source-binding fields change when the reviewed input snapshot changes. Machine-assisted source verification is not clinical validation or M4 peer sign-off.
