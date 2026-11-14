# Google Arama'da daha başarılı olmak — araştırma, 12 Kasım 2026

Kaynaklar: Search Console (Bağlantılar, Performans, Dizin raporları), hedef sorgularda arama sonuçları (EN/IT/TR, arama API'si üzerinden), rakip sayfa incelemeleri, 2026 çekirdek güncelleme analizleri. Bağlantılar en altta.

## 1. Bulgular

### 1.1 Sitenin dış bağlantısı yok denecek kadar az
Search Console → Bağlantılar: **toplam 5 dış bağlantı, 2 siteden** (x.com 3, google.com 2), hepsi `/en` ana sayfasına. İç bağlantı 2.196, bunun 1.526'sı ana sayfaya.
Sıralanan rakiplerin hepsi yıllardır bağlantı biriktirmiş alan adları (forebet, sportytrader, transfermarkt, footballpredictions.com). Ortalama konumumuzun 44 olması ve "tarandı, dizine eklenmedi" sayısı bununla tutarlı: Google siteye güvenmek için dış sinyal görmüyor.

### 1.2 10 Kasım'da çekirdek güncelleme başladı
Google, **Kasım 2026 çekirdek güncellemesini 10 Kasım'da** başlattı; iki hafta sürebilir (en geç 24 Kasım). Dizin raporundaki 10 Kasım toplu taraması aynı güne denk geliyor. 24 Kasım'a kadar sıralama ve dizin sayıları oynak olacak; bu aralıkta ölçüm yapıp sonuç çıkarmak yanıltır.

### 1.3 Sıralanan sayfalar tahmini açık gösteriyor
| Sorgu | Sıralananlar | Ortak özellik |
|---|---|---|
| premier league predictions this weekend | sports4cast, kickoff.co.uk, footballpredictions.com, BBC, Sky, forebet | Lig sayfasında her maç için skor + yüzde + tek cümle karar, herkese açık |
| pronostici partite di domani | sportytrader, wincomparator, futbol24, betmines, transfermarkt | "/pronostici/calcio/domani/" gibi sorguya özel sayfa; her maçta seçim + kısa analiz; bahis dili |
| bugünkü maç tahminleri yapay zeka | bilyoner, sporkolik, predigoal, aipredict, tipsgenerator, nerdytips | Sorguya özel açılış sayfası (`/tr/yapay-zeka-mac-tahmini`), açık isabet oranı (predigoal: %54, 5.756 maç), SSS |

footballpredictions.com maç sayfası: 11 bölüm (tahmin, ön izleme, kadrolar, sakat/cezalı, puan durumu, form, H2H, nerede izlenir), yazar imzası, yayın ve güncelleme tarihi. Yazılı analiz yalnız ~150 kelime; fark içerik miktarında değil, **sorunun cevabının sayfada olmasında**.
Bizde: 5 Kasım'dan beri yalnız tercih yönü açık; olasılık üyelere.

### 1.4 2026'da Google'ın hedef aldığı kalıp: şablon sayfalar
- Çekirdek güncelleme analizleri (Zyppy, 400+ site, 12 ay): kazananların ortak özellikleri — kendi ürünü var (%70'e %35), ziyaretçi işini sayfada bitirebiliyor (%84'e %50), kopyalanamaz varlığı var (%93'e %57), dar konu odağı, marka araması.
- Lily Ray (Ekim 2026): etkilenen sitelerde en sık kalıp "birkaç kelimesi değişen şablon sayfalar"; 2026'da spam güncellemeleri sıklaştı; "tarandı, dizine eklenmedi" artışı neredeyse her örnekte kalite sorununa bağlı.
- Bizde: dizinde ~8.000 sayfa, 28 günde ~180 tıklama. Sayfa başına tıklama çok düşük; 4 dilde aynı sayılarla üretilen maç/takım sayfaları tam bu kalıba benziyor.

Güçlü yanlarımız aynı listede: kendi ürünümüz (abonelik), kopyalanamaz varlık (model, herkese açık karne, açık veri seti), dar odak. Eksikler: ziyaretçinin işini sayfada bitirmesi ve marka/otorite.

## 2. Öneriler (etki sırasıyla)

1. **Bağlantı kazanımı (en büyük açık; siteye dokunmadan yapılır).**
   - Karşılaştırma yazıları: "best AI football prediction sites 2026" listeleri (tipstergpt "accuracy transparency"ye göre sıralıyor; tikitaka.gg, clawsportbot, betgiant, smartmatchpick, iabet, statz). Herkese açık karne + açık veri bu listelerin tam aradığı kanıt; yazarlara kısa, kanıtlı e-posta.
   - Açık veri setini (`/data`) GitHub, Kaggle ve Hugging Face'e koymak; açıklamada siteye bağlantı. Dataset Search ve akademik/hobi analizciler buradan bağlar.
   - Haftalık "veri hikâyesi": xG tablosundan "en şanslı / en şanssız takım" gibi tek grafikli not; taraftar blogları ve X'teki analiz hesapları alıntılar.
   - Dizinler: Product Hunt, AlternativeTo, Play mağaza sayfası (var), Telegram kanalı açıklaması.
2. **1X2 olasılıklarını herkese açmak (ürün kararı).** Rakiplerin hepsi yüzdeyi açık veriyor; "prediction" arayan kişi sayfada rakam görmeyince dönüyor. Pro'da kalacaklar: piyasa karşılaştırması (edge), gol pazarları, risk etiketi, kupon, uygunluk filtreleri. Gelire etkisi ölçülmeli; önce tek ligde denenebilir.
3. **Dizindeki sayfa sayısını azaltıp sayfa başına değeri artırmak.** Seçenekler: takım sayfaları yalnız İngilizce + ligin kendi dili; 30 günden eski sonuç sayfaları İngilizce dışındaki dillerde `noindex`; küçük ligler (1. Divisjon, Superligaen, Ekstraklasa) yalnız İngilizce. Hedef: ~8.000 → ~3.000 dizinli sayfa.
4. **Maç sayfasına "tek cümle karar" + yazar/model kimliği.** Sayfanın en üstünde "Model: Everton kazanır (%54)" biçiminde cevap; "nasıl hesaplandı" bağlantısı; güncelleme saati zaten var.
5. **Sorguya özel açılış sayfaları** (düşük öncelik): TR "yapay zekâ maç tahminleri", IT "pronostici calcio oggi" için mevcut gün sayfalarını bu başlıklarla güçlendirmek yeterli; yeni sayfa açmak 3. maddeyle çelişir.

## 3. Zamanlama
- 24 Kasım'a kadar (çekirdek güncelleme sürerken): yalnız 1. madde. Sitede yapısal değişiklik yapılmaz, yoksa etkiyi ayıramayız.
- 26 Kasım: dizin ve performans raporlarına yeniden bakış; 2 ve 3 için karar.

## Kaynaklar
- Search Console: Bağlantılar raporu (12.11.2026), Dizin raporu (12.11.2026), Performans (5.11.2026)
- Kasım 2026 çekirdek güncelleme: https://ppc.land/googles-core-update-shifts-rankings-for-up-to-2-weeks-before-black-friday/
- Zyppy, "5 Data-Backed Features Of Websites Winning Google in 2026": https://signal.zyppy.com/p/winning-google
- Lily Ray, "Prediction: the next massive Google update is around the corner" (4.10.2026): https://lilyraynyc.substack.com/p/prediction-the-next-massive-google
- Rakip örnekleri: https://sports4cast.com/4casts/football4cast/english-football-predictions/ · https://footballpredictions.com/footballpredictions/premierleaguepredictions/ · https://predigoal.com/tr/yapay-zeka-mac-tahmini · https://www.wincomparator.com/it-it/pronostici/calcio/domani/
- Liste yazıları: https://www.tipstergpt.com/blog/best-football-prediction-sites-accuracy-methodology · https://www.tikitaka.gg/articles/the-9-most-accurate-prediction-apps-in-2026-tested-ranked · https://www.clawsportbot.io/best-ai-football-prediction-tools · https://betgiant.ai/blog/best-football-prediction-sites-2026
