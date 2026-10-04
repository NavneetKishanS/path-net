"""Read-only field/context review, independent of the expansion builder."""
import hashlib
import json
import re
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path

ROOT = next(p for p in Path(__file__).resolve().parents if (p / 'contract/contract.json').is_file())
DATA = ROOT / 'data'
OUT = DATA / 'acceptance/expansion'
def read(path):
    return json.loads(path.read_text(encoding='utf-8'))
def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()

graph = read(DATA / 'seed/graph.json')
old = read(OUT / 'baseline_graph.json')
provenance = read(DATA / 'seed/provenance.json')
selected = read(DATA / 'curation/expansion_selection.json')
nodes = {n['id']: n for n in graph['nodes']}
edges = {e['id']: e for e in graph['edges']}
evs = {e['id']: e for e in graph['evidence']}
added = [e for e in graph['evidence'] if e['id'] not in {e['id'] for e in old['evidence']}]
errors = []
checks = 0
def check(ok, message):
    global checks
    checks += 1
    if not ok:
        errors.append(message)

study_notes = {
    'NCT01238250': 'Multi-gene observational registry; the conditions explicitly include STXBP1 and SCN2A. This is not a DEE-only treatment trial.',
    'NCT03934268': 'Neonatal KCNQ2 cohort; UNKNOWN must not be interpreted as recruiting.',
    'NCT04639310': 'Randomized KCNQ2-DEE treatment study; cached status TERMINATED. No inference about termination reasons or efficacy.',
    'NCT04912856': 'Extension for previous XEN496 study participants; TERMINATED, not a new enrollment opportunity.',
    'NCT04937062': 'Monogenic DEEs including STXBP1/SLC6A1; planned safety and tolerability assessment, not established efficacy.',
    'NCT05161494': 'Gait-analysis feasibility pilot including STXBP1 and tuberous sclerosis; COMPLETED.',
    'NCT05226780': 'SCN8A-DEE extension assessing safety and tolerability; TERMINATED.',
    'NCT05232630': 'Non-controlled pilot across several DEEs, explicitly including STXBP1; COMPLETED does not establish treatment efficacy.',
    'NCT05407727': 'Observational disease-burden study in early-onset SCN2A-DEE. Discovery link to the broad parent condition does not generalize eligibility to all subtypes.',
    'NCT05462054': 'Non-interventional STXBP1 natural-history study; WITHDRAWN with zero actual enrollment, not a completed cohort.',
    'NCT05818553': 'Conditions explicitly include SCN2A-DEE and SCN8A-DEE. Two discovery links do not establish shared efficacy or mechanism.',
    'NCT06314490': 'Individualized ASO study for one pediatric participant, actual enrollment=1. Detailed description specifies SCN2A GoF; ACTIVE_NOT_RECRUITING.',
    'NCT06356233': 'Observational STXBP1 phenotype/biomarker study; NOT_YET_RECRUITING is not a current enrollment opportunity.',
    'NCT06625112': 'STXBP1 natural-history, endpoint and trial-readiness project; recruitment label is the status at retrieval.',
    'NCT07019922': 'Single-arm elsunersen study in early-onset SCN2A-DEE. Parent-condition discovery link does not imply suitability for all SCN2A subtypes.',
}
studies = []
for nct in sorted({s['id'] for s in selected['studies']}):
    path = DATA / f'raw/clinicaltrials/studies/{nct}.json'
    p = read(path)['protocolSection']
    n = nodes[f'study_{nct.lower()}']
    ident, status = p['identificationModule'], p['statusModule']
    targets = [s for s in selected['studies'] if s['id'] == nct]
    conditions = p.get('conditionsModule', {}).get('conditions', [])
    check(ident['nctId'] == nct == n['ext_ids']['ClinicalTrials.gov'], f'{nct}: identity')
    check(n['props']['status'] == status['overallStatus'], f'{nct}: status')
    check(n['props']['last_update_posted'] == status.get('lastUpdatePostDateStruct', {}).get('date'), f'{nct}: update date')
    check(n['props']['status_verified_date'] == status.get('statusVerifiedDate'), f'{nct}: verification date')
    check(n['props']['conditions'] == conditions, f'{nct}: conditions')
    for target in targets:
        gene = target['gene']
        check(any(re.search(r'\b' + gene + r'\b', t, re.I) for t in [ident['briefTitle'], *conditions]), f'{nct}/{gene}: title/conditions gene')
        check(target['review_excerpt'] in p['descriptionModule']['briefSummary'], f'{nct}/{gene}: context excerpt')
        es = [e for e in graph['edges'] if (e['src'], e['dst'], e['type']) == (n['id'], target['disease'], 'study_disease')]
        check(len(es) == 1, f'{nct}/{gene}: unique discovery relation')
        if es:
            check(es[0]['tier'] == 'A' and es[0]['confidence'] is None and es[0]['stance'] == 'supports', f'{nct}/{gene}: source tier and confidence')
            evidence = [e for e in added if e['edge_id'] == es[0]['id']]
            check(len(evidence) == 1 and evidence[0]['snippet'] == ident['briefTitle'], f'{nct}/{gene}: exact registry-title snippet')
    if status['overallStatus'] in {'UNKNOWN', 'COMPLETED', 'TERMINATED', 'WITHDRAWN', 'ACTIVE_NOT_RECRUITING'}:
        check('Do not present it as an open enrollment opportunity' in n['props']['next_step'], f'{nct}: closed/unknown next step')
    studies.append({'id': nct, 'genes': [s['gene'] for s in targets], 'disease_targets': [s['disease'] for s in targets], 'study_type': p.get('designModule', {}).get('studyType'), 'snapshot_status': status['overallStatus'], 'retrieved_at': n['props']['retrieved_at'], 'last_update_posted': n['props']['last_update_posted'], 'enrollment': p.get('designModule', {}).get('enrollmentInfo'), 'raw_path': path.relative_to(DATA).as_posix(), 'raw_sha256': sha(path), 'source_url': n['props']['source_url'], 'context_review': study_notes[nct], 'result': 'source fields match; scope qualified'})

