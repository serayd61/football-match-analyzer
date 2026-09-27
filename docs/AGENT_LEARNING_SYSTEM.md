# 🧠 Öğrenen Agent Sistemi - Otomatik Ağırlık Ayarlama

## 📋 Genel Bakış

Bu sistem, agent'ların performansını takip eder ve otomatik olarak ağırlıklarını ayarlar. Hangi agent iyi gidiyorsa, onun ağırlığı artar ve final tahminlere daha fazla etki eder.

## 🎯 Özellikler

- ✅ **Otomatik Performans Takibi**: Her agent için ayrı performans metrikleri
- ✅ **Dinamik Ağırlık Hesaplama**: Performansa göre otomatik ağırlık ayarlama
- ✅ **Rolling Window**: Son 30 maç performansı (90 günlük pencere)
- ✅ **Trend Analizi**: Agent'ların performans trendi (improving/declining/stable)
- ✅ **Lig Bazlı Takip**: Her lig için ayrı performans takibi
- ✅ **Otomatik Güncelleme**: PostgreSQL trigger ile otomatik performans güncelleme

## 📊 Ağırlık Hesaplama Formülü

```
Base Weight = 1.0

Accuracy Multiplier:
- %70+ → 1.4x (çok iyi)
- %65-70 → 1.3x (iyi)
- %60-65 → 1.2x (hafif iyi)
- %55-60 → 1.1x (biraz iyi)
- %50-55 → 1.0x (normal)
- %45-50 → 0.9x (biraz kötü)
- %40-45 → 0.8x (kötü)
- %35-40 → 0.7x (çok kötü)
- %35- → 0.6x (çok çok kötü)

Final Weight = Base Weight × Accuracy Multiplier + Trend Bonus
Min: 0.5x, Max: 2.0x
```

## 🗄️ Veritabanı Şeması

### `agent_performance` Tablosu
Agent'ların genel performans metriklerini saklar.

```sql
- agent_name: Agent adı (stats, odds, deepAnalysis, masterStrategist)
- league: Lig adı (opsiyonel)
- total_matches: Toplam maç sayısı
- correct_predictions: Doğru tahmin sayısı
- match_result_accuracy: Maç sonucu doğruluğu (%)
- recent_match_result_accuracy: Son 30 maç doğruluğu (%)
- current_weight: Güncel ağırlık (otomatik hesaplanan)
- weight_history: Ağırlık geçmişi (JSON)
- trend_direction: Trend yönü (improving/declining/stable)
```

### `agent_predictions` Tablosu
Her maç için agent tahminlerini saklar.

```sql
- fixture_id: Maç ID
- agent_name: Agent adı
- match_result_prediction: Tahmin (1/X/2)
- match_result_correct: Doğru mu? (NULL = henüz sonuçlanmadı)
- over_under_prediction: Over/Under tahmini
- over_under_correct: Doğru mu?
- btts_prediction: BTTS tahmini
- btts_correct: Doğru mu?
- settled_at: Sonuçlanma zamanı
```

## 🚀 Kurulum

### 1. Supabase SQL Script'ini Çalıştır

```bash
# Supabase SQL Editor'da çalıştır:
supabase/legacy/agent_performance_tracking.sql
```

Bu script şunları oluşturur:
- `agent_performance` tablosu
- `agent_predictions` tablosu
- `update_agent_performance()` trigger fonksiyonu
- `get_agent_weights()` helper fonksiyonu
- `agent_performance_summary` view

### 2. n8n Workflow'unu İçe Aktar

1. n8n'e giriş yap
2. **Workflows** → **Import from File**
3. `n8n/agent-learning-workflow.json` dosyasını seç
4. **Credentials** ayarla:
   - Supabase PostgreSQL connection
   - Vercel URL ve CRON_SECRET (opsiyonel)
   - Slack Webhook URL (opsiyonel - bildirimler için)

### 3. Environment Variables

`.env` dosyasına ekle (zaten varsa kontrol et):

```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
```

## 🔄 Sistem Akışı

### 1. Tahmin Kaydetme
Agent analizi yapıldığında:
```typescript
saveAgentAnalysis(result) 
  → recordAgentPrediction() // Her agent için tahmin kaydedilir
```

### 2. Maç Sonuçlanma
Maç sonuçlandığında:
```typescript
settle-unified cron job
  → settleAgentPredictions() // Agent tahminleri doğrulanır
  → PostgreSQL trigger // Otomatik performans güncelleme
```

