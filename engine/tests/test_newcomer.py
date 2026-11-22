"""Yeni gelen takım önceliği (model.fit new_team_k/new_team_days) — parite ve yön testleri (ağ yok).
Çalıştır: cd engine && python3 -m unittest tests.test_newcomer -v
"""
import os, sys, unittest, random
from datetime import datetime, timedelta

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import model as M
import params as P


def synth(seed=5):
    """18 takımlı lig, 2 sezon; 2. sezonda 2 takım değişir (N1, N2 yeni). Yeni takımlar lig
    ortalaması olsa da ilk haftalarda rastgele iyi sonuç alsın diye gol beklentisi şişirilmez."""
    rnd = random.Random(seed)
    old = [f"T{i}" for i in range(18)]
    s2 = old[:16] + ["N1", "N2"]
    out = []
    day = datetime(2024, 8, 10)
    for season, teams in ((1, old), (2, s2)):
        for r in range(34):
            order = teams[:]; rnd.shuffle(order)
            for i in range(0, 18, 2):
                out.append({"date": day, "home": order[i], "away": order[i + 1],
                            "fthg": _pois(rnd, 1.45), "ftag": _pois(rnd, 1.15)})
            day += timedelta(days=7)
        day += timedelta(days=60)
    return out


def _pois(rnd, lam):
    L, k, p = pow(2.718281828, -lam), 0, 1.0
    while True:
        p *= rnd.random()
        if p <= L:
            return k
        k += 1


class Newcomer(unittest.TestCase):
    def setUp(self):
        self.ms = synth()
        # 2. sezonun 5. haftası: yeni takımların ~4 maçı var
        self.ref = datetime(2024, 8, 10) + timedelta(days=7 * 34 + 60 + 7 * 5)

    def test_newcomers_detected(self):
        train = [m for m in self.ms if m["date"] < self.ref]
        self.assertEqual(M.newcomers(train, self.ref, 300), {"N1", "N2"})
        self.assertEqual(M.newcomers(train, self.ref, 0), set())

    def test_parity_when_off(self):
        a = M.fit(self.ms, self.ref)
        b = M.fit(self.ms, self.ref, new_team_k=0.0, new_team_days=300)
        c = M.fit(self.ms, self.ref, new_team_k=8.0, new_team_days=0)
        for t in a["teams"]:
            self.assertEqual(a["A"][t], b["A"][t]); self.assertEqual(a["D"][t], b["D"][t])
            self.assertEqual(a["A"][t], c["A"][t]); self.assertEqual(a["D"][t], c["D"][t])
        self.assertEqual(b["new_teams"], {"N1", "N2"})
        self.assertEqual(c["new_teams"], set())

    def test_shrinks_only_newcomers_toward_one(self):
        a = M.fit(self.ms, self.ref)
        b = M.fit(self.ms, self.ref, new_team_k=8.0, new_team_days=300)
        for t in ("N1", "N2"):
            self.assertLess(abs(b["A"][t] - 1.0), abs(a["A"][t] - 1.0) + 1e-12)
            self.assertLess(abs(b["D"][t] - 1.0), abs(a["D"][t] - 1.0) + 1e-12)
            n = a["n_eff"][t]
            self.assertAlmostEqual(b["A"][t], (n * a["A"][t] + 8.0) / (n + 8.0), places=12)
        for t in a["teams"] - {"N1", "N2"}:
            self.assertEqual(a["A"][t], b["A"][t]); self.assertEqual(a["D"][t], b["D"][t])

    def test_params_merge(self):
        prm = P.params_for_league({"version": "dc-1.5-new", "params": {"new_team_k": "8", "new_team_days": 300}}, 48)
        self.assertEqual(prm["new_team_k"], 8.0); self.assertEqual(prm["new_team_days"], 300.0)
        d = P.params_for_league({"version": "dc-1.0", "params": {}}, 48)
        self.assertEqual(d["new_team_k"], 0); self.assertEqual(d["new_team_days"], 0)


if __name__ == "__main__":
    unittest.main()
