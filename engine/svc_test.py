"""
Çalışan predict-service'i test eder — fixture'ları SİTEDEN çeker (n8n gibi, API anahtarı gerekmez).
engine/ dizininden:  .venv/bin/python svc_test.py
"""
import json
import os
import urllib.request
from datetime import datetime, timezone, timedelta

SITE = os.environ.get("SITE_BASE", "https://footballanalytics.pro")
PREDICT_URL = os.environ.get("PREDICT_URL", "http://127.0.0.1:8000/predict")


def _get(url):
    req = urllib.request.Request(url, headers={"User-Agent": "svc_test"})
    with urllib.request.urlopen(req, timeout=30) as r:
        return json.load(r)


def main():
    date = (datetime.now(timezone.utc).date() + timedelta(days=1)).strftime("%Y-%m-%d")
    data = _get(f"{SITE}/api/v2/fixtures?date={date}")
    allf = (data.get("data") or {}).get("fixtures") or data.get("fixtures") or []
    upcoming = [f for f in allf if f.get("status") == "NS"]
    print(f"siteden {date}: {len(allf)} fixture, {len(upcoming)} başlamamış (NS)")

    body = json.dumps({"fixtures": upcoming}).encode()
    req = urllib.request.Request(PREDICT_URL, data=body, headers={"Content-Type": "application/json"})
    with urllib.request.urlopen(req, timeout=120) as r:
        resp = json.load(r)
    print(f"SERVIS -> predicted: {resp.get('predicted')}  skipped: {resp.get('skipped')}  version: {resp.get('version')}")
    print(f"skip_reasons: {resp.get('skip_reasons')}")
    for p in resp.get("predictions", [])[:8]:
        print(f"  {p['homeName']} vs {p['awayName']}: {p['pick']} (%{p['confidence']*100:.0f}) "
              f"1/X/2 = %{p['p_home']*100:.0f}/%{p['p_draw']*100:.0f}/%{p['p_away']*100:.0f}")


if __name__ == "__main__":
    main()
