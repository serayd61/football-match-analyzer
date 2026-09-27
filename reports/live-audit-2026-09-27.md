# Canlı karne denetimi — 27 Eylül 2026 (üretim DB, kapanış oranı benchmark'ı)

Kaynak: `engine_predictions` (model_version `dc-1.0`, kapsamdaki 11 lig, `settled AND result IS NOT NULL`)
⨝ `prediction_odds` (phase `closing`, son yakalama). n = **403** maç, Ağu–Eyl 2026. Sorgular Supabase'te
elle koşuldu; SQL bu raporun sonunda. Küçük örneklem: isabet için %95 aralığı ≈ ±5 puan.

## 1. Model vs kapanış piyasası — aynı maçlar

| | dc-1.0 (canlı) | Piyasa (de-vig kapanış) | Harman 0.3·model + 0.7·piyasa |
|---|--:|--:|--:|
| Log-loss (3 sınıf) | **1.0335** | 0.9960 | 1.0025 |
| Brier | 0.6188 | 0.5955 | – |
| 1X2 isabet (favori) | 45.7% | 48.1% | 47.6% |
| Sabit 1u ROI, kapanış | −17.2% | (favori) −17.2% | – |

Rastgele log-loss 1.099. Model piyasanın **0.037 LL** gerisinde — çevrimdışı backtest'teki
farkın (~0.02, `scoreboard.md §1`) yaklaşık iki katı. Aylara göre: Ağu 0.044, Eyl 0.031 (kapanıyor).

## 2. Nerede kaybediyor?

- **Anlaşmazlık maçları.** Model, piyasa favorisiyle %84 aynı tarafı seçiyor. Ayrıştığı **65 maçta
  isabet %27.7** (anlaştığı 338 maçta %49.1). Yani modelin "piyasadan farklı gördüğü" yerler bugün
  sinyal değil gürültü; −17% ROI'nin modelden gelen kısmı buradan.
- **Keskinlik düşük.** Favori olasılığı ortalama 0.50 (piyasa 0.52), p_home std 0.16 (piyasa 0.175),
  korelasyon 0.85. Ortalamalar (ev/ber/dep) piyasayla ve gerçekle uyumlu → **toplu kalibrasyon iyi,
  maç-bazlı ayrım zayıf**. Bu, kısa/gürültülü veriyle fit edilmiş DC'nin klasik görüntüsü.
- **Gol sayısı düşük tahmin.** λ toplamı 2.85 vs gerçek 3.14 (Eredivisie 3.42 vs 4.10, Bundesliga
  3.36 vs 3.97). Ü/A ve KG çağrıları sistematik olarak "Alt/KG Yok" tarafına yatık.
- **ROI'nin çoğu dönem gürültüsü.** Kapanış favorisini körü körüne oynamak da −17% getirmiş
  (Eredivisie'de ev %25 kazandı, piyasa %45 diyordu). 403 maçta ROI'den model çıkarımı yapılmaz.

## 3. Arşiv / boru hattı bulguları (bugün)

- 131 kapsam-içi maç 7-gün void'inde kaybolmuştu (tarih kayması; düzeltme 19 Eyl'de gelmiş, öncesi
  void). Yeniden açıldı, cron sonuçlandırdı: karne 422 → 550.
- Şampiyonlar Ligi 26/27 yeni FotMob kimliği (943230, `INT-2`) → bu sezon hiç tahmin yok. Site
  düzeltildi; motorda `LEAGUE_ALIASES=943230:42` (Hetzner restart gerek).
- Gölge sürüm `dc-2.0-xg` canlıda yalnız 17–20 Eyl arası 73 maç üretmiş (eşleştirilmiş fark
  ölçülemez küçük); haftalık inceleme kapısı için veri yok. Milli ara 6 Ekim'e kadar.

## 4. Ne yapılmalı (beklenen kazanca göre)

1. **Kanıtlı sürümleri canlıya al**: `dc-2.0-xg` (kapı CI ile geçti, ΔLL −0.014) + Elo harmanı
   (−0.002). Backtest'te modeli piyasanın ~0.01 gerisine getirir; canlı fark 0.037 → ~0.02.
   Yol: `engine-versions activate` (kapı sunucuda zorlanır). İlk büyük-lig hafta sonu 17–18 Ekim.
