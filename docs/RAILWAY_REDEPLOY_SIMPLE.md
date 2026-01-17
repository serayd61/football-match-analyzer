# Railway Redeploy - Basit Kılavuz

## 🚀 Root Directory Ayarlama ve Redeploy

### Adım 1: Root Directory Ayarla

1. **Railway Dashboard:** https://railway.app/dashboard
2. **Service seç:** `footballanalytics-production-bb34`
3. **Settings** sekmesine git
4. **Source** bölümünde:
   - **Root Directory:** `/` yerine `src/lib/data-sources` yaz
   - **"Update"** butonuna tıkla

### Adım 2: Redeploy

**Yöntem 1: Dashboard'dan (Önerilen)**

1. **Deployments** sekmesine git
2. **"Redeploy"** butonuna tıkla
3. Veya **"Deploy"** butonuna tıkla

**Yöntem 2: Yeni Commit Push Et**

Eğer GitHub repo bağlıysa, herhangi bir değişiklik push et:

```bash
git commit --allow-empty -m "trigger: Railway redeploy"
git push
```

**Yöntem 3: Railway CLI**

```bash
cd src/lib/data-sources
railway redeploy
```

## 📝 Notlar

- **Build Cache:** Redeploy yapınca otomatik temizlenir, ayrıca temizlemeye gerek yok
- **Root Directory:** Sadece Settings → Source'dan ayarlanır
- **GitHub Bağlantısı:** Otomatik deploy için GitHub repo bağlı olmalı

## ✅ Kontrol

Build logs'da şunları görmelisin:

```
=== PWD ===
/app
=== LS ===
-rw-r--r-- requirements.txt  ← Dosya görünmeli!
=== requirements.txt içeriği ===
flask==3.0.0
soccerdata==1.8.8  ← İçerik görünmeli!
```

## 🔍 Eğer Hala Çalışmıyorsa

1. **Settings → Source** → Root Directory'nin `src/lib/data-sources` olduğunu kontrol et
2. **GitHub repo bağlı mı** kontrol et (Settings → Source)
3. **Yeni bir commit push et** (boş commit bile olur)
4. **Build logs'u kontrol et** (Deployments → Build Logs)
