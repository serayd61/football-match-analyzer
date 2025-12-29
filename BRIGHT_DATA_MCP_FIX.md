# Bright Data MCP Session ID Hatası Çözümü

## 🔴 Sorun

Bright Data MCP server'dan şu hata geliyor:
```json
{"error":{"code":-32000,"message":"Bad Request: No valid session ID provided"},"id":null,"jsonrpc":"2.0"}
```

## 🔍 Analiz

Bu hata, Bright Data MCP server'ın session-based authentication kullandığını gösteriyor. MCP server'a istek gönderirken önce bir session oluşturulması gerekiyor olabilir.

## ✅ Çözümler

### Seçenek 1: Session Oluşturma (Önerilen)

Bright Data MCP server'a önce bir session oluşturma isteği gönderin:

```typescript
// 1. Session oluştur
const sessionResponse = await fetch(this.mcpServerUrl, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${this.apiKey}`
  },
  body: JSON.stringify({
    jsonrpc: '2.0',
    id: Date.now(),
    method: 'initialize',
    params: {
      token: this.apiKey
    }
  })
});

const sessionData = await sessionResponse.json();
const sessionId = sessionData.result?.sessionId || sessionData.result?.id;

// 2. Session ID ile istek gönder
const response = await fetch(this.mcpServerUrl, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${this.apiKey}`,
    'X-Session-ID': sessionId // veya body'de
  },
  body: JSON.stringify({
    jsonrpc: '2.0',
    id: Date.now(),
    method: action,
    params: {
      ...params,
      sessionId: sessionId,
      token: this.apiKey
    }
  })
});
```

### Seçenek 2: Direkt Bright Data Web Unlocker API

MCP yerine direkt Bright Data Web Unlocker API'yi kullanın:

```typescript
// Bright Data Web Unlocker API
const response = await fetch('https://api.brightdata.com/request', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${this.apiKey}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    zone: 'web_unlocker',
    url: `https://www.flashscore.com/match/${fixtureId}/`,
    format: 'json',
    method: 'GET',
    country: 'us',
    render: 'html'
  })
});
```

### Seçenek 3: Bright Data Collector API

Bright Data'nın Collector API'sini kullanın (daha yapılandırılmış veri):

```typescript
// Bright Data Collector API
const response = await fetch(`https://api.brightdata.com/datasets/${datasetId}/data`, {
  method: 'GET',
  headers: {
    'Authorization': `Bearer ${this.apiKey}`
  }
});
```

## 🚀 Şu Anki Durum

Şu anda sistem:
1. ✅ Bright Data MCP'yi dener (8 saniye timeout)
2. ✅ Başarısız olursa hızlıca Sportmonks'a fallback yapar
3. ✅ 504 timeout hatalarını önler

## 📝 Notlar

- Bright Data MCP server'ın gerçek API formatını Bright Data dokümantasyonundan kontrol edin
- Session ID gereksinimini Bright Data support'tan öğrenin
- Alternatif olarak, Bright Data'nın direkt API'lerini kullanabilirsiniz

