"""
xG yan deposu — canlı Yol A (predict-service) için Understat xG'yi FotMob maç id'lerine bağlar.

Neden: reports/backtest-xg-gate.md (2026-09-05) xG-DC'nin (w=0.75) gol-DC'ye göre 5/5 ligde
log-loss'u düşürdüğünü güven aralığıyla doğruladı; canlı servis hâlâ yalnız gol kullanıyordu.

Akış:
  store.py deposu (FotMob id + longName)  ──ad eşleme (features.canon + difflib, lig içi
  bijection)──▶ Understat sezon programı ──(homeId, awayId, tarih ±1 gün)──▶ xg.jsonl
      {"id": <FotMob maç id>, "leagueId", "homeId", "awayId", "date", "home_xg", "away_xg"}

Kapsam disiplini: her lig için eşleşmeyen takımlar ve eşleşen maç oranı loglanır; servis
bir ligde kapsam XG_MIN_COVERAGE altındaysa o ligde gol-DC'ye (dc-1.0) düşer.

Kullanım (Hetzner venv, soccerdata gerekir; günlük cron'da store update'ten sonra):
  STORE_PATH=/var/lib/footy/results.jsonl SOCCERDATA_DIR=/var/lib/footy/soccerdata \
    .venv/bin/python store_xg.py build [--days 600]
  python store_xg.py stats
"""
import difflib
import json
import os
import sys
from datetime import datetime, timedelta, timezone

from features import canon  # stdlib normalizasyon + alias sözlüğü (FD/Understat yüzey formları)
from store import STORE_PATH, _parse_dt

# FotMob lig id → Understat lig adı (src/lib/site/leagues.ts ile aynı id'ler)
XG_LEAGUES = {
    47: "ENG-Premier League",
    87: "ESP-La Liga",
    55: "ITA-Serie A",
    54: "GER-Bundesliga",
    53: "FRA-Ligue 1",
}

XG_PATH = os.environ.get("XG_PATH", os.path.join(os.path.dirname(STORE_PATH) or ".", "xg.jsonl"))

# FotMob longName yüzey formu → canonical (features._ALIASES'in kapsamadığı FotMob'a özgü adlar)
_FOTMOB_FIX = {
    "wolverhampton wanderers": "wolverhampton wanderers",
    "brighton and hove albion": "brighton",
    "west ham united": "west ham",
    "tottenham hotspur": "tottenham",
    "nottingham forest": "nottingham forest",
    "athletic club": "athletic club",
    "atletico madrid": "atletico madrid",
    "real betis": "real betis",
    "internazionale": "internazionale",
    "inter": "internazionale",
    "hellas verona": "hellas verona",
    "bayern munchen": "bayern munich",
    "bayern munich": "bayern munich",
    "borussia monchengladbach": "borussia m gladbach",
    "1 fc koln": "fc cologne",
    "1 fc union berlin": "union berlin",
    "1 fsv mainz 05": "mainz 05",
    "fsv mainz 05": "mainz 05",
    "eintracht frankfurt": "eintracht frankfurt",
    "sc freiburg": "freiburg",
    "vfl bochum": "bochum",
    "tsg hoffenheim": "hoffenheim",
    "paris saint germain": "paris saint germain",
    "olympique marseille": "marseille",
    "olympique lyonnais": "lyon",
    "as monaco": "monaco",
    "losc lille": "lille",
    "stade rennais": "rennes",
    "rc lens": "lens",
    "ogc nice": "nice",
    "fc nantes": "nantes",
    "stade brestois 29": "brest",
    "stade de reims": "reims",
    "rc strasbourg alsace": "strasbourg",
    "as saint etienne": "saint etienne",
    "montpellier hsc": "montpellier",
    "toulouse fc": "toulouse",
    "fc lorient": "lorient",
    "le havre ac": "le havre",
    "aj auxerre": "auxerre",
    "angers sco": "angers",
}


def canon_fotmob(name):
    c = canon(name)
    return _FOTMOB_FIX.get(c, c)


def _strip_common(s):
    """'fc', 'cf', 'sc', 'ac' gibi ekleri düşür (ikinci geçiş için)."""
    toks = [t for t in s.split() if t not in {"fc", "cf", "sc", "ac", "as", "ssc", "us", "afc", "rc", "og", "sv", "vfb", "vfl", "tsg", "fsv", "1", "1899", "1904", "1909", "1913", "04", "05", "09"}]
    return " ".join(toks) or s


