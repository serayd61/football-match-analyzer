#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Fit per-team attack/defense ratings (Dixon-Coles style) from a results CSV.

Captures team scoring/defensive STYLE that a single Elo scalar can't, and gives a real
strength estimate even for teams a structured Elo source doesn't cover. Parameters are
grid-searched on real results (log-loss), so the data picks them — not your gut.

CSV columns required: date,home_team,away_team,home_score,away_score,tournament,neutral
(public source for international football: github.com/martj42/international_results)

Usage:
  python build_team_ratings.py results.csv ratings.json [--test-from 2016-01-01] [--min-games 20]

Output JSON: { "meta": {...}, "ratings": { "<team>": {"att":..,"dff":..,"games":..}, ... } }
Use att/dff in:  lambda_home = exp(mu + att_home - dff_away + home_adv_log)
                 lambda_away = exp(mu + att_away - dff_home)
Refresh periodically as new results arrive (ratings drift with team strength).
"""
import csv, io, math, json, sys, argparse
from collections import defaultdict


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


def load_rows(path):
    rows = list(csv.DictReader(io.open(path, encoding='utf-8')))
    out = []
    for r in rows:
        hs, a_ = r.get('home_score'), r.get('away_score')
        if hs in ('', 'NA', None) or a_ in ('', 'NA', None):
            continue
        try:
            r['_hs'], r['_as'] = int(hs), int(a_)
        except ValueError:
            continue
        out.append(r)
    return out


def pmf_cache():
    c = {}
    def pmf(lam, k):
        key = (round(lam, 3), k)
        if key not in c:
            c[key] = math.exp(-lam + k * math.log(lam) - sum(math.log(i) for i in range(2, k + 1)))
        return c[key]
    return pmf


def onextwo(lh, la, pmf, rho=0.03):
    H = [pmf(lh, k) for k in range(9)]; A = [pmf(la, k) for k in range(9)]
    ph = pd = pa = 0.0
    for h in range(9):
        for a in range(9):
            tau = 1.0
            if h == 0 and a == 0: tau = 1 - lh * la * rho
            elif h == 0 and a == 1: tau = 1 + lh * rho
            elif h == 1 and a == 0: tau = 1 + la * rho
            elif h == 1 and a == 1: tau = 1 - rho
            p = H[h] * A[a] * tau
            if h > a: ph += p
            elif h == a: pd += p
            else: pa += p
    s = ph + pd + pa
    return ph / s, pd / s, pa / s


def run(rows, mu, lr, hadv, decay, test_from, min_games, collect=False):
    att = defaultdict(float); dff = defaultdict(float); gp = defaultdict(int)
    pmf = pmf_cache(); ll = 0.0; nn = 0
    for r in rows:
        H, A = r['home_team'], r['away_team']
        hs, a_ = r['_hs'], r['_as']
        neutral = str(r.get('neutral', '')).upper() == 'TRUE'
        ha = 0.0 if neutral else hadv
        lh = min(max(math.exp(mu + att[H] - dff[A] + ha), 0.12), 6.0)
        la = min(max(math.exp(mu + att[A] - dff[H]), 0.12), 6.0)
        if r['date'] >= test_from and gp[H] >= min_games and gp[A] >= min_games:
            o = 0 if hs > a_ else 1 if hs == a_ else 2
            ll += -math.log(max(onextwo(lh, la, pmf)[o], 1e-9)); nn += 1
        att[H] += lr * (hs - lh); dff[A] += lr * (lh - hs)
        att[A] += lr * (a_ - la); dff[H] += lr * (la - a_)
        for tm in (H, A): att[tm] *= decay; dff[tm] *= decay
        gp[H] += 1; gp[A] += 1
    if collect:
        return att, dff, gp
    return (ll / nn) if nn else float('inf'), nn


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('csv'); ap.add_argument('out')
    ap.add_argument('--test-from', default='2016-01-01')
    ap.add_argument('--min-games', type=int, default=20)
    args = ap.parse_args()

    rows = load_rows(args.csv)
    tot = sum(r['_hs'] + r['_as'] for r in rows); mu = math.log(max(tot / len(rows) / 2, 0.3))
    print('rows=%d  global goals/team/match=%.3f  MU=%.3f' % (len(rows), math.exp(mu), mu))

    best = None
    for lr in (0.03, 0.04, 0.05):
        for hadv in (0.25, 0.30, 0.35):
            for decay in (0.998, 0.999, 1.0):
                l, nn = run(rows, mu, lr, hadv, decay, args.test_from, args.min_games)
                if best is None or l < best[3]:
                    best = (lr, hadv, decay, l)
    lr, hadv, decay, l = best
    print('best: lr=%.2f hadv=%.2f decay=%.3f LogLoss=%.4f' % (lr, hadv, decay, l))

    att, dff, gp = run(rows, mu, lr, hadv, decay, args.test_from, args.min_games, collect=True)
    ratings = {t: {'att': round(att[t], 4), 'dff': round(dff[t], 4), 'games': gp[t]}
               for t in gp if gp[t] >= 15}
    out = {'meta': {'mu': round(mu, 4), 'homeAdv': hadv, 'lr': lr, 'decay': decay,
                    'teams': len(ratings)}, 'ratings': ratings}
    json.dump(out, io.open(args.out, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    print('wrote %d team ratings -> %s' % (len(ratings), args.out))


if __name__ == '__main__':
    main()
