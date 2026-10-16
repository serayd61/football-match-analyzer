# Google Play mağaza metni — tr-TR

Play Console "Ana mağaza girişi" (Türkçe) için kaynak. Sınırlar: başlık ≤ 30, kısa açıklama ≤ 80, tam açıklama ≤ 4000 karakter. Console'a yapıştırmadan önce `node scripts/aso-validate.js` çalıştır. Yasak kelimeler: tüyo, iddaa tahmini, kesin, banko, bonus, garanti.

Aşağıdaki her ifade bugün var olan özellikleri anlatır (`src/lib/site/leagues.ts` = 11 lig; pazarlar, karne sayfası, lig sayfaları, 4 dil, koyu tema). Sıralama, indirme sayısı veya arama hacmi iddiası yoktur.

## Title

```text
Football Analytics Pro
```

## Short description

```text
Futbol istatistiği ve maç olasılıkları; her tahmin herkese açık sonuçlanır.
```

## Full description

```text
Football Analytics Pro futbol istatistiklerini maç olasılığına çevirir. Dixon-Coles istatistiksel modeli 11 ligdeki her maçı başlamadan önce derecelendirir; her tahmin maç bitince herkese açık biçimde puanlanır, tutan da tutmayan da.

MAÇ OLASILIKLARI VE FUTBOL İSTATİSTİĞİ
• Derecelendirilen her maç için 1X2 (ev / beraberlik / deplasman), 2,5 alt/üst ve karşılıklı gol olasılıkları
• Beklenen gol (xG), olası skorlar ve Asya handikap çizgileri
• Piyasaya göre edge: model olasılığının bahis şirketinin ima ettiği fiyattan ne kadar uzak olduğu
• Her tahminde güven halkası ve Düşük / Orta / Yüksek risk etiketi

PUAN DURUMU, FORM VE GEÇMİŞ MAÇLAR
• Her maç için puan durumu, son form, eksikler ve aralarındaki maçlar
• Her ligin sonuçlanmış karnesiyle lig sayfaları
• Önümüzdeki yedi günün fikstürü ve sonuç arşivi

HERKESE AÇIK KARNE
• Her tahmin maçtan önce zaman damgası alır, sonradan değiştirilemez
• İsabet oranı, Brier skoru, kalibrasyon ve sabit birim getirisi; her pazartesi yenilenir
• Kötü aylar sayfada kalır: geçmiş hiçbir zaman kırpılmaz

KAPSANAN LİGLER
Premier League, Championship, La Liga, Serie A, Bundesliga, Ligue 1, Eredivisie, Liga Portugal, UEFA Şampiyonlar Ligi, Brasileirão, Süper Lig. Bu liglerin dışındaki maçlar model derecesi olmadan görünür ve karneye sayılmaz.

MODEL NASIL ÇALIŞIR
1. Model: xG, Elo ve izotonik kalibrasyonlu Dixon-Coles (iki değişkenli Poisson) modeli, piyasa oranlarıyla harmanlanır.
2. Tahmin: tahminler maçtan bir gece önce zaman damgasıyla yayınlanır.
3. Sonuçlandırma: maç bitince tahmin puanlanır ve karne sayfasında yayınlanır.
Yöntem sayfası her adımı açıklar.

GÜNLÜK KULLANIM İÇİN
• Açık ve koyu tema, sistem ayarını izler
• Türkçe, İngilizce, Almanca ve İtalyanca
• Telefon, tablet ve web'de aynı hesapla

PLANLAR
Maç önizlemeleri, puan durumları ve herkese açık karne ücretsizdir. Üyeler her maç için modelin olasılıklarını, güven ve risk bilgisini, olası skorları, edge görünümünü ve tam arşivi görür.

ÖNEMLİ
Football Analytics Pro bir bilgi ve istatistik servisidir. Bahis sunmaz, bahis kabul etmez, hiçbir bahis şirketiyle bağlantılı değildir. Olasılıklar istatistiksel tahmindir, finansal tavsiye değildir. 18+. Lütfen sorumlu oynayın.
```

## Anahtar kelime kümeleri (aday, ölçülmedi)

| Niyet | Birincil | İkincil |
|---|---|---|
| İstatistik | futbol istatistik, futbol istatistikleri, maç istatistikleri | beklenen gol, xG, Brier, kalibrasyon |
| Olasılık | maç olasılığı, futbol tahmin, maç tahmini | 1X2, alt üst, karşılıklı gol |
| Bağlam | puan durumu, form, geçmiş maçlar | fikstür, maç sonuçları |
| Ligler | Süper Lig, Premier League, La Liga, Serie A, Bundesliga | Şampiyonlar Ligi, Ligue 1, Eredivisie |
| Güven | karne, isabet oranı, şeffaf tahmin | herkese açık karne, sonuçlanmış tahmin |

Not: "iddaa" kelimesi hem marka hem bahis çağrışımı taşıdığından metne alınmadı; Google Ads kumar sertifikası diliyle tutarlı kalır.

## Yayınlamadan önce doğrulanacaklar
- "Her pazartesi yenilenir" yalnız pazartesi işi çalıştığı sürece.
- "Eksikler" (API-Football sakatlık verisi) kaynak değişirse kaldır.
- Lig listesi her sezon `src/lib/site/leagues.ts` ile eşleşmeli.
