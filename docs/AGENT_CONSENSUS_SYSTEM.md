# Agent Tutarlılık ve Consensus Alignment Sistemi

## 🎯 Amaç

Agent'ların birbirleriyle tutarsız sonuçlar vermesini önlemek ve consensus'a yakın agent'ları ödüllendirmek.

## 📊 Mevcut Sistem (Agent Performance Tracking)

### Nasıl Çalışıyor?
1. **Agent tahminleri kaydedilir** (`agent_predictions` tablosu)
2. **Maç sonuçlandığında** agent'ların doğruluğu hesaplanır
3. **Performansa göre ağırlık** otomatik ayarlanır:
   - %70+ accuracy → 1.4x weight
   - %65+ accuracy → 1.3x weight
   - %60+ accuracy → 1.2x weight
   - %50+ accuracy → 1.0x weight
   - %40+ accuracy → 0.8x weight
   - %35+ accuracy → 0.7x weight

### Örnek Veriler (n8n'den):
```
odds (La Liga): 66.67% → 1.3x weight ✅
stats (La Liga): 66.67% → 1.3x weight ✅
masterStrategist (Serie A): 60% → 1.2x weight ✅
odds (Serie A): 47.37% → 0.9x weight ⚠️
odds (Premier League): 40% → 0.8x weight ⚠️
```

## 🆕 Yeni Sistem (Consensus Alignment)

### Problem
Agent'lar bazen birbirleriyle çelişiyor:
- Stats Agent: BTTS: No
- Odds Agent: BTTS: Yes
- Deep Analysis: BTTS: No

Bu tutarsızlık güvenilirliği düşürüyor.

### Çözüm: Consensus Alignment Tracking

#### 1. **Agent Tutarlılık Kontrolü** (`agent-consensus-validator.ts`)
- Tüm agent'ların tahminlerini karşılaştırır
- Conflict detection: Match Result, Over/Under, BTTS için
- Severity seviyeleri: low, medium, high
- Agreement hesaplama: Agent'ların ne kadar hemfikir olduğu

#### 2. **Consensus Alignment Tracking** (`consensus-alignment.ts`)
- Her analiz sonrası agent'ların consensus'a yakınlığı hesaplanır
- Consensus'a yakın agent'lar daha yüksek ağırlık alır:
  - 80-100% alignment → 1.15x - 1.3x weight
  - 60-80% alignment → 1.0x - 1.15x weight
  - 40-60% alignment → 0.85x - 1.0x weight
  - 0-40% alignment → 0.7x - 0.85x weight

#### 3. **Conflict Resolution**
- Yüksek conflict → Confidence %15 düşürülür
- Orta conflict → Confidence %8 düşürülür
- Düşük conflict → Sadece loglanır

## 🔄 İki Sistemin Birlikte Çalışması

### Ağırlık Hesaplama Sırası:
1. **Base Weight**: Performansa göre (mevcut sistem)
   - Örnek: odds (La Liga) → 66.67% → 1.3x base weight

2. **Consensus Alignment Adjustment**: Consensus'a yakınlığa göre
   - Örnek: Eğer odds agent consensus'a %85 yakınsa → 1.3x * 1.2 = 1.56x final weight

3. **Final Weight**: Base weight * Consensus alignment multiplier

### Örnek Senaryo:
```
Agent: odds (La Liga)
- Performans: 66.67% → Base weight: 1.3x
- Consensus alignment: 85% → Multiplier: 1.2x
- Final weight: 1.3 * 1.2 = 1.56x ✅
```

## 📈 Beklenen Sonuçlar

1. **Agent'lar birbirlerine yakın sonuçlar üretecek**
   - Consensus'a yakın agent'lar ödüllendirilir
   - Consensus'tan uzak agent'lar cezalandırılır

2. **Tutarsızlıklar azalacak**
   - BTTS: No vs Yes gibi conflict'ler otomatik tespit edilir
   - Conflict varsa confidence düşürülür

3. **Sistem zamanla daha tutarlı hale gelecek**
   - Agent'lar consensus'a yakın sonuçlar vermeye öğrenir
   - Yüksek alignment = daha yüksek ağırlık = daha fazla etki

## 🗄️ Database Güncellemesi

Supabase'de şu SQL'i çalıştırın:
```sql
-- supabase/legacy/add_consensus_alignment_columns.sql
ALTER TABLE agent_predictions
ADD COLUMN IF NOT EXISTS consensus_alignment INTEGER DEFAULT NULL,
ADD COLUMN IF NOT EXISTS consensus_match_result_alignment INTEGER DEFAULT NULL,
ADD COLUMN IF NOT EXISTS consensus_over_under_alignment INTEGER DEFAULT NULL,
ADD COLUMN IF NOT EXISTS consensus_btts_alignment INTEGER DEFAULT NULL;
```

## 🔍 Monitoring

n8n workflow'unda şu verileri görebilirsiniz:
- `agent_performance`: Performans bazlı ağırlıklar (mevcut)
- `agent_predictions`: Consensus alignment değerleri (yeni)
- `agent_weights_summary`: Final ağırlıklar (performans + alignment)

## 🎯 Sonuç

İki sistem birlikte çalışarak:
1. **Performans bazlı öğrenme**: İyi performans gösteren agent'lar daha yüksek ağırlık alır
2. **Consensus bazlı öğrenme**: Consensus'a yakın agent'lar daha yüksek ağırlık alır
3. **Tutarlılık kontrolü**: Conflict'ler otomatik tespit edilir ve çözülür

Bu sayede agent'lar hem doğru hem de tutarlı sonuçlar üretir! 🚀
