# xG-DC kapı ölçümü (bootstrap aralıklı) — 2026-09-05

Baseline: gol-DC (`model_xg.fit(xg_weight=0)` ≡ canlı `dc-1.0`'ın backtest eşdeğeri, football-data.co.uk verisi)
Aday: xG-DC, `xg_weight=0.75` (2026-07-01 taramasındaki plato değeri; 0.5–1.0 arası ligler arasında düz)
Veri: E0/SP1/I1/D1/F1, sezon 2019-20 → 2024-25; gol + kapanış oranı FD.co.uk, xG Understat (soccerdata), kapsama 5/5 ligde %100
Test: 2021-22'den itibaren, walk-forward (fit yalnız maç tarihinden önce; pencere 540 g, yarı-ömür 180 g), n = 7.156

## Yöntem
`engine/export_preds.py` her test maçı için baseline ve aday olasılıklarını aynı sırada JSONL'e yazar;
`.claude/skills/fa-prediction-lab/scripts/gate.py` eşleştirilmiş bootstrap (2.000 örnek) ile Δlog-loss %95
aralığı verir. Baseline satırı 2026-06-30 raporuyla (reports/backtest-baseline.md) birebir aynı sayıları verdi
(sağlama). Aday parametresi 2026-07-01'de test setinde tarandı; burada yeniden taranmadı, sabit 0.75 kullanıldı.

## Sonuç

| Lig | n | LL base → xG | ΔLL [%95 CI] | ΔBrier | ROI base → xG (EV>5%) |
|---|--:|--:|--:|--:|--:|
| E0 | 1520 | 0.9747 → 0.9583 | −0.0164 [−0.0262, −0.0076] | −0.0089 | −6.6% → +1.8% |
| SP1 | 1520 | 0.9996 → 0.9800 | −0.0196 [−0.0281, −0.0112] | −0.0120 | −13.5% → −8.5% |
| I1 | 1520 | 0.9908 → 0.9819 | −0.0089 [−0.0177, −0.0006] | −0.0040 | −4.4% → −11.3% |
| D1 | 1224 | 1.0115 → 0.9934 | −0.0181 [−0.0270, −0.0094] | −0.0123 | −8.2% → −7.7% |
| F1 | 1372 | 1.0124 → 1.0041 | −0.0083 [−0.0178, +0.0002] | −0.0039 | −2.7% → −9.8% |
| **Toplam** | **7156** | **0.9969 → 0.9827** | **−0.0142 [−0.0183, −0.0104]** | **−0.0082** | −7.1% → −6.9% |

Bahisçi (Pinnacle kapanış, de-vig) 1X2 isabeti %54.3; model %52.4 (base) → %53.0 (xG).

## Dürüst yorum
- Olasılık kalitesi 5/5 ligde iyileşti; toplam aralık sıfırı net dışlıyor. F1'de aralık sıfıra değiyor
  (+0.0002), I1'de zar zor dışlıyor: bu iki ligde kazanç küçük ve daha az kesin.
- ROI hâlâ negatif ve ligden lige zıt yönde: bahis kenarı iddiası YOK. Kapanış oranı benchmark'ı
  modelin üstünde kalıyor.
- xG ağırlığı test setinde seçilmişti (seçim yanlılığı); plato geniş olduğundan 0.75 makul, ama
  canlıda ilk 300 sonuçlanmış maçtan sonra `performance.ts` karnesi `dc-1.0` ile yan yana okunmalı.
- Elo harmanı (Faz 2) bu turda YENİDEN ÖLÇÜLEMEDİ: `api.clubelo.com` 502 döndü. Skor tablosundaki
  Elo satırları aralıksız kalır; Elo canlıya bu ölçüm tekrarlanmadan alınmaz.

## Karar: GEÇTİ → canlıya alma (dal `audit/2026-09-05-contract-and-frontend`)
- `engine/store_xg.py`: Understat xG'yi FotMob maç id'lerine bağlar (`xg.jsonl`), lig başına kapsam raporu.
- `engine/service.py`: kapsam ≥ `XG_MIN_COVERAGE` (0.95) olan ligde `model_xg.fit(xg_weight=0.75)` ve
  satır `modelVersion = dc-2.0-xg`; diğer ligler `dc-1.0`. `xg.jsonl` yoksa davranış eskisiyle aynı.
- Ingest her satırın kendi sürümüyle yazar (unique fixture+version); site `SITE_MODEL_VERSION`
  ayarlanmadıkça fixture başına en son yazılanı gösterir → geçişte iki sürüm çakışmaz.
- Üretim adımları (kullanıcı): `engine/DEPLOY.md` §xG.

## Çalıştırma
```
cd engine
SOCCERDATA_DIR=/tmp/soccerdata ../src/lib/data-sources/venv/bin/python export_preds.py --no-elo --out /tmp/gate-xg
python3 ../.claude/skills/fa-prediction-lab/scripts/gate.py /tmp/gate-xg/base.jsonl /tmp/gate-xg/xg.jsonl
python3 -m unittest tests.test_xg_live
```
