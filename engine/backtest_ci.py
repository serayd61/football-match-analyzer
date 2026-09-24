"""
Belirsizlik aralıklı backtest — üç karşılaştırma, aynı walk-forward maçları üzerinde:

  A) gol-DC (xg_weight=0)      →  xG-DC (xg_weight=0.75)   [xG kapısı]
  B) xG-DC                     →  xG-DC + ELO harman (λ)    [ELO kapısı]
  C) her modelin value-bet ROI'si (EV>%5) — küme-bootstrap %95 aralığı

Her Δ için eşleştirilmiş küme-bootstrap (ISO hafta) %95 aralığı ve
P(iyileşme) raporlanır. Karar kuralı: aralığın üst ucu < 0 ve P ≥ 0.95.

ELO λ değerleri reports/backtest-elo.md'deki seçimlerdir. O seçim test
sezonlarının kendisinde yapıldığı için B iyimser yanlıdır; aralık yine de
0'ı kapsıyorsa ELO katmanının faydası gösterilememiş demektir.

Çalıştır (Hetzner kutusunda; football-data.co.uk + Understat + ClubElo erişimi gerekir):
  cd /opt/football-match-analyzer/engine
  SOCCERDATA_DIR=/opt/soccerdata ../src/lib/data-sources/venv/bin/python backtest_ci.py \
      --out ../reports/backtest-ci.md            # 5 lig
  ... backtest_ci.py E0 --boot 500               # tek lig, hızlı
"""
import argparse
import sys
from datetime import datetime, timezone

import uncertainty as U

XG_WEIGHT = 0.75
TEST_FROM = "2122"
LEAGUES = ("E0", "SP1", "I1", "D1", "F1")
ELO_LAMBDA = {"E0": 0.15, "SP1": 0.30, "I1": 0.30, "D1": 0.40, "F1": 0.40}


def collect(league, start=2019, end=2024, half_life=180, window=540, with_elo=True):
    """Aynı test maçlarında üç olasılık seti: gol-DC, xG-DC, xG-DC+ELO."""
    from features import load_features
    import model_xg as MX

    recs, stats = load_features(league, start, end)
    elo = None
    if with_elo:
        try:
            import features_elo as FE
            from backtest_elo import fit_elo_map, elo_probs
            grid, snaps = FE.build_snapshots([m["date"] for m in recs])
            fit = fit_elo_map(recs, grid, snaps, FE.CC[league])
            if fit:
                elo = (FE, grid, snaps, fit, elo_probs)
        except Exception as e:  # ELO kaynağı yoksa A ve C yine üretilir
            print(f"[ci] {league}: ELO atlandı ({e})", file=sys.stderr)

    caches = {0.0: {}, XG_WEIGHT: {}}

    def model(w, ref):
        k = ref.toordinal()
        if k not in caches[w]:
            caches[w][k] = MX.fit(recs, ref, xg_weight=w,
                                  half_life_days=half_life, window_days=window)
        return caches[w][k]

    rows = []
    for m in recs:
        if m["season"] < TEST_FROM or m["ftr"] not in U.OUTCOMES:
            continue
        mg, mx = model(0.0, m["date"]), model(XG_WEIGHT, m["date"])
        if mg is None or mx is None:
            continue
        pg = MX.predict(mg, m["home"], m["away"])
        px = MX.predict(mx, m["home"], m["away"])
        if pg is None or px is None:
            continue
        p_goal = {"H": pg["p_home"], "D": pg["p_draw"], "A": pg["p_away"]}
        p_xg = {"H": px["p_home"], "D": px["p_draw"], "A": px["p_away"]}
        p_elo = p_xg
        if elo:
            FE, grid, snaps, (a, b, total, _n), elo_probs = elo
            eh = FE.elo_of(grid, snaps, FE.CC[league], m["home"], m["date"])
            ea = FE.elo_of(grid, snaps, FE.CC[league], m["away"], m["date"])
            if eh is not None and ea is not None:
                pe = elo_probs(eh - ea, a, b, total)
                lam = ELO_LAMBDA[league]
                p_elo = {o: (1 - lam) * p_xg[o] + lam * pe[o] for o in U.OUTCOMES}
        rows.append({
            "week": U.week_key(m["date"]),
            "actual": m["ftr"],
            "odds": {"H": m["odds_home"], "D": m["odds_draw"], "A": m["odds_away"]},
            "p": {"goal": p_goal, "xg": p_xg, "elo": p_elo},
        })
    return rows, stats, bool(elo)


