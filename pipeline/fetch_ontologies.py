"""Fetch a bounded, auditable STXBP1-neighbour ontology slice.

Uses HGNC, MONDO/HPO through EBI OLS, Orphadata and NCBI ClinVar APIs.
One HPO annotation release is cached locally; only the selected disease rows
and phenotype terms enter the committed snapshot. No OMIM content is fetched.
Run: python pipeline/fetch_ontologies.py [--refresh | --offline]
"""
from __future__ import annotations

import argparse
import hashlib
import json
import re
import time
import urllib.error
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

from common import DATA_DIR, save_json

CACHE_DIR = DATA_DIR / "raw" / "ontologies"
OUTPUT = DATA_DIR / "curation" / "ontology_slice.json"
OLS = "https://www.ebi.ac.uk/ols4/api"
HPOA = "https://purl.obolibrary.org/obo/hp/hpoa/phenotype.hpoa"
GENES = ("STXBP1", "SCN2A", "KCNQ2", "SCN8A")
# These identifiers were resolved against live MONDO. Labels and cross-references
# are always read back from the records; an obsolete or mismatched ID fails closed.
DISEASES = (
    ("dis_stxbp1", "STXBP1", "MONDO:0012812"),
    ("dis_scn2a", "SCN2A", "MONDO:1060245"),
    ("dis_scn2a_dee", "SCN2A", "MONDO:0013388"),
    ("dis_kcnq2", "KCNQ2", "MONDO:0013387"),
    ("dis_scn8a", "SCN8A", "MONDO:0013801"),
)
# An explicit small clinical neighbourhood, not a prevalence ranking.
PHENOTYPES = (
    "HP:0001249", "HP:0001250", "HP:0001263", "HP:0001252",
    "HP:0000729", "HP:0001251", "HP:0001332", "HP:0001337",
    "HP:0001344", "HP:0002376", "HP:0011097", "HP:0002521",
)
CLINVAR_IDS = ("196039", "194555")
LICENSES = {
    "HGNC": {"license": "CC0", "license_url": "https://www.genenames.org/about/license/"},
    "MONDO": {"license": "CC-BY-4.0", "license_url": "https://github.com/monarch-initiative/mondo/blob/master/LICENSE"},
    "HPO": {"license": "HPO license; attribution, version and integrity requirements", "license_url": "https://github.com/obophenotype/human-phenotype-ontology/blob/master/LICENSE.md", "license_explanation_url": "https://human-phenotype-ontology.github.io/license.html"},
    "Orphadata": {"license": "CC-BY-4.0", "license_url": "https://api.orphadata.com/openapi.json"},
    "ClinVar": {"license": "Public NCBI database; cite ClinVar and original submitters", "license_url": "https://www.ncbi.nlm.nih.gov/clinvar/docs/maintenance_use/"},
}


def canonical_json(value):
    return json.dumps(value, sort_keys=True, ensure_ascii=False, separators=(",", ":"))


def digest(value):
    return hashlib.sha256(value).hexdigest()


