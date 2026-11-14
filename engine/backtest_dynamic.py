"""
Dinamik takım gücü (skor-güdümlü Poisson) — sabit yarı-ömürlü gol-DC yerine / yanına.

Soru: takım atak/savunma gücü her maçtan sonra küçük bir adımla güncellenirse (Koopman & Lit
2019 tarzı skor-güdümlü model) walk-forward log-loss canlı gol-DC'ye (dc-1.0 eşdeğeri) ve
gölgedeki DC+Elo harmanına göre düşer mi?

Model (log ölçek, ülkenin ilk iki kademesi tek havuz — Elo ile aynı gerekçe):
    log λ_ev  = log ḡ_ev(kademe)  + atak_ev  − savunma_dep
    log λ_dep = log ḡ_dep(kademe) + atak_dep − savunma_ev
    maçtan sonra:  atak_ev  += κ·(gol_ev − λ_ev),   savunma_dep −= κ·(gol_ev − λ_ev)
                   atak_dep += κ·(gol_dep − λ_dep), savunma_ev  −= κ·(gol_dep − λ_dep)
    ḡ: kademenin üstel ağırlıklı ev / deplasman gol ortalaması (yarı-ömür 760 maç ≈ 2 sezon).
    İlk kez görülen takım: üst kademede 0, alt kademede atak = savunma = −δ.
1X2: canlıdakiyle aynı Poisson + DC(ρ) (model.markets_from_lambdas).

Sızıntı: aynı günün maçları günün BAŞINDAKİ gücü okur. (κ, δ) ve harman ağırlıkları yalnız
doğrulama sezonlarında (1920, 2021) 5 lig havuzlanarak seçilir; testte (2122+) tarama yok.
Parite: harman ağırlığı 0 → baseline birebir.

  python3 engine/backtest_dynamic.py --out /tmp/gate-dyn --dc-cache /tmp/dc-cache.json
  python3 .claude/skills/fa-prediction-lab/scripts/gate.py /tmp/gate-dyn/base.jsonl /tmp/gate-dyn/dcdyn.jsonl
"""
import argparse
import json
import math
import os
from collections import defaultdict

from data import load_matches
import model as M
from model import RHO
import backtest_ownelo as BO

OUT = ("H", "D", "A")
KAPPA_GRID = (0.005, 0.01, 0.015, 0.02, 0.03, 0.04, 0.06)
DELTA_GRID = (0.0, 0.15, 0.25, 0.35, 0.45)
W_GRID = (0.0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1.0)
AVG_HALF_LIFE = 760.0     # maç; kademe gol ortalamasının yarı-ömrü
START_AVG = (1.50, 1.20)  # ev / deplasman gol ortalaması başlangıcı
CAP = 1.5                 # |atak|, |savunma| tavanı (log)
ELO_K, ELO_LAM = 10.0, 0.6   # reports/backtest-own-elo.md'de seçilmiş değerler (yeniden taranmaz)


def dyn_walk(top, second, kappa, delta):
    """Dönüş: {id(maç): (λ_ev, λ_dep)} — maçtan ÖNCEki güçlerle, yalnız üst lig maçları."""
    att, dfn = {}, {}
    avg = {0: list(START_AVG), 1: list(START_AVG)}
    decay = 0.5 ** (1.0 / AVG_HALF_LIFE)
    start = {0: 0.0, 1: -delta}
    pre = {}
    events = sorted([(m["date"], 0, m) for m in top] + [(m["date"], 1, m) for m in second], key=lambda e: e[0])
    i = 0
    while i < len(events):
        j = i
        while j < len(events) and events[j][0] == events[i][0]:
            j += 1
        day = events[i:j]
        lams = []
        for _, tier, m in day:
            for t in (m["home"], m["away"]):
                if t not in att:
                    att[t] = dfn[t] = start[tier]
            lh = avg[tier][0] * math.exp(att[m["home"]] - dfn[m["away"]])
            la = avg[tier][1] * math.exp(att[m["away"]] - dfn[m["home"]])
            lh, la = min(max(lh, 0.05), 6.0), min(max(la, 0.05), 6.0)
            lams.append((lh, la))
            if tier == 0:
                pre[id(m)] = (lh, la)
        da, dd = defaultdict(float), defaultdict(float)
        for (_, tier, m), (lh, la) in zip(day, lams):
            eh, ea = m["fthg"] - lh, m["ftag"] - la
            da[m["home"]] += kappa * eh; dd[m["away"]] -= kappa * eh
            da[m["away"]] += kappa * ea; dd[m["home"]] -= kappa * ea
            avg[tier][0] = decay * avg[tier][0] + (1 - decay) * m["fthg"]
            avg[tier][1] = decay * avg[tier][1] + (1 - decay) * m["ftag"]
        for t, v in da.items():
            att[t] = max(-CAP, min(CAP, att[t] + v))
        for t, v in dd.items():
            dfn[t] = max(-CAP, min(CAP, dfn[t] + v))
        i = j
    return pre


