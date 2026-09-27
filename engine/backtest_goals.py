"""
GOL SEVİYESİ DENEYİ — walk-forward backtest (2026-09-27).
Soru: ligin taban gol seviyesini kısa yarı-ömürle takip eden bir çarpan (model.level_factor)
Üst/Alt 2,5 ve KG olasılıklarını kapıdan geçecek kadar iyileştirir mi, 1X2'yi bozar mı?

Tek fit / tarih; seviye çarpanı fit sonrası ucuz hesaplandığı için tüm (yarı-ömür, büzülme)
adayları aynı fit'ten türetilir. Metrikler: 1X2 LL/Brier, Ü2,5 LL/Brier, KG LL/Brier,
piyasa Ü2,5 LL (2-yollu de-vig, oran olan maçlar), λ toplamı vs gerçek gol, aylık kırılım.
Çıktı: özet tablo (stdout) + --out ile JSONL tahmin dosyaları (gate.py için: baseline ve
her aday, aynı sıra/n; ek alanlar p_over25, p_btts, goals, odds_over/under).

Kullanım:
  ENGINE_CACHE=.cache/ffdata python3 backtest_goals.py E0 [--start 2019 --end 2025 --test 2122]
      [--hl 30,45,60,90] [--k 20,40,80] [--out /tmp/goals]
"""
import argparse, json, math, os, sys
from collections import defaultdict
from data import load_matches
import model as M


def ll2(p, y):
    p = min(max(p, 1e-6), 1 - 1e-6)
    return -(math.log(p) if y else math.log(1 - p))


def devig2(a, b):
    if not (a and b) or a <= 1 or b <= 1:
        return None
    ia, ib = 1 / a, 1 / b
    return ia / (ia + ib)


