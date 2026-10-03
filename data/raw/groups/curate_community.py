"""One-off curator assembly; this ignored helper is not a dataset source."""
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(ROOT / "pipeline"))
from fetch_groups import PublicFetcher, quote_locator, validate_curation

path = ROOT / "data" / "curation" / "community.json"
data = json.loads(path.read_text(encoding="utf-8"))
for pmid, licence in [
    ("37578743", "Thompson et al. 2023; publisher abstract attribution retained; short quotes only"),
    ("31558572", "Mason et al. 2019, eNeuro; paper CC BY 4.0 verified on PMC6795554; attribution retained"),
]:
    if not any(s["id"] == f"pmid_{pmid}" for s in data["sources"]):
        data["sources"].append({"id": f"pmid_{pmid}", "kind": "mechanisms", "url": f"https://pubmed.ncbi.nlm.nih.gov/{pmid}/", "pmid": pmid, "licence": licence, "access_method": "pubmed_cache"})

fetcher = PublicFetcher()
snapshots = {}
for source in data["sources"]:
    if source["kind"] == "mechanisms":
        record = fetcher.import_pubmed(source)
    else:
        record = json.loads((ROOT / "data" / "raw" / "groups" / f"{source['id']}.json").read_text(encoding="utf-8"))
    snapshots[source["id"]] = record
    source["snapshot"] = record
    source["availability"] = "public_landing_page" if source["kind"] == "groups" else "public_abstract_via_documented_ncbi_api"
    if source["kind"] == "mechanisms":
        article = json.loads((ROOT / "data" / "raw" / "pubmed" / f"{source['pmid']}.json").read_text(encoding="utf-8"))
        source["title"] = article["title"]

def node(id, type, name, synonyms=None, props=None, ext_ids=None):
    return {"id": id, "type": type, "name": name, "synonyms": synonyms or [], "ext_ids": ext_ids or {}, "props": props or {}}