def dyn_walk_short(top, second, kappa, delta, history_seasons):
    """Canlı depo derinliği: her sezonun güçleri yalnız o sezon + önceki N sezondan, sıfırdan."""
    seasons = sorted({m["season"] for m in top})
    pre = {}
    for i, t in enumerate(seasons):
        keep = set(seasons[max(0, i - history_seasons):i + 1])
        part = dyn_walk([m for m in top if m["season"] in keep], [m for m in second if m["season"] in keep], kappa, delta)
        for m in top:
            if m["season"] == t:
                pre[id(m)] = part[id(m)]
    return pre


def probs(lh, la, rho=RHO):
    pr = M.markets_from_lambdas(lh, la, rho)
    return {"H": pr["p_home"], "D": pr["p_draw"], "A": pr["p_away"]}


def mix(p, q, w):
    return p if w == 0.0 else q if w == 1.0 else {o: (1 - w) * p[o] + w * q[o] for o in OUT}


def ll(p, r):
    return -math.log(max(p[r], 1e-9))


def platt_fit(ps, ys, iters=50):
    """p' = σ(a + b·logit(p)) — iki parametreli lojistik (Newton). Canlıdaki calib ile aynı biçim."""
    xs = [math.log(min(max(q, 1e-6), 1 - 1e-6) / (1 - min(max(q, 1e-6), 1 - 1e-6))) for q in ps]
    a, b = 0.0, 1.0
    for _ in range(iters):
        g0 = g1 = h00 = h01 = h11 = 0.0
        for x, y in zip(xs, ys):
            mu = 1 / (1 + math.exp(-(a + b * x)))
            w = mu * (1 - mu)
            g0 += mu - y; g1 += (mu - y) * x
            h00 += w; h01 += w * x; h11 += w * x * x
        det = h00 * h11 - h01 * h01
        if abs(det) < 1e-12:
            break
        a -= (h11 * g0 - h01 * g1) / det
        b -= (h00 * g1 - h01 * g0) / det
    return a, b


def platt(q, ab):
    q = min(max(q, 1e-6), 1 - 1e-6)
    return 1 / (1 + math.exp(-(ab[0] + ab[1] * math.log(q / (1 - q)))))


def goal_probs(lg, m, dc, dynl_row):
    _p, _k, blh, bla, _h, brho = dc[lg][id(m)]
    mb, md = M.markets_from_lambdas(blh, bla, brho), M.markets_from_lambdas(*dynl_row[id(m)], RHO)
    over = 1.0 if m["fthg"] + m["ftag"] > 2.5 else 0.0
    btts = 1.0 if m["fthg"] > 0 and m["ftag"] > 0 else 0.0
    return {"ou_base": (mb["p_over25"], over), "ou_dyn": (md["p_over25"], over),
            "kg_base": (mb["p_btts_yes"], btts), "kg_dyn": (md["p_btts_yes"], btts)}


