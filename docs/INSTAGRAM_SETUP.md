# Instagram otomatik paylaşım (@_footballanalyticspro)

Telegram'a giden günlük seçim (07:00 UTC), haftalık karne (Pazartesi 06:00 UTC) ve sonuç
yanıtları aynı cron'la Instagram'a da düşer. Kod: `src/lib/social/instagram.ts`,
`src/lib/social/publish.ts` (hedef `instagram`), görsel ucu `src/app/api/social/image`.

Farklar (politika): açıklamada **oran yok**, bahis dili yok, link tıklanmaz ("link in bio").
Metin-only gönderiler (güçlü pazarlar) Instagram'a gitmez. Sonuçlar gönderiye yorum olur.

## Tek seferlik kurulum (Unified login — 2026-11-01 itibarıyla geçerli yol)

Meta yeni uygulamalarda "API setup with Instagram login"i kapattı; yerine **Unified login**
(Facebook Login for Business) var. Sonuç: **süresiz sistem kullanıcı token'ı** (EAA… ile başlar),
çağrılar `graph.facebook.com` üzerinden. Kod token önekine bakıp host'u kendisi seçer.

Yapılanlar (2026-11-01, Claude + kullanıcı):
1. developers.facebook.com → uygulama **Football Analytics Pro Social** (ID 4455173834756737),
   kullanım senaryosu "Manage messaging & content on Instagram".
2. İşletme portföyü **Serkan Aydin** (1269247781315738) bağlandı (Unified login için zorunlu).
3. Yapılandırma **Instagram API (Birleşik Giriş)** (config 1104341749181061): SUAT, süresiz,
   izinler instagram_basic / instagram_content_publish / instagram_manage_comments (+ ads_*, kullanılmıyor).
4. Redirect URL: https://footballanalytics.pro/

Kalan (kullanıcı):
5. Aynı sayfada **2. Generate access tokens → Add account** → Instagram Tester rolü →
   `_footballanalyticspro` ile giriş → izinleri onayla → **Generate token**.
   Listedeki hesabın yanında **Instagram account ID** (sayısal) ve token görünür.
6. Vercel → Production env:
   - `INSTAGRAM_USER_ID` = Instagram account ID
   - `INSTAGRAM_ACCESS_TOKEN` = token (EAA… ile başlar)
   - `INSTAGRAM_LANG` = `en` (varsayılan) veya `tr`
   - `INSTAGRAM_GRAPH_HOST` yalnız gerekirse (örn. `https://graph.facebook.com`); normalde boş.
7. Doğrulama (hesap adı dönmeli):
   ```bash
   curl -s -H "Authorization: Bearer $CRON_SECRET" "https://footballanalytics.pro/api/cron/social?status=1&ig=1"
   ```
8. Kuru çalıştırma:
   ```bash
   curl -s -H "Authorization: Bearer $CRON_SECRET" "https://footballanalytics.pro/api/cron/social?kind=daily&dry=1"
   ```

Not: "4. Complete App Review" gerekmez — kendi hesabın, uygulamada rolü var (standart erişim yeter).

## Token yenileme

Sistem kullanıcı token'ı (EAA…) süresizdir; yenileme yok. Yalnız eski IGAA… token'ı 60 günde dolar:
```bash
curl -s "https://graph.instagram.com/refresh_access_token?grant_type=ig_refresh_token&access_token=ESKİ_TOKEN"
```

## Elle gönderiler

- Kanıt kartı: `/api/cron/social?kind=proof` (`&dry=1` ile önizleme). Günde bir kez; `social_posts.key = proof|<gün>|instagram|<dil>`.
- Herhangi bir görseli PNG olarak görmek: `/api/cron/social?kind=daily|weekly|proof&image=1&lang=en`.

## Bilinen sınırlar

- Instagram görseli kendisi çeker: `/api/social/image` kimliksiz, ±10 gün, 1 saat önbellek.
- Günde 100 API gönderisi sınırı var; bizimki ≤3.
- Caption ≤2200 karakter, ≤30 etiket (kodda kesilir).
