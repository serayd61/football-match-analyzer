"""
KG (karşılıklı gol) modeli geriye dönük testi (2026-11-06).

Neden: Dixon-Coles'tan türetilen KG olasılığı sitede sabit taban orandan kötü ölçüldü
(Brier 0,2516 vs 0,2466). Müşteri KG'yi istiyor → ham DC yerine daha iyi bir KG tahmincisi
aranıyor. Yürüyen pencere, sızıntı yok: her ay başında o aydan ÖNCEKİ maçlarla DC fit edilir,
öznitelikler maç tarihinden önceki maçlardan üretilir, kalibrasyon/lojistik modeller yalnız
önceki ayların örneklem-dışı satırlarıyla eğitilir.

Varyantlar:
  dc      ham DC KG olasılığı (bugünkü motor)
  base    ligin son 365 gündeki KG oranı (sabit taban)
  platt   σ(a + b·logit(dc)) — önceki ayların örneklem-dışı dc satırlarıyla fit
  team    takım KG oranları (zamanla ağırlıklı, lig ortalamasına büzülmüş) ortalaması
  logit   lojistik regresyon: logit(dc), takım gol atma/yeme oranları, takım KG oranları,
          lig KG oranı, λ toplamı — önceki ayların satırlarıyla (tüm ligler havuz) fit

Kullanım (Hetzner, salt-okunur):
  STORE_PATH=/var/lib/footy/results.jsonl LEAGUE_ALIASES=... python3 backtest_btts.py \
      --leagues 47,87,55,54,53,57,61,48,268,71,196,59,85,203 --from 2025-10 --to 2026-11 \
      [--odds /tmp/btts_odds.json]   # {fixture_id: p_yes_market} varsa piyasa karşılaştırması
"""
import argparse
import json
import math
import os
import sys
from collections import defaultdict
from datetime import datetime, timedelta

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import model as M  # noqa: E402
from store import ResultStore  # noqa: E402

FIT = dict(half_life_days=180, window_days=540, iters=25, min_matches=120, rho=-0.1, shrink_k=0.0)
HALF = 180.0        # öznitelik zaman ağırlığı yarı ömrü (gün)
SHRINK_K = 8.0      # takım oranı → lig ortalamasına büzülme (etkin maç sayısı)
LN2 = math.log(2)
EPS = 1e-6


def clamp(p, lo=0.02, hi=0.98):
    return min(max(p, lo), hi)


def logit(p):
    p = clamp(p); return math.log(p / (1 - p))


def sigmoid(x):
    return 1 / (1 + math.exp(-x)) if x > -40 else 0.0


def month_iter(a, b):
    y, m = int(a[:4]), int(a[5:7])
    while f"{y:04d}-{m:02d}" <= b:
        yield datetime(y, m, 1)
        m += 1
        if m == 13: y, m = y + 1, 1


# ---------------------------------------------------------------- öznitelikler
class TeamRates:
    """Maç tarihinden önceki maçlardan takım oranları (zaman ağırlıklı). Satırlar tarih sıralı
    verilir; `advance(date)` o tarihten önce oynanan maçları hesaba katar."""

    def __init__(self, rows):
        self.rows = rows  # tarih sıralı
        self.i = 0
        self.hist = defaultdict(list)   # takım → [(date, scored, conceded, both)]
        self.league = []                # [(date, both)]

    def advance(self, date):
        while self.i < len(self.rows) and self.rows[self.i]["date"] < date:
            r = self.rows[self.i]; self.i += 1
            both = r["fthg"] > 0 and r["ftag"] > 0
            self.hist[r["home"]].append((r["date"], r["fthg"] > 0, r["ftag"] > 0, both))
            self.hist[r["away"]].append((r["date"], r["ftag"] > 0, r["fthg"] > 0, both))
            self.league.append((r["date"], both))

    def league_rate(self, date, days=365):
        lo = date - timedelta(days=days)
        xs = [b for d, b in self.league if d >= lo]
        return (sum(xs) + 0.56 * 5) / (len(xs) + 5) if xs else 0.56

    def team(self, team, date, prior, last=5):
        """→ (scored_rate, conceded_rate, both_rate, n_eff, both_last5); lig ortalamasına büzülmüş."""
        ws = wsc = wcc = wb = 0.0
        hist = self.hist.get(team, [])
        for d, sc, cc, both in hist:
            age = (date - d).days
            if age > 540: continue
            w = math.exp(-LN2 * age / HALF)
            ws += w; wsc += w * sc; wcc += w * cc; wb += w * both
        ps, pc, pb = prior
        recent = [b for d, _, _, b in hist[-last:]]
        pb5 = (sum(recent) + 2 * pb) / (len(recent) + 2)
        return ((wsc + SHRINK_K * ps) / (ws + SHRINK_K), (wcc + SHRINK_K * pc) / (ws + SHRINK_K),
                (wb + SHRINK_K * pb) / (ws + SHRINK_K), ws, pb5)


