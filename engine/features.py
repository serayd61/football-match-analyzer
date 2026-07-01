"""
Özellik-veri katmanı (provenance'lı): gol (football-data.co.uk) + xG (Understat/soccerdata).
Maç başına birleştirilmiş eğitim çerçevesi üretir; her kayıt kaynak üçlüsü taşır:
  sources = {"goals": {...}, "xg": {...}}  → source_name / source_url / fetched_at

Takım-adı normalizasyonu #1 risk: FD ("Man City") ↔ Understat ("Manchester City").
Sezon-içi çift-yönlü eşleme: alias sözlüğü → normalize-eşit → difflib fallback (greedy bijection).
Eşleşmeyen takım = uyarı + kapsama logu (sessiz veri düşmesi yok).

soccerdata gerektirir → venv python ile çalıştır:
  SOCCERDATA_DIR=/tmp/soccerdata ../src/lib/data-sources/venv/bin/python features.py E0
"""
import difflib
import re
import sys
import unicodedata
from datetime import datetime, timezone

from data import load_matches, season_codes

# FD kodu → (Understat lig adı). Kapsanan ligler.
LEAGUES = {
    "E0":  "ENG-Premier League",
    "SP1": "ESP-La Liga",
    "I1":  "ITA-Serie A",
    "D1":  "GER-Bundesliga",
    "F1":  "FRA-Ligue 1",
}

# Bilinen zor eşleşmeler için canonical alias (normalize edilmiş anahtar → canonical token).
# Hem FD hem Understat yüzey formları aynı canonical'a iner. Genişletilebilir.
_ALIASES = {
    # ENG
    "man city": "manchester city", "man utd": "manchester united",
    "newcastle": "newcastle united", "nottm forest": "nottingham forest",
    "notts forest": "nottingham forest", "wolves": "wolverhampton wanderers",
    "spurs": "tottenham", "tottenham hotspur": "tottenham",
    "west ham united": "west ham", "sheffield utd": "sheffield united",
    "brighton and hove albion": "brighton", "brighton hove albion": "brighton",
    "leeds united": "leeds", "leicester city": "leicester", "norwich city": "norwich",
    "west brom": "west bromwich albion", "huddersfield town": "huddersfield",
    # ESP
    "ath madrid": "atletico madrid", "atletico": "atletico madrid",
    "ath bilbao": "athletic club", "athletic bilbao": "athletic club",
    "betis": "real betis", "sociedad": "real sociedad", "espanol": "espanyol",
    "vallecano": "rayo vallecano", "celta": "celta vigo", "cadiz": "cadiz",
    "alaves": "deportivo alaves", "valladolid": "real valladolid",
    "la coruna": "deportivo la coruna",
    # ITA
    "inter": "internazionale", "milan": "ac milan", "verona": "hellas verona",
    "spal": "spal", "parma": "parma calcio",
    # GER
    "bayern munich": "bayern munich", "dortmund": "borussia dortmund",
    "ein frankfurt": "eintracht frankfurt", "leverkusen": "bayer leverkusen",
    "mgladbach": "borussia m gladbach", "m gladbach": "borussia m gladbach",
    "monchengladbach": "borussia m gladbach", "werder bremen": "werder bremen",
    "hoffenheim": "hoffenheim", "fc koln": "fc cologne", "koln": "fc cologne",
    "cologne": "fc cologne", "mainz": "mainz 05", "stuttgart": "vfb stuttgart",
    "wolfsburg": "vfl wolfsburg", "schalke": "schalke 04", "union berlin": "union berlin",
    # FRA
    "paris sg": "paris saint germain", "psg": "paris saint germain",
    "marseille": "marseille", "st etienne": "saint etienne", "lille": "lille",
    "nimes": "nimes", "paris fc": "paris fc",
}


def _strip_accents(s: str) -> str:
    return "".join(c for c in unicodedata.normalize("NFKD", s) if not unicodedata.combining(c))


def canon(name: str) -> str:
    """Normalize: aksan/nokta/kesme/çoklu boşluk temizle, alias uygula."""
    s = _strip_accents((name or "").lower().strip())
    s = s.replace("&", " and ").replace("'", "").replace(".", " ").replace("-", " ")
    s = re.sub(r"[^a-z0-9 ]", " ", s)
    s = re.sub(r"\s+", " ", s).strip()
    if s in _ALIASES:
        s = _ALIASES[s]
    # yaygın gürültü ekleri (alias sonrası bir daha dene)
    if s in _ALIASES:
        s = _ALIASES[s]
    return s


