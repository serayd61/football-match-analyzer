"""
Yeni gelen takım önceliği (model.fit new_team_k / new_team_days) — walk-forward kapı testi.

Soru (Reddit r/sportsanalytics 2026-11-14 + Championship piyasa testi 2026-11-22): lige yeni
gelen takımların (yükselen/düşen, ligde geçmişi yok) atak/defans derecesini ilk maçlarda lig
ortalamasına çekmek, canlı modele (dc-1.0: shrink_k=0) göre walk-forward log-loss/Brier'i
düşürür mü? Canlı teşhis: 2026/27 Championship'te model yeni gelenlere (Lincoln, Cardiff)
Ağustos'ta piyasadan 15–29 pp fazla güven verdi; fark Ekim'de kapandı.

Kurulum (experiment-protocol.md): baseline = canlı parametreler (half_life 180, window 540,
rho −0.10, iters 25, min_matches 120, shrink_k 0, min_team_matches 6). Her maç için
ref_date = maç günü, fit yalnız öncesi, aynı gün tek fit. Canlıdaki "team_too_few_matches"
atlaması aynen uygulanır (n_eff < 6 → satır yok) ve maske BASELINE'dan alınır, bütün kollar
aynı n. Kollar: global shrink_k (karşılaştırma) ve new_team_k × new_team_days.
Parite: new_team_k=0 → baseline birebir (test_newcomer.py).

  python3 engine/backtest_newcomer.py --leagues E1,E0,SP1,I1,D1,F1 --out /tmp/gate-newcomer
  python3 .claude/skills/fa-prediction-lab/scripts/gate.py /tmp/gate-newcomer/base.jsonl /tmp/gate-newcomer/new_k8_d270.jsonl
Ek: her kol için "yeni takım dahil" ve "sezonun ilk 60 günü" alt kümeleri ayrıca raporlanır.
"""
import argparse
import json
import math
import os
from collections import defaultdict

from data import load_matches
import model as M

OUT = ("H", "D", "A")
KEY = {"H": "p_home", "D": "p_draw", "A": "p_away"}
LIVE = dict(half_life_days=180, window_days=540, iters=25, min_matches=120, rho=-0.10, shrink_k=0.0)
MIN_TEAM = 6.0


def arms_spec(raw):
    """'base,shrink8,new_k8_d270' → [(name, kwargs)]"""
    out = []
    for a in raw.split(","):
        a = a.strip()
        if not a:
            continue
        if a == "base":
            out.append((a, {}))
        elif a.startswith("shrink"):
            out.append((a, {"shrink_k": float(a[6:])}))
        elif a.startswith("new_k"):
            k, d = a[5:].split("_d")
            out.append((a, {"new_team_k": float(k), "new_team_days": int(d)}))
        else:
            raise SystemExit(f"bilinmeyen kol: {a}")
    return out


def ll(p, r):
    return -math.log(max(p[KEY[r]], 1e-12))


def brier(p, r):
    return sum((p[KEY[o]] - (1.0 if r == o else 0.0)) ** 2 for o in OUT)


def season_start(matches):
    """sezon kodu → ilk maç günü (ordinal)."""
    s = {}
    for m in matches:
        o = m["date"].toordinal()
        if m["season"] not in s or o < s[m["season"]]:
            s[m["season"]] = o
    return s


