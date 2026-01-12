# Agent İyileştirme Sistemi Test Rehberi

Bu rehber, agent iyileştirme sisteminin düzgün çalışıp çalışmadığını test etmek için adımları içerir.

## 🧪 Test Endpoint'leri

### 1. Sistem Durumu Kontrolü

**Endpoint:** `GET /api/admin/check-agent-system`

**Kullanım:**
```bash
curl "https://footballanalytics.pro/api/admin/check-agent-system?secret=YOUR_ADMIN_SECRET"
```

**Ne Kontrol Eder:**
- ✅ Agent predictions kayıtları var mı?
- ✅ Settlement çalışıyor mu?
- ✅ Agent performans metrikleri hesaplanıyor mu?
- ✅ Dinamik ağırlıklar güncelleniyor mu?

**Beklenen Sonuç:**
```json
{
  "success": true,
  "summary": {
    "total_predictions": 100,
    "settled_count": 50,
    "pending_count": 50,
    "settlement_rate": "50%"
  },
  "agent_performance": [...],
  "agent_weights": [...],
  "system_status": {
    "tables_accessible": true,
    "has_predictions": true,
    "has_settled": true,
    "system_active": true
  }
}
```

### 2. Agent Learning Test

**Endpoint:** `GET /api/admin/test-agent-learning`

**Kullanım:**
```bash
# Tüm testleri çalıştır
curl "https://footballanalytics.pro/api/admin/test-agent-learning?secret=YOUR_ADMIN_SECRET&league=Premier%20League&agent=stats&lang=tr"
```

**Parametreler:**
- `league` (opsiyonel): Test edilecek lig (varsayılan: "Premier League")
- `agent` (opsiyonel): Test edilecek agent (varsayılan: "stats")
- `lang` (opsiyonel): Dil (tr/en/de, varsayılan: "tr")

**Ne Test Eder:**
1. **Learning Context:** Geçmiş performans verilerini çekebiliyor mu?
2. **Dynamic Prompt Guidance:** Performansa göre prompt güncellemesi yapabiliyor mu?
3. **Agent Weights:** Dinamik ağırlıklar hesaplanıyor mu?
4. **Tüm Agent'lar:** Her agent için test yapıyor mu?

**Beklenen Sonuç:**
```json
{
  "success": true,
  "tests": {
    "learning_context": {
      "success": true,
      "has_data": true,
      "preview": "..."
    },
    "dynamic_prompt": {
      "success": true,
      "has_guidance": true,
      "preview": "⚠️ DÜŞÜK PERFORMANS: Son 30 maçta sadece %40 doğruluk oranı..."
    },
    "agent_weights": {
      "success": true,
      "weights": {
        "stats": 1.2,
        "odds": 0.8,
        "deepAnalysis": 1.0
      }
    }
  },
  "summary": {
    "learning_context_working": true,
    "dynamic_prompts_working": true,
    "agent_weights_working": true,
    "system_ready": true
  }
}
```

## 📊 Manuel Test Adımları

### Adım 1: Sistem Durumunu Kontrol Et

```bash
curl "https://footballanalytics.pro/api/admin/check-agent-system?secret=YOUR_SECRET" | jq
```

**Kontrol Listesi:**
- [ ] `total_predictions > 0` - Tahminler kaydediliyor mu?
- [ ] `settled_count > 0` - Settlement çalışıyor mu?
- [ ] `agent_performance` array'i dolu mu?
- [ ] `agent_weights` array'i dolu mu?

### Adım 2: Agent Learning Testini Çalıştır

```bash
curl "https://footballanalytics.pro/api/admin/test-agent-learning?secret=YOUR_SECRET&league=Premier%20League" | jq
```

**Kontrol Listesi:**
- [ ] `learning_context.success = true` - Learning context çalışıyor mu?
- [ ] `dynamic_prompt.has_guidance = true` - Dinamik prompt var mı? (en az 10 tahmin gerekli)
- [ ] `agent_weights.has_weights = true` - Ağırlıklar hesaplanıyor mu?

### Adım 3: Yeni Bir Analiz Yap ve Logları İncele

1. Frontend'den yeni bir maç analizi yap
2. Vercel loglarını kontrol et (veya local'de console.log'ları izle)

**Aranacak Log Mesajları:**
```
🧠 Learning Context loaded - using past performance data
🎯 Dynamic Prompt Guidance loaded - prompt updated based on performance
```

**Eğer bu mesajlar görünmüyorsa:**
- Agent'ın yeterli tahmin verisi yok olabilir (en az 10 tahmin gerekli)
- Supabase bağlantısı sorunlu olabilir

