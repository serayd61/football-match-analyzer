# Erken fiyatta değer kuralı backtest — 2026-11-23

Baseline/model: gol-DC, canlı `dc-1.0` eşdeğeri (`model.fit`, 540 g pencere, 180 g yarı-ömür), walk-forward
Veri: football-data.co.uk, 9 lig (E0 SP1 I1 D1 F1 N1 P1 E1 T1), 2019-20 → 2025-26 (`engine/.cache/ffdata`, 27 Eylül önbelleği)
Kural seçimi: 2020-21 ve 2021-22 · Test: 2022-23 → 2025-26 (taranmadı)
Betik: `engine/backtest_openvalue.py`

## Soru

AI Sports Ratings futbol tablosunun lideri OddAlerts Alpha'nın yayınladığı yöntem
(her maçı fiyatla, erken bahisçi fiyatı adil fiyatın üstündeyse oyna, kuralı görülmemiş dönemde sına)
bizim modelimizle kâr eder mi? **Hayır.** Modelin "değer" dediği bahisler taban çizgisinden de kötü.

## Yöntem

- Seçimler: 1, X, 2, Üst 2,5, Alt 2,5. Her bahis 1 birim, yakalanan erken fiyattan sonuçlanır.
- Fiyat: Bet365 erken fiyatı (tek bahisçi, alınabilir) ve `Max` (o andaki en iyi fiyat, iyimser).
- "Erken fiyat" maçtan günler önce toplanan fiyattır; bahisçinin ilk açılış fiyatı değildir.
- Üç kural türü, 414 kural: `model` (p_model·oran − 1 ≥ t), `keskin` (Pinnacle erken fiyatının
  de-vig olasılığı·oran − 1 ≥ s; model kullanılmaz), `ikisi` (ikisi birden).
- Kapanışa karşı değer: Pinnacle kapanışının de-vig olasılığı · alınan oran − 1.
- Seçim: seçim sezonlarında n ≥ 300 olan kurallar içinde en yüksek ROI. Testte tarama yok.

## Sonuç

Taban (kuralsız, her seçim, test): Bet365 1X2 −8,2%, Ü/A −5,4%; Max 1X2 −3,5%, Ü/A −2,4%.

**Model kuralı** — 90 kuralın hiçbiri ne seçimde ne testte artıda:

| Model eşiği | Bet365 n | Bet365 ROI | Max n | Max ROI |
|---|--:|--:|--:|--:|
| ≥ %2 | 18.349 | −9,45% | 23.948 | −5,16% |
| ≥ %5 | 14.892 | −9,81% | 19.988 | −5,47% |
| ≥ %8 | 11.850 | −10,38% | 16.444 | −6,61% |
| ≥ %12 | 8.622 | −11,66% | 12.354 | −8,25% |
| ≥ %20 | 4.543 | −12,90% | 6.805 | −9,79% |

Eşik yükseldikçe zarar büyüyor: modelin gördüğü "değer" ters sinyal. Kapanışı geçme oranı
Bet365'te %21–23, Max'ta %43–44; yani model fiyat hareketini de öngörmüyor.

**Seçimde en iyi kural → test:**

| Kural | Seçim n / ROI | Test n / ROI [%95] | Kapanışa karşı | Kapanışı geçen |
|---|--:|--:|--:|--:|
| model · B365 · Ü/A · oran≤3 · ≥%2 | 4.386 / −5,8% | 7.442 / −7,5% [−9,7; −5,4] | −4,7% | %19 |
| model · Max · Ü/A · oran≤3 · ≥%20 | 1.455 / −1,3% | 2.139 / −7,6% [−11,7; −3,4] | −1,7% | %39 |
| keskin · B365 · hepsi · ≥%2 | 450 / +13,0% | 686 / +3,3% [−15,0; +23,3] | +0,9% | %57 |
| keskin · Max · Ü/A · oran≤5 · ≥%2 | 580 / +7,1% | 473 / −2,3% [−13,6; +9,2] | +3,8% | %67 |
| ikisi · B365 · 1X2 · oran≤5 · model≥%8, keskin≥−%2 | 415 / −0,7% | 661 / +0,3% [−11,3; +12,8] | −0,9% | %47 |
| ikisi · Max · 1X2 · model≥%20, keskin≥%2 | 650 / +4,4% | 852 / −16,7% [−33,7; +0,3] | +5,8% | %67 |

**Model piyasayla ayrıştıkça** (Bet365, model ≥ %5, test):

| Pinnacle'a göre fiyat | n | ROI |
|---|--:|--:|
| < −%5 | 7.107 | −14,1% |
| −5…−2% | 6.196 | −6,8% |
| −2…0% | 1.000 | −7,3% |
| ≥ 0% | 589 | +6,7% |

## Okuma

1. Canlı model tek başına fiyat avcılığına yetmiyor. 5/5 değil 0/90: karar net.
2. Kapanışı düzenli geçen tek şey keskin fiyat karşılaştırması (bir bahisçinin fiyatı Pinnacle'ın
   adil fiyatının üstünde). Bu modelden bağımsız; ROI aralıkları sıfırı içeriyor, örneklem küçük.
3. Son tablodaki +6,7% modelin değil, keskin koşulun işi (keskin-yalnız kuralı aynı bölgeyi seçiyor).
4. Önceki bulguyla tutarlı: model açığı, modelin piyasadan en çok ayrıştığı maçlarda
   (`reports/backtest-own-elo.md`, canlı denetim 2026-11-14).

## Sınırlar

- Elo harmanı ve xG bu ölçüme girmedi (ikinci kademe ve 2019 öncesi veri önbellekte yok;
  football-data.co.uk bugün yönlendirme döngüsü veriyordu).
- KG pazarı ölçülmedi (kaynakta oranı yok). 2026-27 sezonu yok.
- `Max` fiyatı gerçekte her zaman alınamaz; limit ve hesap kısıtı hesaba katılmadı.
- Gerçek açılış fiyatı (pazar açıldığı an) bu veride yok; OddAlerts'in kullandığı an bu.

## Karar

Model-tabanlı "değer seçimleri" defteri AÇILMAYACAK. Sıradaki ölçüm: aynı betikte DC+Elo ile tekrar
(kaynak erişilince) ve canlıda çok bahisçili fiyat yakalama ile keskin kuralın gölge kaydı.
