"""
Kadro piyasa değeri (Transfermarkt) — DC, DC+Elo ve dinamik modelin üstüne bilgi katar mı?

Veri: dcaribou/transfermarkt-datasets (CC0) — player_valuations, appearances, games (.csv.gz).
Yalnız ÇEVRİMDIŞI ölçüm; depoya ve siteye girmez. İndirilen klasör --tm-dir ile verilir.

Maç öncesi kadro değeri (sızıntısız):
    kadro  = kulüp adına son N günde (maç gününden ÖNCE) forma giymiş oyuncular
    değer  = her oyuncunun maç gününden ÖNCEki son Transfermarkt değeri
    V      = en değerli 18 oyuncunun toplamı  |  dakika ağırlıklı ortalama   (doğrulamada seçilir)
    x      = ln V_ev − ln V_dep
x → 1X2: gol farkı ~ a·x + b (yalnız FIT sezonları), sonra aynı Poisson + DC(ρ) (Elo ile aynı yol).
Harman: p = (1 − w)·p_ref + w·p_değer; w doğrulama sezonlarında seçilir, testte tarama yok.
Kadro kurulamayan maçta (yeni çıkan takımın geçmişi yok) aday = referans (w = 0).

  python3 engine/backtest_value.py --tm-dir /path/tm-data --out /tmp/gate-value --dc-cache /tmp/dc-cache.json
"""
import argparse
import bisect
import csv
import gzip
import json
import math
import os
from collections import Counter, defaultdict
from datetime import datetime, timedelta

from data import load_matches
import backtest_ownelo as BO
import backtest_dynamic as BD

OUT = ("H", "D", "A")
TM_COMP = {"E0": "GB1", "SP1": "ES1", "I1": "IT1", "D1": "L1", "F1": "FR1"}
WINDOWS = (120, 365)
AGGS = ("top18", "minw")
W_GRID = (0.0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1.0)
MIN_PLAYERS = 11
DYN_KAPPA, DYN_DELTA = 0.015, 0.25   # reports/backtest-dynamic-strength.md (yeniden taranmaz)


def rows(path):
    with gzip.open(path, "rt", encoding="utf-8", newline="") as f:
        yield from csv.DictReader(f)


def day(s):
    return datetime.strptime(s[:10], "%Y-%m-%d")


def load_tm(tm_dir):
    games = defaultdict(list)   # (comp, tarih, ev gol, dep gol) -> [(ev id, dep id)]
    for r in rows(os.path.join(tm_dir, "games.csv.gz")):
        if r["competition_id"] in TM_COMP.values() and r["home_club_goals"] != "" and r["away_club_goals"] != "":
            games[(r["competition_id"], r["date"][:10], int(r["home_club_goals"]), int(r["away_club_goals"]))].append(
                (r["home_club_id"], r["away_club_id"]))
    vals = defaultdict(list)    # oyuncu -> [(tarih, değer)]
    for r in rows(os.path.join(tm_dir, "player_valuations.csv.gz")):
        if r["market_value_in_eur"]:
            vals[r["player_id"]].append((day(r["date"]), float(r["market_value_in_eur"])))
    for v in vals.values():
        v.sort()
    apps = defaultdict(list)    # kulüp -> [(tarih, oyuncu, dakika)]
    for r in rows(os.path.join(tm_dir, "appearances.csv.gz")):
        if r["date"]:
            apps[r["player_club_id"]].append((day(r["date"]), r["player_id"], float(r["minutes_played"] or 0)))
    for a in apps.values():
        a.sort()
    return games, vals, apps


def club_map(lg, matches, games):
    """football-data takım adı → Transfermarkt kulüp id; aynı gün + aynı skor eşleşmelerinin çoğunluğu."""
    votes = defaultdict(Counter)
    for m in matches:
        for delta in (0, -1, 1):
            cands = games.get((TM_COMP[lg], (m["date"] + timedelta(days=delta)).strftime("%Y-%m-%d"), m["fthg"], m["ftag"]), [])
            if len(cands) == 1:
                votes[m["home"]][cands[0][0]] += 1
                votes[m["away"]][cands[0][1]] += 1
                break
    out = {}
    for name, c in votes.items():
        (cid, n), tot = c.most_common(1)[0], sum(c.values())
        if n >= 5 and n / tot >= 0.8:
            out[name] = cid
    return out


