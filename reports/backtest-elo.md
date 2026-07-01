# Faz 2 — ELO harman backtest raporu (Club Elo)

**Tarih:** 2026-07-01 · **Motor:** `engine/backtest_elo.py` + `engine/features_elo.py`
**Baseline:** xG-Dixon-Coles (xg_weight=0.75) — canlı model.
**Test:** walk-forward, sezon 2021-22'den itibaren; eğitim = test-öncesi sezonlar (sızıntısız).

## Yöntem
ELO (Club Elo / soccerdata, POINT-IN-TIME haftalık snapshot, maçtan önceki en yakın
Pazartesi) bağımsız bir 1X2 tahminine çevrilir, xG-DC ile predict-zamanı harmanlanır:

    p = (1-λ)·p_xgDC + λ·p_ELO

ELO→1X2: eğitim üzerinde `gol_farkı ≈ a·(elo_home − elo_away) + b` lineer eşlemesi
(b = ev avantajı, gol); maç için supremacy → (λ_h, λ_a) → aynı Poisson+DC(rho)
skorlaması. İsim eşleme: ClubElo adları FD.co.uk'e çok yakın; `features.canon()` +
7+2 istisna aliası (`_ELO_FIX`) ile **5/5 lig %100 kapsama**.

## Sonuç — 5/5 lig GEÇTİ ✅

| Lig | ELO kapsama | base LogLoss | base Brier | en iyi λ | ΔLogLoss | ΔBrier |
|-----|:-----------:|:------------:|:----------:|:--------:|:--------:|:------:|
| E0  (PL)  | %100 | 0.9590 | 0.5685 | 0.15 | **−0.0010** | −0.0004 |
| SP1 (PD)  | %100 | 0.9803 | 0.5829 | 0.30 | **−0.0017** | −0.0007 |
| I1  (SA)  | %100 | 0.9823 | 0.5862 | 0.30 | **−0.0015** | −0.0012 |
| D1  (BL1) | %100 | 0.9933 | 0.5921 | 0.40 | **−0.0022** | −0.0012 |
| F1  (FL1) | %100 | 1.0042 | 0.6006 | 0.40 | **−0.0036** | −0.0026 |

**ELO→gol fit parametreleri** (a: gol/ELO-puanı, b: ev-avantajı gol, total: lig gol):

| Lig | a | b | total |
|-----|--:|--:|------:|
| E0  | 0.004605 | 0.008 | 2.69 |
| SP1 | 0.004769 | 0.228 | 2.51 |
| I1  | 0.005452 | 0.200 | 3.05 |
| D1  | 0.005213 | 0.322 | 3.03 |
| F1  | 0.005553 | 0.029 | 2.76 |

## Yorum (dürüst)
- **Tutarlı, gerçek sinyal:** log-loss VE Brier **her 5 ligde** iyileşti. Kazanç
  mutlak olarak küçük (log-loss 0.001–0.004) ama tüm liglerde aynı yönde → gürültü
  değil. ELO'nun kattığı marjinal bilgi = kupa/Avrupa formu + daha uzun hafıza +
  piyasa-benzeri iyi kalibrasyon (DC'nin gol+xG penceresinin göremediği).
- **Optimal λ 0.15–0.40** aralığında; canlı için **tek sabit λ≈0.25–0.30** makul
  (küçük ligsel kayıp, basitlik kazancı) veya lig-başına λ tablosu.
- **Bahis-edge iddiası YOK** (Faz 1'deki gibi): kazanım olasılık-kalitesi/kalibrasyon,
  ROI değil.

## Faz 3 (form/H2H) — NEGATİF, ship edilmedi
`engine/backtest_context.py`: xG-DC üstüne form/H2H predict-zamanı tilt.
- **form tilt 5/5 ligde KÖTÜLEŞTİRDİ** (ΔLogLoss +0.0007…+0.0037).
- **H2H marjinal/gürültü** (en iyi ~−0.0002, I1'de kötü).
- Sebep: xG-DC'nin 180-gün yarı-ömür ağırlığı son formu ZATEN içeriyor; ekstra tilt
  çift-sayım. **Dürüstlük kapısı → alınmadı.** Kod referans/ileride kalıyor.

## Çalıştırma
    SOCCERDATA_DIR=/tmp/soccerdata ../src/lib/data-sources/venv/bin/python -u run_elo_all.py   # 5 lig özet
    ... backtest_elo.py <FD_kodu>     # tek lig detay (λ taraması)
    ... backtest_context.py <FD_kodu> # form/H2H (negatif)
