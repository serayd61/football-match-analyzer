#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Calibrate & validate the Elo->goals coefficient against REAL historical results.

Rebuilds a rolling World-Football-Elo over a results CSV, predicts each match with the
Elo->Poisson/Dixon-Coles mapping, and scores predictions vs actual outcomes. Grid-searches
the goal-difference coefficient and total-goals base to minimize log-loss, and prints a
reliability table (real vs predicted 1X2 by Elo-gap bucket) so you can SEE where the model
is mis-calibrated (classically: it under-rates clear favorites).

No market/betting data used — only real results. This is the objective scoreboard for Stage 2.

CSV columns: date,home_team,away_team,home_score,away_score,tournament,neutral
Usage: python calibrate_backtest.py results.csv [--test-from 2010-01-01] [--min-games 20]
"""
import csv, io, math, argparse
from collections import defaultdict

HOME_ADV = 100.0


def k_for(t):
    if t == 'FIFA World Cup': return 60.0
    if t in ('UEFA Euro', 'Copa América', 'African Cup of Nations', 'AFC Asian Cup',
             'Gold Cup', 'CONCACAF Championship', 'Copa America'): return 50.0
    if t == 'Friendly': return 20.0
    if 'qualification' in (t or '') or t in ('UEFA Nations League', 'CONCACAF Nations League',
                                             'Confederations Cup'): return 40.0
    return 30.0


def gd_mult(n):
    n = abs(n)
    return 1.0 if n <= 1 else 1.5 if n == 2 else 1.75 if n == 3 else 1.75 + (n - 3) / 8.0


def pois(d, coeff, tgb, rho=0.03):
    t = d / 100.0; gd = coeff * t
    lh = max(0.15, tgb / 2 + gd / 2); la = max(0.15, tgb / 2 - gd / 2)
    pmfH = [math.exp(-lh + k * math.log(lh) - sum(math.log(i) for i in range(2, k + 1))) for k in range(11)]
    pmfA = [math.exp(-la + k * math.log(la) - sum(math.log(i) for i in range(2, k + 1))) for k in range(11)]
    ph = pd = pa = 0.0
    for h in range(11):
        for a in range(11):
            tau = 1.0
            if h == 0 and a == 0: tau = 1 - lh * la * rho
            elif h == 0 and a == 1: tau = 1 + lh * rho
            elif h == 1 and a == 0: tau = 1 + la * rho
            elif h == 1 and a == 1: tau = 1 - rho
            p = pmfH[h] * pmfA[a] * tau
            if h > a: ph += p
            elif h == a: pd += p
            else: pa += p
    s = ph + pd + pa
    return ph / s, pd / s, pa / s


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('csv')
    ap.add_argument('--test-from', default='2010-01-01')
    ap.add_argument('--min-games', type=int, default=20)
    args = ap.parse_args()

    rows = list(csv.DictReader(io.open(args.csv, encoding='utf-8')))
    elo = defaultdict(lambda: 1500.0); gp = defaultdict(int); S = []
    for r in rows:
        hs, a_ = r.get('home_score'), r.get('away_score')
        if hs in ('', 'NA', None) or a_ in ('', 'NA', None):
            continue
        try: hs, a_ = int(hs), int(a_)
        except ValueError: continue
        H, A = r['home_team'], r['away_team']
        adv = 0.0 if str(r.get('neutral', '')).upper() == 'TRUE' else HOME_ADV
        d = (elo[H] + adv) - elo[A]; we = 1 / (1 + 10 ** (-d / 400))
        if r['date'] >= args.test_from and gp[H] >= args.min_games and gp[A] >= args.min_games:
            S.append((d, 0 if hs > a_ else 1 if hs == a_ else 2))
        w = 1.0 if hs > a_ else 0.5 if hs == a_ else 0.0
        dl = k_for(r['tournament']) * gd_mult(hs - a_) * (w - we)
        elo[H] += dl; elo[A] -= dl; gp[H] += 1; gp[A] += 1
    n = len(S)
    print('test samples (%s+, both >= %d games): %d' % (args.test_from, args.min_games, n))

    def metrics(coeff, tgb):
        cache = {}; brier = ll = 0.0
        for d, o in S:
            key = round(d)
            if key not in cache: cache[key] = pois(key, coeff, tgb)
            p = cache[key]; tgt = [1 if o == 0 else 0, 1 if o == 1 else 0, 1 if o == 2 else 0]
            brier += sum((p[i] - tgt[i]) ** 2 for i in range(3))
            ll += -math.log(max(p[o], 1e-9))
        return brier / n, ll / n

    print('\n=== grid search (minimize log-loss) ===')
    best = None
    for c in [0.32, 0.40, 0.45, 0.50, 0.60, 0.70]:
        for tgb in [2.4, 2.5, 2.6, 2.7]:
            b, l = metrics(c, tgb)
            if best is None or l < best[3]: best = (c, tgb, b, l)
            if tgb == 2.5:
                print('  coeff=%.2f tgb=2.5  Brier=%.4f LogLoss=%.4f' % (c, b, l))
    print('best: coeff=%.2f tgb=%.2f  Brier=%.4f LogLoss=%.4f' % best)

    print('\n=== reliability by Elo gap (REAL vs MODEL[best]) ===')
    print('elo gap        n    real[H/D/A]      model[H/D/A]')
    for lo, hi in [(-9999, -150), (-150, -80), (-80, -40), (-40, -15), (-15, 15),
                   (15, 40), (40, 80), (80, 150), (150, 9999)]:
        sub = [(dd, o) for dd, o in S if lo <= dd < hi]
        if len(sub) < 30: continue
        m = len(sub)
        rh = sum(1 for _, o in sub if o == 0) / m
        rd = sum(1 for _, o in sub if o == 1) / m
        ra = sum(1 for _, o in sub if o == 2) / m
        mid = sum(dd for dd, _ in sub) / m
        p = pois(mid, best[0], best[1])
        print('[%5d,%5d) %5d  %3.0f/%2.0f/%3.0f%%      %3.0f/%2.0f/%3.0f%%'
              % (lo, hi, m, rh*100, rd*100, ra*100, p[0]*100, p[1]*100, p[2]*100))


if __name__ == '__main__':
    main()
