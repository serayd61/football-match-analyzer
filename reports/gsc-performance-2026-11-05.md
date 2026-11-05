# Search Console performans incelemesi — 5 Kasım 2026 (son 28 gün)

Kaynak: SC Performans raporu, Web araması, 7 Ekim – 3 Kasım 2026. Sorgu/sayfa tabloları 1.000 satır sınırıyla okundu.

## 1. Toplam

| Ölçüt | Değer |
|---|---|
| Tıklama / gösterim | 161 / 9.910, TO %1,6, ort. konum 43,9 |
| Günlük seyir | 17 Ekim'e kadar ~20 gösterim, ~3 tık/gün; 18 Ekim'den sonra ~500 gösterim, ~8 tık/gün (maç/takım sayfaları dizine girdi). Gösterim 25×, tıklama 2,5× |
| 1–3 Kasım | 14 / 12 / 10 tık — Play lansmanı (30 Eki) + e-posta kampanyası (31 Eki) sonrası marka tıklaması |

## 2. Cihaz

| Cihaz | Tık | Gösterim | TO | Konum |
|---|---|---|---|---|
| Mobil | 139 | 3.038 | %4,6 | 33,5 |
| Masaüstü | 20 | 6.824 | %0,3 | 48,6 |

Gösterimin %69'u masaüstünde ve tıklamaya dönmüyor: Google'ın maç kartından türettiği otomatik sorgular (aşağıda) masaüstünde görünüyor. Tıklayan kitle mobil.

## 3. Sorgular (1.000 görünen sorgu: 47 tık / 4.127 gösterim; 114 tık anonim sorgulardan)

| Küme | Sorgu | Tık | Gösterim | Konum | Not |
|---|---|---|---|---|---|
| Marka (football analytics, footballanalysis, football analyzer…) | 19 | 23 | 340 | 56 | "football analytics" 261 gös / 8 tık, genel terim |
| Google otomatik: DE "teilnehmer: X gegen Y tabelle" | 36 | 0 | 305 | 24 | Maç kartı yeniden-arama; bilgi paneli yanıtlıyor |
| Google otomatik: IT "classifica di / statistiche X – Y" | 52 | 0 | 413 | 27 | aynı |
| Takım adı, "X fixtures", "X maçları" | ~650 | 6 | ~2.200 | 60 | resmi site / Wikipedia / Transfermarkt ile yarışılmıyor |
| "X vs Y" | 108 | 7 | 261 | 61 | |
| "prediction / tahmin" | 11 | 6 | 19 | 93 | konum 100+ olsa bile tıklanıyor |
| "pronostico" | 8 | 2 | 18 | 27 | |
| "prognosen / prognose" | 10 | 0 | 110 | 37 | ekstraklasa 29, ligue 1 27, serie a 14 (konum 11) |
| bugün/yarın (tomorrow, domani…) | 26 | 1 | 139 | 55 | "match football tomorrow" 24 + "football match tomorrow" 21 gös, konum 60–65, 0 tık; "partite di domani" 16 gös, 1 tık |
| "ai football analysis" kümesi | ~8 | 9 | 25 | 90 | TO %37–60; Kenya/Nijerya/Gana kaynaklı |

Konum dağılımı (görünen sorgular): 1–10 → 112 sorgu, 320 gös, 4 tık; 11–20 → 94, 704, 3; 21–50 → 131, 551, 6; 50+ → 663, 2.552, 34. Tıklamaların çoğu derin konumdaki niyetli ("prediction") sorgulardan geliyor.

## 4. Sayfalar

| Sayfa türü | Sayfa | Tık | Gösterim | Konum |
|---|---|---|---|---|
| Ana sayfa /en | 1 | 85 | 648 | 38 |
| EN maç sayfaları | 221 | 30 | 1.619 | 26 |
| IT maç | 148 | 4 | 904 | 34 |
| TR maç | 27 | 6 | 119 | 36 |
| DE maç | 89 | 1 | 556 | 38 |
| Takım sayfaları (4 dil) | 418 | 6 | 4.166 | 51–66 |
| xG tabloları (EN) | 9 | 4 | 181 | 19 |
| Gol istatistikleri (EN) | 8 | 1 | 95 | 14 |
| Lig sayfaları (4 dil) | 14 | 4 | 276 | 40–77 |
| Gün sayfaları (/matches/today,tomorrow) | 4 | 1 | 228 | 44–78 |
| Eski /ai-performance (301) | 1 | 11 | 57 | 68 |

