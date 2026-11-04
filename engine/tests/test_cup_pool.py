"""Kupa havuzu (2026-11-04): kupa maçları + katılımcıların lig maçları (düşük ağırlık), dostluk havuzu dışarıda."""
import json
import os
import sys
import tempfile
import unittest
from datetime import datetime, timedelta

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))


def rows(lid, teams, start, n, id0, step_days=3):
    out, k = [], 0
    while len(out) < n:
        for i in range(len(teams)):
            for j in range(len(teams)):
                if i == j or len(out) >= n:
                    continue
                d = start + timedelta(days=(len(out) // max(1, len(teams) // 2)) * step_days)
                out.append({"id": id0 + k, "leagueId": lid, "date": d.strftime("%Y-%m-%dT19:00:00.000Z"),
                            "homeId": teams[i], "awayId": teams[j], "fthg": 2, "ftag": 1})
                k += 1
    return out


class CupPool(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.NamedTemporaryFile("w", suffix=".jsonl", delete=False)
        cup_teams = list(range(100, 112))          # 12 kupa takımı: 6'sı lig A, 6'sı lig B
        lig_a = list(range(100, 106)) + list(range(300, 312))   # 18 takım
        lig_b = list(range(106, 112)) + list(range(400, 412))
        friendlies = list(range(100, 112)) + list(range(1000, 1080))   # 92 takım → havuz, atlanır
        data = (rows(777, cup_teams, datetime(2026, 9, 16), 48, 0, 7)
                + rows(47, lig_a, datetime(2026, 8, 1), 200, 1000)
                + rows(54, lig_b, datetime(2026, 8, 1), 200, 2000)
                + rows(915708, friendlies, datetime(2026, 7, 1), 300, 3000, 1))
        for r in data:
            self.tmp.write(json.dumps(r) + "\n")
        self.tmp.close()
        # Modül sabitini yamala (sys.modules'ı boşaltma: diğer testlerin tuttuğu store nesnesi bozulur)
        import store as S
        self._old_path, self._old_alias = S.STORE_PATH, S.LEAGUE_ALIASES
        S.STORE_PATH, S.LEAGUE_ALIASES = self.tmp.name, {}

    def tearDown(self):
        import store as S
        S.STORE_PATH, S.LEAGUE_ALIASES = self._old_path, self._old_alias
        os.unlink(self.tmp.name)

    def test_pool_composition_and_weights(self):
        import store as S
        st = S.ResultStore()
        ref = datetime(2026, 11, 5)
        cup_only = st.load_for_fit(777)
        pool = st.load_pool_for_fit(777, ref, domestic_w=0.6)
        self.assertEqual(len(cup_only), 48)
        self.assertGreater(len(pool), len(cup_only))
        lids = {m["w"] for m in pool}
        self.assertEqual(lids, {1.0, 0.6})
        # dostluk havuzu (92 takım) dışarıda
        ids = {m["id"] for m in pool}
        self.assertFalse(any(3000 <= i < 3300 for i in ids))
        # yalnız havuz takımlarının lig maçları (scope=teams): 300-311 arası iki ligdaş birbirine karşı yok
        for m in pool:
            if m["w"] == 0.6:
                self.assertTrue(int(m["home"]) < 112 or int(m["away"]) < 112)
        # scope=leagues: ligdaşların maçları da gelir
        pool_l = st.load_pool_for_fit(777, ref, domestic_w=0.6, scope="leagues")
        self.assertGreater(len(pool_l), len(pool))

    def test_fit_uses_weights_and_passes_team_gate(self):
        import store as S
        import model as M
        st = S.ResultStore()
        ref = datetime(2026, 11, 5)
        cup_only = M.fit(st.load_for_fit(777), ref, min_matches=10)
        pool = M.fit(st.load_pool_for_fit(777, ref, domestic_w=0.6), ref, min_matches=10)
        # kupa-tek: takım başına ~8 maç; havuz: lig maçları 0,6 ağırlıkla n_eff'i büyütür
        self.assertGreater(pool["n_eff"]["100"], cup_only["n_eff"]["100"])
        self.assertIn("300", pool["teams"])          # ligdaş bağlam olarak modelde
        self.assertNotIn("1000", pool["teams"])      # dostluk havuzu yok


if __name__ == "__main__":
    unittest.main()
