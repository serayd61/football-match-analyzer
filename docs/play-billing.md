# Play Billing — kurulum ve işletme (2026-11-10)

Play uygulaması (android-app/, versionCode ≥ 6) Pro aboneliğini Google Play
Billing ile satar. Kod tarafı bu repoda hazır; aşağıdaki konsol/altyapı
adımları **elle** yapılır (çoğu tek seferlik). Kod, env değişkenleri yokken
güvenli şekilde kapalıdır: eski uygulama sürümleri köprü metodlarını
taşımadığı için sayfa fiyatsız politika-güvenli gövdeye düşer,
`/api/play/verify` 503 döner.

## Mimari

```
WebView sayfası (pricing/PlayPurchase.tsx)
  └─ window.FootballAnalyticsApp köprüsü (MainActivity.AppBridge + PlayBilling.java)
       └─ Play Billing Library 8.0.0 → satın alma sayfası
          (Play sürüm incelemesi 8.0.0 altını reddediyor; 7.1.1 reddedildi)
  satın alma sonucu purchaseToken → POST /api/play/verify (oturumlu)
       └─ Play Developer API subscriptionsv2.get → subscriptions + profiles yazılır
          → sunucu tarafı acknowledge (3 gün kuralı)
Play RTDN (Pub/Sub push) → POST /api/play/rtdn?secret=…
       └─ yenileme/iptal/grace/on-hold/refund → aynı satırlar güncellenir
```

- Tek entitlement modeli: `subscriptions` (user_id başına tek satır,
  `provider='play'`, `play_purchase_token` UNIQUE) + `profiles.subscription_status`.
  Stripe webhook ile aynı satırlar — `checkUserAccess` değişmedi.
- Kullanıcı eşleme: satın almada `obfuscatedExternalAccountId` = app user id
  geçilir; verify hiç çalışmasa bile RTDN tek başına satın almayı
  kullanıcıya bağlayabilir (play-sync.ts `resolvePlayUser`).
- Jeton tekrarı koruması: başka hesaba bağlı token ikinci kullanıcıya 409.

## Kurulum sıralaması (elle)

1. **Satıcı statüsü beyanı** — Play Console'daki "Satıcı statüsü beyanı"
   uyarısı (son tarih Şubat 2027, ama ürün satmadan ÖNCE zorunlu).
   Console → Ayarlar → Geliştirici hesabı. Kimlik/vergi bilgisi ister.
2. **Abonelik ürünleri** — Console → Para kazanma → Ürünler → Abonelikler:
   - `fa_pro_monthly`, base plan `monthly` (P1M), $9.90 (bölgesel fiyatları
     Play türetir; istersen düzelt).
   - `fa_pro_yearly`, base plan `yearly` (P1Y), $49.
   Ürün adları mağaza metniyle aynı dilde, kumar çağrışımı YOK
   ("Pro subscription — statistics and analysis").
   Id'ler koddaki `PLAY_PRODUCTS` (play-shared.ts) ve
   `PLAY_PRODUCT_*` (play-billing.ts) sabitleriyle birebir aynı olmalı.
3. **Service account** — Google Cloud Console'da proje (Play Console →
   API erişimi bağlar) → IAM → Service account aç, JSON anahtar indir.
   Play Console → Kullanıcılar ve izinler → bu hesaba "Finansal verileri
   görüntüleme" + "Siparişleri yönetme" izni ver.
4. **Vercel env** (kullanıcı elle; MCP'de env yazma engelli):
   - `PLAY_SERVICE_ACCOUNT_JSON` = indirilen JSON'un tamamı (tek satır)
   - `PLAY_RTDN_SECRET` = `openssl rand -hex 24`
   - (`PLAY_PACKAGE_NAME` varsayılanı `pro.footballanalytics`, gerekmez)
5. **RTDN / Pub/Sub** — Cloud Console → Pub/Sub:
   - Topic: `play-rtdn`
   - Play'in yayıncı hesabına izin: topic'e
     `google-play-developer-notifications@system.gserviceaccount.com`
     → rol `Pub/Sub Publisher`.
   - Push subscription: endpoint
     `https://footballanalytics.pro/api/play/rtdn?secret=<PLAY_RTDN_SECRET>`
   - Play Console → Para kazanma kurulumu → RTDN → topic adını yapıştır →
     "Test bildirimi gönder" → Vercel loglarında `[play/rtdn] test notification ok`.
6. **Uygulama sürümü** — `android-app/` v1.3.0 (versionCode 6) derle+imzala
   (README'deki adımlar), kapalı teste yükle. Billing Library satın almayı
   ancak Play'den yüklenmiş pakette çalıştırır; sideload APK'da
   `billingReady()` false kalır, sayfa eski gövdeyi gösterir.
7. **Migration** — `supabase/migrations/20261110010000_play_billing.sql`
   (provider, play_purchase_token, play_product_id + unique index) elle uygula.
8. **Test** — Play Console → Lisans test kullanıcıları'na kendi hesabını ekle
   (test kartı, ücret yok; yenileme hızlandırılmış). Uygulamada /pricing →
   fiyatlar Play'den yerelleşmiş gelir → satın al → dashboard Pro açılır.
   İptal/yenileme RTDN loglarından izlenir.

## Politika notları

- Uygulama içinde Stripe'a yönlendirme YOK (anti-steering) — PlayPurchase
  yalnız Play akışını gösterir; web tarafı değişmedi.
- Mağaza metni istatistik çerçeveli kalmalı (kumar sınıflaması riski,
  bkz. X Ads vakası); ürün adlarında "bet/tahmin kuponu" geçmesin.
- Fiyat değişikliği: Play Console'da base plan fiyatı + `plans.ts`
  (web gösterimi) ayrı ayrı; Play tarafı fiyatı daima Play'den okunur.

## İşletme

- Verify hatası / app ölürse: RTDN `SUBSCRIPTION_PURCHASED` aynı işi yapar
  (acknowledge dahil). Pub/Sub, 503'te tekrar dener; kullanıcıya
  bağlanamayan mesaj 200 ile düşürülür ve loglanır (`unattributed`).
- İade/void: RTDN `voided` → satır `canceled`, profil `free`.
- Restore: sayfa açılışında `queryPurchases` → bilinen olmayan token'lar
  verify'a gönderilir (cihaz değişimi, yarım kalan akış).