data["nodes"] = [
    node("group_stxbp1_foundation", "patient_group", "STXBP1 Foundation", ["STXBP1 Disorders"], {"url": "https://www.stxbp1disorders.org/", "scope": "STXBP1-related disorders", "next_step": "Use the foundation's research page to ask about study readiness and available research resources."}),
    node("group_familiescn2a", "patient_group", "FamilieSCN2A Foundation", ["Familie SCN2A", "FamilieSCN2A"], {"url": "https://www.scn2a.org/", "scope": "All SCN2A-related disorders", "next_step": "Explore the foundation's research opportunities and DRAGONFLY registry information."}),
    node("group_kcnq2_cure", "patient_group", "KCNQ2 Cure Alliance", ["KCNQ2 Cure"], {"url": "https://www.kcnq2cure.org/", "scope": "KCNQ2-related disorders", "next_step": "Contact the foundation through its public site about research participation and researcher access to its biorepository."}),
    node("asset_starr_natural_history", "asset", "STARR natural history study", ["STXBP1 Clinical Trial Ready", "STARR"], {"asset_type": "prospective_natural_history_study", "url": "https://www.stxbp1disorders.org/starr", "observational": True, "reuse_status": "Expert review required before adapting measurements across conditions", "next_step": "Review the study's measures with its team and a clinician; confirm eligibility on the current study record."}, {"ClinicalTrials.gov": "NCT06555965"}),
    node("asset_scn2a_dragonfly", "asset", "SCN2A DRAGONFLY registry", ["DRAGONFLY Study"], {"asset_type": "patient_registry", "url": "https://scn2a.iamrare.org/", "access": "Public information; registry data require the registry's access process", "reuse_status": "Framework and data-access feasibility require expert review", "next_step": "Read the registry's researcher information and contact the registry team about a research question."}),
    node("asset_kcnq2_natural_history", "asset", "KCNQ2 natural history study at Harvard/Boston Children's Hospital", ["KCNQ2 Natural History Study"], {"asset_type": "natural_history_study", "url": "https://www.kcnq2cure.org/faq/", "recruitment_status": "Not independently confirmed; foundation lists the study", "reuse_status": "Existence is sourced; current availability and adaptation need study-team review", "next_step": "Ask the foundation or study team to confirm current availability and relevant study measures."}),
    node("asset_kcnq2_biorepository", "asset", "KCNQ2 Cure Alliance / COMBINEDBrain biorepository", ["KCNQ2 Biorepository"], {"asset_type": "biorepository", "url": "https://www.kcnq2cure.org/2026/02/25/kcnq2-biorepository/", "access": "Academic and industry professionals request materials through the provider", "reuse_status": "Material suitability, consent and access must be reviewed by the provider", "next_step": "Discuss a specific KCNQ2 research question and sample requirements with the biorepository provider."}),
    node("dis_scn2a_neonatal_epilepsy", "disease", "SCN2A-related neonatal-onset epilepsy subgroup", ["SCN2A neonatal-onset epilepsy"], {"parent_disease": "dis_scn2a", "curated_subgroup": True, "subgroup_definition": "Neonatal-onset epilepsy subgroup in the 81-person cohort of PMID38651838; n=27", "ontology_note": "No dedicated MONDO identifier asserted", "functional_scope": "GoF and mixed effects predominated in this cohort; phenotype alone does not establish variant function"}),
    node("dis_scn2a_autism", "disease", "SCN2A-related autism without seizures subgroup", ["SCN2A ASD without seizures", "SCN2A autism subgroup"], {"parent_disease": "dis_scn2a", "curated_subgroup": True, "subgroup_definition": "Autism without seizures subgroup in the 81-person cohort of PMID38651838; n=12", "ontology_note": "No dedicated MONDO identifier asserted", "functional_scope": "LoF association is a cohort finding; channel function requires variant-specific evidence"}),
    node("mech_stxbp1_haploinsufficiency", "mechanism", "STXBP1 haploinsufficiency", ["Reduced MUNC18-1 dosage", "STXBP1 loss of function"], {"effect": "loss_of_function", "gene": "STXBP1", "scope": "Evidence from seven disease-causing variants and experimental mouse/cellular models; not a claim that every STXBP1 variant has this mechanism"}),
    node("mech_synaptic_release", "mechanism", "Impaired inhibitory synaptic neurotransmission", ["STXBP1 synaptic vesicle release dysfunction"], {"effect": "loss_of_function", "pathway": "Presynaptic neurotransmitter release", "scope": "Stxbp1 haploinsufficient mouse model, cortical inhibitory neurotransmission"}),
    node("mech_sodium_channel_gof", "mechanism", "Voltage-gated sodium channel gain of function", ["Sodium channel GoF", "Increased sodium channel activity"], {"effect": "gain_of_function", "scope": "A mechanistic class supported in specific SCN2A/Nav1.2 and SCN8A/Nav1.6 variants; shared class does not establish trial eligibility or interchangeability"}),
    node("mech_scn2a_loss_of_function", "mechanism", "SCN2A/Nav1.2 loss of function", ["SCN2A LoF", "Reduced Nav1.2 function"], {"effect": "loss_of_function", "gene": "SCN2A", "scope": "Variant-specific partial or total LoF; clinical phenotypes overlap and some variants have mixed effects"}),
    node("mech_kcnq2_loss_of_function", "mechanism", "KCNQ2/Kv7.2 potassium-current loss of function", ["KCNQ2 LoF", "Reduced M-current"], {"effect": "loss_of_function", "gene": "KCNQ2", "scope": "Seven de novo missense variants characterized in the PMID24318194 study; other variants require functional evidence"}),
    node("mech_kcnq2_dominant_negative", "mechanism", "KCNQ2 dominant-negative channel effect", ["KCNQ2 dominant negative"], {"effect": "dominant_negative", "gene": "KCNQ2", "scope": "Five of seven tested variants reduced heteromeric channel function in an oocyte assay"}),
]

data["edges"] = []
data["evidence"] = []
data["claims"] = []

def edge(id, src, dst, type, note, confidence=0.95, stance="supports", status="verified"):
    data["edges"].append({"id": id, "src": src, "dst": dst, "type": type, "tier": "B", "confidence": confidence, "stance": stance, "status": status, "note": note})

