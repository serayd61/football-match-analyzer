# Testers Community geri bildirimi — uygulama raporu

Tarih: 2026-10-16 · Dal: `feat/testers-community-ux` · Plan: `docs/TESTERS_COMMUNITY_IMPLEMENTATION_PLAN.md`

Raporun bulgusu "kritik hata yok, 7 iyileştirme önerisi" idi. Bu PR web tarafındaki tüm öneriyi uygular; Android (`android-app/`) tarafında kod değişikliği yoktur, o yüzden yeni bir AAB gerekmez. Mağaza metni ve ekran görüntüleri belge + varlık olarak hazır, Console'a girilmesi manueldir.

## 1. Durum tablosu

| Alan | Durum | Ne yapıldı | Kanıt / dosya |
|---|---|---|---|
| ASO (mağaza metni) | **HAZIR, Console'a girilmedi** | en/de/tr başlık, kısa ve tam açıklama; anahtar kelime kümeleri (aday); yasak kelime ve karakter sınırı doğrulayıcısı | `docs/aso/google-play-{en,de,tr}.md`, `node scripts/aso-validate.js` → OK (en 22/75/2339, de 22/80/2442, tr 22/75/2203) |
| Onboarding turu | **UYGULANDI** | 5 adımlı erişilebilir dialog; yalnız Play uygulamasında ilk ziyarette otomatik; Hesap → "Turu yeniden göster"; Esc/Tab/odak yönetimi | `src/components/site/Onboarding.tsx`, e2e `e2e/app-ux.spec.ts` |
| Koyu tema | **ZATEN VARDI, doğrulandı** | Kod değişmedi; `theme_changed` olayı eklendi; e2e ile geçiş + kalıcılık doğrulandı. Android 10–12 force-dark v3'te düzeltilmişti | `src/components/site/ThemeToggle.tsx`, e2e "tema geçişi" |
| Ekran görüntüleri | **ÜRETİLDİ (en/tr), yüklenmedi** | Başlık bantlı 1080×1920 çerçeveli 8 görsel; tasarım spesifikasyonu; de/it kaynak ekranı yok | `marketing/play/screenshots/framed/`, `scripts/play-screenshot-frames.py`, `docs/aso/SCREENSHOT_DESIGN_SPEC.md` |
| Şifre göster/gizle | **UYGULANDI** | Site giriş/kayıt formu + eski şifre sıfırlama sayfası; `type=button`, `aria-label`, `aria-pressed`, değer ve imleç korunur | `src/components/site/PasswordInput.tsx`, `LoginForm.tsx`, `src/app/(app)/reset-password/page.tsx` |
| Puanla (rate) | **UYGULANDI** | Hesap → Uygulama → "Google Play'de puanla"; uygulamada `market://details?id=pro.footballanalytics` (WebView Play Store'a açar), web'de Play listesi; Play modunda footer'da da | `src/lib/site/app-links.ts`, `src/components/site/account/AppActions.tsx`, `FooterAppActions.tsx` |
| Paylaş | **UYGULANDI** | `navigator.share` + pano kopyalama yedeği; UTM'li bağlantı (`utm_source=share&utm_medium=app_share`); uygulamada Play listesi, web'de yerel site | aynı dosyalar; birim test `tests/app-links.test.ts` |
| Geri bildirim | **BAĞLANDI** | Mevcut `/contact` formu (Supabase `contact_messages` + e-posta) hesaba ve Play footer'ına bağlandı; `feedback_opened` olayı | `AppActions.tsx` → `legacyHref('/contact')` |
| Performans | **ÖLÇÜLDÜ, değişiklik yok** | Üretim TTFB ölçümü aşağıda; rapordaki "yavaş yükleme" belirsiz bir gözlemdi, veriye göre müdahale gerekmiyor | §3 |
| SEO / indirme bağlantıları | **ENGELLİ** | Uygulama kapalı testte; "Google Play'den indir" CTA'sı ve `SoftwareApplication` verisi üretim erişimi onaylanınca | §5 |
| Analitik | **UYGULANDI** | 8 yeni olay, GA4 + Vercel boru hattı, kişisel veri yok | `src/lib/analytics.ts` §4 |

## 2. Doğrulama (gerçekten koşturuldu)

| Kontrol | Sonuç |
|---|---|
| `npm run typecheck` | temiz |
| `npm test` | 234/234 geçti (230 mevcut + 4 yeni `app-links`) |
| `npm run build` | "Compiled successfully" (statik üretimde mevcut `[engine/versions] read failed` logları önceden de vardı, derlemeyi etkilemiyor) |
| e2e `e2e/app-ux.spec.ts` (desktop/tablet/mobile, dev sunucu 3017) | 22 geçti, 2 atlandı (tema düğmesi <1024 px'de menü içinde, tasarım gereği) |
| e2e `e2e/static.spec.ts` regresyon | 87 geçti |
| `node scripts/aso-validate.js` | OK |
| Tarayıcıda elle | Hesap sayfasında yeni "Uygulama" bölümü; tur 5 adım ileri/geri, Bitti → `fa-onboarding=done`; Esc → `skipped`; Paylaş → "Bağlantı panoya kopyalandı"; kaydırma kilidi kalkıyor |

Yapılmayan: Android emülatöründe gerçek `market://` açılışı (kapalı testte Play Store "bulunamadı" verebilir; kod yolu `MainActivity.shouldOverrideUrlLoading` → `openExternal`, v2'den beri harici şemalar için çalışıyor).

## 3. Performans ölçümü (üretim, 2026-10-16, curl, soğuk + ılık)

| Sayfa | TTFB | Toplam | HTML boyutu |
|---|---|---|---|
| `/en` | 0,47 s / 0,31 s | 0,66 s / 0,50 s | 212 KB |
| `/en/matches` | 0,25 s / 0,11 s | 0,27 s / 0,13 s | 319 KB |
| `/en/performance` | 0,83 s / 0,86 s | 1,03 s / 1,09 s | 429 KB |
| `/en/leagues/premier-league` | 0,38 s / 0,26 s | 0,66 s / 0,28 s | 230 KB |
| `/tr` | 0,29 s / 0,27 s | 0,48 s / 0,46 s | 215 KB |

Yorum: tek dikkat çeken `/en/performance` (TTFB ~0,85 s, iki ölçümde de önbelleksiz görünüyor). Öneri (uygulanmadı, model/veri mantığına dokunur): sayfanın haftalık hesaplanan bölümünü ISR ile önbelleklemek. Diğer sayfalar hedef aralıkta. İstemci tarafı (LCP/CLS) ölçümü Vercel Speed Insights panelinden okunmalı; depodan ölçülemedi.

## 4. Yeni analitik olayları

| Olay | Nerede | Parametreler |
|---|---|---|
| `onboarding_started` | tur otomatik açıldığında | `source: auto` |
| `tutorial_reopened` | Hesap → Turu yeniden göster | `source: settings` |
| `onboarding_completed` | Bitti / son adım CTA | `steps_viewed` |
| `onboarding_skipped` | Atla / X / Esc | `step`, `steps_viewed` |
| `theme_changed` | tema düğmesi | `theme: light\|dark\|system` |
| `app_share_clicked` | Paylaş | `location: account\|footer`, `in_app` |
| `app_review_clicked` | Puanla | `location`, `in_app` |
| `feedback_opened` | Geri bildirim | `location` |

Hepsi `trackEvent` üzerinden GA4 + Vercel Analytics'e gider; ilk temas UTM'i otomatik eklenir; kullanıcı kimliği gönderilmez.

## 5. Yapılmayanlar ve nedenleri
- **Tooltip sistemi** (raporun "ilk kullanımda ipucu" fikri): yeni bir bağımlılık/karmaşıklık getirirdi; tur adımları 2–3 aynı açıklamayı veriyor. İkinci faz.
- **Play In-App Review API**: Android tarafında JS köprüsü gerektirir; bu PR'da native değişiklik yok. v4 için öneri: `WebView.addJavascriptInterface` ile `requestReview()` + `navigator.share` yerine yerel paylaşım sayfası (`Intent.ACTION_SEND`). Kullanıcı imzalar, AAB yüklemesi yalnız onayla.
- **Sitede "Google Play'den indir"**: uygulama halka açık değil; üretim erişimi (~24 Ekim) sonrası.
- **de/it ekran görüntüleri**: kaynak ekran yok; betik hazır (`SCREENSHOT_DESIGN_SPEC.md` §5).
- **Lig kapsamını genişletme** (raporun genel tavsiyesi): model/veri kararı, kapsam dışı.

## 6. Manuel işler (kullanıcı)
1. PR'ı birleştir (Vercel üretime alır). Bu PR Android'e dokunmaz; yeni AAB gerekmez.
2. Play Console → Mağaza girişi: `docs/aso/google-play-en.md` (en-US), `-tr.md`, `-de.md` metinlerini gir; `marketing/play/screenshots/framed/en|tr` görsellerini 01→04 sırasıyla yükle.
3. Eski `/contact` sayfasındaki `info@swissdigital.life` ile Console'daki `support@footballanalytics.pro` arasında karar ver (tutarsız).
4. Testers Community takvimi: v4 (17–18 Ekim) için Android değişikliği istersen (In-App Review + yerel paylaşım) ayrı iş; istemezsen bu web güncellemesi "güncelleme" sayılır, sürüm notu Console'a yazılır.
5. de/it için dev sunucu açıkken ekran görüntüsü alınması (betik ve spec hazır).
