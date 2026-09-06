# Proje haritası — tahminle ilgili her şey nerede

Doğrulama tarihi: 2026-09-05 (dal `audit/2026-09-05-contract-and-frontend`). Dosya adları
değişmiş olabilir; kullanmadan önce `ls`/`grep` ile teyit et.

## 1. İki ayrı model yolu var — karıştırma

| Yol | Ne | Kod | Parametre deposu | Kim okur | Durum |
|---|---|---|---|---|---|
| **A. predict-service (CANLI public site)** | Saf-Python çarpımsal Dixon-Coles, **yalnız gol**, 540 gün pencere, 180 gün yarı-ömür, rho=−0.10 | `engine/model.py`, `engine/service.py` (FastAPI :8000), `engine/store.py` (FotMob sonuç deposu, JSONL) | Fit anında hesaplanır (`_fit_cache`), DB'de parametre yok | n8n `engine/n8n/footy-predictions.json` → `/api/v2/predictions/ingest` → `engine_predictions` → `(site)` sayfaları | `MODEL_VERSION=dc-1.0`; xG ve Elo **yok** |
| **B. TS Dixon-Coles (legacy app)** | Toplamsal parametreli DC (`{attack,defense,homeAdv,rho}`), football-data.org takım adları | `src/lib/statistical/dixon-coles.ts`, `model-store.ts`, `statistical-agent.ts` | `dc_model_params` (haftalık: Vercel cron `fit-dc-models` + Hetzner `engine/publish_xg.py --write` 5 lig xG), `team_elo` (`engine/publish_elo.py`) | `unified-consensus`, `quad-brain`, `(app)` rotaları, `cron/daily-featured` | Public site buna bağlı DEĞİL |

Sonuç: `reports/backtest-xg.md` ve `backtest-elo.md`'deki kazanımlar yalnız **B** yoluna
(legacy) taşındı; **A** (site) hâlâ baseline. Roadmap #1 bunu kapatır.

## 2. Motor dosyaları (`engine/`)

