"""
Kendi Elo'muz — dış servis (Club Elo) olmadan, yalnız maç sonuçlarından.

Soru: canlı gol-DC'ye (dc-1.0 eşdeğeri), ülkenin ilk iki kademesinin sonuçlarından
hesaplanan Elo harmanlanırsa walk-forward log-loss 5 ligde düşer mi?

Neden iki kademe: gol-DC 540 günlük pencereyle yalnız üst ligi görür; yeni çıkan takımı
"ortalama" sayar (model.predict: bilinmeyen takım A=D=1.0). Elo havuzu alt ligi de
içerdiği için takım üst lige kendi puanıyla gelir.

Elo: World Football Elo kuralı (gol farkı çarpanı), ev avantajı sabit HFA puan.
  E_ev = 1 / (1 + 10^(-(R_ev + HFA - R_dep)/400))
  R += K * G * (S - E),  G = 1 (fark ≤1), 1.5 (fark 2), (11+fark)/8 (fark ≥3)
Elo → 1X2: gol farkı ~ a·(R_ev - R_dep) + b eşlemesi (yalnız FIT sezonları), sonra aynı
Poisson + DC(rho) skorlaması (backtest_elo.elo_probs ile aynı formül).
Harman: p = (1-λ)·p_DC + λ·p_Elo.  λ=0 → baseline'a birebir eşit (kapı sağlaması).

Sızıntı önlemi: Elo puanı maçtan ÖNCEki değerdir; (K, λ) yalnız doğrulama sezonlarında
(1920, 2021) seçilir, test sezonlarında (2122+) hiçbir şey taranmaz.

  python3 engine/backtest_ownelo.py --out /tmp/gate-ownelo
  python3 .claude/skills/fa-prediction-lab/scripts/gate.py /tmp/gate-ownelo/base.jsonl /tmp/gate-ownelo/ownelo.jsonl
"""
import argparse
import json
import math
import os
from collections import defaultdict

from data import load_matches
import model as M
from model import _pois, RHO, MAX_GOALS

# üst lig → aynı ülkenin ikinci kademesi (football-data.co.uk kodları)
PAIRS = {"E0": "E1", "SP1": "SP2", "I1": "I2", "D1": "D2", "F1": "F2"}
ELO_START = 2012          # Elo ısınma başlangıcı
FIT_BEFORE = "1920"       # Elo→gol eşlemesi yalnız bundan önceki sezonlarla
VALID = ("1920", "2021")  # (K, λ) seçimi
TEST_FROM = "2122"
HFA = 60.0
INIT = {0: 1500.0, 1: 1350.0}   # ilk görülen takım: üst lig / ikinci kademe
K_GRID = (10.0, 15.0, 20.0, 30.0)
LAM_GRID = (0.0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6)
OUT = ("H", "D", "A")


def margin_mult(gd):
    gd = abs(gd)
    return 1.0 if gd <= 1 else 1.5 if gd == 2 else (11.0 + gd) / 8.0


def elo_walk(top, second, k):
    """Kronolojik tek havuz. Dönüş: {id(maç): (R_ev, R_dep)} — maçtan ÖNCEki puanlar (yalnız üst lig maçları)."""
    events = [(m["date"], 0, m) for m in top] + [(m["date"], 1, m) for m in second]
    events.sort(key=lambda e: e[0])
    rating, pre = {}, {}
    i = 0
    while i < len(events):
        j = i
        while j < len(events) and events[j][0] == events[i][0]:
            j += 1
        day = events[i:j]
        # aynı günün bütün maçları günün başındaki puanla okunur, sonra güncellenir
        for _, tier, m in day:
            rh = rating.setdefault(m["home"], INIT[tier])
            ra = rating.setdefault(m["away"], INIT[tier])
            if tier == 0:
                pre[id(m)] = (rh, ra)
        upd = defaultdict(float)
        for _, tier, m in day:
            rh, ra = rating[m["home"]], rating[m["away"]]
            e = 1.0 / (1.0 + 10 ** (-(rh + HFA - ra) / 400.0))
            gd = m["fthg"] - m["ftag"]
            s = 1.0 if gd > 0 else 0.5 if gd == 0 else 0.0
            d = k * margin_mult(gd) * (s - e)
            upd[m["home"]] += d
            upd[m["away"]] -= d
        for t, d in upd.items():
            rating[t] += d
        i = j
    return pre


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
            p = max(p, 0.0)
            tot += p
            if i > j:
                H += p
            elif i == j:
                D += p
            else:
                A += p
    return {"H": H / tot, "D": D / tot, "A": A / tot}


