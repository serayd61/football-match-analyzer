# 🎯 Football Analytics Pro - Tahmin Kayıt Sistemi

Bu sistem tüm AI tahminlerini veritabanında saklar, sonuçları günceller ve doğruluk oranlarını takip eder.

## 📁 Dosya Yapısı

```
your-project/
├── prisma/
│   └── schema.prisma          # Veritabanı şeması
├── lib/
│   └── prediction-service.ts  # Veritabanı işlemleri
├── app/api/
│   ├── analyze/
│   │   └── route.ts           # Ana analiz API (cache ile)
│   ├── stats/
│   │   └── route.ts           # İstatistik API
│   └── update-results/
│       └── route.ts           # Sonuç güncelleme API
└── .env                       # Çevre değişkenleri
```

## 🚀 Kurulum

### 1. Paketleri Yükle

```bash
npm install @prisma/client
npm install -D prisma
```

### 2. Veritabanı Bağlantısı

`.env` dosyasına ekle:

```env
# Veritabanı (birini seç)
# Vercel Postgres
DATABASE_URL="postgres://..."

# Supabase
DATABASE_URL="postgresql://postgres:password@db.xxx.supabase.co:5432/postgres"

# Railway
DATABASE_URL="postgresql://postgres:password@containers-us-west-xxx.railway.app:5432/railway"

# Lokal (test için)
DATABASE_URL="postgresql://postgres:password@localhost:5432/football_analytics"
```

### 3. Prisma Ayarları

```bash
# Schema'yı kopyala
cp schema.prisma prisma/schema.prisma

# Client oluştur
npx prisma generate

# Veritabanı tablolarını oluştur
npx prisma db push

# (Opsiyonel) Prisma Studio ile görüntüle
npx prisma studio
```

### 4. Dosyaları Kopyala

```bash
# Servis dosyası
cp prediction-service.ts lib/prediction-service.ts

# API'ler
cp stats-route.ts app/api/stats/route.ts
cp update-results-route.ts app/api/update-results/route.ts

# analyze/route.ts'i güncelle (cache özelliği için)
```

## 📊 API Kullanımı

### 1. Tahmin Analizi (Cache ile)

```bash
POST /api/analyze
```

İstek:
```json
{
  "homeTeam": "West Bromwich Albion",
  "awayTeam": "Sheffield United",
  "homeTeamId": 10,
  "awayTeamId": 21,
  "league": "Championship",
  "matchDate": "2025-12-12",
  "language": "tr"
}
```

Yanıt (ilk istek - yeni analiz):
```json
{
  "success": true,
  "cached": false,
  "analysis": { ... },
  "predictionId": "clxxx..."
}
```

Yanıt (sonraki istek - cache'den):
```json
{
  "success": true,
  "cached": true,
  "analysis": { ... }
}
```

### 2. Sonuç Güncelleme (Manuel)

```bash
POST /api/update-results
```

İstek:
```json
{
  "homeTeamId": 10,
  "awayTeamId": 21,
  "matchDate": "2025-12-12",
  "homeGoals": 2,
  "awayGoals": 1
}
```

### 3. Otomatik Sonuç Güncelleme

```bash
PUT /api/update-results
```

Tüm bekleyen maçları Sportmonks'tan kontrol eder ve günceller.

### 4. İstatistikler

```bash
# Genel istatistikler
GET /api/stats?type=overall

# Lig bazlı istatistikler
GET /api/stats?type=leagues

# Bekleyen tahminler
GET /api/stats?type=pending

# Son tahminler
GET /api/stats?type=recent&limit=20
```

Örnek Yanıt:
```json
{
  "success": true,
  "data": {
    "overall": {
      "total": 150,
      "matchResult": { "correct": 98, "accuracy": "65.3" },
      "overUnder": { "correct": 105, "accuracy": "70.0" },
      "btts": { "correct": 92, "accuracy": "61.3" },
      "bestBet": { "correct": 110, "accuracy": "73.3" }
    },
    "aiPerformance": {
      "claude": {
        "total": 150,
        "matchAccuracy": "68.5",
        "goalsAccuracy": "72.1",
        "bttsAccuracy": "63.2"
      },
      "openai": { ... },
      "gemini": { ... },
      "perplexity": { ... }
    }
  }
}
```

## 🔄 n8n Otomasyon Workflow

### Günlük Sonuç Güncelleme

1. **Schedule Trigger**: Her gün 08:00 ve 20:00
2. **HTTP Request**: `PUT /api/update-results`
3. **IF Node**: Güncelleme varsa
4. **Telegram**: Günlük rapor gönder

```json
{
  "nodes": [
    {
      "name": "Schedule",
      "type": "n8n-nodes-base.scheduleTrigger",
      "parameters": {
        "rule": {
          "interval": [
            { "field": "hours", "hoursInterval": 12 }
          ]
        }
      }
    },
    {
      "name": "Update Results",
      "type": "n8n-nodes-base.httpRequest",
      "parameters": {
        "method": "PUT",
        "url": "https://your-site.com/api/update-results"
      }
    },
    {
      "name": "Send Report",
      "type": "n8n-nodes-base.telegram",
      "parameters": {
        "text": "📊 Günlük Rapor\n\nGüncellenen: {{ $json.updated }}\nBaşarı: {{ $json.details }}"
      }
    }
  ]
}
```

## 📈 Veritabanı Görünümü

### Prisma Studio

```bash
npx prisma studio
```

Bu komut tarayıcıda veritabanını görsel olarak açar:
- Tüm tahminleri görüntüle
- Sonuçları manuel düzenle
- Filtreleme ve arama

### SQL Sorguları (Opsiyonel)

```sql
-- En başarılı tahminler
SELECT 
  homeTeam || ' vs ' || awayTeam as match,
  matchResultPrediction,
  matchResultCorrect,
  actualHomeGoals || '-' || actualAwayGoals as score
FROM Prediction
WHERE status = 'completed' AND matchResultCorrect = true
ORDER BY matchDate DESC
LIMIT 20;

-- AI Performans Karşılaştırması
SELECT 
  COUNT(*) as total,
  SUM(CASE WHEN claudeMatchCorrect THEN 1 ELSE 0 END) as claude_correct,
  SUM(CASE WHEN openaiMatchCorrect THEN 1 ELSE 0 END) as openai_correct,
  SUM(CASE WHEN geminiMatchCorrect THEN 1 ELSE 0 END) as gemini_correct
FROM Prediction
WHERE status = 'completed';
```

## 🎯 Önemli Notlar

### Cache Süresi
- Aynı gün içindeki aynı maç için cache kullanılır
- Maç tarihi değişirse yeni analiz yapılır

### Sonuç Güncelleme
- Sportmonks `state_id = 5` (Finished) olunca güncellenir
- Ertelenen maçlar `status = 'postponed'` olarak işaretlenir

### API Rate Limiting
- Sportmonks: 3000 istek/saat (European Plan)
- Otomatik güncelleme her istek arası 200ms bekler

## 🐛 Troubleshooting

### "Prisma client not generated"
```bash
npx prisma generate
```

### "Table does not exist"
```bash
npx prisma db push
```

### "Unique constraint violation"
Bu normal - aynı maç zaten analiz edilmiş, cache'den dönecek.

## 📞 Destek

Sorularınız için: [GitHub Issues](https://github.com/your-repo/issues)
