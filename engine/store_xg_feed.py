"""
xG yan deposu — Yol B: abone olunan akıştan (Free API Live Football Data, FotMob tabanlı)
maç istatistiği ucu ile xG. Understat yolu (store_xg.py) 5 büyük ligle sınırlı ve takım
adı eşlemesine dayanıyor; bu yol maçı doğrudan FotMob id'siyle çeker, kapsanan tüm
liglerde (Eredivisie, Portekiz, Championship, Brezilya, Süper Lig, ŞL dahil) çalışır.
Keşif 2026-09-14: /football-get-match-all-stats?eventid= → "Expected goals (xG)" [ev, dep].

Çıktı: xg_feed.jsonl — satır şeması xg.jsonl ile aynı (+ "source": "fotmob"):
  {"id": <FotMob maç id>, "leagueId", "homeId", "awayId", "date", "home_xg", "away_xg", "source"}
XgStore (store_xg.py) iki dosyayı birleştirir; aynı maçta akış Understat'a baskındır.

Kullanım (Hetzner, cron 04:40 UTC, sonuç deposu güncellendikten sonra):
  cd /opt/football-match-analyzer/engine && .venv/bin/python store_xg_feed.py build --days 3 --max 200
  İlk doldurma: build --days 400 --max 600  (birkaç kez; kota Ultra planda bol)
  python store_xg_feed.py stats
Ortam: FOOTBALL_API_KEY (ya da RAPIDAPI_KEY), STORE_PATH, XG_FEED_PATH (vars. xg_feed.jsonl).
"""
import json
import os
import sys
import time
import urllib.request
import urllib.error
from datetime import datetime, timedelta, timezone

from store import STORE_PATH, _parse_dt

HOST = "free-api-live-football-data.p.rapidapi.com"
XG_FEED_PATH = os.environ.get("XG_FEED_PATH", os.path.join(os.path.dirname(STORE_PATH) or ".", "xg_feed.jsonl"))
MISS_PATH = XG_FEED_PATH + ".missing.json"
# Site kapsamı (src/lib/model-coverage.ts COVERED_IDS + Süper Lig 71). Env ile genişletilebilir.
DEFAULT_LEAGUES = "47,87,55,54,53,42,57,61,48,268,71"
LEAGUES = {int(x) for x in os.environ.get("XG_FEED_LEAGUES", DEFAULT_LEAGUES).split(",") if x.strip()}
MISS_RETRY_DAYS = 2      # istatistiği olmayan maç bu kadar gün sonra yeniden denenir
MISS_MAX_TRIES = 3       # sonra kalıcı olarak atlanır
SLEEP_S = 0.35           # çağrı arası (kota ve nezaket)


def _key():
    k = os.environ.get("FOOTBALL_API_KEY") or os.environ.get("RAPIDAPI_KEY") or ""
    if not k:
        raise SystemExit("FOOTBALL_API_KEY / RAPIDAPI_KEY yok")
    return k


def parse_stats(payload) -> tuple | None:
    """Akış yanıtından (home_xg, away_xg). Bulunamazsa None."""
    groups = ((payload or {}).get("response") or {}).get("stats") or []
    for g in groups:
        for s in g.get("stats") or []:
            if str(s.get("title", "")).strip().lower().startswith("expected goals (xg)"):
                v = s.get("stats")
                if isinstance(v, list) and len(v) == 2 and v[0] is not None and v[1] is not None:
                    try:
                        return float(v[0]), float(v[1])
                    except (TypeError, ValueError):
                        continue
    return None


def fetch_stats(match_id: int, key: str, retries: int = 2):
    """→ ('ok', (h, a)) | ('none', None) | ('error', msg)"""
    url = f"https://{HOST}/football-get-match-all-stats?eventid={match_id}"
    req = urllib.request.Request(url, headers={"x-rapidapi-key": key, "x-rapidapi-host": HOST})
    for attempt in range(retries + 1):
        try:
            with urllib.request.urlopen(req, timeout=25) as r:
                payload = json.loads(r.read().decode("utf-8"))
            xg = parse_stats(payload)
            return ("ok", xg) if xg else ("none", None)
        except urllib.error.HTTPError as e:
            if e.code == 429 and attempt < retries:
                time.sleep(5 * (attempt + 1))
                continue
            return ("error", f"http {e.code}")
        except Exception as e:  # ağ/JSON
            if attempt < retries:
                time.sleep(2)
                continue
            return ("error", str(e)[:120])
    return ("error", "retries")


def _load_ids(path):
    ids = set()
    if os.path.exists(path):
        with open(path, encoding="utf-8") as f:
            for line in f:
                try:
                    ids.add(json.loads(line)["id"])
                except Exception:
                    continue
    return ids


