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

## 4) Günlük sonuç güncellemesi — servis kendini tazeler (cron GEREKMEZ)

2026-09-07'den itibaren `/predict`, `results.jsonl` **20 saatten eskiyse** arka planda
`update_recent(4)` çalıştırır (xG yan deposu varsa onu da yeniden kurar) ve fit cache'ini
boşaltır. n8n'in günlük çağrısı bu yüzden depoyu güncel tutar; Hetzner'a cron/timer eklemeyin.
Ayar: `STORE_MAX_AGE_HOURS=20`, `STORE_REFRESH_DAYS=4`. Durum: `/status` → `store_age_hours`,
`store_stale`, `refresh`. Elle tetiklemek için `POST /update {"days":3}` hâlâ çalışır.

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

# 3) Günlük yenileme: servis kendisi yapar (§4) — xg.jsonl varsa refresh onu da yeniden kurar.
```

Ayarlar (systemd `Environment=`): `XG_PATH=/var/lib/footy/xg.jsonl`, `SOCCERDATA_DIR=/var/lib/footy/soccerdata`.
`XG_WEIGHT` / `XG_MIN_COVERAGE` artık sürüm parametresidir (aşağıdaki §Sürümler); env yalnız
`ENGINE_PARAMS_URL` erişilemezken kullanılan varsayılandır.

Geri alma: `xg.jsonl`'i sil → xG sürümü satır üretmez; ya da admin rotasından `dc-2.0-xg`'yi `retire` et.

Kontrol (ilk günden sonra): `engine_predictions` içinde `model_version='dc-2.0-xg'` satırları yalnız 5 kapsanan ligde olmalı; `/status` → `xg.leagues[].publishes` listesi.

---

## Sürümler ve parametreler (Faz 3, 2026-09-07) — gölge yayın, onaylı terfi

Tek doğruluk kaynağı Supabase `engine_model_versions` (migration `2026-09-07_engine_model_versions.sql`;
seed: `dc-1.0` **active**, `dc-2.0-xg` **shadow**). Servis bunu siteden okur:

```ini
# /etc/systemd/system/footy-predict.service  [Service] bölümüne
Environment=ENGINE_PARAMS_URL=https://footballanalytics.pro/api/v2/engine/params
# opsiyonel çevrimdışı yedek: Environment=PARAMS_PATH=/var/lib/footy/params.json
```

```bash
cd /opt/football-match-analyzer && git pull && sudo systemctl daemon-reload && sudo systemctl restart footy-predict
curl -s 127.0.0.1:8000/status | python3 -m json.tool | sed -n '/"versions"/,/"store_total/p'
# versions.source = "url" olmalı; "defaults" ise URL'ye erişilemiyor (env varsayılanları kullanılır).
```

Davranış:
- `/predict` her fixture için **aktif + gölge** sürümlerin hepsini üretir; `modelVersion` satır başına.
  Site resmi sürümü `engine_model_versions.active`'den seçer (`SITE_MODEL_VERSION` env varsa o kazanır).
- `kind: "xg"` sürüm, xG kapsamı `xg_min_coverage` altındaki ligde satır üretmez (gol sürümüne düşmez).
- `n_eff < min_team_matches` (varsayılan 6 etkin maç) olan takım atlanır → yeni çıkan takımın uçuk λ'sı yayınlanmaz.
- Parametre değişikliği: admin `POST /api/admin/engine-versions {action:'propose', version, kind, params, status:'shadow'}`
  → servis 1 saat içinde alır (hemen almak için `POST 127.0.0.1:8000/reload`).
- Terfi: Pazartesi `engine-weekly-review` raporu `promote` önerince admin `{action:'activate', version}`;
  kapı (≥4 hafta, ≥600 eşleştirilmiş satır, ΔLL ≤ −0.003, %95 CI 0'ı dışlar, Ü/A-KG kötüleşmemiş)
  sunucuda zorlanır; `force:true` + not ile aşılabilir, her şey `engine_learning_log`'a yazılır.

Testler: `cd engine && python3 -m unittest discover tests` (parite: `shrink_k=0, rho=-0.10` → eski çıktı birebir).