def fit_map(top, pre):
    """FIT sezonlarında gol farkı ~ a·elo_diff + b ve ortalama toplam gol."""
    xs, ys, tg = [], [], []
    for m in top:
        if not (str(ELO_START + 3)[-2:] <= m["season"][:2] and m["season"] < FIT_BEFORE):
            continue  # ilk üç sezon ısınma: puanlar henüz oturmamış
        rh, ra = pre[id(m)]
        xs.append(rh + 0.0 - ra); ys.append(m["fthg"] - m["ftag"]); tg.append(m["fthg"] + m["ftag"])
    n = len(xs)
    mx, my = sum(xs) / n, sum(ys) / n
    var = sum((x - mx) ** 2 for x in xs) / n
    cov = sum((x - mx) * (y - my) for x, y in zip(xs, ys)) / n
    a = cov / var
    return a, my - a * mx, sum(tg) / n, n


def dc_walk(top):
    """Gol-DC (canlı dc-1.0 eşdeğeri) walk-forward; doğrulama + test sezonları."""
    cache, out = {}, {}
    for m in top:
        if m["season"] >= VALID[0] and m["ftr"] in OUT:
            k = m["date"].toordinal()
            if k not in cache:
                cache[k] = M.fit(top, m["date"], half_life_days=180, window_days=540)
            mdl = cache[k]
            if mdl is not None:
                pr = M.predict(mdl, m["home"], m["away"])
                if pr is not None:
                    out[id(m)] = ({"H": pr["p_home"], "D": pr["p_draw"], "A": pr["p_away"]},
                                  m["home"] in mdl["A"] and m["away"] in mdl["A"])
    return out


def ll(p, r):
    return -math.log(max(p[r], 1e-9))


