import OpenAI from 'openai';
import Anthropic from '@anthropic-ai/sdk';
import { MatchAnalysisData } from './football-api';

const SYSTEM_PROMPT = `Sen dünya çapında tanınan bir futbol analisti ve veri bilimcisin.
Verilen maç verilerini analiz ederek profesyonel bir maç öncesi raporu hazırla.

Yanıtını şu formatta ver (Markdown kullan):

## 📊 Form Analizi

### 🏠 Ev Sahibi
[Ev sahibi takımın son form değerlendirmesi]

### ✈️ Deplasman
[Deplasman takımının son form değerlendirmesi]

## ⚔️ Taktiksel Öngörüler
[Maçın nasıl geçebileceğine dair öngörüler]

## 🎯 Tahmin

| Sonuç | İhtimal |
|-------|---------|
| Ev Sahibi Kazanır | %XX |
| Beraberlik | %XX |
| Deplasman Kazanır | %XX |

**Tahmini Skor:** X-X

## 💡 Bahis Önerileri
- [Öneri 1]
- [Öneri 2]
- [Öneri 3]

Türkçe yanıt ver ve profesyonel bir ton kullan.`;

export async function analyzeWithOpenAI(matchData: MatchAnalysisData): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY;
  
  if (!apiKey) {
    return '⚠️ OpenAI API key tanımlı değil. Lütfen OPENAI_API_KEY environment variable ekleyin.';
  }

  const client = new OpenAI({ apiKey });

  const userPrompt = `Aşağıdaki maç için detaylı analiz raporu hazırla:

**Maç:** ${matchData.homeTeam.name} vs ${matchData.awayTeam.name}
**Lig:** ${matchData.competition}
${matchData.matchDate ? `**Tarih:** ${new Date(matchData.matchDate).toLocaleDateString('tr-TR')}` : ''}

**Ev Sahibi (${matchData.homeTeam.name}) Son 5 Maç:**
- Form: ${matchData.homeTeam.form.formString}
- Galibiyet/Beraberlik/Mağlubiyet: ${matchData.homeTeam.form.wins}/${matchData.homeTeam.form.draws}/${matchData.homeTeam.form.losses}
- Atılan Gol Ort: ${matchData.homeTeam.form.avgScored}
- Yenilen Gol Ort: ${matchData.homeTeam.form.avgConceded}
- Son 5 Maçta Puan: ${matchData.homeTeam.form.points}/15

**Deplasman (${matchData.awayTeam.name}) Son 5 Maç:**
- Form: ${matchData.awayTeam.form.formString}
- Galibiyet/Beraberlik/Mağlubiyet: ${matchData.awayTeam.form.wins}/${matchData.awayTeam.form.draws}/${matchData.awayTeam.form.losses}
- Atılan Gol Ort: ${matchData.awayTeam.form.avgScored}
- Yenilen Gol Ort: ${matchData.awayTeam.form.avgConceded}
- Son 5 Maçta Puan: ${matchData.awayTeam.form.points}/15`;

  try {
    const response = await client.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.7,
      max_tokens: 1500,
    });

    return response.choices[0]?.message?.content || 'Analiz oluşturulamadı.';
  } catch (error: any) {
    console.error('OpenAI Error:', error);
    return `❌ OpenAI Hatası: ${error.message}`;
  }
}

export async function analyzeWithClaude(matchData: MatchAnalysisData): Promise<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  
  if (!apiKey) {
    return '⚠️ Anthropic API key tanımlı değil. Lütfen ANTHROPIC_API_KEY environment variable ekleyin.';
  }

  const client = new Anthropic({ apiKey });

  const userPrompt = `${SYSTEM_PROMPT}

Aşağıdaki maç için detaylı analiz raporu hazırla:

**Maç:** ${matchData.homeTeam.name} vs ${matchData.awayTeam.name}
**Lig:** ${matchData.competition}
${matchData.matchDate ? `**Tarih:** ${new Date(matchData.matchDate).toLocaleDateString('tr-TR')}` : ''}

**Ev Sahibi (${matchData.homeTeam.name}) Son 5 Maç:**
- Form: ${matchData.homeTeam.form.formString}
- Galibiyet/Beraberlik/Mağlubiyet: ${matchData.homeTeam.form.wins}/${matchData.homeTeam.form.draws}/${matchData.homeTeam.form.losses}
- Atılan Gol Ort: ${matchData.homeTeam.form.avgScored}
- Yenilen Gol Ort: ${matchData.homeTeam.form.avgConceded}
- Son 5 Maçta Puan: ${matchData.homeTeam.form.points}/15

**Deplasman (${matchData.awayTeam.name}) Son 5 Maç:**
- Form: ${matchData.awayTeam.form.formString}
- Galibiyet/Beraberlik/Mağlubiyet: ${matchData.awayTeam.form.wins}/${matchData.awayTeam.form.draws}/${matchData.awayTeam.form.losses}
- Atılan Gol Ort: ${matchData.awayTeam.form.avgScored}
- Yenilen Gol Ort: ${matchData.awayTeam.form.avgConceded}
- Son 5 Maçta Puan: ${matchData.awayTeam.form.points}/15`;

  try {
    const response = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1500,
      messages: [
        { role: 'user', content: userPrompt },
      ],
    });

    const content = response.content[0];
    if (content.type === 'text') {
      return content.text;
    }
    return 'Analiz oluşturulamadı.';
  } catch (error: any) {
    console.error('Claude Error:', error);
    return `❌ Claude Hatası: ${error.message}`;
  }
}

export async function analyzeMatch(matchData: MatchAnalysisData, provider: 'openai' | 'claude' = 'openai'): Promise<string> {
  if (provider === 'claude') {
    return analyzeWithClaude(matchData);
  }
  return analyzeWithOpenAI(matchData);
}
