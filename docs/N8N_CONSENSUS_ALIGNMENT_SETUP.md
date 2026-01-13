# n8n Workflow - Consensus Alignment Ekleme

## 🎯 Amaç

n8n workflow'una consensus alignment hesaplama adımını eklemek.

## 📋 Adımlar

### 1. n8n Workflow'una Yeni Node Ekle

1. n8n workflow'unu açın
2. "Settle Unified Analysis" node'undan sonra yeni bir **HTTP Request** node'u ekleyin
3. Node'u şu şekilde yapılandırın:

**Node Adı:** `Calculate Consensus Alignment`

**Parameters:**
- **Method:** `GET`
- **URL:** `https://footballanalytics.pro/api/cron/calculate-consensus-alignment`
- **Authentication:** `None`
- **Send Headers:** `ON` ✅
- **Specify Headers:** `Using Fields Below`
- **Header Parameters:**
  - **Name:** `Authorization`
  - **Value:** `Bearer YOUR_CRON_SECRET_HERE` (Vercel'deki CRON_SECRET ile aynı olmalı)

### 2. Workflow Bağlantıları

```
Cron Trigger (Her 1 saat)
  ↓
Settle Unified Analysis
  ↓
Calculate Consensus Alignment (YENİ) ← Buraya ekle
  ↓
Check Success
  ↓
Get Agent Performance
Get Weekly Stats
Get All Agent Weights
```

### 3. Alternatif: Ayrı Cron Job (Önerilen)

Eğer her saat çalıştırmak istemiyorsanız, ayrı bir cron job oluşturun:

**Yeni Workflow:**
- **Adı:** `Calculate Consensus Alignment (Daily)`
- **Cron Trigger:** Her gün 02:00'de çalıştır
- **Node:** Calculate Consensus Alignment (aynı yapılandırma)

### 4. Test

1. "Execute step" butonuna tıklayın
2. Response'u kontrol edin:
   ```json
   {
     "success": true,
     "calculated": 10,
     "errors": 0,
     "processingTime": 1234
   }
   ```

## ✅ Doğru Yapılandırma Kontrol Listesi

- [ ] URL: `https://footballanalytics.pro/api/cron/calculate-consensus-alignment`
- [ ] Method: `GET`
- [ ] Authorization Header: `Bearer YOUR_CRON_SECRET`
- [ ] Send Headers: `ON`
- [ ] Response: `success: true` dönmeli

## 🔍 Sorun Giderme

### 401 Unauthorized
- **Sorun:** CRON_SECRET yanlış veya eksik
- **Çözüm:** Vercel'deki `CRON_SECRET` environment variable'ını kontrol edin
- **n8n'de:** Authorization header'daki değeri güncelleyin

### 500 Internal Server Error
- **Sorun:** Database bağlantı hatası veya SQL hatası
- **Çözüm:** Supabase bağlantısını kontrol edin
- **Log:** Vercel logs'da hata detaylarını kontrol edin

### calculated: 0
- **Sorun:** Alignment hesaplanacak fixture yok
- **Açıklama:** Bu normal olabilir - tüm alignment'lar zaten hesaplanmış olabilir
- **Kontrol:** `agent_predictions` tablosunda `consensus_alignment IS NULL` olan kayıt var mı?

## 📊 Beklenen Sonuç

Başarılı çalıştırmada:
```json
{
  "success": true,
  "calculated": 25,
  "errors": 0,
  "processingTime": 2345
}
```

Bu, 25 agent tahmini için consensus alignment hesaplandığını gösterir.
