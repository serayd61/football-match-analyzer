# Railway Root Directory Sorunu - Detaylı Çözüm

## 🔧 Sorun

Build log'da `requirements.txt` içeriği görünmüyor:
```
=== requirements.txt içeriği ===
=== Son ===
```

Bu, Railway'ın root directory'yi doğru ayarlamadığı anlamına geliyor.

## ✅ Çözüm Adımları

### Adım 1: Railway Dashboard'da Root Directory Ayarla

1. **Railway Dashboard:** https://railway.app/dashboard
2. **Service seç:** `footballanalytics-production-bb34`
3. **Settings** sekmesine git
4. **Source** bölümünde:
   - **Root Directory:** `/` yerine `src/lib/data-sources` yaz
   - **"Update"** butonuna tıkla

### Adım 2: Build Cache'i Temizle

1. **Settings** sekmesinde
2. **"Clear Build Cache"** butonuna tıkla
3. Onayla

### Adım 3: Redeploy

1. **Deployments** sekmesine git
2. **"Redeploy"** butonuna tıkla
3. Veya yeni bir commit push et

## 🔍 Kontrol

Build logs'da şunları görmelisin:

```
=== PWD ===
/app
=== LS ===
total 20
-rw-r--r-- 1 root root  123 Jan 17 20:00 api_server.py
-rw-r--r-- 1 root root  456 Jan 17 20:00 hybrid_pipeline.py
-rw-r--r-- 1 root root  123 Jan 17 20:00 requirements.txt
=== requirements.txt içeriği ===
flask==3.0.0
flask-cors==4.0.0
pandas==2.1.4
pyarrow==14.0.1
requests==2.31.0
soccerdata==1.8.8
=== Dosya boyutu ===
6 requirements.txt
=== Son ===
```

## ⚠️ Eğer Hala Çalışmıyorsa

### Alternatif 1: GitHub Repo Bağlantısını Kontrol Et

1. **Settings → Source**
2. **Repository** bağlı mı kontrol et
3. Eğer bağlı değilse:
   - **"Connect Repo"** butonuna tıkla
   - GitHub hesabını bağla
   - Repository seç: `football-match-analyzer`
   - Branch: `main`
   - **Root Directory:** `src/lib/data-sources`
   - **"Connect"** butonuna tıkla

### Alternatif 2: Railway.json'ı Kontrol Et

`src/lib/data-sources/railway.json` dosyası şöyle olmalı:

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

**Not:** `railway.json` dosyası root directory'yi otomatik ayarlamaz, sadece Railway Dashboard'dan ayarlanır.

### Alternatif 3: Manuel Dosya Kontrolü

Eğer hala çalışmıyorsa, Railway CLI ile kontrol et:

```bash
cd src/lib/data-sources
railway status
railway logs
```

## 📝 Önemli Notlar

1. **Root Directory** Railway Dashboard'dan **manuel** ayarlanmalı
2. `railway.json` dosyası sadece referans içindir
3. Build cache temizlenmeli
4. GitHub repo bağlantısı olmalı (otomatik deploy için)

## ✅ Başarı Kriterleri

Build başarılı olduğunda:
- ✅ `requirements.txt` içeriği görünür
- ✅ `soccerdata==1.8.8` kurulur
- ✅ `flask`, `pandas` vb. kurulur
- ✅ Health check başarılı olur
- ✅ Service çalışır ve public URL'den erişilebilir
