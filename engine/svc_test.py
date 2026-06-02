"""
Çalışan predict-service'i doğrudan test eder (yarınki maçlarla).
engine/ dizininden:  .venv/bin/python svc_test.py
FOOTBALL_API_KEY + STORE_PATH export edilmiş olmalı.
"""
import json
import os
import sys
import urllib.request
from datetime import datetime, timezone, timedelta

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import store

URL = os.environ.get("PREDICT_URL", "http://127.0.0.1:8000/predict")


def main():
    tom = (datetime.now(timezone.utc).date() + timedelta(days=1)).strftime("%Y%m%d")
    ms = store.matches_by_date(tom)
    fixtures = []
    for m in ms:
        st = m.get("status") or {}
        if st.get("started") or st.get("finished"):
            continue
        h = (m.get("home") or {})
        a = (m.get("away") or {})
        fixtures.append({
            "id": m.get("id"),
            "leagueId": m.get("leagueId"),
            "homeTeamId": h.get("id"),
            "awayTeamId": a.get("id"),
            "homeTeam": h.get("name"),
            "awayTeam": a.get("name"),
            "date": st.get("utcTime"),
        })
    print(f"gönderilen fixture: {len(fixtures)}  -> {URL}")
    body = json.dumps({"fixtures": fixtures}).encode()
    req = urllib.request.Request(URL, data=body, headers={"Content-Type": "application/json"})
    with urllib.request.urlopen(req, timeout=120) as r:
        resp = json.load(r)
    print(f"SERVIS -> predicted: {resp.get('predicted')}  skipped: {resp.get('skipped')}  version: {resp.get('version')}")
    for p in resp.get("predictions", [])[:6]:
        print(f"  {p['homeName']} vs {p['awayName']}: {p['pick']} (%{p['confidence']*100:.0f}) "
              f"1/X/2 = %{p['p_home']*100:.0f}/%{p['p_draw']*100:.0f}/%{p['p_away']*100:.0f}")


if __name__ == "__main__":
    main()
