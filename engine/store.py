"""
Sonuç deposu — Free API Live Football Data (FotMob) bitmiş maçlarını biriktirir.
Modelin eğitim verisi BU. Fikstürle takım ID'leri BİREBİR aynı (isim eşleştirme yok).
Saf stdlib (urllib + json). Bağımlılık yok.

Kullanım:
    FOOTBALL_API_KEY=... python3 store.py backfill 540   # son 540 günü doldur
    FOOTBALL_API_KEY=... python3 store.py update 3        # son 3 günü güncelle
    python3 store.py stats                                # depo özeti
"""
import json
import os
import sys
import time
import urllib.request
from datetime import datetime, timedelta, timezone

HOST = "free-api-live-football-data.p.rapidapi.com"
BASE = f"https://{HOST}"
KEY = os.environ.get("FOOTBALL_API_KEY", "")
STORE_PATH = os.environ.get("STORE_PATH", os.path.expanduser("~/.footy/results.jsonl"))


def _fetch(path: str):
    if not KEY:
        raise RuntimeError("FOOTBALL_API_KEY tanımlı değil")
    req = urllib.request.Request(
        BASE + path,
        headers={"x-rapidapi-host": HOST, "x-rapidapi-key": KEY},
    )
    with urllib.request.urlopen(req, timeout=30) as r:
        return json.loads(r.read().decode("utf-8"))


def matches_by_date(yyyymmdd: str):
    j = _fetch(f"/football-get-matches-by-date?date={yyyymmdd}")
    resp = (j or {}).get("response") or {}
    return resp.get("matches") or []


def _norm(m: dict):
    """Bitmiş ve skoru olan maçı normalize et; değilse None."""
    st = m.get("status") or {}
    if not st.get("finished"):
        return None
    home = m.get("home") or {}
    away = m.get("away") or {}
    hs, as_ = home.get("score"), away.get("score")
    if hs is None or as_ is None:
        return None
    try:
        hs, as_ = int(hs), int(as_)
    except (ValueError, TypeError):
        return None
    return {
        "id": m.get("id"),
        "leagueId": m.get("leagueId"),
        "date": st.get("utcTime") or m.get("timeTS"),
        "homeId": home.get("id"),
        "homeName": home.get("longName") or home.get("name"),
        "awayId": away.get("id"),
        "awayName": away.get("longName") or away.get("name"),
        "fthg": hs,
        "ftag": as_,
    }


def _existing_ids() -> set:
    ids = set()
    if os.path.exists(STORE_PATH):
        with open(STORE_PATH, encoding="utf-8") as f:
            for line in f:
                try:
                    ids.add(json.loads(line)["id"])
                except Exception:
                    continue
    return ids


def _collect(days_back_start: int, days_back_end: int, sleep: float = 0.4) -> int:
    """[days_back_end .. days_back_start] gün öncesini tara, yeni biten maçları ekle."""
    os.makedirs(os.path.dirname(STORE_PATH) or ".", exist_ok=True)
    seen = _existing_ids()
    today = datetime.now(timezone.utc).date()
    added = 0
    with open(STORE_PATH, "a", encoding="utf-8") as f:
        for d in range(days_back_end, days_back_start + 1):
            day = today - timedelta(days=d)
            ymd = day.strftime("%Y%m%d")
            try:
                ms = matches_by_date(ymd)
            except Exception as e:
                print(f"  [store] {ymd} atlandı: {e}")
                time.sleep(sleep)
                continue
            day_added = 0
            for m in ms:
                n = _norm(m)
                if n and n["id"] and n["id"] not in seen:
                    seen.add(n["id"])
                    f.write(json.dumps(n, ensure_ascii=False) + "\n")
                    added += 1
                    day_added += 1
            print(f"  [store] {ymd}: {len(ms)} maç, +{day_added} yeni (toplam +{added})")
            time.sleep(sleep)
    return added


def backfill(days: int = 540, sleep: float = 0.4) -> int:
    """Son `days` günü geriye doğru doldur (bir kez çalıştırılır)."""
    print(f"[store] backfill: son {days} gün, hedef {STORE_PATH}")
    return _collect(days, 1, sleep)


def update_recent(days: int = 3, sleep: float = 0.4) -> int:
    """Son `days` günü güncelle (günlük cron). Bugünü de dahil et (d=0)."""
    print(f"[store] update: son {days} gün")
    return _collect(days, 0, sleep)


def _parse_dt(v):
    if v is None:
        return None
    # epoch ms?
    if isinstance(v, (int, float)):
        try:
            return datetime.utcfromtimestamp(v / 1000.0)
        except Exception:
            return None
    s = str(v).strip()
    s = s.replace("Z", "").split("+")[0]
    for fmt in ("%Y-%m-%dT%H:%M:%S", "%Y-%m-%dT%H:%M", "%Y-%m-%d"):
        try:
            return datetime.strptime(s, fmt)
        except ValueError:
            continue
    return None


class ResultStore:
    """Depoyu lige göre gruplayıp model.fit'in beklediği şekle döndürür."""

    def __init__(self):
        self._by_league = None
        self._mtime = None

    def _load(self):
        mt = os.path.getmtime(STORE_PATH) if os.path.exists(STORE_PATH) else 0
        if self._by_league is not None and mt == self._mtime:
            return
        by = {}
        if os.path.exists(STORE_PATH):
            with open(STORE_PATH, encoding="utf-8") as f:
                for line in f:
                    try:
                        r = json.loads(line)
                    except Exception:
                        continue
                    by.setdefault(r.get("leagueId"), []).append(r)
        self._by_league = by
        self._mtime = mt

    def reload(self):
        self._by_league = None
        self._load()

    def load_for_fit(self, league_id: int):
        """model.fit için: date(datetime), home/away (str id), fthg, ftag."""
        self._load()
        rows = self._by_league.get(league_id, [])
        out = []
        for r in rows:
            d = _parse_dt(r.get("date"))
            if not d or r.get("homeId") is None or r.get("awayId") is None:
                continue
            out.append({
                "date": d,
                "season": "",
                "home": str(r["homeId"]),
                "away": str(r["awayId"]),
                "fthg": r["fthg"],
                "ftag": r["ftag"],
            })
        out.sort(key=lambda x: x["date"])
        return out

    def league_count(self, league_id: int) -> int:
        self._load()
        return len(self._by_league.get(league_id, []))

    def total(self) -> int:
        self._load()
        return sum(len(v) for v in self._by_league.values())

    def leagues(self):
        self._load()
        return sorted(self._by_league.keys(), key=lambda k: -len(self._by_league[k]))


if __name__ == "__main__":
    cmd = sys.argv[1] if len(sys.argv) > 1 else "stats"
    arg = int(sys.argv[2]) if len(sys.argv) > 2 else None
    if cmd == "backfill":
        n = backfill(arg or 540)
        print(f"[store] backfill bitti: +{n} maç")
    elif cmd == "update":
        n = update_recent(arg or 3)
        print(f"[store] update bitti: +{n} maç")
    elif cmd == "stats":
        s = ResultStore()
        print(f"[store] dosya: {STORE_PATH}")
        print(f"[store] toplam maç: {s.total()}")
        top = s.leagues()[:15]
        for lid in top:
            print(f"   lig {lid}: {s.league_count(lid)} maç")
    else:
        print("kullanım: store.py [backfill N | update N | stats]")
