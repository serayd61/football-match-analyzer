"""
Açılış fiyatında değer kuralı — "model adil fiyatı < bahisçinin erken fiyatı" bahisleri kâr eder mi?

Soru (2026-11-23): OddAlerts Alpha'nın yayınladığı yöntem (her maçı fiyatla, erken fiyat adil
fiyatın üstündeyse oyna, kuralı görülmemiş dönemde sına) bizim canlı gol-DC modelimizle çalışır mı?

Veri: football-data.co.uk, 9 lig, 2019-20 → 2025-26 (depodaki önbellek: engine/.cache/ffdata).
  "Açılış" sütunları (B365H, PSH, MaxH, B365>2.5 ...) maçtan günler önce toplanan erken fiyattır,
  bahisçinin ilk fiyatı değil. Kapanış: PSC* / PC>2.5 (Pinnacle), oransal de-vig.
Model: canlı dc-1.0 eşdeğeri (model.fit, 540 g pencere, 180 g yarı-ömür), walk-forward.
Kurallar (1 birim düz bahis, yakalanan erken fiyattan sonuçlanır):
  model : p_model · oran − 1 ≥ t
  keskin: p_Pinnacle-erken(de-vig) · oran − 1 ≥ s        (model kullanılmaz; kontrol)
  ikisi : model ≥ t  VE  keskin ≥ s
Seçim yalnız SEÇİM sezonlarında (n ≥ MIN_N, en yüksek ROI); TEST sezonlarında tarama yok.

  ENGINE_CACHE=engine/.cache/ffdata python3 engine/backtest_openvalue.py --dc-cache /tmp/ov-dc.json
"""
import argparse
import csv
import io
import json
import os
import random
from collections import defaultdict

import data as D
import model as M

LEAGUES = "E0,SP1,I1,D1,F1,N1,P1,E1,T1"
SELECT = ("2021", "2122")          # kural seçimi
TEST_FROM = "2223"                 # görülmemiş dönem
MIN_N = 300
T_GRID = (0.02, 0.05, 0.08, 0.12, 0.20)
S_GRID = (-0.02, 0.0, 0.02)
CAPS = (99.0, 5.0, 3.0)
BOOKS = ("B365", "Max")
GROUPS = {"1X2": ("H", "D", "A"), "OU": ("O", "U"), "hepsi": ("H", "D", "A", "O", "U")}
COL = {  # seçim -> (erken fiyat sütunu şablonu, Pinnacle erken, Pinnacle kapanış)
    "H": ("{b}H", "PSH", "PSCH"), "D": ("{b}D", "PSD", "PSCD"), "A": ("{b}A", "PSA", "PSCA"),
    "O": ("{b}>2.5", "P>2.5", "PC>2.5"), "U": ("{b}<2.5", "P<2.5", "PC<2.5"),
}


def load(league, start, end):
    out = []
    for season in D.season_codes(start, end):
        try:
            raw = D._download(league, season)
        except Exception as e:  # noqa: BLE001
            print(f"  [data] {league} {season} yok: {e}")
            continue
        for row in csv.DictReader(io.StringIO(raw)):
            row = {(k.lstrip("﻿") if k else k): v for k, v in row.items()}
            d = D._parse_date(row.get("Date", ""))
            try:
                fh, fa = int(float(row.get("FTHG") or "x")), int(float(row.get("FTAG") or "x"))
            except ValueError:
                continue
            if d is None:
                continue
            out.append({"date": d, "season": season, "home": (row.get("HomeTeam") or "").strip(),
                        "away": (row.get("AwayTeam") or "").strip(), "fthg": fh, "ftag": fa,
                        "ftr": (row.get("FTR") or "").strip(), "row": row})
    out.sort(key=lambda m: m["date"])
    return out


def dc_walk(lg, ms, path):
    key = lambda m: f"{m['date'].strftime('%Y%m%d')}|{m['home']}|{m['away']}"
    doc = {}
    if path and os.path.exists(path):
        with open(path, encoding="utf-8") as f:
            doc = json.load(f)
    if lg not in doc:
        cache, res = {}, {}
        for m in ms:
            if m["season"] < SELECT[0] or m["ftr"] not in ("H", "D", "A"):
                continue
            k = m["date"].toordinal()
            if k not in cache:
                cache[k] = M.fit(ms, m["date"], half_life_days=180, window_days=540)
            mdl = cache[k]
            pr = M.predict(mdl, m["home"], m["away"]) if mdl is not None else None
            if pr is not None and m["home"] in mdl["A"] and m["away"] in mdl["A"]:
                res[key(m)] = [pr["p_home"], pr["p_draw"], pr["p_away"], pr["p_over25"]]
        doc[lg] = res
        if path:
            with open(path, "w", encoding="utf-8") as f:
                json.dump(doc, f)
    return {id(m): doc[lg][key(m)] for m in ms if key(m) in doc[lg]}


