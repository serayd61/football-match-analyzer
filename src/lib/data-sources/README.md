# Python Data Service

## 🚀 Hızlı Başlatma

```bash
# 1. Klasöre git
cd src/lib/data-sources

# 2. Script'i çalıştır (ilk seferde virtual env oluşturur)
./start_server.sh
```

## 📋 Manuel Başlatma

```bash
# 1. Virtual environment aktif et
source venv/bin/activate

# 2. Environment variable ayarla (Vercel'den al)
export SPORTMONKS_API_TOKEN="your_token_here"

# 3. Servisi başlat
python api_server.py
```

## ✅ Kontrol

```bash
# Health check
curl http://localhost:5000/health

# Fixtures test
curl "http://localhost:5000/api/fixtures/premier-league/2023-2024"
```

## 🔧 Sorun Giderme

- **Port 5000 kullanımda:** `export PORT=5001` ve tekrar başlat
- **Module not found:** `source venv/bin/activate` çalıştır
- **Token hatası:** `export SPORTMONKS_API_TOKEN="..."` ayarla

## 📚 Detaylı Dokümantasyon

- `docs/PYTHON_SERVICE_QUICKSTART.md` - Adım adım kılavuz
- `docs/PYTHON_SERVICE_SETUP.md` - Detaylı kurulum
