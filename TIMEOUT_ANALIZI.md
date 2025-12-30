# 🔴 504 Gateway Timeout Hatası - Analiz ve Çözümler

## ❌ Sorun
`/api/v2/analyze` endpoint'i 504 Gateway Timeout hatası veriyor.

## 🔍 Olası Nedenler

### 1. **Vercel Timeout Limitleri**
- **Free/Hobby Plan:** 10 saniye max
- **Pro Plan:** 60 saniye max  
- **Enterprise Plan:** 300 saniye max
- Kodda `maxDuration = 120` ayarlanmış ama Vercel'in limiti daha düşük olabilir

### 2. **Agent Analizi Çok Uzun Sürüyor**
Agent analizi şu adımları içeriyor:
- ✅ Sportmonks API'den veri çekme (getFullFixtureData) - ~2-5 saniye
- ✅ Detaylı istatistikler (getTeamStats x2, getHeadToHead, getTeamInjuries x2) - ~5-10 saniye
- ✅ 3 Agent paralel çalıştırma (Stats, Odds, Deep Analysis) - Her biri 10-30 saniye
  - Her agent Heurist AI model çağrısı yapıyor
  - Toplam: 30-90 saniye
- ✅ Veri işleme ve consensus - ~2-5 saniye
- ✅ Database'e kayıt - ~1-2 saniye

**Toplam Süre:** 40-112 saniye (Vercel'in 10-60 saniye limitini aşabilir)

### 3. **Yeni Analizler (Cache Yok)**
- Eski kayıtlar silindi
- Yeni analizler yapılıyor (cache yok)
- İlk analiz daha uzun sürebilir

### 4. **External API Yavaşlığı**
- Sportmonks API yavaş yanıt veriyor
- Heurist AI model yavaş yanıt veriyor
- Network latency

## ✅ Çözümler

### Çözüm 1: Timeout Handling ve Fallback (Önerilen)
API'ye timeout handling ekleyip, timeout olursa Smart Analysis'e fallback yapalım:

```typescript
// src/app/api/v2/analyze/route.ts
export async function POST(request: NextRequest) {
  const startTime = Date.now();
  const TIMEOUT_MS = 50000; // 50 saniye timeout (Vercel Pro plan limiti)
  
  try {
    // ... mevcut kod ...
    
    // Agent Analysis'i timeout ile çalıştır
    const agentAnalysisPromise = runAgentAnalysis(fixtureId, homeTeamId, awayTeamId);
    const timeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error('Agent Analysis timeout')), TIMEOUT_MS)
    );
    
    let agentAnalysis;
    try {
      agentAnalysis = await Promise.race([agentAnalysisPromise, timeoutPromise]);
    } catch (timeoutError) {
      console.warn('⏱️ Agent Analysis timeout, falling back to Smart Analysis');
      // Smart Analysis'e fallback yap
      return await fallbackToSmartAnalysis(...);
    }
    
    // ... devam ...
  }
}
```

### Çözüm 2: Background Job Kullanımı
Agent analizini background job olarak çalıştır, kullanıcıya hemen response dön:

```typescript
// 1. Status: "processing" olarak kaydet
// 2. Background job başlat (QStash veya Vercel Cron)
// 3. Kullanıcıya "Analiz devam ediyor" mesajı dön
// 4. Frontend polling yaparak sonucu kontrol et
```

### Çözüm 3: Vercel Plan Kontrolü
Vercel Pro plan kullanıyorsanız, `maxDuration`'ı 60'a düşürün:

```typescript
export const maxDuration = 60; // Pro plan limiti
```

### Çözüm 4: Agent Timeout'ları
Her agent'a ayrı timeout ekleyin:

```typescript
const AGENT_TIMEOUT = 20000; // 20 saniye per agent

const statsResult = await Promise.race([
  runStatsAgent(matchData, language),
  new Promise((_, reject) => 
    setTimeout(() => reject(new Error('Stats agent timeout')), AGENT_TIMEOUT)
  )
]).catch(() => null);
```

### Çözüm 5: Cache Kullanımı
Mümkün olduğunca cache kullanın:
- Sportmonks verilerini cache'le
- Agent sonuçlarını cache'le
- Database'den önce cache kontrol et

## 🎯 Önerilen Yaklaşım

**Kısa Vadeli (Hemen):**
1. ✅ Timeout handling ekle
2. ✅ Timeout olursa Smart Analysis'e fallback yap
3. ✅ Kullanıcıya bilgi ver: "Agent analizi uzun sürdü, Smart Analysis gösteriliyor"

**Orta Vadeli:**
1. Background job sistemi kur
2. Polling mekanizması ekle
3. "Analiz devam ediyor" UI göster

**Uzun Vadeli:**
1. Vercel Pro/Enterprise plan'a geç
2. Agent'ları optimize et (daha hızlı prompt'lar)
3. Sportmonks API cache'ini güçlendir