def evidence(edge_id, source_id, quote, qualifier, suffix=""):
    source = next(s for s in data["sources"] if s["id"] == source_id)
    record = snapshots[source_id]
    text = (ROOT / "data" / record["text_path"]).read_text(encoding="utf-8")
    eid = f"ev_{edge_id}{suffix}"
    data["evidence"].append({"id": eid, "edge_id": edge_id, "source_type": "pubmed" if source.get("pmid") else "patient_organization", "source_url": record["source_url"], "pmid": source.get("pmid"), "snippet": quote, "retrieved_at": record["retrieved_at"]})
    data["claims"].append({"evidence_id": eid, "source_id": source_id, "body_sha256": record["body_sha256"], "text_sha256": record["text_sha256"], **quote_locator(text, quote), "qualifier": qualifier})

edge("group_stxbp1_disease", "group_stxbp1_foundation", "dis_stxbp1", "group_disease", "Foundation serving STXBP1-related disorders; supported by the organization's public mission.")
evidence("group_stxbp1_disease", "stxbp1_foundation", "dedicated to raising awareness and finding a cure for STXBP1-Related Disorder", "Mission statement; not evidence of an available cure.")
edge("group_scn2a_disease", "group_familiescn2a", "dis_scn2a", "group_disease", "Foundation serving all SCN2A-related disorders, including epilepsy and autism phenotypes.")
evidence("group_scn2a_disease", "familiescn2a", "improve the lives of ALL those affected by SCN2A-Related Disorders (SRD)", "Public organizational mission.")
edge("group_kcnq2_disease", "group_kcnq2_cure", "dis_kcnq2", "group_disease", "Foundation supports KCNQ2-related disorders, including the DEE subtype in this slice.")
evidence("group_kcnq2_disease", "kcnq2_cure", "KCNQ2 Cure Alliance provides support to those whose loved ones have been diagnosed with KCNQ2-related disorders", "Public organizational support statement.")

edge("asset_starr_disease", "asset_starr_natural_history", "dis_stxbp1", "asset_disease", "STARR is observational natural-history infrastructure for STXBP1-RD; it does not test a new therapy.")
evidence("asset_starr_disease", "stxbp1_starr", "is a natural history study for STXBP1-Related Disorders", "The source describes prospective observations; any cross-disease reuse remains to be assessed.")
edge("asset_dragonfly_disease", "asset_scn2a_dragonfly", "dis_scn2a", "asset_disease", "Registry for SCN2A-related disorders; only the public landing page is cached.")
evidence("asset_dragonfly_disease", "scn2a_dragonfly", "a registry dedicated to individuals and families impacted by SCN2A-related disorders", "Registry existence and disease scope; no patient-level data accessed.")
edge("asset_kcnq2_nhs_disease", "asset_kcnq2_natural_history", "dis_kcnq2", "asset_disease", "The foundation lists a KCNQ2 natural-history study at Harvard/Boston Children's Hospital; current recruitment is not established by this edge.")
evidence("asset_kcnq2_nhs_disease", "kcnq2_faq", "a Natural History Study at Harvard/Boston", "Listed within KCNQ2 research opportunities; site status can be stale and must be checked.")
edge("asset_kcnq2_biorepository_disease", "asset_kcnq2_biorepository", "dis_kcnq2", "asset_disease", "Public KCNQ2 biological-material resource created with COMBINEDBrain; access and suitability require provider review.")
evidence("asset_kcnq2_biorepository_disease", "kcnq2_biorepository", "the KCNQ2 Cure Alliance has started to generate a collection of biological samples, called a biorepository", "Existence of KCNQ2 samples; no assertion that samples transfer to another disease or are openly available.")