2. **Anlaşmazlık koruması** (seçim kuralı, motora dokunmaz): model seçimi ≠ piyasa favorisi ve
   piyasa favorisi p ≥ 0.45 ise → risk "Yüksek", günün seçimine girmez. Bugünkü veriyle
   isabet %45.7 → ~%49; edge iddiası değil, kayıp kesici. Ölçümü karnede ayrı sütun.
3. **Yayın harmanı** `dc-2.0-blend` (w=0.7 piyasa): kullanıcıya en kalibre olasılık — 403 maçta
   LL 1.0335 → 1.0025, isabet +2 puan; 2000-maç TS backtest'te +3–4 puan. Bağımsız sürüm karne
   için ayrı kalır (`methodology.md §5`). Kapanış oranı kickoff −90 dk'da yakalanmalı.
4. **Gol seviyesi düzeltmesi**: sezon-içi lig toplam-gol çarpanı (EWMA) ile λ ölçekle; Ü/A-KG
   walk-forward LL ile kapıdan geçir (roadmap #4). Hızlı, düşük risk.
5. **Sezon başı büzülme**: `shrink_k` taraması + önceki sezon lig gücü önseli; Ağustos farkı
   (0.044) bunun işareti.

Beklenti yönetimi: kapanış piyasası ~%52–57 isabetle tavan; kalibre bir model onu **geçmez**,
ona yaklaşır. "Daha net sonuç" = daha düşük log-loss ve dürüst güven; isabet yüzdesi tek başına
hedef olmamalı.

## SQL (özet)
Kapsam id'leri: 47, 938218, 87, 55, 54, 53, 937276, 61, 268, 1000001407, 71. Kapanış: `prediction_odds`
`phase='closing'`, fixture başına son `captured_at`. LL = −ln(p[sonuç]); harman = 0.3·model + 0.7·piyasa.

## 5. Aynı gün uygulanan / denenen

### Piyasa koruması — UYGULANDI (site, `lib/site/risk.ts`)
`riskWithMarket(conf, pick, market)`: seçim ≠ kapanış favorisi → `disagree`; favori < %45 → `tight`;
her ikisi de etiketi **Yüksek**'e yükseltir (asla düşürmez). Liste satırında kısa not, maç sayfasında
açıklama kutusu. Gerekçe (n=403):

| Grup | n | İsabet |
|---|--:|--:|
| Anlaşıyor, favori ≥ %55 | 141 | 68.1% |
| Anlaşıyor, favori %45–55 | 107 | 47.7% |
| Anlaşıyor, favori < %45 (sıkı) | 111 | 27.9% |
| Ayrışıyor (hepsi) | 65 | 27.7% |

Ölçüm: bayraklı satırların isabeti karnede ayrı sütun olarak izlenmeli (yapılacak).

### Gol seviyesi düzeltmesi (site tarafı) — KAPIDAN GEÇMEDİ
Fikir: son 45–60 günün Σgol/Σλ oranıyla λ'yı ölçekle, Ü2,5/KG'yi yeniden türet. Walk-forward, n=522
(Ağu–Eyl), stored p ile fark olarak uygulandı:

| Ay | f (ort.) | Ü2,5 LL stored → düzeltilmiş | KG LL stored → düzeltilmiş |
|---|--:|--:|--:|
| Ağustos | 0.97 | 0.6760 → 0.6849 (+0.009) | 0.6787 → 0.6865 (+0.008) |
| Eylül | 1.07 | 0.6856 → 0.6716 (−0.014) | 0.6847 → 0.6779 (−0.007) |

Sapma gerçek (gol 3.05–3.07 vs λ 2.82, Üst oranı %61–63 vs p %52.5) ama trailing çarpan rejime
duyarlı: Ağustos'ta Temmuz'un düşük skorlu Brezilya maçları çarpanı ters yöne çekti. Lig-başı
çarpan için sezon başında veri yok. Sonuç: site tarafında yamamak yerine motorda çözülmeli —
toplam-gol seviyesi için ayrı (daha kısa) yarı-ömür ya da sezon-içi lig intercept'i; kapı
`engine/backtest.py`'ye Ü/A-KG log-loss kolonu eklenerek FD.co.uk'ta (roadmap #4).
