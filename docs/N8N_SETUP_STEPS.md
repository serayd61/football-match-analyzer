# 🚀 n8n Workflow Kurulum Adımları (Sıralı)

## ⚠️ ÖNEMLİ: Script'leri Sırayla Çalıştırın!

### Adım 0: Mevcut Tabloları Kontrol Et (ÖNEMLİ!)

Eğer daha önce `admin_panel_schema.sql` script'ini çalıştırdıysanız, eski bir `agent_performance` tablosu olabilir.

1. **Supabase Dashboard** → **SQL Editor**
2. `supabase/check_agent_tables.sql` dosyasını açın ve çalıştırın
3. Sonuçları kontrol edin:
   - ✅ `agent_name` kolonu VAR → Devam edin
   - ❌ `agent_name` kolonu YOK ama `agent_type` VAR → Eski tablo var, Adım 1'i çalıştırın (tablolar drop edilecek)

### Adım 1: Agent Performance Tracking Tablolarını Oluştur

1. **Supabase Dashboard** → **SQL Editor**
2. `supabase/agent_performance_tracking.sql` dosyasını açın
3. **⚠️ DİKKAT:** Bu script mevcut `agent_performance` ve `agent_predictions` tablolarını **DROP** edecek!
4. **Tüm SQL'i kopyalayın** ve SQL Editor'de çalıştırın
5. Bu script şunları oluşturur:
   - `agent_performance` tablosu (yeni yapı ile)
   - `agent_predictions` tablosu
   - `update_agent_performance()` function
   - Trigger'lar ve index'ler

**Kontrol:** SQL Editor'de şu sorguyu çalıştırın:
```sql
SELECT column_name FROM information_schema.columns 
WHERE table_schema = 'public' 
AND table_name = 'agent_performance'
AND column_name = 'agent_name';
```

`agent_name` kolonu görünmeli.

### Adım 2: n8n REST API View'larını Oluştur

1. **Supabase Dashboard** → **SQL Editor**
2. `supabase/n8n_rest_api_views.sql` dosyasını açın
3. **Tüm SQL'i kopyalayın** ve SQL Editor'de çalıştırın
4. Bu script şunları oluşturur:
   - `agent_weekly_stats` view
   - `agent_weights_summary` view
   - `get_agent_weekly_stats()` function
   - RLS policies (anon erişimi için)

**Kontrol:** SQL Editor'de şu sorguyu çalıştırın:
```sql
SELECT viewname FROM pg_views 
WHERE schemaname = 'public' 
AND viewname IN ('agent_weekly_stats', 'agent_weights_summary');
```

Her iki view da görünmeli.

### Adım 3: n8n'de Credential Oluştur

1. **n8n** → **Credentials** → **Add Credential**
2. **"HTTP Header Auth"** seçin
3. Ayarlar:
   ```
   Name: Supabase REST API
   
   Header 1:
   - Name: apikey
   - Value: [your-supabase-anon-key]
   
   Header 2:
   - Name: Authorization
   - Value: Bearer [your-supabase-anon-key]
   ```
4. **Supabase anon key'i bulmak için:**
   - Supabase Dashboard → Project Settings → API
   - **"anon"** key'i kopyalayın (public key)
5. **"Save"** butonuna tıklayın

### Adım 4: n8n Workflow'unu İçe Aktar

1. **n8n** → **Add Workflow** → **Import from File**
2. `n8n/agent-learning-workflow-rest-api.json` dosyasını seçin
3. **"Import"** butonuna tıklayın

### Adım 5: Credential'ı Workflow'a Atayın

Workflow'daki şu node'lara **"Supabase REST API"** credential'ını atayın:

1. **"Get Agent Performance (REST API)"** node'una tıklayın
   - **"Credentials"** → **"Supabase REST API"** seçin
2. **"Get Weekly Stats (REST API)"** node'una tıklayın
   - **"Credentials"** → **"Supabase REST API"** seçin
3. **"Get All Agent Weights (REST API)"** node'una tıklayın
   - **"Credentials"** → **"Supabase REST API"** seçin

### Adım 6: CRON_SECRET'i Güncelleyin

1. **"Settle Unified Analysis"** node'una tıklayın
2. **"Header Parameters"** bölümünde:
   - **"Authorization"** header'ının value'sunu güncelleyin
   - `Bearer YOUR_CRON_SECRET_HERE` → `Bearer [gerçek-CRON_SECRET-değeri]`
3. **CRON_SECRET'i bulmak için:**
   - Vercel Dashboard → Project Settings → Environment Variables
   - `CRON_SECRET` değişkenini kopyalayın

### Adım 7: Workflow'u Aktif Et ve Test Et

1. Workflow sayfasının sağ üst köşesinde **"Inactive"** butonuna tıklayın
2. **"Active"** olmalı
3. **"Execute Workflow"** butonuna tıklayarak manuel test edin
4. Her node'un başarılı olduğunu kontrol edin

## ✅ Başarı Kontrolü

Workflow başarıyla çalışıyorsa:
- ✅ "Settle Unified Analysis" → `success: true` döner
- ✅ "Get Agent Performance" → Agent listesi döner
- ✅ "Get Weekly Stats" → 7 günlük istatistikler döner
- ✅ "Get All Agent Weights" → Agent ağırlıkları döner

## ❌ Hata Durumunda

### Hata: "relation 'agent_predictions' does not exist"
**Çözüm:** Adım 1'i tekrar çalıştırın (`agent_performance_tracking.sql`)

### Hata: "permission denied for table agent_performance"
**Çözüm:** Adım 2'deki RLS policies doğru çalıştırılmamış. Adım 2'yi tekrar çalıştırın.

### Hata: "401 Unauthorized" veya "Invalid API key"
**Çözüm:** Adım 3'teki credential'ı kontrol edin. Supabase anon key doğru olmalı.

### Hata: "403 Forbidden" (Settle endpoint)
**Çözüm:** Adım 6'daki CRON_SECRET doğru olmalı.