# ---------------------------------------------------------------- lojistik regresyon (saf python)
def solve(A, b):
    n = len(A); Mx = [row[:] + [b[i]] for i, row in enumerate(A)]
    for c in range(n):
        p = max(range(c, n), key=lambda r: abs(Mx[r][c]))
        Mx[c], Mx[p] = Mx[p], Mx[c]
        if abs(Mx[c][c]) < 1e-12: Mx[c][c] = 1e-12
        for r in range(n):
            if r != c:
                f = Mx[r][c] / Mx[c][c]
                for k in range(c, n + 1): Mx[r][k] -= f * Mx[c][k]
    return [Mx[i][n] / Mx[i][i] for i in range(n)]


def fit_logit(X, y, l2=1.0, iters=12):
    """Newton; X satırları [1, f1..fk]. L2 (sabit terim hariç)."""
    k = len(X[0]); w = [0.0] * k
    for _ in range(iters):
        g = [0.0] * k; H = [[0.0] * k for _ in range(k)]
        for xi, yi in zip(X, y):
            p = sigmoid(sum(a * b for a, b in zip(w, xi)))
            d = p - yi; s = p * (1 - p)
            for a in range(k):
                g[a] += d * xi[a]
                for b in range(a, k): H[a][b] += s * xi[a] * xi[b]
        for a in range(k):
            for b in range(a):
                H[a][b] = H[b][a]
            if a: g[a] += l2 * w[a]; H[a][a] += l2
        step = solve(H, g)
        w = [wi - si for wi, si in zip(w, step)]
        if max(abs(s) for s in step) < 1e-6: break
    return w


def predict_logit(w, x):
    return sigmoid(sum(a * b for a, b in zip(w, x)))