class Squad:
    def __init__(self, vals, apps):
        self.vals, self.apps = vals, apps
        self.dates = {c: [a[0] for a in rows_] for c, rows_ in apps.items()}
        self.vdates = {p: [v[0] for v in rows_] for p, rows_ in vals.items()}

    def value(self, club, when, window, agg):
        rows_ = self.apps.get(club)
        if not rows_:
            return None
        ds = self.dates[club]
        lo, hi = bisect.bisect_left(ds, when - timedelta(days=window)), bisect.bisect_left(ds, when)
        mins = defaultdict(float)
        for _, pid, mn in rows_[lo:hi]:
            mins[pid] += mn
        got = []
        for pid, mn in mins.items():
            vd = self.vdates.get(pid)
            if not vd:
                continue
            i = bisect.bisect_left(vd, when) - 1      # maç gününden ÖNCEki son değer
            if i >= 0:
                got.append((self.vals[pid][i][1], mn))
        if len(got) < MIN_PLAYERS:
            return None
        if agg == "top18":
            return sum(sorted((v for v, _ in got), reverse=True)[:18])
        tot = sum(mn for _, mn in got)
        return sum(v * mn for v, mn in got) / tot if tot > 0 else None


def fit_line(xs, ys):
    n = len(xs)
    mx, my = sum(xs) / n, sum(ys) / n
    var = sum((x - mx) ** 2 for x in xs) / n
    a = sum((x - mx) * (y - my) for x, y in zip(xs, ys)) / n / var
    return a, my - a * mx


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--tm-dir", required=True)
    ap.add_argument("--leagues", default="E0,SP1,I1,D1,F1")
    ap.add_argument("--end", type=int, default=2026)
    ap.add_argument("--out", default="/tmp/gate-value")
    ap.add_argument("--dc-cache", default="")
    args = ap.parse_args()
    os.makedirs(args.out, exist_ok=True)
    leagues = args.leagues.split(",")

    games, vals, apps = load_tm(args.tm_dir)
    squad = Squad(vals, apps)
    last_app = max(a[-1][0] for a in apps.values())
    print(f"[tm] {len(vals)} oyuncunun değeri, {len(apps)} kulübün forma kaydı, son kayıt {last_app.date()}", flush=True)

    top, ref, cmap = {}, {}, {}
    for lg in leagues:
        top[lg] = load_matches(lg, BO.ELO_START, args.end)
        second = load_matches(BO.PAIRS[lg], BO.ELO_START, args.end)
        dc = BD.load_dc(lg, top[lg], args.dc_cache)
        pre = BO.elo_walk(top[lg], second, BD.ELO_K)
        a, b, total, _ = BO.fit_map(top[lg], pre)
        dyn = BD.dyn_walk(top[lg], second, DYN_KAPPA, DYN_DELTA)
        ref[lg] = {}
        for m in top[lg]:
            if id(m) in dc:
                p_dc = dc[id(m)][0]
                ref[lg][id(m)] = {"dc": p_dc,
                                  "elo": BD.mix(p_dc, BO.elo_probs(pre[id(m)][0] - pre[id(m)][1], a, b, total), BD.ELO_LAM),
                                  "dyn": BD.probs(*dyn[id(m)])}
        cmap[lg] = club_map(lg, top[lg], games)
        names = {t for m in top[lg] for t in (m["home"], m["away"])}
        print(f"[load] {lg}: {len(top[lg])} maç, takım eşleme {len(cmap[lg])}/{len(names)}"
              + (f" — eşleşmeyen: {sorted(names - set(cmap[lg]))}" if names - set(cmap[lg]) else ""), flush=True)

    def feature(lg, m, window, agg):
        h, a = cmap[lg].get(m["home"]), cmap[lg].get(m["away"])
        if not h or not a or m["date"] > last_app + timedelta(days=45):
            return None
        vh, va = squad.value(h, m["date"], window, agg), squad.value(a, m["date"], window, agg)
        return None if not vh or not va else math.log(vh) - math.log(va)

    def sel(ok):
        return [(lg, m) for lg in leagues for m in top[lg] if ok(m["season"]) and id(m) in ref[lg]]

    fit = [(lg, m) for lg in leagues for m in top[lg] if "1516" <= m["season"] < BO.FIT_BEFORE]
    valid, test = sel(lambda s: s in BO.VALID), sel(lambda s: s >= BO.TEST_FROM)

    # 1) pencere + toplama biçimi: yalnız değer modelinin doğrulama log-loss'u (özelliği olan maçlarda)
    setups = {}
    print(f"\n[doğrulama] sezon {BO.VALID}, n={len(valid)} — yalnız değer modeli")
    for window in WINDOWS:
        for agg in AGGS:
            feat = {id(m): feature(lg, m, window, agg) for lg, m in fit + valid + test}
            xs = [feat[id(m)] for _, m in fit if feat[id(m)] is not None]
            ys = [m["fthg"] - m["ftag"] for _, m in fit if feat[id(m)] is not None]
            tg = [m["fthg"] + m["ftag"] for _, m in fit if feat[id(m)] is not None]
            a, b = fit_line(xs, ys)
            total = sum(tg) / len(tg)
            pv = {k: BO.elo_probs(x, a, b, total) for k, x in feat.items() if x is not None}
            have = [(lg, m) for lg, m in valid if id(m) in pv]
            llv = sum(BD.ll(pv[id(m)], m["ftr"]) for _, m in have) / len(have)
            lld = sum(BD.ll(ref[lg][id(m)]["dc"], m["ftr"]) for lg, m in have) / len(have)
            setups[(window, agg)] = (llv, pv, a, b, total, len(xs))
            print(f"  pencere {window:>3} gün, {agg:<6}: değer {llv:.4f}  (aynı maçlarda DC {lld:.4f}; kapsam {len(have)}/{len(valid)}; a={a:.3f} gol/ln-oran, fit n={len(xs)})")
    (window, agg) = min(setups, key=lambda k: setups[k][0])
    _, pv, a, b, total, nfit = setups[(window, agg)]
    print(f"[doğrulama] seçilen: pencere {window} gün, {agg}")

    # 2) harman ağırlığı — her referans için ayrı
    def cand(lg, m, r, w):
        p = ref[lg][id(m)][r]
        return BD.mix(p, pv[id(m)], w) if id(m) in pv else p

    w_best = {}
    print("[doğrulama] w             " + "".join(f"{w:>8.1f}" for w in W_GRID))
    for r in ("dc", "elo", "dyn"):
        g = {w: sum(BD.ll(cand(lg, m, r, w), m["ftr"]) for lg, m in valid) / len(valid) for w in W_GRID}
        w_best[r] = min(g, key=g.get)
        print(f"  {r:<4} ⊕ değer          " + "".join(f"{g[w]:>8.4f}" for w in W_GRID) + f"   → w={w_best[r]}")

    # 3) test
    names = ("dc", "dc_val", "elo", "elo_val", "dyn", "dyn_val")
    files = {n: open(os.path.join(args.out, f"{n}.jsonl"), "w", encoding="utf-8") for n in names}
    seg = defaultdict(lambda: [0] + [0.0] * len(names))
    for lg, m in test:
        p = {}
        for r in ("dc", "elo", "dyn"):
            p[r] = ref[lg][id(m)][r]
            p[r + "_val"] = cand(lg, m, r, w_best[r])
        common = {"league": lg, "date": m["date"].strftime("%Y-%m-%d"), "home": m["home"], "away": m["away"],
                  "result": m["ftr"], "odds_home": m["odds_home"], "odds_draw": m["odds_draw"], "odds_away": m["odds_away"]}
        for n in names:
            files[n].write(json.dumps({**common, "p_home": p[n]["H"], "p_draw": p[n]["D"], "p_away": p[n]["A"]}, ensure_ascii=False) + "\n")
        month = m["date"].month
        labels = ["toplam", "değer var" if id(m) in pv else "değer yok (aday = referans)",
                  "ay: Ağu-Eyl" if month in (8, 9) else "ay: Eki-Ara" if month >= 10 else "ay: Oca-sezon sonu", "sezon " + m["season"]]
        for lab in labels:
            seg[lab][0] += 1
            for i, n in enumerate(names):
                seg[lab][i + 1] += BD.ll(p[n], m["ftr"])
    for f in files.values():
        f.close()
    print(f"\n[test] n={len(test)} — log-loss")
    print(f"  {'dilim':<30}{'n':>6}" + "".join(f"{n:>9}" for n in names))
    for lab in sorted(seg):
        v = seg[lab]
        print(f"  {lab:<30}{v[0]:>6}" + "".join(f"{x / v[0]:>9.4f}" for x in v[1:]))
    with open(os.path.join(args.out, "summary.json"), "w", encoding="utf-8") as f:
        json.dump({"window": window, "agg": agg, "a": a, "b": b, "total": total, "fit_n": nfit, "w": w_best,
                   "valid": BO.VALID, "test_from": BO.TEST_FROM}, f, indent=1)
    print(f"\n[done] {args.out}/" + " ".join(f"{n}.jsonl" for n in names))


if __name__ == "__main__":
    main()
