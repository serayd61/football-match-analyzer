# Railway Source Bağlantısı Kurulumu

## 🔧 Sorun

Railway'da **Root Directory** `src/lib/data-sources` bulunamıyor. Bu, Railway'ın source'unun doğru bağlanmadığı anlamına geliyor.

## ✅ Çözüm: GitHub Repo'ya Bağla

### Yöntem 1: GitHub Repo Bağlantısı (Önerilen)

1. **Railway Dashboard:** https://railway.app/dashboard
2. **Service seç:** `footballanalytics-production-bb34`
3. **Settings → Source**
4. **"Connect Repo"** butonuna tıkla
5. **GitHub hesabını bağla** (eğer bağlı değilse)
6. **Repository seç:** `football-match-analyzer` veya repo adın
7. **Branch seç:** `main` veya `master`
8. **Root Directory:** `src/lib/data-sources` yaz
9. **"Connect"** butonuna tıkla

### Yöntem 2: Manuel Dosya Yükleme

Eğer GitHub bağlantısı yapmak istemiyorsan:

1. **Railway Dashboard → Service → Settings → Source**
2. **"Upload Files"** veya **"Deploy from CLI"** kullan
3. **Root Directory:** `/` bırak (çünkü sadece `src/lib/data-sources` klasörünü yükleyeceksin)

**Not:** Bu yöntemde her değişiklikte manuel yükleme gerekir.

## 🚀 Sonraki Adımlar

### GitHub Bağlantısı Sonrası:

1. ✅ Railway otomatik olarak yeni commit'lerde deploy yapar
2. ✅ Root directory `src/lib/data-sources` olarak ayarlı
3. ✅ Build cache'i temizle (Settings → Clear Build Cache)
4. ✅ Redeploy yap veya yeni commit push et

### Manuel Yükleme Sonrası:

1. ✅ Root directory `/` olarak ayarlı
2. ✅ `src/lib/data-sources` klasöründeki tüm dosyaları yükle
3. ✅ Deploy yap

## 📝 Önerilen Yöntem

**GitHub Repo Bağlantısı** önerilir çünkü:
- ✅ Otomatik deploy (her commit'te)
- ✅ Version control
- ✅ Daha kolay yönetim
- ✅ Root directory doğru çalışır

## 🔍 Kontrol

Deploy sonrası build logs'da:

```
=== requirements.txt içeriği ===
soccerdata==1.8.8  ← Doğru versiyon görünmeli
```
