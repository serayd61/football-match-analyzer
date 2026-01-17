# Hibrit Veri Sistemi Kullanım Kılavuzu

## 🚀 Hızlı Başlangıç

### TypeScript/Next.js Entegrasyonu

```typescript
import { getHybridDataManager } from '@/lib/data-sources/hybrid-manager';

// Manager oluştur
const manager = getHybridDataManager();

// Maç verileri al
const fixtures = await manager.getFixtures('premier-league', '2023-2024');

// Canlı skorlar
const liveScores = await manager.getLiveScores();

// xG verileri
const xgData = await manager.getXGData(fixtureId);

// Kapsamlı maç analizi
const analysis = await manager.getMatchAnalysis(
  'premier-league',
  '2023-2024',
  'Manchester City',
  'Arsenal',
  fixtureId
);
```

### API Endpoint Kullanımı

```bash
# Maç verileri
GET /api/hybrid-data?action=fixtures&league=premier-league&season=2023-2024

# Canlı skorlar
GET /api/hybrid-data?action=live

# xG verileri
GET /api/hybrid-data?action=xg&fixtureId=123456

# Maç analizi
GET /api/hybrid-data?action=analysis&league=premier-league&homeTeam=Man City&awayTeam=Arsenal&fixtureId=123456
```

## 📊 Veri Kaynakları

### Şu An Aktif

- ✅ **Sportmonks**: Canlı skorlar, maç verileri, xG (add-on ile)
- ✅ **Mevcut Sistem**: Sportmonks API entegrasyonu çalışıyor

### Gelecekte Eklenecek

- 🔜 **SoccerData (Python)**: Tarihsel veri, şut koordinatları, Elo ratings
- 🔜 **Fallback Mekanizması**: Sportmonks başarısız olursa SoccerData'ya geçiş

## 🐍 Python Script Kullanımı

Python script'i (`src/lib/data-sources/hybrid_pipeline.py`) ayrı bir servis olarak çalıştırılabilir:

### 1. Bağımlılıkları Kur

```bash
pip install soccerdata pandas pyarrow requests
```

### 2. Environment Variable

```bash
export SPORTMONKS_API_TOKEN="your_token_here"
```

### 3. Script'i Çalıştır

```bash
cd src/lib/data-sources
python hybrid_pipeline.py
```

### 4. API Servis Olarak (Gelecekte)

Python script'i Flask/FastAPI ile API servisi olarak çalıştırılabilir:

```python
# api_server.py (örnek)
from flask import Flask, jsonify
from hybrid_pipeline import HybridDataManager

app = Flask(__name__)
manager = HybridDataManager()

@app.route('/api/fixtures/<league>/<season>')
def get_fixtures(league, season):
    df = manager.get_fixtures(league, season)
    return jsonify(df.to_dict('records'))

if __name__ == '__main__':
    app.run(port=5000)
```

Sonra TypeScript'ten çağır:

```typescript
const response = await fetch('http://localhost:5000/api/fixtures/premier-league/2023-2024');
const fixtures = await response.json();
```

## 🔄 Mevcut Sistemle Entegrasyon

### Agent Analyzer'da Kullanım

```typescript
// src/lib/agent-analyzer/index.ts içinde

import { getHybridDataManager } from '@/lib/data-sources/hybrid-manager';

// Mevcut kod:
// let fullData = await fetchFullFixtureDataFromProvider(fixtureId, homeTeamId, awayTeamId);

// Hibrit sistem ile:
const manager = getHybridDataManager();
const analysis = await manager.getMatchAnalysis(
  league,
  season,
  homeTeamName,
  awayTeamName,
  fixtureId
);

// analysis.fixtures, analysis.xgData, analysis.liveData kullanılabilir
```

### Sportmonks Fallback

Mevcut sistem zaten Sportmonks kullanıyor. Hibrit sistem şu an sadece Sportmonks'u wrap ediyor, gelecekte SoccerData fallback eklenecek.

## 📈 Performans Optimizasyonu

### Cache Stratejisi

- **Canlı veri**: 30 saniye cache
- **Maç verileri**: 5 dakika cache
- **xG verileri**: 5 dakika cache
- **Tarihsel veri**: 24 saat cache (SoccerData için)

### Rate Limiting

- Sportmonks: 1 saniye delay (configurable)
- SoccerData: Kütüphane kendi rate limiting'i yapıyor

## 🎯 Kullanım Senaryoları

### Senaryo 1: Agent Analizi İçin Veri

```typescript
// Agent'lar için kapsamlı veri
const analysis = await manager.getMatchAnalysis(
  'premier-league',
  '2023-2024',
  'Man City',
  'Arsenal',
  fixtureId
);

// analysis.fixtures → Son maçlar
// analysis.xgData → xG verileri
// analysis.liveData → Canlı veri (varsa)
// analysis.eloRatings → Elo ratings (gelecekte)
```

### Senaryo 2: Canlı Skorlar

```typescript
// Canlı maçları göster
const liveScores = await manager.getLiveScores();
liveScores.forEach(match => {
  console.log(`${match.homeTeam} ${match.homeScore}-${match.awayScore} ${match.awayTeam}`);
});
```

### Senaryo 3: xG Analizi

```typescript
// Maç xG verileri
const xgData = await manager.getXGData(fixtureId);
if (xgData) {
  console.log(`Home xG: ${xgData.homeXG}, Away xG: ${xgData.awayXG}`);
}
```

## 🔮 Gelecek Geliştirmeler

1. **SoccerData Fallback**: Sportmonks başarısız olursa SoccerData'ya geçiş
2. **Python API Servisi**: Flask/FastAPI ile ayrı servis
3. **Şut Haritaları**: SoccerData'dan şut koordinatları
4. **Elo Ratings**: ClubElo'dan güncel Elo değerleri
5. **Tarihsel Bahis Oranları**: Football-Data.co.uk entegrasyonu

## 📝 Notlar

- Python script şu an sadece referans olarak saklanıyor
- TypeScript implementasyonu mevcut Sportmonks entegrasyonunu kullanıyor
- Gelecekte Python script'i ayrı bir servis olarak çalıştırılabilir
- Maliyet optimizasyonu için ücretsiz kaynaklar (SoccerData) öncelikli
