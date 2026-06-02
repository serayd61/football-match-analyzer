"""
Lig adı kaynağı teşhisi — engine/ dizininden çalıştır:
    .venv/bin/python probe_names.py
Match-detail / team-detail endpoint'lerini dener, lig adı nerede diye bakar.
"""
import json
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import store

# Bilinen bir maç (Toluca-Tigres, leagueId 915924) ve takımı (Toluca=6618)
CANDS = [
    "/football-get-match-detail?matchid=5165120",
    "/football-match-detail?matchid=5165120",
    "/football-get-match-by-id?matchid=5165120",
    "/football-match-info?matchid=5165120",
    "/football-get-event-detail?eventid=5165120",
    "/football-get-team-detail?teamid=6618",
    "/football-team-detail?teamid=6618",
    "/football-get-all-matches-by-league?leagueid=915924",
    "/football-league-table?leagueid=915924",
]
KEYWORDS = ("leagueName", "tournament", "primaryLeague", "parentLeague", "leagueId", "name")


def main():
    for p in CANDS:
        try:
            j = store._fetch(p)
        except Exception as e:
            print("ERR ", p, "->", e)
            continue
        s = json.dumps(j, ensure_ascii=False)
        ok = isinstance(j, dict) and j.get("status") != "failed"
        print(("OK   " if ok else "FAIL ") + p + "  (len " + str(len(s)) + ")")
        if ok:
            for kw in KEYWORDS:
                i = s.find(kw)
                if i >= 0:
                    print("        " + kw + " -> " + s[i:i + 120])
            print("        İLK 300:", s[:300])


if __name__ == "__main__":
    main()
