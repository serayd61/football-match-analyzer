"""Akış xG (store_xg_feed) — saf birim testleri (ağ yok).
Çalıştır: cd engine && python3 -m unittest tests.test_xg_feed -v
"""
import os
import sys
import json
import tempfile
import unittest

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from store_xg_feed import parse_stats
from store_xg import XgStore


SAMPLE = {"status": "success", "response": {"stats": [
    {"title": "Top stats", "key": "top_stats", "stats": [
        {"title": "Ball possession", "key": "BallPossesion", "stats": [58, 42]},
        {"title": "Expected goals (xG)", "key": "expected_goals", "stats": ["1.19", "0.29"]},
    ]},
    {"title": "Expected goals (xG)", "key": "xg", "stats": [
        {"title": "Expected goals (xG)", "stats": [None, None]},
        {"title": "xG open play", "stats": ["0.68", "0.29"]},
    ]},
]}}


class ParseTests(unittest.TestCase):
    def test_parse_reads_first_numeric_xg(self):
        self.assertEqual(parse_stats(SAMPLE), (1.19, 0.29))

    def test_parse_none_when_absent(self):
        self.assertIsNone(parse_stats({"response": {"stats": [{"title": "Shots", "stats": [{"title": "Total shots", "stats": [3, 4]}]}]}}))
        self.assertIsNone(parse_stats({"response": {"stats": [{"title": "x", "stats": [{"title": "Expected goals (xG)", "stats": [None, None]}]}]}}))
        self.assertIsNone(parse_stats(None))


class MergeTests(unittest.TestCase):
    def test_feed_overrides_understat_and_counts(self):
        with tempfile.TemporaryDirectory() as d:
            us, feed = os.path.join(d, "xg.jsonl"), os.path.join(d, "xg_feed.jsonl")
            with open(us, "w") as f:
                f.write(json.dumps({"id": 1, "home_xg": 1.0, "away_xg": 0.5}) + "\n")
                f.write(json.dumps({"id": 2, "home_xg": 0.7, "away_xg": 0.7}) + "\n")
            with open(feed, "w") as f:
                f.write(json.dumps({"id": 2, "home_xg": 1.9, "away_xg": 0.2, "source": "fotmob"}) + "\n")
                f.write(json.dumps({"id": 3, "home_xg": 0.4, "away_xg": 2.1, "source": "fotmob"}) + "\n")
            xs = XgStore(path=us, feed_path=feed)
            ms = [{"id": 1}, {"id": 2}, {"id": 3}, {"id": 4}]
            cov = xs.attach(ms)
            self.assertAlmostEqual(cov, 0.75)
            self.assertEqual((ms[1]["home_xg"], ms[1]["away_xg"]), (1.9, 0.2))  # akış baskın
            self.assertEqual(ms[3]["home_xg"], None)
            self.assertEqual(xs.counts(), {"understat": 2, "fotmob": 2, "merged": 3})

    def test_missing_feed_file_is_fine(self):
        with tempfile.TemporaryDirectory() as d:
            us = os.path.join(d, "xg.jsonl")
            with open(us, "w") as f:
                f.write(json.dumps({"id": 1, "home_xg": 1.0, "away_xg": 0.5}) + "\n")
            xs = XgStore(path=us, feed_path=os.path.join(d, "nope.jsonl"))
            self.assertEqual(xs.total(), 1)


if __name__ == "__main__":
    unittest.main()
