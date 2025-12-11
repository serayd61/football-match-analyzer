// src/app/api/auto-predict/route.ts
// Günün maçlarını otomatik çeker, AI ile analiz eder ve kaydeder
// n8n tarafından her sabah çağrılır

export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';

const SPORTMONKS_API_KEY = process.env.SPORTMONKS_API_KEY;
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

// Desteklenen ligler (ID'ler)
const SUPPORTED_LEAGUES = [
  8,    // Premier League
  564,  // La Liga
  384,  // Serie A
  82,   // Bundesliga
  301,  // Ligue 1
  600,  // Süper Lig
  72,   // Eredivisie
  271,  // Champions League
  17,   // Championship
];

// ==================== SPORTMONKS API ====================

async function getTodayMatches() {
  const today = new Date().toISOString().split('T')[0];
  
  try {
    const response = await fetch(
      `https://api.sportmonks.com/v3/football/fixtures/date/${today}?api_token=${SPORTMONKS_API_KEY}&include=participants;league;odds&per_page=100`
    );
    
    if (!response.ok) {
      console.error('Sportmonks error:', response.status);
      return [];
    }
    
    const data = await response.json();
    const matches = data.data || [];
    
    // Sadece desteklenen liglerdeki maçları filtrele
    const filteredMatches = matches.filter((m: any) => 
      SUPPORTED_LEAGUES.includes(m.league_id)
    );
    
    console.log(`📅 Today: ${today} | Total: ${matches.length} | Filtered: ${filteredMatches.length}`);
    
    return filteredMatches;
  } catch (error) {
    console.error('❌ getTodayMatches error:', error);
    return [];
  }
}

async function getTeamStats(teamId: number) {
  try {
    const response = await fetch(
      `https://api.sportmonks.com/v3/football/teams/${teamId}?api_token=${SPORTMONKS_API_KEY}&include=latest.scores;latest.participants`
    );
    
    if (!response.ok) return null;
    
    const data = await response.json();
    const matches = data.data?.latest || [];
    
    if (matches.length === 0) return null;
    
    let wins = 0, draws = 0, losses = 0;
    let goalsFor = 0, goalsAgainst = 0;
    let form = '';
    
    matches.slice(0, 10).forEach((match: any, idx: number) => {
      const scores = match.scores || [];
      const isHome = match.participants?.find((p: any) => p.id === teamId)?.meta?.location === 'home';
      
      let teamGoals = 0, oppGoals = 0;
      scores.forEach((s: any) => {
        if (s.description === 'CURRENT') {
          if (s.score?.participant === 'home') {
            teamGoals = isHome ? s.score?.goals || 0 : oppGoals;
            oppGoals = isHome ? oppGoals : s.score?.goals || 0;
          } else if (s.score?.participant === 'away') {
            teamGoals = isHome ? teamGoals : s.score?.goals || 0;
            oppGoals = isHome ? s.score?.goals || 0 : oppGoals;
          }
        }
      });
      
      // Basit skor çıkarımı
      const homeScore = scores.find((s: any) => s.description === 'CURRENT' && s.score?.participant === 'home')?.score?.goals || 0;
      const awayScore = scores.find((s: any) => s.description === 'CURRENT' && s.score?.participant === 'away')?.score?.goals || 0;
      
      teamGoals = isHome ? homeScore : awayScore;
      oppGoals = isHome ? awayScore : homeScore;
      
      goalsFor += teamGoals;
      goalsAgainst += oppGoals;
      
      if (teamGoals > oppGoals) { wins++; if (idx < 5) form += 'W'; }
      else if (teamGoals < oppGoals) { losses++; if (idx < 5) form += 'L'; }
      else { draws++; if (idx < 5) form += 'D'; }
    });
    
    const total = Math.min(matches.length, 10);
    
    return {
      form,
      wins, draws, losses,
      avgGoalsFor: (goalsFor / total).toFixed(2),
      avgGoalsAgainst: (goalsAgainst / total).toFixed(2),
      over25Pct: Math.round((matches.filter((m: any) => {
        const scores = m.scores || [];
        const home = scores.find((s: any) => s.description === 'CURRENT' && s.score?.participant === 'home')?.score?.goals || 0;
        const away = scores.find((s: any) => s.description === 'CURRENT' && s.score?.participant === 'away')?.score?.goals || 0;
        return (home + away) > 2.5;
      }).length / total) * 100),
      bttsPct: Math.round((matches.filter((m: any) => {
        const scores = m.scores || [];
        const home = scores.find((s: any) => s.description === 'CURRENT' && s.score?.participant === 'home')?.score?.goals || 0;
        const away = scores.find((s: any) => s.description === 'CURRENT' && s.score?.participant === 'away')?.score?.goals || 0;
        return home > 0 && away > 0;
      }).length / total) * 100),
    };
  } catch (error) {
    console.error(`❌ getTeamStats error for ${teamId}:`, error);
    return null;
  }
}

