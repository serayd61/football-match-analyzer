# Bright Data Configuration

## 🔑 API Credentials

Bright Data API key ve MCP server URL'iniz:

```
BRIGHT_DATA_API_KEY=d23d3794-d995-4c3d-804a-e9741706333e
BRIGHT_DATA_MCP_SERVER_URL=https://mcp.brightdata.com/mcp?token=d23d3794-d995-4c3d-804a-e9741706333e
```

## 📝 Environment Variables

`.env.local` dosyanıza ekleyin:

```env
# Bright Data
BRIGHT_DATA_API_KEY=d23d3794-d995-4c3d-804a-e9741706333e
BRIGHT_DATA_MCP_SERVER_URL=https://mcp.brightdata.com/mcp?token=d23d3794-d995-4c3d-804a-e9741706333e

# Sportmonks (fallback)
SPORTMONKS_API_KEY=your_sportmonks_key_here
```

## 🧪 Test Endpoint

Bright Data entegrasyonunu test etmek için:

```bash
# Provider'ları listele
curl http://localhost:3000/api/bright-data-test

# Fixture test
curl http://localhost:3000/api/bright-data-test?fixtureId=12345&type=fixture

# Team stats test
curl http://localhost:3000/api/bright-data-test?teamId=123&type=team
```

## 📊 Veri Kaynakları

Bright Data MCP provider şu kaynaklardan veri çekebilir:

- **FlashScore**: Maç skorları, canlı veriler
- **SofaScore**: Detaylı istatistikler, xG
- **Transfermarkt**: Takım bilgileri, sakatlıklar
- **FBref**: Gelişmiş istatistikler
- **Understat**: xG verileri
- **Bet365/Betfair**: Bahis oranları

## ⚠️ Önemli Notlar

1. API key'inizi güvenli tutun
2. Rate limiting'e dikkat edin
3. Verileri cache'leyerek maliyeti düşürün
4. Fallback mekanizması her zaman aktif (Sportmonks)

