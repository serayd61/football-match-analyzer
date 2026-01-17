# Veri Kaynağı Kontrol Kılavuzu

## 🔍 SoccerData'dan Veri Gelip Gelmediğini Kontrol Etme

### Yöntem 1: API Test Endpoint'i

#### Tüm Veri Kaynaklarını Test Et

```bash
# Tüm testleri çalıştır
curl "https://footballanalytics.pro/api/test-data-sources?league=premier-league&season=2023-2024&test=all"

# Sadece fixtures test et
curl "https://footballanalytics.pro/api/test-data-sources?league=premier-league&test=fixtures"
```

**Yanıt Örneği:**
```json
{
  "success": true,
  "timestamp": "2026-01-12T10:00:00.000Z",
  "league": "premier-league",
  "season": "2023-2024",
  "tests": {
    "fixtures": {
      "success": true,
      "count": 380,
      "sources": ["sportmonks"],  // ← Burada "soccerdata" görünmeli
      "hasSoccerData": false,      // ← true olmalı
      "hasSportmonks": true,
      "sample": [
        {
          "fixtureId": 123456,
          "homeTeam": "Arsenal",
          "awayTeam": "Chelsea",
          "source": "sportmonks"  // ← "soccerdata" olmalı
        }
      ]
    }
  },
  "summary": {
    "soccerDataAvailable": false,  // ← true olmalı
    "sportmonksAvailable": true,
    "recommendation": "SoccerData requires Python script integration."
  }
}
```

#### Python Servisini Test Et

```bash
# Python servisinin çalışıp çalışmadığını kontrol et
curl "https://footballanalytics.pro/api/test-soccerdata?url=http://localhost:5000"
```

### Yöntem 2: Hybrid Data Manager Log'ları

TypeScript kodunda veri kaynağı log'lanıyor:

```typescript
// src/lib/data-sources/hybrid-manager.ts içinde
console.log(`📊 Data source: ${fixture.source}`);
```

**Kontrol:**
- Browser console'da veya Vercel log'larında `source: "soccerdata"` görünmeli
- Eğer sadece `source: "sportmonks"` görünüyorsa, SoccerData entegrasyonu aktif değil

### Yöntem 3: Veritabanı Kontrolü

`unified_analysis` tablosunda veri kaynağı bilgisi saklanıyor mu kontrol et:

```sql
-- Supabase SQL Editor'de çalıştır
SELECT 
  league,
  COUNT(*) as total_analyses,
  -- Eğer source kolonu varsa:
  -- COUNT(*) FILTER (WHERE source = 'soccerdata') as soccerdata_count,
  -- COUNT(*) FILTER (WHERE source = 'sportmonks') as sportmonks_count
FROM unified_analysis
WHERE league = 'Premier League'
GROUP BY league;
```

### Yöntem 4: Python Script'i Manuel Test Et

```bash
# Terminal'de Python script'i çalıştır
cd src/lib/data-sources
python hybrid_pipeline.py
```

**Beklenen Çıktı:**
```
📊 Veri Kaynakları:
 SoccerData: ✅ Aktif
 Sportmonks: ✅ Aktif (Token gerekli)

============================================================
1. MAÇ VERİLERİ (SoccerData öncelikli)
============================================================
Toplam maç: 380
```

### Yöntem 5: API Response'da Source Kontrolü

```typescript
// Frontend'de
const response = await fetch('/api/hybrid-data?action=fixtures&league=premier-league');
const data = await response.json();

console.log('Data sources:', data.sources);
// Eğer SoccerData aktifse: ["soccerdata", "sportmonks"]
// Eğer sadece Sportmonks varsa: ["sportmonks"]
```

## 🐍 Python Script'i Servis Olarak Çalıştırma

### Adım 1: Flask Servisi Oluştur

`src/lib/data-sources/api_server.py` dosyası oluştur:

```python
from flask import Flask, jsonify
from flask_cors import CORS
from hybrid_pipeline import HybridDataManager

app = Flask(__name__)
CORS(app)  # CORS hatası önlemek için

manager = HybridDataManager()

@app.route('/health')
def health():
    return jsonify({'status': 'ok', 'service': 'soccerdata-api'})

@app.route('/api/fixtures/<league>/<season>')
def get_fixtures(league, season):
    df = manager.get_fixtures(league, season)
    return jsonify(df.to_dict('records'))

@app.route('/api/xg/<league>/<season>')
def get_xg(league, season):
    df = manager.get_xg_data(league, season)
    return jsonify(df.to_dict('records'))

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=True)
```

### Adım 2: Servisi Başlat

```bash
cd src/lib/data-sources
pip install flask flask-cors
python api_server.py
```

### Adım 3: TypeScript'te Kullan

```typescript
// src/lib/data-sources/hybrid-manager.ts içinde
async getFixtures(league: string, season: string): Promise<HybridFixture[]> {
  // Önce Python servisini dene
  try {
    const response = await fetch(`http://localhost:5000/api/fixtures/${league}/${season}`);
    if (response.ok) {
      const data = await response.json();
      return data.map((f: any) => ({
        ...f,
        source: 'soccerdata'
      }));
    }
  } catch (error) {
    console.log('⚠️ Python service not available, falling back to Sportmonks');
  }
  
  // Fallback: Sportmonks
  return this.getFixturesFromSportmonks(league);
}
```

## ✅ Kontrol Listesi

- [ ] Python script çalışıyor mu? (`python hybrid_pipeline.py`)
- [ ] Python servisi çalışıyor mu? (`curl http://localhost:5000/health`)
- [ ] TypeScript'te Python servisi çağrılıyor mu?
- [ ] API response'da `source: "soccerdata"` görünüyor mu?
- [ ] Log'larda SoccerData kaynaklı veri var mı?
- [ ] Veritabanında source bilgisi saklanıyor mu?

## 🔧 Sorun Giderme

### Problem: SoccerData verisi gelmiyor

**Çözüm 1:** Python script'i çalıştır
```bash
cd src/lib/data-sources
python hybrid_pipeline.py
```

**Çözüm 2:** Python servisi başlat
```bash
python api_server.py
```

**Çözüm 3:** TypeScript'te Python servisi entegrasyonunu kontrol et
- `hybrid-manager.ts` dosyasında Python servisi çağrısı var mı?
- Environment variable'lar doğru mu?

### Problem: Sadece Sportmonks verisi geliyor

**Neden:** SoccerData fallback henüz aktif değil veya Python servisi çalışmıyor.

**Çözüm:** 
1. Python servisini başlat
2. `hybrid-manager.ts`'te Python servisi çağrısını ekle
3. Fallback mekanizmasını test et

## 📊 Veri Kaynağı Öncelik Sırası

1. **SoccerData** (Python servisi) - Tarihsel veri için öncelikli
2. **Sportmonks** - Canlı veri ve fallback
3. **Cache** - Daha önce çekilmiş veriler

## 🎯 Hızlı Test

```bash
# 1. Python servisini test et
curl http://localhost:5000/health

# 2. Fixtures test et
curl "http://localhost:5000/api/fixtures/premier-league/2023-2024"

# 3. TypeScript API'den test et
curl "https://footballanalytics.pro/api/test-data-sources?test=fixtures"

# 4. Response'da source kontrolü
# Eğer "soccerdata" görünüyorsa ✅
# Eğer sadece "sportmonks" görünüyorsa ❌
```