def devig(odds):
    inv = [1.0 / o for o in odds]
    s = sum(inv)
    return [x / s for x in inv]


def candidates(lg, m, p):
    """Maçın her seçimi için: model olasılığı, erken fiyatlar, keskin erken/kapanış adil olasılığı, sonuç."""
    r = m["row"]
    pm = {"H": p[0], "D": p[1], "A": p[2], "O": p[3], "U": 1.0 - p[3]}
    won = {"H": m["ftr"] == "H", "D": m["ftr"] == "D", "A": m["ftr"] == "A",
           "O": m["fthg"] + m["ftag"] > 2.5, "U": m["fthg"] + m["ftag"] < 2.5}
    fair_open, fair_close = {}, {}
    for sels in (("H", "D", "A"), ("O", "U")):
        for dst, idx in ((fair_open, 1), (fair_close, 2)):
            o = [D._f(r, COL[s][idx]) for s in sels]
            if all(x and x > 1.0 for x in o):
                dst.update(zip(sels, devig(o)))
    out = []
    for s in pm:
        for b in BOOKS:
            o = D._f(r, COL[s][0].format(b=b))
            if not o or o <= 1.0 or s not in fair_open:
                continue
            out.append({"lg": lg, "season": m["season"], "sel": s, "book": b, "odds": o, "won": won[s],
                        "ev_m": pm[s] * o - 1.0, "ev_s": fair_open[s] * o - 1.0,
                        "clv": (fair_close[s] * o - 1.0) if s in fair_close else None})
    return out


def rules():
    for b in BOOKS:
        for g in GROUPS:
            for cap in CAPS:
                for t in T_GRID:
                    yield ("model", b, g, cap, t, None)
                for s in S_GRID:
                    yield ("keskin", b, g, cap, None, s)
                for t in T_GRID:
                    for s in S_GRID:
                        yield ("ikisi", b, g, cap, t, s)


def picks(rule, cands):
    kind, b, g, cap, t, s = rule
    sels = GROUPS[g]
    return [c for c in cands if c["book"] == b and c["sel"] in sels and c["odds"] <= cap
            and (t is None or c["ev_m"] >= t) and (s is None or c["ev_s"] >= s)]


def stat(ps):
    n = len(ps)
    if not n:
        return {"n": 0, "roi": 0.0, "pl": 0.0}
    pl = sum((c["odds"] - 1.0) if c["won"] else -1.0 for c in ps)
    cl = [c["clv"] for c in ps if c["clv"] is not None]
    return {"n": n, "pl": pl, "roi": 100.0 * pl / n, "hit": 100.0 * sum(c["won"] for c in ps) / n,
            "avg": sum(c["odds"] for c in ps) / n,
            "clv": 100.0 * sum(cl) / len(cl) if cl else None,
            "beat": 100.0 * sum(x > 0 for x in cl) / len(cl) if cl else None}


def boot(ps, iters=2000, seed=7):
    rnd, n = random.Random(seed), len(ps)
    pls = [(c["odds"] - 1.0) if c["won"] else -1.0 for c in ps]
    out = sorted(100.0 * sum(pls[rnd.randrange(n)] for _ in range(n)) / n for _ in range(iters))
    return out[int(0.025 * iters)], out[int(0.975 * iters)]


def name(rule):
    kind, b, g, cap, t, s = rule
    parts = [kind, b, g, "oran≤%.0f" % cap if cap < 99 else "oran serbest"]
    if t is not None:
        parts.append("model≥%+.0f%%" % (100 * t))
    if s is not None:
        parts.append("keskin≥%+.0f%%" % (100 * s))
    return " · ".join(parts)


