"""Gol seviyesi çarpanı (model.level_factor) — parite ve yön testleri (2026-09-27)."""
import os, sys, unittest, random
from datetime import datetime, timedelta

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import model as M


def synth(n_teams=18, rounds=40, start=datetime(2025, 8, 1), scale_last=1.0, last_days=60, seed=3):
    """Homojen lig: Poisson(1.4) ev, Poisson(1.1) dep; son `last_days` gündeki maçlarda gol ×scale_last."""
    rnd = random.Random(seed)
    teams = [f"T{i}" for i in range(n_teams)]
    out, day = [], 0
    for r in range(rounds):
        order = teams[:]; rnd.shuffle(order)
        for i in range(0, n_teams, 2):
            d = start + timedelta(days=day)
            lh, la = 1.4, 1.1
            out.append({"date": d, "home": order[i], "away": order[i + 1], "fthg": _pois(rnd, lh), "ftag": _pois(rnd, la)})
        day += 7
    end = out[-1]["date"]
    for m in out:
        if (end - m["date"]).days < last_days and scale_last != 1.0:
            m["fthg"] = round(m["fthg"] * scale_last + (rnd.random() < (m["fthg"] * scale_last) % 1))
            m["ftag"] = round(m["ftag"] * scale_last + (rnd.random() < (m["ftag"] * scale_last) % 1))
    return out, end + timedelta(days=1)


def _pois(rnd, lam):
    L, k, p = pow(2.718281828, -lam), 0, 1.0
    while True:
        p *= rnd.random()
        if p <= L:
            return k
        k += 1


class LevelFactor(unittest.TestCase):
    def test_parity_without_level(self):
        ms, ref = synth()
        a = M.fit(ms, ref, min_matches=50)
        b = M.fit(ms, ref, min_matches=50, level_half_life_days=None)
        self.assertEqual(a["level"], 1.0)
        self.assertEqual(M.predict(a, "T0", "T1"), M.predict(b, "T0", "T1"))

    def test_stable_league_factor_near_one(self):
        ms, ref = synth()
        mdl = M.fit(ms, ref, min_matches=50)
        f = M.level_factor(mdl, ms, ref, half_life_days=45, shrink_k=40)
        self.assertAlmostEqual(f, 1.0, delta=0.06)

    def test_recent_inflation_moves_factor_up_and_shrink_damps_it(self):
        ms, ref = synth(scale_last=1.3, last_days=60)
        mdl = M.fit(ms, ref, min_matches=50)
        f_small_k = M.level_factor(mdl, ms, ref, half_life_days=30, shrink_k=5)
        f_big_k = M.level_factor(mdl, ms, ref, half_life_days=30, shrink_k=200)
        self.assertGreater(f_small_k, 1.08)
        self.assertGreater(f_small_k, f_big_k)
        self.assertGreater(f_big_k, 1.0)
        self.assertLessEqual(f_small_k, 1.25)

    def test_predict_scales_both_lambdas(self):
        ms, ref = synth()
        mdl = M.fit(ms, ref, min_matches=50)
        p1 = M.predict(mdl, "T0", "T1", level=1.0)
        p2 = M.predict(mdl, "T0", "T1", level=1.1)
        self.assertAlmostEqual(p2["lambda_home"] / p1["lambda_home"], 1.1, places=6)
        self.assertAlmostEqual(p2["lambda_away"] / p1["lambda_away"], 1.1, places=6)
        self.assertGreater(p2["p_over25"], p1["p_over25"])
        self.assertLess(p2["p_draw"], p1["p_draw"])


if __name__ == "__main__":
    unittest.main()
