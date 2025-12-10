import { NextResponse } from 'next/server';

const SPORTMONKS_API_KEY = process.env.SPORTMONKS_API_KEY;
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const PERPLEXITY_API_KEY = process.env.PERPLEXITY_API_KEY;

// AI Prediction Interface
interface AIPrediction {
  agent: string;
  ms_tahmini: string;
  ms_guven: number;
  gol_tahmini: string;
  gol_guven: number;
  kg_var_mi: string;
  kg_guven: number;
  skor: string;
  iy_ms?: string;
  iy_ms_guven?: number;
  aciklama: string;
}

// Parse AI response to JSON
function parseAIResponse(text: string): any {
  try {
    const cleanText = text.replace(/```json\n?|\n?```/g, '').trim();
    return JSON.parse(cleanText);
  } catch {
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      try {
        return JSON.parse(jsonMatch[0]);
      } catch {
        return null;
      }
    }
    return null;
  }
}

// Claude Agent
async function claudeAgent(prompt: string, systemPrompt: string): Promise<string | null> {
  if (!ANTHROPIC_API_KEY) return null;
  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': ANTHROPIC_API_KEY,
        'content-type': 'application/json',
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1500,
        messages: [{ role: 'user', content: prompt }],
        system: systemPrompt,
        temperature: 0.3
      })
    });
    const data = await res.json();
    return data.content?.[0]?.text || null;
  } catch (error) {
    console.error('Claude error:', error);
    return null;
  }
}

// OpenAI Agent (upgraded to gpt-4o)
async function openaiAgent(prompt: string, systemPrompt: string): Promise<string | null> {
  if (!OPENAI_API_KEY) return null;
  try {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: prompt }
        ],
        temperature: 0.3,
        max_tokens: 1500
      })
    });
    const data = await res.json();
    return data.choices?.[0]?.message?.content || null;
  } catch (error) {
    console.error('OpenAI error:', error);
    return null;
  }
}

// Gemini Agent
async function geminiAgent(prompt: string, systemPrompt: string): Promise<string | null> {
  if (!GEMINI_API_KEY) return null;
  try {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: `${systemPrompt}\n\n${prompt}` }] }],
        generationConfig: { temperature: 0.3, maxOutputTokens: 1500 }
      })
    });
    const data = await res.json();
    return data.candidates?.[0]?.content?.parts?.[0]?.text || null;
  } catch (error) {
    console.error('Gemini error:', error);
    return null;
  }
}

// Perplexity News Agent (for injuries/news)
async function perplexityNewsAgent(homeTeam: string, awayTeam: string, competition: string): Promise<string | null> {
  if (!PERPLEXITY_API_KEY) return null;
  try {
    const res = await fetch('https://api.perplexity.ai/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${PERPLEXITY_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'llama-3.1-sonar-small-128k-online',
        messages: [
          {
            role: 'system',
            content: 'Sen futbol haberleri uzmanisın. Mac oncesi guncel sakatlık, ceza ve onemli haberleri KISA ve OZ sekilde raporla. Turkce yanit ver.'
          },
          {
            role: 'user',
            content: `${homeTeam} vs ${awayTeam} (${competition}) maci icin guncel haberler:
1. Her iki takimin sakat/cezali oyunculari
2. Son dakika transfer haberleri
3. Teknik direktor aciklamalari
4. Onemli form bilgileri

Kisa ve oz yanit ver, maksimum 150 kelime.`
          }
        ],
        temperature: 0.2,
        max_tokens: 400
      })
    });
    const data = await res.json();
    return data.choices?.[0]?.message?.content || null;
  } catch (error) {
    console.error('Perplexity error:', error);
    return null;
  }
}

// Perplexity Prediction Agent
async function perplexityPredictionAgent(prompt: string, systemPrompt: string): Promise<string | null> {
  if (!PERPLEXITY_API_KEY) return null;
  try {
    const res = await fetch('https://api.perplexity.ai/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${PERPLEXITY_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'llama-3.1-sonar-large-128k-online',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: prompt }
        ],
        temperature: 0.3,
        max_tokens: 1500
      })
    });
    const data = await res.json();
    return data.choices?.[0]?.message?.content || null;
  } catch (error) {
    console.error('Perplexity prediction error:', error);
    return null;
  }
}