def map_teams(fotmob_teams, us_teams, min_ratio=0.6):
    """
    Understat adı → FotMob (id) eşlemesi (lig içi bijection).
    fotmob_teams: {id: longName}. Döndürür: (mapping {us_name: fotmob_id}, unmatched_us [..]).
    1) canonical eşit, 2) ek-düşürülmüş eşit, 3) difflib en yakın (eşik).
    """
    fm_by_c = {}
    fm_by_s = {}
    for tid, name in fotmob_teams.items():
        c = canon_fotmob(name)
        fm_by_c.setdefault(c, tid)
        fm_by_s.setdefault(_strip_common(c), tid)
    mapping, used, remaining = {}, set(), []
    for us in us_teams:
        c = canon(us)
        tid = fm_by_c.get(c)
        if tid is None:
            tid = fm_by_s.get(_strip_common(c))
        if tid is not None and tid not in used:
            mapping[us] = tid; used.add(tid)
        else:
            remaining.append(us)
    pool = [(tid, _strip_common(canon_fotmob(n))) for tid, n in fotmob_teams.items() if tid not in used]
    unmatched = []
    for us in remaining:
        c = _strip_common(canon(us))
        best, score = None, 0.0
        for tid, fc in pool:
            if tid in used:
                continue
            r = difflib.SequenceMatcher(None, c, fc).ratio()
            if r > score:
                best, score = tid, r
        if best is not None and score >= min_ratio:
            mapping[us] = best; used.add(best)
        else:
            unmatched.append(us)
    return mapping, unmatched


def _seasons_for(days):
    """Bugünden `days` gün geriye giden pencereyi kapsayan Understat sezon kodları ('2425' gibi)."""
    today = datetime.now(timezone.utc)
    start = today - timedelta(days=days)
    def season_start_year(d):
        return d.year if d.month >= 7 else d.year - 1
    ys = range(season_start_year(start), season_start_year(today) + 1)
    return [f"{str(y)[-2:]}{str(y + 1)[-2:]}" for y in ys]


def _load_store_rows():
    by = {}
    if not os.path.exists(STORE_PATH):
        return by
    with open(STORE_PATH, encoding="utf-8") as f:
        for line in f:
            try:
                r = json.loads(line)
            except Exception:
                continue
            by.setdefault(r.get("leagueId"), []).append(r)
    return by


