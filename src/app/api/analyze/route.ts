import { NextResponse } from 'next/server';
const SPORTMONKS_API_KEY = process.env.SPORTMONKS_API_KEY;
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { homeTeamId, homeTeamName, awayTeamId, awayTeamName, competition, matchDate } = body;
    
    const [homeTeamRes, awayTeamRes, h2hRes] = await Promise.all([
      fetch(`https://api.sportmonks.com/v3/football/teams/${homeTeamId}?api_token=${SPORTMONKS_API_KEY}&include=statistics`),
      fetch(`https://api.sportmonks.com/v3/football/teams/${awayTeamId}?api_token=${SPORTMONKS_API_KEY}&include=statistics`),
      fetch(`https://api.sportmonks.com/v3/football/fixtures/head-to-head/${homeTeamId}/${awayTeamId}?api_token=${SPORTMONKS_API_KEY}&include=participants;scores&per_page=5`)
    ]);
    
    const homeTeam = await homeTeamRes.json();
    const awayTeam = await awayTeamRes.json();
    const h2h = await h2hRes.json();
    
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

    const [claudeRes, openaiRes, geminiRes] = await Promise.all([
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
          system: 'Sen profesyonel bir futbol analisti ve bahis uzmanısın. SADECE istenen JSON formatında yanıt ver.'
        })
      }),
      fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${OPENAI_API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: [
            { role: 'system', content: 'Sen profesyonel bir futbol analisti ve bahis uzmanısın. SADECE istenen JSON formatında yanıt ver.' },
            { role: 'user', content: analysisPrompt }
          ],
          temperature: 0.3,
          max_tokens: 1000
        })
      }),
      fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: `Sen profesyonel bir futbol analisti. SADECE JSON formatında yanıt ver.\n\n${analysisPrompt}` }] }],
          generationConfig: { temperature: 0.3, maxOutputTokens: 1000 }
        })
      })
    ]);

    const claudeData = await claudeRes.json();
    const openaiData = await openaiRes.json();
    const geminiData = await geminiRes.json();

    let claudePrediction, openaiPrediction, geminiPrediction;
    
    try {
      const claudeText = claudeData.content?.[0]?.text || '{}';
      claudePrediction = JSON.parse(claudeText.replace(/```json\n?|\n?```/g, '').trim());
    } catch { claudePrediction = null; }
    
    try {
      const openaiText = openaiData.choices?.[0]?.message?.content || '{}';
      openaiPrediction = JSON.parse(openaiText.replace(/```json\n?|\n?```/g, '').trim());
    } catch { openaiPrediction = null; }

    try {
      const geminiText = geminiData.candidates?.[0]?.content?.parts?.[0]?.text || '{}';
      geminiPrediction = JSON.parse(geminiText.replace(/```json\n?|\n?```/g, '').trim());
    } catch { geminiPrediction = null; }

    const predictions = [claudePrediction, openaiPrediction, geminiPrediction].filter(p => p !== null);
    
    let consensus: any = {
      hasConsensus: false,
      ms_tahmini: null, ms_guven: 0, ms_count: 0,
      gol_tahmini: null, gol_guven: 0, gol_count: 0,
      kg_tahmini: null, kg_guven: 0, kg_count: 0,
      skor_claude: claudePrediction?.skor || '',
      skor_openai: openaiPrediction?.skor || '',
      skor_gemini: geminiPrediction?.skor || '',
      agreements: [], disagreements: []
    };

    // MS voting
    const msVotes: Record<string, number> = {};
    const msGuvens: Record<string, number[]> = {};
    predictions.forEach(p => {
      if (p?.ms_tahmini) {
        msVotes[p.ms_tahmini] = (msVotes[p.ms_tahmini] || 0) + 1;
        if (!msGuvens[p.ms_tahmini]) msGuvens[p.ms_tahmini] = [];
        msGuvens[p.ms_tahmini].push(p.ms_guven || 50);
      }
    });
    for (const [ms, count] of Object.entries(msVotes)) {
      if (count >= 2) {
        consensus.ms_tahmini = ms;
        consensus.ms_guven = Math.round(msGuvens[ms].reduce((a, b) => a + b, 0) / msGuvens[ms].length);
        consensus.ms_count = count;
        consensus.agreements.push(`MS: ${ms} (${count}/3)`);
        consensus.hasConsensus = true;
        break;
      }
    }
    if (!consensus.ms_tahmini) {
      consensus.disagreements.push(`MS: Claude=${claudePrediction?.ms_tahmini}, OpenAI=${openaiPrediction?.ms_tahmini}, Gemini=${geminiPrediction?.ms_tahmini}`);
    }

    // Gol voting
    const golVotes: Record<string, number> = {};
    const golGuvens: Record<string, number[]> = {};
    predictions.forEach(p => {
      if (p?.gol_tahmini) {
        golVotes[p.gol_tahmini] = (golVotes[p.gol_tahmini] || 0) + 1;
        if (!golGuvens[p.gol_tahmini]) golGuvens[p.gol_tahmini] = [];
        golGuvens[p.gol_tahmini].push(p.gol_guven || 50);
      }
    });
    for (const [gol, count] of Object.entries(golVotes)) {
      if (count >= 2) {
        consensus.gol_tahmini = gol;
        consensus.gol_guven = Math.round(golGuvens[gol].reduce((a, b) => a + b, 0) / golGuvens[gol].length);
        consensus.gol_count = count;
        consensus.agreements.push(`Gol: ${gol} (${count}/3)`);
        consensus.hasConsensus = true;
        break;
      }
    }
    if (!consensus.gol_tahmini) {
      consensus.disagreements.push(`Gol: Claude=${claudePrediction?.gol_tahmini}, OpenAI=${openaiPrediction?.gol_tahmini}, Gemini=${geminiPrediction?.gol_tahmini}`);
    }

    // KG voting
    const kgVotes: Record<string, number> = {};
    const kgGuvens: Record<string, number[]> = {};
    predictions.forEach(p => {
      if (p?.kg_var_mi) {
        kgVotes[p.kg_var_mi] = (kgVotes[p.kg_var_mi] || 0) + 1;
        if (!kgGuvens[p.kg_var_mi]) kgGuvens[p.kg_var_mi] = [];
        kgGuvens[p.kg_var_mi].push(p.kg_guven || 50);
      }
    });
    for (const [kg, count] of Object.entries(kgVotes)) {
      if (count >= 2) {
        consensus.kg_tahmini = kg;
        consensus.kg_guven = Math.round(kgGuvens[kg].reduce((a, b) => a + b, 0) / kgGuvens[kg].length);
        consensus.kg_count = count;
        consensus.agreements.push(`KG: ${kg} (${count}/3)`);
        consensus.hasConsensus = true;
        break;
      }
    }
    if (!consensus.kg_tahmini) {
      consensus.disagreements.push(`KG: Claude=${claudePrediction?.kg_var_mi}, OpenAI=${openaiPrediction?.kg_var_mi}, Gemini=${geminiPrediction?.kg_var_mi}`);
    }

    let analysisText = `🤖 **3'LÜ AI ANALİZİ**\n📊 ${homeTeamName} vs ${awayTeamName}\n\n`;

    if (consensus.agreements.length > 0) {
      analysisText += `✅ **ORTAK TAHMİNLER**\n━━━━━━━━━━━━━━━━━━━━━\n`;
      if (consensus.ms_tahmini) {
        const msText = consensus.ms_tahmini === '1' ? homeTeamName : consensus.ms_tahmini === '2' ? awayTeamName : 'Beraberlik';
        const emoji = consensus.ms_count === 3 ? '🎯🎯🎯' : '🎯🎯';
        analysisText += `${emoji} **MS:** ${msText} (${consensus.ms_tahmini}) - %${consensus.ms_guven} [${consensus.ms_count}/3]\n`;
      }
      if (consensus.gol_tahmini) {
        const emoji = consensus.gol_count === 3 ? '⚽⚽⚽' : '⚽⚽';
        analysisText += `${emoji} **2.5 Gol:** ${consensus.gol_tahmini} - %${consensus.gol_guven} [${consensus.gol_count}/3]\n`;
      }
      if (consensus.kg_tahmini) {
        const emoji = consensus.kg_count === 3 ? '🥅🥅🥅' : '🥅🥅';
        analysisText += `${emoji} **KG:** ${consensus.kg_tahmini} - %${consensus.kg_guven} [${consensus.kg_count}/3]\n`;
      }
      analysisText += `\n`;
    }

    if (consensus.disagreements.length > 0) {
      analysisText += `⚠️ **UZLAŞI YOK**\n━━━━━━━━━━━━━━━━━━━━━\n`;
      consensus.disagreements.forEach((d: string) => { analysisText += `❌ ${d}\n`; });
      analysisText += `\n`;
    }

    analysisText += `📈 **SKORLAR**\n━━━━━━━━━━━━━━━━━━━━━\n`;
    analysisText += `🟠 Claude: ${consensus.skor_claude || '-'}\n`;
    analysisText += `🟢 OpenAI: ${consensus.skor_openai || '-'}\n`;
    analysisText += `🔵 Gemini: ${consensus.skor_gemini || '-'}\n\n`;

    analysisText += `📝 **NOTLAR**\n━━━━━━━━━━━━━━━━━━━━━\n`;
    analysisText += `🟠 ${claudePrediction?.aciklama || '-'}\n`;
    analysisText += `🟢 ${openaiPrediction?.aciklama || '-'}\n`;
    analysisText += `🔵 ${geminiPrediction?.aciklama || '-'}\n\n`;
    analysisText += `💡 *3/3 = Çok Güvenilir | 2/3 = Güvenilir*`;

    return NextResponse.json({ success: true, analysis: analysisText, consensus, claudePrediction, openaiPrediction, geminiPrediction });
    
  } catch (error: any) {
    console.error('Analyze API Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

