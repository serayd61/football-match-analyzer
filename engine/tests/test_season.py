import unittest
from datetime import datetime

from season import season_start_year, season_window, coverage


class SeasonWindowTest(unittest.TestCase):
    def test_august_starts_new_season(self):
        self.assertEqual(season_start_year(datetime(2026, 8, 1)), 2026)
        self.assertEqual(season_start_year(datetime(2026, 7, 31)), 2025)
        self.assertEqual(season_start_year(datetime(2026, 10, 6)), 2026)
        self.assertEqual(season_start_year(datetime(2027, 5, 20)), 2026)

    def test_two_season_window_includes_current(self):
        # Ekim 2026: 2025/26 + 2026/27 — eski sabit (2024, 2025) bu sezonu dışarıda bırakıyordu
        self.assertEqual(season_window(datetime(2026, 10, 6)), (2025, 2026))
        self.assertEqual(season_window(datetime(2026, 6, 1)), (2024, 2025))
        self.assertEqual(season_window(datetime(2026, 10, 6), seasons=3), (2024, 2026))


class CoverageTest(unittest.TestCase):
    def test_legacy_rule_without_live_list(self):
        unmatched, dropped, pct, n = coverage({"Arsenal": "Arsenal FC"}, ["Arsenal", "Ipswich"], None)
        self.assertEqual(unmatched, ["Ipswich"])
        self.assertEqual(dropped, [])
        self.assertEqual(pct, 50.0)

    def test_live_list_ignores_relegated_but_flags_missing_current(self):
        mapping = {"Arsenal": "Arsenal FC", "Ipswich": "Ipswich Town FC"}
        fd_teams = ["Arsenal", "Ipswich", "Oldham"]          # Oldham: eşlenmedi, küme düşmüş
        current = ["Arsenal FC", "Wrexham AFC"]              # Wrexham: bu sezon var, eşlenmedi
        unmatched, dropped, pct, n = coverage(mapping, fd_teams, current)
        self.assertEqual(unmatched, ["Wrexham AFC"])
        self.assertEqual(dropped, ["Oldham"])
        self.assertEqual(pct, 50.0)

    def test_live_list_full_coverage(self):
        mapping = {"Arsenal": "Arsenal FC", "Chelsea": "Chelsea FC", "Ipswich": "Ipswich Town FC"}
        unmatched, dropped, pct, n = coverage(mapping, list(mapping), ["Arsenal FC", "Chelsea FC"])
        self.assertEqual(unmatched, [])
        self.assertEqual(pct, 100.0)
        self.assertEqual(n, 3)


if __name__ == "__main__":
    unittest.main()
