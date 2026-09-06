"""Depo tarih ayrıştırma — 2026-09-06 Hetzner bulgusu: milisaniyeli ISO tarih parse edilemiyordu."""
import os
import sys
import unittest
from datetime import datetime

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from store import _parse_dt


class ParseDt(unittest.TestCase):
    def test_iso_with_milliseconds_z(self):
        self.assertEqual(_parse_dt("2026-05-31T19:30:00.000Z"), datetime(2026, 5, 31, 19, 30, 0))

    def test_iso_without_fraction(self):
        self.assertEqual(_parse_dt("2026-05-31T19:30:00Z"), datetime(2026, 5, 31, 19, 30, 0))
        self.assertEqual(_parse_dt("2026-05-31T19:30"), datetime(2026, 5, 31, 19, 30))
        self.assertEqual(_parse_dt("2026-05-31"), datetime(2026, 5, 31))

    def test_offset_and_epoch(self):
        self.assertEqual(_parse_dt("2026-05-31T19:30:00.123+02:00"), datetime(2026, 5, 31, 19, 30, 0))
        self.assertEqual(_parse_dt(1780255800000).year, 2026)

    def test_garbage(self):
        self.assertIsNone(_parse_dt(None))
        self.assertIsNone(_parse_dt("yarın"))
        self.assertIsNone(_parse_dt(""))


if __name__ == "__main__":
    unittest.main()
