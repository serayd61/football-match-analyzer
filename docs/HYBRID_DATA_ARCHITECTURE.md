# Hibrit Veri Sistemi Mimarisi

## 🏗️ Sistem Yapısı

```
┌─────────────────────────────────────────────────────────────────┐
│                    HybridDataManager                             │
│                   (Akıllı Veri Yöneticisi)                       │
└─────────────────────────────────────────────────────────────────┘
                              │
              ┌───────────────┴───────────────┐
              ▼                               ▼
┌─────────────────────────┐     ┌─────────────────────────┐
│      SoccerData         │     │      Sportmonks         │
│      (Ücretsiz)         │     │      (Ücretli)          │
│                         │     │                         │
│  ┌─────────────────┐    │     │  ┌─────────────────┐    │
│  │     FBref       │    │     │  │   Live API      │    │
│  │  - İstatistik   │    │     │  │  - Canlı skor   │    │
│  │  - Pas/Şut      │    │     │  │  - Canlı olay   │    │
│  └─────────────────┘    │     │  └─────────────────┘    │
│                         │     │                         │
│  ┌─────────────────┐    │     │  ┌─────────────────┐    │
│  │   Understat     │    │     │  │   Fixtures      │    │
│  │  - xG verileri  │    │     │  │  - 2500+ lig    │    │
│  │  - Şut (x,y) ⭐ │    │     │  │  - Güvenilir    │    │
│  └─────────────────┘    │     │  └─────────────────┘    │
│                         │     │                         │
│  ┌─────────────────┐    │     │  ┌─────────────────┐    │
│  │ Football-Data   │    │     │  │    xG API       │    │
│  │  - Bahis oran   │    │     │  │  - Canlı xG     │    │
│  │  - Tarihsel     │    │     │  │  - (Add-on)     │    │
│  └─────────────────┘    │     │  └─────────────────┘    │
│                         │     │                         │
│  ┌─────────────────┐    │     │  ┌─────────────────┐    │
│  │    ClubElo      │    │     │  │  Predictions    │    │
│  │  - Elo rating ⭐│    │     │  │  - AI tahmin    │    │
│  └─────────────────┘    │     │  │  - (Add-on)     │    │
└─────────────────────────┘     └─────────────────────────┘

⭐ = Sadece bu kaynakta mevcut
```

## 📊 Veri Akışı Stratejisi

```
┌──────────────────────────────────────────────────────────────┐
│                      VERİ İSTEĞİ                              │
└──────────────────────────────────────────────────────────────┘
                              │
                              ▼
                    ┌─────────────────┐
                    │  Veri Türü Ne?  │
                    └─────────────────┘
                              │
        ┌─────────┬───────────┼───────────┬─────────┐
        ▼         ▼           ▼           ▼         ▼
   ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐
   │ Canlı  │ │Tarihsel│ │  xG    │ │  Şut   │ │  Elo   │
   │ Skor   │ │ Veri   │ │ Veri   │ │ Koord. │ │Rating  │
   └────────┘ └────────┘ └────────┘ └────────┘ └────────┘
        │         │           │           │         │
        ▼         ▼           ▼           ▼         ▼
   ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐
   │SPORT-  │ │SOCCER- │ │ HER    │ │SOCCER- │ │SOCCER- │
   │MONKS   │ │ DATA   │ │ İKİSİ  │ │ DATA   │ │ DATA   │
   │ ONLY   │ │ FIRST  │ │        │ │ ONLY   │ │ ONLY   │
   └────────┘ └────────┘ └────────┘ └────────┘ └────────┘
```

## 🎯 Hangi Veri Nereden?

| Veri Türü | Birincil Kaynak | Yedek Kaynak | Neden? |
|-----------|-----------------|--------------|--------|
| **Canlı Skorlar** | Sportmonks | ❌ Yok | SoccerData canlı desteklemiyor |
| **Tarihsel Maçlar** | SoccerData | Sportmonks | Ücretsiz + Yeterli |
| **Takım İstatistik** | SoccerData | Sportmonks | FBref çok detaylı |
| **xG (maç)** | SoccerData | Sportmonks | Understat ücretsiz |
| **xG (canlı)** | Sportmonks | ❌ Yok | SoccerData canlı yok |
| **Şut Koordinatları** | SoccerData | ❌ Yok | Sportmonks vermiyor! |
| **Bahis Oranları** | SoccerData | Sportmonks | Football-Data ücretsiz |
| **Canlı Oranlar** | Sportmonks | ❌ Yok | SoccerData canlı yok |
| **Elo Ratings** | SoccerData | ❌ Yok | ClubElo sadece burada |
| **2500+ Lig** | Sportmonks | ❌ Yok | SoccerData ~50 lig |

