import { NextResponse } from 'next/server';

const SPORTMONKS_API_KEY = process.env.SPORTMONKS_API_KEY;
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { homeTeamId, homeTeamName, awayTeamId, awayTeamName, competition, matchDate } = body;
    
    // Get team data from Sportmonks
    const [homeTeamRes, awayTeamRes, h2hRes] = await Promise.all([
      fetch(`https://api.sportmonks.com/v3/football/teams/${homeTeamId}?api_token=${SPORTMONKS_API_KEY}&include=statistics`),
      fetch(`https://api.sportmonks.com/v3/football/teams/${awayTeamId}?api_token=${SPORTMONKS_API_KEY}&include=statistics`),
      fetch(`https://api.sportmonks.com/v3/football/fixtures/head-to-head/${homeTeamId}/${awayTeamId}?api_token=${SPORTMONKS_API_KEY}&include=participants;scores&per_page=5`)
    ]);
    
    const homeTeam = await homeTeamRes.json();
    const awayTeam = await awayTeamRes.json();
    const h2h = await h2hRes.json();
    
    // Format H2H data
    const h2hMatches = (h2h.data || []).map((match: any) => {
      const home = match.participants?.find((p: any) => p.meta?.location === 'home');
      const away = match.participants?.find((p: any) => p.meta?.location === 'away');
      const homeScore = match.scores?.find((s: any) => s.description === 'CURRENT' && s.score?.participant === 'home')?.score?.goals || 0;
      const awayScore = match.scores?.find((s: any) => s.description === 'CURRENT' && s.score?.participant === 'away')?.score?.goals || 0;
      return `${home?.name} ${homeScore}-${awayScore} ${away?.name}`;
    }).join('\n');

    const analysisPrompt = `Futbol Maç Analizi:

**Maç:** ${homeTeamName} vs ${awayTeamName}
**Lig:** ${competition}
**Tarih:** ${matchDate}

**Ev Sahibi: ${homeTeamName}**
- Şehir: ${homeTeam.data?.city || 'Bilinmiyor'}
- Kuruluş: ${homeTeam.data?.founded || 'Bilinmiyor'}

**Deplasman: ${awayTeamName}**
- Şehir: ${awayTeam.data?.city || 'Bilinmiyor'}
- Kuruluş: ${awayTeam.data?.founded || 'Bilinmiyor'}

**Son Karşılaşmalar (H2H):**
${h2hMatches || 'Veri yok'}

---

SADECE şu formatta JSON yanıt ver, başka hiçbir şey yazma:
{
  "ms_tahmini": "1" veya "X" veya "2",
  "ms_guven": 50-100 arası sayı,
  "gol_tahmini": "ALT" veya "UST",
  "gol_guven": 50-100 arası sayı,
  "skor": "X-X" formatında,
  "kg_var_mi": "VAR" veya "YOK",
  "kg_guven": 50-100 arası sayı,
  "aciklama": "Kısa analiz açıklaması"
}`;

    // Call both AIs in parallel
    const [claudeRes, openaiRes] = await Promise.all([
      // Claude API
      fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'x-api-key': ANTHROPIC_API_KEY!,
          'content-type': 'application/json',
          'anthropic-version': '2023-06-01'
        },
        body: JSON.stringify({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 1000,
          messages: [{ role: 'user', content: analysisPrompt }],
          system: 'Sen profesyonel bir futbol analisti ve bahis uzmanısın. SADECE istenen JSON formatında yanıt ver, başka hiçbir şey yazma.'
        })
      }),
      // OpenAI API
      fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${OPENAI_API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: [
            { role: 'system', content: 'Sen profesyonel bir futbol analisti ve bahis uzmanısın. SADECE istenen JSON formatında yanıt ver, başka hiçbir şey yazma.' },
            { role: 'user', content: analysisPrompt }
          ],
          temperature: 0.3,
          max_tokens: 1000
        })
      })
    ]);

    const claudeData = await claudeRes.json();
    const openaiData = await openaiRes.json();

    // Parse responses
    let claudePrediction, openaiPrediction;
    
    try {
      const claudeText = claudeData.content?.[0]?.text || '{}';
      claudePrediction = JSON.parse(claudeText.replace(/```json\n?|\n?```/g, '').trim());
    } catch {
      claudePrediction = null;
    }
    
    try {
      const openaiText = openaiData.choices?.[0]?.message?.content || '{}';
      openaiPrediction = JSON.parse(openaiText.replace(/```json\n?|\n?```/g, '').trim());
    } catch {
      openaiPrediction = null;
    }

    // Compare predictions and find consensus
    let consensus = {
      hasConsensus: false,
      ms_tahmini: null as string | null,
      ms_guven: 0,
      gol_tahmini: null as string | null,
      gol_guven: 0,
      kg_tahmini: null as string | null,
      kg_guven: 0,
      skor_claude: '',
      skor_openai: '',
      agreements: [] as string[],
      disagreements: [] as string[]
    };

    if (claudePrediction && openaiPrediction) {
      // MS (Maç Sonucu) karşılaştırması
      if (claudePrediction.ms_tahmini === openaiPrediction.ms_tahmini) {
        consensus.ms_tahmini = claudePrediction.ms_tahmini;
        consensus.ms_guven = Math.round((claudePrediction.ms_guven + openaiPrediction.ms_guven) / 2);
        consensus.agreements.push(`MS: ${claudePrediction.ms_tahmini}`);
        consensus.hasConsensus = true;
      } else {
        consensus.disagreements.push(`MS: Claude=${claudePrediction.ms_tahmini}, OpenAI=${openaiPrediction.ms_tahmini}`);
      }

      // Gol (Üst/Alt 2.5) karşılaştırması
      if (claudePrediction.gol_tahmini === openaiPrediction.gol_tahmini) {
        consensus.gol_tahmini = claudePrediction.gol_tahmini;
        consensus.gol_guven = Math.round((claudePrediction.gol_guven + openaiPrediction.gol_guven) / 2);
        consensus.agreements.push(`2.5 Gol: ${claudePrediction.gol_tahmini}`);
        consensus.hasConsensus = true;
      } else {
        consensus.disagreements.push(`Gol: Claude=${claudePrediction.gol_tahmini}, OpenAI=${openaiPrediction.gol_tahmini}`);
      }

      // KG (Karşılıklı Gol) karşılaştırması
      if (claudePrediction.kg_var_mi === openaiPrediction.kg_var_mi) {
        consensus.kg_tahmini = claudePrediction.kg_var_mi;
        consensus.kg_guven = Math.round((claudePrediction.kg_guven + openaiPrediction.kg_guven) / 2);
        consensus.agreements.push(`KG: ${claudePrediction.kg_var_mi}`);
        consensus.hasConsensus = true;
      } else {
        consensus.disagreements.push(`KG: Claude=${claudePrediction.kg_var_mi}, OpenAI=${openaiPrediction.kg_var_mi}`);
      }

      consensus.skor_claude = claudePrediction.skor;
      consensus.skor_openai = openaiPrediction.skor;
    }

    // Build final analysis text
    let analysisText = `🤖 **ÇİFT AI ANALİZİ**\n`;
    analysisText += `📊 ${homeTeamName} vs ${awayTeamName}\n\n`;

    if (consensus.hasConsensus && consensus.agreements.length > 0) {
      analysisText += `✅ **ORTAK TAHMİNLER (Güvenilir)**\n`;
      analysisText += `━━━━━━━━━━━━━━━━━━━━━\n`;
      
      if (consensus.ms_tahmini) {
        const msText = consensus.ms_tahmini === '1' ? homeTeamName : consensus.ms_tahmini === '2' ? awayTeamName : 'Beraberlik';
        analysisText += `🎯 **Maç Sonucu:** ${msText} (${consensus.ms_tahmini}) - %${consensus.ms_guven} güven\n`;
      }
      
      if (consensus.gol_tahmini) {
        analysisText += `⚽ **2.5 Gol:** ${consensus.gol_tahmini} 2.5 - %${consensus.gol_guven} güven\n`;
      }
      
      if (consensus.kg_tahmini) {
        analysisText += `🥅 **Karşılıklı Gol:** ${consensus.kg_tahmini} - %${consensus.kg_guven} güven\n`;
      }
      
      analysisText += `\n`;
    }

    if (consensus.disagreements.length > 0) {
      analysisText += `⚠️ **FARKLI TAHMİNLER (Riskli)**\n`;
      analysisText += `━━━━━━━━━━━━━━━━━━━━━\n`;
      consensus.disagreements.forEach(d => {
        analysisText += `❌ ${d}\n`;
      });
      analysisText += `\n`;
    }

    analysisText += `📈 **SKOR TAHMİNLERİ**\n`;
    analysisText += `━━━━━━━━━━━━━━━━━━━━━\n`;
    analysisText += `🟠 Claude: ${consensus.skor_claude || 'Belirsiz'}\n`;
    analysisText += `🟢 OpenAI: ${consensus.skor_openai || 'Belirsiz'}\n\n`;

    analysisText += `📝 **ANALİZ NOTLARI**\n`;
    analysisText += `━━━━━━━━━━━━━━━━━━━━━\n`;
    analysisText += `Claude: ${claudePrediction?.aciklama || 'Analiz yok'}\n\n`;
    analysisText += `OpenAI: ${openaiPrediction?.aciklama || 'Analiz yok'}\n\n`;

    analysisText += `━━━━━━━━━━━━━━━━━━━━━\n`;
    analysisText += `💡 *Sadece iki AI'ın aynı fikirde olduğu tahminler güvenilirdir.*`;

    return NextResponse.json({
      success: true,
      analysis: analysisText,
      consensus,
      claudePrediction,
      openaiPrediction,
      homeTeam: homeTeam.data,
      awayTeam: awayTeam.data,
      h2h: h2h.data
    });
    
  } catch (error: any) {
    console.error('Analyze API Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
