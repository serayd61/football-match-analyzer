"""
ELO harman backtest kapısı (Faz 2).

CANLI baseline = xG-DC (xg_weight=0.75). ELO'yu bağımsız bir 1X2 tahminine çevirip
predict-zamanı harmanlarız:   p = (1-λ)·p_xgDC + λ·p_ELO

ELO→1X2: eğitim (test-öncesi sezonlar) üzerinde gol-farkı ~ a·(elo_home-elo_away)+b
lineer eşlemesi fit edilir (b = ev avantajı, gol). Maç için supremacy→(lam_h,lam_a),
aynı Poisson+DC(rho) skorlamasıyla 1X2. ELO yoksa o maçta saf DC (graceful).

λ=0 → baseline'a BİREBİR eşit (kapı sağlaması). λ taranır.

Çalıştır (venv, snapshot cache'liyse hızlı):
  SOCCERDATA_DIR=/tmp/soccerdata ../src/lib/data-sources/venv/bin/python backtest_elo.py E0
"""
import math
import sys

from features import load_features
import features_elo as FE
import model_xg as MX
from model import _pois, RHO, MAX_GOALS

XG_WEIGHT = 0.75
TEST_FROM = "2122"


def elo_probs(elo_diff, a, b, total, cap_sup=2.5):
    sup = max(-cap_sup, min(cap_sup, a * elo_diff + b))
    lam_h = max(0.05, min(6.0, (total + sup) / 2))
    lam_a = max(0.05, min(6.0, (total - sup) / 2))
    ph = [_pois(i, lam_h) for i in range(MAX_GOALS + 1)]
    pa = [_pois(j, lam_a) for j in range(MAX_GOALS + 1)]
    H = D = A = tot = 0.0
    for i in range(MAX_GOALS + 1):
        for j in range(MAX_GOALS + 1):
            p = ph[i] * pa[j]
            if i == 0 and j == 0:
                p *= 1 - lam_h * lam_a * RHO
            elif i == 1 and j == 0:
                p *= 1 + lam_a * RHO
            elif i == 0 and j == 1:
                p *= 1 + lam_h * RHO
            elif i == 1 and j == 1:
                p *= 1 - RHO
            if p < 0:
                p = 0.0
            tot += p
            if i > j:
                H += p
            elif i == j:
                D += p
            else:
                A += p
    return {"H": H / tot, "D": D / tot, "A": A / tot}


def fit_elo_map(matches, grid, snaps, country, test_from=TEST_FROM):
    """Eğitim maçlarında gol-farkı ~ a·elo_diff + b + ortalama toplam gol."""
    sx = sy = sxx = sxy = n = 0.0
    stg = stn = 0.0
    for m in matches:
        if m["season"] >= test_from:
            continue
        eh = FE.elo_of(grid, snaps, country, m["home"], m["date"])
        ea = FE.elo_of(grid, snaps, country, m["away"], m["date"])
        stg += m["fthg"] + m["ftag"]; stn += 1
        if eh is None or ea is None:
            continue
        x = eh - ea; y = m["fthg"] - m["ftag"]
        sx += x; sy += y; sxx += x * x; sxy += x * y; n += 1
    if n < 50:
        return None
    mx, my = sx / n, sy / n
    var = sxx / n - mx * mx
    cov = sxy / n - mx * my
    a = cov / var if var > 0 else 0.0
    b = my - a * mx
    total = stg / stn if stn else 2.6
    return a, b, total, int(n)


