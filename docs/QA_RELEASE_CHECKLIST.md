# QA ve yayın kontrol listesi — web + Google Play

Her yayın öncesi (web PR'ı veya Android sürümü) işaretlenir. Otomatik adımlar komutla, manuel adımlar cihazda. Son tam koşum: 2026-10-16 (`feat/testers-community-ux`).

## A. Otomatik (web)
- [ ] `npm run typecheck` temiz
- [ ] `npm test` (node --test) tümü geçiyor
- [ ] `npm run build` (next build) hatasız
- [ ] `npm run e2e` `@static` (dev sunucu otomatik) — veya canlı: `E2E_BASE_URL=https://footballanalytics.pro npm run e2e`
- [ ] `node scripts/aso-validate.js` → OK (mağaza metni değiştiyse)

## B. Manuel — web (masaüstü + mobil genişlik)
- [ ] Giriş: şifre alanındaki göz düğmesi `type`'ı değiştiriyor, form gönderilmiyor, klavyeyle (Tab + Enter/Space) çalışıyor
- [ ] Tema: başlıktaki düğme sistem → açık → koyu döngüsü; yenilemede kalıyor; koyu temada tur ve hesap düğmeleri okunaklı
- [ ] Hesap → Uygulama: Paylaş (web'de sistem paylaşım sayfası ya da "bağlantı kopyalandı"), Puanla (Play listesi yeni sekmede), Geri bildirim (`/contact?lang=…`), Turu yeniden göster
- [ ] Tur: 5 adım, Geri/İleri, Esc = atla, odak dialog içinde kalıyor, arka plan kaydırılmıyor; kapanınca `localStorage.fa-onboarding` = done|skipped
- [ ] Web'de tur kendiliğinden **açılmıyor** (`/en/about` 2 sn bekle)
- [ ] 4 dil: tr/en/de/it giriş sayfası ve hesap sayfası metinleri eksiksiz (eksik anahtar = `MISSING_MESSAGE` konsol uyarısı)

## C. Manuel — Google Play (WebView uygulaması)
- [ ] Emülatör (android-36) veya cihazda `?src=twa` ile açılış; ilk açılışta tur geliyor, ikinci açılışta gelmiyor
- [ ] Footer'da Paylaş / Puanla / Geri bildirim görünüyor (yalnız uygulamada)
- [ ] Puanla → Play Store uygulaması açılıyor (`market://`); kapalı testte "bulunamadı" görülebilir, üretim sonrası normal
- [ ] Paylaş → WebView'da `navigator.share` yok, "Bağlantı panoya kopyalandı" görünüyor (v4'te yerel paylaşım köprüsü planlı)
- [ ] Koyu tema: Android 10–12'de force-dark (v3) ile site koyu açılıyor; Android 13+ sistem temasıyla
- [ ] Çevrimdışı ekranı ve "Tekrar dene" çalışıyor; geri tuşu geçmişte geriye gidiyor
- [ ] Fiyat/checkout hiçbir yerde görünmüyor (Play ödeme politikası)

## D. Android sürüm (yalnız native değişiklik varsa)
- [ ] `versionCode`/`versionName` artırıldı (`android-app/app/build.gradle.kts`)
- [ ] `./gradlew bundleRelease assembleRelease` → kullanıcı `./sign-release.sh` ile imzalar (parola yalnız kullanıcıda); SHA-256 = yükleme anahtarı
- [ ] AAB Console'a **kullanıcı onayıyla** yüklenir (otomatik yükleme yok)
- [ ] `marketing/google-play-store-listing.md` §8 sürüm tablosu güncellendi

## E. Mağaza girişi (değiştiyse)
- [ ] `docs/aso/google-play-{en,de,tr}.md` metinleri Console'a girildi (en-US varsayılan; tr-TR, de-DE çeviri olarak)
- [ ] `marketing/play/screenshots/framed/` görüntüleri yüklendi (sıra: 01→04)
- [ ] Yasak kelime taraması temiz (`scripts/aso-validate.js`)
