"""İki katmanlı ufuk (2026-11-04): engine-sync hangi fikstürü ne zaman motora sorar."""
import importlib.util, os, unittest
from datetime import datetime, timedelta, timezone

HERE = os.path.dirname(os.path.abspath(__file__))
spec = importlib.util.spec_from_file_location("engine_sync", os.path.join(HERE, "..", "deploy", "engine-sync.py"))
es = importlib.util.module_from_spec(spec); spec.loader.exec_module(es)


class PlanTests(unittest.TestCase):
    def setUp(self):
        self.now = datetime(2026, 11, 4, 14, 0, tzinfo=timezone.utc)

    def fx(self, fid, hours_ahead):
        return {fid: {'id': fid, 'date': (self.now + timedelta(hours=hours_ahead)).strftime('%Y-%m-%dT%H:%M:%SZ')}}

    def test_new_fixture_always_requested(self):
        out, n = es.plan_fixtures({**self.fx(1, 10), **self.fx(2, 100)}, {}, self.now)
        self.assertEqual([f['id'] for f in out], [1, 2]); self.assertEqual(n['new'], 2)

    def test_far_fixture_refreshed_once_a_day(self):
        fx = self.fx(1, 100)
        out, n = es.plan_fixtures(fx, {1: self.now - timedelta(hours=5)}, self.now)
        self.assertEqual(out, []); self.assertEqual(n['fresh'], 1)            # 5 sa önce yazıldı → bekle
        out, n = es.plan_fixtures(fx, {1: self.now - timedelta(hours=21)}, self.now)
        self.assertEqual(len(out), 1); self.assertEqual(n['refresh'], 1)      # 21 sa → yenile

    def test_near_fixture_frozen_unless_last_write_was_provisional(self):
        fx = self.fx(1, 30)                                                   # maça 30 sa
        out, n = es.plan_fixtures(fx, {1: self.now - timedelta(hours=10)}, self.now)
        self.assertEqual(out, []); self.assertEqual(n['frozen'], 1)           # 40 sa kala yazılmış → kesin, dokunma
        out, n = es.plan_fixtures(fx, {1: self.now - timedelta(hours=40)}, self.now)
        self.assertEqual(len(out), 1); self.assertEqual(n['freeze'], 1)       # 70 sa kala yazılmış (ön) → son kez yaz
        # kesinleştirme sonrası (updated_at = now) tekrar istenmez
        out, n = es.plan_fixtures(fx, {1: self.now}, self.now)
        self.assertEqual(out, []); self.assertEqual(n['frozen'], 1)

    def test_boundary_exactly_48h_is_near(self):
        fx = self.fx(1, 48)                                                   # tam 48 sa → yakın sayılır
        out, n = es.plan_fixtures(fx, {1: self.now - timedelta(hours=1)}, self.now)
        self.assertEqual(n['freeze'], 1)                                      # 49 sa kala yazılmıştı (ön) → kesinleştir
        out, n = es.plan_fixtures(fx, {1: self.now}, self.now)
        self.assertEqual(n['frozen'], 1)


if __name__ == '__main__':
    unittest.main()