class SourceCache:
    """Keep exact source bytes plus sidecars; never silently relabel cached dates."""

    def __init__(self, directory=CACHE_DIR, refresh=False, offline=False):
        self.directory = Path(directory)
        self.refresh = refresh
        self.offline = offline
        self.sources = {}

    def fetch(self, source_id, url, provider, suffix="json", max_bytes=5_000_000):
        path = self.directory / f"{source_id}.{suffix}"
        sidecar = self.directory / f"{source_id}.meta.json"
        if path.exists() and sidecar.exists() and not self.refresh:
            raw = path.read_bytes()
            meta = json.loads(sidecar.read_text(encoding="utf-8"))
            if meta["source_url"] != url or meta["raw_sha256"] != digest(raw):
                raise ValueError(f"Cache provenance mismatch for {source_id}")
        else:
            if self.offline:
                raise FileNotFoundError(f"Missing verified cache: {path}")
            request = urllib.request.Request(url, headers={
                "User-Agent": "PathNet-P1/1.0 (public rare-disease source slice)",
                "Accept": "application/json" if suffix == "json" else "text/plain",
            })
            for attempt in range(3):
                try:
                    with urllib.request.urlopen(request, timeout=90) as response:
                        raw = response.read(max_bytes + 1)
                        if len(raw) > max_bytes:
                            raise ValueError(f"Source exceeds {max_bytes} byte limit: {url}")
                        meta = {
                            "source_id": source_id, "provider": provider,
                            "source_url": url, "resolved_url": response.url,
                            "retrieved_at": datetime.now(timezone.utc).isoformat(),
                            "cache_path": path.relative_to(DATA_DIR).as_posix(),
                            "raw_sha256": digest(raw), "bytes": len(raw),
                            "etag": response.headers.get("ETag"),
                            "last_modified": response.headers.get("Last-Modified"),
                            **LICENSES.get(provider, {}),
                        }
                    break
                except (urllib.error.URLError, TimeoutError) as error:
                    if attempt == 2 or (isinstance(error, urllib.error.HTTPError) and error.code not in (429, 500, 502, 503, 504)):
                        raise
                    time.sleep(2 ** attempt)
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_bytes(raw)
            save_json(sidecar, meta)
            time.sleep(0.36)  # Also meets NCBI's unauthenticated three-per-second limit.
        meta.update(LICENSES.get(provider, {}))
        self.sources[source_id] = meta
        return raw.decode("utf-8-sig"), meta

    def json(self, *args, **kwargs):
        raw, meta = self.fetch(*args, **kwargs)
        return json.loads(raw), meta


def evidence(meta, snippet, locator, record=None, snippet_kind="verbatim"):
    result = {
        "source_id": meta["source_id"], "source_type": meta["provider"].lower(),
        "source_url": meta["source_url"], "retrieved_at": meta["retrieved_at"],
        "cache_path": meta["cache_path"], "raw_sha256": meta["raw_sha256"],
        "source_record_locator": locator, "snippet": snippet,
        "snippet_kind": snippet_kind,
    }
    if record is not None:
        result["source_record"] = record
        result["record_sha256"] = digest(canonical_json(record).encode("utf-8"))
    return result


def active_term(payload, expected_id):
    terms = [t for t in payload.get("_embedded", {}).get("terms", []) if t.get("obo_id") == expected_id]
    if len(terms) != 1:
        raise ValueError(f"Expected one exact ontology term for {expected_id}")
    term = terms[0]
    if term.get("is_obsolete"):
        raise ValueError(f"Obsolete term {expected_id}; replacement requires explicit review: {term.get('term_replaced_by')}")
    return term


def exact_disease_ids(term):
    """Only MONDO-equivalent mappings can join annotations from another database."""
    ids = {"MONDO": term["obo_id"]}
    for xref in term.get("obo_xref") or []:
        if xref.get("description") == "MONDO:equivalentTo" and xref["database"] in ("Orphanet", "OMIM", "MEDGEN"):
            ids[xref["database"]] = xref["id"]
    return ids


def term_aliases(term):
    """Keep search/reconciliation aliases exact; retain other scopes as metadata.

    OLS `synonyms` flattens exact, related, narrow and broad relationships. Using
    that array for identity reconciliation would equate a symptom with a disease
    (for example HPO Seizure's related synonym Epilepsy).
    """
    scoped = sorted(
        { (item["name"], item["scope"]) for item in term.get("obo_synonym") or [] },
        key=lambda item: (item[1], item[0]),
    )
    exact = sorted({name for name, scope in scoped if scope == "hasExactSynonym"})
    other = [{"name": name, "scope": scope} for name, scope in scoped if scope != "hasExactSynonym"]
    # OLS omits unannotated synonym axioms from obo_synonym for some terms.
    # Keep those spellings for curator/fuzzy candidate lookup without asserting
    # an exact relationship that this response does not expose.
    known_names = {name for name, _ in scoped}
    other.extend({"name": name, "scope": "untyped_in_ols_response"}
                 for name in sorted(set(term.get("synonyms") or []) - known_names))
    return exact, other


