# docs/AUDIT.md — Faz 0 Mevcut Durum Denetimi

> **Tarih:** 2026-06-30 · **Kapsam:** veri toplama + zenginleştirme + tahmin katmanı.
> **Yöntem:** 4 paralel salt-okunur keşif ajanı (mimari · DC motorları · uydurma-veri avı · kaynaklar/cache/şema). Kod değiştirilmedi.
> **Amaç:** Master prompt'un (Python/FastAPI + Ollama + scrapy/crawl4ai/firecrawl/browser-use + Hetzner) hedef mimarisini gerçek repo durumuyla karşılaştırmak ve Faz 1 için zemin hazırlamak.

---

## 0. YÖNETİCİ ÖZETİ (en kritik 5 bulgu)

1. **Master prompt'un varsaydığı altyapının ÇOĞU zaten var** — ama farklı araçlarla. Ollama/Dolphin gerçek (n8n + Hetzner nightly batch), FastAPI DC motoru var (Python `engine/`), self-host scraping yerine Bright Data + soccerdata + Sportmonks/FotMob/football-data.org çoklu sağlayıcı zinciri var. **Yani "6 yeni araç sıfırdan kur" doğru çerçeve değil.**
2. **İki ayrı, gereksiz-tekrar Dixon-Coles motoru** çalışıyor (TS canlı analizde; Python ayrı batch). İkisi de **yalnızca gol+tarih+takım** ile besleniyor — prompt'un istediği **xG/form/H2H girdileri hiç yok**.
3. **Gerçek "uydurma-veri" sorunu LLM-konsensüs hattında** — istatistiksel `match-intelligence` hattı temiz, ama `matches`, `quad-brain`, `agent-analyzer`, `unified-consensus`, `deepseek-master` LLM'e sayı (güven/xG/skor/oran) ürettiriyor; bir yerde `Math.random()` ile **sahte bahis oranı üretip "Sportmonks" diye etiketliyor**.
4. **Provenance hiçbir yerde yok** — 62 Supabase insert/upsert'ün hiçbirinde `source_url`/`source_name`/`fetched_at` üçlüsü yok. En fazla sabit `source: 'match-intelligence-batch/1.0'` veya self-asserted `model_version: 'dc-1.0'`.
5. **İçeride zaten "doğru desen" mevcut:** `scripts/match-intelligence-batch.mjs` — sayılar gerçek veriden Poisson ile, LLM sadece metin üretiyor ve prompt'ta "skor/olasılık uydurma" guardrail'i var. **Remediation'ın referans modeli bu olmalı.**

> **Stratejik sonuç (öneri):** Önce **provenance kapısı (Faz 1)** + **uydurma-veri imhası (Faz 4)** — asıl değer ve risk burada. Yeni scraping yığını (scrapy/crawl4ai/firecrawl/browser-use) büyük ölçüde **mevcut araçlarla çakışıyor**, ertelenebilir/gereksiz olabilir. Detay §7.

---

## 1. MİMARİ & RUNTIME HARİTASI

Hibrit, çok-runtime'lı sistem:

| Runtime | Nerede | Ne yapar | Deploy |
|---|---|---|---|
| **Next.js 14 / TS** | `src/app`, `src/lib` | Web UI + 56+ API route + AI analiz + auth + Stripe | **Vercel** |
| **Python `engine/`** | `model.py`, `service.py`, `store.py`, `backtest.py`, `data.py` | FastAPI Dixon-Coles predict servisi (port 8000) | self-host (systemd `engine/deploy/footy-predict.service`) + n8n |
| **`railway_app.py`** | kök | Flask — **Sportmonks v3 proxy** (DC değil!) | **Railway** (Dockerfile bunu çalıştırıyor: `gunicorn railway_app:app`) |
| **`src/lib/data-sources/*.py`** | `hybrid_pipeline.py`, `api_server.py` | SoccerData↔Sportmonks fallback + parquet cache | yerel-dev (deploy edilmemiş) |
| **n8n** | `n8n/*.json` | Nightly batch orkestrasyonu | **Hetzner** (Ollama localhost:11434) |

**Bağlantı:** Vercel app → (canlı veri) Railway Flask/Sportmonks proxy + doğrudan FotMob/football-data.org → Upstash Redis cache → QStash queue → LLM analiz → Supabase. Ayrı kanal: n8n (Hetzner) → Ollama → Supabase `match_intelligence`. Ayrı kanal: n8n → Python `engine/` FastAPI `/predict` → `POST /api/v2/predictions/ingest` → Supabase `engine_predictions` → `/predictions` sayfası.

