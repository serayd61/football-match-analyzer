"""Kendi Elo'muz (elo.py) — güncelleme kuralı, sızıntı, kademe, harman paritesi ve havuz seçimi (ağ yok).
Çalıştır: cd engine && python3 -m unittest tests.test_elo -v
"""
import os
import sys
import unittest
from datetime import datetime, timedelta

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import elo as E
import model as M

BASE = datetime(2026, 8, 1)


def mk(day, home, away, hg, ag, mid=None):
    return {"id": mid, "date": BASE + timedelta(days=day), "home": home, "away": away, "fthg": hg, "ftag": ag}


def ev(tier, m):
    return (m["date"].toordinal(), tier, m)


class Update(unittest.TestCase):
    def test_margin_multiplier(self):
        self.assertEqual([E.margin_mult(g) for g in (0, 1, -1, 2, -2, 3, 5)], [1.0, 1.0, 1.0, 1.5, 1.5, 1.75, 2.0])

    def test_zero_sum_and_direction(self):
        r, played = E.walk([ev(0, mk(0, "A", "B", 2, 0))], k=10, hfa=60, init=1500, feeder_init=1350)
        self.assertAlmostEqual(r["A"] + r["B"], 3000.0)
        self.assertGreater(r["A"], 1500.0)
        # beklenen ev galibiyeti 0.585; iki farklı galibiyet ×1.5
        self.assertAlmostEqual(r["A"] - 1500.0, 10 * 1.5 * (1 - E.expected(1500, 1500, 60)), places=9)
        self.assertEqual(played["A"], 1)

    def test_home_advantage_makes_a_home_draw_cost_points(self):
        r, _ = E.walk([ev(0, mk(0, "A", "B", 1, 1))], k=10, hfa=60, init=1500, feeder_init=1350)
        self.assertLess(r["A"], 1500.0)
        self.assertGreater(r["B"], 1500.0)

    def test_same_day_matches_read_start_of_day_ratings(self):
        seen = {}
        ms = [mk(0, "A", "B", 5, 0, 1), mk(0, "C", "A", 0, 0, 2)]  # A aynı gün iki maçta (yapay)
        E.walk([ev(0, m) for m in ms], 10, 60, 1500, 1350, on_read=lambda m, t, rh, ra: seen.setdefault(m["id"], (rh, ra)))
        self.assertEqual(seen[2], (1500.0, 1500.0), "ikinci maç birincinin sonucunu görmemeli")

    def test_order_independent_of_input_order(self):
        ms = [mk(d, h, a, hg, ag) for d, h, a, hg, ag in ((0, "A", "B", 1, 0), (7, "B", "C", 2, 2), (14, "C", "A", 0, 3))]
        a, _ = E.walk([ev(0, m) for m in ms], 10, 60, 1500, 1350)
        b, _ = E.walk([ev(0, m) for m in reversed(ms)], 10, 60, 1500, 1350)
        self.assertEqual(a, b)

    def test_feeder_teams_start_lower_and_carry_their_rating_up(self):
        events = [ev(1, mk(0, "P", "Q", 3, 0)), ev(0, mk(0, "A", "B", 1, 0)), ev(0, mk(30, "A", "P", 1, 1))]
        seen = {}
        E.walk(events, 10, 60, 1500, 1350, on_read=lambda m, t, rh, ra: seen.setdefault((m["home"], m["away"]), (rh, ra)))
        self.assertEqual(seen[("P", "Q")], (1350.0, 1350.0))
        rh, ra = seen[("A", "P")]
        self.assertGreater(rh, 1500.0)
        self.assertTrue(1350.0 < ra < 1400.0, "yeni çıkan takım alt lig puanıyla gelir, 1500 ile değil")


