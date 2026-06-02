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
        h = str((m.get("home") or {}).get("id"))
        a = str((m.get("away") or {}).get("id"))
        hn = (m.get("home") or {}).get("name", "?")
        an = (m.get("away") or {}).get("name", "?")
        ch = s.component_id(h)
        ca = s.component_id(a)
        same = ch is not None and ch == ca
        size = s.component_size(h) if ch else 0
        ok = same and size >= MIN
        if ok:
            can += 1
        print(f"  {hn}[g:{team_total[h]}] vs {an}[g:{team_total[a]}] | "
              f"havuz {'AYNI' if same else 'FARKLI/yok'} ({size} maç) "
              f"-> {'TAHMIN' if ok else 'ELE'}")
    print(f"\ntahmin edilebilir (bileşen-bazlı): {can}/{len(ns)}")


if __name__ == "__main__":
    main()