**Önemli not:** `railway.toml`/`Dockerfile` **`railway_app.py`'yi** (veri proxy) deploy ediyor, `engine/service.py`'yi (DC) DEĞİL. DC FastAPI servisi ayrı, kendi-yönetilen bir kutuda çalışmak üzere tasarlanmış — Vercel/Railway config'i onu provision etmiyor → **en kırılgan / bayatlamaya en yatkın parça.**

**Kök doküman envanteri:** `README`, `SETUP`, `ANALIZ_DETAYI`, `VERI_KAYNAKLARI_DOKUMANTASYONU`, `ODDS_STRATEJI_DOKUMANTASYONU`, `INTEGRATION_COMPLETED`, `TESTING_GUIDE`, `README_INTEGRATION`, `TIMEOUT_ANALIZI`, `PWA_SETUP`, `BRIGHT_DATA_{CONFIG,MCP_FIX,MCP_SETUP}` — altyapının çoğu zaten dokümante.

---

## 2. DIXON-COLES — İKİ MOTOR, BİRİ CANLI

### Girdi alanları (HER İKİ motor da aynı, minimal)
- **TS** (`src/lib/statistical/dixon-coles.ts` `MatchRow`): `homeTeam`, `awayTeam`, `homeGoals`, `awayGoals`, `date`. Fit çıktısı: `attack`/`defense` map, `homeAdv`, `rho`. Zaman-sönümü `xi=0.0018`.
- **Python** (`engine/model.py`): `date`, `home`, `away`, `fthg`, `ftag`. Çıktı: `A`/`D`, `H=1.35`, `base`, `RHO=-0.10`.
- **Her ikisinde de xG/form/H2H/oran YOK.** (`engine/data.py` kapanış oranlarını parse ediyor ama model okumuyor — ölü alan.)

### Hangisi canlı?
- **TS = CANLI** analiz akışında: `unified/analyze` → `unified-consensus/index.ts:198` `getModelForLeague` + `runStatisticalAgent`; `quad-brain/engine.ts:1186` DC skor matrisi. Veri: football-data.org v4 (`FOOTBALL_DATA_API_KEY`), 10 lig (`FD_COMPETITIONS`). Fit cron `0 4 * * 2` → Supabase `dc_model_params`. `model-store.ts` 1 saat in-memory cache.
- **Python = AYRI BATCH**, analiz akışında DEĞİL: FotMob/RapidAPI (`FOOTBALL_API_KEY`) → JSONL `~/.footy/results.jsonl` → n8n → `/api/v2/predictions/ingest` → `engine_predictions` → `/predictions` sayfası (salt-okunur).

### DC ↔ LLM birleşimi (anchor mı, override mı?)
İki mekanizma birden:
- **(a) Yumuşak anchor:** `buildHybridPromptBlock` → sadece `runMasterStrategist`'e `dixonColesAnchor` ("±%10 dışına gerekçesiz çıkma"). **Prose, kodla zorlanmıyor — LLM sapabilir.**
- **(b) Sert ağırlıklı oy:** `calculateWeightedConsensus`'ta DC bir oy: MR `22×`, O/U `22×`, BTTS `35×`. Ama **LLM bloğu toplamda DC'yi geçebilir** (sert taban yok).
- **Oy öncesi market harmanı:** `applyOddsBlend` DC olasılıklarını canlı orana çeker (market ağırlığı 0.7) → "matematik" oyu zaten kısmen markete demirli.
- **Quad-brain:** LLM'in uydurma `poissonScores`'unu gerçek DC matrisiyle DEĞİŞTİRİR (sert override) — ama yalnız doğru-skor alanı için, manşet pick için değil.

---

## 3. UYDURMA-VERİ SIZINTI HARİTASI (Faz 4 hedef listesi)

> İki hat ayrılmalı: **(temiz)** istatistiksel `engine_predictions` / `match-intelligence` ve **(kirli)** LLM-konsensüs (`quad-brain`/`agent-analyzer`/`unified-consensus`/`deepseek-master`).

### KRİTİK / HIGH — saf uydurma (sayı = rastgele)
- **`src/app/api/matches/route.ts:105-134`** `generateRealisticOdds()` → `Math.random()` ile 1X2/O-U/BTTS oranı üretir; satır 192/196'da Sportmonks oran döndürmeyince devreye girer, satır 201/213'te **`source:'sportmonks'` diye etiketlenip** kullanıcıya gerçek oran gibi sunulur. **HIGH** (sahte oran + yanlış atıf).
- **`src/app/api/v3/analyze-optimized/route.ts:138-149`** — LLM anahtarı yoksa `Math.random()` ile mock `confidence/expectedGoals/overUnder/btts`; aynı consensus/`bestBet` çıktısına akar. **HIGH.**

