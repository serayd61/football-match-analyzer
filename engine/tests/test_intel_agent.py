"""intel_agent testleri — ağ yok, anthropic yok (geç import). Kural uygulaması, parite, skorlama.
Çalıştır: cd engine && python3 -m unittest tests.test_intel_agent -v
"""
import json
import os
import sys
import unittest
from datetime import datetime, timezone

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import intel_agent as IA  # noqa: E402
import model as M  # noqa: E402
from tests.test_xg_live import synth_matches  # noqa: E402

BASE = {"home": 0.45, "draw": 0.27, "away": 0.28, "over25": 0.52, "btts": 0.55,
        "lambdaHome": 1.55, "lambdaAway": 1.10, "modelVersion": "dc-1.0"}


def dev(shift, mult=(1.0, 1.0), severity="normal", **kw):
    d = {"factor": "Test (CF) sakat — kesin yok", "category": "key_absence", "team": "home",
         "shift": {"home": shift[0], "draw": shift[1], "away": shift[2]},
         "lambdaMult": {"home": mult[0], "away": mult[1]}, "severity": severity,
         "reason": "kulüp açıklaması", "source": "https://example.com", "asOf": "2026-10-16"}
    d.update(kw)
    return d


class ApplyDeviations(unittest.TestCase):
    def test_no_deviation_returns_baseline(self):
        r = IA.apply_deviations(BASE, [])
        self.assertEqual(r["deviations"], [])
        self.assertAlmostEqual(r["probabilities"]["home"], 0.45, places=4)
        self.assertEqual(r["lambdaMult"], {"home": 1.0, "away": 1.0})
        self.assertEqual(r["warnings"], [])

    def test_shift_within_cap_applied_and_normalized(self):
        r = IA.apply_deviations(BASE, [dev((-0.05, 0.02, 0.03), mult=(0.92, 1.0))])
        p = r["probabilities"]
        self.assertAlmostEqual(sum(p.values()), 1.0, places=4)
        self.assertAlmostEqual(p["home"], 0.40, places=3)
        self.assertAlmostEqual(p["away"], 0.31, places=3)
        self.assertEqual(r["lambdaMult"]["home"], 0.92)
        self.assertEqual(r["warnings"], [])

    def test_shift_over_cap_is_clipped(self):
        r = IA.apply_deviations(BASE, [dev((-0.20, 0.10, 0.10))])
        sh = r["deviations"][0]["shift"]
        self.assertEqual(sh["home"], -IA.SHIFT_CAP)
        self.assertTrue(any("kırpıldı" in w for w in r["warnings"]))
        # overwhelming → 0.12'ye kadar izin
        r2 = IA.apply_deviations(BASE, [dev((-0.20, 0.10, 0.10), severity="overwhelming")])
        self.assertEqual(r2["deviations"][0]["shift"]["home"], -IA.SHIFT_CAP_OVERWHELMING)

    def test_non_zero_sum_shift_is_centered(self):
        r = IA.apply_deviations(BASE, [dev((0.06, 0.06, 0.06))])
        sh = r["deviations"][0]["shift"]
        self.assertAlmostEqual(sh["home"] + sh["draw"] + sh["away"], 0.0, places=6)
        self.assertTrue(any("merkezlendi" in w for w in r["warnings"]))
        # etkisi yok → olasılık çıpada kalır
        self.assertAlmostEqual(r["probabilities"]["home"], 0.45, places=3)

    def test_bad_category_or_unnamed_factor_dropped(self):
        bad_cat = dev((-0.05, 0.02, 0.03), category="form")
        unnamed = dev((-0.05, 0.02, 0.03), factor="")
        r = IA.apply_deviations(BASE, [bad_cat, unnamed])
        self.assertEqual(r["deviations"], [])
        self.assertEqual(len(r["warnings"]), 2)
        self.assertAlmostEqual(r["probabilities"]["home"], 0.45, places=4)

    def test_max_deviations_and_total_lambda_cap(self):
        ds = [dev((-0.02, 0.01, 0.01), mult=(0.85, 1.15)) for _ in range(6)]
        r = IA.apply_deviations(BASE, ds)
        self.assertEqual(len(r["deviations"]), IA.MAX_DEVIATIONS)
        self.assertEqual(r["lambdaMult"]["home"], IA.LAMBDA_TOTAL_MIN)
        self.assertEqual(r["lambdaMult"]["away"], IA.LAMBDA_TOTAL_MAX)
        self.assertTrue(any("toplam λ" in w for w in r["warnings"]))

    def test_probability_floor_and_ceiling(self):
        base = {**BASE, "home": 0.90, "draw": 0.07, "away": 0.03}
        r = IA.apply_deviations(base, [dev((0.12, -0.06, -0.06), severity="overwhelming")])
        p = r["probabilities"]
        self.assertGreaterEqual(min(p.values()), IA.PROB_FLOOR - 1e-6)
        self.assertAlmostEqual(sum(p.values()), 1.0, places=4)