def build(days=600, out_path=XG_PATH, verbose=True):
    """Understat'tan çek, FotMob maçlarına bağla, xg.jsonl yaz. Lig başına kapsam döndürür."""
    import logging
    logging.disable(logging.CRITICAL)
    import soccerdata as sd

    rows_by_league = _load_store_rows()
    seasons = _seasons_for(days)
    # store._parse_dt saat dilimsiz (naive UTC) döndürür; karşılaştırma için cutoff da naive.
    cutoff = datetime.now(timezone.utc).replace(tzinfo=None) - timedelta(days=days)
    out = []
    report = {}
    for lid, us_league in XG_LEAGUES.items():
        rows = [r for r in rows_by_league.get(lid, []) if (_parse_dt(r.get("date")) or cutoff) >= cutoff]
        if not rows:
            report[lid] = {"league": us_league, "matches": 0, "matched": 0, "coverage": 0.0, "unmatched": []}
            continue
        fm_teams = {}
        for r in rows:
            fm_teams.setdefault(r["homeId"], r.get("homeName") or str(r["homeId"]))
            fm_teams.setdefault(r["awayId"], r.get("awayName") or str(r["awayId"]))
        # (homeId, awayId, ymd) → store row
        by_key = {}
        for r in rows:
            d = _parse_dt(r.get("date"))
            if not d:
                continue
            by_key[(r["homeId"], r["awayId"], d.date())] = r
        matched = 0
        unmatched_all = set()
        for season in seasons:
            try:
                sch = sd.Understat(leagues=us_league, seasons=season).read_schedule().reset_index()
            except Exception as e:
                if verbose:
                    print(f"  [xg] {us_league} {season}: çekilemedi ({e})")
                continue
            if "is_result" in sch.columns:
                sch = sch[sch["is_result"] == True]
            us_teams = sorted(set(sch["home_team"]) | set(sch["away_team"]))
            tmap, unmatched = map_teams(fm_teams, us_teams)
            unmatched_all.update(unmatched)
            for _, s in sch.iterrows():
                h, a = tmap.get(s["home_team"]), tmap.get(s["away_team"])
                if h is None or a is None:
                    continue
                try:
                    hx, ax = float(s["home_xg"]), float(s["away_xg"])
                    sd_date = datetime.fromisoformat(str(s["date"])[:19]).date()
                except (TypeError, ValueError):
                    continue
                r = None
                for delta in (0, 1, -1):
                    r = by_key.get((h, a, sd_date + timedelta(days=delta)))
                    if r:
                        break
                if not r:
                    continue
                out.append({"id": r["id"], "leagueId": lid, "homeId": h, "awayId": a,
                            "date": r.get("date"), "home_xg": round(hx, 3), "away_xg": round(ax, 3)})
                matched += 1
        cov = matched / len(rows) if rows else 0.0
        report[lid] = {"league": us_league, "matches": len(rows), "matched": matched,
                       "coverage": round(cov, 3), "unmatched": sorted(unmatched_all)}
        if verbose:
            print(f"[xg] {us_league}: {matched}/{len(rows)} maç (%{cov*100:.1f}); eşleşmeyen Understat takımı: {sorted(unmatched_all) or '-'}")
    os.makedirs(os.path.dirname(out_path) or ".", exist_ok=True)
    tmp = out_path + ".tmp"
    with open(tmp, "w", encoding="utf-8") as f:
        for r in out:
            f.write(json.dumps(r, ensure_ascii=False) + "\n")
    os.replace(tmp, out_path)
    with open(out_path + ".report.json", "w", encoding="utf-8") as f:
        json.dump({"built_at": datetime.now(timezone.utc).isoformat(), "seasons": seasons, "leagues": report}, f, ensure_ascii=False, indent=1)
    if verbose:
        print(f"[xg] {len(out)} satır → {out_path}")
    return report


def choose_model(matches, xg_coverage, xg_weight, min_coverage, version_xg, version_goals):
    """Saf karar: eğitim penceresinde xG kapsamı eşiği geçiyorsa xG-DC, yoksa gol-DC."""
    if xg_weight > 0 and xg_coverage >= min_coverage and any(m.get("home_xg") is not None for m in matches):
        return "xg", version_xg
    return "goals", version_goals


class XgStore:
    """xg.jsonl okuyucu: maç id → (home_xg, away_xg). Dosya değişince yeniden yükler."""

    def __init__(self, path=XG_PATH):
        self.path = path
        self._by_id = None
        self._mtime = None

    def _load(self):
        mt = os.path.getmtime(self.path) if os.path.exists(self.path) else 0
        if self._by_id is not None and mt == self._mtime:
            return
        d = {}
        if os.path.exists(self.path):
            with open(self.path, encoding="utf-8") as f:
                for line in f:
                    try:
                        r = json.loads(line)
                        d[r["id"]] = (float(r["home_xg"]), float(r["away_xg"]))
                    except Exception:
                        continue
        self._by_id = d
        self._mtime = mt

    def attach(self, matches):
        """store.load_for_fit çıktısına home_xg/away_xg ekler; kapsam oranını döndürür."""
        self._load()
        hit = 0
        for m in matches:
            xg = self._by_id.get(m.get("id"))
            if xg:
                m["home_xg"], m["away_xg"] = xg
                hit += 1
            else:
                m["home_xg"] = m["away_xg"] = None
        return (hit / len(matches)) if matches else 0.0

    def total(self):
        self._load()
        return len(self._by_id)


if __name__ == "__main__":
    cmd = sys.argv[1] if len(sys.argv) > 1 else "stats"
    if cmd == "build":
        days = 600
        if "--days" in sys.argv:
            days = int(sys.argv[sys.argv.index("--days") + 1])
        build(days=days)
    else:
        xs = XgStore()
        print(f"[xg] {xs.total()} maç xG'si: {xs.path}")
        rp = xs.path + ".report.json"
        if os.path.exists(rp):
            print(open(rp, encoding="utf-8").read())
