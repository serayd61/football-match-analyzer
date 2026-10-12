"""Pazar kalibrasyonu (model.apply_calib) — parite ve yön testleri (ağ yok).
Çalıştır: cd engine && python3 -m unittest tests.test_calib -v
"""
import math
import os
import sys
import unittest

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import model as M
import params as P


def logit(p):
    return math.log(p / (1 - p))


class ApplyCalib(unittest.TestCase):
    def setUp(self):
        self.pr = {"p_home": 0.5, "p_draw": 0.25, "p_away": 0.25, "p_over25": 0.80, "p_btts_yes": 0.30,
                   "lambda_home": 1.8, "lambda_away": 1.2}

    def test_no_calib_is_parity(self):
        for c in (None, {}, {"ou25": None}, {"ou25": [1.0]}, {"btts": ["x", "y"]}):
            self.assertEqual(M.apply_calib(self.pr, c), self.pr)
        self.assertIsNone(M.apply_calib(None, {"ou25": [0, 1]}))

    def test_identity_coefficients(self):
        out = M.apply_calib(self.pr, {"ou25": [0.0, 1.0], "btts": [0.0, 1.0]})
        self.assertAlmostEqual(out["p_over25"], 0.80, places=9)
        self.assertAlmostEqual(out["p_btts_yes"], 0.30, places=9)

    def test_shrinks_overconfident_tails_toward_half(self):
        # b<1 logit'i daraltır: %80 → daha düşük, %30 → %50'ye yaklaşır; 1X2/λ dokunulmaz
        out = M.apply_calib(self.pr, {"ou25": [0.233, 0.440], "btts": [0.176, 0.360]})
        self.assertLess(out["p_over25"], 0.80)
        self.assertGreater(out["p_over25"], 0.5)
        self.assertGreater(out["p_btts_yes"], 0.30)
        self.assertLess(out["p_btts_yes"], 0.5 + 0.176)  # a>0 kaydırır ama 0,30'u favoriye çevirmez
        for k in ("p_home", "p_draw", "p_away", "lambda_home", "lambda_away"):
            self.assertEqual(out[k], self.pr[k])
        # formül birebir
        z = 0.233 + 0.440 * logit(0.80)
        self.assertAlmostEqual(out["p_over25"], 1 / (1 + math.exp(-z)), places=12)

    def test_calib_survives_params_merge(self):
        spec = {"version": "dc-1.2-cal", "kind": "goals",
                "params": {"calib": {"ou25": [0.2, 0.4], "btts": [0.1, 0.3]}, "shrink_k": 10}}
        prm = P.params_for_league(spec, 47)
        self.assertEqual(prm["calib"]["ou25"], [0.2, 0.4])
        self.assertEqual(prm["shrink_k"], 10.0)
        # aktif sürümde calib yok → parite
        self.assertIsNone(P.params_for_league({"version": "dc-1.0", "params": {}}, 47).get("calib"))


if __name__ == "__main__":
    unittest.main()