def run(league, start, end, test_from, hls, ks, half_life=180, window=540, out_dir=None):
    matches = load_matches(league, start, end)
    print(f"[goals] {league}: {len(matches)} maç", file=sys.stderr)
    configs = [("base", None, 0.0)] + [(f"hl{h}_k{int(k)}", h, k) for h in hls for k in ks]
    agg = {c[0]: defaultdict(float) for c in configs}
    monthly = {c[0]: defaultdict(lambda: defaultdict(float)) for c in configs}
    writers = {}
    if out_dir:
        os.makedirs(out_dir, exist_ok=True)
        writers = {c[0]: open(os.path.join(out_dir, f"{league}_{c[0]}.jsonl"), "w", encoding="utf-8") for c in configs}
    fit_cache = {}
    n = 0
    for m in matches:
        if m["season"] < test_from or m["ftr"] not in ("H", "D", "A"):
            continue
        key = m["date"].toordinal()
        if key not in fit_cache:
            mdl = M.fit(matches, m["date"], half_life_days=half_life, window_days=window)
            levels = {}
            if mdl is not None:
                for name, h, k in configs:
                    levels[name] = 1.0 if h is None else M.level_factor(mdl, matches, m["date"], h, k, window)
            fit_cache[key] = (mdl, levels)
        mdl, levels = fit_cache[key]
        if mdl is None:
            continue
        goals = m["fthg"] + m["ftag"]
        over_y = 1 if goals >= 3 else 0
        btts_y = 1 if (m["fthg"] > 0 and m["ftag"] > 0) else 0
        res = m["ftr"]
        mon = m["date"].strftime("%Y-%m")
        pm_over = devig2(m.get("odds_over"), m.get("odds_under"))
        n += 1
        for name, _, _ in configs:
            pr = M.predict(mdl, m["home"], m["away"], level=levels[name])
            p3 = {"H": pr["p_home"], "D": pr["p_draw"], "A": pr["p_away"]}
            a = agg[name]; mo = monthly[name][mon]
            for d in (a, mo):
                d["n"] += 1
                d["ll1x2"] += -math.log(max(p3[res], 1e-9))
                d["brier1x2"] += sum((p3[o] - (1.0 if o == res else 0.0)) ** 2 for o in p3)
                d["acc1x2"] += 1 if max(p3, key=p3.get) == res else 0
                d["ll_over"] += ll2(pr["p_over25"], over_y)
                d["brier_over"] += (pr["p_over25"] - over_y) ** 2
                d["acc_over"] += 1 if (pr["p_over25"] >= 0.5) == bool(over_y) else 0
                d["ll_btts"] += ll2(pr["p_btts_yes"], btts_y)
                d["brier_btts"] += (pr["p_btts_yes"] - btts_y) ** 2
                d["lam"] += pr["lambda_home"] + pr["lambda_away"]
                d["goals"] += goals
                d["over_y"] += over_y
                d["p_over"] += pr["p_over25"]
                d["level"] += levels[name]
                if pm_over is not None:
                    d["n_mkt"] += 1
                    d["ll_over_mkt"] += ll2(pm_over, over_y)
                    d["ll_over_on_mkt"] += ll2(pr["p_over25"], over_y)
            if writers:
                writers[name].write(json.dumps({
                    "league": league, "date": m["date"].strftime("%Y-%m-%d"), "result": res,
                    "p_home": round(pr["p_home"], 6), "p_draw": round(pr["p_draw"], 6), "p_away": round(pr["p_away"], 6),
                    "odds_home": m["odds_home"], "odds_draw": m["odds_draw"], "odds_away": m["odds_away"],
                    "p_over25": round(pr["p_over25"], 6), "p_btts": round(pr["p_btts_yes"], 6), "goals": goals,
                    "odds_over": m.get("odds_over"), "odds_under": m.get("odds_under"), "level": round(levels[name], 4),
                }) + "\n")
    for w in writers.values():
        w.close()
    if n == 0:
        print("[goals] test maçı yok", file=sys.stderr)
        return None

    def row(d):
        k = d["n"] or 1
        r = {x: d[x] / k for x in ("ll1x2", "brier1x2", "acc1x2", "ll_over", "brier_over", "acc_over", "ll_btts", "brier_btts", "lam", "goals", "over_y", "p_over", "level")}
        r["n"] = int(d["n"]); r["n_mkt"] = int(d["n_mkt"])
        r["ll_over_mkt"] = d["ll_over_mkt"] / d["n_mkt"] if d["n_mkt"] else None
        r["ll_over_on_mkt"] = d["ll_over_on_mkt"] / d["n_mkt"] if d["n_mkt"] else None
        return r

    base = row(agg["base"])
    print(f"\n{'='*100}\n  GOL SEVİYESİ — {league}  test {test_from}+  n={n}  (gerçek gol/maç {base['goals']:.2f}, Üst oranı {base['over_y']:.3f})\n{'='*100}")
    print(f"  {'aday':<12}{'λ':>6}{'p_Ü':>7}{'f':>7} | {'LL_1X2':>8}{'Δ':>8} | {'LL_Ü2.5':>8}{'Δ':>8}{'Brier_Ü':>9}{'isabet_Ü':>9} | {'LL_KG':>8}{'Δ':>8} | {'piyasa_Ü':>9}")
    out = {}
    for name, _, _ in configs:
        r = row(agg[name]); out[name] = r
        d1 = r["ll1x2"] - base["ll1x2"]; d2 = r["ll_over"] - base["ll_over"]; d3 = r["ll_btts"] - base["ll_btts"]
        mk = f"{r['ll_over_mkt']:.4f}" if r["ll_over_mkt"] is not None else "   –"
        print(f"  {name:<12}{r['lam']:>6.2f}{r['p_over']:>7.3f}{r['level']:>7.3f} | {r['ll1x2']:>8.4f}{d1:>+8.4f} | {r['ll_over']:>8.4f}{d2:>+8.4f}{r['brier_over']:>9.4f}{r['acc_over']:>9.3f} | {r['ll_btts']:>8.4f}{d3:>+8.4f} | {mk:>9}")
    # aylık: baseline vs en iyi aday (Ü LL)
    best = min((c[0] for c in configs[1:]), key=lambda nm: out[nm]["ll_over"]) if len(configs) > 1 else None
    if best:
        print(f"\n  Aylık (sezon-içi ay; tüm test sezonları toplanmış) — baseline vs {best}")
        agg_m = defaultdict(lambda: defaultdict(float))
        for name in ("base", best):
            for mon, d in monthly[name].items():
                mm = mon[5:]
                for k2 in ("n", "ll_over", "ll_btts", "ll1x2", "lam", "goals"):
                    agg_m[(name, mm)][k2] += d[k2]
        print(f"  {'ay':<4}{'n':>6}{'gol':>6}{'λ_base':>8}{'λ_aday':>8} | {'ΔLL_Ü':>8}{'ΔLL_KG':>8}{'ΔLL_1X2':>9}")
        for mm in sorted({k[1] for k in agg_m}):
            b = agg_m[("base", mm)]; c = agg_m[(best, mm)]
            if not b["n"]:
                continue
            print(f"  {mm:<4}{int(b['n']):>6}{b['goals']/b['n']:>6.2f}{b['lam']/b['n']:>8.2f}{c['lam']/c['n']:>8.2f} | {(c['ll_over']-b['ll_over'])/b['n']:>+8.4f}{(c['ll_btts']-b['ll_btts'])/b['n']:>+8.4f}{(c['ll1x2']-b['ll1x2'])/b['n']:>+9.4f}")
    return out


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("leagues", nargs="*", default=["E0"])
    ap.add_argument("--start", type=int, default=2019)
    ap.add_argument("--end", type=int, default=2025)
    ap.add_argument("--test", default="2122")
    ap.add_argument("--hl", default="30,45,60,90")
    ap.add_argument("--k", default="20,40,80")
    ap.add_argument("--out", default=None)
    a = ap.parse_args()
    hls = [float(x) for x in a.hl.split(",") if x]
    ks = [float(x) for x in a.k.split(",") if x]
    for lg in a.leagues:
        run(lg, a.start, a.end, a.test, hls, ks, out_dir=a.out)
