# Skor tablosu — ölçülmüş her şey (güncel tut)

Kural: buraya yalnız **walk-forward, sızıntısız, raporu repo'da olan** sayı girer. Yeni
deney → önce `reports/backtest-<özellik>.md`, sonra bu tabloya satır. Tarih ve n yaz.

## 1. Baseline — gol-DC (`engine/backtest.py`, 2026-06-30)

Veri football-data.co.uk 2019→2024, test sezon 2021-22'den itibaren, pencere 540g,
yarı-ömür 180g. Bahisçi = Pinnacle kapanış (de-vig).

| Lig | n | 1X2 model | 1X2 bahisçi | Brier | Log-loss | Value-bet n | ROI (EV>5%) |
|-----|--:|--:|--:|--:|--:|--:|--:|
| E0 | 1520 | 54.7% | 57.0% | 0.5769 | 0.9747 | 1531 | −6.64% |
| SP1 | 1520 | 51.8% | 54.2% | 0.5948 | 0.9996 | 1488 | −13.47% |
| I1 | 1520 | 53.3% | 53.9% | 0.5899 | 0.9908 | 1428 | −4.42% |
| D1 | 1224 | 50.9% | 53.5% | 0.6044 | 1.0115 | 1164 | −8.16% |
| F1 | 1372 | 50.8% | 52.7% | 0.6045 | 1.0124 | 1418 | −2.73% |

Okuma: model bahisçinin 0.6–2.6 puan altında; hiçbir ligde kapanışa karşı edge yok.
Rastgele log-loss 1.099.

## 2. xG-DC (`engine/backtest_xg.py`, 2026-07-01) — GEÇTİ, w=0.75

| Lig | Log-loss w=0 → en iyi (w) | Δ | Brier Δ | ROI w=0 → w* |
|-----|--:|--:|--:|--:|
| E0 | 0.9747 → 0.9582 (0.75) | −0.0165 | −0.0089 | −6.64% → +1.73% |
| SP1 | 0.9996 → 0.9792 (1.00) | −0.0204 | −0.0124 | −13.47% → −7.46% (w=0.5) |
| I1 | 0.9908 → 0.9819 (0.75) | −0.0089 | −0.0040 | −4.42% → −11.36% |
| D1 | 1.0115 → 0.9934 (1.00) | −0.0181 | −0.0128 | −8.16% → −7.70% |
| F1 | 1.0124 → 1.0040 (0.50) | −0.0084 | −0.0043 | −2.73% → −4.44% |

Okuma: olasılık kalitesi 5/5 iyileşti; ROI karışık → edge iddiası yok. xG kapsama %100.
**Belirsizlik aralığı yok** (denetim notu) → canlıya almadan önce `gate.py` ile yeniden üret.

## 2b. xG-DC kapı yeniden ölçümü — bootstrap aralıklı (`engine/export_preds.py` + `gate.py`, 2026-09-05) — GEÇTİ

Aynı veri/test kümesi (n=7.156), w=0.75 sabit (tarama yok). Baseline satırı §1 ile birebir aynı (sağlama).

| Lig | n | ΔLL [%95 CI] | ΔBrier |
|-----|--:|--:|--:|
| E0 | 1520 | −0.0164 [−0.0262, −0.0076] | −0.0089 |
| SP1 | 1520 | −0.0196 [−0.0281, −0.0112] | −0.0120 |
| I1 | 1520 | −0.0089 [−0.0177, −0.0006] | −0.0040 |
| D1 | 1224 | −0.0181 [−0.0270, −0.0094] | −0.0123 |
| F1 | 1372 | −0.0083 [−0.0178, +0.0002] | −0.0039 |
| Toplam | 7156 | **−0.0142 [−0.0183, −0.0104]** | −0.0082 |

Okuma: 5/5 yön tutarlı, toplam aralık sıfırı dışlıyor; F1 aralığı sıfıra değiyor, I1 zar zor dışlıyor.
ROI hâlâ negatif (toplam −7.1% → −6.9%). Rapor: `reports/backtest-xg-gate.md`. Canlıya alma kodu:
`engine/store_xg.py` + `service.py` (`dc-2.0-xg`, kapsam ≥ %95 olan ligde). Elo aynı gün YENİDEN
ÖLÇÜLEMEDİ (api.clubelo.com 502).

## 3. Elo harmanı (`engine/backtest_elo.py`, 2026-07-01) — GEÇTİ, baseline xG-DC w=0.75

| Lig | base LL | base Brier | λ* | ΔLL | ΔBrier | a (gol/Elo) | b (ev, gol) | total |
|-----|--:|--:|--:|--:|--:|--:|--:|--:|
| E0 | 0.9590 | 0.5685 | 0.15 | −0.0010 | −0.0004 | 0.004605 | 0.008 | 2.69 |
| SP1 | 0.9803 | 0.5829 | 0.30 | −0.0017 | −0.0007 | 0.004769 | 0.228 | 2.51 |
| I1 | 0.9823 | 0.5862 | 0.30 | −0.0015 | −0.0012 | 0.005452 | 0.200 | 3.05 |
| D1 | 0.9933 | 0.5921 | 0.40 | −0.0022 | −0.0012 | 0.005213 | 0.322 | 3.03 |
| F1 | 1.0042 | 0.6006 | 0.40 | −0.0036 | −0.0026 | 0.005553 | 0.029 | 2.76 |