def blend(pd, pe, lam):
    return pd if lam == 0.0 else {o: (1 - lam) * pd[o] + lam * pe[o] for o in OUT}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--leagues", default="E0,SP1,I1,D1,F1")
    ap.add_argument("--end", type=int, default=2026)
    ap.add_argument("--out", default="/tmp/gate-ownelo")
    args = ap.parse_args()
    os.makedirs(args.out, exist_ok=True)
    leagues = args.leagues.split(",")

    top, second, dc = {}, {}, {}
    for lg in leagues:
        top[lg] = load_matches(lg, ELO_START, args.end)
        second[lg] = load_matches(PAIRS[lg], ELO_START, args.end)
        dc[lg] = dc_walk(top[lg])
        print(f"[load] {lg}: üst {len(top[lg])} / alt {len(second[lg])} maç, DC tahmini {len(dc[lg])}", flush=True)

    # (K, λ) — yalnız doğrulama sezonları, 5 lig havuzlanmış
    elo = {}   # (lg, k) -> (pre, map)
    grid = {}
    for k in K_GRID:
        for lg in leagues:
            pre = elo_walk(top[lg], second[lg], k)
            elo[(lg, k)] = (pre, fit_map(top[lg], pre))
        for lam in LAM_GRID:
            s = n = 0.0
            for lg in leagues:
                pre, (a, b, total, _) = elo[(lg, k)]
                for m in top[lg]:
                    if m["season"] in VALID and id(m) in dc[lg]:
                        rh, ra = pre[id(m)]
                        s += ll(blend(dc[lg][id(m)][0], elo_probs(rh - ra, a, b, total), lam), m["ftr"]); n += 1
            grid[(k, lam)] = s / n
    print(f"\n[doğrulama] sezon {VALID}, n={int(n)} — log-loss (satır K, sütun λ)")
    print("      " + "".join(f"{lam:>8.1f}" for lam in LAM_GRID))
    for k in K_GRID:
        print(f"  K={k:<3.0f}" + "".join(f"{grid[(k, lam)]:>8.4f}" for lam in LAM_GRID))
    k_best, lam_best = min(grid, key=grid.get)
    print(f"[doğrulama] seçilen K={k_best:.0f} λ={lam_best:.1f} (LL {grid[(k_best, lam_best)]:.4f}; λ=0 {grid[(k_best, 0.0)]:.4f})\n")

    files = {n: open(os.path.join(args.out, f"{n}.jsonl"), "w", encoding="utf-8") for n in ("base", "ownelo", "eloonly")}
    seg = defaultdict(lambda: [0, 0.0, 0.0])   # etiket -> n, LL base, LL aday
    summary = []
    for lg in leagues:
        pre, (a, b, total, nfit) = elo[(lg, k_best)]
        n = 0
        for m in top[lg]:
            if m["season"] < TEST_FROM or id(m) not in dc[lg]:
                continue
            pd, both_known = dc[lg][id(m)]
            rh, ra = pre[id(m)]
            pe = elo_probs(rh - ra, a, b, total)
            pc = blend(pd, pe, lam_best)
            common = {"league": lg, "date": m["date"].strftime("%Y-%m-%d"), "home": m["home"], "away": m["away"],
                      "result": m["ftr"], "odds_home": m["odds_home"], "odds_draw": m["odds_draw"], "odds_away": m["odds_away"]}
            for name, p in (("base", pd), ("ownelo", pc), ("eloonly", pe)):
                files[name].write(json.dumps({**common, "p_home": p["H"], "p_draw": p["D"], "p_away": p["A"]}, ensure_ascii=False) + "\n")
            n += 1
            month = m["date"].month
            labels = ["ay: Ağu-Eyl" if month in (8, 9) else "ay: Eki-Ara" if month >= 10 else "ay: Oca-Haz/Tem",
                      "DC iki takımı da tanıyor" if both_known else "DC en az bir takımı tanımıyor"]
            if m["odds_home"] and m["odds_draw"] and m["odds_away"]:
                inv = [1 / m["odds_home"], 1 / m["odds_draw"], 1 / m["odds_away"]]
                gap = abs(pd["H"] - inv[0] / sum(inv))
                labels.append("DC-piyasa farkı <5 puan" if gap < 0.05 else "DC-piyasa farkı 5-10 puan" if gap < 0.10 else "DC-piyasa farkı ≥10 puan")
            for lab in labels:
                seg[lab][0] += 1; seg[lab][1] += ll(pd, m["ftr"]); seg[lab][2] += ll(pc, m["ftr"])
        summary.append({"league": lg, "n": n, "a": a, "b": b, "total": total, "fit_n": nfit})
        print(f"[export] {lg}: test n={n}, eşleme a={a:.5f} gol/Elo, b={b:+.3f}, toplam gol {total:.2f} (fit n={nfit})", flush=True)
    for f in files.values():
        f.close()

    print("\n[dilim] kazanç nerede (test, 5 lig; ΔLL = aday − baseline)")
    for lab in sorted(seg):
        n, sb, sc = seg[lab]
        print(f"  {lab:<32} n={n:>5}  base {sb / n:.4f}  aday {sc / n:.4f}  Δ {(sc - sb) / n:+.4f}")
    with open(os.path.join(args.out, "summary.json"), "w", encoding="utf-8") as f:
        json.dump({"k": k_best, "lambda": lam_best, "hfa": HFA, "valid": VALID, "test_from": TEST_FROM,
                   "grid": {f"{k:.0f}|{lam:.1f}": v for (k, lam), v in grid.items()}, "leagues": summary}, f, indent=1, ensure_ascii=False)
    print(f"\n[done] {args.out}/base.jsonl ownelo.jsonl eloonly.jsonl")


if __name__ == "__main__":
    main()