award_notes = {
    '11289342': 'SCN2A haploinsufficiency/ASD mouse CRISPRa project; preclinical rescue aims do not extend to GoF DEE.',
    '11594149': 'SCN2A deficiency and Dual-AAV; planned validation in mice and human iPSC brain organoids, not clinical treatment.',
    '11436758': 'SCN2A haploinsufficiency and sensory perception; K99/R00 mouse cortical/thalamic circuit research plan.',
    '11312585': 'KCNQ2 LoF/uORF; human iPSC neurons and ASO design, a cellular/preclinical research plan.',
    '11261040': 'SCN8A mutant mice, ASO/shRNA/CRISPR; prior results are preclinical and proposed work aims to improve them.',
    '11309107': 'SCN8A-DEE human iPSC thalamocortical organoids; model-based mechanism/intervention plan, not a patient trial.',
    '11285465': 'SCN8A R850Q/R1620L/N1768D mouse cell/circuit studies; findings must not be generalized to all variants.',
}
awards = []
for s in selected['awards']:
    appl, gene = s['id'], s['gene']
    path = DATA / f'raw/reporter/projects/{appl}.json'
    r = read(path)
    n = nodes[f'asset_nih_{appl}']
    check(str(r['appl_id']) == n['ext_ids']['NIHRePORTER'] == appl, f'{appl}: application identity')
    check(n['name'] == r['project_title'], f'{appl}: exact project title')
    check(gene.lower() in r['project_title'].lower() and s['review_excerpt'] in r['abstract_text'], f'{appl}: gene and reviewed disease context')
    check(n['props']['core_project_num'] == r['core_project_num'] and n['props']['fiscal_year'] == r['fiscal_year'], f'{appl}: core/year')
    check('not proven treatment benefit' in n['props']['plain'], f'{appl}: planned work qualifier')
    funders = [{k: f.get(k) for k in ('fy', 'code', 'name', 'abbreviation', 'total_cost')} for f in r.get('agency_ic_fundings', [])]
    check(n['props']['funder'] == funders, f'{appl}: funding fields')
    pis = []
    for pi in r['principal_investigators']:
        person = nodes[f"person_nih_{pi['profile_id']}"]
        check(person['ext_ids']['NIHProfile'] == str(pi['profile_id']), f'{appl}: PI profile identity')
        check(person['name'] == ' '.join(pi['full_name'].split()), f'{appl}: PI name')
        check(not any(k in person['props'] for k in ('email', 'phone')), f'{appl}: omit direct contacts')
        pis.append({'profile_id': str(pi['profile_id']), 'name': person['name']})
    awards.append({'application_id': appl, 'gene': gene, 'target': s['disease'], 'core_project_num': r['core_project_num'], 'fiscal_year': r['fiscal_year'], 'principal_investigators': pis, 'raw_path': path.relative_to(DATA).as_posix(), 'raw_sha256': sha(path), 'source_url': r['project_detail_url'], 'context_review': award_notes[appl], 'result': 'source fields match; preclinical/planned scope qualified'})
