# Railway Security Vulnerability Düzeltme

## 🔧 Sorun

Railway, proje root'undaki Next.js güvenlik açığını tespit ediyor ve deploy'u engelliyor. Ama Python servisi için Next.js gerekli değil.

## ✅ Çözüm

### Yöntem 1: Root Directory + .dockerignore (Önerilen)

1. **Railway Dashboard → Settings → Source**
2. **Root Directory:** `src/lib/data-sources` olarak ayarla
3. **.dockerignore** dosyası Next.js dosyalarını ignore ediyor
4. **Redeploy** yap

### Yöntem 2: Next.js'i Güncelle (Alternatif)

Eğer root directory ayarlanamıyorsa:

```bash
cd /path/to/project/root
npm install next@^14.2.35
git add package.json package-lock.json
git commit -m "fix: Next.js güvenlik açığı güncellendi"
git push
```

## 🎯 Önerilen: Root Directory Ayarla

Python servisi için sadece `src/lib/data-sources` klasörü gerekli:

1. **Railway Dashboard → Settings → Source**
2. **Root Directory:** `src/lib/data-sources`
3. **Update** butonuna tıkla
4. **Redeploy** yap

Bu şekilde Railway sadece Python dosyalarını görür, Next.js dosyalarını görmez.

## 📝 Notlar

- `.dockerignore` dosyası Next.js dosyalarını ignore ediyor
- Root directory `src/lib/data-sources` olarak ayarlanmalı
- Python servisi Next.js'e bağımlı değil
