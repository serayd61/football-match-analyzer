# Railway Deployment Kılavuzu 🚂

## 🚀 Hızlı Başlangıç

### Adım 1: Railway CLI Kur

```bash
npm i -g @railway/cli
railway login
```

### Adım 2: Otomatik Setup (Önerilen)

```bash
cd src/lib/data-sources
./railway-setup.sh
```

Bu script:
- ✅ Railway projesi oluşturur
- ✅ Environment variables ayarlar
- ✅ Deploy eder
- ✅ Public URL'i gösterir

### Adım 3: Manuel Setup (Alternatif)

#### 2.1. Proje Oluştur

```bash
cd src/lib/data-sources
railway init
```

#### 2.2. Environment Variables

```bash
railway variables set SPORTMONKS_API_TOKEN="your_token_here"
railway variables set PORT=5000
```

#### 2.3. Deploy

```bash
railway up
```

#### 2.4. Public URL Al

```bash
railway domain
```

Veya Railway Dashboard'dan:
- Project → Settings → Networking → Generate Domain

## 🔧 Vercel Entegrasyonu

### Adım 1: Public URL'i Al

Railway'dan public URL'i kopyala:
```
https://your-app.railway.app
```

### Adım 2: Vercel Environment Variable Ekle

1. **Vercel Dashboard:** https://vercel.com/dashboard
2. **Project seç:** football-match-analyzer
3. **Settings → Environment Variables**
4. **Yeni variable ekle:**
   - **Name:** `PYTHON_DATA_SERVICE_URL`
   - **Value:** `https://your-app.railway.app`
   - **Environment:** Production, Preview, Development (hepsini seç)
5. **Save**

### Adım 3: Deploy'u Yeniden Başlat

Vercel Dashboard → Deployments → En son deploy → Redeploy

## ✅ Test Et

### 1. Health Check

```bash
curl https://your-app.railway.app/health
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

### 2. Fixtures Test

```bash
curl "https://your-app.railway.app/api/fixtures/premier-league/2023-2024"
```

### 3. TypeScript Entegrasyonu

```bash
curl "https://footballanalytics.pro/api/test-data-sources?league=premier-league&test=fixtures"
```

**Beklenen:**
```json
{
  "environment": {
    "pythonServiceUrl": "https://your-app.railway.app",
    "isLocalhost": false,
    "pythonAvailable": "✅ Public URL configured"
  },
  "tests": {
    "fixtures": {
      "hasSoccerData": true  // ← true olmalı!
    }
  }
}
```

## 🔍 Sorun Giderme

### Problem: "railway: command not found"

**Çözüm:**
```bash
npm i -g @railway/cli
```

### Problem: "Not logged in"

**Çözüm:**
```bash
railway login
```

### Problem: Deploy başarısız

**Çözüm:**
1. Railway Dashboard → Deployments → Logs kontrol et
2. `requirements.txt` dosyasını kontrol et
3. Dockerfile'ı kontrol et

### Problem: Health check başarısız

**Çözüm:**
1. Railway Dashboard → Service → Logs kontrol et
2. Environment variables doğru mu kontrol et
3. Port 5000 kullanılabilir mi kontrol et

### Problem: Vercel'den erişilemiyor

**Çözüm:**
1. `PYTHON_DATA_SERVICE_URL` doğru mu kontrol et
2. Railway servisi çalışıyor mu kontrol et
3. CORS ayarlarını kontrol et (`api_server.py`'de `CORS(app)` var mı?)

## 📊 Railway Dashboard

Railway Dashboard'da kontrol edebileceğin şeyler:

- **Deployments:** Deploy geçmişi
- **Logs:** Canlı log'lar
- **Metrics:** CPU, Memory kullanımı
- **Variables:** Environment variables
- **Networking:** Public URL, domain

## 💰 Maliyet

Railway Free Plan:
- ✅ $5 ücretsiz kredi/ay
- ✅ Bu servis için yeterli (küçük trafik)
- ✅ Upgrade gerekirse $5/ay

## 🎯 Sonraki Adımlar

1. ✅ Railway'a deploy et
2. ✅ Public URL'i al
3. ✅ Vercel'e environment variable ekle
4. ✅ Test et
5. ✅ `hasSoccerData: true` görünüyor mu kontrol et

## 📝 Notlar

- Railway otomatik olarak Dockerfile kullanır
- Her commit'te otomatik deploy yapılabilir (GitHub entegrasyonu)
- Log'lar Railway Dashboard'da görülebilir
- Environment variables Railway Dashboard'dan da ayarlanabilir
