# Backtest Baseline — Gol-Dixon-Coles (özellik eklemeden ÖNCE)

> **Amaç:** Bu, xG/ELO/form/H2H özellikleri eklenmeden ÖNCEKİ dürüst referans. Her yeni özellik bu sayıları **out-of-sample (walk-forward)** geçmek zorunda; geçmezse alınmaz.
> **Üretim:** `engine/backtest.py <lig>` · Tarih: 2026-06-30 · Ortam: yerel (venv, ağ açık).

## Metodoloji
- **Veri:** football-data.co.uk (ücretsiz) — sonuç + kapanış oranları (Pinnacle closing > PS > B365 > WH). Sezon 2019→2024.
- **Test dönemi:** sezon `2122` (2021-22) ve sonrası. Walk-forward: her maç için **yalnız öncesindeki** maçlarla fit (pencere 540 gün, yarı-ömür 180 gün, 25 iterasyon), sonra tahmin → data leakage yok.
- **Model:** `engine/model.py` — saf-Python çarpımsal Dixon-Coles (atak/defans/ev-avantajı + rho düşük-skor düzeltmesi), **yalnız gol** ile.
- **Metrikler:** 1X2 isabet · 3-sınıf Brier (toplam, düşük=iyi) · 3-sınıf log-loss (düşük=iyi; rastgele=1.099) · **value-betting ROI** (EV>%5, kapanış oranına karşı — asıl "edge" ölçüsü).

## Sonuçlar (BASELINE — aşılması gereken)

| Lig | Test maçı | 1X2 model | 1X2 bahisçi | Fark | Brier | Log-loss | Value-bet | ROI |
|-----|----------:|----------:|------------:|-----:|------:|---------:|----------:|----:|
| **E0** Premier League | 1520 | 54.7% | 57.0% | −2.3 | 0.5769 | 0.9747 | 1531 | **−6.64%** |
| **SP1** LaLiga | 1520 | 51.8% | 54.2% | −2.4 | 0.5948 | 0.9996 | 1488 | **−13.47%** |
| **I1** Serie A | 1520 | 53.3% | 53.9% | −0.6 | 0.5899 | 0.9908 | 1428 | **−4.42%** |
| **D1** Bundesliga | 1224 | 50.9% | 53.5% | −2.6 | 0.6044 | 1.0115 | 1164 | **−8.16%** |
| **F1** Ligue 1 | 1372 | 50.8% | 52.7% | −1.9 | 0.6045 | 1.0124 | 1418 | **−2.73%** |

## Yorum (dürüst)
- Model makul ama **bahisçinin ~2-3 puan altında** ve **hiçbir ligde kapanış oranına karşı pozitif ROI yok** (edge yok). Bu normal: kapanış çizgisini yenmek çok zor.
- **Hedef:** xG (Faz 1) + ELO (Faz 2) + form/H2H (Faz 3) ile (a) bahisçiye olan farkı kapat, (b) Brier/log-loss'u düşür, (c) ROI'yi yukarı taşı. Her fazın çıktısı buraya karşı `reports/backtest-<özellik>.md`'de raporlanacak.
- **Kalibrasyon metriği (reliability)** Faz 1'de backtest'e eklenecek (güven skorları gerçek frekansla örtüşmeli).

## Not
football-data.co.uk **xG içermiyor** → xG Understat'tan (soccerdata) ayrı çekilecek ve takım-adı normalizasyonuyla bu maçlara eşlenecek (Faz 0.3 / `engine/features.py`).