class Blend(unittest.TestCase):
    cfg = E.settings({"lam": 0.6})

    def test_lam_zero_is_parity(self):
        self.assertEqual(E.blend_lambdas(1.7, 1.1, 0.35, 250.0, E.settings({"lam": 0})), (1.7, 1.1))

    def test_total_goals_preserved(self):
        for diff in (-400, -50, 0, 120, 600):
            h, a = E.blend_lambdas(1.7, 1.1, 0.35, diff, self.cfg)
            self.assertAlmostEqual(h + a, 2.8, places=9)
            self.assertGreater(min(h, a), 0.0)

    def test_direction_and_agreement(self):
        up, _ = E.blend_lambdas(1.4, 1.4, 0.3, 200.0, self.cfg)
        down, _ = E.blend_lambdas(1.4, 1.4, 0.3, -200.0, self.cfg)
        self.assertGreater(up, 1.4 + 0.1)
        self.assertLess(down, 1.4)
        # Elo, DC ile aynı üstünlüğü söylüyorsa hiçbir şey değişmez
        diff = (0.6 - 0.35) / self.cfg["gpe"]
        h, a = E.blend_lambdas(1.7, 1.1, 0.35, diff, self.cfg)
        self.assertAlmostEqual(h, 1.7, places=9)
        self.assertAlmostEqual(a, 1.1, places=9)

    def test_supremacy_is_capped(self):
        h, a = E.blend_lambdas(1.5, 1.2, 0.3, 5000.0, E.settings({"lam": 1}))
        self.assertAlmostEqual(h - a, 2.5, places=9)
        h, a = E.blend_lambdas(0.6, 0.5, 0.3, 5000.0, E.settings({"lam": 1}))
        self.assertGreater(a, 0.0)

    def test_markets_stay_coherent(self):
        h, a = E.blend_lambdas(1.6, 1.2, 0.3, 300.0, self.cfg)
        before = M.markets_from_lambdas(1.6, 1.2)
        after = M.markets_from_lambdas(h, a)
        self.assertGreater(after["p_home"], before["p_home"])
        self.assertAlmostEqual(after["p_home"] + after["p_draw"] + after["p_away"], 1.0, places=6)
        self.assertAlmostEqual(after["p_over25"], before["p_over25"], delta=0.03)  # toplam gol aynı

    def test_settings_fall_back_on_bad_values(self):
        s = E.settings({"k": "abc", "lam": "0.4", "unknown": 1})
        self.assertEqual(s["k"], E.DEFAULTS["k"])
        self.assertEqual(s["lam"], 0.4)
        self.assertNotIn("unknown", s)
        self.assertEqual(E.settings(None), E.DEFAULTS)

    def test_home_advantage_from_model(self):
        self.assertAlmostEqual(E.home_advantage({"base": 1.3, "H": 1.25}), 0.325)


class FakeStore:
    """store.ResultStore'un kullanılan yüzü: sezonluk id → kanonik grup, grup → maçlar."""

    def __init__(self, groups, alias=None):
        self.groups, self.alias = groups, alias or {}

    def resolve(self, lid):
        return self.alias.get(lid, lid)

    def load_for_fit(self, lid):
        return list(self.groups.get(self.resolve(lid), []))


class Pools(unittest.TestCase):
    raw = {"pools": [{"top": [47], "feeders": [48, 938218]}, {"top": ["87"], "feeders": []}]}
    resolve = staticmethod(lambda lid: {938218: 48, 999047: 47}.get(lid, lid))

    def test_top_league_matches_its_pool_and_seasonal_ids_collapse(self):
        self.assertEqual(E.pool_for(47, self.raw, self.resolve), ((47,), (48,)))
        self.assertEqual(E.pool_for(999047, self.raw, self.resolve), ((47,), (48,)), "sezonluk id kanonik gruba iner")
        self.assertEqual(E.pool_for(87, self.raw, self.resolve), ((87,), ()))

    def test_feeder_or_unknown_league_gets_no_pool(self):
        self.assertIsNone(E.pool_for(48, self.raw, self.resolve), "alt kademe hedef olarak ölçülmedi")
        self.assertIsNone(E.pool_for(53, self.raw, self.resolve))
        self.assertIsNone(E.pool_for(47, None, self.resolve))
        self.assertIsNone(E.pool_for(47, {"pools": "x"}, self.resolve))

    def test_ratings_use_only_matches_before_ref_date_and_dedupe(self):
        top = [mk(0, "A", "B", 1, 0, 1), mk(10, "B", "A", 0, 2, 2), mk(40, "A", "B", 0, 4, 3)]
        feed = [mk(5, "P", "Q", 2, 0, 4), mk(5, "P", "Q", 2, 0, 4)]  # mükerrer satır
        store = FakeStore({47: top, 48: feed})
        cfg = E.settings(None)
        rating, played = E.ratings(store, ((47,), (48,)), BASE + timedelta(days=40), cfg)
        self.assertEqual(played["A"], 2, "ref_date günündeki maç dahil değil")
        self.assertEqual(played["P"], 1, "mükerrer maç bir kez sayılır")
        self.assertGreater(rating["A"], rating["B"])
        self.assertLess(rating["Q"], 1350.0)
        later, _ = E.ratings(store, ((47,), (48,)), BASE + timedelta(days=41), cfg)
        self.assertLess(later["A"], rating["A"], "0-4 yenilgi ancak ertesi gün puana yansır")


if __name__ == "__main__":
    unittest.main()
