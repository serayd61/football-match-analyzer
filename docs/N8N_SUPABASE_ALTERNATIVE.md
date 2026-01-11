# 🔄 n8n - Supabase Bağlantı Alternatifi: REST API

n8n cloud'dan Supabase PostgreSQL'e bağlanamıyorsanız (IPv6 sorunu), Supabase REST API kullanabilirsiniz.

## 📊 Supabase REST API ile Agent Performance Sorgulama

### 1. HTTP Request Node Kullan

**"Get Agent Performance"** node'unu **HTTP Request** node'una çevirin:

**Ayarlar:**
```
Method: POST
URL: https://njrpxhmdqadejjarizmj.supabase.co/rest/v1/rpc/get_agent_weights
Authentication: Generic Credential Type → Header Auth
Headers:
  - apikey: [your-supabase-anon-key]
  - Authorization: Bearer [your-supabase-anon-key]
  - Content-Type: application/json
Body:
{
  "p_league": null
}
```

### 2. Agent Performance Özeti

**URL:** `https://njrpxhmdqadejjarizmj.supabase.co/rest/v1/agent_performance?select=*&order=current_weight.desc&limit=10`

**Headers:**
```
apikey: [your-supabase-anon-key]
Authorization: Bearer [your-supabase-anon-key]
```

### 3. Agent Predictions (Haftalık İstatistikler)

**URL:** `https://njrpxhmdqadejjarizmj.supabase.co/rest/v1/agent_predictions?select=agent_name,count(*),avg(case when match_result_correct then 100 else 0 end)&settled_at=gte.2026-01-04&group_by=agent_name`

**Not:** Bu sorgu için Supabase'de view oluşturmanız gerekebilir.

## 🔑 Supabase Keys

**Keys'i bulmak için:**
1. Supabase Dashboard → Project Settings → API
2. **"anon"** key'i kopyalayın (public key)
3. n8n'de Header'a ekleyin

## ⚠️ Limitasyonlar

- REST API ile karmaşık SQL sorguları yazamazsınız
- RPC fonksiyonları kullanabilirsiniz (`get_agent_weights` gibi)
- Basit SELECT sorguları için uygundur

## 🎯 Önerilen Yaklaşım

1. **Basit sorgular için:** REST API kullan
2. **Karmaşık sorgular için:** Supabase'de view/function oluştur, REST API ile çağır
3. **PostgreSQL bağlantısı çalışırsa:** PostgreSQL node kullan (daha esnek)