def line(tag, st):
    if not st["n"]:
        return f"  {tag:<12} n=0"
    clv = "    —" if st["clv"] is None else f"{st['clv']:+5.1f}%"
    beat = "  —" if st["beat"] is None else f"{st['beat']:3.0f}%"
    return (f"  {tag:<12} n={st['n']:>5}  ROI {st['roi']:+6.2f}%  K/Z {st['pl']:+8.1f}u  isabet {st['hit']:4.1f}%"
            f"  ort. oran {st['avg']:.2f}  kapanışa karşı {clv}  kapanışı geçen {beat}")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--leagues", default=LEAGUES)
    ap.add_argument("--start", type=int, default=2019)
    ap.add_argument("--end", type=int, default=2025)
    ap.add_argument("--dc-cache", default="")
    ap.add_argument("--out", default="")
    args = ap.parse_args()

    cands = []
    for lg in args.leagues.split(","):
        ms = load(lg, args.start, args.end)
        dc = dc_walk(lg, ms, args.dc_cache)
        got = [c for m in ms if id(m) in dc for c in candidates(lg, m, dc[id(m)])]
        cands += got
        print(f"[load] {lg}: {len(ms)} maç, DC tahmini {len(dc)}, aday seçim {len(got)}", flush=True)
    sel = [c for c in cands if c["season"] in SELECT]
    test = [c for c in cands if c["season"] >= TEST_FROM]
    print(f"\nseçim sezonları {SELECT}: {len(sel)} aday · test {TEST_FROM}+: {len(test)} aday")

    print("\n== Taban: kuralsız, her seçime 1 birim (test) ==")
    for b in BOOKS:
        for g in ("1X2", "OU"):
            print(line(f"{b} {g}", stat([c for c in test if c["book"] == b and c["sel"] in GROUPS[g]])))

    table = []
    for r in rules():
        a, z = stat(picks(r, sel)), stat(picks(r, test))
        table.append((r, a, z))
    ok = [x for x in table if x[1]["n"] >= MIN_N]
    print(f"\n== Izgara: {len(table)} kural, seçimde n≥{MIN_N} olan {len(ok)} ==")
    for kind in ("model", "keskin", "ikisi"):
        for b in BOOKS:
            sub = [x for x in ok if x[0][0] == kind and x[0][1] == b and x[2]["n"] >= 100]
            if sub:
                pos_s = sum(x[1]["roi"] > 0 for x in sub)
                pos_t = sum(x[2]["roi"] > 0 for x in sub)
                med = sorted(x[2]["roi"] for x in sub)[len(sub) // 2]
                print(f"  {kind:<7}{b:<5} {len(sub):>3} kural · seçimde artı {pos_s:>3} · testte artı {pos_t:>3} · test ROI ortanca {med:+.2f}%")

    print("\n== Seçimde en iyi kural (tür × bahisçi) → test ==")
    chosen = {}
    for kind in ("model", "keskin", "ikisi"):
        for b in BOOKS:
            sub = [x for x in ok if x[0][0] == kind and x[0][1] == b]
            if not sub:
                continue
            r, a, z = max(sub, key=lambda x: x[1]["roi"])
            chosen[(kind, b)] = r
            print(f"\n{name(r)}")
            print(line("seçim", a))
            print(line("test", z))
            tp = picks(r, test)
            if len(tp) >= 50:
                lo, hi = boot(tp)
                print(f"  test ROI %95 aralığı [{lo:+.2f}%, {hi:+.2f}%]")
                by = defaultdict(list)
                for c in tp:
                    by[c["season"]].append(c)
                print("  sezon: " + "  ".join(f"{s} {stat(v)['roi']:+.1f}% (n={len(v)})" for s, v in sorted(by.items())))
                by = defaultdict(list)
                for c in tp:
                    by[c["sel"]].append(c)
                print("  seçim: " + "  ".join(f"{s} {stat(v)['roi']:+.1f}% (n={len(v)})" for s, v in sorted(by.items())))
                by = defaultdict(list)
                for c in tp:
                    by[c["lg"]].append(c)
                print("  lig:   " + "  ".join(f"{s} {stat(v)['roi']:+.1f}% (n={len(v)})" for s, v in sorted(by.items())))

    print("\n== Model kuralı, eşik başına (seçim taranmadan; oran serbest, hepsi) — test ==")
    for b in BOOKS:
        for t in T_GRID:
            print(line(f"{b} ≥{100 * t:.0f}%", stat(picks(("model", b, "hepsi", 99.0, t, None), test))))
    print("\n== Model, piyasayla aynı fikirdeyken / ayrışırken (B365, model≥5%) — test ==")
    base = picks(("model", "B365", "hepsi", 99.0, 0.05, None), test)
    for lab, f in (("keskin<−5%", lambda c: c["ev_s"] < -0.05), ("−5…−2%", lambda c: -0.05 <= c["ev_s"] < -0.02),
                   ("−2…0%", lambda c: -0.02 <= c["ev_s"] < 0), ("keskin≥0%", lambda c: c["ev_s"] >= 0)):
        print(line(lab, stat([c for c in base if f(c)])))

    if args.out:
        with open(args.out, "w", encoding="utf-8") as f:
            json.dump([{"rule": name(r), "select": a, "test": z} for r, a, z in table], f, ensure_ascii=False, indent=1)
        print(f"\n[done] {args.out}")


if __name__ == "__main__":
    main()
