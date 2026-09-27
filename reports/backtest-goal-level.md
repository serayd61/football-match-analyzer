# Backtest — lig gol seviyesi çarpanı (`model.level_factor`) — 2026-09-27

**Soru.** Canlı karnede modelin λ toplamı gerçek golün %8 altında (2,82 vs 3,07; Ağu–Eyl 2026,
n=522). Ligin taban gol seviyesini kısa yarı-ömürle takip eden, uzun seviyeye büzülen bir çarpan
Üst/Alt 2,5 ve KG olasılıklarını iyileştirir mi?

**Kurulum.** `engine/backtest_goals.py`. football-data.co.uk, 5 lig, 2019-20 → 2025-26, test 2021-22'den
itibaren (walk-forward, tarih başına tek fit, 540g pencere / 180g yarı-ömür). Baseline = canlı `dc-1.0`
yapısı. Adaylar: yarı-ömür {30, 45, 60, 90} × büzülme k {20, 40, 80} maç-eşdeğeri. Benchmark: Pinnacle
Üst/Alt 2,5 kapanışı (2-yollu de-vig).

## Sonuç — KAPIDAN GEÇMEDİ (etki yok)

| Lig | n | gol/maç gerçek | λ baseline | LL Ü2,5 base | en iyi aday ΔLL Ü | ΔLL KG | ΔLL 1X2 | piyasa LL Ü |
|---|--:|--:|--:|--:|--:|--:|--:|--:|
| E0 | 1900 | 2,93 | 2,90 | 0,6932 | −0,0002 | −0,0002 | −0,0001 | 0,6725 |
| SP1 | 1900 | 2,59 | 2,54 | 0,6925 | +0,0004 | −0,0010 | +0,0004 | 0,6668 |
| I1 | 1900 | 2,61 | 2,65 | 0,7053 | +0,0006 | +0,0022 | −0,0006 | 0,6820 |
| D1 | 1530 | 3,18 | 3,17 | 0,6730 | −0,0003 | +0,0004 | −0,0005 | 0,6456 |
| F1 | 1678 | 2,82 | 2,81 | 0,7002 | −0,0002 | −0,0019 | +0,0006 | 0,6719 |

Çarpan ortalaması her ligde 0,99–1,01; aylık kırılımda (E0) hiçbir ayda |ΔLL| > 0,006 yok, Ağustos'ta
sıfır. Yani **tarihsel veride modelin gol seviyesi yansız**: 540g/180g `base` beş ligde de gerçek golü
±0,05 içinde tutturuyor. Düzeltilecek sistematik bir sapma yok → çarpan hiçbir şey öğrenemiyor.

**Asıl bulgu.** Canlıdaki %8'lik fark modelin yapısal hatası değil. Kalan iki açıklama:
1. **2026-27 sezon başı gerçekten olağandışı gollü** (Eredivisie 4,10, Bundesliga 3,97 gol/maç;
   tarihsel Ağu–Eyl ortalamaları 3,2 civarı). Dünya Kupası yazı, kısa hazırlık. Model 180g atalatiyle
   buna ancak Ekim'de yetişir. Bu durumda çarpan bir "rejim sigortası" olur: tarihsel veride zararsız
   (Δ≈0), rejim değişiminde Eylül'de −0,014 (canlı SQL ölçümü). Kapı kuralı 5/5 iyileşme ister;
   "zararsız + nadir kazanç" kuralı geçmez. Karar: canlıya ALINMAZ; 2026-27 CSV'leri (FD.co.uk `2627`)
   gelince sezon-başı hipotezi doğrulanır.
2. **Hetzner deposu ile FD.co.uk arasında fark** (sezon-id birleşimi, eksik maç, farklı parametre).
   Kontrol: Hetzner'de `store.py stats` ile lig başına maç sayısı ve son 60 günün gol/λ oranı.

**Yan bulgu.** Model Üst/Alt log-loss'u her ligde piyasanın 0,02–0,03 üstünde (E0 0,693 vs 0,673).
Bu seviye değil, ayrım (keskinlik) farkı — xG ve piyasa harmanı (`goal-blend`, zaten canlı) buraya
çalışıyor. Roadmap #4'ün cevabı: gol pazarlarında öncelik seviye düzeltmesi değil, xG'nin canlıya
alınması ve oranı olan maç oranının artırılması.

Kod: `model.level_factor` (varsayılan kapalı, parite testi), `data.py` Ü/A oranları, `backtest_goals.py`,
`fetch_fd.sh`. Tahmin dosyaları `/tmp/goals/<LIG>_<aday>.jsonl` (gate.py girdisi).
