"""
Kapı ölçümü için tahmin dışa aktarımı (fa-prediction-lab / gate.py formatı).

Aynı maç kümesi, aynı sıra, üç aday:
  base   = gol-DC        (model_xg.fit, xg_weight=0)  → canlı dc-1.0'ın backtest eşdeğeri
  xg     = xG-DC         (xg_weight=0.75)
  xgelo  = xG-DC + Elo   (λ lig-başı, publish_elo.ELO_MAP)
Her aday için JSONL: {"league","date","home","away","p_home","p_draw","p_away","result",
"odds_home","odds_draw","odds_away"} — bahis oranları kapanış (PSC>PS>B365).

Elo→gol katsayıları (a,b,total) test-öncesi sezonlardan fit edilir (backtest_elo.fit_elo_map);
Elo yoksa o maçta saf xG-DC (kapsam raporlanır). Sızıntı: fit yalnız ref_date öncesi;
Elo snapshot maçtan önceki Pazartesi.

  SOCCERDATA_DIR=/tmp/soccerdata ../src/lib/data-sources/venv/bin/python export_preds.py \
      --leagues E0,SP1,I1,D1,F1 --start 2019 --end 2024 --out /tmp/gate
"""
import argparse
import json
import os
import sys

from features import load_features
import features_elo as FE
import model_xg as MX
import backtest_elo as BE

TEST_FROM = "2122"
XG_WEIGHT = 0.75
# publish_elo.ELO_MAP ile aynı λ (FD kodu anahtarlı)
LAMBDA = {"E0": 0.15, "SP1": 0.30, "I1": 0.30, "D1": 0.40, "F1": 0.40}


def walk(recs, league, grid, snaps, elo_fit):
    """Her test maçı için (base, xg, xgelo) olasılıkları."""
    cache = {0.0: {}, XG_WEIGHT: {}}

    def gm(ref, w):
        k = ref.toordinal()
        if k not in cache[w]:
            cache[w][k] = MX.fit(recs, ref, xg_weight=w, half_life_days=180, window_days=540)
        return cache[w][k]

    country = FE.CC[league]
    lam = LAMBDA[league]
    rows = {"base": [], "xg": [], "xgelo": []}
    elo_hits = 0
    for m in recs:
        if m["season"] < TEST_FROM or m["ftr"] not in ("H", "D", "A"):
            continue
        mb = gm(m["date"], 0.0)
        mx = gm(m["date"], XG_WEIGHT)
        if mb is None or mx is None:
            continue
        pb = MX.predict(mb, m["home"], m["away"])
        px = MX.predict(mx, m["home"], m["away"])
        if pb is None or px is None:
            continue
        p_base = {"H": pb["p_home"], "D": pb["p_draw"], "A": pb["p_away"]}
        p_xg = {"H": px["p_home"], "D": px["p_draw"], "A": px["p_away"]}
        p_xe = dict(p_xg)
        if elo_fit and grid:
            a, b, total, _ = elo_fit
            eh = FE.elo_of(grid, snaps, country, m["home"], m["date"])
            ea = FE.elo_of(grid, snaps, country, m["away"], m["date"])
            if eh is not None and ea is not None:
                pe = BE.elo_probs(eh - ea, a, b, total)
                p_xe = {o: (1 - lam) * p_xg[o] + lam * pe[o] for o in ("H", "D", "A")}
                elo_hits += 1
        common = {"league": league, "date": m["date"].strftime("%Y-%m-%d"), "home": m["home"], "away": m["away"],
                  "result": m["ftr"], "odds_home": m["odds_home"], "odds_draw": m["odds_draw"], "odds_away": m["odds_away"]}
        for key, p in (("base", p_base), ("xg", p_xg), ("xgelo", p_xe)):
            rows[key].append({**common, "p_home": p["H"], "p_draw": p["D"], "p_away": p["A"]})
    return rows, elo_hits


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--leagues", default="E0,SP1,I1,D1,F1")
    ap.add_argument("--start", type=int, default=2019)
    ap.add_argument("--end", type=int, default=2024)
    ap.add_argument("--out", default="/tmp/gate")
    ap.add_argument("--no-elo", action="store_true")
    args = ap.parse_args()
    os.makedirs(args.out, exist_ok=True)
    leagues = args.leagues.split(",")

    data = {}
    for lg in leagues:
        recs, st = load_features(lg, args.start, args.end, verbose=True)
        data[lg] = recs
        print(f"[load] {lg}: {len(recs)} maç, xG kapsama %{st.get('coverage_pct')}", flush=True)

    grid = snaps = None
    if not args.no_elo:
        alldates = [m["date"] for lg in leagues for m in data[lg]]
        print("[elo] snapshot kuruluyor...", flush=True)
        grid, snaps = FE.build_snapshots(alldates, verbose=True)

    files = {k: open(os.path.join(args.out, f"{k}.jsonl"), "w", encoding="utf-8") for k in ("base", "xg", "xgelo")}
    summary = []
    for lg in leagues:
        recs = data[lg]
        elo_fit = BE.fit_elo_map(recs, grid, snaps, FE.CC[lg]) if grid else None
        rows, hits = walk(recs, lg, grid, snaps, elo_fit)
        n = len(rows["base"])
        for k, f in files.items():
            for r in rows[k]:
                f.write(json.dumps(r, ensure_ascii=False) + "\n")
        summary.append((lg, n, hits, elo_fit))
        print(f"[export] {lg}: test n={n}, Elo kapsama {hits}/{n}" + (f", fit a={elo_fit[0]:.5f} b={elo_fit[1]:+.3f} total={elo_fit[2]:.2f}" if elo_fit else ""), flush=True)
    for f in files.values():
        f.close()
    with open(os.path.join(args.out, "summary.json"), "w") as f:
        json.dump([{"league": s[0], "n": s[1], "elo_hits": s[2], "elo_fit": s[3]} for s in summary], f, indent=1, default=str)
    print(f"[done] {args.out}/base.jsonl xg.jsonl xgelo.jsonl", flush=True)


if __name__ == "__main__":
    main()
