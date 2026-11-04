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
`supabase/legacy/engine_predictions.sql` içeriğini yapıştır → Run. (Eski tablolara dokunmaz.)

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
   - **"Tahmin et (predict-service)"** node'unda Header `Authorization` →
     `Bearer __PREDICT_SERVICE_TOKEN__` değerini unit dosyasındaki `PREDICT_SERVICE_TOKEN` ile değiştir.
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

Tek doğruluk kaynağı Supabase `engine_model_versions` (migration `20260907010000_engine_model_versions.sql`;
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

## xG Yol B — akıştan (store_xg_feed.py), 2026-09-14

Abone olunan akışın `/football-get-match-all-stats` ucu bitmiş maç için xG veriyor (FotMob/Opta).
Understat yolundan farkı: doğrudan FotMob maç id'si, tüm kapsanan ligler (Eredivisie, Portekiz,
Championship, Brezilya, Süper Lig, ŞL dahil), takım adı eşlemesi yok. `XgStore` iki dosyayı
birleştirir, aynı maçta akış baskındır. Servis değişikliği gerektirmez (xg_feed.jsonl yoksa eski davranış).

```bash
cd /opt/football-match-analyzer/engine
# ilk doldurma (birkaç kez; her koşu en fazla --max çağrı, en yeni maçtan geriye)
FOOTBALL_API_KEY=... STORE_PATH=/var/lib/footy/results.jsonl .venv/bin/python store_xg_feed.py build --days 400 --max 600
.venv/bin/python store_xg_feed.py stats
# xG haftalık fit (scripts/run-xg-fit.sh → publish_xg.py --write): sezon penceresi ve referans
# tarihi artık BUGÜNDEN türetilir (engine/season.py). engine/.xg-env dosyasında
# FOOTBALL_DATA_API_KEY de OLMALI: bu sezonun takım listesi canlı çekilir, kapsama kuralı
# "bu sezon takımları %100" olur. Anahtar yoksa statik listeye düşer ve yeni çıkan takımlar
# eşleşmeyince lig YAZILMAZ (⏭️ temiz değil) — yani parametre sessizce bayatlar.
# cron (04:00 sonuç güncellemesinden sonra)
40 4 * * * cd /opt/football-match-analyzer/engine && FOOTBALL_API_KEY=... STORE_PATH=/var/lib/footy/results.jsonl .venv/bin/python store_xg_feed.py build --days 3 --max 200 >> /var/log/xg-feed.log 2>&1
# kontrol
curl -s http://127.0.0.1:8000/status | python3 -c "import sys,json;print(json.load(sys.stdin)['xg'])"
```
İstatistiği olmayan maçlar `xg_feed.jsonl.missing.json`'da; 2 gün sonra yeniden denenir, 3 denemeden sonra kalıcı atlanır.

---

## Ek (2026-09-18) — servis token'ı artık zorunlu

Denetim bulgusu: `PREDICT_SERVICE_TOKEN` boşken `/predict`, `/backfill`, `/update`, `/reload`
kimliksiz açıktı ve servis `0.0.0.0:8000` dinliyor. Bu sürümden itibaren token yoksa bu uçlar
**503** döner. Mevcut kurulumu güncellerken sıra önemli, yoksa 06:00 tahmin akışı durur:

1. Token üret: `openssl rand -hex 32`
2. n8n → "footy-predictions" → **Tahmin et** node'u → Send Headers → `Authorization: Bearer <token>`.
3. `/etc/systemd/system/footy-predict.service` içine `Environment=PREDICT_SERVICE_TOKEN=<token>` ekle.
4. `git pull && systemctl daemon-reload && systemctl restart footy-predict`
5. Doğrula: `curl -s -o /dev/null -w '%{http_code}' -X POST 127.0.0.1:8000/predict -d '{}' -H 'content-type: application/json'` → `401`;
   n8n'de **Execute Workflow** → ingest `{success:true}`.
