---
name: fa-prediction-lab
description: >-
  football-match-analyzer'ın (footballanalytics.pro) tahmin gücünü ÖLÇÜLEBİLİR biçimde
  yükseltmek için proje-özel çalışma protokolü. Dixon-Coles / xG / Elo / izotonik kalibrasyon /
  piyasa harmanı motoru üzerinde yeni özellik deneme, walk-forward backtest kapısı, kalibrasyon,
  oran-ROI-CLV değerlendirmesi, maç-önü analiz (çıpa + isimli sapma), maç-sonu retrospektif ve
  öncelikli yol haritası. Kullan: kullanıcı "tahmin yeteneğini geliştir", "modeli iyileştir",
  "backtest", "kalibrasyon", "value bet / edge var mı", "maç analizi", "hangi özellik eklenmeli",
  "karne / performans" dediğinde; ya da engine/, src/lib/site/performance.ts, calibration*.ts,
  src/lib/odds/*, reports/backtest-*.md dosyalarına dokunulacaksa. Kurulu betting, football-data,
  football-match-forecasting, nutmeg-compute, nutmeg-learn skill'lerini bu projeye göre yönlendirir.
---

# FA Prediction Lab — tahmin gücünü kanıtla, sonra yükselt

Bu skill "daha iyi tahmin" iddiasını bir ölçüm disiplinine bağlar. Projede 2026-06/07'de
üç aşamalı bir deney serisi yapıldı (gol-DC → xG-DC → Elo harmanı; form/H2H reddedildi) ve
canlı site hâlâ **en eski** modeli (`dc-1.0`, yalnız gol) yayınlıyor. Yani en büyük kazanç
yeni bir fikir değil, **kanıtlanmış kazanımları canlıya taşımak ve her adımı kapıdan geçirmek**.

Referansları gerektiğinde oku, hepsini baştan yükleme:

| Dosya | Ne zaman |
|---|---|
| `references/project-map.md` | Kod/tablo/cron nerede, hangi yol canlı, hangi id evreni |
| `references/scoreboard.md` | Bugüne kadar ölçülmüş TÜM sayılar (baseline, xG, Elo, harman, kalibrasyon) |
| `references/methodology.md` | Model katmanları, formüller, seçilmiş sabitler ve neden |
| `references/experiment-protocol.md` | Yeni özellik/parametre denerken uyulacak kapı + rapor şablonu |
| `references/match-analysis.md` | Tek maç analizi: çıpa, isimli sapma, istihbarat toplama, retrospektif |
| `references/roadmap.md` | Beklenen kazanca göre sıralı iş listesi (ne önce, neden) |

## Dürüstlük kapıları (her işte geçerli)

1. **Ölçüm yoksa iddia yok.** Birincil metrik 3-sınıf **log-loss** ve **Brier**, walk-forward
   (her maç yalnız öncesindeki veriyle). İsabet yüzdesi ikincil; ROI üçüncül ve gürültülü.
2. **Sızıntı sıfır.** Fit penceresi `ref_date`'ten önce biter; form/H2H/Elo snapshot'ı maç
   öncesi tarihli olmalı (`features_elo` haftalık Pazartesi snapshot'ı gibi). Kickoff sonrası
   yazılmış tahmin karneye girmez (`publishedAfterKickoff` bayrağı).
3. **Benchmark kapanış oranıdır.** Pinnacle kapanış (PSC*) de-vig edilmiş olasılık; modeli
   ona göre raporla (`scoreboard.md`'de bahisçi 1X2 %52.7–57.0).
4. **Piyasa, bağımsız modelin girdisi olmaz.** Edge ancak bağımsız olasılıkla ölçülür. Piyasa
   harmanı (`src/lib/odds/blend.ts`, w≈0.7) ayrı bir *yayın ürünü*dür; ayrı `model_version`
   ile yayınlanır, karnede karıştırılmaz (bkz. `methodology.md` §5).
5. **Kapı kararı 5/5 lig kuralı.** Bir özellik, ligler arasında tutarlı yönde (en az 4/5,
   tercihen 5/5) log-loss VE Brier düşürmüyorsa alınmaz. Form tilt bu kapıda düştü; tekrar
   deneme, çift-sayım (yarı-ömür zaten formu içeriyor).
6. **Belirsizlik aralığı yaz.** Δlog-loss için eşleştirilmiş bootstrap %95 aralığı
   (`scripts/gate.py`). Denetim (2026-09-05) xG sonuçlarının aralıksız olduğunu not etti.
7. **Public site dili:** "istatistiksel model / Dixon-Coles modeli"; "AI-powered" yazma.
   LLM katmanı yalnız dashboard/legacy'de.

## Hangi skill'i ne için kullan

| İhtiyaç | Skill | Not |
|---|---|---|
| Oran matematiği: de-vig, edge, Kelly, CLV, parlay | `betting` | CLI: `~/.venvs/sports-skills/bin/sports-skills betting …`. Projede TS eşdeğeri `src/lib/odds/devig.ts` (Shin) |
| Maç-önü istihbarat: form, H2H, Elo, xG, sakat (PL) | `football-data` | ESPN/Understat/ClubElo; **araştırma amaçlı**, id evreni FotMob'dan farklı |
| Elo→gol katsayı kalibrasyonu, atak/defans fit, çıpa+isimli sapma, retrospektif JSON | `football-match-forecasting` | Script'leri CSV ister → `scripts/export_fdco_csv.py` ile üret |
| xG/xT/PPDA gibi türev metrik tanımı ve hesap | `nutmeg-compute` | Understat xG zaten `engine/features.py` ile geliyor |
| Kavram/kaynak/öğrenme yolu | `nutmeg-learn` | |

## İş akışları

### A) "Modeli geliştir / yeni özellik ekle"
1. `scoreboard.md`'yi oku: ne denendi, ne geçti, ne düştü.
2. `roadmap.md`'den en yüksek beklenen-kazanç/işçilik oranlı maddeyi seç; kullanıcıya
   tek cümleyle neden onu seçtiğini söyle.
3. `experiment-protocol.md` ile deneyi kur: baseline = **canlıdaki** model, aday = değişiklik,
   aynı test kümesi, aynı metrikler, `scripts/gate.py` çıktısı.
4. Sonucu `reports/backtest-<özellik>.md` şablonuyla yaz; `scoreboard.md`'yi güncelle.
5. Geçtiyse canlıya alma planı: yeni `MODEL_VERSION`, `engine_prediction_history` ile geçiş,
   `SITE_MODEL_VERSION` ile resmi sürüm seçimi. Üretim yazımı = kullanıcı onayı.

### B) "Bu maçı analiz et"
`match-analysis.md`: kayıtlı `engine_predictions` olasılığı çıpadır; `football-data` +
web ile isimli istihbarat topla; sapma ≤ ±0.08/faktör; piyasa oranını yalnız edge/CLV için
kullan; analizi `match_intelligence`/dashboard tarafında sakla, public site'a LLM çıktısı verme.

### C) "Karne nasıl / performans oku"
`src/lib/site/performance.ts` mantığıyla: yalnız resmi sürüm, yalnız `covered` ligler,
`decided` satırlar; açılış ve kapanış ROI ayrı, kapsam yüzdesiyle. Kalibrasyon walk-forward
(`calibration-eval.ts`) ham vs kalibre Brier. Küçük örneklemde (n<300) yorum yapma.

### D) "Kalibrasyon"
İzotonik (PAVA) eğri `confidence_calibration`; segmentler all/covered/ou25/btts; holdout
sütunları migration ile geldi (2026-09-05). Eğri yoksa kimlik fonksiyonu. Eğriyi elle
"düzeltme"; veri toplansın.

## Sık kullanılan komutlar

```bash
# Python motor backtest'leri (repo kökünden; ağ gerekir, football-data.co.uk cache /tmp/ffdata)
python3 engine/backtest.py E0                       # gol-DC baseline
SOCCERDATA_DIR=/tmp/soccerdata src/lib/data-sources/venv/bin/python engine/backtest_xg.py E0   # xG taraması
SOCCERDATA_DIR=/tmp/soccerdata src/lib/data-sources/venv/bin/python engine/run_elo_all.py       # Elo 5 lig
npm run backtest:blend -- E0 2                       # TS: DC vs piyasa harmanı
npm test                                             # site veri katmanı testleri (26)

# Kapı karşılaştırması (bu skill): iki tahmin dosyası → Δlog-loss/Brier + bootstrap CI + ROI
python3 .claude/skills/fa-prediction-lab/scripts/gate.py baseline.jsonl candidate.jsonl

# forecasting skill script'leri için CSV
python3 .claude/skills/fa-prediction-lab/scripts/export_fdco_csv.py E0 2019 2025 /tmp/e0.csv
python3 .claude/skills/football-match-forecasting/scripts/calibrate_backtest.py /tmp/e0.csv --test-from 2021-08-01

# Oran araçları
~/.venvs/sports-skills/bin/sports-skills betting devig --odds=1.85,3.6,4.2 --format=decimal
~/.venvs/sports-skills/bin/sports-skills football get_team_strength --team_id=359 --team_id_2=382
```

Lig kodları: football-data.co.uk `E0 SP1 I1 D1 F1 N1 P1 T1 E1` ↔ football-data.org
`PL PD SA BL1 FL1 DED PPL ELC` ↔ FotMob id `47 87 55 54 53 57 61 48` (bkz. project-map).