async function getH2H(team1Id: number, team2Id: number) {
  try {
    const response = await fetch(
      `https://api.sportmonks.com/v3/football/fixtures/head-to-head/${team1Id}/${team2Id}?api_token=${SPORTMONKS_API_KEY}&include=scores`
    );
    
    if (!response.ok) return null;
    
    const data = await response.json();
    const matches = data.data || [];
    
    if (matches.length === 0) return null;
    
    let totalGoals = 0;
    let over25Count = 0;
    let bttsCount = 0;
    
    matches.slice(0, 10).forEach((match: any) => {
      const scores = match.scores || [];
      const home = scores.find((s: any) => s.description === 'CURRENT' && s.score?.participant === 'home')?.score?.goals || 0;
      const away = scores.find((s: any) => s.description === 'CURRENT' && s.score?.participant === 'away')?.score?.goals || 0;
      
      totalGoals += home + away;
      if (home + away > 2.5) over25Count++;
      if (home > 0 && away > 0) bttsCount++;
    });
    
    const total = Math.min(matches.length, 10);
    
    return {
      totalMatches: total,
      avgGoals: (totalGoals / total).toFixed(2),
      over25Pct: Math.round((over25Count / total) * 100),
      bttsPct: Math.round((bttsCount / total) * 100),
    };
  } catch (error) {
    console.error('❌ getH2H error:', error);
    return null;
  }
}

// ==================== AI ANALİZ ====================

function buildAnalysisPrompt(match: any, homeStats: any, awayStats: any, h2h: any) {
  return `FUTBOL MAÇI ANALİZİ

Maç: ${match.homeTeam} vs ${match.awayTeam}
Lig: ${match.league}

EV SAHİBİ (${match.homeTeam}):
- Form: ${homeStats?.form || 'N/A'}
- Son 10 maç: ${homeStats?.wins || 0}G-${homeStats?.draws || 0}B-${homeStats?.losses || 0}M
- Gol ortalaması: ${homeStats?.avgGoalsFor || '?'} attı, ${homeStats?.avgGoalsAgainst || '?'} yedi
- 2.5 Üst oranı: %${homeStats?.over25Pct || 50}
- KG Var oranı: %${homeStats?.bttsPct || 50}

DEPLASMAN (${match.awayTeam}):
- Form: ${awayStats?.form || 'N/A'}
- Son 10 maç: ${awayStats?.wins || 0}G-${awayStats?.draws || 0}B-${awayStats?.losses || 0}M
- Gol ortalaması: ${awayStats?.avgGoalsFor || '?'} attı, ${awayStats?.avgGoalsAgainst || '?'} yedi
- 2.5 Üst oranı: %${awayStats?.over25Pct || 50}
- KG Var oranı: %${awayStats?.bttsPct || 50}

H2H (Son ${h2h?.totalMatches || 0} maç):
- Gol ortalaması: ${h2h?.avgGoals || '?'}
- 2.5 Üst: %${h2h?.over25Pct || 50}
- KG Var: %${h2h?.bttsPct || 50}

Bu verilere dayanarak tahminlerini SADECE şu JSON formatında ver:
{
  "match_result": "1" veya "X" veya "2",
  "match_result_confidence": 50-90 arası sayı,
  "over_under": "Over" veya "Under",
  "over_under_confidence": 50-90 arası sayı,
  "btts": "Yes" veya "No",
  "btts_confidence": 50-90 arası sayı,
  "reasoning": "Kısa gerekçe (max 100 karakter)"
}

SADECE JSON döndür, başka bir şey yazma.`;
}

async function callClaude(prompt: string): Promise<any> {
  if (!ANTHROPIC_API_KEY) return null;
  
  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 500,
        messages: [{ role: 'user', content: prompt }],
      }),
    });
    
    if (!response.ok) return null;
    
    const data = await response.json();
    const text = data.content?.[0]?.text || '';
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    return jsonMatch ? JSON.parse(jsonMatch[0]) : null;
  } catch (error) {
    console.error('Claude error:', error);
    return null;
  }
}

