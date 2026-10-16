# Play Store ekran görüntüsü tasarım spesifikasyonu

Tarih: 2026-10-16 · Kaynak: Testers Community raporu, madde 4 ("ekran görüntüleri başlıksız, fayda anlatmıyor") · Üretim betiği: `scripts/play-screenshot-frames.py` · Çıktı: `marketing/play/screenshots/framed/<dil>/`

## 1. Teknik gereksinimler (Google Play)
- Telefon: 1080 × 1920 px (9:16), PNG veya JPEG, her dil için 2–8 adet. Mevcut düz görüntüler zaten bu boyutta.
- Tablet (7" ve 10") isteğe bağlı; Console'da 7" için 1200 × 1920 veya 1920 × 1200 kabul edilir. Bu sürümde tablet görüntüsü üretilmedi (uygulama telefon odaklı; Console tablet sekmesi boş bırakılabilir).
- Öne çıkan görsel (1024 × 500) mevcut: `marketing/play/feature-graphic-1024x500.png`.

## 2. Düzen (her görüntü)
| Bölge | Ölçü | İçerik |
|---|---|---|
| Üst bant | 0–470 px, arka plan `--s-bg` koyu (14 19 17) | Başlık 70 px Arial Bold beyaz (1–2 satır), alt satır 36 px Arial gri-yeşil; 6 px marka yeşili (`--s-brand` koyu: 22 122 79) ayırıcı |
| Telefon kartı | 936 px genişlik, 36 px köşe yuvarlama, ince çerçeve | Düz ekran görüntüsü, alt kenarda kesilir (sayfanın devam ettiği hissi) |
| Kenar boşlukları | 72 px sol/sağ | Başlık ve alt satır aynı hizada |

Font notu: yerel makinede Manrope yok; Arial Bold kullanıldı. Sitede kullanılan Manrope ile üretmek için TTF'yi indirip `FONT`/`FONT_REG` sabitlerini değiştirmek yeter.

## 3. Sıra ve mesaj (fayda odaklı, kanıtlı iddialar)
| # | Ekran | Başlık (en) | Başlık (tr) | Ne kanıtlar |
|---|---|---|---|---|
| 1 | Ana sayfa / günün maçları | Match probabilities, before kick-off | Maç öncesi olasılıklar | Ürünün çekirdeği: 11 ligde 1X2, alt/üst, KG |
| 2 | Performans (karne) | A public track record | Herkese açık karne | Şeffaflık: her tahmin sonuçlanır |
| 3 | Lig sayfası | Tables, form and head-to-head | Puan durumu, form ve geçmiş maçlar | Bağlam verisi (ücretsiz katman) |
| 4 | Yöntem | How the model works | Model nasıl çalışır | Güven: Dixon-Coles, kalibrasyon |

İlk iki görüntü mağaza listesinde yan yana görünür; bu yüzden çekirdek fayda + güven önce gelir.

## 4. Metin kuralları
- Başlık ≤ 2 satır, ≤ 26 karakter/satır; alt satır ≤ 48 karakter.
- Yasak kelimeler: tips / picks / sure bet / bonus / banko / kesin (Google Ads kumar sertifikası diliyle tutarlı).
- Rakam yalnız doğrulanabilir olduğunda (11 lig = `src/lib/site/leagues.ts`). İsabet yüzdesi gibi değişken sayılar görüntüye yazılmaz; ekranın kendisi gösterir.
- Her dil için metin, uygulamanın o dildeki ekranıyla eşleşir (tr başlık + tr ekran).

## 5. Eksikler / manuel işler
- **de ve it ekranları yok.** Dev sunucu açıkken `scripts/seo-screenshots.js` kalıbıyla (playwright-core, 1080×1920 mobil viewport, `?src=twa` ile Play modu) `marketing/play/screenshots/de|it/` altına 4'er görüntü alınmalı; sonra `COPY` sözlüğüne de/it başlıkları eklenip betik yeniden çalıştırılır.
- Mevcut en/tr düz görüntüler Ekim 2026 başında alındı; arayüz değişirse (örn. yeni hesap bölümü) yeniden çekilmeli.
- Console'a yükleme manueldir (Mağaza girişi → Telefon ekran görüntüleri). Yükleme sırası yukarıdaki tabloyla aynı olmalı.
- Koyu tema varyantı: isteğe bağlı 5. görüntü olarak koyu temada ana sayfa (tema desteğini gösterir); bu sürümde üretilmedi.