all_cores = [n['props']['core_project_num'] for n in graph['nodes'] if n['props'].get('kind') == 'funded_research_project']
check(len(all_cores) == len(set(all_cores)) == 11, 'Unique core-project count')

phenotypes = []
for s in selected['orphadata']:
    code = s['id']
    target = {'599373': 'dis_stxbp1', '439218': 'dis_kcnq2'}[code]
    path = DATA / f'raw/ontologies/orpha_phenotypes_{code}.json'
    p = read(path)['data']['results']
    disorder = p['Disorder']
    check(p['ValidationStatus'] == 'y', f'{code}: validated source response')
    check(str(disorder['ORPHAcode']) == nodes[target]['ext_ids']['Orphanet'], f'{code}: exact disease mapping')
    rows = disorder['HPODisorderAssociation']
    check([r['HPO']['HPOId'] for r in rows] == s['association_ids'], f'{code}: full annotation membership')
    for index, row in enumerate(rows):
        hpo, label, frequency = row['HPO']['HPOId'], row['HPO']['HPOTerm'], row['HPOFrequency']
        node_id = hpo.lower().replace(':', '_')
        check(nodes[node_id]['ext_ids']['HPO'] == hpo, f'{code}/{hpo}: exact phenotype identity')
        es = [e for e in graph['edges'] if (e['src'], e['dst'], e['type'], e['stance']) == (target, node_id, 'disease_phenotype', 'supports')]
        check(len(es) == 1, f'{code}/{hpo}: exact disease-phenotype relation')
        loc = f'data.results.Disorder.HPODisorderAssociation[{index}]'
        evidence = [e for e in added if provenance['evidence'][e['id']].get('source_record_locator') == loc and provenance['evidence'][e['id']]['source_url'].endswith('/' + code)]
        check(len(evidence) == 1, f'{code}/{hpo}: unique new source annotation')
        if evidence and es:
            e = evidence[0]
            binding = provenance['evidence'][e['id']]
            check(e['edge_id'] == es[0]['id'] and binding['source_record'] == row, f'{code}/{hpo}: raw row binding')
            check(e['snippet'] == f'{label} ({hpo}); recorded Orphadata frequency: {frequency}.', f'{code}/{hpo}: exact frequency in structured summary')
            check(binding['verification'] == 'structured_record' and e['retrieved_at'] == '2026-10-03', f'{code}/{hpo}: verification kind/date')
        phenotypes.append({'orpha_code': code, 'source_disease_name': disorder['Preferred term'], 'graph_disease_id': target, 'source_record_date': p['Date'], 'hpo_id': hpo, 'source_label': label, 'frequency_exact': frequency, 'locator': loc, 'existing_edge_retained': es[0]['id'] in {e['id'] for e in old['edges']} if es else False, 'result': 'exact source association; not individual risk'})