6. Port: `ufw deny 8000/tcp` (ve Hetzner Cloud Firewall'da 8000 kapalı). Dışarıdan
   `curl http://<sunucu-ip>:8000/health` zaman aşımına uğramalı.
7. **Saatlik engine-sync de token ister** (2026-10-07 bulgusu: 30 Eyl'den beri her saat 401,
   D/D+1/D+2 boşlukları dolmadı). Aynı token'ı `/opt/football-match-analyzer/.env.hetzner` içine
   `PREDICT_SERVICE_TOKEN=<token>` olarak ekle; `python3 scripts/hetzner/engine-sync.py` →
   log'da `motor N fikstür → M tahmin` görünmeli, 401 olmamalı.

## Ek (2026-10-07) — sezonluk lig id'si eşik altındayken (Brasileirão)

Depo yeni sezon id'sini eski id'yle **otomatik** birleştirir (takım kümesi Jaccard ≥0,5, takvim
kesişmiyor) ama iki id'de de ≥ `MERGE_MIN_MATCHES` (30) maç ister. Sezon başında yeni id 1–3
haftada eşiği geçer; o süre boyunca lig `league_too_small` ile atlanır (Brasileirão 268 →
1000001407: 16 Eyl'de başladı, 7 Eki'de 13 maç → "Model bekleniyor"). Beklememek için unit'e
elle alias ekle (yeni_id:kanonik_id, virgülle):

```
Environment=LEAGUE_ALIASES=943230:42,1000001407:268
```
`systemctl daemon-reload && systemctl restart footy-predict`. Yeni id'nin geçmişi ne olursa olsun
kanonik gruba çözülür; eşik geçildiğinde alias zararsız kalır (silmek şart değil).

Geçici kaçış (yalnız özel ağda, önerilmez): `Environment=PREDICT_ALLOW_ANON=1`.

## Ek (2026-10-12) — sezon içi id değişimi otomatik bağlanır + pazar kalibrasyonu (gölge)

**Kapsama kuralı (`store.merge_season_ids`).** Akış id'yi sezon İÇİNDE de değiştiriyor
(Championship 938218 → 1000001801 9 Ekim'de, Estonya 248 → 1000001181, Türkiye 1. Lig,
Suudi 1. Lig…). Yeni id `MERGE_MIN_MATCHES`'e (30) ulaşana kadar 2–4 hafta "Model bekleniyor"
görünüyor, oran da çekilmiyordu (oran işi tahminli maçtan türer). Artık yeni id'nin satırı
≥ `MERGE_MIN_NEW` (6) ise, takımlarının ≥ `MERGE_MIN_CONTAIN` (0,9) oranı büyük bir grupta
varsa ve takvimler kesişmiyorsa o gruba hemen bağlanır (kanonik = en geç biten parça).
Kupalar ligle aynı takvimde → kesişim kuralı onları yine dışarıda tutar. Kupalar (UCL gibi
takım kümesi yarı yarıya değişenler) için `LEAGUE_ALIASES` hâlâ gerekir.
Deploy: `cd /opt/football-match-analyzer && git pull && systemctl restart footy-predict`;
bir sonraki saatlik engine-sync'te `league_too_small` sayısı düşmeli.

**Pazar kalibrasyonu (`model.apply_calib`, params `calib`).** 30 günlük canlı denetim:
Alt 2,5 ve KG Yok sistematik aşırı güvenli (iddia %65–85 → gerçek %50–60), Üst ≥%80 → %69;
1X2 kalibre. 180 günlük dc-1.0 çıktısında Platt uydurma (zaman ayrımlı sınama LL Ü/A
0,694→0,668, KG 0,703→0,682). Gölge sürüm `dc-1.2-cal` engine_model_versions'a eklenir:
```json
{"kind":"goals","calib":{"ou25":[0.233,0.440],"btts":[0.176,0.360]},"shrink_k":10,"min_team_matches":4}
```
`shrink_k`/`min_team_matches`: yeni çıkan takımlar (Venezia, Coventry, Dijon 12 Ekim) 6 etkin maç
kapısına takılıyordu; 4 maçla ve lig ortalamasına büzülerek tahmin üretilir. Bir hafta gölge
kayıt → kovalar ±5 içindeyse aktif yapılır (`status` değişimi yeter, kod değişmez).

---

## Ek (2026-09-18) — tahminden önce depo yenileme (B08)

§4'teki "servis kendini tazeler" tasarımı pratikte her gün bir gün geriden geliyordu:
06:00 çağrısında depo ≈ 24 saatlik → `/predict` yenilemeyi **arka plana** atıp o günün
tahminlerini eski depoyla üretiyordu (dünkü sonuçlar modele girmeden). Arka plan yenilemesi
yedek olarak duruyor; asıl yenileme artık tahminden önce ayrı bir timer ile yapılır:

```bash
cp engine/deploy/footy-update.service engine/deploy/footy-update.timer /etc/systemd/system/
# footy-update.service içindeki PREDICT_SERVICE_TOKEN'ı doldur
systemctl daemon-reload && systemctl enable --now footy-update.timer
systemctl start footy-update.service && journalctl -u footy-update -n 5   # elle dene
```

Doğrulama: 06:00 koşusundan sonra n8n "Tahmin et" çıktısında `store_stale: false`,
`curl 127.0.0.1:8000/status` → `store_age_hours` < 1. Bu belgede daha önce geçen
"04:00 sonuç güncellemesi" cron'u depoda hiç yoktu; xG cron'u (04:40) bu timer'dan
bağımsız çalışmaya devam eder.

## 2026-10-18 — dc-1.3-ctx gölgesi (puan durumu bağlamı)

`engine/context.py`: store maçlarından sızıntısız sezon tablosu; `params.ctx` varsa zirve
yarışındaki ev sahibine λ_ev ×(1+title_home), iki takım da düşme hattına ≤gap_pts puan ise
λ_dep ×(1+releg_both). dc-1.0 çıktısı değişmez (params'ta ctx yok → parite).
Sürüm satırı `engine_model_versions` içinde (shadow). Deploy:

    cd /opt/football-match-analyzer && git pull && sudo systemctl restart footy-predict
    curl -s 127.0.0.1:8000/status | python3 -m json.tool | grep -A6 '"versions"'   # dc-1.3-ctx görünmeli

Testler: `cd engine && python3 -m unittest tests.test_context -v`.
Karar kuralı: 2–3 hafta gölge; 1X2 kovaları ±5 ve LL dc-1.0'dan kötü değilse aktif.

## Ek (2026-11-04) — Avrupa kupaları: ŞL/AL/Konferans alias'ları

ŞL 2026/27 (943230) 54 maçla `league_too_small` kalıyordu; depoda 2025/26 lig aşaması ve eleme
turları AYRI id'lerle duruyordu (Jaccard birleşimi kupalarda tutmaz). Depodan okunan id'ler:

| Kupa | 2026/27 | 2025/26 lig aşaması | 2025/26 eleme | kanonik | benzersiz maç |
|---|---|---|---|---|---|
| Şampiyonlar Ligi | 943230 | 904988 (144) | 904995 (45) | **904988** | 243 |
| Avrupa Ligi | 943229 | 905100 (144) | 905103 (45) | 73 | 243 |
| Konferans Ligi | 943231 | 905113 (108) | 905114 (45) | 10216 | 189 |

Unit (`engine/deploy/footy-predict.service` ile aynı):
```
Environment=LEAGUE_ALIASES=943230:904988,904995:904988,943229:73,905100:73,905103:73,943231:10216,905113:10216,905114:10216,1000001407:268
```
**ŞL neden 42'ye değil 904988'e bağlı?** Depoda id 42 altında yalnız 9 satır var (21 Eki 2026) ve bu
küçük parça `MERGE_MIN_CONTAIN` kuralıyla dostluk/hazırlık havuzuna (915708: 728 maç, 570 takım) ve
Rusya Kupası gruplarına (901182/901183) yapışıyor. Eski alias `943230:42` bu yüzden ŞL'yi 815 satırla
(54 ŞL + 728 hazırlık) fit ediyordu — "league_too_small" değil, kirli fit. 904988 kanoniği ile küme
temiz: 904988 + 904995 + 943230 = 243. Genel tuzak (küçük yeni id'nin 570 takımlık havuza yapışması)
store.merge_season_ids'de ayrıca ele alınmalı.

`systemctl daemon-reload && systemctl restart footy-predict`; saatlik engine-sync bir sonraki turda
üç kupanın fikstürlerine tahmin yazar. Her sezon yeni id gelince (Eylül) tabloya satır eklenir.
xG akışı: cron'daki `XG_FEED_LEAGUES` değişkenine `73,10216,943229,943231` eklendi; ilk doldurma
`XG_FEED_LEAGUES=42,73,10216,943230,943229,943231,904988,904995,905100,905103,905113,905114 store_xg_feed.py build --days 420 --max 700`.
Site tarafı: `src/lib/model-coverage.ts` + `src/lib/site/leagues.ts` (slug `europa-league`, `conference-league`).


## Ek (2026-11-04) — Kupa havuzu: ŞL/AL/Konferans fit'i lig maçlarıyla

Alias sonrası 52 kupa fikstüründe yalnız 7 ŞL tahmini çıktı; 51'i `team_too_few_matches` (takım
başına ≥6 kupa maçı yok: AL 28/36, Konferans 33/36 takım). Kupaya yeni giren takımın 3 kupa maçı ama
100+ lig maçı var. Çözüm `store.load_pool_for_fit`: kupa grubunun maçları (w=1) + son 400 günde kupada
oynamış takımları içeren DİĞER grupların maçları (w=`CUP_POOL_DOMESTIC_W`), 60+ takımlı gruplar
(hazırlık havuzu 915708) dışarıda. `model.fit`/`model_xg.fit` satır ağırlığını zaman ağırlığıyla çarpar.

Yürüyen geriye dönük test (`engine/backtest_cups.py`, 2025-10-01..2026-11-04, maç günü başına yeniden fit;
`taban` = o alt kümenin 1X2 taban dağılımı):

| Kupa | varyant | kapsam | isabet | logloss | taban ll | brier |
|---|---|---|---|---|---|---|
| ŞL 904988 (216 maç) | yalnız kupa | 30/216 | 0,567 | 0,919 | 1,041 | 0,560 |
| | teams:0,5 | 182 | 0,588 | 0,954 | 1,012 | 0,558 |
| | **leagues:0,6** | 198 | 0,591 | **0,939** | 1,004 | **0,552** |
| AL 73 (225 maç) | yalnız kupa | 29/225 | 0,517 | 1,136 | 0,991 | 0,679 |
| | teams:0,5 | 182 | 0,588 | 0,940 | 1,038 | 0,556 |
| | **leagues:0,6** | 198 | 0,601 | **0,928** | 1,041 | **0,549** |
| Konferans 10216 (189 maç) | yalnız kupa | 10/189 | 0,400 | 1,057 | 0,905 | 0,623 |
| | teams:0,5 | 128 | 0,438 | 1,123 | 1,073 | 0,669 |
| | **leagues:0,6** | 141 | 0,489 | **1,059** | 1,066 | **0,636** |

`teams` kapsamı (yalnız havuz takımlarının lig maçları) kapsamı en çok açar ama ligdaşlar eksik kaldığı
için ölçek kayar; `leagues` (havuz takımı içeren liglerin tüm maçları, 0,6 ağırlık) üç kupada da en iyi
logloss/brier. Konferans'ta kazanç tabana göre küçük (1,059 vs 1,066): kupa heterojen, karne izlenmeli.
Ağırlık taraması (leagues, logloss): ŞL 0,4→0,943 · **0,6→0,939** · 0,8→0,944 · 1,0→0,960; AL 0,4→0,921 ·
0,6→0,928 · 0,8→0,963; Konferans 0,4→1,077 (taban 1,061, kötü) · **0,6→1,059** · 0,8→1,066 · 1,0→1,072.
0,6 üç kupada da sağlam; 0,4 yalnız AL'de bir tık iyi, Konferans'ta tabanın altına düşüyor.

Servis vars.: `CUP_POOL_LEAGUES=904988,73,10216`, `CUP_POOL_SCOPE=leagues`, `CUP_POOL_DOMESTIC_W=0.6`
(kod içi varsayılan; unit'e satır gerekmez). `/status` → `cup_pool`. Sürüm params'ı ile lig bazında
`pool_scope` / `pool_domestic_w` geçilebilir. Deploy: `git pull && systemctl restart footy-predict`;
saatlik engine-sync (:05) AL/Konferans fikstürlerine tahmin yazar.

## Ek (2026-11-04) — İki katmanlı ufuk: D..D+5 ön tahmin, 48 saat kala kesin

Müşteri isteği: "sonraki 5 günün programını ve tahminlerini görelim". Akış 5 gün sonrasını zaten
veriyordu; sınır koddaydı (engine-sync DAYS_AHEAD=2, site gün sayfası akışı yalnız D..D+2, arşiv cron'u D+2).

Kural (`engine/deploy/engine-sync.py plan_fixtures`, saf ve testli):
- Maça **48 saatten uzak** fikstür = **ön tahmin**: satırı yoksa yazılır; varsa son yazımın üstünden
  20 saat geçtiyse üzerine yazılır (günde bir, hafta içi sonuçlarını görür).
- 48 saat **içine giren** fikstürün son yazımı uzaktayken yapıldıysa **bir kez daha** yazılır ve
  **donar**; karne ve günün seçimleri bu değeri ölçer. 48 saat içinde yazılmış satıra dokunulmaz.
- Sitede ön/kesin ayrımı `kickoff − updated_at > 48 sa` ile türetilir (`day-strip-rule.isProvisional`);
  tabloya sütun eklenmedi, ingest sözleşmesi değişmedi (upsert zaten üzerine yazar).
- Site: gün sayfası akışı D..D+5 (`STRIP_FUTURE_DAYS`), satır/lig tablosu/maç sayfasında "Ön tahmin"
  rozeti, ufuk notu "5 güne kadar ön tahmin, 2 gün kala kesinleşir", feed_matches cron'u D-3..D+5.

Env (vars.): `SYNC_DAYS_AHEAD=5`, `SYNC_FREEZE_HOURS=48`, `SYNC_REFRESH_HOURS=20`. Maliyet: saatte 3 akış
çağrısı daha; motor/ingest yükü günde bir yenileme olduğu için küçük. Deploy: betiği Hetzner'e kopyala
(`scp engine/deploy/engine-sync.py root@188.245.241.149:/opt/football-match-analyzer/engine-sync.py`).