// Calculate multi-AI consensus
function calculateMultiAIConsensus(predictions: AIPrediction[]) {
  const validPredictions = predictions.filter(p => p !== null);
  const totalAgents = validPredictions.length;

  if (totalAgents === 0) {
    return { hasConsensus: false, agreements: [], disagreements: [], totalAgents: 0 };
  }

  const msVotes: Record<string, number> = {};
  const golVotes: Record<string, number> = {};
  const kgVotes: Record<string, number> = {};
  const iyMsVotes: Record<string, number> = {};

  let totalMsConf = 0, totalGolConf = 0, totalKgConf = 0, totalIyMsConf = 0;
  const scores: string[] = [];

  validPredictions.forEach(p => {
    if (p.ms_tahmini) {
      msVotes[p.ms_tahmini] = (msVotes[p.ms_tahmini] || 0) + 1;
      totalMsConf += p.ms_guven || 60;
    }
    if (p.gol_tahmini) {
      golVotes[p.gol_tahmini] = (golVotes[p.gol_tahmini] || 0) + 1;
      totalGolConf += p.gol_guven || 60;
    }
    if (p.kg_var_mi) {
      kgVotes[p.kg_var_mi] = (kgVotes[p.kg_var_mi] || 0) + 1;
      totalKgConf += p.kg_guven || 60;
    }
    if (p.iy_ms) {
      iyMsVotes[p.iy_ms] = (iyMsVotes[p.iy_ms] || 0) + 1;
      totalIyMsConf += p.iy_ms_guven || 50;
    }
    if (p.skor) scores.push(p.skor);
  });

  const getWinner = (votes: Record<string, number>) => {
    const sorted = Object.entries(votes).sort((a, b) => b[1] - a[1]);
    return sorted[0] ? { value: sorted[0][0], count: sorted[0][1] } : null;
  };

  const msWinner = getWinner(msVotes);
  const golWinner = getWinner(golVotes);
  const kgWinner = getWinner(kgVotes);
  const iyMsWinner = getWinner(iyMsVotes);

  const agreements: string[] = [];
  const disagreements: string[] = [];

  const consensus: any = {
    hasConsensus: false,
    totalAgents,
    ms_tahmini: null,
    ms_guven: 0,
    ms_votes: 0,
    gol_tahmini: null,
    gol_guven: 0,
    gol_votes: 0,
    kg_tahmini: null,
    kg_guven: 0,
    kg_votes: 0,
    iy_ms_tahmini: null,
    iy_ms_guven: 0,
    iy_ms_votes: 0,
    scores,
    agreements,
    disagreements
  };

  // MS consensus (need at least 50% agreement)
  if (msWinner && msWinner.count >= Math.ceil(totalAgents / 2)) {
    consensus.ms_tahmini = msWinner.value;
    consensus.ms_votes = msWinner.count;
    consensus.ms_guven = Math.round(totalMsConf / totalAgents);
    agreements.push(`MS: ${msWinner.value} (${msWinner.count}/${totalAgents})`);
    consensus.hasConsensus = true;
  } else if (msWinner) {
    disagreements.push(`MS: ${Object.entries(msVotes).map(([k, v]) => `${k}=${v}`).join(', ')}`);
  }

  // Gol consensus
  if (golWinner && golWinner.count >= Math.ceil(totalAgents / 2)) {
    consensus.gol_tahmini = golWinner.value;
    consensus.gol_votes = golWinner.count;
    consensus.gol_guven = Math.round(totalGolConf / totalAgents);
    agreements.push(`2.5 Gol: ${golWinner.value} (${golWinner.count}/${totalAgents})`);
    consensus.hasConsensus = true;
  } else if (golWinner) {
    disagreements.push(`Gol: ${Object.entries(golVotes).map(([k, v]) => `${k}=${v}`).join(', ')}`);
  }

  // KG consensus
  if (kgWinner && kgWinner.count >= Math.ceil(totalAgents / 2)) {
    consensus.kg_tahmini = kgWinner.value;
    consensus.kg_votes = kgWinner.count;
    consensus.kg_guven = Math.round(totalKgConf / totalAgents);
    agreements.push(`KG: ${kgWinner.value} (${kgWinner.count}/${totalAgents})`);
    consensus.hasConsensus = true;
  } else if (kgWinner) {
    disagreements.push(`KG: ${Object.entries(kgVotes).map(([k, v]) => `${k}=${v}`).join(', ')}`);
  }

  // IY/MS consensus (stricter - need 3/4)
  if (iyMsWinner && iyMsWinner.count >= 3) {
    consensus.iy_ms_tahmini = iyMsWinner.value;
    consensus.iy_ms_votes = iyMsWinner.count;
    consensus.iy_ms_guven = Math.round(totalIyMsConf / totalAgents);
    agreements.push(`IY/MS: ${iyMsWinner.value} (${iyMsWinner.count}/${totalAgents})`);
  } else if (iyMsWinner) {
    disagreements.push(`IY/MS: ${Object.entries(iyMsVotes).map(([k, v]) => `${k}=${v}`).join(', ')}`);
  }

  return consensus;
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { homeTeamId, homeTeamName, awayTeamId, awayTeamName, competition, matchDate } = body;

    // Validate
    if (!homeTeamName || !awayTeamName) {
      return NextResponse.json({
        error: 'Eksik parametreler: homeTeamName ve awayTeamName gerekli'
      }, { status: 400 });
    }

    const effectiveHomeId = homeTeamId || 0;
    const effectiveAwayId = awayTeamId || 0;

    console.log(`🔍 Analyzing: ${homeTeamName} vs ${awayTeamName}`);

    // Step 1: Fetch data from Sportmonks (parallel)
    const [homeTeamRes, awayTeamRes, h2hRes, homeRecentRes, awayRecentRes] = await Promise.all([
      effectiveHomeId ? fetch(`https://api.sportmonks.com/v3/football/teams/${effectiveHomeId}?api_token=${SPORTMONKS_API_KEY}&include=statistics`) : Promise.resolve(null),
      effectiveAwayId ? fetch(`https://api.sportmonks.com/v3/football/teams/${effectiveAwayId}?api_token=${SPORTMONKS_API_KEY}&include=statistics`) : Promise.resolve(null),
      (effectiveHomeId && effectiveAwayId) ? fetch(`https://api.sportmonks.com/v3/football/fixtures/head-to-head/${effectiveHomeId}/${effectiveAwayId}?api_token=${SPORTMONKS_API_KEY}&include=participants;scores&per_page=10`) : Promise.resolve(null),
      effectiveHomeId ? fetch(`https://api.sportmonks.com/v3/football/fixtures/between/${getDateRange(-60)}/${getDateRange(0)}/${effectiveHomeId}?api_token=${SPORTMONKS_API_KEY}&include=participants;scores&per_page=10`) : Promise.resolve(null),
      effectiveAwayId ? fetch(`https://api.sportmonks.com/v3/football/fixtures/between/${getDateRange(-60)}/${getDateRange(0)}/${effectiveAwayId}?api_token=${SPORTMONKS_API_KEY}&include=participants;scores&per_page=10`) : Promise.resolve(null)
    ]);

    const homeTeam = homeTeamRes ? await homeTeamRes.json() : { data: null };
    const awayTeam = awayTeamRes ? await awayTeamRes.json() : { data: null };
    const h2h = h2hRes ? await h2hRes.json() : { data: [] };
    const homeRecent = homeRecentRes ? await homeRecentRes.json() : { data: [] };
    const awayRecent = awayRecentRes ? await awayRecentRes.json() : { data: [] };

    // Calculate form
    const calculateForm = (matches: any[], teamId: number) => {
      if (!matches || !Array.isArray(matches)) return [];
      return matches.slice(0, 5).map((m: any) => {
        const home = m.participants?.find((p: any) => p.meta?.location === 'home');
        const away = m.participants?.find((p: any) => p.meta?.location === 'away');
        const homeScore = m.scores?.find((s: any) => s.description === 'CURRENT' && s.score?.participant === 'home')?.score?.goals || 0;
        const awayScore = m.scores?.find((s: any) => s.description === 'CURRENT' && s.score?.participant === 'away')?.score?.goals || 0;
        const isHome = home?.id === teamId;
        const teamScore = isHome ? homeScore : awayScore;
        const oppScore = isHome ? awayScore : homeScore;
        if (teamScore > oppScore) return 'G';
        if (teamScore < oppScore) return 'M';
        return 'B';
      });
    };

    const homeForm = calculateForm(homeRecent.data || [], effectiveHomeId);
    const awayForm = calculateForm(awayRecent.data || [], effectiveAwayId);

    // Format H2H
    const h2hMatches = (h2h.data || []).map((match: any) => {
      const home = match.participants?.find((p: any) => p.meta?.location === 'home');
      const away = match.participants?.find((p: any) => p.meta?.location === 'away');
      const homeScore = match.scores?.find((s: any) => s.description === 'CURRENT' && s.score?.participant === 'home')?.score?.goals || 0;
      const awayScore = match.scores?.find((s: any) => s.description === 'CURRENT' && s.score?.participant === 'away')?.score?.goals || 0;
      return `${home?.name} ${homeScore}-${awayScore} ${away?.name}`;
    }).join('\n');

    // Step 2: Get news from Perplexity
    const newsContext = await perplexityNewsAgent(homeTeamName, awayTeamName, competition || 'Football');
    console.log(`📰 News: ${newsContext ? 'Yes' : 'No'}`);

    // Build enhanced prompt
    const analysisPrompt = `DETAYLI FUTBOL MAC ANALIZI

═══════════════════════════════════════════
MAC BILGISI
═══════════════════════════════════════════
Mac: ${homeTeamName} vs ${awayTeamName}
Lig: ${competition || 'Bilinmiyor'}
Tarih: ${matchDate || 'Bilinmiyor'}

═══════════════════════════════════════════
EV SAHIBI: ${homeTeamName}
═══════════════════════════════════════════
Sehir: ${homeTeam.data?.city || 'Bilinmiyor'}
Kurulus: ${homeTeam.data?.founded || 'Bilinmiyor'}
Son 5 Mac Formu: ${homeForm.join('-') || 'Veri yok'}

═══════════════════════════════════════════
DEPLASMAN: ${awayTeamName}
═══════════════════════════════════════════
Sehir: ${awayTeam.data?.city || 'Bilinmiyor'}
Kurulus: ${awayTeam.data?.founded || 'Bilinmiyor'}
Son 5 Mac Formu: ${awayForm.join('-') || 'Veri yok'}

═══════════════════════════════════════════
KARSILASMA GECMISI (H2H) - Son ${(h2h.data || []).length} Mac
═══════════════════════════════════════════
${h2hMatches || 'Veri yok'}

${newsContext ? `═══════════════════════════════════════════
GUNCEL HABERLER VE SAKATLIKLAR
═══════════════════════════════════════════
${newsContext}` : ''}

═══════════════════════════════════════════
ANALIZ TALIMATLARI
═══════════════════════════════════════════
Yukaridaki verileri kullanarak detayli analiz yap.

SADECE su formatta JSON yanit ver, baska hicbir sey yazma:
{
  "ms_tahmini": "1" veya "X" veya "2",
  "ms_guven": 50-100 arasi sayi,
  "gol_tahmini": "ALT" veya "UST",
  "gol_guven": 50-100 arasi sayi,
  "skor": "X-X" formatinda en olasi skor,
  "kg_var_mi": "VAR" veya "YOK",
  "kg_guven": 50-100 arasi sayi,
  "iy_ms": "1/1", "1/X", "1/2", "X/1", "X/X", "X/2", "2/1", "2/X" veya "2/2",
  "iy_ms_guven": 50-100 arasi sayi,
  "aciklama": "3-4 cumlelik detayli analiz aciklamasi"
}`;

    const systemPrompt = `Sen dunya capinda taninan profesyonel bir futbol analisti ve istatistikcisisin.
Verilen detayli istatistikleri analiz ederek mac tahminleri yapiyorsun.
Tahminlerini SADECE verilen verilere dayandir, spekulasyon yapma.
Guven oranlarini gercekci tut - %90+ sadece cok net durumlarda kullan.
SADECE istenen JSON formatinda yanit ver, baska hicbir sey yazma.`;

    // Step 3: Call all 4 AI agents in parallel
    console.log(`🤖 Calling 4 AI agents in parallel...`);
    const startTime = Date.now();

    const [claudeText, openaiText, geminiText, perplexityText] = await Promise.all([
      claudeAgent(analysisPrompt, systemPrompt),
      openaiAgent(analysisPrompt, systemPrompt),
      geminiAgent(analysisPrompt, systemPrompt),
      perplexityPredictionAgent(analysisPrompt, systemPrompt)
    ]);

    const elapsed = Date.now() - startTime;
    console.log(`✅ All agents responded in ${elapsed}ms`);

    // Parse responses
    const predictions: AIPrediction[] = [];

    if (claudeText) {
      const parsed = parseAIResponse(claudeText);
      if (parsed) predictions.push({ agent: 'Claude', ...parsed });
    }
    if (openaiText) {
      const parsed = parseAIResponse(openaiText);
      if (parsed) predictions.push({ agent: 'OpenAI', ...parsed });
    }
    if (geminiText) {
      const parsed = parseAIResponse(geminiText);
      if (parsed) predictions.push({ agent: 'Gemini', ...parsed });
    }
    if (perplexityText) {
      const parsed = parseAIResponse(perplexityText);
      if (parsed) predictions.push({ agent: 'Perplexity', ...parsed });
    }

    console.log(`📊 Valid predictions: ${predictions.length}/4`);

    // Calculate consensus
    const consensus = calculateMultiAIConsensus(predictions);

    // Build analysis text
    let analysisText = `🤖 **QUAD AI MAC ANALIZI (4 AI)**\n`;
    analysisText += `📊 ${homeTeamName} vs ${awayTeamName}\n`;
    analysisText += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;

    // AI participation
    analysisText += `**AI KATILIM:** ${predictions.length}/4 (${predictions.map(p => p.agent).join(', ')})\n`;
    analysisText += `**Form:** ${homeTeamName}: ${homeForm.join('-') || 'N/A'} | ${awayTeamName}: ${awayForm.join('-') || 'N/A'}\n\n`;

    // News section
    if (newsContext) {
      analysisText += `📰 **GUNCEL HABERLER (Perplexity):**\n`;
      analysisText += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
      analysisText += `${newsContext.substring(0, 400)}${newsContext.length > 400 ? '...' : ''}\n\n`;
    }

    // Consensus results
    if (consensus.hasConsensus && consensus.agreements.length > 0) {
      analysisText += `✅ **ORTAK TAHMINLER (Konsensus)**\n`;
      analysisText += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;

      if (consensus.ms_tahmini) {
        const msText = consensus.ms_tahmini === '1' ? homeTeamName :
          consensus.ms_tahmini === '2' ? awayTeamName : 'Beraberlik';
        analysisText += `🎯 **Mac Sonucu:** ${msText} (${consensus.ms_tahmini}) - %${Math.min(100, consensus.ms_guven)} guven [${consensus.ms_votes}/${consensus.totalAgents} AI]\n`;
      }

      if (consensus.gol_tahmini) {
        analysisText += `⚽ **2.5 Gol:** ${consensus.gol_tahmini} 2.5 - %${Math.min(100, consensus.gol_guven)} guven [${consensus.gol_votes}/${consensus.totalAgents} AI]\n`;
      }

      if (consensus.kg_tahmini) {
        analysisText += `🥅 **Karsilikli Gol:** ${consensus.kg_tahmini} - %${Math.min(100, consensus.kg_guven)} guven [${consensus.kg_votes}/${consensus.totalAgents} AI]\n`;
      }

      if (consensus.iy_ms_tahmini) {
        analysisText += `⏱️ **IY/MS:** ${consensus.iy_ms_tahmini} - %${Math.min(100, consensus.iy_ms_guven)} guven [${consensus.iy_ms_votes}/${consensus.totalAgents} AI]\n`;
      }

      analysisText += `\n`;
    }

    // Disagreements
    if (consensus.disagreements.length > 0) {
      analysisText += `⚠️ **FARKLI TAHMINLER (Riskli)**\n`;
      analysisText += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
      consensus.disagreements.forEach((d: string) => {
        analysisText += `❌ ${d}\n`;
      });
      analysisText += `\n`;
    }

    // Individual predictions
    analysisText += `📈 **AI TAHMINLERI**\n`;
    analysisText += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
    predictions.forEach(p => {
      analysisText += `${p.agent}: MS=${p.ms_tahmini} | Gol=${p.gol_tahmini} | Skor=${p.skor}\n`;
    });
    analysisText += `\n`;

    // Analysis notes
    analysisText += `📝 **ANALIZ NOTLARI**\n`;
    analysisText += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
    predictions.slice(0, 2).forEach(p => {
      analysisText += `**${p.agent}:** ${p.aciklama}\n\n`;
    });

    analysisText += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
    analysisText += `💡 *${consensus.totalAgents} AI'dan en az ${Math.ceil(consensus.totalAgents / 2)} tanesi hemfikir olmali.*\n`;
    analysisText += `⏱️ Yanit suresi: ${elapsed}ms`;

    return NextResponse.json({
      success: true,
      analysis: analysisText,
      consensus,
      predictions,
      newsContext,
      homeTeam: homeTeam.data,
      awayTeam: awayTeam.data,
      h2h: h2h.data,
      meta: {
        totalAgents: predictions.length,
        responseTime: elapsed,
        agentsUsed: predictions.map(p => p.agent)
      }
    });

  } catch (error: any) {
    console.error('Analyze API Error:', error);
    return NextResponse.json({
      error: error.message || 'Bir hata olustu',
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    }, { status: 500 });
  }
}

// Helper: Get date string
function getDateRange(daysOffset: number): string {
  const date = new Date();
  date.setDate(date.getDate() + daysOffset);
  return date.toISOString().split('T')[0];
}
