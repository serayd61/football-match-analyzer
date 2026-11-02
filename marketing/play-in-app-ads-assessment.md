# Play uygulamasında reklam gösterme — değerlendirme ve sonuç (2026-11-01)

Soru: Football Analytics Pro Android uygulamasında (pro.footballanalytics, WebView, v4 1.2.0) AdMob vb. ile reklam göstermek mantıklı mı, ne gerekir, ne kazandırır?

**Kısa sonuç: Şimdi değil.** Mevcut hacimde aylık gelir 1 doların altında kalır; buna karşılık 1 yeni SDK, rıza akışı, Play beyanları, gizlilik güncellemesi ve Pro abonelik hunisinde kayıp gelir. Eşik: uygulama tarafında ≥ 5–10 bin aylık aktif kullanıcı. O güne kadar "reklamsız" kalmak hem ürün hem Google Ads sertifikasyon duruşu açısından daha güçlü.

---

## 1. Mevcut durum (ölçülen)

| Kalem | Değer | Kaynak |
|---|---|---|
| Play Console reklam beyanı | **"Hayır, uygulamam reklam içermiyor"** | Uygulama içeriği → Reklam (2026-11-01) |
| İçerik derecelendirmesi | PEGI 18 / IARC 18+ (kumarla ilgili bilgi: Evet) | IARC anketi 2026-10-10 |
| Play: edinme (28 gün) / MAU | 7 / ~5 | Play Console istatistik (2026-10-31) |
| Web+app: aktif kullanıcı 7g / 30g | 25 / 25 | Supabase (sayım) |
| Toplam kayıt / ödeyen | 332 / 2 | Supabase (sayım) |
| Android uygulamasında reklam SDK'sı | yok (deps: appcompat, splashscreen, swiperefresh, webkit, browser, play-review) | `android-app/app/build.gradle` |
| Rıza (UMP/CMP) akışı | yok | — |

## 2. Reklam göstermek için ne gerekir

### 2a. Google Play tarafı
1. **Reklam beyanı** "Evet, içeriyor" yapılır → mağazada "Reklam içerir" etiketi çıkar.
2. **Reklamlar içerik derecelendirmesine uygun olmalı.** Uygulama 18+ olduğu için reklam tarafı daha esnek, ama kumar reklamı göstermek Play için ayrıca "kumar reklamı" kurallarını tetikler (lisanslı operatör + ülke listesi). Bizim için en güvenlisi kumar kategorisini **tamamen kapatmak** (bkz. 2b).
3. **Better Ads / rahatsız edici reklam kuralları:** tam ekran reklam beklenmedik anda (uygulama açılışı, içerik yüklenirken) gösterilemez; geçiş reklamı ≤ 15 sn içinde kapatılabilir olmalı; reklam sistem bildirimi gibi görünemez; "reklam için yapılmış" uygulama izlenimi olmamalı.
4. **Veri güvenliği formu** güncellenir: reklam kimliği (AAID), cihaz tanımlayıcıları, "reklam veya pazarlama" amaçlı paylaşım → "Evet". Manifest'e `com.google.android.gms.permission.AD_ID` izni eklenir.
5. **Gizlilik politikası** (web `/privacy`) reklam ortakları + AAID + çerez/SDK maddesiyle güncellenir.
6. Yeni **AAB yükleme + inceleme** (reklam beyanı değişince politika incelemesi yeniden yapılır).

