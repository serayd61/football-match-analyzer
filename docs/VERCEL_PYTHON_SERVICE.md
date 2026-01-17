# Vercel'de Python Servisi Kullanımı

## ⚠️ Önemli: Localhost Çalışmaz!

Vercel'de çalışan Next.js uygulaması **localhost'a erişemez**. Python servisi **public bir URL'de** çalışmalı.

## 🔧 Çözüm: Python Servisini Deploy Et

### Seçenek 1: Railway (Önerilen)

1. **Railway'a git:** https://railway.app
2. **Yeni proje oluştur**
3. **GitHub repo'yu bağla** veya **Dockerfile** kullan
4. **Environment variables ekle:**
   - `SPORTMONKS_API_TOKEN`
   - `PORT=5000`
5. **Public URL'i al:** `https://your-app.railway.app`
6. **Vercel'de environment variable ekle:**
   ```
   PYTHON_DATA_SERVICE_URL=https://your-app.railway.app
   ```

### Seçenek 2: Render

1. **Render'a git:** https://render.com
2. **Yeni Web Service oluştur**
3. **Build command:** `pip install -r requirements.txt`
4. **Start command:** `python api_server.py`
5. **Environment variables ekle**
6. **Public URL'i Vercel'e ekle**

### Seçenek 3: Heroku

1. **Heroku'ya deploy et**
2. **Public URL'i Vercel'e ekle**

## 📝 Vercel Environment Variable

Vercel Dashboard → Project → Settings → Environment Variables:

```
PYTHON_DATA_SERVICE_URL=https://your-python-service.railway.app
```

**Not:** `http://localhost:5002` çalışmaz!

## 🧪 Test Et

Deploy sonrası:

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

## 🚀 Hızlı Deploy (Railway)

### 1. Railway CLI Kur

```bash
npm i -g @railway/cli
railway login
```

### 2. Proje Oluştur

```bash
cd src/lib/data-sources
railway init
railway up
```

### 3. Environment Variables

```bash
railway variables set SPORTMONKS_API_TOKEN="your_token"
railway variables set PORT=5000
```

### 4. Deploy

```bash
railway up
```

### 5. Public URL'i Al

```bash
railway domain
```

### 6. Vercel'e Ekle

Vercel Dashboard → Environment Variables:
```
PYTHON_DATA_SERVICE_URL=https://your-app.railway.app
```

## ✅ Kontrol Listesi

- [ ] Python servisi public URL'de çalışıyor
- [ ] Vercel'de `PYTHON_DATA_SERVICE_URL` ayarlı
- [ ] Health check çalışıyor: `curl https://your-app.railway.app/health`
- [ ] Test endpoint'inde `hasSoccerData: true` görünüyor

## 🔍 Debug

Eğer hala çalışmıyorsa:

1. **Python servisinin çalıştığını kontrol et:**
   ```bash
   curl https://your-python-service.railway.app/health
   ```

2. **Vercel log'larını kontrol et:**
   - Vercel Dashboard → Deployments → Logs
   - `⚠️ SoccerData service not available` mesajını ara

3. **CORS hatası varsa:**
   - `api_server.py`'de `CORS(app)` olduğundan emin ol

4. **Timeout hatası varsa:**
   - Timeout'u artır (şu an 10 saniye)
