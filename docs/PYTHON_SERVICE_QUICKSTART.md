# Python Servisi Hızlı Başlangıç 🚀

## ⚡ Tek Komutla Başlat

```bash
cd src/lib/data-sources
./start_server.sh
```

Bu script:
- ✅ Virtual environment oluşturur (yoksa)
- ✅ Gerekli kütüphaneleri kurar
- ✅ Servisi başlatır

## 📋 Manuel Kurulum

### Adım 1: Klasöre Git

```bash
cd src/lib/data-sources
```

### Adım 2: Virtual Environment Oluştur

```bash
python3 -m venv venv
```

### Adım 3: Virtual Environment'ı Aktif Et

```bash
source venv/bin/activate
```

**Not:** Her yeni terminal açtığında bu komutu çalıştırman gerekiyor!

### Adım 4: Kütüphaneleri Kur

```bash
pip install -r requirements.txt
```

### Adım 5: Environment Variable Ayarla

```bash
export SPORTMONKS_API_TOKEN="your_token_here"
```

**Not:** Bu token'ı Vercel environment variables'dan alabilirsin.

### Adım 6: Servisi Başlat

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

## ✅ Servisin Çalıştığını Kontrol Et

Yeni bir terminal aç ve:

```bash
curl http://localhost:5000/health
```

**Beklenen Yanıt:**
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

## 🔧 Sorun Giderme

### Problem: "ModuleNotFoundError: No module named 'flask'"

**Çözüm:** Virtual environment aktif değil. `source venv/bin/activate` çalıştır.

### Problem: "Port 5000 already in use"

**Çözüm:** 
```bash
# Port'u değiştir
export PORT=5001
python api_server.py
```

Veya başka bir servisi durdur:
```bash
lsof -ti:5000 | xargs kill -9
```

### Problem: "SPORTMONKS_API_TOKEN not set"

**Çözüm:**
```bash
export SPORTMONKS_API_TOKEN="your_token_here"
```

Token'ı Vercel'den al:
1. Vercel Dashboard → Project → Settings → Environment Variables
2. `SPORTMONKS_API_KEY` değerini kopyala
3. Terminal'de `export SPORTMONKS_API_TOKEN="..."` çalıştır

### Problem: "soccerdata kurulumu başarısız"

**Çözüm:** 
```bash
# Önce gerekli sistem kütüphanelerini kur
brew install libxml2 libxslt  # macOS için

# Sonra tekrar dene
pip install soccerdata
```

## 🎯 Sonraki Adımlar

1. ✅ Servis çalışıyor mu? → `curl http://localhost:5000/health`
2. ✅ TypeScript'te test et → `/api/test-data-sources` endpoint'ini çağır
3. ✅ `hasSoccerData: true` görünüyor mu?

## 📝 Notlar

- Servis çalışırken terminal açık kalmalı
- Yeni terminal açtığında `source venv/bin/activate` çalıştır
- Production'da servisi background'da çalıştır (systemd, PM2, vb.)
