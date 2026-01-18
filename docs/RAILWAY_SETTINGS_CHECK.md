# Railway Settings Kontrol Listesi

## ✅ Root Directory (Doğru!)

**Root Directory:** `src/lib/data-sources` ✅

## 🔍 Build Ayarları Kontrolü

### Builder
- **Seçenek:** `Dockerfile` veya `Railpack`
- **Önerilen:** Railway otomatik algılamalı (Dockerfile varsa)
- **Kontrol:** Build logs'da "Using Detected Dockerfile" görünmeli

### Build Command
- **Boş bırakılabilir** (Dockerfile kullanıyorsak)
- Veya: `docker build -t app .`

### Custom Build Command
- **Gerekli değil** (Dockerfile kullanıyorsak)

## 🔍 Deploy Ayarları Kontrolü

### Start Command
- **Değer:** `python api_server.py`
- **Kontrol:** Settings → Deploy → Start Command'da bu komut olmalı

### Healthcheck Path
- **Değer:** `/health` (opsiyonel)
- Python servisinde `/health` endpoint'i var

## 📋 Kontrol Listesi

- [x] Root Directory: `src/lib/data-sources` ✅
- [ ] Builder: Dockerfile algılanmalı
- [ ] Start Command: `python api_server.py`
- [ ] Environment Variables: `SPORTMONKS_API_TOKEN` ve `PORT` ekli mi?

## 🚀 Sonraki Adım: Redeploy

1. **Deployments** sekmesine git
2. **"Redeploy"** veya **"Deploy"** butonuna tıkla
3. Build logs'u kontrol et

## ✅ Başarı Kriterleri

Build logs'da şunları görmelisin:

```
=== PWD ===
/app
=== LS ===
-rw-r--r-- requirements.txt  ← Dosya görünmeli!
=== requirements.txt içeriği ===
flask==3.0.0
soccerdata==1.8.8  ← İçerik görünmeli!
```

Deploy sonrası:
- ✅ Health check başarılı
- ✅ Public URL'den erişilebilir: `https://footballanalytics-production-bb34.up.railway.app/health`
