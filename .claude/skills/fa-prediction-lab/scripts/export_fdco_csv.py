#!/usr/bin/env python3
"""
export_fdco_csv.py — football-data.co.uk maçlarını (engine/data.py yükleyicisiyle)
`football-match-forecasting` skill script'lerinin beklediği CSV'ye yazar:
  date,home_team,away_team,home_score,away_score,tournament,neutral

Kullanım (repo kökünden):
  python3 .claude/skills/fa-prediction-lab/scripts/export_fdco_csv.py E0 2019 2025 /tmp/e0.csv
  python3 .claude/skills/fa-prediction-lab/scripts/export_fdco_csv.py E0,SP1,I1 2019 2025 /tmp/top3.csv

Sonra:
  python3 .claude/skills/football-match-forecasting/scripts/calibrate_backtest.py /tmp/e0.csv --test-from 2021-08-01
  python3 .claude/skills/football-match-forecasting/scripts/build_team_ratings.py /tmp/e0.csv /tmp/e0-ratings.json

Not: `tournament` = lig kodu (script K-faktörü için 30 kullanır), `neutral` = 0 (kulüp ligi).
Ağ gerekir (cache ENGINE_CACHE=/tmp/ffdata). Ayrıca aynı satırlara kapanış oranlarını
`--with-odds` ile ek sütun olarak yazar (gate.py için JSONL üretmek istersen `--jsonl`).
"""
import csv, json, os, sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, "..", "..", "..", ".."))
sys.path.insert(0, os.path.join(ROOT, "engine"))
from data import load_matches  # noqa: E402


def main():
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    flags = {a for a in sys.argv[1:] if a.startswith("--")}
    if len(args) != 4:
        sys.exit(__doc__)
    leagues, y0, y1, out = args[0].split(","), int(args[1]), int(args[2]), args[3]
    rows = []
    for lg in leagues:
        ms = load_matches(lg, y0, y1)
        print(f"[export] {lg}: {len(ms)} maç", file=sys.stderr)
        for m in ms:
            rows.append((lg, m))
    rows.sort(key=lambda x: x[1]["date"])
    if "--jsonl" in flags:
        with open(out, "w", encoding="utf-8") as f:
            for lg, m in rows:
                f.write(json.dumps({
                    "league": lg, "date": m["date"].strftime("%Y-%m-%d"), "season": m["season"],
                    "home": m["home"], "away": m["away"], "fthg": m["fthg"], "ftag": m["ftag"],
                    "result": m["ftr"], "odds_home": m["odds_home"], "odds_draw": m["odds_draw"],
                    "odds_away": m["odds_away"]}, ensure_ascii=False) + "\n")
    else:
        with open(out, "w", newline="", encoding="utf-8") as f:
            w = csv.writer(f)
            hdr = ["date", "home_team", "away_team", "home_score", "away_score", "tournament", "neutral"]
            if "--with-odds" in flags:
                hdr += ["odds_home", "odds_draw", "odds_away"]
            w.writerow(hdr)
            for lg, m in rows:
                r = [m["date"].strftime("%Y-%m-%d"), m["home"], m["away"], m["fthg"], m["ftag"], lg, 0]
                if "--with-odds" in flags:
                    r += [m["odds_home"], m["odds_draw"], m["odds_away"]]
                w.writerow(r)
    print(f"[export] {len(rows)} satır → {out}", file=sys.stderr)


if __name__ == "__main__":
    main()