async function callOpenAI(prompt: string): Promise<any> {
  if (!OPENAI_API_KEY) return null;
  
  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 500,
      }),
    });
    
    if (!response.ok) return null;
    
    const data = await response.json();
    const text = data.choices?.[0]?.message?.content || '';
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    return jsonMatch ? JSON.parse(jsonMatch[0]) : null;
  } catch (error) {
    console.error('OpenAI error:', error);
    return null;
  }
}

async function callGemini(prompt: string): Promise<any> {
  if (!GEMINI_API_KEY) return null;
  
  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { maxOutputTokens: 500 },
        }),
      }
    );
    
    if (!response.ok) return null;
    
    const data = await response.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    return jsonMatch ? JSON.parse(jsonMatch[0]) : null;
  } catch (error) {
    console.error('Gemini error:', error);
    return null;
  }
}

// Konsensüs hesapla
function calculateConsensus(results: any[]) {
  const validResults = results.filter(r => r !== null);
  
  if (validResults.length === 0) {
    return {
      match_result: 'X',
      match_result_confidence: 50,
      over_under: 'Under',
      over_under_confidence: 50,
      btts: 'No',
      btts_confidence: 50,
      reasoning: 'Veri yetersiz',
      model_count: 0,
    };
  }
  
  // Match Result - en çok oy alan
  const mrVotes: Record<string, number> = {};
  const ouVotes: Record<string, number> = {};
  const bttsVotes: Record<string, number> = {};
  
  let mrConfSum = 0, ouConfSum = 0, bttsConfSum = 0;
  
  validResults.forEach(r => {
    mrVotes[r.match_result] = (mrVotes[r.match_result] || 0) + 1;
    mrConfSum += r.match_result_confidence || 60;
    
    ouVotes[r.over_under] = (ouVotes[r.over_under] || 0) + 1;
    ouConfSum += r.over_under_confidence || 60;
    
    bttsVotes[r.btts] = (bttsVotes[r.btts] || 0) + 1;
    bttsConfSum += r.btts_confidence || 60;
  });
  
  const getWinner = (votes: Record<string, number>) => {
    return Object.entries(votes).sort((a, b) => b[1] - a[1])[0]?.[0] || '';
  };
  
  const count = validResults.length;
  
  return {
    match_result: getWinner(mrVotes),
    match_result_confidence: Math.round(mrConfSum / count),
    over_under: getWinner(ouVotes),
    over_under_confidence: Math.round(ouConfSum / count),
    btts: getWinner(bttsVotes),
    btts_confidence: Math.round(bttsConfSum / count),
    reasoning: validResults[0]?.reasoning || '',
    model_count: count,
  };
}

// ==================== ANA FONKSİYON ====================

