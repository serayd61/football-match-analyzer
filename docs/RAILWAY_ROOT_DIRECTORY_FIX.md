# Railway Root Directory Düzeltme

## 🔧 Sorun

Railway'da **Root Directory** `/` olarak ayarlı, ama dosyalarımız `src/lib/data-sources` klasöründe.

## ✅ Çözüm

### Railway Dashboard'da Ayarla

1. **Railway Dashboard:** https://railway.app/dashboard
2. **Service seç:** `footballanalytics-production-bb34`
3. **Settings** sekmesine git
4. **Source** bölümünde:
   - **Root Directory:** `/` yerine `src/lib/data-sources` yaz
   - **"Update"** butonuna tıkla

### Alternatif: Railway Config File

`railway.json` dosyasına root directory ekle:

```json
{
  "$schema": "https://railway.app/railway.schema.json",
  "build": {
    "builder": "DOCKERFILE",
    "dockerfilePath": "Dockerfile",
    "buildContext": "."
  },
  "deploy": {
    "startCommand": "python api_server.py",
    "restartPolicyType": "ON_FAILURE",
    "restartPolicyMaxRetries": 10
  },
  "rootDirectory": "src/lib/data-sources"
}
```

## 🚀 Sonraki Adımlar

1. ✅ Root directory'yi `src/lib/data-sources` olarak ayarla
2. ✅ Build cache'i temizle (Settings → Clear Build Cache)
3. ✅ Redeploy yap
4. ✅ Build logs'da `soccerdata==1.8.8` görünmeli

## 📝 Notlar

- Root directory ayarı Railway'ın hangi klasörden build yapacağını belirler
- Dockerfile ve requirements.txt `src/lib/data-sources` klasöründe olduğu için root directory de orada olmalı
- Değişiklikten sonra mutlaka redeploy yap