def load_dc(lg, top, path):
    key = lambda m: f"{m['date'].strftime('%Y%m%d')}|{m['home']}|{m['away']}"
    doc = {}
    if path and os.path.exists(path):
        with open(path, encoding="utf-8") as f:
            doc = json.load(f)
    if lg in doc:
        return {id(m): tuple(doc[lg][key(m)]) for m in top if key(m) in doc[lg]}
    dc = BO.dc_walk(top)
    if path:
        doc[lg] = {key(m): list(dc[id(m)]) for m in top if id(m) in dc}
        with open(path, "w", encoding="utf-8") as f:
            json.dump(doc, f)
    return dc


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--leagues", default="E0,SP1,I1,D1,F1")
    ap.add_argument("--end", type=int, default=2026)
    ap.add_argument("--out", default="/tmp/gate-dyn")
    ap.add_argument("--dc-cache", default="")
    ap.add_argument("--history-seasons", type=int, default=0, help="0 = bütün geçmiş; N = canlı depo derinliği")
    args = ap.parse_args()
    os.makedirs(args.out, exist_ok=True)
    leagues = args.leagues.split(",")
    hs = args.history_seasons

    top, second, dc, elo = {}, {}, {}, {}
    for lg in leagues:
        top[lg] = load_matches(lg, BO.ELO_START, args.end)
        second[lg] = load_matches(BO.PAIRS[lg], BO.ELO_START, args.end)
        dc[lg] = load_dc(lg, top[lg], args.dc_cache)
        pre = BO.elo_walk_short(top[lg], second[lg], ELO_K, hs) if hs else BO.elo_walk(top[lg], second[lg], ELO_K)
        a, b, total, _ = BO.fit_map(top[lg], pre)
        elo[lg] = {id(m): mix(dc[lg][id(m)][0], BO.elo_probs(pre[id(m)][0] - pre[id(m)][1], a, b, total), ELO_LAM)
                   for m in top[lg] if id(m) in dc[lg]}
        print(f"[load] {lg}: üst {len(top[lg])} / alt {len(second[lg])}, DC tahmini {len(dc[lg])}", flush=True)

    def rows(seasons_ok):
        for lg in leagues:
            for m in top[lg]:
                if seasons_ok(m["season"]) and id(m) in dc[lg]:
                    yield lg, m

    valid = list(rows(lambda s: s in BO.VALID))
    test = list(rows(lambda s: s >= BO.TEST_FROM))

    # 1) (κ, δ): yalnız dinamik modelin doğrulama log-loss'u
    dyn, dynl, grid = {}, {}, {}
    for kappa in KAPPA_GRID:
        for delta in DELTA_GRID:
            for lg in leagues:
                pre = dyn_walk_short(top[lg], second[lg], kappa, delta, hs) if hs else dyn_walk(top[lg], second[lg], kappa, delta)
                dyn[(lg, kappa, delta)] = {mid: probs(*v) for mid, v in pre.items()}
                dynl[(lg, kappa, delta)] = pre
            grid[(kappa, delta)] = sum(ll(dyn[(lg, kappa, delta)][id(m)], m["ftr"]) for lg, m in valid) / len(valid)
    print(f"\n[doğrulama] sezon {BO.VALID}, n={len(valid)} — yalnız dinamik model log-loss (satır κ, sütun δ)")
    print("          " + "".join(f"{d:>8.2f}" for d in DELTA_GRID))
    for kappa in KAPPA_GRID:
        print(f"  κ={kappa:<6}" + "".join(f"{grid[(kappa, d)]:>8.4f}" for d in DELTA_GRID))
    kb, db = min(grid, key=grid.get)
    base_v = sum(ll(dc[lg][id(m)][0], m["ftr"]) for lg, m in valid) / len(valid)
    elo_v = sum(ll(elo[lg][id(m)], m["ftr"]) for lg, m in valid) / len(valid)
    print(f"[doğrulama] seçilen κ={kb} δ={db} → {grid[(kb, db)]:.4f}   (DC {base_v:.4f}, DC+Elo {elo_v:.4f})")
    pd = lambda lg, m: dyn[(lg, kb, db)][id(m)]

    # 2) harman ağırlıkları (aynı doğrulama kümesi)
    w_dc = {w: sum(ll(mix(dc[lg][id(m)][0], pd(lg, m), w), m["ftr"]) for lg, m in valid) / len(valid) for w in W_GRID}
    w_el = {w: sum(ll(mix(elo[lg][id(m)], pd(lg, m), w), m["ftr"]) for lg, m in valid) / len(valid) for w in W_GRID}
    print("[doğrulama] w        " + "".join(f"{w:>8.1f}" for w in W_GRID))
    print("  DC ⊕ dinamik       " + "".join(f"{w_dc[w]:>8.4f}" for w in W_GRID))
    print("  (DC+Elo) ⊕ dinamik " + "".join(f"{w_el[w]:>8.4f}" for w in W_GRID))
    wd, we = min(w_dc, key=w_dc.get), min(w_el, key=w_el.get)
    print(f"[doğrulama] seçilen w: DC⊕dinamik {wd}, (DC+Elo)⊕dinamik {we}\n")

    # 3) test dışa aktarımı
    names = ("base", "dyn", "dcdyn", "elo", "elodyn")
    files = {n: open(os.path.join(args.out, f"{n}.jsonl"), "w", encoding="utf-8") for n in names}
    seg = defaultdict(lambda: [0] + [0.0] * len(names))
    # gol pazarları: Platt eğrisi yalnız doğrulama sezonlarında fit edilir (canlıdaki calib ile aynı biçim)
    vg = defaultdict(lambda: ([], []))
    for lg, m in valid:
        for key_, (q, y) in goal_probs(lg, m, dc, dynl[(lg, kb, db)]).items():
            vg[key_][0].append(q); vg[key_][1].append(y)
    cal = {k_: platt_fit(*v) for k_, v in vg.items()}
    goals = defaultdict(lambda: [0, 0.0, 0.0])
    for lg, m in test:
        p = {"base": dc[lg][id(m)][0], "dyn": pd(lg, m), "elo": elo[lg][id(m)]}
        p["dcdyn"] = mix(p["base"], p["dyn"], wd)
        p["elodyn"] = mix(p["elo"], p["dyn"], we)
        common = {"league": lg, "date": m["date"].strftime("%Y-%m-%d"), "home": m["home"], "away": m["away"],
                  "result": m["ftr"], "odds_home": m["odds_home"], "odds_draw": m["odds_draw"], "odds_away": m["odds_away"]}
        for n in names:
            files[n].write(json.dumps({**common, "p_home": p[n]["H"], "p_draw": p[n]["D"], "p_away": p[n]["A"]}, ensure_ascii=False) + "\n")
        for key_, (q, y) in goal_probs(lg, m, dc, dynl[(lg, kb, db)]).items():
            for tag, qq in (("ham", q), ("kalibre", platt(q, cal[key_]))):
                qq = min(max(qq, 1e-6), 1 - 1e-6)
                g = goals[(key_, tag)]
                g[0] += 1; g[1] += -(y * math.log(qq) + (1 - y) * math.log(1 - qq)); g[2] += (qq - y) ** 2
        month = m["date"].month
        labels = ["toplam", "ay: Ağu-Eyl" if month in (8, 9) else "ay: Eki-Ara" if month >= 10 else "ay: Oca-sezon sonu",
                  "DC iki takımı da tanıyor" if dc[lg][id(m)][1] else "DC en az bir takımı tanımıyor"]
        if m["odds_home"] and m["odds_draw"] and m["odds_away"]:
            inv = [1 / m["odds_home"], 1 / m["odds_draw"], 1 / m["odds_away"]]
            s = sum(inv)
            mk = {"H": inv[0] / s, "D": inv[1] / s, "A": inv[2] / s}
            gap = abs(p["base"]["H"] - mk["H"])
            labels.append("DC-piyasa farkı <5 puan" if gap < 0.05 else "DC-piyasa farkı 5-10 puan" if gap < 0.10 else "DC-piyasa farkı ≥10 puan")
            seg["piyasa (oranı olan maçlar)"][0] += 1
            seg["piyasa (oranı olan maçlar)"][1] += ll(mk, m["ftr"])
        for lab in labels:
            seg[lab][0] += 1
            for i, n in enumerate(names):
                seg[lab][i + 1] += ll(p[n], m["ftr"])
    for f in files.values():
        f.close()

    print(f"[test] n={len(test)} — log-loss")
    print(f"  {'dilim':<32}{'n':>6}" + "".join(f"{n:>9}" for n in names))
    for lab in sorted(seg):
        v = seg[lab]
        if lab.startswith("piyasa"):
            print(f"  {lab:<32}{v[0]:>6}{v[1] / v[0]:>9.4f}")
        else:
            print(f"  {lab:<32}{v[0]:>6}" + "".join(f"{x / v[0]:>9.4f}" for x in v[1:]))
    print("\n[gol pazarları] test — log-loss / Brier (kalibre: Platt, doğrulama sezonlarında fit)")
    for mk_, name in (("ou", "Ü/A 2,5"), ("kg", "KG Var")):
        for tag in ("ham", "kalibre"):
            gb, gd = goals[(mk_ + "_base", tag)], goals[(mk_ + "_dyn", tag)]
            n = gb[0]
            print(f"  {name:<8}{tag:<8} DC {gb[1] / n:.4f} / {gb[2] / n:.4f}   dinamik {gd[1] / n:.4f} / {gd[2] / n:.4f}   Δ {(gd[1] - gb[1]) / n:+.4f} / {(gd[2] - gb[2]) / n:+.4f}")
    print("  Platt (a, b): " + ", ".join(f"{k_} ({v[0]:+.3f}, {v[1]:.3f})" for k_, v in sorted(cal.items())))
    with open(os.path.join(args.out, "summary.json"), "w", encoding="utf-8") as f:
        json.dump({"history_seasons": hs, "kappa": kb, "delta": db, "w_dc": wd, "w_elo": we, "valid": BO.VALID,
                   "test_from": BO.TEST_FROM, "grid": {f"{k}|{d}": v for (k, d), v in grid.items()},
                   "w_dc_grid": w_dc, "w_elo_grid": w_el}, f, indent=1, ensure_ascii=False)
    print(f"\n[done] {args.out}/" + " ".join(f"{n}.jsonl" for n in names))


if __name__ == "__main__":
    main()
