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
LEAGUE_MAP_PATH = os.environ.get(
    "LEAGUE_MAP_PATH",
    os.path.join(os.path.dirname(STORE_PATH) or ".", "leagues.json"),
)
REQ_SLEEP = float(os.environ.get("REQ_SLEEP", "1.5"))      # istekler arası bekleme (sn)
REQ_BACKOFF = float(os.environ.get("REQ_BACKOFF", "10"))   # 429'da temel geri çekilme (sn)

_PLACEHOLDER = {"", "RAPIDAPI_ANAHTARIN", "PASTE_YOUR_RAPIDAPI_KEY_HERE"}


class AuthError(Exception):
    """403 / geçersiz anahtar — döngüyü durdur."""


class RateLimited(Exception):
    """429 — bu günü atla, devam et."""


def _check_key():
    if KEY in _PLACEHOLDER:
        raise AuthError(
            "FOOTBALL_API_KEY ayarlı DEĞİL ya da placeholder!\n"
            "   Gerçek RapidAPI anahtarınla:  export FOOTBALL_API_KEY='gercek_anahtar'"
        )


def _fetch(path: str, retries: int = 4):
    _check_key()
    req = urllib.request.Request(
        BASE + path,
        headers={"x-rapidapi-host": HOST, "x-rapidapi-key": KEY},
    )
    for attempt in range(retries):
        try:
            with urllib.request.urlopen(req, timeout=30) as r:
                return json.loads(r.read().decode("utf-8"))
        except urllib.error.HTTPError as e:
            if e.code == 429:
                wait = REQ_BACKOFF * (2 ** attempt)
                print(f"   429 rate-limit; {wait:.0f}s bekleniyor (deneme {attempt+1}/{retries})")
                time.sleep(wait)
                continue
            if e.code in (401, 403):
                raise AuthError(
                    f"HTTP {e.code} — anahtar geçersiz YA DA bu endpoint planında yok. "
                    "RapidAPI'de 'Free API Live Football Data' aboneliğini ve anahtarı kontrol et."
                )
            raise
    raise RateLimited("429 tekrar denemeleri tükendi")


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


# ---- Lig isim haritası (id -> {name, ccode}) ----
_league_cache = None


def fetch_league_map() -> dict:
    """/football-get-all-leagues + popular -> {id: {name, ccode}} indirip kaydeder."""
    _check_key()
    out = {}
    for path, key in (("/football-popular-leagues", "popular"),
                      ("/football-get-all-leagues", "leagues")):
        try:
            j = _fetch(path)
        except Exception as e:
            print(f"  [leagues] {path} atlandı: {e}")
            continue
        resp = (j or {}).get("response") or {}
        items = resp.get(key) or []
        # bazı yanıtlar ülke->ligler şeklinde gruplanmış olabilir
        for it in items:
            if isinstance(it, dict) and "leagues" in it and isinstance(it["leagues"], list):
                for l in it["leagues"]:
                    _add_league(out, l, it.get("ccode") or it.get("name"))
            else:
                _add_league(out, it, None)
        time.sleep(REQ_SLEEP)
    if out:
        os.makedirs(os.path.dirname(LEAGUE_MAP_PATH) or ".", exist_ok=True)
        with open(LEAGUE_MAP_PATH, "w", encoding="utf-8") as f:
            json.dump(out, f, ensure_ascii=False)
    print(f"[leagues] {len(out)} lig kaydedildi -> {LEAGUE_MAP_PATH}")
    return out


def _add_league(out: dict, l: dict, fallback_cc):
    if not isinstance(l, dict):
        return
    lid = l.get("id")
    if lid is None or lid in out:
        return
    name = l.get("localizedName") or l.get("name")
    if not name:
        return
    out[lid] = {"name": name, "ccode": l.get("ccode") or fallback_cc or ""}


def load_league_map() -> dict:
    global _league_cache
    if _league_cache is not None:
        return _league_cache
    m = {}
    if os.path.exists(LEAGUE_MAP_PATH):
        try:
            with open(LEAGUE_MAP_PATH, encoding="utf-8") as f:
                raw = json.load(f)
            m = {int(k): v for k, v in raw.items()}
        except Exception:
            m = {}
    _league_cache = m
    return m


def league_name(lid) -> str:
    if lid is None:
        return ""
    info = load_league_map().get(int(lid))
    return info["name"] if info else f"Lig {lid}"


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


