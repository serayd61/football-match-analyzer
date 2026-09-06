"""Canlı xG entegrasyonu — saf birim testleri (ağ yok, soccerdata yok).
Çalıştır: cd engine && python3 -m unittest tests.test_xg_live -v
"""
import os
import sys
import json
import tempfile
import unittest
from datetime import datetime, timedelta

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import model as M
import model_xg as MX
from store_xg import map_teams, XgStore


def synth_matches(n=400, seed=3):
    """Deterministik sentetik lig: 10 takım, sabit güçler."""
    import random
    rnd = random.Random(seed)
    teams = [str(100 + i) for i in range(10)]
    att = {t: 0.8 + 0.05 * i for i, t in enumerate(teams)}
    out = []
    d0 = datetime(2025, 8, 1)
    for k in range(n):
        h, a = rnd.sample(teams, 2)
        lh, la = att[h] * 1.3, att[a]
        hg = sum(1 for _ in range(6) if rnd.random() < lh / 6)
        ag = sum(1 for _ in range(6) if rnd.random() < la / 6)
        out.append({"id": k, "date": d0 + timedelta(days=k // 5), "season": "", "home": h, "away": a,
                    "fthg": hg, "ftag": ag, "home_xg": lh + rnd.uniform(-0.3, 0.3), "away_xg": la + rnd.uniform(-0.3, 0.3)})
    return out


class GateSanity(unittest.TestCase):
    def test_xg_weight_zero_equals_goal_model(self):
        ms = synth_matches()
        ref = ms[-1]["date"] + timedelta(days=1)
        base = M.fit(ms, ref)
        zero = MX.fit(ms, ref, xg_weight=0.0)
        self.assertIsNotNone(base)
        for t in base["teams"]:
            self.assertAlmostEqual(base["A"][t], zero["A"][t], places=9)
            self.assertAlmostEqual(base["D"][t], zero["D"][t], places=9)
        self.assertAlmostEqual(base["H"], zero["H"], places=9)

    def test_xg_weight_changes_fit_and_predict_shape_unchanged(self):
        ms = synth_matches()
        ref = ms[-1]["date"] + timedelta(days=1)
        mx = MX.fit(ms, ref, xg_weight=0.75)
        pr = MX.predict(mx, "100", "109")
        for k in ("p_home", "p_draw", "p_away", "p_over25", "p_btts_yes", "lambda_home", "lambda_away"):
            self.assertIn(k, pr)
        self.assertAlmostEqual(pr["p_home"] + pr["p_draw"] + pr["p_away"], 1.0, places=6)

    def test_missing_xg_falls_back_to_goals_per_match(self):
        ms = synth_matches()
        for m in ms:
            m["home_xg"] = m["away_xg"] = None
        ref = ms[-1]["date"] + timedelta(days=1)
        base = M.fit(ms, ref)
        mx = MX.fit(ms, ref, xg_weight=0.75)
        self.assertAlmostEqual(base["H"], mx["H"], places=9)


class TeamMapping(unittest.TestCase):
    FOTMOB = {8456: "Manchester City", 10260: "Manchester United", 8602: "Wolverhampton Wanderers",
              10204: "Brighton & Hove Albion", 8654: "West Ham United", 8586: "Tottenham Hotspur",
              10203: "Nottingham Forest", 8650: "Liverpool", 9825: "Arsenal", 8455: "Chelsea"}

    def test_understat_names_map_to_fotmob_ids(self):
        us = ["Manchester City", "Manchester United", "Wolverhampton Wanderers", "Brighton", "West Ham",
              "Tottenham", "Nottingham Forest", "Liverpool", "Arsenal", "Chelsea"]
        mapping, unmatched = map_teams(self.FOTMOB, us)
        self.assertEqual(unmatched, [])
        self.assertEqual(mapping["Brighton"], 10204)
        self.assertEqual(mapping["West Ham"], 8654)
        self.assertEqual(mapping["Tottenham"], 8586)
        self.assertEqual(len(set(mapping.values())), 10, "bijection: her FotMob id en çok bir kez")

    def test_unknown_team_is_reported_not_guessed(self):
        mapping, unmatched = map_teams({1: "Arsenal", 2: "Chelsea"}, ["Arsenal", "Galatasaray"])
        self.assertEqual(mapping, {"Arsenal": 1})
        self.assertEqual(unmatched, ["Galatasaray"])

    def test_german_and_french_surface_forms(self):
        fm = {1: "Bayern München", 2: "Borussia Mönchengladbach", 3: "1. FC Köln", 4: "Paris Saint-Germain", 5: "Olympique Lyonnais"}
        us = ["Bayern Munich", "Borussia M.Gladbach", "FC Cologne", "Paris Saint Germain", "Lyon"]
        mapping, unmatched = map_teams(fm, us)
        self.assertEqual(unmatched, [], f"eşleşmeyen: {unmatched}")
        self.assertEqual(mapping["Lyon"], 5)
        self.assertEqual(mapping["FC Cologne"], 3)


class XgStoreAttach(unittest.TestCase):
    def test_attach_coverage_and_none_for_missing(self):
        with tempfile.TemporaryDirectory() as d:
            p = os.path.join(d, "xg.jsonl")
            with open(p, "w") as f:
                f.write(json.dumps({"id": 1, "home_xg": 1.2, "away_xg": 0.7}) + "\n")
                f.write(json.dumps({"id": 2, "home_xg": 2.0, "away_xg": 2.0}) + "\n")
            xs = XgStore(p)
            ms = [{"id": 1}, {"id": 2}, {"id": 3}, {"id": 4}]
            cov = xs.attach(ms)
            self.assertAlmostEqual(cov, 0.5)
            self.assertEqual(ms[0]["home_xg"], 1.2)
            self.assertIsNone(ms[2]["home_xg"])

    def test_missing_file_means_zero_coverage(self):
        xs = XgStore("/nonexistent/xg.jsonl")
        ms = [{"id": 1}]
        self.assertEqual(xs.attach(ms), 0.0)
        self.assertIsNone(ms[0]["home_xg"])


class ModelChoice(unittest.TestCase):
    def test_choose_model_thresholds(self):
        from store_xg import choose_model as _c
        def choose_model(matches, cov, xg_weight=0.75, min_coverage=0.95):
            return _c(matches, cov, xg_weight, min_coverage, "dc-2.0-xg", "dc-1.0")
        ms = [{"home_xg": 1.0}, {"home_xg": None}]
        self.assertEqual(choose_model(ms, 0.97)[0], "xg")
        self.assertEqual(choose_model(ms, 0.90)[0], "goals")
        self.assertEqual(choose_model([{"home_xg": None}], 1.0)[0], "goals")
        self.assertEqual(choose_model(ms, 1.0, xg_weight=0)[0], "goals")


if __name__ == "__main__":
    unittest.main()
