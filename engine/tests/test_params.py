"""Faz 3 motor testleri — parite, büzülme, parametre zinciri (ağ yok).
Çalıştır: cd engine && python3 -m unittest tests.test_params -v
"""
import json
import os
import sys
import tempfile
import unittest
from datetime import timedelta

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import model as M
import model_xg as MX
import params as P
from tests.test_xg_live import synth_matches


class Parity(unittest.TestCase):
    """shrink_k=0, rho=-0.10 → çıktı eski sürümle birebir (kapı sağlaması)."""

    def test_default_fit_unchanged(self):
        ms = synth_matches()
        ref = ms[-1]["date"] + timedelta(days=1)
        mdl = M.fit(ms, ref)
        self.assertIn("rho", mdl)
        self.assertIn("n_eff", mdl)
        self.assertAlmostEqual(mdl["rho"], M.RHO)
        # aynı sabitlerle açık çağrı aynı A/D/H/base üretir
        mdl2 = M.fit(ms, ref, rho=-0.10, shrink_k=0.0)
        for t in mdl["teams"]:
            self.assertAlmostEqual(mdl["A"][t], mdl2["A"][t], places=12)
            self.assertAlmostEqual(mdl["D"][t], mdl2["D"][t], places=12)
        self.assertAlmostEqual(mdl["H"], mdl2["H"], places=12)
        self.assertAlmostEqual(mdl["base"], mdl2["base"], places=12)

    def test_predict_reads_rho_from_model(self):
        ms = synth_matches()
        ref = ms[-1]["date"] + timedelta(days=1)
        a = M.fit(ms, ref)
        b = M.fit(ms, ref, rho=0.0)
        h, w = sorted(a["teams"])[:2]
        pa, pb = M.predict(a, h, w), M.predict(b, h, w)
        # rho=0 → saf Poisson: beraberlik olasılığı DC(-0.10)'dan farklı olmalı
        self.assertNotAlmostEqual(pa["p_draw"], pb["p_draw"], places=4)
        # modelde rho yoksa sabit kullanılır (eski pickle/dict uyumluluğu)
        legacy = {k: v for k, v in a.items() if k != "rho"}
        pl = M.predict(legacy, h, w)
        self.assertAlmostEqual(pl["p_draw"], pa["p_draw"], places=12)

    def test_xg_fit_accepts_same_params(self):
        ms = synth_matches()
        ref = ms[-1]["date"] + timedelta(days=1)
        base = M.fit(ms, ref, rho=-0.05, shrink_k=2.0)
        xg0 = MX.fit(ms, ref, xg_weight=0.0, rho=-0.05, shrink_k=2.0)
        for t in base["teams"]:
            self.assertAlmostEqual(base["A"][t], xg0["A"][t], places=9)
        self.assertEqual(xg0["rho"], -0.05)


class Shrink(unittest.TestCase):
    def test_shrink_pulls_sparse_team_to_mean(self):
        ms = synth_matches()
        ref = ms[-1]["date"] + timedelta(days=1)
        # yeni takım: yalnız 3 maç, hepsi gol yağmuru → büzülmesiz atak uçar
        new = "999"
        for i in range(3):
            ms.append({"id": 9000 + i, "date": ref - timedelta(days=2 + i), "season": "", "home": new, "away": "100",
                       "fthg": 5, "ftag": 0, "home_xg": None, "away_xg": None})
        raw = M.fit(ms, ref, shrink_k=0.0)
        shr = M.fit(ms, ref, shrink_k=5.0)
        self.assertGreater(raw["A"][new], 1.5)
        self.assertLess(shr["A"][new], raw["A"][new])
        self.assertGreater(shr["A"][new], 1.0)
        # çok maçlı takım neredeyse değişmez
        self.assertAlmostEqual(raw["A"]["105"], shr["A"]["105"], places=1)
        self.assertLess(raw["n_eff"][new], 3.01)


class ParamsChain(unittest.TestCase):
    def setUp(self):
        P.invalidate()

    def test_defaults_when_nothing_configured(self):
        p = P.load_params(force=True, url="", path="")
        self.assertEqual(p["source"], "defaults")
        self.assertEqual(p["active"]["kind"], "goals")
        self.assertEqual(len(p["shadow"]), 1)
        eff = P.params_for_league(p["active"], 47)
        self.assertEqual(eff["half_life_days"], 180)
        self.assertAlmostEqual(eff["rho"], -0.10)

    def test_file_and_league_override(self):
        doc = {"active": {"version": "dc-1.1", "kind": "goals", "params": {"rho": -0.08, "shrink_k": 3,
                                                                          "leagues": {"47": {"half_life_days": 120}}}},
               "shadow": [{"version": "dc-2.0-xg", "params": {"kind": "xg", "xg_weight": 0.6}}, {"version": "bad"}]}
        with tempfile.NamedTemporaryFile("w", suffix=".json", delete=False) as f:
            json.dump(doc, f); path = f.name
        try:
            p = P.load_params(force=True, url="", path=path)
        finally:
            os.unlink(path)
        self.assertEqual(p["source"], "file")
        self.assertEqual(p["active"]["version"], "dc-1.1")
        self.assertEqual([s["version"] for s in p["shadow"]], ["dc-2.0-xg", "bad"])
        self.assertEqual(p["shadow"][0]["kind"], "xg")
        eff47 = P.params_for_league(p["active"], 47)
        eff87 = P.params_for_league(p["active"], 87)
        self.assertEqual(eff47["half_life_days"], 120)
        self.assertEqual(eff87["half_life_days"], 180)
        self.assertAlmostEqual(eff87["rho"], -0.08)
        self.assertEqual(eff87["shrink_k"], 3.0)
        self.assertEqual(P.params_for_league(p["shadow"][0], 47)["xg_weight"], 0.6)

    def test_bad_url_falls_back(self):
        p = P.load_params(force=True, url="http://127.0.0.1:9/nope", path="")
        self.assertEqual(p["source"], "defaults")

    def test_all_specs_dedupes(self):
        p = {"active": {"version": "a"}, "shadow": [{"version": "a"}, {"version": "b"}]}
        self.assertEqual([s["version"] for s in P.all_specs(p)], ["a", "b"])


if __name__ == "__main__":
    unittest.main()