class Goals(unittest.TestCase):
    def test_markets_from_lambdas_parity_with_predict(self):
        ms = synth_matches()
        ref = ms[-1]["date"]
        mdl = M.fit(ms, ref)
        teams = list(mdl["teams"])[:2]
        pr = M.predict(mdl, teams[0], teams[1])
        mk = M.markets_from_lambdas(pr["lambda_home"], pr["lambda_away"], mdl["rho"])
        for k in ("p_home", "p_draw", "p_away", "p_over25", "p_btts_yes"):
            self.assertAlmostEqual(pr[k], mk[k], places=12)

    def test_goals_block_unadjusted_keeps_anchor(self):
        g = IA.goals_block(BASE, {"home": 1.0, "away": 1.0})
        self.assertFalse(g["adjusted"])
        self.assertEqual(g["over25"], BASE["over25"])
        self.assertEqual(g["btts"], BASE["btts"])

    def test_goals_block_adjusted_recomputes(self):
        g = IA.goals_block(BASE, {"home": 0.85, "away": 1.0})
        self.assertTrue(g["adjusted"])
        self.assertAlmostEqual(g["lambdaHome"], round(1.55 * 0.85, 3))
        ref = M.markets_from_lambdas(1.55, 1.10, M.RHO)
        self.assertLess(g["over25"], ref["p_over25"])   # forvet eksik → daha az gol
        self.assertLess(g["btts"], ref["p_btts_yes"])


class Scoring(unittest.TestCase):
    def test_brier_and_logloss(self):
        p = {"home": 0.5, "draw": 0.3, "away": 0.2}
        y = IA.outcome_vec(2, 1)
        self.assertAlmostEqual(IA.brier3(p, y), 0.25 + 0.09 + 0.04)
        self.assertAlmostEqual(IA.logloss3(p, y), -__import__("math").log(0.5))
        self.assertEqual(IA.argmax3(p), "home")
        self.assertEqual(IA.outcome_vec(1, 1)["draw"], 1)
        self.assertEqual(IA.brier_bin(None, 1), None)
        self.assertAlmostEqual(IA.brier_bin(0.7, 1), 0.09)

    def test_bootstrap_ci_brackets_mean(self):
        diffs = [-0.02, -0.01, 0.0, -0.03, 0.01, -0.02, -0.015, -0.005]
        lo, hi = IA.paired_bootstrap_ci(diffs, n_boot=500)
        m = sum(diffs) / len(diffs)
        self.assertLessEqual(lo, m)
        self.assertGreaterEqual(hi, m)


class PromptAndCost(unittest.TestCase):
    ANCHOR = {"fixture_id": 1, "league_id": 47, "league_name": "Premier League", "home_id": 10, "home_name": "A",
              "away_id": 11, "away_name": "B", "kickoff": "2026-10-18T15:00:00+00:00",
              "p_home": 0.45, "p_draw": 0.27, "p_away": 0.28, "p_over25": 0.52, "p_btts_yes": 0.55,
              "lambda_home": 1.55, "lambda_away": 1.1, "model_version": "dc-1.0"}

    def test_prompt_contains_anchor_and_market_separately(self):
        mk = {"phase": "closing", "provider": "x", "captured_at": "t", "home_odds": 2.0, "draw_odds": 3.5,
              "away_odds": 3.8, "p_home_market": 0.47, "p_draw_market": 0.27, "p_away_market": 0.26}
        s = IA.build_user_prompt(self.ANCHOR, mk, None, "tr", datetime(2026, 10, 16, tzinfo=timezone.utc))
        self.assertIn("ÇIPA", s)
        self.assertIn('"home": 0.45', s)
        self.assertIn("Piyasa — YALNIZ bilgi", s)
        self.assertIn("lang: tr", s)
        b = IA.baseline_from_anchor(self.ANCHOR)
        self.assertEqual(b["modelVersion"], "dc-1.0")
        self.assertEqual(b["lambdaHome"], 1.55)

    def test_schema_is_strict_json(self):
        json.dumps(IA.OUTPUT_SCHEMA)
        self.assertFalse(IA.OUTPUT_SCHEMA["additionalProperties"])
        self.assertIn("deviations", IA.OUTPUT_SCHEMA["required"])
        self.assertNotIn("form", IA.DEVIATION_CATEGORIES)

    def test_cost_estimate(self):
        u = {"input_tokens": 10_000, "output_tokens": 2_000, "cache_read_input_tokens": 0,
             "cache_creation_input_tokens": 0, "web_search_requests": 3}
        c = IA.estimate_cost("claude-opus-5-5", u)
        self.assertAlmostEqual(c, 0.04 + 0.04 + 0.03, places=5)
        self.assertEqual(IA.estimate_cost("unknown-model", u), 0.0)

    def test_load_env_file_does_not_override(self):
        import tempfile
        with tempfile.NamedTemporaryFile("w", suffix=".env", delete=False) as f:
            f.write("# yorum\nINTEL_TEST_A=\"x\"\nINTEL_TEST_B=y\n")
            path = f.name
        os.environ["INTEL_TEST_B"] = "keep"
        try:
            n = IA.load_env_file(path)
            self.assertEqual(n, 1)
            self.assertEqual(os.environ["INTEL_TEST_A"], "x")
            self.assertEqual(os.environ["INTEL_TEST_B"], "keep")
        finally:
            os.unlink(path)
            os.environ.pop("INTEL_TEST_A", None); os.environ.pop("INTEL_TEST_B", None)


