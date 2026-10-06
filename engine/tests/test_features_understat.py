import unittest

try:
    import pandas as pd
except ImportError:  # CI motor işi pandas kurmaz; soccerdata venv'inde çalışır
    pd = None

from features import understat_results


@unittest.skipIf(pd is None, "pandas yok")
class UnderstatResultsTest(unittest.TestCase):
    def test_none_and_empty_frames(self):
        self.assertIsNone(understat_results(None))
        self.assertIsNone(understat_results(pd.DataFrame()))          # sütunsuz boş (yeni sezon)
        self.assertIsNone(understat_results(pd.DataFrame({"x": [1]})))  # home_team yok

    def test_filters_to_played(self):
        df = pd.DataFrame({"home_team": ["A", "B"], "away_team": ["B", "A"], "is_result": [True, False]})
        out = understat_results(df)
        self.assertEqual(len(out), 1)
        self.assertIsNone(understat_results(df[df["is_result"] == False]))


if __name__ == "__main__":
    unittest.main()
