# Bright Data + MCP Agent Entegrasyonu

## 🎯 Amaç

Sportmonks API'ye bağımlılığı azaltmak ve Bright Data'nın web scraping gücünden faydalanarak daha zengin veri kaynaklarına erişmek.

## 📋 Avantajlar

### Bright Data Kullanmanın Avantajları:
1. **Çoklu Veri Kaynağı**: FlashScore, SofaScore, Transfermarkt, FBref, Understat gibi birden fazla kaynaktan veri
2. **Daha Detaylı Veriler**: xG, xA, xGA gibi gelişmiş metrikler
3. **Gerçek Zamanlı Veriler**: Canlı skorlar, güncel sakatlıklar
4. **Maliyet Kontrolü**: Sadece ihtiyaç duyduğunuz verileri çekersiniz
5. **Esneklik**: Yeni veri kaynakları kolayca eklenebilir

### MCP Agent Kullanmanın Avantajları:
1. **Merkezi Yönetim**: Tüm veri çekme işlemleri tek bir noktadan yönetilir
2. **Otomatik Retry**: Hata durumunda otomatik olarak başka kaynağa geçer
3. **Rate Limiting**: Bright Data'nın rate limit'lerini otomatik yönetir
4. **Caching**: Verileri akıllıca cache'ler

## 🚀 Kurulum Adımları

### 1. Bright Data Hesabı Oluşturma

1. [Bright Data](https://brightdata.com) sitesine gidin
2. Ücretsiz deneme hesabı oluşturun
3. API key'inizi alın

### 2. MCP Server Kurulumu

```bash
# Bright Data MCP server'ı global olarak yükleyin
npm install -g @brightdata/mcp

# Veya projeye ekleyin
npm install @brightdata/mcp
```

### 3. Environment Variables

`.env.local` dosyanıza ekleyin:

```env
# Bright Data
BRIGHT_DATA_API_KEY=your_bright_data_api_key_here
BRIGHT_DATA_MCP_SERVER_URL=http://localhost:3001/mcp  # Opsiyonel, default değer

# Sportmonks (fallback olarak kalacak)
SPORTMONKS_API_KEY=your_sportmonks_key_here
```

### 4. MCP Server'ı Başlatma

**Seçenek 1: Standalone Server (Önerilen)**

Ayrı bir Node.js process olarak çalıştırın:

```bash
# MCP server'ı başlat
API_TOKEN="your_bright_data_api_key" npx -y @brightdata/mcp
```

**Seçenek 2: Next.js API Route**

`src/app/api/mcp-server/route.ts` oluşturun:

```typescript
import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  // MCP agent'ı çağır ve Bright Data'dan veri çek
  // Bu kısım Bright Data MCP SDK'sına göre implement edilecek
}
```

### 5. Veri Kaynaklarını Yapılandırma

Bright Data ile şu kaynaklardan veri çekebilirsiniz:

- **FlashScore**: Maç skorları, canlı veriler
- **SofaScore**: Detaylı istatistikler, xG
- **Transfermarkt**: Takım bilgileri, sakatlıklar
- **FBref**: Gelişmiş istatistikler
- **Understat**: xG verileri
- **Bet365/Betfair**: Bahis oranları

## 🔄 Mevcut Kodu Güncelleme

### Örnek: Agent Analyzer'da Kullanım

**Önce (Sportmonks'a bağımlı):**
```typescript
import { getFullFixtureData } from '@/lib/sportmonks';

const fullData = await getFullFixtureData(fixtureId);
```

**Sonra (Provider Manager kullanarak):**
```typescript
import { dataProviderManager } from '@/lib/data-providers';

const result = await dataProviderManager.getFixture(fixtureId);
if (result) {
  const fullData = result.data; // Bright Data veya Sportmonks'tan
  const provider = result.provider; // Hangi kaynak kullanıldı
}
```

## 📊 Veri Kaynağı Öncelikleri

1. **Bright Data MCP** (Priority: 1) - Önce dene
2. **Sportmonks** (Priority: 2) - Fallback

Eğer Bright Data başarısız olursa otomatik olarak Sportmonks'a geçer.

## 🧪 Test Etme

```typescript
// Test: Sadece Bright Data kullan
const result = await dataProviderManager.useProvider(
  'Bright Data (MCP)',
  'getFixture',
  12345
);

// Test: Tüm provider'ları dene (fallback)
const result = await dataProviderManager.getFixture(12345);
```

## ⚠️ Önemli Notlar

1. **Rate Limiting**: Bright Data'nın rate limit'lerine dikkat edin
2. **Maliyet**: Her API çağrısı için ücretlendirilirsiniz
3. **Caching**: Verileri cache'leyerek maliyeti düşürün
4. **Error Handling**: Her zaman fallback mekanizması olsun

## 🔮 Gelecek Geliştirmeler

1. **Veri Karşılaştırma**: Birden fazla kaynaktan gelen verileri karşılaştır
2. **Otomatik Veri Doğrulama**: Verilerin tutarlılığını kontrol et
3. **Akıllı Caching**: Veri türüne göre cache süreleri
4. **Real-time Updates**: WebSocket ile canlı veri güncellemeleri

## 📚 Kaynaklar

- [Bright Data Documentation](https://docs.brightdata.com)
- [MCP Protocol](https://modelcontextprotocol.io)
- [Bright Data MCP Integration](https://brightdata.com/blog/ai/smolagents-with-web-mcp)

