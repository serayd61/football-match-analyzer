# 🔄 n8n Workflow Kurulum Rehberi

## 📋 Agent Learning Workflow Kurulumu

### 1. n8n'e Giriş Yap

1. n8n instance'ınıza giriş yapın (self-hosted veya n8n.cloud)
2. Ana sayfada **"Workflows"** sekmesine gidin

### 2. Workflow'u İçe Aktar

#### Yöntem 1: JSON Dosyasından İçe Aktar (Önerilen)

1. n8n'de **"Add workflow"** → **"Import from File"** seçin
2. `n8n/agent-learning-workflow.json` dosyasını seçin
3. **"Import"** butonuna tıklayın

#### Yöntem 2: JSON İçeriğini Kopyala-Yapıştır

1. `n8n/agent-learning-workflow.json` dosyasını açın
2. Tüm içeriği kopyalayın (Ctrl+A, Ctrl+C)
3. n8n'de **"Add workflow"** → **"Import from URL or File"** → **"Paste JSON"**
4. JSON'u yapıştırın ve **"Import"** butonuna tıklayın

### 3. Credentials (Kimlik Bilgileri) Ayarla

Workflow'u açtıktan sonra, aşağıdaki node'lar için credentials ayarlamanız gerekiyor:

#### A. Supabase PostgreSQL Connection

1. **"Get Agent Performance"** node'una tıklayın
2. **"Credentials"** → **"Create New Credential"** → **"Postgres"**
3. Aşağıdaki bilgileri girin:

```
Host: db.njrpxhmdqadejjarizmj.supabase.co
Database: postgres
User: postgres
Password: [your-db-password]
Port: 5432
SSL: Enabled
```

**Örnek (Project ID: njrpxhmdqadejjarizmj):**
```
Host: db.njrpxhmdqadejjarizmj.supabase.co
```

**Supabase şifresini bulmak için:**
- Supabase Dashboard → Project Settings → Database
- **"Database password"** bölümünden şifreyi kopyalayın

4. **"Save"** butonuna tıklayın
5. Aynı credential'ı diğer PostgreSQL node'larına da atayın:
   - **"Get Weekly Stats"**
   - **"Get All Agent Weights"**

#### B. Vercel API (Opsiyonel - Settle Endpoint için)

