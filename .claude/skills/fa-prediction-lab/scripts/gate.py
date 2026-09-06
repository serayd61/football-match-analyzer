#!/usr/bin/env python3
"""
gate.py — iki tahmin dosyasını (baseline vs aday) walk-forward metrikleriyle karşılaştırır
ve kapı kararı verir. Saf stdlib.

Girdi: JSONL (satır başına bir maç), her iki dosyada AYNI sıra ve AYNI n.
  {"league":"E0","date":"2023-10-01","p_home":0.7,"p_draw":0.2,"p_away":0.1,"result":"H",
   "odds_home":1.3,"odds_draw":5.5,"odds_away":10.0}      # odds_* isteğe bağlı (kapanış)

Kullanım:
  python3 gate.py baseline.jsonl candidate.jsonl [--ev 0.05] [--boot 2000] [--seed 7]
  python3 gate.py only.jsonl                      # tek dosya: yalnız metrikler

Çıktı: toplam + lig-başı tablo (n, isabet, Brier, log-loss, ECE, ROI), Δ için eşleştirilmiş
bootstrap %95 aralığı, bahisçi benchmark (odds varsa) ve KARAR satırı
(experiment-protocol.md §3 kuralı).
"""
import argparse, json, math, random, sys
from collections import defaultdict

OUT = ("H", "D", "A")
KEY = {"H": "p_home", "D": "p_draw", "A": "p_away"}
ODD = {"H": "odds_home", "D": "odds_draw", "A": "odds_away"}


def load(path):
    rows = []
    with open(path, encoding="utf-8") as f:
        for ln, line in enumerate(f, 1):
            line = line.strip()
            if not line:
                continue
            r = json.loads(line)
            try:
                p = {o: float(r[KEY[o]]) for o in OUT}
            except (KeyError, TypeError, ValueError):
                sys.exit(f"{path}:{ln}: p_home/p_draw/p_away eksik veya sayı değil")
            s = sum(p.values())
            if not (0.97 <= s <= 1.03) or min(p.values()) < 0:
                sys.exit(f"{path}:{ln}: olasılıklar 0–1 ve toplam 1±0.03 olmalı (toplam {s:.3f})")
            p = {o: v / s for o, v in p.items()}
            res = str(r.get("result", "")).upper()
            if res not in OUT:
                sys.exit(f"{path}:{ln}: result H/D/A olmalı")
            odds = None
            try:
                o3 = {o: float(r[ODD[o]]) for o in OUT}
                if all(v > 1 for v in o3.values()):
                    odds = o3
            except (KeyError, TypeError, ValueError):
                pass
            rows.append({"league": str(r.get("league", "ALL")), "p": p, "res": res, "odds": odds})
    return rows


def per_match(r, ev_thr):
    """(brier, logloss, correct, conf, bets, profit, book_correct)"""
    p, res = r["p"], r["res"]
    brier = sum((p[o] - (1.0 if o == res else 0.0)) ** 2 for o in OUT)
    ll = -math.log(max(p[res], 1e-9))
    pick = max(OUT, key=lambda o: p[o])
    correct = 1 if pick == res else 0
    bets = profit = 0.0
    book_correct = None
    if r["odds"]:
        inv = {o: 1.0 / r["odds"][o] for o in OUT}
        s = sum(inv.values())
        imp = {o: inv[o] / s for o in OUT}
        book_correct = 1 if max(OUT, key=lambda o: imp[o]) == res else 0
        for o in OUT:
            if p[o] * r["odds"][o] - 1.0 > ev_thr:
                bets += 1
                profit += (r["odds"][o] - 1.0) if o == res else -1.0
    return brier, ll, correct, p[pick], bets, profit, book_correct


def ece(confs, hits, bins=10):
    b = [[0, 0.0, 0.0] for _ in range(bins)]
    for c, h in zip(confs, hits):
        i = min(bins - 1, int(c * bins))
        b[i][0] += 1; b[i][1] += c; b[i][2] += h
    n = len(confs) or 1
    return sum(abs(x[1] / x[0] - x[2] / x[0]) * x[0] / n for x in b if x[0])


def summarize(rows, ev_thr):
    m = [per_match(r, ev_thr) for r in rows]
    n = len(m)
    if not n:
        return None
    bets = sum(x[4] for x in m); profit = sum(x[5] for x in m)
    bk = [x[6] for x in m if x[6] is not None]
    return {
        "n": n,
        "acc": sum(x[2] for x in m) / n,
        "brier": sum(x[0] for x in m) / n,
        "ll": sum(x[1] for x in m) / n,
        "ece": ece([x[3] for x in m], [x[2] for x in m]),
        "bets": int(bets),
        "roi": (profit / bets) if bets else None,
        "book_acc": (sum(bk) / len(bk)) if bk else None,
        "book_n": len(bk),
        "_m": m,
    }


