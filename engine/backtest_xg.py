"""
xG-Dixon-Coles walk-forward backtest + xg_weight taraması.
features.load_features (gol+xG) → model_xg.fit(xg_weight) → aynı metrikler + kalibrasyon (ECE).
Baseline (w=0.0) dahil taranır → gol-DC ile birebir sağlaması.

Çalıştır (venv, soccerdata gerekli):
  SOCCERDATA_DIR=/tmp/soccerdata ../src/lib/data-sources/venv/bin/python backtest_xg.py E0
"""
import math
import sys

from features import load_features
import model_xg as MX


def implied_probs(oh, od, oa):
    if not (oh and od and oa):
        return None
    ih, idr, ia = 1 / oh, 1 / od, 1 / oa
    s = ih + idr + ia
    return {"H": ih / s, "D": idr / s, "A": ia / s}


def evaluate(matches, xg_weight, test_from_season="2122", ev_threshold=0.05,
             half_life=180, window=540):
    fit_cache = {}

    def get_model(ref_date):
        key = ref_date.toordinal()
        if key not in fit_cache:
            fit_cache[key] = MX.fit(matches, ref_date, xg_weight=xg_weight,
                                    half_life_days=half_life, window_days=window)
        return fit_cache[key]

    n = correct = book_correct = 0
    brier_sum = logloss_sum = 0.0
    bets = bet_wins = 0
    bet_profit = 0.0
    # kalibrasyon: seçilen sonucun güveni vs isabet (10 bin)
    cal_bins = [[0, 0.0] for _ in range(10)]  # [count, correct]

    for m in matches:
        if m["season"] < test_from_season:
            continue
        mdl = get_model(m["date"])
        if mdl is None:
            continue
        pr = MX.predict(mdl, m["home"], m["away"])
        if pr is None:
            continue
        model_p = {"H": pr["p_home"], "D": pr["p_draw"], "A": pr["p_away"]}
        actual = m["ftr"]
        if actual not in ("H", "D", "A"):
            continue
        n += 1

        pick = max(model_p, key=model_p.get)
        conf = model_p[pick]
        if pick == actual:
            correct += 1
        bi = min(9, int(conf * 10))
        cal_bins[bi][0] += 1
        cal_bins[bi][1] += 1.0 if pick == actual else 0.0

        for o in ("H", "D", "A"):
            y = 1.0 if o == actual else 0.0
            brier_sum += (model_p[o] - y) ** 2
        logloss_sum += -math.log(max(model_p[actual], 1e-9))

        imp = implied_probs(m["odds_home"], m["odds_draw"], m["odds_away"])
        if imp:
            if max(imp, key=imp.get) == actual:
                book_correct += 1
            odds = {"H": m["odds_home"], "D": m["odds_draw"], "A": m["odds_away"]}
            for o in ("H", "D", "A"):
                if model_p[o] * odds[o] - 1.0 > ev_threshold:
                    bets += 1
                    if o == actual:
                        bet_profit += odds[o] - 1.0
                        bet_wins += 1
                    else:
                        bet_profit -= 1.0

    if n == 0:
        return None
    ece = sum(c * abs((corr / c) - ((b + 0.5) / 10)) for b, (c, corr) in enumerate(cal_bins) if c) / n
    return {
        "xg_weight": xg_weight, "n": n,
        "acc": correct / n * 100, "book_acc": book_correct / n * 100,
        "brier": brier_sum / n, "logloss": logloss_sum / n,
        "ece": ece * 100,
        "bets": bets, "roi": (bet_profit / bets * 100) if bets else 0.0,
        "bet_hit": (bet_wins / bets * 100) if bets else 0.0,
    }


def run(league="E0", weights=(0.0, 0.25, 0.5, 0.75, 1.0), start=2019, end=2024):
    recs, stats = load_features(league, start, end)
    print(f"[backtest-xg] {league}: {stats['total']} maç, xG kapsama %{stats['coverage_pct']}")
    print("=" * 78)
    print(f"  {league}  walk-forward — xg_weight taraması (test 2122+)")
    print("=" * 78)
    print(f"  {'w':>4} | {'1X2%':>6} | {'Brier':>7} | {'LogLoss':>8} | {'ECE%':>6} | {'bets':>5} | {'ROI%':>7}")
    print("-" * 78)
    results = []
    for w in weights:
        r = evaluate(recs, w)
        if not r:
            continue
        results.append(r)
        print(f"  {w:>4.2f} | {r['acc']:>6.1f} | {r['brier']:>7.4f} | {r['logloss']:>8.4f} | "
              f"{r['ece']:>6.2f} | {r['bets']:>5d} | {r['roi']:>+7.2f}")
    if results:
        print("-" * 78)
        print(f"  bahisçi 1X2 benchmark: {results[0]['book_acc']:.1f}%")
        best = min(results, key=lambda r: r["logloss"])
        print(f"  EN İYİ (log-loss): w={best['xg_weight']:.2f}  logloss={best['logloss']:.4f}  brier={best['brier']:.4f}")
    print("=" * 78)
    return results


if __name__ == "__main__":
    league = sys.argv[1] if len(sys.argv) > 1 else "E0"
    run(league=league)
