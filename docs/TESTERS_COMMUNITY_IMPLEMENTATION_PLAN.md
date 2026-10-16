# Testers Community geri bildirimi — uygulama planı

Tarih: 2026-10-16 · Kaynak: Testers Community "FootbalAnalytics – Feedback Report" (9 sayfa, 16 Ekim 2026'da indirildi ve okundu) · Dal: `feat/testers-community-ux`

Raporun özeti: 15 testçi, çeşitli cihaz ve SDK'larda test; **kritik hata, çökme veya işlev bozukluğu bulunmadı.** Yedi iyileştirme önerisi ve beş genel tavsiye (geri bildirim mekanizması, performans izleme, lig kapsamı, erişilebilirlik, düzenli güncelleme) var. Bu belge önce mevcut durumu kodla eşleştirir, sonra iş sırasını ve test stratejisini verir.

## 1. Mevcut mimari

| Katman | Teknoloji | Yer |
|---|---|---|
| Web | Next.js 14 App Router, React 18, TypeScript, Tailwind + `.site` tasarım sistemi (`src/app/(site)/site.css`, `src/components/site/ui.tsx`) | `src/app/(site)/[locale]/…` (yeni site, 4 dil: en/de/it/tr, `next-intl`, mesajlar `messages/*.json`) ve `src/app/(app)/…` (eski uygulama kabuğu, `LanguageProvider`) |
| Kimlik | NextAuth: e-posta/şifre (`CredentialsProvider`) + Google (2026-10-13) | `src/lib/auth.ts`, `src/app/(site)/[locale]/login/LoginForm.tsx` |
| Veri | Supabase (prod: `njrpxhmdqadejjarizmj`, MCP'de değil), API-Football | `src/lib/*` |
| Ödeme | Stripe (aylık $9.90); Play uygulamasında satış yok (`fa_twa` çerezi → fiyat/checkout gizli) | `src/lib/site/twa.ts`, `PlanChooser.tsx`, `account/page.tsx` |
| Analitik | GA4 (`@next/third-parties`) + Vercel Analytics özel olayları, tek sarmalayıcı `src/lib/analytics.ts` (`track.*`) | |
| Android | **Düz WebView** uygulaması (TWA değil), `pro.footballanalytics`, sürüm kodu 3 / 1.1.1, minSdk 24, targetSdk 36; başlangıç URL'si `https://footballanalytics.pro/?src=twa` | `android-app/` (Gradle 8.14.3, AGP 8.13, Java 17); `android-twa/` yalnız referans |
| Play durumu | Kapalı test "Alpha" (15 testçi, 11 Ekim'den beri), üretim erişimi başvurusu ~24 Ekim | `marketing/google-play-store-listing.md` §8 |
| Testler | `node --test tests/*.test.ts` (230 test, geçiyor), Playwright e2e (`e2e/`), `tsc --noEmit` temiz | |
| Dağıtım | Vercel (Git push ile; bu işte otomatik dağıtım yok) | |

Değişmeyecekler (talimat gereği): tahmin motoru, olasılık/edge hesapları, abonelik mantığı, kimlik sağlayıcı, API sözleşmeleri, mevcut URL yapısı.

## 2. Rapor maddelerinin koddaki durumu

| # | Rapor maddesi | Durum | Kanıt |
|---|---|---|---|
| 1 | ASO (açıklama kısa, anahtar kelime az) | **KISMEN** | Console'daki mağaza metni `marketing/google-play-store-listing.md` §2'de: en/tr/de/it tam açıklama var (~1.900 karakter), kısa açıklama 74–78 karakter, başlık "Football Analytics Pro". Anahtar kelime kümeleri (istatistik/analiz/olasılık, lig adları, karşılaştırma) sistematik değil; Console'a yalnız en-US girildi (tr/de/it girilmedi). |
| 2 | Dinamik kullanıcı turu (onboarding) | **EKSİK** | `grep -ri onboarding src` boş. Tooltip altyapısı yok (`ConfidenceRing` yalnız `aria-label`). |
| 3 | Koyu tema | **UYGULANMIŞ** (keşfedilebilirlik zayıf) | `src/components/site/ThemeToggle.tsx`: sistem/açık/koyu döngüsü, `localStorage['site-theme']`, `.site[data-theme]`; `site.css:61,91` koyu belirteçler; layout'taki `bootScript` ilk boyamada doğru temayı uygular (flaş yok). Başlıkta (lg+) ve mobil menü sayfasında (`SiteHeader.tsx:72,128`) ve `/account` ayarlarında var. Android 10–12 WebView'da site koyu açılmıyordu → v3'te `WebSettingsCompat.setForceDark` ile düzeltildi (`MainActivity.applyDarkMode`). Testçi büyük ihtimalle v2'yi (Android ≤12) kullandı ya da mobilde menünün içindeki düğmeyi bulamadı. |
| 4 | Mağaza ekran görüntüleri (başlıksız düz ekranlar) | **KISMEN** | `marketing/play/screenshots/{en,tr}/0[1-4]-*.png` 1080×1920 düz ekranlar (ana sayfa, performans, lig, metodoloji); başlık/çerçeve yok; de/it yok. Console'a yalnız 4 en yüklendi. Araç: `scripts/seo-screenshots.js` (playwright-core, headless shell önbellekte) + PIL mevcut. |
| 5 | Şifre göster/gizle | **EKSİK** | `LoginForm.tsx:64` `type="password"` düz input; eski `src/app/(app)/reset-password/page.tsx:90,94` aynı. |
| 6 | "Uygulamayı puanla" | **EKSİK** | `grep play.google.com src` yalnız API dokümanında. `/account` Ayarlar bölümü (dil, tema, şifre, oturum) genişletilebilir. Android tarafında Play In-App Review API yok. |
| 7 | Uygulama içi paylaşım | **EKSİK** | `navigator.share` kullanımı yok; `track.shareClick` olayı tanımlı ama çağrılmıyor. |
| + | Geri bildirim mekanizması | **KISMEN** | Eski kabukta `/contact` sayfası (`src/app/(app)/contact/page.tsx`: kategori bug/feature/complaint/praise/general, puan, Supabase `contact_messages` + Resend e-posta) çalışıyor; yeni siteden/hesaptan bağlantı yok, Play uygulamasında keşfedilemez. |
| + | Performans izleme | **KISMEN** | Vercel Analytics + Speed Insights panelde; depo içinde ölçüm yok. |
| + | Erişilebilirlik | **KISMEN** | Skip-link, `aria-current`, `aria-label` var; yeni bileşenler aynı standartta yazılacak. |

## 3. Eksik / kısmen olanlar için çözüm tasarımı

### 3.1 Şifre göster/gizle (Öncelik 1)
- `src/components/site/PasswordInput.tsx` (yeni, istemci): `.input` stilini koruyan sarmalayıcı; sağda 40×40 `type="button"` göz ikonu (`lucide-react` `Eye`/`EyeOff`), `aria-label` + `aria-pressed`, `tabIndex=0`, form göndermez; değer ve odak korunur (input kontrolü üst bileşende kalır).
- Kullanım: `LoginForm.tsx` (giriş + kayıt aynı alan) ve eski `reset-password` (iki alan; eski kabukta i18n `labels` nesnesi var, etiketler oraya eklenir).
- Çeviri: `v2.login.showPassword` / `hidePassword` (4 dil).

### 3.2 Paylaş + Puanla + Geri bildirim (Öncelik 1)
- `src/components/site/account/AppActions.tsx` (yeni, istemci): üç satır `/account` Ayarlar listesine eklenir.
  - **Paylaş:** `navigator.share({title, text, url})`; yoksa `navigator.clipboard.writeText(url)` + "Bağlantı kopyalandı" durum metni (`aria-live`). URL: Play içindeyse Play listesi `https://play.google.com/store/apps/details?id=pro.footballanalytics`, web'de `https://footballanalytics.pro/{locale}?utm_source=share&utm_medium=app_share`. Metin: rapor-prompt'taki 3 cümle + it.
  - **Puanla:** Play içindeyse `market://details?id=pro.footballanalytics` (WebView `openExternal` → Play Store uygulaması), web'de HTTPS Play linki (`rel="noopener"`, yeni sekme). Uygulama henüz halka açık değil (kapalı test); link testçiler için çalışır, üretim erişimi gelince herkese açılır. In-App Review API: Android tarafında JS köprüsü gerektirir → v4'e not (bkz. §7).
  - **Geri bildirim:** mevcut `/contact` sayfasına `legacyHref('/contact', locale)` ile bağlantı (kopya form yok). Eski sayfadaki `info@swissdigital.life` adresi Console'daki `support@footballanalyzer.com` ile tutarsız → kullanıcı kararı (manuel madde).
- Olaylar: `app_share_clicked`, `app_review_clicked`, `feedback_opened` (`trackEvent`).
- Not: `/account` oturum ister. Oturumsuz Play kullanıcısı için paylaş/puanla `SiteFooter`'a da eklenir (yalnız `useIsTwa()` doğruysa; web'de footer'da zaten sosyal bağlantılar var, kalabalık yaratılmaz).

### 3.3 Onboarding turu (Öncelik 2)
- `src/components/site/Onboarding.tsx` (istemci, `role="dialog"`, `aria-modal`, odak tuzağı, Esc kapatır): 5 adım, ilerleme noktaları, Geri/İleri/Atla, `localStorage['fa-onboarding']='done'|'skipped'`. Yalnız **Play uygulamasında** (`fa_twa`) ve ilk ziyarette otomatik açılır; web'de otomatik açılmaz (SEO sayfalarını ve dönüşüm hunisini bölmemek için), ama `/account` → "Turu yeniden aç" her yerde çalışır. Hiç gezinmeyi engellemez (arkadaki sayfa yüklü kalır).
- Adımlar (yalnız var olan özellikler): 1) Hoş geldin (11 lig, model, herkese açık karne) 2) Maçlar & olasılıklar (1X2/alt-üst/KG, güven halkası) 3) Edge = model − piyasa, "değer radarı"nın anlamı ve **sınırı** (pozitif edge lehimize olmadı, piyasa daha iyi kalibre — `predictions.edgeNote` ile tutarlı) 4) Performans karnesi (her tahmin zaman damgalı, kazanan/kaybeden açık) 5) Başla: bugünün maçları / ücretsiz kayıt. Takım karşılaştırma adımı **yok** (böyle bir özellik yok).
- Tooltip: kapsam dışı bırakıldı (yeni bir tooltip sistemi = yeni bağımlılık/riski; adım 2–3 aynı açıklamayı veriyor). Rapora "ikinci faz" olarak not.
- Olaylar: `onboarding_started/completed/skipped`, `tutorial_reopened`.