def paired_ci(mb, mc, idx, boot, seed):
    """Δ = aday − baseline; eşleştirilmiş bootstrap %95 aralığı (ortalama fark)."""
    rnd = random.Random(seed)
    d = [mc[i][idx] - mb[i][idx] for i in range(len(mb))]
    n = len(d)
    mean = sum(d) / n
    samples = []
    for _ in range(boot):
        s = 0.0
        for _ in range(n):
            s += d[rnd.randrange(n)]
        samples.append(s / n)
    samples.sort()
    return mean, samples[int(0.025 * boot)], samples[int(0.975 * boot) - 1]


def fmt(v, pct=False, nd=4):
    if v is None:
        return "—"
    return f"{v*100:.1f}%" if pct else f"{v:.{nd}f}"


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("baseline"); ap.add_argument("candidate", nargs="?")
    ap.add_argument("--ev", type=float, default=0.05)
    ap.add_argument("--boot", type=int, default=2000)
    ap.add_argument("--seed", type=int, default=7)
    a = ap.parse_args()

    base = load(a.baseline)
    cand = load(a.candidate) if a.candidate else None
    if cand is not None:
        if len(cand) != len(base):
            sys.exit(f"n uyuşmuyor: baseline {len(base)} vs aday {len(cand)} (aynı maç sırası şart)")
        for i, (x, y) in enumerate(zip(base, cand)):
            if x["res"] != y["res"] or x["league"] != y["league"]:
                sys.exit(f"satır {i+1}: lig/sonuç farklı — dosyalar aynı maç dizisi değil")

    leagues = sorted({r["league"] for r in base})
    groups = [("TOPLAM", list(range(len(base))))] + [
        (lg, [i for i, r in enumerate(base) if r["league"] == lg]) for lg in leagues if len(leagues) > 1]

    hdr = f"{'lig':8} {'n':>6} {'isabet':>7} {'bahisçi':>8} {'Brier':>7} {'LL':>7} {'ECE':>6} {'bet':>5} {'ROI':>7}"
    if cand is not None:
        hdr += f" | {'ΔLL':>8} {'%95 CI':>19} {'ΔBrier':>8} {'ΔROI':>7}"
    print(hdr); print("-" * len(hdr))
    verdict_ll = []; verdict_br = []; total_ci = None
    for name, idx in groups:
        sb = summarize([base[i] for i in idx], a.ev)
        line = (f"{name:8} {sb['n']:>6} {fmt(sb['acc'],1):>7} {fmt(sb['book_acc'],1):>8} "
                f"{fmt(sb['brier']):>7} {fmt(sb['ll']):>7} {fmt(sb['ece'],nd=3):>6} {sb['bets']:>5} {fmt(sb['roi'],1):>7}")
        if cand is not None:
            sc = summarize([cand[i] for i in idx], a.ev)
            dll, lo, hi = paired_ci(sb["_m"], sc["_m"], 1, a.boot, a.seed)
            dbr = sc["brier"] - sb["brier"]
            droi = (sc["roi"] - sb["roi"]) if (sc["roi"] is not None and sb["roi"] is not None) else None
            line += f" | {dll:>+8.4f} [{lo:+.4f},{hi:+.4f}] {dbr:>+8.4f} {fmt(droi,1):>7}"
            if name == "TOPLAM":
                total_ci = (dll, lo, hi)
            else:
                verdict_ll.append(dll < 0); verdict_br.append(dbr < 0)
        print(line)

    if cand is not None:
        print()
        if not verdict_ll:  # tek lig
            ok = total_ci[2] < 0
            print(f"KARAR: {'GEÇTİ' if ok else 'DÜŞTÜ'} — tek lig; ΔLL CI 0'ı {'dışlıyor' if ok else 'içeriyor'}.")
        else:
            k = len(verdict_ll); wl = sum(verdict_ll); wb = sum(verdict_br)
            ci_ok = total_ci[2] < 0
            passed = (wl == k and wb == k) or (wl >= k - 1 and wb >= k - 1 and ci_ok)
            print(f"KARAR: {'GEÇTİ' if passed else 'DÜŞTÜ'} — LL {wl}/{k} lig, Brier {wb}/{k} lig, "
                  f"toplam ΔLL {total_ci[0]:+.4f} [{total_ci[1]:+.4f},{total_ci[2]:+.4f}] "
                  f"({'0 dışarıda' if ci_ok else '0 içeride'}). Kural: experiment-protocol.md §3.")
        print("Not: ROI gürültülüdür; n_bet<500 iken yorum yapma. Aday parametresi test setinde "
              "tarandıysa seçim yanlılığı var — raporda plato değerini yaz.")


if __name__ == "__main__":
    main()
