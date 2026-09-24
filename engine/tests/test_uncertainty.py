import random
import unittest
from datetime import datetime, timedelta

import uncertainty as U
import backtest_ci as CI


class PairedDiffTest(unittest.TestCase):
    def test_identical_models_give_zero_interval(self):
        xs = [0.9, 1.1, 1.0, 0.95] * 50
        r = U.paired_diff(xs, xs, n_boot=200)
        self.assertEqual(r["delta"], 0.0)
        self.assertEqual((r["lo"], r["hi"]), (0.0, 0.0))
        self.assertEqual(U.verdict(r), "belirsiz (aralık 0'ı kapsıyor)")

    def test_clear_improvement_is_detected(self):
        rng = random.Random(1)
        base = [1.0 + rng.gauss(0, 0.3) for _ in range(800)]
        cand = [b - 0.05 + rng.gauss(0, 0.02) for b in base]
        keys = [i // 10 for i in range(800)]
        r = U.paired_diff(base, cand, keys, n_boot=500)
        self.assertLess(r["hi"], 0)
        self.assertEqual(r["clusters"], 80)
        self.assertEqual(U.verdict(r), "anlamlı iyileşme")

    def test_noise_is_not_called_significant(self):
        rng = random.Random(2)
        base = [1.0 + rng.gauss(0, 0.3) for _ in range(300)]
        cand = [b + rng.gauss(0, 0.3) for b in base]
        r = U.paired_diff(base, cand, n_boot=500)
        self.assertLess(r["lo"], 0)
        self.assertGreater(r["hi"], 0)

    def test_length_mismatch_raises(self):
        with self.assertRaises(ValueError):
            U.paired_diff([1.0], [1.0, 2.0])


class ScoresTest(unittest.TestCase):
    def test_match_scores_and_value_bet(self):
        p = {"H": 0.5, "D": 0.3, "A": 0.2}
        s = U.match_scores(p, "H", {"H": 2.5, "D": 3.0, "A": 4.0})
        self.assertAlmostEqual(s["brier"], 0.25 + 0.09 + 0.04)
        # EV: H 0.25 ✓, D -0.1, A -0.2 → tek bahis, kazanır
        self.assertEqual((s["stake"], s["profit"]), (1.0, 1.5))
        self.assertEqual(U.match_scores(p, "H", {"H": None, "D": 3, "A": 4})["stake"], 0.0)

    def test_roi_ci_none_without_bets(self):
        self.assertIsNone(U.roi_ci([0, 0], [0, 0]))


class ReportTest(unittest.TestCase):
    def test_analyse_and_render_on_synthetic_rows(self):
        rng = random.Random(3)
        d0 = datetime(2022, 8, 1)
        rows = []
        for i in range(400):
            actual = rng.choice(U.OUTCOMES)
            good = {o: (0.5 if o == actual else 0.25) for o in U.OUTCOMES}
            flat = {o: 1 / 3 for o in U.OUTCOMES}
            rows.append({"week": U.week_key(d0 + timedelta(days=i // 10 * 7)),
                         "actual": actual, "odds": {"H": 2.6, "D": 3.3, "A": 3.1},
                         "p": {"goal": flat, "xg": good, "elo": good}})
        r = CI.analyse(rows, n_boot=200)
        r["has_elo"] = True
        self.assertLess(r["xg_vs_goal"]["logloss"]["hi"], 0)
        self.assertEqual(r["elo_vs_xg"]["logloss"]["delta"], 0.0)
        md = CI.render({"E0": r}, 200)
        self.assertIn("| E0 | 400 / 40 |", md)
        self.assertIn("anlamlı iyileşme", md)


if __name__ == "__main__":
    unittest.main()
