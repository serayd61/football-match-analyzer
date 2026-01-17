# Vercel Environment Variable Kurulumu

## 🎯 Public URL

```
https://footballanalytics-production-bb34.up.railway.app
```

## 📋 Adım Adım Kurulum

### Adım 1: Vercel Dashboard'a Git

1. **Vercel Dashboard:** https://vercel.com/dashboard
2. **Project seç:** `football-match-analyzer` veya proje adın

### Adım 2: Environment Variables Sayfasına Git

1. **Settings** sekmesine tıkla
2. **Environment Variables** sekmesine tıkla

### Adım 3: Yeni Variable Ekle

1. **"Add New"** butonuna tıkla
2. **Name:** `PYTHON_DATA_SERVICE_URL`
3. **Value:** `https://footballanalytics-production-bb34.up.railway.app`
4. **Environment:** 
   - ✅ Production
   - ✅ Preview  
   - ✅ Development
   (Hepsini seç!)
5. **Save** butonuna tıkla

### Adım 4: Deploy'u Yeniden Başlat

1. **Deployments** sekmesine git
2. En son deployment'ı bul
3. **"..."** menüsünden **"Redeploy"** seç
4. **"Redeploy"** butonuna tıkla

## ✅ Test Et

### 1. Health Check (Railway)

```bash
curl https://footballanalytics-production-bb34.up.railway.app/health
```

**Beklenen:**
```json
{
  "status": "ok",
  "service": "soccerdata-api",
  "sources": {
    "soccerdata": true,
    "sportmonks": true
  }
}
```

### 2. TypeScript Entegrasyonu

```bash
curl "https://footballanalytics.pro/api/test-data-sources?league=premier-league&test=fixtures"
```

**Beklenen:**
```json
{
  "environment": {
    "pythonServiceUrl": "https://footballanalytics-production-bb34.up.railway.app",
    "isLocalhost": false,
    "pythonAvailable": "✅ Public URL configured"
  },
  "tests": {
    "fixtures": {
      "hasSoccerData": true,  // ← true olmalı!
      "sources": ["soccerdata", "sportmonks"]
    }
  }
}
```

## 🔍 Sorun Giderme

### Problem: Health check başarısız

**Çözüm:**
1. Railway Dashboard → Service → Logs kontrol et
2. Servis başlamış mı kontrol et
3. Environment variables doğru mu kontrol et

### Problem: Vercel'den erişilemiyor

**Çözüm:**
1. Vercel Dashboard → Environment Variables → `PYTHON_DATA_SERVICE_URL` var mı kontrol et
2. Value doğru mu kontrol et (https:// ile başlamalı)
3. Deploy'u yeniden başlat
4. Vercel log'larını kontrol et

### Problem: `hasSoccerData: false`

**Çözüm:**
1. Railway servisi çalışıyor mu kontrol et
2. Vercel environment variable doğru mu kontrol et
3. Vercel log'larında hata var mı kontrol et
4. CORS hatası varsa `api_server.py`'de `CORS(app)` olduğundan emin ol

## 📝 Notlar

- Environment variable eklendikten sonra **mutlaka redeploy yap**
- Production, Preview, Development için ayrı ayrı eklenebilir
- Değişiklikler genellikle 1-2 dakika içinde aktif olur