def build_team_map(fd_teams, us_teams):
    """
    Understat adı → FD adı eşlemesi (sezon-içi bijection).
    Önce canonical-eşit, sonra difflib greedy en-iyi eşleşme. Eşleşmeyeni raporlar.
    """
    fd_by_canon = {}
    for t in fd_teams:
        fd_by_canon.setdefault(canon(t), t)

    mapping = {}          # us_name -> fd_name
    used_fd = set()
    unmatched_us = []

    # 1) canonical-eşit
    remaining_us = []
    for us in us_teams:
        c = canon(us)
        if c in fd_by_canon and fd_by_canon[c] not in used_fd:
            mapping[us] = fd_by_canon[c]
            used_fd.add(fd_by_canon[c])
        else:
            remaining_us.append(us)

    # 2) difflib fallback (kalan FD'ler arasında en yakın)
    fd_pool = [t for t in fd_teams if t not in used_fd]
    fd_canons = {t: canon(t) for t in fd_pool}
    for us in remaining_us:
        c = canon(us)
        best, best_score = None, 0.0
        for t in fd_pool:
            if t in used_fd:
                continue
            score = difflib.SequenceMatcher(None, c, fd_canons[t]).ratio()
            if score > best_score:
                best, best_score = t, score
        if best and best_score >= 0.55:
            mapping[us] = best
            used_fd.add(best)
        else:
            unmatched_us.append((us, best, round(best_score, 2)))

    return mapping, unmatched_us


def load_features(fd_code, start_year, end_year, verbose=True):
    """
    Sezon-sezon FD(gol+oran) + Understat(xG) birleştir. Provenance'lı kayıt listesi döndürür.
    Her kayıt: date, season, home, away (FD adı), fthg, ftag, ftr, odds_*, home_xg, away_xg, sources.
    """
    import logging
    logging.disable(logging.CRITICAL)
    import soccerdata as sd

    us_league = LEAGUES.get(fd_code)
    if not us_league:
        raise ValueError(f"{fd_code} kapsanan xG ligi değil: {list(LEAGUES)}")

    out = []
    total_fd = total_matched = 0
    fetched_at = datetime.now(timezone.utc).isoformat()

    for season in season_codes(start_year, end_year):
        year = 2000 + int(season[:2])
        fd = load_matches(fd_code, year, year)
        if not fd:
            continue
        total_fd += len(fd)

        # Understat schedule (tek sezon)
        try:
            us = sd.Understat(leagues=us_league, seasons=season)
            sch = us.read_schedule().reset_index()
        except Exception as e:
            if verbose:
                print(f"  [xg] {fd_code} {season} Understat çekilemedi: {e}")
            continue
        sch = sch[sch["is_result"] == True] if "is_result" in sch.columns else sch

        fd_teams = sorted({m["home"] for m in fd} | {m["away"] for m in fd})
        us_teams = sorted(set(sch["home_team"]) | set(sch["away_team"]))
        tmap, unmatched = build_team_map(fd_teams, us_teams)
        if verbose and unmatched:
            print(f"  [xg] {fd_code} {season} EŞLEŞMEYEN Understat takım: {unmatched}")

        # (home_fd, away_fd) -> (home_xg, away_xg)
        xg_by_pair = {}
        for _, r in sch.iterrows():
            h = tmap.get(r["home_team"]); a = tmap.get(r["away_team"])
            if not h or not a:
                continue
            try:
                xg_by_pair[(h, a)] = (float(r["home_xg"]), float(r["away_xg"]))
            except (TypeError, ValueError):
                continue

        for m in fd:
            xg = xg_by_pair.get((m["home"], m["away"]))
            rec = dict(m)
            rec["home_xg"] = xg[0] if xg else None
            rec["away_xg"] = xg[1] if xg else None
            rec["sources"] = {
                "goals": {"source_name": "football-data.co.uk",
                          "source_url": f"https://www.football-data.co.uk/mmz4281/{season}/{fd_code}.csv",
                          "fetched_at": fetched_at},
                "xg": ({"source_name": "understat.com",
                        "source_url": f"https://understat.com/league/{us_league}",
                        "fetched_at": fetched_at} if xg else None),
            }
            if xg:
                total_matched += 1
            out.append(rec)

    out.sort(key=lambda m: m["date"])
    cov = (total_matched / total_fd * 100) if total_fd else 0.0
    if verbose:
        print(f"[features] {fd_code}: {total_fd} FD maçı, {total_matched} xG eşleşti (kapsama %{cov:.1f})")
    return out, {"total": total_fd, "matched": total_matched, "coverage_pct": round(cov, 1)}


if __name__ == "__main__":
    code = sys.argv[1] if len(sys.argv) > 1 else "E0"
    recs, stats = load_features(code, 2019, 2024)
    print("STATS:", stats)
    sample = next((r for r in recs if r["home_xg"] is not None), None)
    if sample:
        print("ÖRNEK:", sample["date"].date(), sample["home"], sample["fthg"], "-", sample["ftag"],
              sample["away"], "| xG", round(sample["home_xg"], 2), "-", round(sample["away_xg"], 2))