### 2b. AdMob tarafı
1. AdMob hesabı + uygulama kaydı (Play'de yayında olduğu için "mağaza eşleştirme" ile hızlı onaylanır; tipik 1–3 gün).
2. **Yayıncı Kısıtlamaları (Publisher Restrictions):** "Kumar ipuçları, oranlar, handicapping, spor seçimleri" içeriği Google için **kısıtlı içerik** sınıfındadır. Yasak değildir, ama bu içeriğin bulunduğu ekranlara yalnızca kısıtlı içeriğe izin veren reklamverenler teklif verir → **doluluk ve eCPM belirgin düşer** (pratikte genel oranların %30–60'ı). Bu, aşağıdaki gelir tahminini aşağı çeken en önemli kalem.
3. **Engelleme kontrolleri:** "Gambling & Betting (18+)" ve "Social casino" hassas kategorileri **kapalı** tutulmalı. Gerekçe: Google Ads sertifikasyon başvurusunda "bahis operatörü değil, bilgi servisi" duruşu var; uygulama içinde bahis sitesi reklamı göstermek bu duruşu ve "bahis sunmaz / bağlantılı değildir" mağaza metnini zayıflatır.
4. **Rıza:** AB/İsviçre/İngiltere kullanıcıları için UMP (User Messaging Platform) ile GDPR rıza ekranı zorunlu (Google sertifikalı CMP). Rıza vermeyen kullanıcıya yalnızca kişiselleştirilmemiş/sınırlı reklam gider (daha da düşük eCPM).

### 2c. Teknik seçenekler (WebView uygulaması)
| Seçenek | Uygulanabilirlik | Not |
|---|---|---|
| **Native AdMob banner** (alt kenara sabit adaptive banner) | Evet, en basit | AdMob SDK + UMP = 2 yeni Gradle bağımlılığı (**onay gerekir**). APK ≈ +3–4 MB. WebView'ın altına 50–60 dp yer ayrılır. |
| **Native geçiş reklamı** (interstitial) | Evet | JS köprüsü ile "maç sayfasına geçiş" gibi doğal kırılma noktalarında, oturum başına en fazla 1–2. |
| **Ödüllü reklam** ("reklam izle → 1 gün Pro") | Evet, ama abonelik mantığına dokunur | Pro erişimi kodu değişmeden yapılamaz → mevcut kurallarla **kapsam dışı**. |
| AdSense'i web sayfasına koyup WebView'da göstermek | **Hayır** | AdSense politikası WebView içinde gösterimi yasaklar; hesap kapanma riski. |
| Pro aboneye reklam göstermemek | Gerekli | Native katmanın abonelik durumunu bilmesi lazım: web'den `fa_twa` benzeri bir cookie/JS köprüsü ile salt-okunur bayrak. Abonelik mantığı değişmez, sadece okunur. |

## 3. Gelir boyutlandırma

Varsayımlar: kullanıcı başına ayda ~20 oturum, oturum başına ~3 ekran; banner eCPM genel 0,5–1,5 $ (TR ağırlıklı kitle alt bant), geçiş reklamı eCPM 2,5–5 $; "kısıtlı içerik" ve rıza kaybı için ×0,5 çarpanı.

| Senaryo | MAU (uygulama) | Banner gösterim/ay | Geçiş reklamı/ay | Tahmini aylık gelir |
|---|---|---|---|---|
| Bugün | 5 | ~300 | ~100 | **< 0,5 $** |
| Tüm aktif kullanıcılar uygulamaya geçse | 25 | ~1.500 | ~500 | **≈ 1–3 $** |
| 1 Pro abone karşılığı (9,90 $) | ~250–400 | ~20.000 | ~6.000 | ≈ 10 $ |
| Anlamlı eşik | 5.000 | ~300.000 | ~100.000 | **≈ 150–400 $** |
| Güçlü | 10.000+ | 600.000+ | 200.000+ | ≈ 300–800 $ |

Karşılaştırma: aynı 25 aktif kullanıcıdan **1 ek Pro dönüşümü** (9,90 $/ay), reklamların bugünkü kitleyle üreteceği gelirin 20–30 katı.

## 4. Maliyet ve riskler

- **Dönüşüm kaybı:** "Reklamsız" şu an Pro'nun örtük avantajı. Ücretsiz katmana reklam koymak Pro'ya geçiş gerekçesi yaratır ama küçük kitlede bu etki ölçülemez; daha olası sonuç uygulamayı silme (Play yorumlarında 1–2 yıldız riski, mağaza puanı henüz 0 yorumla kırılgan).
- **Sertifikasyon duruşu:** Google Ads kumar-bilgi sertifikasyonu "bilgi servisi, operatörle bağlantısız" iddiasına dayanıyor. Uygulama içi reklamlar yanlış ayarlanırsa (kumar kategorisi açık kalırsa) bu çelişir.
- **Politika yükü:** AAID + Data safety + gizlilik + UMP; her yanlış beyan Play politika ihlali.
- **Mühendislik:** ~1–2 gün (SDK, UMP, köprü, Pro bayrağı, test, yeni AAB, inceleme). Bakım: SDK sürüm takibi, rıza metinleri.
- **Bağımlılık kuralı:** AdMob SDK + UMP, kullanıcı onayı olmadan eklenmeyecek.

## 5. Karar ve tetikleyiciler

**Karar:** Reklam yok. Play beyanı "içermiyor" olarak kalır; uygulama reklamsız kalır.

**Yeniden değerlendirme tetikleyicileri (herhangi biri):**
1. Play tarafında **≥ 5.000 MAU** (Console → İstatistikler).
2. Ücretsiz→Pro dönüşümü 3 ay üst üste %1'in altında kalırsa (reklam, ücretsiz katmanın tek para kazanma yolu olur).
3. Google Ads sertifikasyon başvurusu sonuçlanıp "bilgi servisi" duruşu netleşirse ve AdMob'da kumar kategorisi kapalı tutma kararı yazılı hale gelirse.

**O gün yapılacak minimum paket:** adaptive banner (sadece ücretsiz kullanıcı) + UMP rıza + kumar/sosyal casino kategorileri kapalı + Data safety & gizlilik güncellemesi + Play beyanı "Evet". Geçiş reklamı yalnızca MAU 10k+ ve kullanıcı başına ≤ 2/oturum.

## 6. Reklam yerine önce denenecek daha ucuz kaldıraçlar

1. Play açıklama/ekran görüntüleriyle **Pro'nun değerini** daha görünür yapmak (web'deki /picks karnesi, kanıt kartları).
2. Uygulama içinde deneme bitiminde **tek, kapatılabilir Pro hatırlatması** (kendi "house ad"ımız; AdMob gerekmez, Play reklam beyanını değiştirmez).
3. Kampanya e-postası etkisini (2–3 Kasım) ölçüp kurulum → kayıt → Pro hunisini netleştirmek; reklam kararı bu huniye göre tekrar açılır.

---
Kaynaklar: Play Geliştirici Politikası → Reklamlar (reklam beyanı, rahatsız edici reklamlar, Better Ads, AAID); Google Yayıncı Kısıtlamaları → Çevrimiçi kumar (ipucu/oran/seçim içeriği "kısıtlı"); AdMob hassas kategori engelleme; UMP/GDPR rıza gereksinimi (AB/İsviçre/İngiltere); Play Console ekran görüntüleri 2026-11-01.
