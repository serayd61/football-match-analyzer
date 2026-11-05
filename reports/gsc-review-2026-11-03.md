# Search Console incelemesi — 3 Kasım 2026

Kaynak: SC Site Haritaları (indeks), Sayfayı dizine ekleme, Performans (28 gün / 3 ay), Tarama istatistikleri (90 gün); canlı site `curl` ile Googlebot UA.

## 1. Durum

| Ölçüt | Değer |
|---|---|
| Tıklama / gösterim (28 gün) | 143 / 8.740, TO %1,6, ort. konum 43,8 |
| Tıklama / gösterim (3 ay) | 276 / 9.750 |
| Dizinde / dizinde değil | 7.940 / 3.970 |
| Site haritası (indeks, 5 bölüm) | 6.076 URL: results 4.676, teams 1.024, leagues 300, pages 68, matches 8 (canlı 80) |
| Tarama (90 gün) | 29.576 istek ≈ 330/gün; HTML yalnız %37 |

Tıklamalar: ana sayfa 79, eski `/ai-performance` 11 (artık 301 → `/en/performance`), tekil maç sayfaları 2–5 (Trabzonspor–Beşiktaş, Parma–Torino, Coventry–Sunderland). Ülke: Kenya 19, Türkiye 17 (1.028 gösterim), İtalya 13 (1.788 gösterim, en çok gösterim). Marka sorgusu "football analytics" 261 gösterim / 6 tıklama. Marka dışı gösterimlerin çoğu DE/IT otomatik sorgular ("teilnehmer: … tabelle", "statistiche …", "classifica di …"), 0 tıklama, konum 40+.

## 2. Dizine girmeyen 3.970 sayfa

| Neden | Sayı | Ne |
|---|---|---|
| noindex | 1.641 | `/{dil}/predictions/{id}` (üyelere özel) + `/login?callbackUrl=…` çeşitleri; Googlebot tarıyor, noindex görüyor, tarama boşa |
| Keşfedildi – taranmadı | 1.693 | ağırlıkla `/de/…` lig/alt sayfaları; sıra gelmiyor |
| Tarandı – dizine alınmadı | 230 | küçük lig maç sayfaları 4 dilde (1. Divisjon, Superliga, Ekstraklasa…) |
| Yönlendirmeli | 141 | eski `/analysis/*` → `/matches/*` (bilerek) |
| 404 | 115 | `/en/en/login?callbackUrl=…` çift ön ek; canlı HTML artık üretmiyor, eski tarama |
| Kopya, canonical seçilmedi | 102 | `/tr/teams/*`, `/tr|de/matches/*` → Google EN sürümünü seçiyor (metin çoğunlukla sayı) |
| robots | 47 | beklenen |

## 3. Tarama bütçesi (asıl darboğaz)

90 günde 29.576 istek; HTML 11 bin civarı, yani günde ~120 sayfa. Site haritası 6.076 URL ve lig/maç sayfaları her gün değişiyor; Google yetişemiyor → 1.693 "keşfedildi – taranmadı".

| Tür | Pay | Neden |
|---|---|---|
| JSON | %32 (9.470) | `/_vercel/insights/view` (Vercel Analytics beacon; Googlebot render ederken her sayfada atıyor), `/.well-known/assetlinks.json`, `/data/*.json` |
| JavaScript | %20 (6.070) | `/_next/static/chunks/*.js?dpl=<deploy>` — Vercel Skew Protection her deploy'da sorgu dizesini değiştiriyor; son 30 günde 106 merge → tüm chunk'lar her seferinde yeniden iniyor |
| HTML | %37 | |

## 4. Öneriler (öncelik sırasıyla)

1. **Beacon'ı Googlebot'tan sakla** — `robots.txt`'e `Disallow: /_vercel/` (Googlebot kaynak yüklemede de robots'a uyar). Tek satır, bütçenin ~%30'u serbest kalır. Alternatif: `<Analytics beforeSend>` ile bot UA'da `null` dön.
2. **`?dpl=` sorgu dizesi** — Vercel proje ayarı "Skew Protection" kapatılırsa chunk URL'leri sabit kalır; deploy sayısı da azaltılabilir (günde 3–4 merge yerine toplu). ~%20.
3. **Site haritasını daralt** — `results.xml` 4.676 URL'nin 2.860'ı Eylül maçı. Sonuçlanmış maçları 30 günden sonra haritadan düşür (lig sonuç arşivi sayfaları zaten bağlıyor); küçük ligleri (Norveç 1. Divisjon, Danimarka, Polonya…) yalnız EN'de listele, DE/IT'yi 11 kapsam ligiyle sınırla. Hedef: 6.076 → ~2.500 URL; Google'ın günlük 120 HTML'i önce bunlara gider.
4. **Üyelere özel bağlantıları anonim HTML'den çıkar** — 1.641 noindex sayfa taranıyor. `/{dil}/predictions/{id}` anonim ziyaretçiye hiç verilmemeli (ana sayfada 2 bağlantı var); `robots.txt`'e `Disallow: /*/predictions/` de eklenebilir.
5. **İtalya en çok gösterimi veren ülke, tıklama yok** — `/it/matches/tomorrow` 66 gösterim ("partite di domani" sorgusu). İtalyanca gün sayfalarına ve maç başlıklarına "pronostici" kelimesi (kullanıcı "pronostici partite domani" arıyor) + ilk ekranda görünen 2–3 cümlelik gün özeti. Aynısı TR için "iddaa tahminleri / bugünkü maçlar" dili.
6. **Takım sayfaları (TR/DE) kopya sayılıyor** — gövde sayı ağırlıklı; dilde 2–3 cümlelik yorum paragrafı eklenmezse Google EN'i seçmeye devam eder. Düşük öncelik; DE için istemek yerine kabul edilebilir.
7. Çift ön ekli `/en/en/login` 404'ları eski; canlı HTML'de yok, kendiliğinden düşer. Doğrulama başlatılmasın.

Beklenti: 1–3 uygulanınca tarama HTML payı %37 → %70+, "keşfedildi – taranmadı" 2–3 haftada erimeye başlar. Tıklama artışı için 5 belirleyici; teknik maddeler yalnızca Google'ın doğru sayfaları görmesini sağlar.