1. **"Settle Unified Analysis"** node'una tıklayın
2. **"Authentication"** → **"None"** seçin (credential gereksiz)
3. **"Send Headers"** → **Aktif** olmalı
4. **"Header Parameters"** bölümünde:
   - **Name:** `Authorization`
   - **Value:** `Bearer YOUR_CRON_SECRET_HERE` (Vercel'deki CRON_SECRET değerini buraya yazın)

**CRON_SECRET'i bulmak için:**
- Vercel Dashboard → Project Settings → Environment Variables
- `CRON_SECRET` değişkenini kopyalayın
- n8n'de Header Value'ya yapıştırın: `Bearer [secret-değeri]`

**Örnek:**
```
Bearer abc123xyz789secret
```

**Not:** n8n'de environment variable kullanmak istiyorsanız, n8n cloud'da Settings → Environment Variables'dan ekleyebilirsiniz. Ama self-hosted n8n'de izin vermeniz gerekebilir.

5. **"URL"** alanını kontrol edin:
```
https://footballanalytics.pro/api/cron/settle-unified
```

**Not:** Environment variable kullanmak istemiyorsanız, URL'yi direkt yazın. `{{ $env.VERCEL_URL }}` kullanmak "access to env vars denied" hatasına neden olabilir.

#### C. Slack Webhook (Opsiyonel - Bildirimler için)

1. **"Notify Slack (Optional)"** node'una tıklayın
2. Node'u **aktif** hale getirin (şu anda disabled)
3. **"URL"** alanına Slack webhook URL'inizi girin

**Slack Webhook oluşturmak için:**
- Slack → Apps → Incoming Webhooks
- Yeni webhook oluşturun
- URL'i kopyalayın

### 4. Workflow'u Aktif Et

1. Workflow sayfasının sağ üst köşesinde **"Inactive"** butonuna tıklayın
2. **"Active"** olarak değişsin
3. Workflow artık otomatik çalışacak!

### 5. Test Et

#### Manuel Test

1. Workflow'u açın
2. **"Execute Workflow"** butonuna tıklayın
3. Her node'un başarılı çalıştığını kontrol edin

#### Otomatik Çalışma Kontrolü

1. **"Cron Trigger"** node'una tıklayın
2. **"Rule"** ayarını kontrol edin:
   - Varsayılan: Her 1 saatte bir
   - Değiştirmek için: `0 * * * *` (her saat başı)

### 6. Monitoring (İzleme)

#### Execution History

1. Workflow sayfasında **"Executions"** sekmesine gidin
2. Son çalışmaları görüntüleyin
3. Hata varsa detaylarına bakın

#### Log Kontrolü

Her node'un çıktısını kontrol edebilirsiniz:
- Node'a tıklayın
- **"Output"** sekmesinde sonuçları görün

## 🔧 Yaygın Sorunlar ve Çözümleri

### Sorun 1: "Connection refused" hatası

**Çözüm:**
- Supabase PostgreSQL credentials'ı kontrol edin
- Host adresinin doğru olduğundan emin olun
- SSL'in aktif olduğundan emin olun

### Sorun 2: "401 Unauthorized" hatası

**Çözüm:**
- Vercel CRON_SECRET'i kontrol edin
- Header formatını kontrol edin: `Bearer [secret]`

### Sorun 3: Workflow çalışmıyor

**Çözüm:**
- Workflow'un **"Active"** olduğundan emin olun
- Cron trigger'ın zamanlamasını kontrol edin
- Execution history'de hata var mı bakın

### Sorun 4: PostgreSQL query hatası

**Çözüm:**
- Supabase'de `agent_performance_tracking.sql` script'inin çalıştırıldığından emin olun
- Tabloların oluşturulduğunu kontrol edin:
  ```sql
  SELECT * FROM agent_performance LIMIT 1;
  SELECT * FROM agent_predictions LIMIT 1;
  ```

## 📊 Workflow Akışı

```
1. Cron Trigger (Her 1 saat)
   ↓
2. Settle Unified Analysis (API çağrısı)
   ↓
3. Check Success (Başarı kontrolü)
   ↓
4. Paralel işlemler:
   ├─ Get Agent Performance
   ├─ Get Weekly Stats
   └─ Get All Agent Weights
   ↓
5. Format Summary (Performans özeti)
   ↓
6. Notify Slack (Opsiyonel - bildirim)
```

## ⚙️ Özelleştirme

### Cron Schedule Değiştirme

**"Cron Trigger"** node'unda:
- Her 30 dakika: `*/30 * * * *`
- Her 2 saat: `0 */2 * * *`
- Her gün saat 00:00: `0 0 * * *`

### Slack Bildirim Formatını Değiştirme

**"Notify Slack"** node'unda **"Body Parameters"** → **"text"** alanını düzenleyin.

### Ek Node'lar Ekleme

- **Email Notification**: Slack yerine email göndermek için
- **Webhook**: Başka bir sisteme veri göndermek için
- **Database Update**: Ek veri kaydetmek için

## 📝 Notlar

- Workflow **non-blocking** çalışır - bir node hata verse bile diğerleri çalışır
- **"Notify Slack"** node'u varsayılan olarak **disabled** - aktif etmek isterseniz enable edin
- Supabase connection için **service role key** kullanmayın, sadece **database password** kullanın
- Workflow'u test etmek için **"Execute Workflow"** butonunu kullanabilirsiniz

## 🚀 Sonraki Adımlar

1. ✅ Workflow'u import edin
2. ✅ Credentials'ı ayarlayın
3. ✅ Workflow'u aktif edin
4. ✅ İlk execution'ı bekleyin (1 saat içinde)
5. ✅ Execution history'yi kontrol edin
6. ✅ Agent performans tablolarını kontrol edin

## 📞 Destek

Sorun yaşarsanız:
1. Execution history'deki hata mesajlarını kontrol edin
2. Node output'larını inceleyin
3. Supabase ve Vercel log'larını kontrol edin