export async function POST(request: NextRequest) {
  const startTime = Date.now();
  
  try {
    console.log('');
    console.log('🤖 ═══════════════════════════════════════════════════');
    console.log('🤖 AUTO-PREDICT: Starting daily analysis');
    console.log('🤖 ═══════════════════════════════════════════════════');
    
    const supabase = getSupabaseAdmin();
    
    // 1. Günün maçlarını çek
    const matches = await getTodayMatches();
    
    if (matches.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No matches today for supported leagues',
        analyzed: 0,
        predictions: [],
      });
    }
    
    const predictions: any[] = [];
    let analyzed = 0;
    let errors = 0;
    
    // 2. Her maç için analiz yap (max 15 maç)
    for (const match of matches.slice(0, 15)) {
      try {
        const homeTeam = match.participants?.find((p: any) => p.meta?.location === 'home');
        const awayTeam = match.participants?.find((p: any) => p.meta?.location === 'away');
        
        if (!homeTeam || !awayTeam) continue;
        
        const matchData = {
          fixtureId: match.id,
          homeTeam: homeTeam.name,
          homeTeamId: homeTeam.id,
          awayTeam: awayTeam.name,
          awayTeamId: awayTeam.id,
          league: match.league?.name || 'Unknown',
          leagueId: match.league_id,
          date: match.starting_at,
        };
        
        console.log(`\n📊 Analyzing: ${matchData.homeTeam} vs ${matchData.awayTeam}`);
        
        // Zaten bu maç için tahmin var mı kontrol et
        const { data: existing } = await supabase
          .from('predictions')
          .select('fixture_id')
          .eq('fixture_id', matchData.fixtureId)
          .single();
        
        if (existing) {
          console.log(`   ⏭️ Already analyzed, skipping`);
          continue;
        }
        
        // İstatistikleri çek
        const [homeStats, awayStats, h2h] = await Promise.all([
          getTeamStats(matchData.homeTeamId),
          getTeamStats(matchData.awayTeamId),
          getH2H(matchData.homeTeamId, matchData.awayTeamId),
        ]);
        
        // AI prompt oluştur
        const prompt = buildAnalysisPrompt(matchData, homeStats, awayStats, h2h);
        
        // 3 AI'dan paralel tahmin al
        const [claude, openai, gemini] = await Promise.all([
          callClaude(prompt),
          callOpenAI(prompt),
          callGemini(prompt),
        ]);
        
        console.log(`   🤖 AI responses: Claude=${!!claude}, OpenAI=${!!openai}, Gemini=${!!gemini}`);
        
        // Konsensüs hesapla
        const consensus = calculateConsensus([claude, openai, gemini]);
        
        console.log(`   🎯 Consensus: MR=${consensus.match_result}, O/U=${consensus.over_under}, BTTS=${consensus.btts}`);
        
        // Veritabanına kaydet
        const predictionData = {
          fixture_id: matchData.fixtureId,
          home_team: matchData.homeTeam,
          away_team: matchData.awayTeam,
          league: matchData.league,
          match_date: matchData.date,
          
          // Final tahminler (konsensüs)
          final_match_result: consensus.match_result,
          final_match_result_conf: consensus.match_result_confidence,
          final_over_under: consensus.over_under,
          final_over_under_conf: consensus.over_under_confidence,
          final_btts: consensus.btts,
          final_btts_conf: consensus.btts_confidence,
          
          // Model sayısı
          model_count: consensus.model_count,
          
          // Ham veriler
          home_stats: homeStats,
          away_stats: awayStats,
          h2h_stats: h2h,
          
          // Durum
          match_finished: false,
          created_at: new Date().toISOString(),
        };
        
        const { error: insertError } = await supabase
          .from('predictions')
          .insert(predictionData);
        
        if (insertError) {
          console.error(`   ❌ Insert error:`, insertError.message);
          errors++;
          continue;
        }
        
        analyzed++;
        predictions.push({
          match: `${matchData.homeTeam} vs ${matchData.awayTeam}`,
          league: matchData.league,
          matchResult: consensus.match_result,
          matchResultConf: consensus.match_result_confidence,
          overUnder: consensus.over_under,
          overUnderConf: consensus.over_under_confidence,
          btts: consensus.btts,
          bttsConf: consensus.btts_confidence,
          modelCount: consensus.model_count,
        });
        
        console.log(`   ✅ Saved to database`);
        
      } catch (matchError: any) {
        console.error(`   ❌ Match error:`, matchError.message);
        errors++;
      }
    }
    
    const duration = Date.now() - startTime;
    
    console.log('');
    console.log('🤖 ═══════════════════════════════════════════════════');
    console.log(`🤖 AUTO-PREDICT COMPLETE in ${duration}ms`);
    console.log(`   ✅ Analyzed: ${analyzed}`);
    console.log(`   ❌ Errors: ${errors}`);
    console.log('🤖 ═══════════════════════════════════════════════════');
    
    return NextResponse.json({
      success: true,
      analyzed,
      errors,
      totalMatches: matches.length,
      predictions,
      duration: `${duration}ms`,
    });
    
  } catch (error: any) {
    console.error('❌ Auto-predict error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// GET - Durum kontrolü
export async function GET(request: NextRequest) {
  try {
    const supabase = getSupabaseAdmin();
    const today = new Date().toISOString().split('T')[0];
    
    const { data: todayPredictions } = await supabase
      .from('predictions')
      .select('fixture_id, home_team, away_team, final_over_under, final_match_result, final_btts')
      .gte('match_date', today)
      .lt('match_date', today + 'T23:59:59');
    
    return NextResponse.json({
      message: 'Auto-Predict API',
      today,
      todayPredictions: todayPredictions?.length || 0,
      predictions: todayPredictions?.map(p => ({
        match: `${p.home_team} vs ${p.away_team}`,
        matchResult: p.final_match_result,
        overUnder: p.final_over_under,
        btts: p.final_btts,
      })) || [],
      usage: 'POST /api/auto-predict to run daily analysis',
    });
    
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