### 3.4 Koyu tema (Öncelik 2, yalnız doğrulama + küçük iyileştirme)
- Kod var; yapılacak: `ThemeToggle` değiştiğinde `theme_changed` olayı; mobil tab çubuğuna eklenmez (4 sekme dolu). Doğrulama: e2e'de `data-theme` geçişi ve `localStorage` kalıcılığı.

### 3.5 ASO (Öncelik 3) — belge
- `docs/aso/google-play-{en,de,tr}.md`: başlık (≤30), kısa (≤80), tam (≤4000) metinleri, karakter sayıları betikle doğrulanmış; anahtar kelime kümeleri (birincil/ikincil), hedef arama niyeti, doğrulanması gereken iddialar. Hacim/sıralama verisi **yok**: Console "Mağaza performansı" verisi bu oturumda okunmadı, uydurulmaz.
- Console'a girme işi manuel (kullanıcı/benim Chrome ile), bu PR'da yapılmaz.

### 3.6 Ekran görüntüleri (Öncelik 3)
- `docs/aso/SCREENSHOT_DESIGN_SPEC.md` + gerçek varlık üretimi: mevcut 1080×1920 ekranlar PIL ile 1080×1920 çerçeveye (marka yeşili üst şerit, 2 satırlık fayda başlığı, telefon çerçevesi) yerleştirilir; en/tr için 4'er, de/it için ekranlar henüz alınmadığında yalnız spec. Yeni ekran uydurulmaz. Yükleme manuel.