def reconcile_gene(record, expected_symbol):
    if record.get("symbol") != expected_symbol or record.get("status") != "Approved":
        raise ValueError(f"Unapproved or mismatched HGNC record for {expected_symbol}")
    if not re.fullmatch(r"HGNC:\d+", record.get("hgnc_id", "")) or not str(record.get("entrez_id", "")).isdigit():
        raise ValueError(f"Missing HGNC/NCBI Gene identifier for {expected_symbol}")
    return {"HGNC": record["hgnc_id"], "NCBIGene": str(record["entrez_id"]), "Ensembl": record.get("ensembl_gene_id", "")}


def parse_hpoa(text, disease_lookup, selected_terms):
    """Retain explicit NOT as contradicting evidence; skip inheritance/onset rows."""
    metadata = {}
    rows = []
    lines = text.splitlines()
    header = None
    for number, line in enumerate(lines, 1):
        if line.startswith("#"):
            if ":" in line:
                key, value = line[1:].split(":", 1)
                metadata[key.strip()] = value.strip()
            continue
        if header is None:
            header = line.split("\t")
            if not {"database_id", "qualifier", "hpo_id", "aspect"}.issubset(header):
                raise ValueError("Unsupported HPOA columns")
            continue
        record = dict(zip(header, line.split("\t")))
        if record.get("database_id") not in disease_lookup or record.get("hpo_id") not in selected_terms or record.get("aspect") != "P":
            continue
        qualifier = record.get("qualifier", "").strip().upper()
        if qualifier not in ("", "NOT"):
            raise ValueError(f"Unknown HPO qualifier: {qualifier}")
        rows.append({"src": disease_lookup[record["database_id"]],
                     "dst": "hp_" + record["hpo_id"].split(":")[1],
                     "type": "disease_phenotype", "tier": "A", "confidence": 1.0,
                     "stance": "contradicts" if qualifier == "NOT" else "supports",
                     "status": "verified", "qualifier": qualifier,
                     "frequency": record.get("frequency", ""), "record": record,
                     "line_number": number, "raw_line": line})
    return rows, metadata


def normalize_clinvar(record, genes):
    matched = [g for g in record.get("genes", []) if g["symbol"] in genes]
    if len(matched) != 1 or str(matched[0]["geneid"]) != genes[matched[0]["symbol"]]["ext_ids"]["NCBIGene"]:
        raise ValueError(f"ClinVar gene identity mismatch: {record.get('uid')}")
    cls = record.get("germline_classification", {})
    return {
        "id": "var_clinvar_" + record["uid"], "type": "variant", "name": record["title"],
        "synonyms": [record.get("protein_change", "")],
        "ext_ids": {"ClinVar": record["accession_version"], "ClinVarVariation": record["uid"]},
        "props": {"gene_id": genes[matched[0]["symbol"]]["id"],
                  "gene_symbol": matched[0]["symbol"], "effect": "unknown",
                  "classification": cls.get("description", ""),
                  "review_status": cls.get("review_status", ""),
                  "last_evaluated": cls.get("last_evaluated", ""),
                  "molecular_consequences": record.get("molecular_consequence_list", []),
                  "source_url": "https://www.ncbi.nlm.nih.gov/clinvar/variation/" + record["uid"] + "/",
                  "functional_effect_note": "Clinical significance and missense consequence do not establish gain or loss of function."},
    }


