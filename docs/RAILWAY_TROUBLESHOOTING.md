# Railway Troubleshooting

## 🔧 502 Bad Gateway Hatası

Eğer health check `502 Bad Gateway` veriyorsa:

### 1. Railway Logs Kontrol Et

1. **Railway Dashboard → Service → Deployments**
2. **En son deployment'a tıkla**
3. **"Deploy Logs"** sekmesine git
4. Hata mesajlarını kontrol et

### 2. Olası Sorunlar

#### Sorun 1: Servis Henüz Başlamadı

**Çözüm:** Birkaç saniye bekleyip tekrar dene.

#### Sorun 2: Port Yanlış

**Kontrol:** Settings → Deploy → Start Command
- **Değer:** `python api_server.py` olmalı

**Kontrol:** Environment Variables
- **PORT:** `5000` olmalı (veya boş bırakılabilir, default 5000)

#### Sorun 3: Environment Variables Eksik

**Kontrol:** Settings → Variables
- **SPORTMONKS_API_TOKEN:** Vercel'den al ve ekle
- **PORT:** `5000` (opsiyonel)

#### Sorun 4: Python Servisi Crash Oluyor

**Kontrol:** Deploy Logs'da hata mesajı var mı?

**Olası nedenler:**
- `soccerdata` kurulumu başarısız
- `SPORTMONKS_API_TOKEN` eksik veya yanlış
- Port zaten kullanımda

### 3. Manuel Test

Railway CLI ile test et:

```bash
railway logs
railway status
```

### 4. Servisi Yeniden Başlat

1. **Railway Dashboard → Deployments**
2. **"Redeploy"** butonuna tıkla

## ✅ Başarı Kriterleri

Health check başarılı olduğunda:

```bash
curl https://footballanalytics-production-bb34.up.railway.app/health
```

**Beklenen:**
```json
{
  "status": "ok",
  "soccerdata": "available",
  "sportmonks": "available"
}
```

## 📝 Notlar

- Deploy başarılı olabilir ama servis başlaması birkaç saniye sürebilir
- Health check endpoint: `/health`
- Port: `5000` (default)
- Start command: `python api_server.py`