### HIGH — LLM sayıyı uyduruyor, gerçek gibi saklanıyor/gösteriliyor
- **`deepseek-master/route.ts`** — prompt (205-221) `confidence: 50-90` sayısı istiyor; `parseAIResponse` (152-187) doğrudan okuyor; `match_full_analysis`/`prediction_sessions`'a yazılıyor (529/550). Pick de LLM seçimi. **HIGH.**
- **`quad-brain/engine.ts` `parseAIPrediction` (~743-818)** — LLM `confidence` + **`specializedInsights` toptan geçiyor** (uydurma `xgPrediction`, `poissonScores`, `valueBets.edge/impliedProb`). DC yalnız lig modeli varsa `poissonScores`'u override eder; yoksa uydurma xG/value-bet **hayatta kalır**. **HIGH.**
- **`quad-brain/debate.ts:483-488`** — Claude-arbiter `finalConfidence` (LLM) consensus güvenini ezer + kalıcı. **HIGH.**
- **`agent-analyzer/index.ts` `extractTop3...` (~700-921)** — ajan LLM `confidence`'larını ortalayıp `agent_analysis`/`unified_analysis`'e yazıyor; sayısal guardrail yok. **HIGH.**
- **`unified-consensus/index.ts:619-707, 983-1056`** — güven "aklama": LLM `*Conf`'ları ağırlıklı ortalama → **ana kullanıcı-yüzü** consensus güveni (`unified_analysis`). %75 cap + çatışma indirimi var (kısmi azaltım). Ayrıca `index.ts:892` `predictScore` LLM'in uydurma kesin skorunu gösteriyor. **MED-HIGH.**

