"""
Kupa havuzu geriye dönük testi (2026-11-04). Avrupa kupalarında (ŞL/AL/Konferans) kupa-tek fit ile
havuzlu fit'i (katılımcıların lig maçları, düşük ağırlık) karşılaştırır. Yürüyen pencere: her maç
gününde o günden ÖNCEKİ maçlarla fit, o günün maçları tahmin edilir (sızıntı yok).

Kullanım (Hetzner, salt-okunur):
  STORE_PATH=/var/lib/footy/results.jsonl LEAGUE_ALIASES=943230:904988,... \
    python3 backtest_cups.py --cups 904988,73,10216 --from 2025-10-01 --to 2026-06-01 \
    --variants league,teams:0.5,teams:0.75,teams:1.0,leagues:0.6
Çıktı: kupa × varyant tablosu — kapsam (takım kapısı 6 ile tahmin edilen oran), isabet, log-loss,
Brier, Üst 2,5 isabet; ayrıca sabit taban (eğitim kümesindeki 1/X/2 sıklığı).
"""
import argparse
import math
import os
import sys
from collections import defaultdict
from datetime import datetime

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import model as M  # noqa: E402
from store import ResultStore  # noqa: E402

FIT = dict(half_life_days=180, window_days=540, iters=25, min_matches=120, rho=-0.1, shrink_k=0.0)
MIN_TEAM = 6.0


def outcome(m):
    return "1" if m["fthg"] > m["ftag"] else "2" if m["fthg"] < m["ftag"] else "X"


def parse_variant(v):
    if v == "league":
        return ("league", None, None)
    scope, w = v.split(":")
    return (scope, float(w), scope)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--cups", default="904988,73,10216")
    ap.add_argument("--from", dest="d_from", default="2025-10-01")
    ap.add_argument("--to", dest="d_to", default="2026-06-01")
    ap.add_argument("--variants", default="league,teams:0.5,teams:0.75,teams:1.0,leagues:0.6")
    ap.add_argument("--team-days", type=int, default=400)
    args = ap.parse_args()
    d_from, d_to = datetime.fromisoformat(args.d_from), datetime.fromisoformat(args.d_to)
    variants = [parse_variant(v) for v in args.variants.split(",")]
    st = ResultStore()

    for cup in [int(x) for x in args.cups.split(",")]:
        cup_rows = [m for m in st.load_for_fit(cup) if d_from <= m["date"] < d_to]
        by_day = defaultdict(list)
        for m in cup_rows:
            by_day[m["date"].date()].append(m)
        days = sorted(by_day)
        print(f"\n=== kupa {cup}: {len(cup_rows)} maç, {len(days)} maç günü ({args.d_from}..{args.d_to})")
        stats = {v: dict(n=0, hit=0, ll=0.0, br=0.0, ou_n=0, ou_hit=0, base_ll=0.0) for v in variants}
        stats["_total"] = len(cup_rows)
        for day in days:
            ref = datetime(day.year, day.month, day.day)
            for v in variants:
                scope, w, _ = v
                if scope == "league":
                    train = st.load_for_fit(cup)
                else:
                    train = st.load_pool_for_fit(cup, ref, team_days=args.team_days, domestic_w=w, scope=scope)
                mdl = M.fit(train, ref, **FIT)
                if mdl is None:
                    continue
                # taban: eğitim kümesindeki (kupa maçları) sonuç sıklığı
                tr = [m for m in train if m["date"] < ref and m.get("w", 1.0) == 1.0]
                cnt = {"1": 1.0, "X": 1.0, "2": 1.0}
                for m in tr:
                    cnt[outcome(m)] += 1
                tot = sum(cnt.values())
                base = {k: c / tot for k, c in cnt.items()}
                s = stats[v]
                for m in by_day[day]:
                    h, a = m["home"], m["away"]
                    if h not in mdl["teams"] or a not in mdl["teams"]:
                        continue
                    ne = mdl["n_eff"]
                    if min(ne.get(h, 0.0), ne.get(a, 0.0)) < MIN_TEAM:
                        continue
                    pr = M.predict(mdl, h, a)
                    p = {"1": pr["p_home"], "X": pr["p_draw"], "2": pr["p_away"]}
                    y = outcome(m)
                    pick = max(p, key=p.get)
                    s["n"] += 1
                    s["hit"] += int(pick == y)
                    s["ll"] += -math.log(max(p[y], 1e-9))
                    s["base_ll"] += -math.log(max(base[y], 1e-9))
                    s["br"] += sum((p[k] - (1.0 if k == y else 0.0)) ** 2 for k in p)
                    over = (m["fthg"] + m["ftag"]) > 2.5
                    s["ou_n"] += 1
                    s["ou_hit"] += int((pr["p_over25"] >= 0.5) == over)
        print(f"{'varyant':<14}{'kapsam':>12}{'isabet':>9}{'logloss':>9}{'taban ll':>10}{'brier':>8}{'Ü2,5':>7}")
        for v in variants:
            s = stats[v]
            if s["n"] == 0:
                print(f"{v[0]+('' if v[1] is None else ':'+str(v[1])):<14}{'0/'+str(stats['_total']):>12}")
                continue
            name = v[0] + ("" if v[1] is None else f":{v[1]}")
            print(f"{name:<14}{str(s['n'])+'/'+str(stats['_total']):>12}{s['hit']/s['n']:>9.3f}{s['ll']/s['n']:>9.4f}"
                  f"{s['base_ll']/s['n']:>10.4f}{s['br']/s['n']:>8.4f}{s['ou_hit']/max(1,s['ou_n']):>7.3f}")


if __name__ == "__main__":
    main()