### 3.7 SEO / uygulama keşfi (Öncelik 3)
- Uygulama henüz Play'de halka açık değil → sitede "Google Play'den indir" CTA'sı ve `SoftwareApplication` yapılandırılmış verisi **üretim erişimi onaylanınca** (engelli). Bu PR: hazırlık notu + `docs/QA_RELEASE_CHECKLIST.md`.

### 3.8 Performans (Öncelik 4)
- Ölçüm yapılmadan değişiklik yok. Bu PR: `curl` ile TTFB/boyut ölçümü tablosu rapora; öneriler. Canlı maç verisi önbellekleme kuralına dokunulmaz.

### 3.9 Analitik (Öncelik 4)
- Yeni olaylar `src/lib/analytics.ts` `Events` sözlüğüne eklenir; mevcut GA4 + Vercel boru hattı; kişisel veri yok.

## 4. Riskler ve bağımlılıklar
- **Yeni bağımlılık yok.** `lucide-react` zaten var.
- `/account` sunucu bileşeni; yeni satırlar istemci alt bileşeni olarak eklenir (mevcut `BillingActions` deseni).
- Onboarding yalnız Play modunda otomatik → web SEO/dönüşüm etkilenmez. Yanlış pozitif riski: `fa_twa` çerezi 1 yıl kalıcı; tarayıcıda `?src=twa` ile açan biri turu görür (kabul edilebilir).
- Eski `reset-password` sayfası `(app)` kabuğunda, Tailwind sınıfları farklı (`fa-input`); aynı bileşen yerine küçük yerel düğme kullanılır.
- Çeviri JSON'ları `json.dumps(indent=2, ensure_ascii=False)` ile birebir yeniden yazılabiliyor (doğrulandı), anahtar sırası korunur.
- Paylaşım/puanlama linkleri kapalı test süresince yalnız testçilerde açılır; Play listesine giden herkese açık trafik üretim onayından sonra.

