# 🔴 Canlı Skorlar Sayfası - Kurulum Rehberi

## 📁 Dosya Yapısı

Aşağıdaki dosyaları projenize ekleyin:

```
football-analytics-pro/
├── app/
│   ├── live/
│   │   └── page.tsx          ← Canlı skorlar sayfası
│   └── api/
│       └── livescores/
│           └── route.ts      ← API endpoint
├── components/
│   └── Navigation.tsx        ← Navigasyon komponenti (opsiyonel)
```

---

## 🚀 Kurulum Adımları

### 1. Dosyaları Kopyalayın

```bash
# app/live/page.tsx dosyasını oluşturun
mkdir -p app/live
# İçeriği page.tsx dosyasından kopyalayın

# app/api/livescores/route.ts dosyasını oluşturun
mkdir -p app/api/livescores
# İçeriği route.ts dosyasından kopyalayın
```

### 2. Environment Variable (Opsiyonel)

`.env.local` dosyanıza ekleyin:

```env
SPORTMONKS_API_KEY=LVhKgzwe2bZEyzoPQa5Sgz9oFpr9wN8Nvu4lpOJU65iwvOdKRoQ3shhvUPF5
```

### 3. Test Edin

```bash
npm run dev
# http://localhost:3000/live adresini açın
```

### 4. Deploy Edin

```bash
git add .
git commit -m "Add live scores page"
git push origin main
# Vercel otomatik deploy edecek
```

---

## 🎯 Özellikler

### Sayfa Özellikleri:
- ✅ **Otomatik Yenileme** - Her 30 saniyede güncelleme
- ✅ **Filtreler** - Tümü / Canlı / Başlayacak / Biten
- ✅ **Canlı Dakika** - Maç dakikası animasyonlu
- ✅ **Olay Akışı** - Goller, kartlar, değişiklikler
- ✅ **27 Lig** - Tüm takip edilen ligler
- ✅ **Responsive** - Mobil uyumlu tasarım

### API Endpoint:
```
GET /api/livescores
```

**Response:**
```json
{
  "success": true,
  "matches": [
    {
      "id": 19146701,
      "name": "Celtic vs Rangers",
      "league": "Scottish Premiership",
      "leagueId": 501,
      "homeTeam": "Celtic",
      "awayTeam": "Rangers",
      "homeScore": 2,
      "awayScore": 1,
      "status": "2. Yarı",
      "statusCode": 4,
      "minute": 67,
      "startTime": "2024-12-11T15:00:00",
      "events": [...],
      "venue": "Celtic Park"
    }
  ],
  "count": 15,
  "liveCount": 3,
  "timestamp": "2024-12-11T18:30:00.000Z"
}
```

---

## 🔧 Özelleştirme

### Yenileme Süresini Değiştirme:
```typescript
// app/live/page.tsx içinde
interval = setInterval(fetchLiveScores, 30000); // 30 saniye
// 15 saniyeye düşürmek için:
interval = setInterval(fetchLiveScores, 15000); // 15 saniye
```

### Yeni Lig Ekleme:
```typescript
// app/api/livescores/route.ts içinde
const TRACKED_LEAGUES = [
  181, 208, 244, 271, 8, 24, 9, 27, 1371, 301, 82, 387, 384, 390, 
  72, 444, 453, 462, 486, 501, 570, 567, 564, 573, 591, 600,
  // Yeni lig ID'si ekle:
  1234
];
```

### Lig Bayrağı Ekleme:
```typescript
// app/live/page.tsx içinde
const LEAGUE_FLAGS: { [key: number]: string } = {
  8: '🏴󠁧󠁢󠁥󠁮󠁧󠁿', // Premier League
  // Yeni lig:
  1234: '🇦🇷', // Argentine Liga
};
```

---

## 📱 Mobil Görünüm

Sayfa tamamen responsive tasarlanmıştır:
- 📱 Mobilde tek sütun görünüm
- 💻 Tablette/masaüstünde geniş görünüm
- 🎨 Dark mode tasarım

---

## ⚡ Performans İpuçları

1. **API Rate Limiting:** Sportmonks'ta saatlik limit var (3000/saat)
2. **Caching:** Next.js revalidate ile 30 saniye cache
3. **Error Handling:** API hatalarında kullanıcıya bilgi gösteriliyor

---

## 🔗 URL'ler

- **Canlı Skorlar:** `https://footballanalytics.pro/live`
- **API Endpoint:** `https://footballanalytics.pro/api/livescores`

---

## 📝 Notlar

- Maçlar başlamadan 15 dk önce livescores endpoint'inde görünür
- Maç bittikten 15 dk sonra livescores'dan kalkar
- Gün içinde maç yoksa fixtures/date endpoint'i kullanılır
