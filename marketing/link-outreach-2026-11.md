# Bağlantı kazanımı: hedef listesi ve metin taslakları — Kasım 2026

Amaç: siteye dış bağlantı kazandırmak (14 Kasım'da 5 bağlantı, 2 siteden). Araç: açık veri seti (`/data`, 1.545 sonuçlanmış maç, 17 lig, CC BY 4.0). Yayın adımları: `open-data-kit/PUBLISHING.md`.

Hedefler 14 Kasım 2026'da arama sonuçlarından doğrulandı. Hiçbir şey gönderilmedi.

## Elimizdeki kanıt (metinlerde kullanılan sayılar, 14 Kasım anlık görüntüsü)

| | Değer |
|---|---|
| Sonuçlanmış maç | 1.545 (7 Haz – 9 Kas 2026), 17 lig |
| Seçim isabeti (1X2) | %52,6 (her zaman ev sahibi: %45,0) |
| Brier (1/X/2 toplamı) | 0,5897 (eşit ⅓ tahmin: 0,6667) |
| Kalibrasyon | %70+ verilen seçimler %79,3 tuttu (140 maç); %40–45 verilenler %43,7 (318 maç) |
| Zayıf yan | Championship %41,8, Brier 0,674 (eşit tahminden kötü); Premier League %44,8 |

Zayıf sayıları saklamamak metnin gücü: liste sahipleri "kayıplar da dosyada" iddiasını tek tıkla doğrulayabiliyor.

## 1. Kendi kopyalarımız (önce bunlar)

| # | Platform | Ne kazandırır | Durum |
|---|---|---|---|
| 1 | GitHub: `football-predictions-open-data` | Bağlantı + GitHub konu sayfaları (`football-data`, `soccer-data`) + liste PR'larının bağlanacağı adres | Paket hazır, onay bekliyor |
| 2 | Zenodo | DOI, akademik atıf, DataCite dizini | GitHub'dan sonra |
| 3 | Kaggle | Veri seti araması, defter (notebook) yazarları | Hesap gerekli |
| 4 | Hugging Face | Veri seti araması, `load_dataset` kullanıcıları | Hesap gerekli |
| 5 | Google Dataset Search | Otomatik: `/data` sayfasında `Dataset` yapısal verisi zaten var | Yapılacak iş yok |

## 2. Derlenmiş listeler (PR ile; en yüksek verim)

| # | Liste | Neden uygun | Yol |
|---|---|---|---|
| 6 | [withqwerty/open-football](https://github.com/withqwerty/open-football) | Açık futbol verisi haritası; güncel (Eylül 2026 girdileri var). Kuralı: sağlayıcının kendi yayınladığı açık veri kabul; tek satır, olgusal, pazarlama dili yok | README'ye PR, "Stats and ratings" bölümü |
| 7 | [eddwebster/football_analytics](https://github.com/eddwebster/football_analytics) | Alanın en bilinen kaynak dizini | PR veya issue (son README güncellemesi Ekim 2025; yanıt yavaş olabilir) |
| 8 | [matiasmascioto/awesome-soccer-analytics](https://github.com/matiasmascioto/awesome-soccer-analytics) | Veri setleri bölümü var | PR |
| 9 | [diegopastor/awesome-football-analytics](https://github.com/diegopastor/awesome-football-analytics) | 220 yıldız, veri setleri bölümü | PR |
| 10 | [MLonSoccer/awesome-machine-learning-on-soccer](https://github.com/MLonSoccer/awesome-machine-learning-on-soccer) | Tahmin modelleri için veri arayanlar | PR |
| 11 | [datahub.io/collections/football](https://datahub.io/collections/football) | Açık futbol verisi derlemesi | Sayfadaki düzenleme bağlantısı |
| 12 | [Football-Analytics-101, Data Sources](https://football-analytics-101.readthedocs.io/en/latest/data.html) | Öğrenme rehberi, veri kaynakları sayfası | Arkasındaki GitHub deposuna PR |
| 13 | [Sports Data Campus, Free Football Data Sources Directory](https://english-programs.sportsdatacampus.com/free-football-data-sources-directory/) | Eğitim kurumu dizini | İletişim formu |

PR'da bağlanacak adres: GitHub deposu (liste kuralları "kanonik kaynak" istiyor; README en üstte siteye bağlanıyor).

### Liste girdisi (6 için birebir biçim)

```
- [Football Analytics open data](https://github.com/serayd61/football-predictions-open-data) - Pre-match 1X2 probabilities and goal expectations of a Dixon-Coles model for every settled match in 17 competitions since June 2026, with final scores; CSV, refreshed daily. CC BY 4.0.
```

### PR açıklaması

```
Adds one entry: a prediction-record dataset released by its provider.

- What it is: for every finished match in 17 competitions (top five European
  leagues, Championship, Eredivisie, Liga Portugal, Süper Lig, Ekstraklasa,
  Eliteserien, 1. Divisjon, Superligaen, Brasileirão, UEFA club competitions),
  the 1X2
  probabilities a Dixon-Coles model stored before kick-off, the pick and the
  final score. 1,545 matches so far, refreshed daily.
- Licence: CC BY 4.0.
- Nothing is filtered by outcome; the README shows hit rate and Brier score
  per competition, including the ones where the model does badly.
- Disclosure: I maintain the dataset.

Happy to move it to another section or reword the line.
```

## 3. Topluluk gönderileri (kendi hesabından; haftada en fazla bir yer)

| # | Yer | Not |
|---|---|---|
| 14 | r/sportsanalytics | Benzer "ücretsiz açık veri yayınladım" gönderileri burada tutuyor |
| 15 | r/datasets | Kural: veri setine doğrudan bağlantı, tanıtım dili yok |
| 16 | X (site hesabı) | Tek görsel: kalibrasyon tablosu |
| 17 | Kaggle defteri | Veri setiyle birlikte kısa bir "Brier by league" defteri; Kaggle içi görünürlük |

### Gönderi taslağı (14 ve 15)

```
Title: I publish every prediction my football model makes, including the misses (1,545 matches, CSV, CC BY 4.0)

I run a Dixon-Coles / Poisson model for 17 football competitions. Since June
every pre-match 1X2 probability has been stored before kick-off and published
once the match is settled. Nothing is removed afterwards.

So far: 1,545 matches, pick hit rate 52.6% (always-home baseline 45.0%),
Brier 0.590 (uniform guess 0.667). It is bad in the Championship (41.8%,
worse than a uniform guess) and decent in Serie A (61.2%).

Columns: kick-off, teams, score, p_home / p_draw / p_away, goal expectations,
pick, pick_correct, model version.

Data: https://github.com/serayd61/football-predictions-open-data
Docs: https://footballanalytics.pro/en/data

Useful if you want a public baseline to score your own model against, or
real data for a calibration exercise. Corrections welcome.
```

## 4. Karşılaştırma yazıları (düşük verim; en sona)

Bu yazıların çoğu rakip ürünlerin kendi sayfası ve iletişim adresi vermiyor. Denemeye değer olanlar, ölçüt olarak kayıt şeffaflığını kullananlar:

| # | Yazı | Ölçütü | Yol |
|---|---|---|---|
| 18 | [SmartMatchPick: evidence-led guide](https://smartmatchpick.com/guides/best-ai-football-prediction-sites-2026) | "Adil karşılaştırma için maç öncesi zaman damgası, eksiksiz sonuçlar, olasılıklar, kıyas tabanı gerekir" diyor; site adı vermiyor | X: @SmartMatchPick |
| 19 | [TipsterGPT: ranked by accuracy transparency](https://www.tipstergpt.com/blog/best-football-prediction-sites-accuracy-methodology) | 10 puanlık şeffaflık skoru: isabet raporu, yöntem, örneklem, ham veriye erişim | Sitedeki iletişim sayfası |
| 20 | [CompareSharp: 10 best football prediction apps](https://comparesharp.com/blog/best-football-prediction-apps-2026) | "Accuracy transparency" ilk ölçüt | Sitedeki iletişim sayfası |
| 21 | [Tiki Taka: best AI football prediction app](https://www.tikitaka.gg/articles/best-ai-football-prediction-app-2026-ranked-tested-independently-verified) | 721 maçlık test | tikitaka.gg/about |
| 22 | [The AI Surf: AI sports prediction tools](https://theaisurf.com/ai-sports-predictions-tools/) | Araç listesi | Sitedeki iletişim sayfası |

Atlananlar: statz.ai ve clawsportbot.io (yalnız kendi ürünlerini sıralıyor).

### E-posta taslağı (18–22)

Gönderen: support@footballanalytics.pro

```
Subject: A fully public prediction record for your comparison (1,545 matches, CSV)

Hi,

Your article ranks prediction sites by how verifiable their record is. Ours
can be checked row by row, so I thought it might be useful to you.

Football Analytics (footballanalytics.pro) publishes every prediction its
model makes once the match is settled: the 1X2 probabilities stored before
kick-off, the pick and the final score, for 17 competitions. Nothing is
removed afterwards.

- Data (CSV, CC BY 4.0): https://footballanalytics.pro/en/data
- 1,545 matches since June: hit rate 52.6%, Brier 0.590
- It includes the leagues where the model does badly (Championship: 41.8%)
- Method: https://footballanalytics.pro/en/methodology

If you update the article, you are welcome to score the file yourself and
use the numbers. I can answer questions about how any row was produced.

Serkan
Football Analytics
```

## Ölçüm

- Search Console → Bağlantılar: başlangıç 5 dış bağlantı / 2 site (12 Kasım).
- Hedef: 4 hafta içinde 10+ bağlayan site. Kopyalar (GitHub, Zenodo, Kaggle, Hugging Face) tek başına 4 site eder.
- İlk bakış: 26 Kasım, performans raporuyla birlikte.

## Sonraki sürüm için not

Benzer bir veri seti (footinsights.com/data) her satırda `published_at` zaman damgası veriyor. Bizde tahminin yazıldığı an sütunu yok; "maç öncesi" iddiası için en güçlü kanıt bu olur. Motor tablosunda yazılma zamanı tutuluyorsa `predicted_at_utc` sütunu eklenebilir.
