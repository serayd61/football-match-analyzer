# Tahmin Motoru — Sunucu Kurulumu (n8n + FastAPI)

Akış: **n8n** (her gün) → siteden maçları çeker → **predict-service** (Python, :8000) tahmin eder → **siteye** yazar → kullanıcı görür.

```
n8n  ──GET──▶  footballanalytics.pro/api/v2/fixtures
 │
 ├──POST──▶  127.0.0.1:8000/predict        (predict-service, Dixon-Coles)
 │
 └──POST──▶  footballanalytics.pro/api/v2/predictions/ingest  ──▶ Supabase: engine_predictions
```

---

## 0) ÖNCE KONTROL (repo sunucuda var mı?)

```bash
ls /opt/football-match-analyzer/engine 2>/dev/null && echo "VAR" || echo "YOK"
python3 --version
docker ps --format '{{.Names}}' | grep -i n8n   # n8n docker'da mı?
```

Repo **YOKSA** getir:
```bash
cd /opt
git clone https://github.com/serayd61/football-match-analyzer.git
cd football-match-analyzer
git checkout feat/prediction-engine-faz1   # (PR merge edilince main)
```

---

## 1) predict-service kurulumu (Python/FastAPI)

```bash
cd /opt/football-match-analyzer/engine
python3 -m venv .venv
.venv/bin/pip install -r requirements.txt
sudo mkdir -p /var/lib/footy
```

### Depoyu doldur (modelin eğitim verisi — bir kez, ~5–10 dk)
> `FOOTBALL_API_KEY` = RapidAPI "Free API Live Football Data" anahtarın. **Sen yapıştır**, ben anahtarı asla forma/dosyaya girmem.

```bash
export FOOTBALL_API_KEY='RAPIDAPI_ANAHTARIN'
export STORE_PATH=/var/lib/footy/results.jsonl
.venv/bin/python store.py backfill 540     # son 540 günün bitmiş maçları
.venv/bin/python store.py stats            # kaç maç, hangi ligler
```

### Servisi systemd ile hep açık tut
```bash
sudo cp deploy/footy-predict.service /etc/systemd/system/
sudo nano /etc/systemd/system/footy-predict.service   # User, yol ve FOOTBALL_API_KEY'i DÜZENLE
sudo systemctl daemon-reload
sudo systemctl enable --now footy-predict
curl -s http://127.0.0.1:8000/status | head        # çalışıyor mu?
```

---

## 2) Site tarafı (Vercel) — 2 şey

**a) Supabase tablosu** (Supabase SQL Editor'da çalıştır):
`supabase/engine_predictions.sql` içeriğini yapıştır → Run. (Eski tablolara dokunmaz.)

**b) Env değişkeni** — Vercel'de zaten `PREDICTIONS_API_SECRET` varsa hazırsın. Yoksa ekle (uzun rastgele bir değer). Bu hem n8n'in Authorization header'ında hem sitede kullanılır.

Yeni `ingest` endpoint'i `feat/prediction-engine-faz1` dalı merge + deploy edilince canlı olur.

Test:
```bash
curl -s https://footballanalytics.pro/api/v2/predictions/ingest    # {"ok":true,"total":0}
```

---

## 3) n8n workflow (mevcutlara DOKUNMADAN)

1. n8n → **Workflows** → sağ üst **⋮ / Import from File**.
2. `engine/n8n/footy-predictions.json` dosyasını seç. → Yeni "footy-predictions" workflow'u oluşur.
3. **"Siteye yaz (ingest)"** node'unu aç → Header `Authorization` değerindeki
   `Bearer __PREDICTIONS_API_SECRET__` → gerçek sırrınla değiştir.
