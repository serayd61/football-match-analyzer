# Python Servisi Kurulum Kılavuzu

## 🚀 Hızlı Başlangıç

### Adım 1: Bağımlılıkları Kur

```bash
cd src/lib/data-sources
pip install flask flask-cors pandas pyarrow requests soccerdata
```

### Adım 2: Environment Variable

```bash
export SPORTMONKS_API_TOKEN="your_token_here"
export PORT=5000  # Opsiyonel, default 5000
```

### Adım 3: Servisi Başlat

```bash
python api_server.py
```

**Beklenen Çıktı:**
```
🚀 Starting SoccerData API server on port 5000
📊 SoccerData: ✅ Available
📊 Sportmonks: ✅ Available
 * Running on http://0.0.0.0:5000
```

### Adım 4: Health Check

```bash
curl http://localhost:5000/health
```

**Yanıt:**
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

## 🔧 TypeScript Entegrasyonu

### Environment Variable Ekle

Vercel'de veya `.env.local` dosyasında:

```env
PYTHON_DATA_SERVICE_URL=http://localhost:5000
```

**Not:** Production'da Python servisi ayrı bir sunucuda çalışmalı (örnek: Railway, Render, Heroku).

### Test Et

```bash
# TypeScript API'den test et
curl "https://footballanalytics.pro/api/test-data-sources?league=premier-league&test=fixtures"
```

**Beklenen Yanıt:**
```json
{
  "tests": {
    "fixtures": {
      "hasSoccerData": true,  // ← true olmalı
      "sources": ["soccerdata", "sportmonks"]
    }
  }
}
```

## 📊 API Endpoints

### Health Check
```
GET /health
```

### Fixtures
```
GET /api/fixtures/<league>/<season>?prefer=soccerdata
```

**Örnek:**
```bash
curl "http://localhost:5000/api/fixtures/premier-league/2023-2024?prefer=soccerdata"
```

### xG Data
```
GET /api/xg/<league>/<season>
```

### Shot Map
```
GET /api/shots/<league>/<season>
```

### Elo Ratings
```
GET /api/elo
```

## 🐳 Docker ile Çalıştırma

### Dockerfile Oluştur

```dockerfile
FROM python:3.11-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

EXPOSE 5000

CMD ["python", "api_server.py"]
```

### Docker Compose

```yaml
version: '3.8'

services:
  soccerdata-api:
    build: .
    ports:
      - "5000:5000"
    environment:
      - SPORTMONKS_API_TOKEN=${SPORTMONKS_API_TOKEN}
      - PORT=5000
    volumes:
      - ./data_cache:/app/data_cache
```

## ☁️ Production Deployment

### Railway

1. Railway'a bağlan
2. `src/lib/data-sources` klasörünü deploy et
3. Environment variables ekle:
   - `SPORTMONKS_API_TOKEN`
   - `PORT=5000`
4. Public URL'i al ve `PYTHON_DATA_SERVICE_URL` olarak ayarla

### Render

1. Render'da yeni Web Service oluştur
2. Build command: `pip install -r requirements.txt`
3. Start command: `python api_server.py`
4. Environment variables ekle
5. Public URL'i `PYTHON_DATA_SERVICE_URL` olarak ayarla

## ✅ Kontrol Listesi

- [ ] Python servisi çalışıyor (`curl http://localhost:5000/health`)
- [ ] SoccerData kütüphanesi kurulu (`pip install soccerdata`)
- [ ] Environment variables ayarlı
- [ ] TypeScript'te `PYTHON_DATA_SERVICE_URL` ayarlı
- [ ] Test endpoint'inde `hasSoccerData: true` görünüyor
- [ ] API response'da `source: "soccerdata"` görünüyor

## 🔍 Sorun Giderme

### Problem: "Connection refused"

**Çözüm:** Python servisi çalışmıyor. `python api_server.py` ile başlat.

### Problem: "ModuleNotFoundError: No module named 'soccerdata'"

**Çözüm:** 
```bash
pip install soccerdata
```

### Problem: TypeScript'ten veri gelmiyor

**Çözüm:**
1. `PYTHON_DATA_SERVICE_URL` environment variable'ını kontrol et
2. Python servisinin çalıştığını doğrula
3. CORS ayarlarını kontrol et (Flask-CORS kurulu olmalı)

### Problem: Timeout hatası

**Çözüm:** 
- Python servisinde timeout'u artır
- TypeScript'te timeout'u artır (şu an 10 saniye)

## 📝 Notlar

- Python servisi localhost'ta çalışıyorsa, sadece aynı makineden erişilebilir
- Production'da Python servisi ayrı bir sunucuda çalışmalı
- Cache mekanizması `data_cache` klasöründe çalışıyor
- Rate limiting için `rate_limit_delay` ayarlanabilir