### Adım 4: Agent Performansını Kontrol Et

Supabase SQL Editor'de çalıştır:

```sql
-- Agent performans metriklerini görüntüle
SELECT 
  agent_name,
  league,
  overall_accuracy,
  match_result_accuracy,
  over_under_accuracy,
  btts_accuracy,
  current_weight,
  recent_30_accuracy
FROM agent_performance
ORDER BY overall_accuracy DESC;
```

**Beklenen:**
- Her agent için bir kayıt olmalı
- `overall_accuracy` 0-100 arası bir değer olmalı
- `current_weight` 0.5-2.0 arası bir değer olmalı (performansa göre)

### Adım 5: Dinamik Prompt'u Kontrol Et

Test endpoint'ini kullanarak dinamik prompt'un içeriğini görüntüle:

```bash
curl "https://footballanalytics.pro/api/admin/test-agent-learning?secret=YOUR_SECRET&agent=stats&league=Premier%20League&lang=tr" | jq '.tests.dynamic_prompt.preview'
```

**Beklenen Çıktı Örnekleri:**

**Yüksek Performans (≥60%):**
```
✅ İYİ PERFORMANS: Son 30 maçta %65 doğruluk oranı.
   → Mevcut yaklaşımını koru, başarılı stratejini sürdür.
```

**Düşük Performans (<45%):**
```
⚠️ DÜŞÜK PERFORMANS: Son 30 maçta sadece %40 doğruluk oranı.
   → YAKLAŞIMINI DEĞİŞTİR! Mevcut metodun yeterince etkili değil.
```

**Zayıf Alanlar:**
```
❌ ZAYIF OLDUĞUN ALANLAR:
   - Maç Sonucu Tahmini: Son dönemde maç sonucu tahminlerinde başarısız oldun.
     → Daha fazla form analizi yap, H2H verilerini daha dikkatli değerlendir.
```

## 🔍 Sorun Giderme

### Problem: "No guidance (insufficient data)"

**Sebep:** Agent'ın en az 10 settled tahmini yok.

**Çözüm:**
1. Daha fazla maç analizi yap
2. Settlement'ın çalıştığından emin ol (`/api/admin/check-agent-system`)
3. Bekle - sistem zamanla veri toplayacak

### Problem: "learning_context_working: false"

**Sebep:** Supabase bağlantı sorunu veya veri yok.

**Çözüm:**
1. Supabase credentials kontrol et
2. `agent_predictions` tablosunda veri var mı kontrol et
3. `getLearningContext` fonksiyonunu test et

### Problem: "agent_weights_working: false"

**Sebep:** RPC function çalışmıyor veya veri yok.

**Çözüm:**
1. Supabase'de `get_agent_weights` function'ının var olduğunu kontrol et
2. `agent_performance` tablosunda veri var mı kontrol et
3. SQL script'lerinin doğru çalıştırıldığından emin ol

### Problem: Dinamik prompt görünmüyor

**Sebep:** Agent'ın yeterli performans verisi yok.

**Çözüm:**
1. En az 10 settled tahmin gerekli
2. `agent_performance` tablosunda ilgili agent için kayıt var mı kontrol et
3. `recent_30_accuracy` değeri hesaplanmış mı kontrol et

## ✅ Başarı Kriterleri

Sistem düzgün çalışıyorsa:

1. ✅ `/api/admin/check-agent-system` endpoint'i başarılı dönüyor
2. ✅ `total_predictions > 0` ve `settled_count > 0`
3. ✅ `agent_performance` tablosunda kayıtlar var
4. ✅ `agent_weights` hesaplanıyor ve 1.0'dan farklı değerler alıyor
5. ✅ `/api/admin/test-agent-learning` tüm testleri geçiyor
6. ✅ Yeni analiz yapıldığında console'da "Learning Context loaded" ve "Dynamic Prompt Guidance loaded" mesajları görünüyor
7. ✅ Agent'ların prompt'larında dinamik uyarılar görünüyor (yeterli veri varsa)

## 📈 Performans İzleme

Sistemin zamanla iyileşip iyileşmediğini izlemek için:

```sql
-- Haftalık performans trendi
SELECT 
  agent_name,
  DATE_TRUNC('week', updated_at) as week,
  AVG(overall_accuracy) as avg_accuracy,
  AVG(current_weight) as avg_weight
FROM agent_performance
WHERE updated_at >= NOW() - INTERVAL '8 weeks'
GROUP BY agent_name, DATE_TRUNC('week', updated_at)
ORDER BY week DESC, agent_name;
```

Bu sorgu, agent'ların zamanla performanslarının nasıl değiştiğini gösterir.