## 5. Uygulama sırası
1. Şifre göster/gizle (site + eski sıfırlama sayfası) → typecheck, birim test, e2e statik.
2. Hesap ayarlarına Paylaş / Puanla / Geri bildirim + footer (Play modu) + olaylar.
3. Onboarding turu + "Turu yeniden aç" + olaylar.
4. `theme_changed` olayı.
5. ASO belgeleri + ekran görüntüsü spec'i ve varlıkları.
6. QA: typecheck, `npm test`, `next build`, e2e (`@static`), Android derlemesi değişmedi (web tarafı); rapor.

## 6. Test stratejisi
- Birim (`node --test`): paylaşım URL'si ve metin üretimi (`buildShareTarget`), onboarding adım makinesi (saf fonksiyonlar).
- e2e (`e2e/static.spec.ts` kalıbı): giriş sayfasında göz düğmesi `type` değiştiriyor, form gönderilmiyor; tema geçişi `data-theme` yazıyor; hesap sayfası oturum ister (DB gerekir → `@static` dışı, manuel).
- Manuel: Android emülatörde (android-36) Play modunda tur, paylaş (sistem paylaşım sayfası), puanla (Play Store açılır). Emülatörde Play Store var (google_apis imajı) ama uygulama kapalı testte → "bulunamadı" görülebilir, bu beklenir.
- Erişilebilirlik: klavye ile göz düğmesi ve tur (Tab/Esc), `aria-*` kontrolü.

## 7. Değişmesi beklenen dosyalar
- Yeni: `src/components/site/PasswordInput.tsx`, `src/components/site/account/AppActions.tsx`, `src/components/site/Onboarding.tsx`, `src/lib/site/app-links.ts`, `tests/app-links.test.ts`, `docs/aso/*.md`, `docs/QA_RELEASE_CHECKLIST.md`, `docs/TESTERS_COMMUNITY_IMPLEMENTATION_REPORT.md`, `marketing/play/screenshots/framed/*`.
- Düzenlenen: `LoginForm.tsx`, `src/app/(app)/reset-password/page.tsx`, `account/page.tsx`, `SiteFooter.tsx`, `[locale]/layout.tsx` (Onboarding bağlama), `ThemeToggle.tsx`, `src/lib/analytics.ts`, `messages/{en,de,it,tr}.json`, `e2e/static.spec.ts`.
- Android (`android-app/`): bu PR'da değişiklik yok; v4 için In-App Review köprüsü ve `market://` doğrulaması ayrı iş.

## 8. Tahmini karmaşıklık
Şifre toggle: düşük. Paylaş/Puanla/Geri bildirim: düşük. Onboarding: orta (odak yönetimi, 4 dil, 5 adım). ASO belgeleri: orta (metin). Ekran görüntüleri: orta (PIL kompozisyon). SEO/performans: belge.

## 9. Manuel işler (kullanıcı)
- Console'a ASO metinlerini girmek (tr/de/it mağaza girişleri dahil) ve yeni ekran görüntülerini yüklemek.
- Eski `/contact` sayfasındaki `info@swissdigital.life` / `swissdigital.life` ile Console'daki `support@footballanalyzer.com` arasında karar.
- de/it için gerçek telefon ekran görüntüsü alınması (betik hazır, dev sunucu gerekir).
- Android v4 (In-App Review API) için imzalama (`sign-release.sh`) — AAB yükleme bu işin parçası değil.
- Dağıtım: PR'ı birleştirmek (Vercel otomatik yayınlar).
