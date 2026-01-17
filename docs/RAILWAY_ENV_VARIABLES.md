# Railway Environment Variables Kurulumu

## 🎯 Python Servisi İçin Gerekli Variables

Python servisi için **sadece 2 variable** gerekli:

### 1. SPORTMONKS_API_TOKEN (Zorunlu)

**Name:** `SPORTMONKS_API_TOKEN`  
**Value:** Vercel'den al (SPORTMONKS_API_KEY ile aynı)  
**Açıklama:** Sportmonks API token'ı

**Nereden al:**
- Vercel Dashboard → Project → Settings → Environment Variables
- `SPORTMONKS_API_KEY` değerini kopyala

### 2. PORT (Opsiyonel)

**Name:** `PORT`  
**Value:** `5000` (default)  
**Açıklama:** Python servisinin çalışacağı port

## ❌ Gereksiz Variables

Python servisi için **gerekli olmayan** variables (bunları ekleme):

- ❌ `PUBLIC_URL` - Python servisi için gerekli değil
- ❌ `SPORTMONKS_API_KEY` - `SPORTMONKS_API_TOKEN` yeterli
- ❌ `PYTHON_DATA_SERVICE_URL` - Bu Vercel'de kullanılacak, Railway'da değil
- ❌ `FOOTBALL_DATA_API_KEY` - Python servisi kullanmıyor
- ❌ `OPENAI_API_KEY` - Python servisi kullanmıyor
- ❌ `ANTHROPIC_API_KEY` - Python servisi kullanmıyor
- ❌ `GEMINI_API_KEY` - Python servisi kullanmıyor
- ❌ `PERPLEXITY_API_KEY` - Python servisi kullanmıyor
- ❌ `HEURIST_API_KEY` - Python servisi kullanmıyor
- ❌ `NEXT_PUBLIC_SUPABASE_URL` - Next.js için, Python servisi için değil
- ❌ `NEXT_PUBLIC_SUPABASE_ANON_KEY` - Next.js için
- ❌ `SUPABASE_SERVICE_ROLE_KEY` - Next.js için
- ❌ `NEXTAUTH_SECRET` - Next.js için
- ❌ `NEXTAUTH_URL` - Next.js için
- ❌ `STRIPE_SECRET_KEY` - Next.js için
- ❌ `STRIPE_WEBHOOK_SECRET` - Next.js için
- ❌ `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` - Next.js için

## 📋 Railway'da Eklenecek Variables

### Adım 1: Railway Dashboard

1. **Railway Dashboard:** https://railway.app/dashboard
2. **Service seç:** `footballanalytics-production-bb34`
3. **Variables** sekmesine git

### Adım 2: Sadece Bu İkisini Ekle

#### Variable 1: SPORTMONKS_API_TOKEN

1. **"New Variable"** butonuna tıkla
2. **Name:** `SPORTMONKS_API_TOKEN`
3. **Value:** Vercel'den `SPORTMONKS_API_KEY` değerini kopyala ve yapıştır
4. **Save**

#### Variable 2: PORT (Opsiyonel)

1. **"New Variable"** butonuna tıkla
2. **Name:** `PORT`
3. **Value:** `5000`
4. **Save**

## ✅ Kontrol

Deploy sonrası deploy logs'da şunu görmelisin:

```
📊 SoccerData: ✅ Available
📊 Sportmonks: ✅ Available  ← Bu görünmeli!
```

Eğer `Sportmonks: ❌ Not available` görünüyorsa, `SPORTMONKS_API_TOKEN` yanlış veya eksik.

## 🔍 Vercel'de Eklenecek Variable

**Not:** `PYTHON_DATA_SERVICE_URL` Railway'da değil, **Vercel'de** eklenmeli!

Vercel Dashboard → Settings → Environment Variables:
- **Name:** `PYTHON_DATA_SERVICE_URL`
- **Value:** `https://footballanalytics-production-bb34.up.railway.app`

## 📝 Özet

**Railway'da:**
- ✅ `SPORTMONKS_API_TOKEN` (Vercel'den al)
- ✅ `PORT=5000` (opsiyonel)

**Vercel'de:**
- ✅ `PYTHON_DATA_SERVICE_URL` (Railway URL'i)

**Diğerleri:** Gereksiz, ekleme!