def _collect(days_back_start: int, days_back_end: int, sleep: float = None) -> int:
    """[days_back_end .. days_back_start] gün öncesini tara, yeni biten maçları ekle."""
    sleep = REQ_SLEEP if sleep is None else sleep
    _check_key()  # baştan kontrol — boşuna döngüye girme
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
            except RateLimited as e:
                print(f"  [store] {ymd} atlandı (rate-limit): {e}")
                time.sleep(sleep)
                continue
            # AuthError BİLEREK yakalanmıyor -> döngüyü durdurur (anahtar/plan sorunu)
            day_added = 0
            for m in ms:
                n = _norm(m)
                if n and n["id"] and n["id"] not in seen:
                    seen.add(n["id"])
                    f.write(json.dumps(n, ensure_ascii=False) + "\n")
                    f.flush()
                    added += 1
                    day_added += 1
            print(f"  [store] {ymd}: {len(ms)} maç, +{day_added} yeni (toplam +{added})")
            time.sleep(sleep)
    return added


def test_one() -> int:
    """Tek bir istek atar — anahtar/plan çalışıyor mu diye doğrular (kotayı yemez)."""
    print(f"[store] anahtar ayarlı: {KEY not in _PLACEHOLDER}  (uzunluk {len(KEY)})")
    ymd = (datetime.now(timezone.utc).date() - timedelta(days=1)).strftime("%Y%m%d")
    print(f"[store] tek deneme isteği: {ymd}")
    ms = matches_by_date(ymd)
    finished = sum(1 for m in ms if (m.get("status") or {}).get("finished"))
    print(f"[store] ✓ ÇALIŞIYOR — {len(ms)} maç döndü ({finished} bitmiş).")
    if ms:
        print(f"[store] örnek leagueId: {ms[0].get('leagueId')}")
    return len(ms)


def backfill(days: int = 540) -> int:
    """Son `days` günü geriye doğru doldur (bir kez çalıştırılır)."""
    print(f"[store] backfill: son {days} gün, hedef {STORE_PATH} (sleep={REQ_SLEEP}s)")
    return _collect(days, 1)


def update_recent(days: int = 3) -> int:
    """Son `days` günü güncelle (günlük cron). Bugünü de dahil et (d=0)."""
    print(f"[store] update: son {days} gün")
    return _collect(days, 0)


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
    # 2026-09-06: depo tarihleri "2026-05-31T19:30:00.000Z" biçiminde (milisaniyeli).
    # strptime "%S" kesri kabul etmez → 120.979 satırın TAMAMI parse edilemiyor, her lig
    # "league_too_small" sayılıyor ve servis 0 tahmin üretiyordu. Kesir düşürülür.
    if "." in s:
        s = s.split(".")[0]
    for fmt in ("%Y-%m-%dT%H:%M:%S", "%Y-%m-%dT%H:%M", "%Y-%m-%d"):
        try:
            return datetime.strptime(s, fmt)
        except ValueError:
            continue
    return None


MERGE_MIN_MATCHES = int(os.environ.get("MERGE_MIN_MATCHES", "30"))
MERGE_MIN_JACCARD = float(os.environ.get("MERGE_MIN_JACCARD", "0.5"))


def merge_season_ids(by_league: dict):
    """
    SEZONLUK LİG ID BİRLEŞTİRME (2026-09-06 Hetzner bulgusu).
    FotMob büyük 5 lig dışındaki liglere her sezon YENİ id verir (Eredivisie 25/26 ≠ 26/27).
    Depo id'ye göre gruplandığından her sezon başında ligin geçmişi sıfırlanıyor, ligler
    "league_too_small" ile atlanıyordu (Eredivisie 2026-09-06: 37 maç).

    Kural (ad/katalog gerekmez, yalnız veriden): iki id aynı ligin ardışık sezonlarıdır ⇔
      • takım kümeleri örtüşüyor (Jaccard ≥ MERGE_MIN_JACCARD; sezonlar arası ~%85 aynı takım)
      • VE tarih pencereleri KESİŞMİYOR (aynı takımlarla eşzamanlı oynanan kupa/play-off
        birleşmez — kupalar hem farklı takım kümesi hem de aynı takvimde).
    Her iki id de ≥ MERGE_MIN_MATCHES maça sahip olmalı (gürültü). Birleşim geçişlidir
    (24/25 – 25/26 – 26/27). Kanonik anahtar = penceresi EN GEÇ biten id (fikstürler o
    sezonun id'siyle gelir); eski id'ler de aynı gruba çözülür.
    Döndürür: (groups {canonical_id: [rows]}, alias {any_id: canonical_id}).
    """
    ids = [lid for lid, rows in by_league.items() if lid is not None and len(rows) >= MERGE_MIN_MATCHES]
    info = {}
    for lid in ids:
        teams, lo, hi = set(), None, None
        for r in by_league[lid]:
            d = _parse_dt(r.get("date"))
            if d is None:
                continue
            teams.add(r.get("homeId")); teams.add(r.get("awayId"))
            lo = d if lo is None or d < lo else lo
            hi = d if hi is None or d > hi else hi
        if lo is not None and teams:
            info[lid] = (teams, lo, hi)
    parent = {lid: lid for lid in info}

    def find(x):
        while parent[x] != x:
            parent[x] = parent[parent[x]]
            x = parent[x]
        return x

    # aday çiftleri takım indeksinden üret (n² yerine)
    by_team = {}
    for lid, (teams, _, _) in info.items():
        for t in teams:
            by_team.setdefault(t, set()).add(lid)
    seen = set()
    for lid, (teams, lo, hi) in info.items():
        cands = set()
        for t in teams:
            cands |= by_team[t]
        for other in cands:
            if other == lid or (other, lid) in seen or (lid, other) in seen:
                continue
            seen.add((lid, other))
            t2, lo2, hi2 = info[other]
            if not (hi < lo2 or hi2 < lo):      # takvimler kesişiyor → aynı sezon (kupa vb.)
                continue
            inter = len(teams & t2)
            union = len(teams | t2)
            if union and inter / union >= MERGE_MIN_JACCARD:
                parent[find(lid)] = find(other)

    clusters = {}
    for lid in info:
        clusters.setdefault(find(lid), []).append(lid)
    groups, alias = {}, {}
    for members in clusters.values():
        canon = max(members, key=lambda l: info[l][2])   # en geç biten sezon
        rows = []
        for l in members:
            rows.extend(by_league[l]); alias[l] = canon
        groups[canon] = rows
    for lid, rows in by_league.items():                 # birleşmeyenler olduğu gibi
        if lid not in alias:
            groups[lid] = rows; alias[lid] = lid
    return groups, alias