def precompute(matches, fd_code, grid, snaps, a, b, total,
               test_from=TEST_FROM, half_life=180, window=540):
    country = FE.CC[fd_code]
    fit_cache = {}

    def gm(ref):
        k = ref.toordinal()
        if k not in fit_cache:
            fit_cache[k] = MX.fit(matches, ref, xg_weight=XG_WEIGHT,
                                  half_life_days=half_life, window_days=window)
        return fit_cache[k]

    preds = []
    elo_hits = 0
    for m in matches:
        if m["season"] < test_from or m["ftr"] not in ("H", "D", "A"):
            continue
        mdl = gm(m["date"])
        if mdl is None:
            continue
        pr = MX.predict(mdl, m["home"], m["away"])
        if pr is None:
            continue
        p_dc = {"H": pr["p_home"], "D": pr["p_draw"], "A": pr["p_away"]}
        eh = FE.elo_of(grid, snaps, country, m["home"], m["date"])
        ea = FE.elo_of(grid, snaps, country, m["away"], m["date"])
        p_elo = None
        if eh is not None and ea is not None:
            p_elo = elo_probs(eh - ea, a, b, total)
            elo_hits += 1
        preds.append({"p_dc": p_dc, "p_elo": p_elo, "actual": m["ftr"],
                      "odds": {"H": m["odds_home"], "D": m["odds_draw"], "A": m["odds_away"]}})
    return preds, elo_hits


def score(preds, lam, ev_threshold=0.05):
    n = correct = 0
    brier_sum = logloss_sum = 0.0
    bets = bet_wins = 0
    bet_profit = 0.0
    cal_bins = [[0, 0.0] for _ in range(10)]
    for e in preds:
        pd = e["p_dc"]
        pe = e["p_elo"]
        if pe is None or lam == 0.0:
            p = pd
        else:
            p = {o: (1 - lam) * pd[o] + lam * pe[o] for o in ("H", "D", "A")}
        actual = e["actual"]
        n += 1
        pick = max(p, key=p.get)
        if pick == actual:
            correct += 1
        bi = min(9, int(p[pick] * 10))
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
    return {"lam": lam, "n": n, "acc": correct / n * 100,
            "brier": brier_sum / n, "logloss": logloss_sum / n, "ece": ece * 100,
            "bets": bets, "roi": (bet_profit / bets * 100) if bets else 0.0}


def run(league="E0", start=2020, end=2024, lambdas=(0.0, 0.1, 0.2, 0.3, 0.4, 0.5),
        grid=None, snaps=None):
    recs, stats = load_features(league, start, end)
    if grid is None:
        grid, snaps = FE.build_snapshots([m["date"] for m in recs])
    country = FE.CC[league]
    fit = fit_elo_map(recs, grid, snaps, country)
    if not fit:
        print(f"[elo] {league}: yetersiz eğitim ELO'su, atlandı")
        return None
    a, b, total, ntrain = fit
    preds, ehits = precompute(recs, league, grid, snaps, a, b, total)
    cov = ehits / len(preds) * 100 if preds else 0
    print(f"[backtest-elo] {league}: test {len(preds)} maç, ELO kapsama %{cov:.1f} | "
          f"fit a={a:.5f} b={b:+.3f} total={total:.2f} (n={ntrain})")
    print("=" * 70)
    print(f"  {'λ':>4} | {'1X2%':>6} | {'Brier':>7} | {'LogLoss':>8} | {'ECE%':>5} | {'bets':>4} | {'ROI%':>7}")
    print("-" * 70)
    base = score(preds, 0.0)
    results = []
    for lam in lambdas:
        r = score(preds, lam)
        results.append(r)
        flag = "  <= baseline" if lam == 0 else ""
        print(f"  {lam:>4.2f} | {r['acc']:>6.1f} | {r['brier']:>7.4f} | {r['logloss']:>8.4f} | "
              f"{r['ece']:>5.2f} | {r['bets']:>4d} | {r['roi']:>+7.2f}{flag}")
    print("-" * 70)
    best = min(results, key=lambda r: r["logloss"])
    print(f"  baseline logloss={base['logloss']:.4f} brier={base['brier']:.4f}")
    print(f"  EN İYİ λ={best['lam']:.2f} logloss={best['logloss']:.4f} "
          f"(Δ={best['logloss']-base['logloss']:+.4f})  brier Δ={best['brier']-base['brier']:+.4f}")
    print("=" * 70)
    return {"league": league, "base": base, "results": results, "best": best,
            "grid": grid, "snaps": snaps}


if __name__ == "__main__":
    league = sys.argv[1] if len(sys.argv) > 1 else "E0"
    run(league=league)