def build_slice(cache):
    result = {"schema_version": 1, "genes": [], "diseases": [], "phenotypes": [],
              "variants": [], "disease_genes": [], "disease_phenotypes": [],
              "sources": [], "limitations": []}
    versions = {}
    for ontology, provider in (("mondo", "MONDO"), ("hp", "HPO")):
        data, version_meta = cache.json(f"{ontology}_version", f"{OLS}/ontologies/{ontology}", provider)
        versions[ontology] = data["config"].get("version") or data["config"].get("versionIri")
        version_meta["version"] = versions[ontology]
        version_meta["version_iri"] = data["config"].get("versionIri")
    for symbol in GENES:
        data, meta = cache.json("hgnc_" + symbol.lower(), "https://rest.genenames.org/fetch/symbol/" + symbol, "HGNC")
        docs = data["response"]["docs"]
        if len(docs) != 1:
            raise ValueError(f"Ambiguous HGNC response for {symbol}")
        doc = docs[0]
        meta["version"] = doc.get("date_modified")
        result["genes"].append({"id": "gene_" + symbol.lower(), "type": "gene", "name": symbol,
                                "synonyms": sorted(set(doc.get("alias_symbol", []) + [doc["name"]])),
                                "ext_ids": reconcile_gene(doc, symbol),
                                "props": {"description": doc["name"], "source_id": meta["source_id"], "hgnc_modified": doc.get("date_modified")}})
    genes = {node["name"]: node for node in result["genes"]}
    lookup = {}
    for node_id, symbol, mondo_id in DISEASES:
        data, meta = cache.json(mondo_id.lower().replace(":", "_"), f"{OLS}/ontologies/mondo/terms?obo_id={mondo_id}", "MONDO")
        term = active_term(data, mondo_id)
        meta["version"] = versions["mondo"]
        ext_ids = exact_disease_ids(term)
        descriptions = term.get("description", [])
        description = descriptions[0] if descriptions else ""
        aliases, scoped_aliases = term_aliases(term)
        node = {"id": node_id, "type": "disease", "name": term["label"],
                "synonyms": aliases, "ext_ids": ext_ids,
                "props": {"description": description, "gene_symbol": symbol, "source_id": meta["source_id"], "ontology_version": versions["mondo"], "ontology_synonyms": scoped_aliases}}
        result["diseases"].append(node)
        for namespace, identifier in ext_ids.items():
            if namespace in ("OMIM", "Orphanet"):
                lookup[("ORPHA" if namespace == "Orphanet" else namespace) + ":" + identifier] = node_id
        if "Orphanet" in ext_ids:
            code = ext_ids["Orphanet"]
            orphan, orphan_meta = cache.json("orpha_genes_" + code, "https://api.orphadata.com/rd-associated-genes/orphacodes/" + code, "Orphadata")
            orphan_result = orphan["data"]["results"]
            orphan_meta["version"] = orphan_result["Date"]
            assoc = [a for a in orphan_result["DisorderGeneAssociation"] if a["Gene"]["Symbol"] == symbol and a["DisorderGeneAssociationStatus"] == "Assessed" and a["DisorderGeneAssociationType"] == "Disease-causing germline mutation(s) in"]
            if len(assoc) != 1:
                raise ValueError(f"Missing assessed causal Orphadata association: {symbol}")
            association = assoc[0]
            hgnc = [x["Reference"] for x in association["Gene"]["ExternalReference"] if x["Source"] == "HGNC"]
            if hgnc != [genes[symbol]["ext_ids"]["HGNC"].split(":")[1]]:
                raise ValueError(f"Orphadata/HGNC mismatch: {symbol}")
            ev = evidence(orphan_meta, association["DisorderGeneAssociationType"],
                          f"data.results.DisorderGeneAssociation[Gene.Symbol={symbol}]", association)
            # Cache the complete Orphadata phenotype record for independent review.
            phenotype_data, pm = cache.json("orpha_phenotypes_" + code, "https://api.orphadata.com/rd-phenotypes/orphacodes/" + code, "Orphadata")
            pm["version"] = phenotype_data["data"]["results"]["Date"]
        else:
            if not re.search(r"\b" + re.escape(symbol) + r"\b", description):
                raise ValueError(f"MONDO description does not establish gene identity for {mondo_id}")
            ev = evidence(meta, description, "_embedded.terms[0].description[0]", term)
        result["disease_genes"].append({"src": node_id, "dst": genes[symbol]["id"], "type": "disease_gene",
                                        "tier": "A", "confidence": 1.0, "stance": "supports", "status": "verified",
                                        "evidence": ev})
    for hpo_id in PHENOTYPES:
        data, meta = cache.json(hpo_id.lower().replace(":", "_"), f"{OLS}/ontologies/hp/terms?obo_id={hpo_id}", "HPO")
        term = active_term(data, hpo_id)
        meta["version"] = versions["hp"]
        aliases, scoped_aliases = term_aliases(term)
        result["phenotypes"].append({"id": "hp_" + hpo_id.split(":")[1], "type": "phenotype", "name": term["label"],
                                     "synonyms": aliases, "ext_ids": {"HPO": hpo_id},
                                     "props": {"source_id": meta["source_id"], "ontology_version": versions["hp"], "ontology_synonyms": scoped_aliases}})
    hpoa, meta = cache.fetch("phenotype", HPOA, "HPO", "hpoa", max_bytes=70_000_000)
    annotations, annotation_metadata = parse_hpoa(hpoa, lookup, set(PHENOTYPES))
    meta["version"] = annotation_metadata.get("version")
    meta["hpo_version"] = annotation_metadata.get("hpo-version")
    for annotation in annotations:
        record = annotation.pop("record")
        raw_line = annotation.pop("raw_line")
        line = annotation.pop("line_number")
        annotation["evidence"] = evidence(meta, raw_line, f"line:{line}", record)
        annotation["evidence"]["pmids"] = re.findall(r"PMID:(\d+)", record.get("reference", ""))
        result["disease_phenotypes"].append(annotation)
    url = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esummary.fcgi?db=clinvar&id=" + ",".join(CLINVAR_IDS) + "&retmode=json"
    data, meta = cache.json("clinvar_scn2a", url, "ClinVar")
    meta["version"] = ", ".join(data["result"][identifier]["accession_version"] for identifier in CLINVAR_IDS)
    for identifier in CLINVAR_IDS:
        record = data["result"][identifier]
        variant = normalize_clinvar(record, genes)
        variant["provenance"] = evidence(meta, record["title"], "result." + identifier, record)
        result["variants"].append(variant)
    result["sources"] = sorted(cache.sources.values(), key=lambda source: source["source_id"])
    result["versions"] = versions
    result["attribution"] = [
        f"This service uses the Human Phenotype Ontology, ontology version {versions['hp']}, HPO annotation release {annotation_metadata.get('version')}.",
        f"Mondo Disease Ontology version {versions['mondo']}, Monarch Initiative, CC BY 4.0.",
        "Orphanet / INSERM, Orphadata disease-gene and phenotype records, CC BY 4.0; record release dates are retained.",
        "HUGO Gene Nomenclature Committee (HGNC), CC0; approved gene symbols and identifiers are retained.",
        "NCBI ClinVar; variant accession versions and original supporting submission identifiers are retained in provenance.",
    ]
    result["limitations"] = [
        "This is a deliberately selected disease/phenotype slice, not a complete disease catalogue or prevalence estimate.",
        "OMIM identifiers are retained only as exact MONDO mappings to public HPO annotations; no OMIM database content was fetched.",
        "No ontology ID is assigned to an SCN2A autism/intellectual-disability subgroup. Autosomal dominant intellectual disability 29 is SETBP1-related, not SCN2A-related.",
        "ClinVar records establish variant identity/classification only. Functional direction requires separate assay or publication evidence.",
        "Explicit HPO NOT qualifiers become contradicting evidence, not positive phenotype edges. Absence of a row is not negative evidence.",
    ]
    return result


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    modes = parser.add_mutually_exclusive_group()
    modes.add_argument("--refresh", action="store_true", help="Replace caches with current official records")
    modes.add_argument("--offline", action="store_true", help="Require and verify existing raw caches")
    parser.add_argument("--output", type=Path, default=OUTPUT)
    args = parser.parse_args()
    result = build_slice(SourceCache(refresh=args.refresh, offline=args.offline))
    save_json(args.output, result)
    print(json.dumps({"output": str(args.output), **{key: len(result[key]) for key in ("genes", "diseases", "phenotypes", "variants", "disease_genes", "disease_phenotypes", "sources")}}))


if __name__ == "__main__":
    main()
