#!/usr/bin/env python3
# ============================================================================
# engine-sync — bugün, yarın ve öbür günün tahminleri her zaman hazır olsun
# ----------------------------------------------------------------------------
# Neden: n8n'in 04:00 UTC tek atışlık ingest'i 2026-09-12'de Supabase Gateway
# Timeout ile 500 döndü ve 13 Eylül fikstürleri tahminsiz kaldı (retry yoktu).
# Bu betik saat başı çalışır: site fikstür akışından D, D+1, D+2 maçlarını alır,
# engine_predictions'ta satırı OLMAYAN gelecekteki maçları yerel motora sorar,
# sonucu sitenin ingest ucuna yazar (3 deneme, üstel bekleme). Var olan tahmin
# ASLA yeniden yazılmaz: karne ve günün seçimleri sabah donan değerle ölçülür.
# Ortam: /opt/football-match-analyzer/.env.hetzner (SUPABASE_*, INGEST_SECRET)
# Log: /var/log/engine-sync.log — cron: 5 * * * *
# ============================================================================
import json, os, sys, time, urllib.request, urllib.error
from datetime import datetime, timedelta, timezone

SITE = 'https://footballanalytics.pro'
ENGINE = 'http://127.0.0.1:8000/predict'
DAYS_AHEAD = 2
ENV_FILE = '/opt/football-match-analyzer/.env.hetzner'


def load_env(path):
    out = {}
    try:
        for line in open(path):
            line = line.strip()
            if not line or line.startswith('#') or '=' not in line:
                continue
            k, v = line.split('=', 1)
            out[k.strip()] = v.strip().strip('"').strip("'")
    except FileNotFoundError:
        pass
    return out


def log(msg):
    print(f"[{datetime.now(timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ')}] {msg}", flush=True)


def http(url, data=None, headers=None, timeout=120, retries=3):
    last = None
    for attempt in range(1, retries + 1):
        try:
            req = urllib.request.Request(url, data=json.dumps(data).encode() if data is not None else None,
                                         headers={'Content-Type': 'application/json', 'User-Agent': 'engine-sync/1.0', **(headers or {})})
            with urllib.request.urlopen(req, timeout=timeout) as r:
                return json.loads(r.read().decode())
        except urllib.error.HTTPError as e:
            body = e.read().decode(errors='replace')[:300]
            last = f"HTTP {e.code} {body}"
            if e.code in (400, 401, 403, 404, 422):
                break  # tekrar denemek anlamsız
        except Exception as e:  # timeout, connection reset, Gateway Timeout gövdesi vb.
            last = repr(e)
        if attempt < retries:
            wait = 20 * attempt
            log(f"  retry {attempt}/{retries} in {wait}s: {url.split('?')[0]} — {last}")
            time.sleep(wait)
    raise RuntimeError(f"{url.split('?')[0]} failed: {last}")


def main():
    env = load_env(ENV_FILE)
    sb_url, sb_key = env.get('NEXT_PUBLIC_SUPABASE_URL'), env.get('SUPABASE_SERVICE_ROLE_KEY')
    secret = env.get('INGEST_SECRET') or env.get('PREDICTIONS_API_SECRET') or env.get('CRON_SECRET')
    if not (sb_url and sb_key and secret):
        log('env eksik: NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY / INGEST_SECRET'); sys.exit(2)

    now = datetime.now(timezone.utc)
    days = [(now + timedelta(days=i)).strftime('%Y-%m-%d') for i in range(DAYS_AHEAD + 1)]

    # 1) Fikstürler (site akışı, Edge cache'li)
    fixtures = {}
    for d in days:
        try:
            r = http(f"{SITE}/api/v2/fixtures?date={d}", timeout=90)
        except Exception as e:
            log(f"fixtures {d}: {e}"); continue
        for f in (r.get('data') or {}).get('fixtures') or []:
            ko = f.get('date')
            if not ko or f.get('status') == 'FT':
                continue
            if datetime.fromisoformat(ko.replace('Z', '+00:00')) <= now + timedelta(minutes=30):
                continue  # başlamış/başlamak üzere: pre-match tahmin yazılmaz
            fixtures[f['id']] = f
    if not fixtures:
        log('gelecek fikstür yok'); return
    kos = sorted(f['date'] for f in fixtures.values())

    # 2) Var olan tahminler (aynı pencere) — Supabase REST, sayfalı
    existing = set(); off = 0
    while True:
        req = urllib.request.Request(
            f"{sb_url}/rest/v1/engine_predictions?select=fixture_id&kickoff=gte.{kos[0]}&kickoff=lte.{kos[-1]}",
            headers={'apikey': sb_key, 'Authorization': f'Bearer {sb_key}', 'Range-Unit': 'items', 'Range': f'{off}-{off + 999}'})
        with urllib.request.urlopen(req, timeout=60) as r:
            page = json.loads(r.read().decode())
        existing.update(int(x['fixture_id']) for x in page)
        if len(page) < 1000:
            break
        off += 1000

    missing = [f for fid, f in fixtures.items() if fid not in existing]
    log(f"pencere {days[0]}..{days[-1]}: fikstür {len(fixtures)}, tahminli {len(fixtures) - len(missing)}, eksik {len(missing)}")
    if not missing:
        return

    # 3) Motor → 4) Ingest (200'lük parçalar; motor kapsam dışı ligleri kendisi atlar)
    total_pred = total_up = 0
    for i in range(0, len(missing), 200):
        chunk = missing[i:i + 200]
        out = http(ENGINE, {'fixtures': chunk}, timeout=600, retries=2)
        preds = out.get('predictions') or []
        total_pred += len(preds)
        if not preds:
            log(f"  motor: {len(chunk)} fikstür → 0 tahmin (skipped_by={out.get('skipped_by')})"); continue
        res = http(f"{SITE}/api/v2/predictions/ingest", {'predictions': preds}, headers={'Authorization': f'Bearer {secret}'}, timeout=120, retries=3)
        up = res.get('upserted', 0); rej = res.get('rejected') or []
        total_up += up
        log(f"  motor {len(chunk)} fikstür → {len(preds)} tahmin ({out.get('predicted_by_version')}) → ingest upserted {up}, rejected {len(rej)}"
            + (f" ör: {rej[0]}" if rej else ''))
    log(f"bitti: tahmin {total_pred}, yazılan {total_up}")


if __name__ == '__main__':
    try:
        main()
    except Exception as e:
        log(f"HATA: {e}"); sys.exit(1)