for e in added:
    binding = provenance['evidence'][e['id']]
    check(binding['verification'] == 'structured_record', f"{e['id']}: evidence kind")
    check(e['source_url'] == binding['source_url'] and e['retrieved_at'] == '2026-10-03', f"{e['id']}: URL/retrieval date")
    for raw in binding['raw_checks']:
        check(sha(DATA / raw['path']) == raw['sha256'], f"{e['id']}: unchanged raw bytes")
for table, original in old.items():
    key = lambda row: row['id'] if 'id' in row else (row['node_id'], row['cluster_id'])
    current = {key(row): row for row in graph[table]}
    check(all(current.get(key(row)) == row for row in original), f'{table}: preserve complete baseline')
check(all(e['confidence'] is None for e in graph['edges']), 'No invented confidence')

demo = read(DATA / 'seed/demo_paths.json')
ids = list(dict.fromkeys([*demo['primary_journey']['ordered_path_edge_ids'], *demo['primary_journey']['supporting_edge_ids'], demo['same_gene_different_mechanism']['gain_edge_id'], demo['same_gene_different_mechanism']['loss_edge_id'], demo['same_gene_different_mechanism']['contradicting_edge_id'], *demo['network_overlap']['ordered_path_edge_ids']]))
demo_rows = []
for eid in ids:
    es = [e for e in graph['evidence'] if e['edge_id'] == eid]
    check(edges[eid]['status'] == 'verified' and bool(es), f'{eid}: verified demo edge with evidence')
    for e in es:
        for raw in provenance['evidence'][e['id']]['raw_checks']:
            check(sha(DATA / raw['path']) == raw['sha256'], f'{eid}: unchanged demo source cache')
    demo_rows.append({'edge_id': eid, 'stance': edges[eid]['stance'], 'evidence_ids': [e['id'] for e in es], 'source_urls': [e['source_url'] for e in es], 'note': edges[eid]['note'], 'result': 'original edge/evidence/source binding retained'})
check(edges[demo['same_gene_different_mechanism']['contradicting_edge_id']]['stance'] == 'contradicts', 'Contradiction preserved')

report = {'kind': 'agent_assisted_source_and_context_review', 'reviewed_at': datetime.now(timezone.utc).isoformat(), 'reviewer': 'current task assistant; not an independent human P1/P2 reviewer', 'graph_file_sha256': sha(DATA / 'seed/graph.json'), 'source_fields_status': 'passed' if not errors else 'failed', 'field_checks': checks, 'errors': errors, 'reviewed_counts': {'new_nodes': 62, 'new_edges': 66, 'new_evidence': len(added), 'clinical_records': len(studies), 'clinical_disease_links': len(selected['studies']), 'nih_core_projects': len(awards), 'nih_pi_links': sum(len(a['principal_investigators']) for a in awards), 'orphadata_associations': len(phenotypes), 'original_demo_edges': len(demo_rows), 'original_demo_evidence': sum(len(e['evidence_ids']) for e in demo_rows)}, 'studies': studies, 'awards': awards, 'phenotypes': phenotypes, 'original_demo_edges': demo_rows, 'new_evidence_by_source': dict(Counter(e['source_type'] for e in added)), 'human_p1_acceptance': 'pending', 'human_p2_acceptance': 'pending', 'reciprocal_p2_artifact_review': {'status': 'pending', 'extracted_directory_exists': (DATA / 'extracted').is_dir(), 'gold_directory_exists': (DATA / 'gold').is_dir()}, 'scope': 'Review dated cached records and their graph representation; not current recruitment certification, efficacy assessment, new HPO-release validation, P2 extraction evaluation, or deployed-product acceptance.'}
(OUT / 'source-review.json').write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
print(json.dumps({k: report[k] for k in ('source_fields_status', 'field_checks', 'reviewed_counts', 'errors')}, ensure_ascii=True))
if errors:
    raise SystemExit(1)
