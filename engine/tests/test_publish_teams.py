import json
import os
import tempfile
import unittest

os.environ.setdefault("XG_REF", "2026-10-06")
import publish_xg as PX


class _Resp:
    def __init__(self, payload): self.payload = payload
    def __enter__(self): return self
    def __exit__(self, *a): return False
    def read(self): return json.dumps(self.payload).encode()


class FetchTeamsTest(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.NamedTemporaryFile(suffix=".json", delete=False); self.tmp.close()
        os.environ["FOOTBALL_DATA_API_KEY"] = "x"

    def tearDown(self):
        os.unlink(self.tmp.name)

    def test_live_list_is_cached(self):
        opener = lambda req, timeout: _Resp({"teams": [{"name": "B FC"}, {"name": "A FC"}]})
        names = PX.fetch_current_teams("PL", opener=opener, cache_path=self.tmp.name, sleep=lambda s: None)
        self.assertEqual(names, ["A FC", "B FC"])
        self.assertEqual(json.load(open(self.tmp.name))["PL"]["teams"], ["A FC", "B FC"])

    def test_failure_falls_back_to_cache(self):
        json.dump({"PL": {"teams": ["Old FC"], "fetched_at": "2026-09-29T00:00:00"}}, open(self.tmp.name, "w"))
        def boom(req, timeout): raise OSError("network down")
        names = PX.fetch_current_teams("PL", opener=boom, cache_path=self.tmp.name, sleep=lambda s: None)
        self.assertEqual(names, ["Old FC"])

    def test_failure_without_cache_returns_none(self):
        def boom(req, timeout): raise OSError("network down")
        self.assertIsNone(PX.fetch_current_teams("PL", opener=boom, cache_path=self.tmp.name, sleep=lambda s: None))

    def test_no_key_uses_cache_only(self):
        del os.environ["FOOTBALL_DATA_API_KEY"]
        self.assertIsNone(PX.fetch_current_teams("PL", cache_path=self.tmp.name, sleep=lambda s: None))


if __name__ == "__main__":
    unittest.main()
