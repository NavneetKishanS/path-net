# P1 M2 execution and handoff

M3 follow-up: maintenance also rebuilds and audits `seed/funding_overlap.json` in a fifth step when present. The historical four-step, 463-file M2 receipts remain unchanged; the actual five-step, 464-file verification is recorded in [P1-M3-EXECUTION.md](P1-M3-EXECUTION.md).

Scope: **finite foreground cache maintenance**, approved by the user on **2026-10-04 (Europe/Berlin)**. The user explicitly waived the original nighttime/unattended execution requirement. This adaptation closes P1's cache-maintenance and handoff work; P2's intelligence layer and P4's role/security work retain their own acceptance gates.

## Execution record

**P1 M2 is complete under the approved foreground adaptation.** The actual run started at `2026-10-04T00:21:07Z` and finished at `00:21:44Z` (02:21 in Europe/Berlin). All four steps returned zero. No M2 process was left running.

| Executed step | Recorded result |
| --- | --- |
| Source replay | Pinned PubMed/research verification, ontology rebuild and community/mechanism cache replay completed offline. |
| Graph rebuild | All four staged seed JSON outputs are byte-identical to the release. |
| Contract and raw provenance | 58 nodes, 69 edges, 77 evidence rows, four clusters and 70 memberships; all evidence and ClinVar identity checks passed. |
| Cache audit | 451 raw files, 449 data files, two housekeeping files and 50,866,487 bytes; 421 references across 100 files checked, zero errors. Pinned 159 PubMed, 32 trial and 82 annual NIH records verified; 22 source quotes matched. |

All 463 raw/curation/seed files matched the initial staged copy and final candidate. A separate comparison also verified 470 data/interface files, including the contract, P2 extraction/clustering, loader and frontend API/types. Their before/after digest is `876bb59330275b8f7673bedab7ae9b67713e8ad2a01a39d7470400aed3240bbf`. The graph file remains SHA-256 `c469a8ff133dcddb4146c54de9e5a93e1891f01e752c58bd4a70cbddb02b4d8f`.

The full suite ran **108 tests: 107 passed, one skipped, zero failed**. Windows denied unprivileged creation of a physical test symlink; path/reference rejection and a real child-process network-blocking check ran. The intentional invalid-argument test prints a usage error while the suite exits successfully.

Acceptance: [actual receipt](../data/acceptance/m2/receipt.json), [cache inventory and source audit](../data/acceptance/m2/cache-audit.json), [independent verification and output hashes](../data/acceptance/m2/verification.json), [test log](../data/acceptance/m2/tests.log). The four execution logs and before/after/candidate inventories are beside these files. The isolated copy remains in ignored `.runtime/m2/run-20261004T002106Z-31b12516` for local inspection. Acceptance files are separate from raw data and consumer inputs.

No cache deletion was required: both housekeeping files are classified, and no temporary, runtime, suspected-secret-file or unsafe-link entry was found. Original source bytes and retrieval dates were preserved. The five-line [handoff](HANDOFF.md) records completion and remaining owners.

## Repeat maintenance

Run from the P1 delivery worktree, with the existing pipeline requirements installed:

```powershell
Set-Location 'D:\Hack_Nation\path-net-p1-m1'
& 'D:\Hack_Nation\path-net\.venv\Scripts\python.exe' pipeline/run_m2.py
```

The command terminates after one pass. It stages the P1 inputs and pipeline under ignored `.runtime/m2/`, without loading or copying `.env`. Child socket connections and DNS resolution are blocked. It replays the source collectors offline, rebuilds all four P1 seed outputs, checks raw provenance and audits the cache. The release stays in place for P2/P3/P4. The command prints the new retained receipt's path. No database, model or paid provider call is required. The same command now also runs from the shared repository root. JSON rewrites whose sole difference is physical CRLF/LF are restored to exact staged baseline bytes after successful steps and recorded in `format_only_restorations`; genuine content/format changes and source body/text changes still fail or require review.

Success means `status: complete`, `release_unchanged: true`, empty `candidate_changes`/`release_changes`, and zero return codes for all configured steps (four for the earlier baseline, five when the funding sidecar is present). Changed candidates stay in staging with `pending_review`; failed checks or changed candidates return a nonzero exit code. Existing stages cannot be overwritten. Explicit offline replay ignores page-cache expiry while checking hashes and original retrieval dates. Missing or damaged caches fail without network fallback.

To inspect the release without the staged rebuild:

```powershell
& 'D:\Hack_Nation\path-net\.venv\Scripts\python.exe' pipeline/audit_cache.py --data-dir data --report data/acceptance/m2-recheck.json
& 'D:\Hack_Nation\path-net\.venv\Scripts\python.exe' pipeline/validate_graph.py --check-raw
```

The report must be under the selected data directory's `acceptance/` folder. Expected counts are 451 raw files and 449 data files, with `status: passed` and an empty `errors` list. Supporting search caches may be unreferenced by the graph; they are retained, not treated as disposable orphans.

For P2, the release remains `data/raw/pubmed/<PMID>.json`, with exactly `pmid`, `title`, `abstract`, `authors`, `url` and `retrieved_at`. Search metadata and XML remain outside that directory. For P3/P4, the graph remains the same five-table object: `nodes`, `edges`, `evidence`, `clusters` and `node_cluster`. Audit files remain outside these inputs.

## Source and integration limits

### Post-integration database correspondence

The original M2 source run finished at 02:21:44 Europe/Berlin. The parallel shared database integration was accepted at 02:25:40. M2 did not execute its offline steps against that running database or rerun its updated migration/upsert, RLS or explanation-cache logic.

A separate read-only check at **02:39:45 on 2026-10-04 (Europe/Berlin)** verified the current anonymous REST graph tables against the pinned M2 seed: all 58 nodes, 69 edges, 77 evidence rows, four clusters and 70 memberships matched exactly. All 463 raw/curation/seed files in both the P1 and shared checkouts also matched the original M2 inventory, with no additions, removals or byte changes. Thus the source snapshot verified by M2 is the same snapshot loaded by the later database update. This is a post-integration correspondence check, not a retrospective database step in the original M2 run. See [database recheck receipt](../data/acceptance/m2/database-recheck.json).

At the 02:39 database check, the shared M2 tooling was incomplete. It was subsequently synchronized locally and completed a four-step shared-checkout run at 02:47:49-02:48:09 Europe/Berlin, with all 463 source/curation/seed files unchanged. Both shared and P1 directories now contain the same final tools/tests. Clean published-M1 export replay, including LF curation bytes, also passed. Current readiness tests: 112 run, 111 passed, one host-permission skip. See [M2 version-control preparation](P1-M2-PUBLICATION.md) and [shared execution receipt](../data/acceptance/m2/shared-checkout/receipt.json). That historical receipt predates publication; the completed tools and receipts are now bundled with M3 in this branch snapshot.

This run reuses the reviewed snapshot. It does not establish current upstream recruitment status, refresh provider terms or enlarge slice coverage. New acquisitions use the existing source fetchers and require review before replacing source-bound graph inputs. Unknown variant effects and the SCN2A contradiction remain intact.

M3 funder representation, M4 peer acceptance and P4's platform/cloud gates are tracked in [P1-TASK-STATUS.md](P1-TASK-STATUS.md). M0 slice agreement does not certify M4 peer review. Concurrent shared M1 Docker/README integration is a separate record; it was not rerun by this maintenance pass. M1 was published at `0e1a04d`; the completed M2 follow-up is bundled with M3 in this branch snapshot. The shared checkout remains active P4 work.
