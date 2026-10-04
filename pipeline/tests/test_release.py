"""Offline acceptance checks for the real P1 release and other roles' inputs."""
import json
import os
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "pipeline"))
from build_graph import build
from coverage_report import coverage_report
from validate_graph import validate_graph, validate_provenance


class ReleaseTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.graph, cls.provenance = build(ROOT / "data/curation")
        cls.nodes = {n["id"]: n for n in cls.graph["nodes"]}
        cls.edges = {e["id"]: e for e in cls.graph["edges"]}
        cls.demo = json.loads((ROOT / "data/curation/demo_spec.json").read_text(encoding="utf-8"))

    def test_release_matches_committed_consumer_data(self):
        self.assertEqual(self.graph, json.loads((ROOT / "data/seed/graph.json").read_text(encoding="utf-8")))
        self.assertEqual(validate_graph(self.graph), [])
        self.assertEqual(validate_provenance(self.graph, self.provenance, ROOT / "data"), [])
        self.assertTrue(40 <= len(self.graph["nodes"]) <= 60)

    def test_all_demo_paths_have_connected_verified_support(self):
        for name in ("primary_journey", "network_overlap"):
            path = [self.edges[id_] for id_ in self.demo[name]["ordered_path_edge_ids"]]
            for edge in path:
                self.assertEqual((edge["status"], edge["stance"]), ("verified", "supports"))
                self.assertTrue(any(ev["edge_id"] == edge["id"] for ev in self.graph["evidence"]))
            for a, b in zip(path, path[1:]):
                self.assertTrue({a["src"], a["dst"]} & {b["src"], b["dst"]})

    def test_same_gene_different_function_remains_visible(self):
        spec = self.demo["same_gene_different_mechanism"]
        memberships = {n["cluster_id"] for n in self.graph["node_cluster"] if n["node_id"] == spec["gene_id"]}
        self.assertTrue(set(spec["expected_cluster_ids"]) <= memberships)
        self.assertNotEqual(self.edges[spec["gain_edge_id"]]["dst"], self.edges[spec["loss_edge_id"]]["dst"])
        self.assertEqual(self.edges[spec["contradicting_edge_id"]]["stance"], "contradicts")
        self.assertEqual(self.nodes[spec["gain_variant_id"]]["ext_ids"]["ClinVarVariation"], "196039")
        self.assertIn("Xenopus", self.nodes[spec["loss_variant_id"]]["props"]["functional_scope"])

    def test_clinvar_identity_coverage_does_not_invent_functional_edges(self):
        variants = [n for n in self.graph["nodes"] if n["type"] == "variant"]
        self.assertEqual({n["props"]["gene_symbol"] for n in variants}, {"STXBP1", "SCN2A", "KCNQ2", "SCN8A"})
        for variant in variants:
            self.assertEqual(self.nodes[variant["props"]["gene_id"]]["type"], "gene")
            if variant["props"]["gene_symbol"] != "SCN2A":
                self.assertEqual(variant["props"]["effect"], "unknown")
                self.assertNotIn("effect_evidence_edge_ids", variant["props"])
                self.assertFalse(any(e["src"] == variant["id"] and e["type"] == "gene_variant_mechanism"
                                     for e in self.graph["edges"]))

    def test_independent_hpo_annotations_share_edges_without_losing_evidence(self):
        ontology = json.loads((ROOT / "data/curation/ontology_slice.json").read_text(encoding="utf-8"))
        relations = ontology["disease_phenotypes"]
        keys = {(r["src"], r["dst"], r["stance"]) for r in relations}
        graph_edges = [e for e in self.graph["edges"] if e["type"] == "disease_phenotype"]
        self.assertEqual(len(graph_edges), len(keys))
        ids = {e["id"] for e in graph_edges}
        self.assertEqual(sum(ev["edge_id"] in ids for ev in self.graph["evidence"]), len(relations))
        self.assertGreater(len(relations), len(keys))

    def test_trial_statuses_and_person_identity_are_not_promoted(self):
        self.assertEqual(self.nodes["study_nct06983158"]["props"]["status"], "TERMINATED")
        self.assertEqual(self.nodes["study_nct05157737"]["props"]["status"], "UNKNOWN")
        for node in self.graph["nodes"]:
            if node["type"] == "person":
                self.assertNotIn("organization", node["props"])
                self.assertNotIn("email", node["props"])
                self.assertNotIn("phone", node["props"])

    def test_no_route_is_slice_bounded_and_excludes_contradictions(self):
        report = coverage_report(self.demo["no_route"]["query"], self.graph)
        self.assertEqual(report["status"], "no_supported_route")
        self.assertIn("coverage gap", " ".join(report["limitations"]))
        known = coverage_report("SCN2A-related disorder", self.graph)
        self.assertEqual(known["status"], "matches_with_supported_connections")
        self.assertNotIn("scn2a_single_gof_assignment_refuted", known["supported_edge_ids"])
        self.assertEqual(coverage_report("", self.graph)["status"], "no_supported_route")

    def test_rebuild_bytes_do_not_depend_on_python_hash_seed(self):
        outputs = []
        with tempfile.TemporaryDirectory() as tmp:
            for seed in ("1", "2"):
                output = Path(tmp) / seed
                subprocess.run([sys.executable, str(ROOT / "pipeline/build_graph.py"), "--output-dir", str(output)],
                               cwd=ROOT, env={**os.environ, "PYTHONHASHSEED": seed}, check=True, capture_output=True)
                outputs.append({p.name: p.read_bytes() for p in output.glob("*.json")})
        self.assertEqual(outputs[0], outputs[1])


if __name__ == "__main__":
    unittest.main()
