"""Additive-source acceptance, frozen-baseline protection and negative checks."""
import copy
import hashlib
import json
from pathlib import Path
import sys
import unittest

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "pipeline"))
from build_graph import build
from expand_slice import build_expansion
from validate_graph import digest, validate_graph, validate_provenance


def read(relative):
    return json.loads((ROOT / "data" / relative).read_text(encoding="utf-8"))


class ExpansionTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.selection = read("curation/expansion_selection.json")
        cls.baseline = read("acceptance/expansion/baseline_graph.json")
        cls.graph, cls.provenance = build(ROOT / "data/curation")

    def test_every_original_record_and_membership_is_exactly_preserved(self):
        self.assertEqual(digest(self.baseline), self.selection["baseline_graph_sha256"])
        for table, rows in self.baseline.items():
            key = lambda r: r["id"] if "id" in r else (r["node_id"], r["cluster_id"])
            actual = {key(row): row for row in self.graph[table]}
            for row in rows:
                self.assertEqual(row, actual[key(row)], f"Changed original {table} {key(row)}")
        self.assertEqual(self.baseline["clusters"], self.graph["clusters"])

    def test_all_raw_bytes_and_pubmed_inputs_remain_unchanged(self):
        manifest = read("acceptance/expansion/baseline.json")["files"]
        for relative, record in manifest.items():
            if relative.startswith("data/raw/"):
                self.assertEqual(hashlib.sha256((ROOT / relative).read_bytes()).hexdigest(), record["sha256"])
        for path in (ROOT / "data/raw/pubmed").glob("*.json"):
            self.assertEqual(set(json.loads(path.read_text(encoding="utf-8"))),
                             {"pmid", "title", "abstract", "authors", "url", "retrieved_at"})

    def test_expansion_is_deterministic_and_source_bound(self):
        first = build_expansion(self.selection)
        self.assertEqual(first, build_expansion(self.selection))
        self.assertEqual(first, read("curation/expansion.json"))
        self.assertEqual(validate_graph(self.graph), [])
        self.assertEqual(validate_provenance(self.graph, self.provenance, ROOT / "data", check_raw=True), [])
        self.assertEqual(self.graph, read("seed/graph.json"))

    def test_multiple_sources_do_not_duplicate_semantic_edges(self):
        keys = [(e["src"], e["dst"], e["type"], e["stance"]) for e in self.graph["edges"]]
        self.assertEqual(len(keys), len(set(keys)))
        self.assertTrue(all(e["confidence"] is None for e in self.graph["edges"]))
        self.assertEqual([e for e in self.graph["edges"] if e["stance"] == "contradicts"],
                         [e for e in self.baseline["edges"] if e["stance"] == "contradicts"])

    def test_new_study_descriptions_preserve_dated_research_scope(self):
        studies = {n["id"]: n for n in self.graph["nodes"]
                   if n["type"] == "study" and n["id"] not in {n["id"] for n in self.baseline["nodes"]}}
        for study in studies.values():
            props = study["props"]
            self.assertIn(f"Retrieved {props['retrieved_at']}", props["plain"])
            self.assertIn(props["status"].replace("_", " ").lower(), props["plain"])
            self.assertIn("provisional discovery grouping", props["plain"])
        text = studies["study_nct06314490"]["props"]["plain"]
        self.assertIn("one pediatric participant", text)
        self.assertIn("not a general enrollment opportunity", text)

    def test_annual_awards_are_distinct_core_projects_and_no_private_contacts(self):
        awards = [n for n in self.graph["nodes"] if n["props"].get("kind") == "funded_research_project"]
        self.assertEqual(len(awards), len({n["props"]["core_project_num"] for n in awards}))
        original_ids = {n["id"] for n in self.baseline["nodes"]}
        for node in self.graph["nodes"]:
            if node["id"] not in original_ids and node["type"] == "person":
                self.assertFalse({"email", "phone", "contact"} & node["props"].keys())

    def test_changed_baseline_is_rejected(self):
        selected = copy.deepcopy(self.selection)
        selected["baseline_graph_sha256"] = "0" * 64
        with self.assertRaisesRegex(ValueError, "Baseline graph changed"):
            build_expansion(selected)

    def test_changed_pinned_source_is_rejected(self):
        selected = copy.deepcopy(self.selection)
        selected["raw_files"]["raw/clinicaltrials/studies/NCT01238250.json"] = "0" * 64
        with self.assertRaisesRegex(ValueError, "source changed"):
            build_expansion(selected)

    def test_unsupported_scope_and_duplicate_selections_are_rejected(self):
        selected = copy.deepcopy(self.selection)
        selected["studies"][0]["disease"] = "dis_scn2a_dee"
        with self.assertRaisesRegex(ValueError, "gene-spectrum"):
            build_expansion(selected)
        selected = copy.deepcopy(self.selection)
        selected["studies"].append(copy.deepcopy(selected["studies"][0]))
        with self.assertRaisesRegex(ValueError, "Duplicate explicit"):
            build_expansion(selected)

    def test_existing_core_project_and_changed_annotation_membership_are_rejected(self):
        selected = copy.deepcopy(self.selection)
        selected["awards"][0].update(id="11322512", gene="STXBP1", disease="dis_stxbp1")
        relative = "raw/reporter/projects/11322512.json"
        selected["raw_files"][relative] = hashlib.sha256((ROOT / "data" / relative).read_bytes()).hexdigest()
        with self.assertRaisesRegex(ValueError, "core project"):
            build_expansion(selected)
        selected = copy.deepcopy(self.selection)
        selected["orphadata"][0]["association_ids"].pop()
        with self.assertRaisesRegex(ValueError, "annotation membership changed"):
            build_expansion(selected)


if __name__ == "__main__":
    unittest.main()