def _load_missing():
    if os.path.exists(MISS_PATH):
        try:
            with open(MISS_PATH, encoding="utf-8") as f:
                return json.load(f)
        except Exception:
            return {}
    return {}


def _save_missing(m):
    tmp = MISS_PATH + ".tmp"
    with open(tmp, "w", encoding="utf-8") as f:
        json.dump(m, f)
    os.replace(tmp, MISS_PATH)


def candidates(days: int, have: set, missing: dict, now=None):
    """Sonuç deposundan: kapsanan lig, son `days` gün, skoru var, xG'si yok, yeniden deneme zamanı gelmiş."""
    now = now or datetime.now(timezone.utc)
    since = now - timedelta(days=days)
    out = []
    if not os.path.exists(STORE_PATH):
        return out
    with open(STORE_PATH, encoding="utf-8") as f:
        for line in f:
            try:
                r = json.loads(line)
            except Exception:
                continue
            if r.get("leagueId") not in LEAGUES or r.get("fthg") is None or r.get("id") in have:
                continue
            d = _parse_dt(r.get("date"))
            if d is not None and d.tzinfo is None:
                d = d.replace(tzinfo=timezone.utc)  # depo tarihleri UTC, _parse_dt naive döndürebilir
            if not d or d < since or d > now - timedelta(hours=2):
                continue
            m = missing.get(str(r["id"]))
            if m:
                if m.get("tries", 0) >= MISS_MAX_TRIES:
                    continue
                last = _parse_dt(m.get("last"))
                if last is not None and last.tzinfo is None:
                    last = last.replace(tzinfo=timezone.utc)
                if last and now - last < timedelta(days=MISS_RETRY_DAYS):
                    continue
            out.append((d, r))
    out.sort(key=lambda t: t[0], reverse=True)  # en yeni önce
    return [r for _, r in out]


def build(days=3, max_calls=200, verbose=True):
    key = _key()
    have = _load_ids(XG_FEED_PATH)
    missing = _load_missing()
    todo = candidates(days, have, missing)
    if verbose:
        print(f"[xg-feed] depoda {len(have)} maç; aday {len(todo)} (son {days} gün, {len(LEAGUES)} lig), sınır {max_calls}")
    added = none = errors = 0
    now_iso = datetime.now(timezone.utc).isoformat()
    with open(XG_FEED_PATH, "a", encoding="utf-8") as out:
        for r in todo[:max_calls]:
            status, val = fetch_stats(int(r["id"]), key)
            if status == "ok":
                row = {"id": r["id"], "leagueId": r.get("leagueId"), "homeId": r.get("homeId"), "awayId": r.get("awayId"),
                       "date": r.get("date"), "home_xg": val[0], "away_xg": val[1], "source": "fotmob"}
                out.write(json.dumps(row, ensure_ascii=False) + "\n")
                added += 1
                missing.pop(str(r["id"]), None)
            elif status == "none":
                none += 1
                m = missing.get(str(r["id"]), {"tries": 0})
                m["tries"] = m.get("tries", 0) + 1
                m["last"] = now_iso
                missing[str(r["id"])] = m
            else:
                errors += 1
                if verbose:
                    print(f"[xg-feed] {r['id']} hata: {val}")
                if str(val).startswith("http 429") or str(val).startswith("http 403"):
                    break  # kota/yetki: bu turu bitir
            time.sleep(SLEEP_S)
    _save_missing(missing)
    if verbose:
        print(f"[xg-feed] eklendi {added}, istatistiksiz {none}, hata {errors}, kalan aday {max(0, len(todo) - max_calls)}")
    return {"added": added, "none": none, "errors": errors, "remaining": max(0, len(todo) - max_calls)}


def stats():
    by = {}
    for r in (json.loads(l) for l in open(XG_FEED_PATH, encoding="utf-8")) if os.path.exists(XG_FEED_PATH) else []:
        by[r.get("leagueId")] = by.get(r.get("leagueId"), 0) + 1
    print(f"[xg-feed] {sum(by.values())} maç: {XG_FEED_PATH}")
    for lid, n in sorted(by.items(), key=lambda kv: -kv[1]):
        print(f"  lig {lid}: {n}")
    miss = _load_missing()
    print(f"  istatistiksiz (bekleyen/kalıcı): {sum(1 for m in miss.values() if m.get('tries',0) < MISS_MAX_TRIES)}/{sum(1 for m in miss.values() if m.get('tries',0) >= MISS_MAX_TRIES)}")


if __name__ == "__main__":
    cmd = sys.argv[1] if len(sys.argv) > 1 else "stats"
    if cmd == "build":
        days = int(sys.argv[sys.argv.index("--days") + 1]) if "--days" in sys.argv else 3
        mx = int(sys.argv[sys.argv.index("--max") + 1]) if "--max" in sys.argv else 200
        build(days=days, max_calls=mx)
    else:
        stats()
