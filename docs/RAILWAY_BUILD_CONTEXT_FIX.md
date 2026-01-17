# Railway Build Context Sorunu - Çözüm

## 🔧 Sorun

Build log'da `requirements.txt` içeriği görünmüyor:
```
=== Son ===
```

Bu, Railway'ın build context'inin yanlış olduğu anlamına geliyor.

## ✅ Çözüm

### Railway Dashboard'da Kontrol Et

1. **Settings → Build** sekmesine git
2. **Builder** bölümünde:
   - **"Dockerfile"** seçili olmalı
   - Veya **"Default"** (Railway otomatik algılamalı)

3. **Build Command** bölümünde:
   - **Boş bırak** (Dockerfile kullanıyorsak gerekli değil)

### Root Directory Kontrolü

1. **Settings → Source** sekmesine git
2. **Root Directory:** `src/lib/data-sources` olmalı ✅
3. Eğer farklıysa, düzelt ve **"Update"** tıkla

### Alternatif: Railway Config File

`railway.json` dosyası şöyle olmalı:

```json
{
  "$schema": "https://railway.app/railway.schema.json",
  "build": {
    "builder": "DOCKERFILE",
    "dockerfilePath": "Dockerfile"
  },
  "deploy": {
    "startCommand": "python api_server.py",
    "restartPolicyType": "ON_FAILURE",
    "restartPolicyMaxRetries": 10
  }
}
```

**Not:** `buildContext` ve `rootDirectory` kaldırıldı - Railway Dashboard'dan ayarlanmalı.

## 🚀 Redeploy

1. **Deployments** sekmesine git
2. **"Redeploy"** butonuna tıkla
3. Build logs'u kontrol et

## ✅ Beklenen Sonuç

Build logs'da şunları görmelisin:

```
=== PWD ===
/app
=== LS ===
-rw-r--r-- requirements.txt  ← Dosya görünmeli!
=== requirements.txt varlık kontrolü ===
-rw-r--r-- 1 root root 96 Jan 17 20:00 requirements.txt
=== requirements.txt içeriği ===
flask==3.0.0
flask-cors==4.0.0
pandas==2.1.4
pyarrow==14.0.1
requests==2.31.0
soccerdata==1.8.8
=== Dosya boyutu (satır sayısı) ===
6 requirements.txt
=== Dosya boyutu (byte) ===
96 requirements.txt
=== Son ===
```

## 🔍 Eğer Hala Çalışmıyorsa

1. **Settings → Source** → Root Directory'nin `src/lib/data-sources` olduğunu kontrol et
2. **Settings → Build** → Builder'ın "Dockerfile" olduğunu kontrol et
3. **GitHub repo bağlı mı** kontrol et (Settings → Source)
4. **Yeni bir commit push et** (boş commit bile olur)
5. **Build logs'u kontrol et** (Deployments → Build Logs)

## 📝 Notlar

- Root Directory Railway Dashboard'dan ayarlanmalı
- `railway.json` dosyası sadece referans içindir
- Build context otomatik olarak root directory'ye göre ayarlanır