def run_league(lg, start, end, test_from, arms, early_days):
    matches = load_matches(lg, start, end)
    sst = season_start(matches)
    rows = {name: [] for name, _ in arms}
    cache = {}

    def get(name, kw, ref):
        key = (name, ref.toordinal())
        if key not in cache:
            cache[key] = M.fit(matches, ref, **{**LIVE, **kw})
        return cache[key]

    for m in matches:
        if m["season"] < test_from:
            continue
        base = get("base", {}, m["date"])
        if base is None or m["home"] not in base["teams"] or m["away"] not in base["teams"]:
            continue
        ne = base["n_eff"]
        if min(ne.get(m["home"], 0.0), ne.get(m["away"], 0.0)) < MIN_TEAM:
            continue
        r = m["ftr"]
        if r not in OUT:
            continue
        # yeni takım etiketi: ligdeki ilk maçı sezon başından sonra (540 gün penceresinde ilk kez)
        newc = M.newcomers([x for x in matches if x["date"] < m["date"] and x["date"].toordinal() >= m["date"].toordinal() - 540], m["date"], 300)
        involved = m["home"] in newc or m["away"] in newc
        early = (m["date"].toordinal() - sst[m["season"]]) <= early_days
        for name, kw in arms:
            mdl = base if name == "base" else get(name, kw, m["date"])
            if mdl is None:
                raise SystemExit(f"{lg} {m['date'].date()} {name}: fit None (maske baseline'dan geliyor, olmamalı)")
            pr = M.predict(mdl, m["home"], m["away"])
            rows[name].append({"league": lg, "date": m["date"].strftime("%Y-%m-%d"), "season": m["season"],
                               "home": m["home"], "away": m["away"], "result": r,
                               "p_home": round(pr["p_home"], 6), "p_draw": round(pr["p_draw"], 6), "p_away": round(pr["p_away"], 6),
                               "odds_home": m["odds_home"], "odds_draw": m["odds_draw"], "odds_away": m["odds_away"],
                               "newcomer": involved, "early": early})
    return rows


def summarize(rows_by_arm, label, flt):
    print(f"\n== {label} ==")
    base = [x for x in rows_by_arm["base"] if flt(x)]
    n = len(base)
    if not n:
        print("  n=0"); return
    bl = sum(ll(x, x["result"]) for x in base) / n
    bb = sum(brier(x, x["result"]) for x in base) / n
    print(f"  {'kol':14s} {'n':>6s} {'LL':>7s} {'ΔLL':>8s} {'Brier':>7s} {'ΔBrier':>8s}")
    print(f"  {'base':14s} {n:6d} {bl:7.4f} {'':8s} {bb:7.4f}")
    for name, rows in rows_by_arm.items():
        if name == "base":
            continue
        sub = [x for x in rows if flt(x)]
        l = sum(ll(x, x["result"]) for x in sub) / n
        b = sum(brier(x, x["result"]) for x in sub) / n
        print(f"  {name:14s} {n:6d} {l:7.4f} {l-bl:+8.4f} {b:7.4f} {b-bb:+8.4f}")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--leagues", default="E1,E0,SP1,I1,D1,F1")
    ap.add_argument("--start", type=int, default=2019)
    ap.add_argument("--end", type=int, default=2025)
    ap.add_argument("--test-from", default="2122")
    ap.add_argument("--arms", default="base,shrink4,shrink8,new_k4_d300,new_k8_d300,new_k15_d300,new_k8_d150")
    ap.add_argument("--early-days", type=int, default=60)
    ap.add_argument("--out", default="/tmp/gate-newcomer")
    a = ap.parse_args()
    arms = arms_spec(a.arms)
    os.makedirs(a.out, exist_ok=True)
    all_rows = {name: [] for name, _ in arms}
    for lg in a.leagues.split(","):
        lg = lg.strip()
        rows = run_league(lg, a.start, a.end, a.test_from, arms, a.early_days)
        for name in all_rows:
            all_rows[name].extend(rows[name])
        print(f"[{lg}] n={len(rows['base'])} newcomer-involved={sum(1 for x in rows['base'] if x['newcomer'])} early={sum(1 for x in rows['base'] if x['early'])}", flush=True)
    for name, rows in all_rows.items():
        with open(os.path.join(a.out, f"{name}.jsonl"), "w") as f:
            for x in rows:
                f.write(json.dumps(x) + "\n")
    summarize(all_rows, "TOPLAM", lambda x: True)
    summarize(all_rows, "yeni takım dahil maçlar", lambda x: x["newcomer"])
    summarize(all_rows, f"sezonun ilk {a.early_days} günü", lambda x: x["early"])
    summarize(all_rows, "yeni takım dahil VE erken", lambda x: x["newcomer"] and x["early"])
    for lg in a.leagues.split(","):
        summarize(all_rows, f"{lg.strip()} — yeni takım dahil", lambda x, L=lg.strip(): x["league"] == L and x["newcomer"])
    print(f"\nçıktı: {a.out}/<kol>.jsonl → gate.py base.jsonl <kol>.jsonl")


if __name__ == "__main__":
    main()