if __name__ == "__main__":
    unittest.main()


class AnalyzeEndToEnd(unittest.TestCase):
    """call_claude ve Supabase sahte; analyze() satırı doğru kurar mı (dry-run ve write)."""

    ANCHOR = {**PromptAndCost.ANCHOR, "kickoff": "2099-01-01T15:00:00+00:00"}
    LLM_OUT = {
        "deviations": [dev((-0.30, 0.15, 0.15), mult=(0.9, 1.0))],   # kırpılacak
        "intel": {"injuries": [], "lineupNews": "", "context": "", "sources": []},
        "confidence": "medium", "dataCompleteness": 0.6, "keyFactors": ["x"],
        "narrative": "Model ev sahibini işaret ediyor.", "unverified": [],
    }

    def setUp(self):
        self.written = []
        self._orig = (IA.call_claude, IA.fetch_anchor, IA.fetch_market, IA.store_context, IA.sb_upsert, IA.official_version)
        IA.call_claude = lambda *a, **k: (json.loads(json.dumps(self.LLM_OUT)),
                                         {"input_tokens": 100, "output_tokens": 50, "cache_read_input_tokens": 0,
                                          "cache_creation_input_tokens": 0, "web_search_requests": 1,
                                          "model": "claude-opus-5-5", "stop_reason": "end_turn"}, [{"url": "u", "title": "t", "age": ""}])
        IA.fetch_anchor = lambda fid, ver: dict(self.ANCHOR) if fid == 1 else None
        IA.fetch_market = lambda fid: None
        IA.store_context = lambda a, k: None
        IA.sb_upsert = lambda table, rows, on_conflict: self.written.append((table, rows, on_conflict)) or 201
        IA.official_version = lambda: "dc-1.0"

    def tearDown(self):
        (IA.call_claude, IA.fetch_anchor, IA.fetch_market, IA.store_context, IA.sb_upsert, IA.official_version) = self._orig

    def test_dry_run_builds_analysis_and_clips(self):
        res = IA.analyze(1, False, "claude-opus-5-5", "medium", "tr", 2, False, None, True)
        self.assertEqual(res["baseline"]["home"], 0.45)
        self.assertEqual(res["deviations"][0]["shift"]["home"], -IA.SHIFT_CAP)
        self.assertAlmostEqual(sum(res["probabilities"].values()), 1.0, places=4)
        self.assertTrue(res["goals"]["adjusted"])
        self.assertIn("pick", res)
        self.assertFalse(res["issuedAfterKickoff"])
        self.assertGreater(res["usage"]["cost_usd"], 0)
        self.assertEqual(self.written, [])

    def test_write_upserts_row_with_baseline_and_final(self):
        IA.analyze(1, True, "claude-opus-5-5", "medium", "tr", 2, False, None, True)
        self.assertEqual(len(self.written), 1)
        table, rows, conflict = self.written[0]
        self.assertEqual((table, conflict), ("engine_intel", "fixture_id,agent_version"))
        row = rows[0]
        self.assertEqual(row["agent_version"], IA.AGENT_VERSION)
        self.assertEqual(row["model_version"], "dc-1.0")
        self.assertIn("baseline", row); self.assertIn("final", row); self.assertIn("goals", row)
        self.assertNotEqual(row["baseline"]["home"], row["final"]["home"])

    def test_missing_anchor_refuses(self):
        with self.assertRaises(SystemExit):
            IA.analyze(999, False, "claude-opus-5-5", "medium", "tr", 2, False, None, True)

    def test_past_kickoff_refuses_without_force(self):
        IA.fetch_anchor = lambda fid, ver: {**self.ANCHOR, "kickoff": "2020-01-01T15:00:00+00:00"}
        with self.assertRaises(SystemExit):
            IA.analyze(1, False, "claude-opus-5-5", "medium", "tr", 2, False, None, True)
        res = IA.analyze(1, False, "claude-opus-5-5", "medium", "tr", 2, True, None, True)
        self.assertTrue(res["issuedAfterKickoff"])