Okuma: küçük ama 5/5 aynı yönde → gerçek sinyal. Canlı
sabitler `engine/publish_elo.py ELO_MAP` (λ test-seti seçimi → mütevazı).

## 4. Form / H2H tilt (`engine/backtest_context.py`, 2026-07-01) — DÜŞTÜ

Form tilt 5/5 ligde kötüleştirdi (ΔLL +0.0007…+0.0037). H2H en iyi −0.0002 (gürültü), I1'de
kötü. Sebep: 180g yarı-ömür formu zaten içeriyor (çift-sayım). Tekrar deneme; denenecekse
yalnız **yarı-ömrü kısaltarak** (form yerine) ve lig-başı.

## 5. Piyasa harmanı — TS (`scripts/backtest-blend.ts`, `src/lib/odds/blend.ts`)

3 lig × 2 sezon, ~2000 maç, gerçek Pinnacle/Bet365. w=0.7'de DC-tek'e göre 1X2 isabet
~%48 → ~%52, log-loss ~%4–6 iyileşme; kazanımın ~%95'i alınırken DC katkısı ~%30 korunur.
w=1 = bahisçiyi aynen satmak (edge sıfır). **Not:** bu, bağımsız model karnesine girmez;
yayın ürünü tartışması için `methodology.md` §5.

## 6. Piyasa modeli (1X2→Poisson ters çözüm, `src/lib/market-model.ts`, 2026-08-27, n=70)

1X2 favori %41.4 (motor aynı maçlarda %38.6), çifte şans %75.7. Ü/A: "Üst" derken %84.2
(n=19), "Alt" derken %39.2 (n=51) → tek taraflı (1X2 tempo taşımıyor). KG %54.3 (taban %60)
→ güvenilmez. Kapsam dışı 242 lig için LLM zemini; motora yazmaz.

## 7. Canlı karne ölçümleri (üretim DB)

- 2026-08-11, 3.737 sonuçlanmış tahmin: sıralama doğru (%43.7 → %67.6 güven arttıkça) ama
  üst dilim %79.9 iddia / %67.6 gerçek → şişkin → izotonik kalibrasyon eklendi.
- Aynı ölçüm: tahminlerin %99.8'i `dc_model_params`'ı olmayan 242 ligden, isabet %49.4 →
  `model-coverage` (yalnız 10 lig yayınla).
- 2026-09-05: 10.687 satır hepsi `dc-1.0`; 249 kickoff-sonrası yeniden yazım; ROI açılış
  ve kapanış artık ayrı, kapsam yüzdesiyle (`performance.ts`).
- Canlı model = §1 baseline (gol-DC, FotMob deposu, 540g). §2–§3 kazanımları canlıda YOK.

## 8. Referans sabitler (dış kaynak, projeye özgü değil)

`football-match-forecasting` skill'i uluslararası maçlarda Elo→gol katsayısını 0.32 yerine
**≈0.45** (toplam gol tabanı 2.5) bulmuş; bizim kulüp verimizde eşdeğer `a≈0.0046–0.0056
gol/Elo puanı` (=0.46–0.56 / 100 Elo) ile uyumlu. Katsayıyı her Elo kaynağı için yeniden
kalibre et.

## Güncelleme günlüğü

- 2026-09-05: tablo oluşturuldu (kaynak: reports/*.md, docs/audit-2026-09-05.md, kod yorumları).
- 2026-09-05: §2b xG kapısı bootstrap aralığıyla yeniden ölçüldü (GEÇTİ); canlı entegrasyon kodu yazıldı (deploy bekliyor).

## 9. Hızlı bulgu — kurulum testi (2026-09-05, `calibrate_backtest.py`, E0 2019→2024)

`export_fdco_csv.py E0 2019 2024` → forecasting skill'in **kendi rolling Elo → Poisson/DC**
modeli (dış veri yok, yalnız sonuçlar). Test 2021-08-01+, n=1440 (≥20 maç filtresi; §1'deki
1520 ile birebir aynı küme DEĞİL).

| coeff | tgb | Brier | Log-loss |
|--:|--:|--:|--:|
| 0.32 | 2.5 | 0.5727 | 0.9642 |
| **0.40** | **2.6** | **0.5700** | **0.9598** |
| 0.45 | 2.5 | 0.5711 | 0.9629 |

Okuma: sadece sonuç tabanlı rolling Elo, PL'de gol-DC baseline'ı (0.9747) belirgin geçiyor
ve xG-DC'ye (0.9582) yaklaşıyor. Reliability: deplasman büyük favorileri (Elo farkı < −150)
gerçek %68 kazanırken model %61 diyor → deplasman favorisi ezmesi; ev favorisi (+150) %63
gerçek / %66 model → hafif şişkin. Sonuç: **kulüp verisi için coeff≈0.40**, 0.45 değil.
Bu, roadmap #1 (Elo'yu canlıya taşıma) ve #3 (ev avantajı) için ek gerekçe; 5 ligde ve
aynı test kümesinde `gate.py` ile tekrarlanmadan tabloya "geçti" olarak girmez.