4. **predict URL kontrolü** — n8n **Docker'daysa** `http://127.0.0.1:8000` çalışmaz:
   - Servisi host'ta çalıştırıyorsan node URL'sini `http://host.docker.internal:8000/predict`
     (Linux'ta gerekiyorsa n8n container'ını `--add-host=host.docker.internal:host-gateway` ile başlat),
     ya da `http://172.17.0.1:8000/predict` (docker bridge gateway).
   - n8n host üzerinde (Docker'sız) çalışıyorsa `127.0.0.1:8000` doğrudur.
5. Sağ üstten **Execute Workflow** ile elle dene → son node'da `{success:true, upserted:N}` görmelisin.
6. Çalışınca workflow'u **Active** yap (her gün 06:00).

---

## 4) Günlük sonuç güncellemesi (opsiyonel ama önerilir)

Model her gün taze veriyle daha iyi olsun diye depoyu güncelle. İki yol:
- **systemd timer** ya da basit cron:
  ```bash
  # /etc/cron.d/footy-update
  0 4 * * * root cd /opt/football-match-analyzer/engine && FOOTBALL_API_KEY='...' STORE_PATH=/var/lib/footy/results.jsonl .venv/bin/python store.py update 3 && systemctl restart footy-predict
  ```
- veya n8n'e bir HTTP node: `POST 127.0.0.1:8000/update {"days":3}`.

---

## Sorun giderme
- `/status` boş/0 maç → backfill çalışmadı; `FOOTBALL_API_KEY` ve `STORE_PATH` doğru mu?
- predict `predicted:0, skipped=hepsi` → o ligler için yeterli geçmiş yok (MIN_LEAGUE_MATCHES=150). Backfill gününü artır (örn. 720) ya da eşiği düşür.
- ingest 401 → n8n header'daki Bearer değeri Vercel'deki `PREDICTIONS_API_SECRET` ile aynı değil.
- n8n predict bağlanamıyor → 3.4'teki Docker URL notuna bak.

---

## xG (dc-2.0-xg) — 2026-09-05 kapısından sonra canlıya alma

Kapı raporu: `reports/backtest-xg-gate.md` (5/5 lig GEÇTİ). Servis, `xg.jsonl` yoksa birebir eski davranıştadır; adımlar sırayla ve geri alınabilir.

```bash
cd /opt/football-match-analyzer && git pull            # dal merge edildikten sonra
cd engine && .venv/bin/pip install soccerdata            # yalnız store_xg.py için (servis stdlib+fastapi)

# 1) xG yan deposunu kur (Understat; ~1–2 dk). Kapsam lig başına yazdırılır.
STORE_PATH=/var/lib/footy/results.jsonl SOCCERDATA_DIR=/var/lib/footy/soccerdata \
  .venv/bin/python store_xg.py build --days 600
.venv/bin/python store_xg.py stats                       # /var/lib/footy/xg.jsonl + .report.json

# 2) Servisi yeniden başlat, hangi ligin hangi sürümle yayınlanacağını gör
sudo systemctl restart footy-predict
curl -s http://127.0.0.1:8000/status | python3 -m json.tool | sed -n '/"xg"/,$p'

# 3) Günlük cron: store update'ten SONRA xG'yi de güncelle (aynı satıra ekle)
#   ... store.py update 3 && STORE_PATH=... SOCCERDATA_DIR=... .venv/bin/python store_xg.py build --days 600 && systemctl restart footy-predict
```

Ayarlar (systemd `Environment=`): `XG_WEIGHT=0.75`, `XG_MIN_COVERAGE=0.95`, `MODEL_VERSION_XG=dc-2.0-xg`, `XG_PATH=/var/lib/footy/xg.jsonl`.

Geri alma: `xg.jsonl`'i sil veya `XG_WEIGHT=0` ver → servis `dc-1.0` yayınlar. Site tarafında `SITE_MODEL_VERSION=dc-1.0` ile resmi sürüm eskiye sabitlenebilir.

Kontrol (ilk günden sonra): `engine_predictions` içinde `model_version='dc-2.0-xg'` satırları yalnız 5 kapsanan ligde olmalı; `/status` → `xg.leagues[].xg_coverage` ≥ 0.95.
