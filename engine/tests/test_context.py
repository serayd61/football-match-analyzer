"""Puan durumu bağlamı (context.py) — tablo, sızıntı, parite ve yön testleri (ağ yok).
Çalıştır: cd engine && python3 -m unittest tests.test_context -v
"""
import os
import sys
import unittest
from datetime import datetime, timedelta

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import context as C
import model as M


def mk(day, home, away, hg, ag, base=datetime(2026, 8, 1)):
    return {"date": base + timedelta(days=day), "home": home, "away": away, "fthg": hg, "ftag": ag}


def round_robin(teams, rounds, scorer, base=datetime(2026, 8, 1)):
    """Basit lig: her hafta herkes bir maç; scorer(home, away, week) → (hg, ag)."""
    ms = []
    n = len(teams)
    for w in range(rounds):
        order = teams[w % n:] + teams[:w % n]
        for i in range(0, n - 1, 2):
            h, a = order[i], order[i + 1]
            hg, ag = scorer(h, a, w)
            ms.append(mk(w * 7, h, a, hg, ag, base))
    return ms


class SeasonTable(unittest.TestCase):
    def test_empty_and_future_only(self):
        self.assertIsNone(C.season_table([], datetime(2026, 9, 1)))
        self.assertIsNone(C.season_table([mk(40, "A", "B", 1, 0)], datetime(2026, 9, 1)))  # 10 Eyl > ref

    def test_points_and_rank(self):
        ms = [mk(0, "A", "B", 2, 0), mk(0, "C", "D", 1, 1), mk(7, "B", "C", 0, 3), mk(7, "D", "A", 0, 0)]
        t = C.season_table(ms, datetime(2026, 8, 20))
        self.assertEqual(t["teams"]["A"]["pts"], 4)
        self.assertEqual(t["teams"]["C"]["pts"], 4)
        self.assertEqual(t["pos"]["C"], 1)  # gd +3 > A gd +2
        self.assertEqual(t["pos"]["B"], 4)
        self.assertEqual(t["n"], 4)
        self.assertEqual(t["played"], 2)

    def test_no_leakage_uses_only_prior_matches(self):
        ms = [mk(0, "A", "B", 1, 0), mk(7, "A", "B", 0, 5)]
        t = C.season_table(ms, datetime(2026, 8, 5))  # ikinci maç henüz oynanmadı
        self.assertEqual(t["teams"]["A"]["pts"], 3)
        self.assertEqual(t["teams"]["B"]["pts"], 0)

    def test_season_break_resets_table(self):
        old = [mk(d, "A", "B", 3, 0) for d in (0, 7, 14)]
        new = [mk(100, "A", "B", 0, 1)]
        t = C.season_table(old + new, datetime(2026, 11, 15))
        self.assertEqual(t["teams"]["B"]["pts"], 3)  # eski sezon sayılmaz
        self.assertEqual(t["teams"]["A"]["pts"], 0)
        # sezon arası: son maçtan 60+ gün sonra tablo yok
        self.assertIsNone(C.season_table(old, datetime(2026, 11, 15)))


class ContextFactors(unittest.TestCase):
    def setUp(self):
        teams = [f"T{i}" for i in range(12)]
        # T0 hep kazanır, T10/T11 hep kaybeder, diğerleri berabere
        def scorer(h, a, w):
            if h == "T0": return 3, 0
            if a == "T0": return 0, 3
            if h in ("T10", "T11") and a not in ("T10", "T11"): return 0, 2
            if a in ("T10", "T11") and h not in ("T10", "T11"): return 2, 0
            return 1, 1
        self.ms = round_robin(teams, 8, scorer)
        self.ref = datetime(2026, 8, 1) + timedelta(days=8 * 7 + 1)
        self.tbl = C.season_table(self.ms, self.ref)

    def test_parity_without_ctx(self):
        self.assertEqual(C.context_factors(self.tbl, "T0", "T5", None), (1.0, 1.0, []))
        self.assertEqual(C.context_factors(self.tbl, "T0", "T5", {}), (1.0, 1.0, []))
        self.assertEqual(C.context_factors(None, "T0", "T5", {"title_home": 0.1}), (1.0, 1.0, []))

    def test_title_home_boost(self):
        fh, fa, tags = C.context_factors(self.tbl, "T0", "T5", {"title_home": 0.1, "releg_both": 0.1})
        self.assertAlmostEqual(fh, 1.1); self.assertEqual(fa, 1.0); self.assertEqual(tags, ["title_home"])

    def test_relegation_both_boosts_away(self):
        fh, fa, tags = C.context_factors(self.tbl, "T10", "T11", {"title_home": 0.1, "releg_both": 0.1})
        self.assertEqual(fh, 1.0); self.assertAlmostEqual(fa, 1.1); self.assertEqual(tags, ["releg_both"])

    def test_mid_table_untouched(self):
        self.assertEqual(C.context_factors(self.tbl, "T5", "T6", {"title_home": 0.1, "releg_both": 0.1}), (1.0, 1.0, []))

    def test_too_early_in_season(self):
        early = C.season_table(self.ms, datetime(2026, 8, 1) + timedelta(days=3 * 7 + 1))  # 3 hafta
        self.assertEqual(C.context_factors(early, "T0", "T5", {"title_home": 0.1}), (1.0, 1.0, []))

    def test_factor_moves_probabilities_in_direction(self):
        base = M.markets_from_lambdas(1.5, 1.1)
        up = M.markets_from_lambdas(1.5 * 1.1, 1.1)
        self.assertGreater(up["p_home"], base["p_home"])
        self.assertGreater(up["p_over25"], base["p_over25"])


if __name__ == "__main__":
    unittest.main()