def analyse(rows, n_boot=2000):
    keys = [r["week"] for r in rows]
    sc = {name: [U.match_scores(r["p"][name], r["actual"], r["odds"]) for r in rows]
          for name in ("goal", "xg", "elo")}
    col = lambda name, f: [s[f] for s in sc[name]]
    out = {"n": len(rows), "weeks": len(set(keys))}
    for label, a, b in (("xg_vs_goal", "goal", "xg"), ("elo_vs_xg", "xg", "elo")):
        out[label] = {
            "logloss": U.paired_diff(col(a, "ll"), col(b, "ll"), keys, n_boot),
            "brier": U.paired_diff(col(a, "brier"), col(b, "brier"), keys, n_boot),
        }
    out["roi"] = {name: U.roi_ci(col(name, "profit"), col(name, "stake"), keys, n_boot)
                  for name in ("goal", "xg", "elo")}
    return out


def _fmt_d(r):
    if r is None:
        return "—", "—", "—"
    return (f"{r['delta']:+.4f}", f"[{r['lo']:+.4f}, {r['hi']:+.4f}]",
            f"{r['p_improve']*100:.0f}%")


def _fmt_roi(r):
    if r is None:
        return "bahis yok"
    return f"{r['roi']:+.1f}% [{r['lo']:+.1f}, {r['hi']:+.1f}] (n={r['bets']})"


def render(results, n_boot):
    now = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC")
    L = [
        "# Backtest — belirsizlik aralıklı yeniden üretim",
        "",
        f"**Üretim:** `engine/backtest_ci.py` · {now} · walk-forward test {TEST_FROM}+ · "
        f"küme-bootstrap (ISO hafta), {n_boot} örnek · %95 aralık",
        "",
        "Δ = aday − baz (düşük = iyi). **Karar:** aralığın üst ucu < 0 ve P(iyileşme) ≥ %95 → anlamlı.",
        "",
        "## A) xG-DC (w=0.75) vs gol-DC (w=0)",
        "",
        "| Lig | n maç / hafta | ΔLogLoss | %95 aralık | P(iyi) | ΔBrier | %95 aralık | Hüküm (log-loss) |",
        "|-----|---:|---:|---|---:|---:|---|---|",
    ]
    for lg, r in results.items():
        d, ci, p = _fmt_d(r["xg_vs_goal"]["logloss"])
        bd, bci, _ = _fmt_d(r["xg_vs_goal"]["brier"])
        L.append(f"| {lg} | {r['n']} / {r['weeks']} | {d} | {ci} | {p} | {bd} | {bci} | "
                 f"{U.verdict(r['xg_vs_goal']['logloss'])} |")
    L += ["", "## B) xG-DC + ELO harman vs xG-DC",
          "",
          "λ değerleri test sezonunda seçildi → bu tablo iyimser yanlıdır.",
          "",
          "| Lig | λ | ΔLogLoss | %95 aralık | P(iyi) | ΔBrier | %95 aralık | Hüküm |",
          "|-----|---:|---:|---|---:|---:|---|---|"]
    for lg, r in results.items():
        if not r.get("has_elo"):
            L.append(f"| {lg} | — | ELO verisi yok | | | | | |")
            continue
        d, ci, p = _fmt_d(r["elo_vs_xg"]["logloss"])
        bd, bci, _ = _fmt_d(r["elo_vs_xg"]["brier"])
        L.append(f"| {lg} | {ELO_LAMBDA[lg]:.2f} | {d} | {ci} | {p} | {bd} | {bci} | "
                 f"{U.verdict(r['elo_vs_xg']['logloss'])} |")
    L += ["", "## C) Value-bet ROI (EV > %5, 1 birim stake)", "",
          "| Lig | gol-DC | xG-DC | xG-DC+ELO |", "|-----|---|---|---|"]
    for lg, r in results.items():
        ro = r["roi"]
        L.append(f"| {lg} | {_fmt_roi(ro['goal'])} | {_fmt_roi(ro['xg'])} | {_fmt_roi(ro['elo'])} |")
    L += ["", "Aralığı 0'ı kapsayan ROI, kârlılık iddiası için kanıt değildir.", ""]
    return "\n".join(L)


def main(argv=None):
    ap = argparse.ArgumentParser()
    ap.add_argument("leagues", nargs="*", default=list(LEAGUES))
    ap.add_argument("--boot", type=int, default=2000)
    ap.add_argument("--no-elo", action="store_true")
    ap.add_argument("--out", help="markdown rapor yolu")
    a = ap.parse_args(argv)
    results = {}
    for lg in a.leagues:
        rows, stats, has_elo = collect(lg, with_elo=not a.no_elo)
        print(f"[ci] {lg}: {len(rows)} test maçı, xG kapsama %{stats.get('coverage_pct')}",
              file=sys.stderr)
        if not rows:
            continue
        r = analyse(rows, a.boot)
        r["has_elo"] = has_elo
        results[lg] = r
    md = render(results, a.boot)
    if a.out:
        with open(a.out, "w", encoding="utf-8") as f:
            f.write(md)
        print(f"[ci] rapor → {a.out}", file=sys.stderr)
    else:
        print(md)


if __name__ == "__main__":
    main()