edge("stxbp1_haploinsufficiency", "dis_stxbp1", "mech_stxbp1_haploinsufficiency", "disease_mechanism", "Cellular and mouse-model evidence supports haploinsufficiency for the tested STXBP1 variants; variant scope and model limitations are retained.", 0.92)
evidence("stxbp1_haploinsufficiency", "pmid_29538625", "impaired protein stability and STXBP1 haploinsufficiency explain STXBP1-encephalopathy", "Seven disease-associated variants and four mouse models; this is a mechanistic experiment, not clinical efficacy evidence.")
edge("stxbp1_synaptic_release", "dis_stxbp1", "mech_synaptic_release", "disease_mechanism", "Stxbp1 haploinsufficient mice show reduced cortical inhibitory neurotransmission; presynaptic release machinery is affected.", 0.90)
evidence("stxbp1_synaptic_release", "pmid_32073399", "Stxbp1 haploinsufficiency reduced cortical inhibitory neurotransmission", "Mouse-model finding; interneuron-specific mechanisms differ and human treatment response is not inferred.")

edge("scn2a_neonatal_gof", "dis_scn2a_neonatal_epilepsy", "mech_sodium_channel_gof", "disease_mechanism", "GoF and mixed function predominated in the neonatal-onset subgroup of an 81-person cohort; this is an association, not a deterministic phenotype-to-function rule.", 0.88)
evidence("scn2a_neonatal_gof", "pmid_38651838", "gain-of-function and mixed function variants predominated in neonatal-onset epilepsy", "27 neonatal-onset patients in an 81-person cohort; mixed-function variants are explicitly included.")
edge("scn2a_autism_lof", "dis_scn2a_autism", "mech_scn2a_loss_of_function", "disease_mechanism", "Severe/complete LoF was associated with the autism-without-seizures subgroup; LoF also occurs with later-onset epilepsy, and phenotype alone must not determine treatment.", 0.88)
evidence("scn2a_autism_lof", "pmid_38651838", "severe and complete loss of function in later-onset epilepsy and autism groups", "12 autism-without-seizures patients in an 81-person cohort; the quote also includes later-onset epilepsy, not autism exclusively.")
evidence("scn2a_autism_lof", "pmid_41642117", "Distinct SCN2A LoF phenotypes cannot be reliably linked to specific biophysical mechanisms", "Neutral scope limitation: partial/total LoF spans multiple phenotypic groups; the subgroup association is not a variant-function diagnostic rule.", "_limitation")

edge("scn2a_neonatal_gene", "dis_scn2a_neonatal_epilepsy", "gene_scn2a", "disease_gene", "This neonatal-onset phenotype subgroup is part of the genetically defined SCN2A-related cohort in PMID38651838; function is not inferred from the gene alone.")
evidence("scn2a_neonatal_gene", "pmid_38651838", "gain-of-function and mixed function variants predominated in neonatal-onset epilepsy", "The source abstract explicitly studies SCN2A-related disorders and defines the neonatal-onset subgroup; the reused excerpt is interpreted within that cohort context.")
edge("scn2a_autism_gene", "dis_scn2a_autism", "gene_scn2a", "disease_gene", "This autism-without-seizures subgroup is part of the genetically defined SCN2A-related cohort in PMID38651838; it is distinct from the neonatal-onset subgroup.")
evidence("scn2a_autism_gene", "pmid_38651838", "severe and complete loss of function in later-onset epilepsy and autism groups", "The source abstract explicitly studies SCN2A-related disorders and defines an autism-without-seizures subgroup; the reused excerpt is interpreted within that cohort context.")

edge("scn2a_single_gof_assignment_refuted", "dis_scn2a", "mech_sodium_channel_gof", "disease_mechanism", "Evidence refutes assigning a single GoF mechanism to the entire broad SCN2A-related disorder. Variant effects can be mixed or LoF; this edge records contradictory evidence, not a universal supported association.", 0.95, "contradicts", "verified")
evidence("scn2a_single_gof_assignment_refuted", "pmid_37578743", "complex patterns of gain- and loss-of-functions that are difficult to classify by a simple binary scheme", "Contradicts a universal binary/GoF interpretation; 28 disease-associated and four common variants studied under standardized conditions.")

