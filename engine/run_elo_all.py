"""Faz 2 sürücü: 5 ligde ELO harman backtest'i, snapshot bir kez kurulur.
Çıktı: her lig baseline vs en-iyi-λ log-loss/Brier + kapsama.
  SOCCERDATA_DIR=/tmp/soccerdata ../src/lib/data-sources/venv/bin/python -u run_elo_all.py
"""
import features_elo as FE
import backtest_elo as BE
from features import load_features

LEAGUES = ("E0", "SP1", "I1", "D1", "F1")
START, END = 2020, 2024

# 1) tüm liglerin feature'larını yükle + snapshot havuzunu topla (bir kez)
data = {}
alldates = []
for lg in LEAGUES:
    recs, st = load_features(lg, START, END, verbose=False)
    FE_dates = [m["date"] for m in recs]
    data[lg] = recs
    alldates += FE_dates
    print(f"[load] {lg}: {len(recs)} maç", flush=True)

print("[snap] snapshot kuruluyor (cache'liyse hızlı)...", flush=True)
grid, snaps = FE.build_snapshots(alldates, verbose=True)

# 2) her lig backtest
print("\n" + "=" * 78, flush=True)
print(f"{'lig':>4} | {'ELO%':>5} | {'base LL':>8} {'base Br':>8} | {'best λ':>6} {'LL':>8} {'ΔLL':>8} {'ΔBr':>8} | verdict", flush=True)
print("-" * 78, flush=True)
summary = []
for lg in LEAGUES:
    recs = data[lg]
    fit = BE.fit_elo_map(recs, grid, snaps, FE.CC[lg])
    if not fit:
        print(f"{lg:>4} | yetersiz eğitim ELO'su", flush=True)
        continue
    a, b, total, ntr = fit
    preds, ehits = BE.precompute(recs, lg, grid, snaps, a, b, total)
    cov = ehits / len(preds) * 100 if preds else 0
    base = BE.score(preds, 0.0)
    results = [BE.score(preds, lam) for lam in (0.0, 0.1, 0.15, 0.2, 0.25, 0.3, 0.4, 0.5)]
    best = min(results, key=lambda r: r["logloss"])
    dLL = best["logloss"] - base["logloss"]
    dBr = best["brier"] - base["brier"]
    verdict = "GEÇTİ" if (dLL < -0.0005 and dBr < 0) else "marjinal" if dLL < 0 else "GEÇMEDİ"
    summary.append((lg, cov, base, best, dLL, dBr, verdict))
    print(f"{lg:>4} | {cov:>5.1f} | {base['logloss']:>8.4f} {base['brier']:>8.4f} | "
          f"{best['lam']:>6.2f} {best['logloss']:>8.4f} {dLL:>+8.4f} {dBr:>+8.4f} | {verdict}", flush=True)
print("=" * 78, flush=True)

passed = [s for s in summary if s[6] == "GEÇTİ"]
print(f"\nGEÇEN lig: {len(passed)}/{len(summary)}  → {[s[0] for s in passed]}", flush=True)
