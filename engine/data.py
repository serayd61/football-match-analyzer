"""
Veri yükleyici — football-data.co.uk (ücretsiz: sonuç + kapanış oranları).
Saf stdlib (urllib + csv). Bağımlılık yok.
"""
import csv
import io
import os
import urllib.request
from datetime import datetime

CACHE_DIR = os.environ.get("ENGINE_CACHE", "/tmp/ffdata")
BASE = "https://www.football-data.co.uk/mmz4281"

# Lig kodları (football-data.co.uk): E0=Premier League, SP1=LaLiga, I1=Serie A,
# D1=Bundesliga, F1=Ligue 1, N1=Eredivisie, P1=Primeira, T1=Süper Lig, E1=Championship
def season_codes(start_year: int, end_year: int):
    """Örn. 2018,2024 -> ['1819','1920',...,'2425'] (end_year dahil sezon başı)."""
    out = []
    for y in range(start_year, end_year + 1):
        a = str(y)[-2:]
        b = str(y + 1)[-2:]
        out.append(f"{a}{b}")
    return out


def _download(league: str, season: str) -> str:
    os.makedirs(CACHE_DIR, exist_ok=True)
    path = os.path.join(CACHE_DIR, f"{league}_{season}.csv")
    if os.path.exists(path) and os.path.getsize(path) > 1000:
        with open(path, "r", encoding="latin-1") as f:
            return f.read()
    url = f"{BASE}/{season}/{league}.csv"
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
    with urllib.request.urlopen(req, timeout=30) as r:
        raw = r.read().decode("latin-1")
    with open(path, "w", encoding="latin-1") as f:
        f.write(raw)
    return raw


def _parse_date(s: str):
    s = (s or "").strip()
    for fmt in ("%d/%m/%Y", "%d/%m/%y"):
        try:
            return datetime.strptime(s, fmt)
        except ValueError:
            continue
    return None


def _f(row, *keys):
    """İlk dolu sayısal alanı döndür (kapanış oranı önceliği için)."""
    for k in keys:
        v = row.get(k)
        if v not in (None, "", "NA"):
            try:
                return float(v)
            except ValueError:
                pass
    return None


def load_matches(league: str, start_year: int, end_year: int):
    """
    Maç listesi döndürür (tarihe göre sıralı). Her maç:
    date, home, away, fthg, ftag, ftr, odds_home/draw/away (kapanış, Pinnacle>B365>WH)
    """
    matches = []
    for season in season_codes(start_year, end_year):
        try:
            raw = _download(league, season)
        except Exception as e:
            print(f"  [data] {league} {season} indirilemedi: {e}")
            continue
        reader = csv.DictReader(io.StringIO(raw))
        for row in reader:
            # BOM temizliği
            row = { (k.lstrip("﻿") if k else k): v for k, v in row.items() }
            d = _parse_date(row.get("Date", ""))
            fthg, ftag = row.get("FTHG"), row.get("FTAG")
            if d is None or fthg in (None, "", "NA") or ftag in (None, "", "NA"):
                continue
            # Kapanış oranları: PSC (Pinnacle closing) > PS > B365 > WH
            oh = _f(row, "PSCH", "PSH", "B365H", "WHH", "AvgH")
            od = _f(row, "PSCD", "PSD", "B365D", "WHD", "AvgD")
            oa = _f(row, "PSCA", "PSA", "B365A", "WHA", "AvgA")
            try:
                fh, fa = int(float(fthg)), int(float(ftag))
            except ValueError:
                continue
            matches.append({
                "date": d,
                "season": season,
                "home": (row.get("HomeTeam") or "").strip(),
                "away": (row.get("AwayTeam") or "").strip(),
                "fthg": fh,
                "ftag": fa,
                "ftr": row.get("FTR", "").strip(),  # H/D/A
                "odds_home": oh,
                "odds_draw": od,
                "odds_away": oa,
            })
    matches.sort(key=lambda m: m["date"])
    return matches


if __name__ == "__main__":
    ms = load_matches("E0", 2019, 2024)
    print(f"Toplam maç: {len(ms)}")
    if ms:
        print("İlk:", ms[0]["date"].date(), ms[0]["home"], ms[0]["fthg"], "-", ms[0]["ftag"], ms[0]["away"],
              "odds", ms[0]["odds_home"], ms[0]["odds_draw"], ms[0]["odds_away"])
        print("Son:", ms[-1]["date"].date(), ms[-1]["home"], ms[-1]["away"])
        with_odds = sum(1 for m in ms if m["odds_home"])
        print(f"Oranı olan maç: {with_odds}/{len(ms)}")