### 3. Ağırlık Kullanımı
Yeni analiz yapılırken:
```typescript
createUnifiedConsensus()
  → getAgentWeights() // Supabase'den öğrenilen ağırlıklar
  → multipliers // Final ağırlıklar
```

## 📈 Performans Metrikleri

### Agent Performans Özeti
```sql
SELECT * FROM agent_performance_summary;
```

### Haftalık İstatistikler
```sql
SELECT 
  agent_name,
  COUNT(*) as total,
  AVG(CASE WHEN match_result_correct THEN 100 ELSE 0 END) as accuracy
FROM agent_predictions
WHERE settled_at >= NOW() - INTERVAL '7 days'
GROUP BY agent_name;
```

### Ağırlık Geçmişi
```sql
SELECT 
  agent_name,
  jsonb_array_elements(weight_history) as weight_entry
FROM agent_performance
WHERE agent_name = 'stats';
```

## 🎛️ n8n Workflow Özellikleri

Workflow şunları yapar:
1. **Her 1 saatte bir** `settle-unified` endpoint'ini çağırır
2. Agent performansını günceller
3. Haftalık istatistikleri toplar
4. (Opsiyonel) Slack'e bildirim gönderir

## 🔍 Debugging

### Agent Ağırlıklarını Kontrol Et
```typescript
import { getAgentWeights } from '@/lib/agent-learning/performance-tracker';

const weights = await getAgentWeights('Premier League');
console.log(weights);
// { stats: 1.2, odds: 0.9, deepAnalysis: 1.1, masterStrategist: 1.3 }
```

### Performans Özetini Görüntüle
```typescript
import { getAgentPerformanceSummary } from '@/lib/agent-learning/performance-tracker';

const summary = await getAgentPerformanceSummary('Premier League');
console.log(summary);
```

## ⚙️ Özelleştirme

### Ağırlık Hesaplama Formülünü Değiştir

`supabase/legacy/agent_performance_tracking.sql` dosyasındaki `update_agent_performance()` fonksiyonunu düzenle:

```sql
-- Accuracy multiplier'ı değiştir
accuracy_multiplier := CASE
  WHEN accuracy >= 75 THEN 1.5  -- Daha agresif
  WHEN accuracy >= 70 THEN 1.4
  ...
END;
```

### Rolling Window Süresini Değiştir

```sql
-- Son 30 maç yerine son 50 maç
AND settled_at >= NOW() - INTERVAL '150 days' -- ~50 maç
```

## 📊 Örnek Senaryo

1. **Başlangıç**: Tüm agent'lar 1.0x ağırlıkta
2. **10 maç sonra**: 
   - Stats Agent: %65 doğruluk → 1.3x ağırlık
   - Odds Agent: %45 doğruluk → 0.9x ağırlık
   - Deep Analysis: %55 doğruluk → 1.1x ağırlık
3. **30 maç sonra**:
   - Stats Agent: %70 doğruluk → 1.4x ağırlık (en yüksek)
   - Odds Agent: %50 doğruluk → 1.0x ağırlık
   - Deep Analysis: %60 doğruluk → 1.2x ağırlık

**Sonuç**: Stats Agent'ın tahminleri final sonuca %40 yerine %56 etki eder (1.4x multiplier ile).

## 🐛 Sorun Giderme

### Agent ağırlıkları güncellenmiyor
- PostgreSQL trigger'ın çalıştığını kontrol et
- `agent_predictions` tablosunda `settled_at` NULL olmayan kayıtlar var mı?
- `agent_performance` tablosunda kayıt var mı?

### Ağırlıklar hep 1.0
- En az 5 maç verisi olmalı (`total_matches >= 5`)
- `get_agent_weights()` fonksiyonu çalışıyor mu?
- Supabase function'ı test et: `SELECT * FROM get_agent_weights(NULL);`

## 📝 Notlar

- Sistem **non-blocking** çalışır - hata olsa bile analiz devam eder
- Ağırlıklar **lig bazlı** olabilir (league parametresi ile)
- **Trend analizi** henüz tam implement edilmedi (gelecek güncelleme)
- **Min ağırlık**: 0.5x, **Max ağırlık**: 2.0x (sistem stabilitesi için)

## 🚀 Gelecek Geliştirmeler

- [ ] Trend analizi (son 10 maç vs önceki 10 maç)
- [ ] Market bazlı ağırlıklar (MR, OU, BTTS için ayrı)
- [ ] Lig bazlı öğrenme (her lig için farklı ağırlıklar)
- [ ] Zaman bazlı ağırlıklar (sezon başı vs sezon sonu)
- [ ] Agent kombinasyon optimizasyonu
