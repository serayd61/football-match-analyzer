# Backtest — xG-Dixon-Coles (Faz 1) vs Baseline

> **Sonuç: xG kapısı GEÇTİ.** Birincil metrikler (log-loss + Brier) **5/5 ligde** iyileşti; kalibrasyon (ECE) genel olarak düzeldi. `xg_weight=0.75` global default olarak seçildi (her ligde en-iyi/en-iyiye-yakın).
> **Üretim:** `engine/backtest_xg.py <lig>` · xG kaynağı Understat (soccerdata) · gol/oran football-data.co.uk · Tarih 2026-07-01 · **xG kapsama tüm liglerde %100** (isim eşleme sorunsuz).

## Yöntem
`model_xg.fit(xg_weight=w)` — atak/defans hedefi `(1-w)·gol + w·xG` harmanı; `w=0` saf gol (baseline'a EŞDEĞER, sağlama geçti). predict DEĞİŞMEDİ (aynı `{A,D,H,base}` şeması). Walk-forward, test sezon 2122+, pencere 540g/yarı-ömür 180g. Metrikler baseline ile aynı + **ECE** (kalibrasyon, düşük=iyi).

## Sonuçlar (baseline w=0.00 → en iyi log-loss)

| Lig | Metrik | Baseline (w=0) | En iyi w | En iyi değer | Δ |
|-----|--------|---------------:|---------:|-------------:|---|
| **E0** | log-loss | 0.9747 | 0.75 | **0.9582** | −0.0165 ✅ |
| | Brier | 0.5769 | | 0.5680 | −0.0089 ✅ |
| | 1X2 | 54.7% | | 55.6% | +0.9 |
| | ROI | −6.64% | | **+1.73%** | pozitife döndü |
| **SP1** | log-loss | 0.9996 | 1.00 | **0.9792** | −0.0204 ✅ |
| | Brier | 0.5948 | | 0.5824 | −0.0124 ✅ |
| | ROI | −13.47% | (0.5) | −7.46% | iyileşti, negatif |
| **I1** | log-loss | 0.9908 | 0.75 | **0.9819** | −0.0089 ✅ |
| | Brier | 0.5899 | | 0.5859 | −0.0040 ✅ |
| | ROI | −4.42% | | −11.36% | kötüleşti |
| **D1** | log-loss | 1.0115 | 1.00 | **0.9934** | −0.0181 ✅ |
| | Brier | 0.6044 | | 0.5916 | −0.0128 ✅ |
| | ROI | −8.16% | (0.75) | −7.70% | ~aynı |
| **F1** | log-loss | 1.0124 | 0.50 | **1.0040** | −0.0084 ✅ |
| | Brier | 0.6045 | | 0.6002 | −0.0043 ✅ |
| | ROI | −2.73% | | −4.44% | kötüleşti |

## Dürüst yorum
- **Olasılık kalitesi (log-loss/Brier/kalibrasyon): xG net kazanım, 5/5 lig.** Ürünün gösterdiği olasılık/güven değerleri için doğru başarı ölçüsü budur → xG **alınır**.
- **Value-betting ROI: xG tek başına güvenilir bahis-edge üretmiyor.** Sadece E0 pozitife döndü; diğerleri karışık. ROI gürültülü, az bahis sayısına ve lige-özgü oran verimsizliğine duyarlı. **İddia edilmemeli.** Edge için Faz 2 (ELO) + Faz 3 (form/H2H) katmanları gerekir.
- **Karar:** `xg_weight=0.75` benimse (her ligde en-iyi/en-iyiye çok yakın log-loss; en fazla 0.0008 fark).

## Sonraki adım (F1.3) — canlıya taşıma engeli tespit edildi
Python model `{A,D,H,base}` (çarpımsal) üretir; canlı TS predict `{attack,defense,homeAdv,rho}` (toplamsal) + **football-data.org** takım adları bekler. Python ise **football-data.co.uk** adları kullanıyor. Yani `dc_model_params`'a doğrudan yazmak iki dönüşüm gerektirir: (1) çarpımsal→toplamsal parametre (matematiksel, kolay: `attack_i=ln A_i+0.5 ln base`, `defense_i=ln D_i+0.5 ln base`, `homeAdv=ln H`, `rho=-0.10`), (2) FD.co.uk↔football-data.org takım-adı eşlemesi (yeni normalizasyon katmanı). Bu bir mimari karar + **production yazımı** → kullanıcı onayı gerekir.