# ---------------------------------------------------------------- ölçüm
class Score:
    def __init__(self):
        self.n = 0; self.br = 0.0; self.ll = 0.0
        self.hi = defaultdict(lambda: [0, 0])     # eşik → [n, hit] (KG Var p≥eşik)
        self.bk = defaultdict(lambda: [0, 0])     # ondalık kova → [n, gerçek]

    def add(self, p, y):
        p = clamp(p); self.n += 1; self.br += (p - y) ** 2; self.ll -= math.log(p if y else 1 - p)
        for t in (0.55, 0.60, 0.65, 0.70):
            if p >= t: self.hi[t][0] += 1; self.hi[t][1] += y
        b = min(int(p * 10), 9); self.bk[b][0] += 1; self.bk[b][1] += y

    def row(self, name):
        if not self.n: return f"{name:8} n=0"
        hs = " ".join(f"≥{int(t*100)}:{h}/{n}({h/n:.2f})" if n else f"≥{int(t*100)}:–" for t, (n, h) in sorted(self.hi.items()))
        return f"{name:8} n={self.n:5} brier={self.br/self.n:.4f} ll={self.ll/self.n:.4f}  {hs}"

    def calib(self):
        return "  ".join(f"{b/10:.1f}:{v[1]/v[0]:.2f}({v[0]})" for b, v in sorted(self.bk.items()) if v[0] >= 20)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--leagues", default="47,87,55,54,53,57,61,48,268,71,196,59,85,203")
    ap.add_argument("--from", dest="d_from", default="2025-10")
    ap.add_argument("--to", dest="d_to", default="2026-11")
    ap.add_argument("--warmup", type=int, default=2, help="ilk N ay yalnız eğitim satırı biriktirir")
    ap.add_argument("--odds", default=None)
    args = ap.parse_args()
    st = ResultStore()
    odds = json.load(open(args.odds)) if args.odds else {}
    odds = {int(k): float(v) for k, v in odds.items()}

    if args.leagues.startswith("auto:"):
        min_rows = int(args.leagues.split(":")[1])
        st.load_for_fit(47)  # depo tembel yüklenir; _by_league bundan sonra dolu
        teams = st._group_teams() if hasattr(st, "_group_teams") else {}
        leagues = [lg for lg, rows in st._by_league.items() if len(rows) >= min_rows and len(teams.get(lg, ())) <= 60]
        print(f"auto: {len(leagues)} lig (≥{min_rows} satır, ≤60 takım)")
    else:
        leagues = [int(x) for x in args.leagues.split(",")]
    months = list(month_iter(args.d_from, args.d_to))
    # her lig için: tarih sıralı satırlar + ay → maçlar
    data = {}
    for lg in leagues:
        rows = st.load_for_fit(lg)
        if len(rows) < 200:
            print(f"lig {lg}: {len(rows)} satır, atlandı"); continue
        data[lg] = rows
    print(f"ligler {len(data)}, aylar {months[0]:%Y-%m}..{months[-1]:%Y-%m}, warmup {args.warmup}")

    train_rows = []     # örneklem-dışı satırlar: (feats, y, dc) — önceki aylardan
    scores = {k: Score() for k in ("dc", "base", "platt", "team", "logit", "ens", "market", "blend", "mk_team")}
    mk_dc = Score()     # piyasa karşılaştırması için aynı alt küme
    n_eval_months = 0
    for mi, ref in enumerate(months):
        nxt = months[mi + 1] if mi + 1 < len(months) else ref + timedelta(days=31)
        # önceki ayların satırlarıyla platt + logit fit
        platt = logit_w = None
        if mi >= args.warmup and len(train_rows) >= 300:
            platt = fit_logit([[1.0, logit(d)] for _, _, d in train_rows], [y for _, y, _ in train_rows], l2=0.01)
            logit_w = fit_logit([[1.0] + f for f, _, _ in train_rows], [y for _, y, _ in train_rows], l2=1.0)
        month_rows = []
        for lg, rows in data.items():
            mdl = M.fit(rows, ref, **FIT)
            if mdl is None: continue
            tr = TeamRates(rows)
            for m in rows:
                if not (ref <= m["date"] < nxt): continue
                tr.advance(m["date"])
                prior_both = tr.league_rate(m["date"])
                prior = (0.72, 0.72, prior_both)
                hs, hc, hb, hn, hb5 = tr.team(m["home"], m["date"], prior)
                as_, ac, ab, an, ab5 = tr.team(m["away"], m["date"], prior)
                if hn < 3 or an < 3: continue
                try:
                    pr = M.predict(mdl, m["home"], m["away"])
                except Exception:
                    continue
                if not pr: continue
                dc = pr["p_btts_yes"]; lh, la = pr.get("lambda_home", 1.3), pr.get("lambda_away", 1.1)
                y = 1 if (m["fthg"] > 0 and m["ftag"] > 0) else 0
                # Poisson bağımsız: P(ev atar)·P(dep atar) — λ'lardan doğrudan
                p_ind = (1 - math.exp(-lh)) * (1 - math.exp(-la))
                feats = [logit(dc), logit(hs), logit(hc), logit(as_), logit(ac), logit(hb), logit(ab), logit(prior_both),
                         lh + la, abs(lh - la), logit(p_ind), logit(hb5), logit(ab5)]
                team_p = (hb + ab) / 2
                month_rows.append((feats, y, dc, m, team_p, prior_both))
        if mi >= args.warmup and platt is not None:
            n_eval_months += 1
            for feats, y, dc, m, team_p, prior_both in month_rows:
                scores["dc"].add(dc, y); scores["base"].add(prior_both, y); scores["team"].add(team_p, y)
                pp = predict_logit(platt, [1.0, logit(dc)]); scores["platt"].add(pp, y)
                pl = predict_logit(logit_w, [1.0] + feats); scores["logit"].add(pl, y)
                ens = (team_p + pl) / 2; scores["ens"].add(ens, y)
                mp = odds.get(m.get("id"))
                if mp is not None:
                    scores["market"].add(mp, y); mk_dc.add(pl, y); scores["mk_team"].add(team_p, y)
                    scores["blend"].add(0.5 * mp + 0.5 * pl, y)
        train_rows.extend((f, y, d) for f, y, d, _, _, _ in month_rows)
        print(f"  {ref:%Y-%m}: {len(month_rows)} maç" + (" (eğitim)" if mi < args.warmup or platt is None else ""), flush=True)

    print(f"\n=== KG Var — örneklem dışı {n_eval_months} ay, {scores['dc'].n} maç")
    for k in ("base", "dc", "platt", "team", "logit", "ens"):
        print(scores[k].row(k))
    print("  kalibrasyon (tahmin kovası: gerçek oran(n)):")
    for k in ("dc", "platt", "logit"):
        print(f"    {k:6} {scores[k].calib()}")
    if scores["market"].n:
        print(f"\n=== piyasa alt kümesi ({scores['market'].n} maç)")
        print(mk_dc.row("logit")); print(scores["mk_team"].row("team")); print(scores["market"].row("market")); print(scores["blend"].row("blend50"))
    if logit_w:
        names = ["sabit", "logit(dc)", "ev_atar", "ev_yer", "dep_atar", "dep_yer", "ev_kg", "dep_kg", "lig_kg", "λ_top", "|Δλ|", "p_bağımsız", "ev_kg5", "dep_kg5"]
        print("\nson lojistik katsayılar:", ", ".join(f"{n}={w:.2f}" for n, w in zip(names, logit_w)))


if __name__ == "__main__":
    main()
