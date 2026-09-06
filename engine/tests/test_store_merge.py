"""Sezonluk lig id birleştirme — FotMob her sezon yeni id verir (2026-09-06 bulgusu)."""
import os
import sys
import unittest
from datetime import datetime, timedelta

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from store import merge_season_ids


def season(lid, teams, start, n=60, id0=0):
    """teams listesiyle start'tan itibaren n maç (round-robin benzeri)."""
    rows, k = [], 0
    while len(rows) < n:
        for i in range(len(teams)):
            for j in range(len(teams)):
                if i == j or len(rows) >= n:
                    continue
                d = start + timedelta(days=len(rows) // 4)
                rows.append({"id": id0 + k, "leagueId": lid, "date": d.strftime("%Y-%m-%dT15:00:00.000Z"),
                             "homeId": teams[i], "awayId": teams[j], "fthg": 1, "ftag": 1})
                k += 1
    return rows


class MergeSeasons(unittest.TestCase):
    def setUp(self):
        self.t2425 = list(range(100, 118))                 # 18 takım
        self.t2526 = list(range(103, 118)) + [200, 201, 202]  # 3 düşen / 3 çıkan
        self.t2627 = list(range(106, 118)) + [200, 201, 202, 300, 301, 302]
        self.by = {
            900001: season(900001, self.t2425, datetime(2024, 8, 10), 300, 0),
            900002: season(900002, self.t2526, datetime(2025, 8, 9), 300, 1000),
            937276: season(937276, self.t2627, datetime(2026, 8, 8), 40, 2000),
            # kupa: aynı sezonda (takvim kesişir), üst lig + alt lig takımları
            555000: season(555000, self.t2526[:10] + list(range(400, 420)), datetime(2025, 9, 1), 60, 3000),
            # büyük lig: sabit id, iki sezon aynı id altında
            47: season(47, list(range(500, 520)), datetime(2024, 8, 15), 380, 4000) + season(47, list(range(500, 520)), datetime(2025, 8, 15), 380, 5000),
            # küçük örnek: eşik altı, dokunulmaz
            777: season(777, self.t2526, datetime(2025, 8, 9), 5, 6000),
        }

    def test_consecutive_seasons_merge_to_latest_id(self):
        groups, alias = merge_season_ids(self.by)
        self.assertEqual(alias[900001], 937276)
        self.assertEqual(alias[900002], 937276)
        self.assertEqual(alias[937276], 937276)
        self.assertEqual(len(groups[937276]), 640)
        self.assertNotIn(900001, groups)

    def test_cup_in_same_calendar_does_not_merge(self):
        groups, alias = merge_season_ids(self.by)
        self.assertEqual(alias[555000], 555000)
        self.assertEqual(len(groups[555000]), 60)

    def test_stable_ids_and_small_groups_untouched(self):
        groups, alias = merge_season_ids(self.by)
        self.assertEqual(alias[47], 47)
        self.assertEqual(len(groups[47]), 760)
        self.assertEqual(alias[777], 777)
        self.assertEqual(len(groups[777]), 5)

    def test_result_store_resolves_old_and_new_ids(self):
        import json, tempfile
        import store as S
        with tempfile.NamedTemporaryFile("w", suffix=".jsonl", delete=False) as f:
            for rows in self.by.values():
                for r in rows:
                    f.write(json.dumps(r) + "\n")
            path = f.name
        old = S.STORE_PATH
        S.STORE_PATH = path
        try:
            st = S.ResultStore()
            self.assertEqual(st.resolve(900001), 937276)
            self.assertEqual(len(st.load_for_fit(937276)), 640)
            self.assertEqual(len(st.load_for_fit(900002)), 640)
            self.assertEqual(st.league_count(900001), 640)
            self.assertEqual(st.total(), 300 + 300 + 40 + 60 + 760 + 5)
        finally:
            S.STORE_PATH = old
            os.unlink(path)


if __name__ == "__main__":
    unittest.main()
