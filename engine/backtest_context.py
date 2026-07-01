"""
Form + H2H predict-zamanı tilt backtest kapısı.

CANLI baseline = xG-DC (xg_weight=0.75). Onun predict çıktısına sınırlı bir tilt
uygulanır (anchor disiplini): ev/deplasman olasılığını yakın form ve H2H yönünde
kaydır, sonra normalize et. Draw dolaylı ayarlanır.

  tilt = beta_form * (home_form_pts - away_form_pts)/3   [+ beta_h2h * clamp(h2h_gd/2)]
  p_home *= e^tilt ,  p_away *= e^-tilt ,  renormalize

beta_form=beta_h2h=0 → baseline'a BİREBİR eşit (kapı sağlaması).
Fit maliyetli olduğu için model + baz predict bir kez hesaplanır, tüm beta
kombinasyonları o önbellekten skorlanır.

Çalıştır (venv):
  SOCCERDATA_DIR=/tmp/soccerdata ../src/lib/data-sources/venv/bin/python backtest_context.py E0
"""
import math
import sys

from features import load_features
from features_context import annotate_context
import model_xg as MX

XG_WEIGHT = 0.75
MIN_FORM_N = 3   # tilt için gereken min. geçmiş maç


def apply_tilt(p, ctx, bf, bh):
    tilt = 0.0
    if bf and ctx["home_n"] >= MIN_FORM_N and ctx["away_n"] >= MIN_FORM_N:
        tilt += bf * (ctx["home_form_pts"] - ctx["away_form_pts"]) / 3.0
    if bh and ctx["h2h_n"] > 0:
        tilt += bh * max(-1.0, min(1.0, ctx["h2h_gd"] / 2.0))
    if tilt == 0.0:
        return p
    ph = p["H"] * math.exp(tilt)
    pa = p["A"] * math.exp(-tilt)
    pd = p["D"]
    s = ph + pa + pd
    return {"H": ph / s, "D": pd / s, "A": pa / s}


def precompute(matches, xg_weight=XG_WEIGHT, test_from_season="2122",
               half_life=180, window=540):
    """Test maçları için (baz_model_p, actual, ctx, odds) listesi — fit bir kez."""
    fit_cache = {}

    def get_model(ref_date):
        key = ref_date.toordinal()
        if key not in fit_cache:
            fit_cache[key] = MX.fit(matches, ref_date, xg_weight=xg_weight,
                                    half_life_days=half_life, window_days=window)
        return fit_cache[key]

    preds = []
    for m in matches:
        if m["season"] < test_from_season:
            continue
        if m["ftr"] not in ("H", "D", "A"):
            continue
        mdl = get_model(m["date"])
        if mdl is None:
            continue
        pr = MX.predict(mdl, m["home"], m["away"])
        if pr is None:
            continue
        preds.append({
            "p": {"H": pr["p_home"], "D": pr["p_draw"], "A": pr["p_away"]},
            "actual": m["ftr"], "ctx": m["ctx"],
            "odds": {"H": m["odds_home"], "D": m["odds_draw"], "A": m["odds_away"]},
        })
    return preds


def score(preds, bf, bh, ev_threshold=0.05):
    n = correct = 0
    brier_sum = logloss_sum = 0.0
    bets = bet_wins = 0
    bet_profit = 0.0
    cal_bins = [[0, 0.0] for _ in range(10)]

    for e in preds:
        p = apply_tilt(e["p"], e["ctx"], bf, bh)
        actual = e["actual"]
        n += 1
        pick = max(p, key=p.get)
        conf = p[pick]
        if pick == actual:
            correct += 1
        bi = min(9, int(conf * 10))
        cal_bins[bi][0] += 1
        cal_bins[bi][1] += 1.0 if pick == actual else 0.0
        for o in ("H", "D", "A"):
            y = 1.0 if o == actual else 0.0
            brier_sum += (p[o] - y) ** 2
        logloss_sum += -math.log(max(p[actual], 1e-9))

        od = e["odds"]
        if od["H"] and od["D"] and od["A"]:
            for o in ("H", "D", "A"):
                if p[o] * od[o] - 1.0 > ev_threshold:
                    bets += 1
                    if o == actual:
                        bet_profit += od[o] - 1.0
                        bet_wins += 1
                    else:
                        bet_profit -= 1.0

    if n == 0:
        return None
    ece = sum(c * abs((corr / c) - ((b + 0.5) / 10))
              for b, (c, corr) in enumerate(cal_bins) if c) / n
    return {
        "bf": bf, "bh": bh, "n": n,
        "acc": correct / n * 100,
        "brier": brier_sum / n, "logloss": logloss_sum / n, "ece": ece * 100,
        "bets": bets, "roi": (bet_profit / bets * 100) if bets else 0.0,
    }


def run(league="E0", start=2019, end=2024,
        form_betas=(0.0, 0.15, 0.30, 0.45, 0.60),
        h2h_betas=(0.0, 0.10, 0.20)):
    recs, stats = load_features(league, start, end)
    annotate_context(recs)
    preds = precompute(recs)
    print(f"[backtest-context] {league}: {stats['total']} maç, test örneği {len(preds)}")
    print("=" * 74)
    print(f"  {league}  form/H2H tilt taraması (baseline = bf=0,bh=0)")
    print("=" * 74)
    print(f"  {'bf':>4} {'bh':>4} | {'1X2%':>6} | {'Brier':>7} | {'LogLoss':>8} | {'ECE%':>5} | {'bets':>4} | {'ROI%':>7}")
    print("-" * 74)
    base = score(preds, 0.0, 0.0)
    results = []
    for bf in form_betas:
        for bh in h2h_betas:
            r = score(preds, bf, bh)
            results.append(r)
            flag = "  <= baseline" if (bf == 0 and bh == 0) else ""
            print(f"  {bf:>4.2f} {bh:>4.2f} | {r['acc']:>6.1f} | {r['brier']:>7.4f} | "
                  f"{r['logloss']:>8.4f} | {r['ece']:>5.2f} | {r['bets']:>4d} | {r['roi']:>+7.2f}{flag}")
    print("-" * 74)
    best_ll = min(results, key=lambda r: r["logloss"])
    best_br = min(results, key=lambda r: r["brier"])
    print(f"  baseline    logloss={base['logloss']:.4f}  brier={base['brier']:.4f}")
    print(f"  EN İYİ LL   bf={best_ll['bf']:.2f} bh={best_ll['bh']:.2f}  "
          f"logloss={best_ll['logloss']:.4f}  (Δ={best_ll['logloss']-base['logloss']:+.4f})")
    print(f"  EN İYİ Brier bf={best_br['bf']:.2f} bh={best_br['bh']:.2f}  "
          f"brier={best_br['brier']:.4f}  (Δ={best_br['brier']-base['brier']:+.4f})")
    print("=" * 74)
    return {"base": base, "results": results, "best_ll": best_ll, "best_br": best_br}


if __name__ == "__main__":
    league = sys.argv[1] if len(sys.argv) > 1 else "E0"
    run(league=league)