| Dosya | Görev |
|---|---|
| `data.py` | football-data.co.uk CSV yükleyici (gol + kapanış oranı; PSC>PS>B365>WH). Cache `ENGINE_CACHE=/tmp/ffdata`. Lig kodları E0/SP1/I1/D1/F1/N1/P1/T1/E1 |
| `model.py` | `fit(matches, ref_date, half_life_days=180, window_days=540, iters=25, min_matches=120, rho=-0.10, shrink_k=0)` → `{A,D,H,base,teams,rho,n_eff}`; `predict(model,home,away)` → 1X2/Ü-A 2.5/KG/λ (ρ modelden okunur). `shrink_k`: az maçlı takımı 1.0'a büzer; 0 → eski çıktı birebir (`tests/test_params.py`) |
| `model_xg.py` | Aynı fit, hedef `(1−w)·gol + w·xG`; `xg_weight` 0.75 seçildi; aynı `rho/shrink_k` parametreleri |
| `params.py` | Sürüm/parametre zinciri: `ENGINE_PARAMS_URL` (site `/api/v2/engine/params`, 1 sa cache) → `PARAMS_PATH` json → env varsayılanları. `params_for_league(spec, lid)` lig override'ı uygular |
| `features.py` | FD.co.uk gol + Understat xG (soccerdata) birleştirme; `canon()` ad normalizasyonu, `build_team_map` |
| `features_elo.py` | Club Elo haftalık point-in-time snapshot, `elo_of()`; `_ELO_FIX` alias'ları |
| `features_context.py` | Sızıntısız rolling form (son 5) + H2H (son 6) → `m["ctx"]` |
| `backtest.py` | Baseline walk-forward: isabet, Brier, log-loss, value-bet ROI (EV>5%) |
| `backtest_xg.py` | xg_weight taraması + ECE (10 bin) |
| `backtest_elo.py`, `run_elo_all.py` | Elo→1X2 (a,b,total lineer eşleme) + λ harman taraması |
| `backtest_context.py` | Form/H2H tilt taraması — **NEGATİF** |
| `publish_xg.py` (+`.sql`) | Çarpımsal→toplamsal dönüşüm + FD.co.uk→football-data.org ad eşleme, `dc_model_params` yazımı (yalnız %100 kapsama + parite Δ≈0) |
| `publish_elo.py` | `team_elo` JSONB `{a,b,total,lambda,ratings}`; `ELO_MAP` lig-başı sabitler |
| `service.py` | `/predict`, `/backfill`, `/update`, `/reload`, `/status`; `MIN_LEAGUE_MATCHES=150`. Faz 3: fixture başına AKTİF + GÖLGE sürümlerin hepsini üretir (`modelVersion` satır başına); `n_eff < min_team_matches` (6) takımı atlar; xG sürümü kapsam eşiğini geçmeyen ligde satır üretmez; depo 20 saatten eskiyse arka planda `update_recent(4)` (Hetzner'a cron yok); fit cache günlük anahtarlı |
| `store.py` | RapidAPI Free API Live Football Data bitmiş maç deposu; takım id = fikstür id (ad eşleme yok) |

## 3. Site veri katmanı (`src/lib/site/`)

| Dosya | Görev |
|---|---|
| `predictions.ts` | `EngineRow` zod şeması (0–1, toplam 1±0.03), `SitePrediction`, kalibre güven (`applyCurve`), türetilmiş Ü/A ve KG (kayıtlı `p_btts_yes` birincil) |
| `official.ts` | Resmi sürüm seçimi: `SITE_MODEL_VERSION` → yoksa `engine_model_versions.status='active'` (`resolveOfficialVersion`, 60 sn cache) → yoksa fixture başına en son `updated_at` |
| `weekly-progress.ts` | Performans sayfası "Haftalık gelişim": `engine_weekly_metrics`'ten okur (yeniden hesap yok) |
| `performance.ts` | Karne: lig/ay/pazar kovaları, 3-sınıf Brier, walk-forward kalibrasyon, açılış/kapanış ROI (`roi.ts`), kapsam/eksik sayıları |
| `status.ts`, `asof.ts`, `merge-feed.ts`, `filters.ts` | Maç durumu ayrımı, tarih kesimi (form/H2H `before`), feed birleştirme, URL filtreleri |
| `poisson.ts`, `markets.ts` | Skor ızgarası, bahisçi pazarları vs model (Asya handikabı, DNB, KG, doğru skor) |
| `dashboard.ts` | Value radar, takip listesi (`site_watchlist`) |

Diğer: `src/lib/calibration.ts` (PAVA izotonik, `applyCurve`), `calibration-eval.ts`
(`finiteOrNull`, `temporalSplit`, `holdoutBrier`, `walkForwardBins`), `src/lib/odds/`
(`devig.ts` Shin/multiplicative, `blend.ts` w=0.7 piyasa harmanı, `elo-blend.ts`,
`football-data-csv.ts`), `src/lib/market-model.ts` (1X2→Poisson ters çözüm; Ü/A yalnız
OVER güvenilir, KG güvenilmez), `src/lib/model-coverage.ts` (10 kapsanan lig),
`src/lib/engine/ingest-schema.ts` (ingest Zod: pick=argmax, kickoff geçmişse ret; rota ayrıca
`engine_model_versions`'ta olmayan sürümü reddeder).

**Haftalık öğrenme döngüsü (`src/lib/engine/`, 2026-09-07):** `scoring.ts` (satır başına 1X2/Ü-A/KG
log-loss+Brier, ISO hafta, 10 kova ECE), `settle.ts` (settlement gövdesi + `backfillRowScores`),
`weekly-aggregate.ts` (saf: hafta satırları → metrik/kova/sürüm-çifti; `official` sanal sürümü),
`weekly.ts` (DB: `computeWeek`, `buildReport` → uyarı + öneri, `engine_learning_log`), `gate.ts`
(eşleştirilmiş bootstrap / Σ'lerden normal CI, `promotionVerdict`: ≥4 hafta, ≥600 çift, ΔLL ≤ −0.003,
CI 0'ı dışlar, Ü/A-KG kötüleşmemiş), `versions.ts` (`engine_model_versions` okuyucu).
Rotalar: `cron/engine-weekly-review` (Pazartesi 05:00 UTC; `?week=`, `?backfillWeeks=`),
public `v2/engine/weekly` ve `v2/engine/params`, admin `engine-report` (GET/recompute) ve
`engine-versions` (propose/shadow/activate/retire; kapı sunucuda, `force` loglanır).
İlke: ölçüm otomatik, DEĞİŞİKLİK ONAYLI — hiçbir öneri kendiliğinden canlıya geçmez.

## 4. Tablolar (Supabase)

| Tablo | İçerik | Yazan |
|---|---|---|
| `engine_predictions` | fixture_id+model_version unique; p_home/draw/away, p_over25, p_btts_yes, λ, pick, confidence, settled/result/correct; Faz 1: ou_pick/ou_correct, btts_pick/btts_correct, ll_1x2/brier_1x2, ll_ou25/brier_ou25, ll_btts/brier_btts, settled_at | ingest (n8n), `cron/settle-engine` (saatlik; 7 gün sonra void; `?backfill=1` eski satırları skorlar) |
| `engine_weekly_metrics` / `engine_calibration_bins` / `engine_version_pairs` / `engine_weekly_reports` | ISO hafta × lig (0 = kapsanan toplam) × pazar (1x2/dc/ou25/btts) × sürüm ('official' dahil) karne; 10 kova n/Σp/Σy; sürüm çifti n/Σd/Σd²; rapor jsonb (uyarı+öneri) | `cron/engine-weekly-review` (Pazartesi 05:00 UTC) |
| `engine_learning_log` | Yalnız insert: alert/report/propose/approve/activate/retire; actor cron ya da admin | weekly-review, admin `engine-versions` |
| `engine_model_versions` | version pk, status candidate/shadow/active/retired (tek aktif), kind goals/xg, params jsonb | admin `engine-versions`; seed dc-1.0 aktif, dc-2.0-xg gölge |
| `engine_prediction_history` | Yayın geçmişi (tetikleyici), `issued_after_kickoff` bayrağı | migration 2026-09-05 (uygulandı, backfill yok) |
| `prediction_odds` | phase opening/closing, provider, 1X2 ondalık oran, captured_at; yalnız kapsanan ligler, maç başına ≤2 çağrı | `cron/snapshot-odds` (saatlik, kapanış penceresi 90 dk) |
| `confidence_calibration` | segment all/covered/ou25/btts, knots, n_samples, brier_before/after (in-sample) + holdout sütunları | `cron/fit-calibration` (Pazartesi 03:50 UTC, MIN 300) |
| `dc_model_params` | Yol B parametreleri (league_code PL/PD/…) | Vercel cron + Hetzner xG job (Çarşamba 05:00 UTC) |
| `team_elo` | Yol B Elo | Hetzner `publish_elo.py` |
| `league_catalog` | league_id → ad, ccode | |
| `site_watchlist` | Dashboard takip | |

DB durumu 2026-09-05: 10.687 `engine_predictions` satırı, hepsi `dc-1.0`; 249 satır kickoff
sonrası yeniden yazılmış (kalite bayrağı); kalibrasyon eğrisi haftalık taze.

## 5. Kimlik evrenleri (ad/id eşleme tuzakları)

| Evren | Anahtar | Kullanan |
|---|---|---|
| FotMob / RapidAPI | sayısal team_id, league_id (sezonluk lig id olabilir; `league_catalog` ad|ccode ile çöz) | Yol A, site, `prediction_odds` |
| football-data.co.uk | kısa exonym ("Man United", "Sp Lisbon") | backtest'ler, `data.py` |
| football-data.org | uzun resmi ad ("Manchester United FC") | `dc_model_params`, `team_elo` |
| Understat | kendi adları → `features.canon()` | xG |
| Club Elo | FD.co.uk'e yakın + `_ELO_FIX` | Elo |
| ESPN (football-data skill) | ESPN team_id (Arsenal 359) | yalnız araştırma |

Kural: yeni bir kaynak eklerken önce %100 kapsama eşlemesi kanıtla (`publish_xg.py` deseni:
eşleşmeyen varsa o ligi yazma).

## 6. Zamanlama (UTC)

- ~04:00 günlük: n8n → predict-service → ingest (yalnız gelecekteki kickoff).
- Saatlik: settle-engine, snapshot-odds.
- Pazartesi 03:50: fit-calibration. Pazartesi 05:00: engine-weekly-review (geçen + önceki hafta).
  Salı 04:00: Vercel fit-dc-models (5 xG ligini atlar).
  Çarşamba 05:00: Hetzner xG fit. Elo job haftalık (Hetzner).
- ISR: ana/tahminler 15 dk, sonuçlar 5 dk, performans 60 dk.

## 7. Raporlar ve dokümanlar

`reports/backtest-baseline.md`, `backtest-xg.md`, `backtest-elo.md` (rakamlar
`scoreboard.md`'de); `docs/audit-2026-09-05.md` (bulgu→kanıt→durum tablosu ve kalan
riskler); `docs/xg-hetzner-job.md`; `engine/DEPLOY.md`; `ODDS_STRATEJI_DOKUMANTASYONU.md`.