edge("kcnq2_lof", "dis_kcnq2", "mech_kcnq2_loss_of_function", "disease_mechanism", "All seven KCNQ2 missense variants in this severe-encephalopathy study showed LoF; the edge is restricted to that tested set.", 0.92)
evidence("kcnq2_lof", "pmid_24318194", "We observed a clear loss of function for all mutations.", "Seven de novo missense variants tested in Xenopus oocytes; not an assertion about all possible KCNQ2 variants.")
edge("kcnq2_dominant_negative", "dis_kcnq2", "mech_kcnq2_dominant_negative", "disease_mechanism", "Dominant-negative effects on wild-type channel subunits occurred in five of seven tested variants; other mechanisms were needed for the remainder.", 0.92)
evidence("kcnq2_dominant_negative", "pmid_24318194", "5 of 7 mutations exhibited a drastic dominant-negative effect", "Explicit fraction from the functional study; dominant-negative effects are not universal.")

edge("scn8a_dee_gof", "dis_scn8a", "mech_sodium_channel_gof", "disease_mechanism", "Two characterized SCN8A DEE variants showed strong GoF. SCN8A LoF can also produce DEE in a minority; this edge represents the studied GoF subset.", 0.90)
evidence("scn8a_dee_gof", "pmid_34431999", "Two variants causing developmental and epileptic encephalopathy showed a strong gain-of-function", "Variant-specific result from a 392-person study; not proof of an identical SCN2A mechanism or shared trial eligibility.")

edge("scn2a_r1882q_gof", "var_clinvar_196039", "mech_sodium_channel_gof", "gene_variant_mechanism", "Human Nav1.2 R1882Q showed GoF in transfected HEK cells; variant identity is separately supported by ClinVar.", 0.95)
evidence("scn2a_r1882q_gof", "pmid_31558572", "the R1882Q mutation induced a gain-of-function phenotype", "Voltage-clamp characterization in transfected HEK cells; assay/model context retained.")
edge("scn2a_r853q_lof", "var_clinvar_194555", "mech_scn2a_loss_of_function", "gene_variant_mechanism", "Human Nav1.2 R853Q primarily showed LoF in HEK cells. In Xenopus oocytes it also produced an anomalous gating-pore current, so it is not labeled pure LoF in every model.", 0.95)
evidence("scn2a_r853q_lof", "pmid_31558572", "the R853Q mutation primarily produced loss-of-function effects", "Primary effect in the HEK model; excludes a universal pure-LoF interpretation.")
evidence("scn2a_r853q_lof", "pmid_31558572", "revealed a robust gating pore current", "Neutral caveat: Xenopus-oocyte experiment showed a gating-pore current at negative potentials; functional effects depend on the measured property and model.", "_limitation")

data["curation_notes"] = [
    "Evidence rows use only contract fields. Claims and source snapshots carry quote hashes, offsets, retrieval times, cache paths and scope qualifiers.",
    "All B snippets are exact substrings of cached visible text or original-XML abstracts after whitespace normalization. Per-source short quotations total at most 25 words.",
    "The component references disease and ClinVar nodes from ontology_slice.json. Two SCN2A phenotype subgroups have no dedicated MONDO identifier asserted.",
    "A disease_mechanism edge is a source-qualified association, not proof that every variant or every patient shares the effect. A verified contradictory edge refutes assigning one GoF mechanism to the entire broad SCN2A-related disorder.",
    "Patient organizations and research assets are verified for stated scope/existence only. Recruitment, material access, clinical eligibility and cross-disease reuse require provider/expert review.",
    "Full source pages and API responses stay under ignored data/raw. No patient records, registry accounts, private family contacts or paid Bright Data requests were accessed.",
    "Reproduce community pages with python pipeline/fetch_groups.py. Fetch the cited PMIDs with pipeline/fetch_pubmed.py first, then import original XML with python pipeline/fetch_groups.py --kind mechanisms. Verify curated quotes with --validate-curation.",
]
for item in data["edges"]:
    item["confidence"] = None
for item in data["claims"]:
    item["stance"] = "neutral" if item["evidence_id"].endswith("_limitation") else ("contradicts" if "single_gof_assignment_refuted" in item["evidence_id"] else "supports")
checked = validate_curation(data)
path.write_text(json.dumps(data, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
print(f"Curated {len(data['nodes'])} nodes, {len(data['edges'])} edges, {checked} exact quotes")
