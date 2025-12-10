import { NextResponse } from 'next/server';
import {
  getComprehensiveMatchData,
  LEAGUES,
  type MatchAnalysisData,
  type H2HMatch
} from '@/lib/sportmonks';

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const PERPLEXITY_API_KEY = process.env.PERPLEXITY_API_KEY;

// AI Agent Types
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

// Build detailed analysis prompt with all available data
function buildAnalysisPrompt(
  matchData: MatchAnalysisData,
  homeTeamName: string,
  awayTeamName: string,
  competition: string,
  matchDate: string,
  newsContext?: string
): string {
  const { homeTeam, awayTeam, h2h, leagueContext, odds } = matchData;

  const h2hSummary = h2h.length > 0
    ? h2h.map((m: H2HMatch) => `  ${m.date.split('T')[0]}: ${m.homeTeam} ${m.homeScore}-${m.awayScore} ${m.awayTeam}`).join('\n')
    : '  Veri yok';

  const h2hStats = {
    total: h2h.length,
    homeWins: h2h.filter((m: H2HMatch) => {
      const isCurrentHome = m.homeTeam.toLowerCase().includes(homeTeamName.toLowerCase().split(' ')[0]);
      return (isCurrentHome && m.winner === 'home') || (!isCurrentHome && m.winner === 'away');
    }).length,
    awayWins: h2h.filter((m: H2HMatch) => {
      const isCurrentAway = m.awayTeam.toLowerCase().includes(awayTeamName.toLowerCase().split(' ')[0]);
      return (isCurrentAway && m.winner === 'away') || (!isCurrentAway && m.winner === 'home');
    }).length,
    draws: h2h.filter((m: H2HMatch) => m.winner === 'draw').length,
    avgGoals: h2h.length > 0
      ? (h2h.reduce((sum: number, m: H2HMatch) => sum + m.homeScore + m.awayScore, 0) / h2h.length).toFixed(2)
      : '0'
  };

  const formatForm = (form: string[]) => form.map(r => {
    if (r === 'W') return 'G';
    if (r === 'L') return 'M';
    return 'B';
  }).join('-') || 'Veri yok';

  const oddsSection = odds
    ? `
**Bahis Oranları (Bookmaker):**
- MS 1: ${odds.home.toFixed(2)} | X: ${odds.draw.toFixed(2)} | 2: ${odds.away.toFixed(2)}
- Üst 2.5: ${odds.over25.toFixed(2)} | Alt 2.5: ${odds.under25.toFixed(2)}
- KG Var: ${odds.bttsYes.toFixed(2)} | KG Yok: ${odds.bttsNo.toFixed(2)}`
    : '';

  const newsSection = newsContext
    ? `
══════════════════════════════════════════════
GÜNCEL HABERLER VE SAKATLAKLAR
══════════════════════════════════════════════
${newsContext}`
    : '';

  return `DETAYLI FUTBOL MAÇ ANALİZİ

══════════════════════════════════════════════
MAÇ BİLGİSİ
══════════════════════════════════════════════
Maç: ${homeTeamName} vs ${awayTeamName}
Lig: ${competition} (${leagueContext.name})
Tarih: ${matchDate}
Sıralama Farkı: ${leagueContext.positionGap} basamak
Puan Farkı: ${leagueContext.pointsGap} puan

══════════════════════════════════════════════
EV SAHİBİ: ${homeTeamName}
══════════════════════════════════════════════
📊 Lig Durumu:
- Sıralama: ${homeTeam.position}. sıra (${homeTeam.points} puan)
- Maç: ${homeTeam.played} | G: ${homeTeam.won} | B: ${homeTeam.drawn} | M: ${homeTeam.lost}
- Attığı/Yediği: ${homeTeam.goalsFor}/${homeTeam.goalsAgainst} (Averaj: ${homeTeam.goalDifference > 0 ? '+' : ''}${homeTeam.goalDifference})

🏠 Ev Sahibi Performansı:
- Ev G/B/M: ${homeTeam.homeWon}/${homeTeam.homeDrawn}/${homeTeam.homeLost}
- Ev Gol: ${homeTeam.homeGoalsFor} attı, ${homeTeam.homeGoalsAgainst} yedi

📈 Son Form: ${formatForm(homeTeam.last5)} (Son 5 maç)
- Gol Ortalaması: ${homeTeam.avgGoalsScored} attı, ${homeTeam.avgGoalsConceded} yedi
- Gol Yemeden: ${homeTeam.cleanSheets}/10 maç
- Gol Atamadan: ${homeTeam.failedToScore}/10 maç

══════════════════════════════════════════════
DEPLASMAN: ${awayTeamName}
══════════════════════════════════════════════
📊 Lig Durumu:
- Sıralama: ${awayTeam.position}. sıra (${awayTeam.points} puan)
- Maç: ${awayTeam.played} | G: ${awayTeam.won} | B: ${awayTeam.drawn} | M: ${awayTeam.lost}
- Attığı/Yediği: ${awayTeam.goalsFor}/${awayTeam.goalsAgainst} (Averaj: ${awayTeam.goalDifference > 0 ? '+' : ''}${awayTeam.goalDifference})

✈️ Deplasman Performansı:
- Deplasman G/B/M: ${awayTeam.awayWon}/${awayTeam.awayDrawn}/${awayTeam.awayLost}
- Deplasman Gol: ${awayTeam.awayGoalsFor} attı, ${awayTeam.awayGoalsAgainst} yedi

📈 Son Form: ${formatForm(awayTeam.last5)} (Son 5 maç)
- Gol Ortalaması: ${awayTeam.avgGoalsScored} attı, ${awayTeam.avgGoalsConceded} yedi
- Gol Yemeden: ${awayTeam.cleanSheets}/10 maç
- Gol Atamadan: ${awayTeam.failedToScore}/10 maç

══════════════════════════════════════════════
KARŞILAŞMA GEÇMİŞİ (H2H) - Son ${h2h.length} Maç
══════════════════════════════════════════════
${h2hSummary}

H2H Özeti: ${h2hStats.total} maç | ${homeTeamName} ${h2hStats.homeWins}G | Beraberlik ${h2hStats.draws} | ${awayTeamName} ${h2hStats.awayWins}G
H2H Gol Ortalaması: ${h2hStats.avgGoals} gol/maç
${oddsSection}
${newsSection}

══════════════════════════════════════════════
ANALİZ TALİMATLARI
══════════════════════════════════════════════
Yukarıdaki verileri kullanarak detaylı analiz yap.

SADECE şu formatta JSON yanıt ver, başka hiçbir şey yazma:
{
  "ms_tahmini": "1" veya "X" veya "2",
  "ms_guven": 50-100 arası sayı,
  "gol_tahmini": "ALT" veya "UST",
  "gol_guven": 50-100 arası sayı,
  "skor": "X-X" formatında en olası skor,
  "kg_var_mi": "VAR" veya "YOK",
  "kg_guven": 50-100 arası sayı,
  "iy_ms": "1/1", "1/X", "1/2", "X/1", "X/X", "X/2", "2/1", "2/X" veya "2/2",
  "iy_ms_guven": 50-100 arası sayı,
  "aciklama": "3-4 cümlelik detaylı analiz açıklaması"
}`;
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

// OpenAI Agent
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

// Perplexity Agent (for news/injuries)
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
            content: 'Sen futbol haberleri uzmanısın. Maç öncesi güncel sakatlık, ceza ve önemli haberleri KISA ve ÖZ şekilde raporla. Türkçe yanıt ver.'
          },
          {
            role: 'user',
            content: `${homeTeam} vs ${awayTeam} (${competition}) maçı için güncel haberler:
1. Her iki takımın sakat/cezalı oyuncuları
2. Son dakika transfer haberleri
3. Teknik direktör açıklamaları
4. Önemli form bilgileri

Kısa ve öz yanıt ver, maksimum 200 kelime.`
          }
        ],
        temperature: 0.2,
        max_tokens: 500
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
function calculateMultiAIConsensus(predictions: AIPrediction[], hasOdds: boolean, formQuality: number) {
  const validPredictions = predictions.filter(p => p !== null);
  const totalAgents = validPredictions.length;

  if (totalAgents === 0) {
    return { hasConsensus: false, agreements: [], disagreements: [], votes: {} };
  }

  // Count votes for each category
  const msVotes: Record<string, number> = {};
  const golVotes: Record<string, number> = {};
  const kgVotes: Record<string, number> = {};
  const iyMsVotes: Record<string, number> = {};

  let totalMsConf = 0, totalGolConf = 0, totalKgConf = 0, totalIyMsConf = 0;
  const scores: string[] = [];

  validPredictions.forEach(p => {
    // MS votes
    if (p.ms_tahmini) {
      msVotes[p.ms_tahmini] = (msVotes[p.ms_tahmini] || 0) + 1;
      totalMsConf += p.ms_guven || 60;
    }
    // Gol votes
    if (p.gol_tahmini) {
      golVotes[p.gol_tahmini] = (golVotes[p.gol_tahmini] || 0) + 1;
      totalGolConf += p.gol_guven || 60;
    }
    // KG votes
    if (p.kg_var_mi) {
      kgVotes[p.kg_var_mi] = (kgVotes[p.kg_var_mi] || 0) + 1;
      totalKgConf += p.kg_guven || 60;
    }
    // IY/MS votes
    if (p.iy_ms) {
      iyMsVotes[p.iy_ms] = (iyMsVotes[p.iy_ms] || 0) + 1;
      totalIyMsConf += p.iy_ms_guven || 50;
    }
    // Scores
    if (p.skor) scores.push(p.skor);
  });

  // Find winners
  const getWinner = (votes: Record<string, number>) => {
    const sorted = Object.entries(votes).sort((a, b) => b[1] - a[1]);
    return sorted[0] ? { value: sorted[0][0], count: sorted[0][1] } : null;
  };

  const msWinner = getWinner(msVotes);
  const golWinner = getWinner(golVotes);
  const kgWinner = getWinner(kgVotes);
  const iyMsWinner = getWinner(iyMsVotes);

  // Build consensus
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
    disagreements,
    dataQuality: { hasOdds, formQuality }
  };

  // MS consensus (need at least 50% agreement)
  if (msWinner && msWinner.count >= Math.ceil(totalAgents / 2)) {
    consensus.ms_tahmini = msWinner.value;
    consensus.ms_votes = msWinner.count;
    consensus.ms_guven = Math.round(totalMsConf / totalAgents) + (hasOdds ? 5 : 0) + Math.round(formQuality * 5);
    agreements.push(`MS: ${msWinner.value} (${msWinner.count}/${totalAgents})`);
    consensus.hasConsensus = true;
  } else if (msWinner) {
    disagreements.push(`MS: ${Object.entries(msVotes).map(([k, v]) => `${k}=${v}`).join(', ')}`);
  }

  // Gol consensus
  if (golWinner && golWinner.count >= Math.ceil(totalAgents / 2)) {
    consensus.gol_tahmini = golWinner.value;
    consensus.gol_votes = golWinner.count;
    consensus.gol_guven = Math.round(totalGolConf / totalAgents) + (hasOdds ? 5 : 0) + Math.round(formQuality * 5);
    agreements.push(`2.5 Gol: ${golWinner.value} (${golWinner.count}/${totalAgents})`);
    consensus.hasConsensus = true;
  } else if (golWinner) {
    disagreements.push(`Gol: ${Object.entries(golVotes).map(([k, v]) => `${k}=${v}`).join(', ')}`);
  }

  // KG consensus
  if (kgWinner && kgWinner.count >= Math.ceil(totalAgents / 2)) {
    consensus.kg_tahmini = kgWinner.value;
    consensus.kg_votes = kgWinner.count;
    consensus.kg_guven = Math.round(totalKgConf / totalAgents) + (hasOdds ? 5 : 0) + Math.round(formQuality * 5);
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
    agreements.push(`İY/MS: ${iyMsWinner.value} (${iyMsWinner.count}/${totalAgents})`);
  } else if (iyMsWinner) {
    disagreements.push(`İY/MS: ${Object.entries(iyMsVotes).map(([k, v]) => `${k}=${v}`).join(', ')}`);
  }

  return consensus;
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const {
      fixtureId,
      homeTeamId,
      homeTeamName,
      awayTeamId,
      awayTeamName,
      competition,
      matchDate,
      leagueId
    } = body;

    // Validate required parameters - allow 0 for IDs but require names
    if (!homeTeamName || !awayTeamName) {
      return NextResponse.json({
        error: 'Eksik parametreler: homeTeamName ve awayTeamName gerekli'
      }, { status: 400 });
    }

    // If team IDs are missing or 0, try to work with names only
    const effectiveHomeTeamId = homeTeamId || 0;
    const effectiveAwayTeamId = awayTeamId || 0;

    if (!effectiveHomeTeamId || !effectiveAwayTeamId) {
      console.warn(`⚠️ Team IDs missing: home=${effectiveHomeTeamId}, away=${effectiveAwayTeamId}. Analysis may be limited.`);
    }

    console.log(`🔍 Analyzing: ${homeTeamName} vs ${awayTeamName}`);

    // Get comprehensive match data
    const effectiveLeagueId = leagueId || Object.values(LEAGUES)[0].id;
    const matchData = await getComprehensiveMatchData(
      effectiveHomeTeamId,
      effectiveAwayTeamId,
      effectiveLeagueId,
      fixtureId
    );

    if (!matchData) {
      return NextResponse.json({
        error: 'Maç verileri alınamadı.'
      }, { status: 500 });
    }

    // Step 1: Get news from Perplexity (parallel with other calls)
    const newsPromise = perplexityNewsAgent(homeTeamName, awayTeamName, competition || 'Football');

    // Wait for news first
    const newsContext = await newsPromise;
    console.log(`📰 News fetched: ${newsContext ? 'Yes' : 'No'}`);

    // Build prompt with news context
    const analysisPrompt = buildAnalysisPrompt(
      matchData,
      homeTeamName,
      awayTeamName,
      competition || 'Bilinmeyen Lig',
      matchDate || new Date().toISOString().split('T')[0],
      newsContext || undefined
    );

    const systemPrompt = `Sen dünya çapında tanınan profesyonel bir futbol analisti ve istatistikçisin.
Verilen detaylı istatistikleri analiz ederek maç tahminleri yapıyorsun.
Tahminlerini SADECE verilen verilere dayandır, spekülasyon yapma.
Güven oranlarını gerçekçi tut - %90+ sadece çok net durumlarda kullan.
SADECE istenen JSON formatında yanıt ver, başka hiçbir şey yazma.`;

    // Step 2: Call all 4 AI agents in parallel
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

    // Calculate form quality
    const formQuality = Math.min(
      matchData.homeTeam.last5.length,
      matchData.awayTeam.last5.length
    ) / 5;

    // Calculate multi-AI consensus
    const consensus = calculateMultiAIConsensus(
      predictions,
      !!matchData.odds,
      formQuality
    );

    // Build analysis text
    let analysisText = `**QUAD AI MAÇ ANALİZİ (4 AI)**\n`;
    analysisText += `${homeTeamName} vs ${awayTeamName}\n`;
    analysisText += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;

    // Data quality indicator
    const qualityScore = [
      !!matchData.odds,
      matchData.h2h.length >= 3,
      matchData.homeTeam.last5.length >= 3,
      matchData.awayTeam.last5.length >= 3,
      matchData.homeTeam.position > 0
    ].filter(Boolean).length;

    analysisText += `**VERİ KALİTESİ:** ${'★'.repeat(qualityScore)}${'☆'.repeat(5 - qualityScore)} (${qualityScore}/5)\n`;
    analysisText += `**AI KATILIM:** ${predictions.length}/4 (${predictions.map(p => p.agent).join(', ')})\n`;
    analysisText += `Sıralama: ${matchData.homeTeam.position}. vs ${matchData.awayTeam.position}. | H2H: ${matchData.h2h.length} maç\n\n`;

    // Forms
    analysisText += `**SON FORM:**\n`;
    analysisText += `${homeTeamName}: ${matchData.homeTeam.form || 'N/A'} (Gol: ${matchData.homeTeam.avgGoalsScored})\n`;
    analysisText += `${awayTeamName}: ${matchData.awayTeam.form || 'N/A'} (Gol: ${matchData.awayTeam.avgGoalsScored})\n\n`;

    // News section
    if (newsContext) {
      analysisText += `**GÜNCEL HABERLER (Perplexity):**\n`;
      analysisText += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
      analysisText += `${newsContext.substring(0, 500)}${newsContext.length > 500 ? '...' : ''}\n\n`;
    }

    // Consensus results
    if (consensus.hasConsensus && consensus.agreements.length > 0) {
      analysisText += `**ORTAK TAHMİNLER (Konsensus)**\n`;
      analysisText += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;

      if (consensus.ms_tahmini) {
        const msText = consensus.ms_tahmini === '1' ? homeTeamName :
          consensus.ms_tahmini === '2' ? awayTeamName : 'Beraberlik';
        analysisText += `**Maç Sonucu:** ${msText} (${consensus.ms_tahmini}) - %${Math.min(100, consensus.ms_guven)} güven [${consensus.ms_votes}/${consensus.totalAgents} AI]\n`;
      }

      if (consensus.gol_tahmini) {
        analysisText += `**2.5 Gol:** ${consensus.gol_tahmini} 2.5 - %${Math.min(100, consensus.gol_guven)} güven [${consensus.gol_votes}/${consensus.totalAgents} AI]\n`;
      }

      if (consensus.kg_tahmini) {
        analysisText += `**Karşılıklı Gol:** ${consensus.kg_tahmini} - %${Math.min(100, consensus.kg_guven)} güven [${consensus.kg_votes}/${consensus.totalAgents} AI]\n`;
      }

      if (consensus.iy_ms_tahmini) {
        analysisText += `**İY/MS:** ${consensus.iy_ms_tahmini} - %${Math.min(100, consensus.iy_ms_guven)} güven [${consensus.iy_ms_votes}/${consensus.totalAgents} AI]\n`;
      }

      analysisText += `\n`;
    }

    // Disagreements
    if (consensus.disagreements.length > 0) {
      analysisText += `**FARKLI TAHMİNLER (Riskli)**\n`;
      analysisText += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
      consensus.disagreements.forEach((d: string) => {
        analysisText += `${d}\n`;
      });
      analysisText += `\n`;
    }

    // Individual predictions
    analysisText += `**AI TAHMİNLERİ**\n`;
    analysisText += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
    predictions.forEach(p => {
      analysisText += `${p.agent}: MS=${p.ms_tahmini} | Gol=${p.gol_tahmini} | Skor=${p.skor}\n`;
    });
    analysisText += `\n`;

    // Analysis notes
    analysisText += `**ANALİZ NOTLARI**\n`;
    analysisText += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
    predictions.slice(0, 2).forEach(p => {
      analysisText += `${p.agent}: ${p.aciklama}\n\n`;
    });

    // Odds
    if (matchData.odds) {
      analysisText += `**ORANLAR**\n`;
      analysisText += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
      analysisText += `MS: 1=${matchData.odds.home.toFixed(2)} | X=${matchData.odds.draw.toFixed(2)} | 2=${matchData.odds.away.toFixed(2)}\n`;
      analysisText += `Gol: Ü2.5=${matchData.odds.over25.toFixed(2)} | A2.5=${matchData.odds.under25.toFixed(2)}\n\n`;
    }

    analysisText += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
    analysisText += `*${consensus.totalAgents} AI'dan en az ${Math.ceil(consensus.totalAgents / 2)} tanesi hemfikir olmalı.*\n`;
    analysisText += `*Perplexity güncel haberler için kullanıldı.*`;

    return NextResponse.json({
      success: true,
      analysis: analysisText,
      consensus,
      predictions,
      newsContext,
      matchData: {
        homeTeam: matchData.homeTeam,
        awayTeam: matchData.awayTeam,
        h2h: matchData.h2h,
        leagueContext: matchData.leagueContext,
        odds: matchData.odds
      },
      meta: {
        totalAgents: predictions.length,
        responseTime: elapsed,
        agentsUsed: predictions.map(p => p.agent)
      }
    });

  } catch (error: any) {
    console.error('Analyze API Error:', error);
    return NextResponse.json({
      error: error.message || 'Bir hata oluştu',
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    }, { status: 500 });
  }
}