Takım sayfaları gösterimin %42'sini alıp 6 tık getiriyor. EN maç sayfaları ana sayfa dışındaki tek anlamlı tıklama kaynağı. xG/goals tabloları en iyi konumda (14–19) ama arama hacmi düşük.

## 5. Ülke

İtalya 2.042 gös / 15 tık; Türkiye 1.125 / 21; İngiltere 570 / 3; Brezilya 348 / 3; Rusya 146 / 8; Kenya 161 / 21 (%13); Nijerya 81 / 10; Romanya 39 / 9; Gana, Fildişi, Kamerun 3–6 tık (%20+ TO).

## 6. Arama görünümü

Zengin sonuç satırı yok (Event/Breadcrumb henüz görünümde sayılmıyor).

## 7. Ne yapmalı (öncelik sırası)

1. **Takım sayfasına "sıradaki maç tahmini" bloğu + title.** 418 sayfa, 4.166 gösterim, 6 tık. Takım adı sorgusu kazanılmaz; kazanılabilecek niyet "X next match prediction / X maçı tahmini". Title: "{team} next match prediction, fixtures & form"; gövdeye sıradaki maçın seçimi (olasılık rakamı olmadan, tercih yönü) + 2–3 cümle. TR: "{team} maç tahmini, fikstür ve form".
2. **Gün sayfalarına tahmin dili + görünür özet.** EN "Tomorrow's football matches & form" → "Tomorrow's football match predictions, kick-off times & form" (match football tomorrow 24 + football match tomorrow 21 gös, konum 60+). IT "Partite di calcio domani: gare e forma" → "Pronostici partite di domani: orari, classifica e forma". TR "Yarınki maçlar: fikstür ve form" → "Yarınki maç tahminleri, fikstür ve form". Her gün sayfasının üstünde günün öne çıkan 3 maçı + model tercihi (rakamsız) paragrafı: sayfa şu an salt liste, bu yüzden konum 60.
3. **Maç sayfası: tercih yönü halka açık.** "X vs Y prediction" sorguları konum 100+'da bile tıklanıyor; sayfada tahmin görünmeyince (üyelere özel) geri dönüş. Olasılık yüzdesi ve oran Pro'da kalsın; "model tercihi: ev sahibi / 2,5 üst" tek satır anonim ziyaretçiye açılsın. Bu, maç sayfalarının konumunu da (26 → 10–15 bandı) taşıyabilecek tek içerik değişikliği.
4. **"AI" kelimesi ana sayfa ve metodoloji title'ında.** "ai football analysis" kümesi TO %37–60, konum 86–100. EN ana sayfa title "Football predictions & xG analysis" → "AI football predictions & match analysis"; metodoloji "How the AI football prediction model works". Afrika (Kenya/Nijerya/Gana) tıklamalarının kaynağı bu küme.
5. **DE lig sayfası title'ı zaten "Prognose" içeriyor; IT'de "scommesse" yok.** "statistiche serie a scommesse" 67 gös konum 79 → IT goals/xg sayfası title'ına "statistiche per scommesse" eki. "serie a prognose" konum 11 → DE lig sayfasına görünür 2–3 cümlelik hafta özeti ile ilk sayfaya taşınabilir.
6. **Yapılmayacaklar.** DE/IT otomatik sorgular (~720 gös, konum 10–13, 0 tık) Google'ın maç kartı; içerikle alınmaz, raporda göz ardı edilsin. "football analytics" genel terimi için de uğraşılmasın.

Beklenen etki: 1–3 maddeler aynı gösterim hacminde TO'yu %1,6'dan %3–4'e çıkarır (tıklama ~160 → ~350/28 gün); konum kazanımı 4–6 hafta sonra görünür.
