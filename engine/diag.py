"""
Tanı: yarınki maçlar neden tahmin edilemiyor?
engine/ dizininden:  .venv/bin/python diag.py
Her NS maç için: lig maç sayısı (>=MIN?), takımlar o ligin fit setinde mi,
ve takımların TÜM ligler genelindeki toplam maç sayısı.
"""
import os
import sys
from collections import Counter
from datetime import datetime, timezone, timedelta

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import store

MIN = int(os.environ.get("MIN_LEAGUE_MATCHES", "150"))


def main():
    s = store.ResultStore()
    s._load()

    # tüm ligler genelinde takım -> toplam maç sayısı
    team_total = Counter()
    for lid, rows in s._by_league.items():
        for r in rows:
            team_total[str(r.get("homeId"))] += 1
            team_total[str(r.get("awayId"))] += 1

    tom = (datetime.now(timezone.utc).date() + timedelta(days=1)).strftime("%Y%m%d")
    ms = store.matches_by_date(tom)
    ns = [m for m in ms
          if not (m.get("status") or {}).get("started")
          and not (m.get("status") or {}).get("finished")]
    print(f"yarın {tom}: toplam {len(ms)} maç, başlamamış (NS) {len(ns)}")
    print(f"MIN_LEAGUE_MATCHES = {MIN}\n")

    can = 0
    for m in ns:
        lid = m.get("leagueId")
        cnt = s.league_count(lid)
        fit = s.load_for_fit(lid)
        teams = {x["home"] for x in fit} | {x["away"] for x in fit}
        h = str((m.get("home") or {}).get("id"))
        a = str((m.get("away") or {}).get("id"))
        hn = (m.get("home") or {}).get("name", "?")
        an = (m.get("away") or {}).get("name", "?")
        league_ok = cnt >= MIN
        teams_ok = h in teams and a in teams
        ok = league_ok and teams_ok
        if ok:
            can += 1
        print(f"  L{lid} ({cnt} maç {'OK' if league_ok else 'AZ'}) | "
              f"{hn}[lig:{'+' if h in teams else '-'} global:{team_total[h]}] vs "
              f"{an}[lig:{'+' if a in teams else '-'} global:{team_total[a]}] "
              f"-> {'TAHMIN' if ok else 'ELE'}")
    print(f"\ntahmin edilebilir: {can}/{len(ns)}")


if __name__ == "__main__":
    main()
