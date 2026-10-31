# Instagram otomatik paylaşım (@_footballanalyticspro)

Telegram'a giden günlük seçim (07:00 UTC), haftalık karne (Pazartesi 06:00 UTC) ve sonuç
yanıtları aynı cron'la Instagram'a da düşer. Kod: `src/lib/social/instagram.ts`,
`src/lib/social/publish.ts` (hedef `instagram`), görsel ucu `src/app/api/social/image`.

Farklar (politika): açıklamada **oran yok**, bahis dili yok, link tıklanmaz ("link in bio").
Metin-only gönderiler (güçlü pazarlar) Instagram'a gitmez. Sonuçlar gönderiye yorum olur.

## Tek seferlik kurulum (Facebook Sayfası gerekmez)

1. Hesap Professional (Business/Creator) olmalı — zaten öyle.
2. https://developers.facebook.com → **Create App** → use case **"Instagram"** (Instagram API with Instagram Login) → Business tipi.
3. Uygulama panelinde **Instagram → API setup with Instagram login** → "Add account" ile `_footballanalyticspro`'yu ekle.
4. Aynı sayfada **Generate token** → giriş yap, izinleri onayla:
   `instagram_business_basic`, `instagram_business_content_publish`, `instagram_business_manage_comments`.
   Dönen token **uzun ömürlüdür (60 gün)**. Sayfada "Instagram account ID" de yazar.
5. Vercel → Production env:
   - `INSTAGRAM_USER_ID` = Instagram account ID (sayısal)
   - `INSTAGRAM_ACCESS_TOKEN` = token
   - `INSTAGRAM_LANG` = `en` (varsayılan) veya `tr`
   Token'ı sohbete yapıştırma; doğrudan Vercel'e gir. Redeploy gerekmez (cron sonraki çalışmada okur).
6. Doğrulama:
   ```bash
   curl -s -H "Authorization: Bearer $CRON_SECRET" "https://footballanalytics.pro/api/cron/social?status=1"
   ```
   `"instagram": true` ve `targets` içinde `instagram:en` görünmeli.
7. Kuru çalıştırma (hiçbir yere göndermez, metni döner):
   ```bash
   curl -s -H "Authorization: Bearer $CRON_SECRET" "https://footballanalytics.pro/api/cron/social?kind=daily&dry=1"
   ```
8. Görsel ucu herkese açık: https://footballanalytics.pro/api/social/image?kind=proof&lang=en

## Token yenileme

Uzun ömürlü token 60 günde dolar. En geç 50. günde:
```bash
curl -s "https://graph.instagram.com/refresh_access_token?grant_type=ig_refresh_token&access_token=ESKİ_TOKEN"
```
Dönen `access_token`'ı Vercel'e yaz. (Kodda `refreshToken()` var; otomatik yazma yok çünkü env'i cron değiştiremez.)

## Elle gönderiler

- Kanıt kartı: `/api/cron/social?kind=proof` (`&dry=1` ile önizleme). Günde bir kez; `social_posts.key = proof|<gün>|instagram|<dil>`.
- Herhangi bir görseli PNG olarak görmek: `/api/cron/social?kind=daily|weekly|proof&image=1&lang=en`.

## Bilinen sınırlar

- Instagram görseli kendisi çeker: `/api/social/image` kimliksiz, ±10 gün, 1 saat önbellek.
- Günde 100 API gönderisi sınırı var; bizimki ≤3.
- Caption ≤2200 karakter, ≤30 etiket (kodda kesilir).