## 💡 Kullanım Senaryoları

### Senaryo 1: FootballAnalytics.pro - Tahmin Modeli
```
1. Model Eğitimi (Offline)
   └── SoccerData kullan (ücretsiz, tarihsel veri bol)
       ├── FBref → Takım/oyuncu istatistikleri
       ├── Understat → xG verileri
       ├── Football-Data → Tarihsel bahis oranları
       └── ClubElo → Takım güç endeksi

2. Canlı Tahmin (Production)
   └── Sportmonks kullan (güvenilir, hızlı)
       ├── Live API → Güncel maç bilgisi
       └── Fixtures → Upcoming maçlar
```

### Senaryo 2: Shot Map Visualization
```
SoccerData ZORUNLU (Sportmonks'ta yok!)
└── Understat → read_shot_events()
    ├── x koordinatı
    ├── y koordinatı  
    ├── xG değeri
    ├── Sonuç (gol/kurtarış/dışarı)
    └── Oyuncu bilgisi
```

### Senaryo 3: Live Score App
```
Sportmonks ZORUNLU (SoccerData canlı desteklemiyor!)
└── /livescores/inplay
    ├── Dakika dakika skor
    ├── Olaylar (gol, kart, değişiklik)
    └── İstatistikler
```

## 🔄 Fallback Mekanizması

```python
def get_data(data_type, league, season):
    """
    Akıllı fallback sistemi
    """
    
    # 1. Birincil kaynağı dene
    primary = PRIMARY_SOURCES[data_type]
    data = primary.fetch(league, season)
    
    if data.is_valid():
        return data
    
    # 2. Yedek kaynağa geç
    fallback = FALLBACK_SOURCES.get(data_type)
    if fallback:
        data = fallback.fetch(league, season)
        if data.is_valid():
            return data
    
    # 3. Cache'den dön
    return get_from_cache(data_type, league, season)
```

## 📈 Maliyet Optimizasyonu

```
AYLIK MALİYET HESABI

Senaryo A: Sadece SoccerData
├── Maliyet: €0
├── Kapsam: ~50 lig, tarihsel veri
└── Eksik: Canlı veri, geniş kapsam

Senaryo B: Sadece Sportmonks (European Basic)
├── Maliyet: €39/ay
├── Kapsam: 27 lig, canlı veri
└── Eksik: Şut koordinatları, Elo, daha az detay

Senaryo C: Hibrit (Önerilen) ⭐
├── SoccerData: €0
├── Sportmonks European Basic: €39/ay
├── TOPLAM: €39/ay
└── Kapsam: EN İYİ iki dünyadan
    ├── Tarihsel analiz (SoccerData)
    ├── Şut haritaları (SoccerData)
    ├── Elo ratings (SoccerData)
    ├── Canlı skorlar (Sportmonks)
    └── Güvenilirlik (Sportmonks)
```

## 🚀 Hızlı Başlangıç

```python
from hybrid_football_pipeline import HybridDataManager

# 1. Manager oluştur
manager = HybridDataManager(
    sportmonks_token="your_token"  # Opsiyonel
)

# 2. Otomatik kaynak seçimi
fixtures = manager.get_fixtures('premier-league', '2023-2024')
# → SoccerData'yı dener, başarısız olursa Sportmonks

# 3. Spesifik kaynak
shots = manager.get_shot_map_data('premier-league', '2023-2024')
# → Sadece SoccerData (tek kaynak)

live = manager.get_live_scores()
# → Sadece Sportmonks (tek kaynak)

# 4. Kapsamlı analiz (her iki kaynak)
analysis = manager.get_match_analysis(
    'premier-league', '2023-2024',
    'Man City', 'Arsenal'
)
# → Tüm kaynaklardan veri toplar
```

## ✅ Sonuç

**İkisini birlikte kullanmak:**
- ✅ Mümkün
- ✅ Önerilen
- ✅ En iyi sonuç
- ✅ Maliyet-etkin

**FootballAnalytics.pro için ideal setup:**
```
SoccerData (ücretsiz) + Sportmonks European Basic (€39/ay)
= Tam kapsamlı futbol veri altyapısı
```