### MED — provenance açıkları
- **Hiçbir Supabase yazımında `source_url`/`source_name`/`fetched_at` yok** (62 insert/upsert). `engine_predictions` yalnız self-asserted `model_version`. **MED.**
- **`v2/predictions/ingest/route.ts:80-108`** — token-gated ama **sayısal doğrulama yok** (`Number.isFinite` dışında), source alanı yok; secret sahibi keyfi olasılık POST edebilir; `engine_predictions` RLS read `using(true)` (DB'de public). **MED.**
- **`EnginePredictions.tsx` / `predictions/page.tsx`** — win%/güven/oran gösterir ama **ekranda kaynak/metodoloji/zaman damgası yok**. **MED-HIGH.**

### LOW / korumalı (doğrula, sonra kapsam-dışı)
- `heurist/probability-engine.ts:110` `Math.random()` = meşru Monte Carlo, uydurma değil. **Low.**
- Sabit fallback'ler `'1.2'/'1.3'/'1.0'` (xG/gol-ort eksikse): `agents/route.ts`, `quad-brain/route.ts`, `probability-engine.ts` — rastgele değil ama izlenemez placeholder. **Low-MED.**
- **REFERANS (temiz):** `scripts/match-intelligence-batch.mjs` — olasılıklar `poissonPrediction()` ile gerçek football-data.org ortalamalarından; LLM yalnız metin; guardrail var ("skor/olasılık uydurma", 275-281/312-314/347-350). **Remediation referans modeli.**

---

## 4. VERİ KAYNAKLARI

| Kaynak | Env | Durum |
|---|---|---|
| FotMob (RapidAPI) | `FOOTBALL_API_KEY` | **CANLI** (öncelik 1) |
| Football-Data.org v4 | `FOOTBALL_DATA_API_KEY` | **CANLI** (TS DC + match-results) |
| Sportmonks v3 | `SPORTMONKS_API_*` | fallback (Railway proxy) |
| API-Football, LiveScore, The Odds API | `RAPIDAPI_KEY`, `LIVESCORE_*`, `ODDS_API_KEY` | deneysel/fallback |
| Bright Data (scraper) | `BRIGHT_DATA_*` | deneysel, nadiren |
| SoccerData (py) | `SOCCERDATA_API_KEY` | deneysel/ölü (Sportmonks'a fallback) |
| News API, OpenWeather | `NEWS_API_KEY`, `OPENWEATHER_API_KEY` | zenginleştirme |

**Çıkarım:** Veri-kaynağı ihtiyacının çoğu zaten karşılı. Master prompt'un yeni scraping yığını (crawl4ai/scrapy/firecrawl/browser-use) büyük ölçüde **Bright Data + soccerdata + mevcut API zinciriyle çakışıyor.**

---

## 5. CACHE & QUEUE & ZAMANLAMA

- **Upstash Redis:** `fixtures:*` (5dk), `analysis:*`/`agent_analysis:*` (1sa), `research:*` (2sa), `ratelimit:*` (1dk). Yoksa no-op mock.
- **QStash:** `/api/v2/process-analysis` job'ları, öncelik high/normal/low, 3 retry.
- **Vercel cron (7):** `queue-daily` (15dk), `sync-predictions` (saatlik), `settle-engine` (HH:20), `settle-admin-predictions` (2sa), `settle-unified` (HH:30/2sa), `fit-dc-models` (Salı 04:00), `world-cup-campaign` (09:00).
- **n8n (Hetzner):** match-intelligence nightly 02:00 → Ollama → `match_intelligence`; ayrıca backtest/agent-learning/advanced-learning workflow'ları.

---

## 6. SUPABASE ŞEMA — MEVCUT vs HEDEF

**Mevcut (canlı):** `engine_predictions`, `match_intelligence`, `agent_analysis`, `professional_market_predictions`, `autolearn_model`, `autolearn_predictions`, `smart_analysis`, `dc_model_params`, `contact_messages`, `email_campaign_log`/`email_unsubscribes`. Kısmi provenance: `model_version`, `source` (sabit), `created_at`.

**Hedef şemadan EKSİK:** `raw_documents` ❌ · `matches` (birleşik) ❌ · `odds` (ayrı) ❌ · `xg_stats` ❌ · `data_discrepancies` ❌ · tam provenance üçlüsü ❌.

---

## 7. RİSKLER & QUICK-WIN'LER (öncelik sıralı)

### Asıl değer (yüksek öncelik)
1. **Uydurma oran imhası — `matches/route.ts` `generateRealisticOdds`** (HIGH, tek dosya, hızlı): sahte oran üretmeyi kaldır; oran yoksa `null` döndür + UI "oran yok" göstersin. Yanlış "Sportmonks" atfını bitir. **En net quick-win.**
2. **`v3/analyze-optimized` mock random** (HIGH): anahtar yoksa rastgele tahmin yerine hard-fail / "veri yok".
3. **Provenance kapısı (Faz 1):** writer katmanına `source_name`+`source_url`+`fetched_at` zorunlu eden bir validasyon; provenance'sız yazım = `ValidationError` + test.
4. **LLM güven/xG/skor disiplini (Faz 4):** LLM'den gelen sayıları ya model-türevli değerle değiştir ya da validator ile reddet/yeniden-hesapla; `specializedInsights` xG/valueBets'i DC override'ı olmadan asla saklama.

### Yapısal (orta öncelik)
5. **İki DC motorunu uzlaştır:** TS canlı, Python kırılgan-batch. Ya Python'u resmî olarak besle (provision + monitoring) ya da emekliye ayırıp tek hatta indir.
6. **Ölü kod:** `data-sources/api_server.py`, soccerdata fallback, eski `deepseek/test-*` route'ları — işaretle/temizle.

### Düşük / bekletilebilir
7. **Yeni scraping yığını (crawl4ai/scrapy/firecrawl/browser-use):** mevcut kaynaklarla çakışıyor; somut bir veri-boşluğu (örn. xG için Understat) kanıtlanmadan eklenmesi maliyet/karmaşa. xG gerçekten gerekiyorsa önce **soccerdata (zaten var)** değerlendirilmeli.

---

## 8. MASTER PROMPT ↔ GERÇEK: NET KARŞILAŞTIRMA

| Prompt varsayımı | Gerçek |
|---|---|
| Saf Python/FastAPI/pydantic stack | Hibrit: Next.js/TS **ana**, Python ikincil (engine + railway proxy) |
| Ollama/Dolphin intelligence layer kurulacak | **Zaten var** (n8n + Hetzner + Ollama → `match_intelligence`), guardrail'li |
| Firecrawl Hetzner self-host | Hetzner var ama Ollama için; scraping = Bright Data/soccerdata |
| `core/sources/base.py` adapter deseni yok | Yok; ama `src/lib/data-providers/` zaten priority-fallback manager (TS) |
| DC'yi gerçek veriyle besle | DC zaten gerçek football-data.org/FotMob ile besleniyor (ama yalnız gol+tarih) |
| LLM uydurmasını imkânsızlaştır | **Asıl gerçek iş bu** — §3 hedef listesi |
| Provenance zorunlu | **Hiç yok** — §3/§6 |

---

## SONRAKİ ADIM
Faz 1 (provenance şema + kapı + test) için onay bekleniyor. Öneri: Faz 1'i **§7'deki quick-win #1 (sahte oran imhası)** ile birlikte başlat — tek dosyalık, yüksek-etkili, düşük-riskli ilk teslim.
