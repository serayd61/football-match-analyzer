# ⚽ Football Match Analyzer - Web Version

AI destekli futbol maç analizi web uygulaması. Next.js + Vercel + OpenAI/Claude.

![License](https://img.shields.io/badge/license-MIT-green)
![Next.js](https://img.shields.io/badge/Next.js-14-black)
![TypeScript](https://img.shields.io/badge/TypeScript-5-blue)

## 🎯 Özellikler

- 📊 **Canlı Puan Durumu** - 6 büyük Avrupa ligi
- 📅 **Yaklaşan Maçlar** - Önümüzdeki 7 gün
- 🤖 **AI Analiz** - OpenAI GPT-4 veya Claude ile maç tahmini
- 📱 **Responsive Tasarım** - Mobil uyumlu
- ⚡ **Hızlı** - Vercel Edge Functions

## 🏆 Desteklenen Ligler

| Bayrak | Lig | API Kodu |
|--------|-----|----------|
| 🏴󠁧󠁢󠁥󠁮󠁧󠁿 | Premier League | PL |
| 🇪🇸 | La Liga | PD |
| 🇮🇹 | Serie A | SA |
| 🇩🇪 | Bundesliga | BL1 |
| 🇫🇷 | Ligue 1 | FL1 |
| 🇪🇺 | Champions League | CL |

## 🚀 Hızlı Başlangıç

### 1. Repository'yi Klonla

```bash
git clone https://github.com/YOUR_USERNAME/football-match-analyzer.git
cd football-match-analyzer
```

### 2. Bağımlılıkları Yükle

```bash
npm install
# veya
yarn install
# veya
pnpm install
```

### 3. Environment Variables

`.env.example` dosyasını `.env.local` olarak kopyala ve API key'leri ekle:

```bash
cp .env.example .env.local
```

```env
# Football Data API (Ücretsiz: https://www.football-data.org/client/register)
FOOTBALL_DATA_API_KEY=your_key_here

# AI API Keys (en az birini ekle)
OPENAI_API_KEY=sk-your-openai-key
ANTHROPIC_API_KEY=sk-ant-your-claude-key
```

### 4. Geliştirme Sunucusunu Başlat

```bash
npm run dev
```

Tarayıcıda aç: [http://localhost:3000](http://localhost:3000)

## ☁️ Vercel'e Deploy

### Otomatik Deploy (Önerilen)

1. GitHub'a push et
2. [Vercel](https://vercel.com)'e git
3. "New Project" → GitHub repo'nu seç
4. Environment Variables ekle:
   - `FOOTBALL_DATA_API_KEY`
   - `OPENAI_API_KEY` (veya `ANTHROPIC_API_KEY`)
5. Deploy!

### Manuel Deploy

```bash
npm install -g vercel
vercel login
vercel --prod
```

## 🔑 API Keys Alma

### Football-Data.org (Zorunlu)

1. [football-data.org/client/register](https://www.football-data.org/client/register) adresine git
2. Ücretsiz hesap oluştur
3. API key'i kopyala

**Ücretsiz Plan Limitleri:**
- 10 istek/dakika
- Tüm büyük ligler dahil
- Tarihi veriler

### OpenAI (Opsiyonel)

1. [platform.openai.com](https://platform.openai.com) hesabı oluştur
2. API Keys → Create new secret key
3. GPT-4o-mini kullanılıyor (~$0.001/analiz)

### Anthropic Claude (Opsiyonel)

1. [console.anthropic.com](https://console.anthropic.com) hesabı oluştur
2. API Keys → Create Key
3. Claude 3.5 Sonnet kullanılıyor

## 📁 Proje Yapısı

```
football-analyzer-web/
├── src/
│   ├── app/
│   │   ├── api/
│   │   │   ├── standings/route.ts    # Puan durumu API
│   │   │   ├── upcoming/route.ts     # Yaklaşan maçlar API
│   │   │   └── analyze/route.ts      # AI analiz API
│   │   ├── globals.css
│   │   ├── layout.tsx
│   │   └── page.tsx                  # Ana sayfa
│   └── lib/
│       ├── football-api.ts           # Football Data API wrapper
│       └── ai-analysis.ts            # OpenAI/Claude entegrasyonu
├── .env.example
├── next.config.js
├── tailwind.config.js
└── package.json
```

## 🔌 API Endpoints

### GET /api/standings
Puan durumunu getirir.

```bash
curl "https://your-app.vercel.app/api/standings?competition=premier_league"
```

### GET /api/upcoming
Yaklaşan maçları getirir.

```bash
curl "https://your-app.vercel.app/api/upcoming?competition=la_liga"
```

### POST /api/analyze
Maç analizi yapar.

```bash
curl -X POST "https://your-app.vercel.app/api/analyze" \
  -H "Content-Type: application/json" \
  -d '{
    "homeTeamId": 57,
    "homeTeamName": "Arsenal",
    "awayTeamId": 61,
    "awayTeamName": "Chelsea",
    "competition": "Premier League",
    "aiProvider": "openai"
  }'
```

## 🎨 Ekran Görüntüleri

```
┌─────────────────────────────────────────────────────────────┐
│  ⚽ Football Match Analyzer                                  │
│  🏴󠁧󠁢󠁥󠁮󠁧󠁿 PL  🇪🇸 La Liga  🇮🇹 Serie A  🇩🇪 Bundesliga  🇫🇷 Ligue 1  │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  🏆 Puan Durumu    📅 Yaklaşan Maçlar    🤖 AI Analiz       │
│  ───────────────   ─────────────────────  ──────────────    │
│  1. Liverpool 38   Ars vs Che - 14 Ara   [OpenAI][Claude]   │
│  2. Arsenal   35   MCI vs LIV - 15 Ara                      │
│  3. Chelsea   31   ...                    ⚡ Analiz Et       │
│  ...                                                        │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

## 🛠️ Geliştirme

### Yeni Lig Eklemek

`src/lib/football-api.ts` dosyasında `COMPETITIONS` objesine ekle:

```typescript
export const COMPETITIONS = {
  // ...existing
  eredivisie: { code: 'DED', name: 'Eredivisie', country: '🇳🇱' },
};
```

### AI Prompt'unu Özelleştirmek

`src/lib/ai-analysis.ts` dosyasında `SYSTEM_PROMPT` değişkenini düzenle.

## ⚠️ Önemli Notlar

1. **Rate Limiting**: Football-data.org ücretsiz planda 10 istek/dakika. Çok sık yenileme yapmayın.

2. **API Maliyeti**: Her AI analizi ~$0.001-0.01 arası maliyet oluşturur.

3. **Disclaimer**: Bu uygulama eğitim amaçlıdır. Bahis kararlarınız için profesyonel tavsiye alın.

## 📄 Lisans

MIT License - Detaylar için [LICENSE](LICENSE) dosyasına bakın.

## 🤝 Katkıda Bulunma

1. Fork yapın
2. Feature branch oluşturun (`git checkout -b feature/amazing-feature`)
3. Commit yapın (`git commit -m 'Add amazing feature'`)
4. Push yapın (`git push origin feature/amazing-feature`)
5. Pull Request açın

---

**⚽ Built with ❤️ for football fans**