class ResultStore:
    """Depoyu lige göre gruplayıp model.fit'in beklediği şekle döndürür (sezon id'leri birleşik)."""

    def __init__(self):
        self._by_league = None
        self._alias = None
        self._mtime = None

    def _load(self):
        mt = os.path.getmtime(STORE_PATH) if os.path.exists(STORE_PATH) else 0
        if self._by_league is not None and mt == self._mtime:
            return
        by = {}
        seen_ids = set()  # mükerrer satırlara karşı (iki backfill aynı anda çalışmış olabilir)
        if os.path.exists(STORE_PATH):
            with open(STORE_PATH, encoding="utf-8") as f:
                for line in f:
                    try:
                        r = json.loads(line)
                    except Exception:
                        continue
                    mid = r.get("id")
                    if mid in seen_ids:
                        continue
                    seen_ids.add(mid)
                    by.setdefault(r.get("leagueId"), []).append(r)
        self._by_league, self._alias = merge_season_ids(by)
        self._mtime = mt

    def reload(self):
        self._by_league = None
        self._load()

    def resolve(self, league_id):
        """Sezonluk id → kanonik grup id'si (bilinmeyen id olduğu gibi döner)."""
        self._load()
        return self._alias.get(league_id, league_id)

    def load_for_fit(self, league_id: int):
        """model.fit için: date(datetime), home/away (str id), fthg, ftag."""
        self._load()
        rows = self._by_league.get(self.resolve(league_id), [])
        out = []
        for r in rows:
            d = _parse_dt(r.get("date"))
            if not d or r.get("homeId") is None or r.get("awayId") is None:
                continue
            out.append({
                "id": r.get("id"),
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
        return len(self._by_league.get(self.resolve(league_id), []))

    def total(self) -> int:
        self._load()
        return sum(len(v) for v in self._by_league.values())

    def leagues(self):
        self._load()
        return sorted(self._by_league.keys(), key=lambda k: -len(self._by_league[k]))


if __name__ == "__main__":
    cmd = sys.argv[1] if len(sys.argv) > 1 else "stats"
    arg = int(sys.argv[2]) if len(sys.argv) > 2 else None
    try:
        if cmd == "test":
            test_one()
            sys.exit(0)
        elif cmd == "leagues":
            fetch_league_map()
            sys.exit(0)
        elif cmd == "backfill":
            n = backfill(arg or 540)
            print(f"[store] backfill bitti: +{n} maç")
            sys.exit(0)
        elif cmd == "update":
            n = update_recent(arg or 3)
            print(f"[store] update bitti: +{n} maç")
            sys.exit(0)
    except AuthError as e:
        print(f"\n❌ ANAHTAR/PLAN HATASI:\n   {e}\n")
        sys.exit(2)
    if cmd == "stats":
        s = ResultStore()
        print(f"[store] dosya: {STORE_PATH}")
        print(f"[store] toplam maç: {s.total()}")
        lm = load_league_map()
        if not lm:
            print("   (lig isimleri yok — önce: store.py leagues)")
        top = s.leagues()[:20]
        for lid in top:
            print(f"   {league_name(lid):28s} (id {lid}): {s.league_count(lid)} maç")
    else:
        print("kullanım: store.py [test | leagues | backfill N | update N | stats]")
