# Railway Redeploy Kılavuzu

## 🔧 Versiyon Hatası Düzeltildi

`soccerdata==2.3.0` versiyonu mevcut değil, `1.8.8` olarak güncellendi.

## 🚀 Redeploy Yap

### Yöntem 1: Railway Dashboard (Önerilen)

1. **Railway Dashboard:** https://railway.app/dashboard
2. **Service seç:** `footballanalytics-production-bb34`
3. **Deployments** sekmesine git
4. **"Redeploy"** butonuna tıkla
5. **"Redeploy"** onayla

### Yöntem 2: Railway CLI

```bash
cd src/lib/data-sources
railway link
railway redeploy
```

### Yöntem 3: Git Push (Otomatik)

Eğer Railway GitHub'a bağlıysa:
```bash
git push
```
Railway otomatik olarak yeni deploy başlatır.

## ✅ Deploy Sonrası Kontrol

### 1. Build Logs Kontrol Et

Railway Dashboard → Deployments → En son deploy → Build Logs

**Beklenen:**
```
Successfully installed flask flask-cors pandas pyarrow requests soccerdata-1.8.8
```

### 2. Deploy Logs Kontrol Et

Railway Dashboard → Deployments → En son deploy → Deploy Logs

**Beklenen:**
```
🚀 Starting SoccerData API server on port 5000
📊 SoccerData: ✅ Available
📊 Sportmonks: ✅ Available
 * Running on http://0.0.0.0:5000
```

### 3. Health Check

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

## 🔍 Sorun Giderme

### Problem: Hala build hatası

**Çözüm:**
1. Build logs'u kontrol et
2. `requirements.txt` doğru mu kontrol et
3. Railway cache'i temizle (Settings → Clear Build Cache)

### Problem: Deploy başarısız

**Çözüm:**
1. Deploy logs'u kontrol et
2. Environment variables doğru mu kontrol et
3. Port 5000 kullanılabilir mi kontrol et

### Problem: Health check başarısız

**Çözüm:**
1. Deploy logs'u kontrol et
2. Servis başlamış mı kontrol et
3. Environment variables (SPORTMONKS_API_TOKEN) doğru mu kontrol et

## 📝 Notlar

- Deploy genellikle 2-5 dakika sürer
- Build cache temizlenmesi gerekebilir
- Environment variables deploy sırasında kullanılır
