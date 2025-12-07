export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { checkUserAccess } from '@/lib/accessControl';
import { runFullAnalysis } from '@/lib/heurist/orchestrator';
import { runMultiModelAnalysis } from '@/lib/heurist/multiModel';

const SPORTMONKS_API_KEY = process.env.SPORTMONKS_API_KEY;
const BASE_URL = 'https://api.sportmonks.com/v3/football';

// ==================== DETAYLI VERİ ÇEKİMİ ====================

async function fetchDetailedMatchData(
  fixtureId: number, 
  homeTeamId: number, 
  awayTeamId: number, 
  homeTeamName: string, 
  awayTeamName: string
) {
  console.log('📊 Fetching detailed match data from Sportmonks...');
  
  let odds: any = {};
  let homeStats: any = {};
  let awayStats: any = {};
  let h2h: any = {};
  let injuries: any = { home: [], away: [] };

  try {
    if (!SPORTMONKS_API_KEY) {
      console.warn('⚠️ No Sportmonks API key');
      return { odds, homeStats: getDefaultStats(), awayStats: getDefaultStats(), h2h: getDefaultH2H(), injuries };
    }

    // Paralel API çağrıları - Detaylı veriler
    // Sportmonks API v3 - teams endpoint ile latest maçlar (ÇALIŞAN FORMAT)
    const [
      fixtureRes,
      homeTeamRes,
      awayTeamRes,
      h2hRes,
      homeInjuriesRes,
      awayInjuriesRes
    ] = await Promise.all([
      // 1. Fixture + Odds
      fetch(`${BASE_URL}/fixtures/${fixtureId}?api_token=${SPORTMONKS_API_KEY}&include=odds;scores;venue;weather`),
      
      // 2. Ev sahibi takım + son maçlar (SKORLARLA)
      fetch(`${BASE_URL}/teams/${homeTeamId}?api_token=${SPORTMONKS_API_KEY}&include=latest.scores;latest.participants`),
      
      // 3. Deplasman takım + son maçlar (SKORLARLA)
      fetch(`${BASE_URL}/teams/${awayTeamId}?api_token=${SPORTMONKS_API_KEY}&include=latest.scores;latest.participants`),
      
      // 4. H2H karşılaşmalar (SKORLARLA)
      fetch(`${BASE_URL}/fixtures/head-to-head/${homeTeamId}/${awayTeamId}?api_token=${SPORTMONKS_API_KEY}&include=scores;participants`),
      
      // 5. Ev sahibi sakatlıklar
      fetch(`${BASE_URL}/sidelined/teams/${homeTeamId}?api_token=${SPORTMONKS_API_KEY}&include=player;type`),
      
      // 6. Deplasman sakatlıklar
      fetch(`${BASE_URL}/sidelined/teams/${awayTeamId}?api_token=${SPORTMONKS_API_KEY}&include=player;type`),
    ]);

    // JSON parse
    const [fixtureData, homeTeamData, awayTeamData, h2hData, homeInjuriesData, awayInjuriesData] = 
      await Promise.all([
        fixtureRes.json(),
        homeTeamRes.json(),
        awayTeamRes.json(),
        h2hRes.json(),
        homeInjuriesRes.json(),
        awayInjuriesRes.json(),
      ]);

    console.log(`   📡 API Responses received`);
    console.log(`   Home team latest: ${homeTeamData.data?.latest?.length || 0} matches`);
    console.log(`   Away team latest: ${awayTeamData.data?.latest?.length || 0} matches`);
    console.log(`   H2H matches: ${h2hData.data?.length || 0}`);

    // ========== ODDS ==========
    if (fixtureData.data?.odds) {
      odds = parseOdds(fixtureData.data.odds);
      console.log(`   ✅ Odds: 1=${odds.matchWinner?.home} X=${odds.matchWinner?.draw} 2=${odds.matchWinner?.away}`);
    }

    // ========== HOME TEAM STATS ==========
    const homeMatches = homeTeamData.data?.latest || [];
    if (homeMatches.length > 0) {
      homeStats = calculateDetailedStats(homeMatches, homeTeamId, homeTeamName, 'home');
      console.log(`   ✅ Home Stats: ${homeStats.form} | Goals: ${homeStats.avgGoalsScored}/${homeStats.avgGoalsConceded} | Over25: ${homeStats.over25Percentage}%`);
    } else {
      homeStats = getDefaultStats();
      console.log('   ⚠️ No home team match data');
    }

    // ========== AWAY TEAM STATS ==========
    const awayMatches = awayTeamData.data?.latest || [];
    if (awayMatches.length > 0) {
      awayStats = calculateDetailedStats(awayMatches, awayTeamId, awayTeamName, 'away');
      console.log(`   ✅ Away Stats: ${awayStats.form} | Goals: ${awayStats.avgGoalsScored}/${awayStats.avgGoalsConceded} | Over25: ${awayStats.over25Percentage}%`);
    } else {
      awayStats = getDefaultStats();
      console.log('   ⚠️ No away team match data');
    }

    // ========== H2H ==========
    if (h2hData.data && h2hData.data.length > 0) {
      h2h = calculateDetailedH2H(h2hData.data, homeTeamId, awayTeamId, homeTeamName, awayTeamName);
      console.log(`   ✅ H2H: ${h2h.totalMatches} matches | ${h2h.homeWins}-${h2h.draws}-${h2h.awayWins} | Avg: ${h2h.avgTotalGoals} goals`);
    } else {
      h2h = getDefaultH2H();
      console.log('   ⚠️ No H2H data');
    }

    // ========== INJURIES ==========
    if (homeInjuriesData.data) {
      injuries.home = parseInjuries(homeInjuriesData.data);
      console.log(`   ✅ Home Injuries: ${injuries.home.length} players`);
    }
    if (awayInjuriesData.data) {
      injuries.away = parseInjuries(awayInjuriesData.data);
      console.log(`   ✅ Away Injuries: ${injuries.away.length} players`);
    }

  } catch (error) {
    console.error('❌ Sportmonks fetch error:', error);
    homeStats = getDefaultStats();
    awayStats = getDefaultStats();
    h2h = getDefaultH2H();
  }

  return { odds, homeStats, awayStats, h2h, injuries };
}

// ==================== DETAYLI İSTATİSTİK HESAPLAMA ====================

function calculateDetailedStats(matches: any[], teamId: number, teamName: string, venue: 'home' | 'away'): any {
  const last10 = matches.slice(0, 10);
  const last5 = matches.slice(0, 5);
  
  let form = '';
  let totalGoalsScored = 0;
  let totalGoalsConceded = 0;
  let over25Count = 0;
  let bttsCount = 0;
  let cleanSheets = 0;
  let failedToScore = 0;
  let wins = 0, draws = 0, losses = 0;
  
  // Ev/Deplasman ayrımı için
  let homeMatches = 0, awayMatches = 0;
  let homeGoalsScored = 0, homeGoalsConceded = 0;
  let awayGoalsScored = 0, awayGoalsConceded = 0;

  const matchDetails: any[] = [];

  console.log(`   📊 Parsing ${last10.length} matches for team ${teamName} (ID: ${teamId})`);

  last10.forEach((match: any, index: number) => {
    // Takımın ev sahibi mi deplasman mı olduğunu bul
    const participants = match.participants || [];
    const homeParticipant = participants.find((p: any) => p.meta?.location === 'home');
    const awayParticipant = participants.find((p: any) => p.meta?.location === 'away');
    
    const isHome = homeParticipant?.id === teamId;
    
    // Skorları bul - SPORTMONKS FORMATI
    let teamScore = 0;
    let opponentScore = 0;
    let scoreFound = false;
    
    // Sportmonks'ta skorlar her takım için ayrı ayrı geliyor
    // Her score objesi: { participant_id, score: { goals, participant }, description }
    if (match.scores && Array.isArray(match.scores) && match.scores.length > 0) {
      // CURRENT veya type_id: 1525 olan skorları bul (final skor)
      const currentScores = match.scores.filter((s: any) => 
        s.description === 'CURRENT' || s.type_id === 1525
      );
      
      if (currentScores.length >= 2) {
        // Her takımın skorunu bul
        currentScores.forEach((s: any) => {
          const goals = s.score?.goals ?? 0;
          if (s.participant_id === teamId) {
            teamScore = goals;
          } else {
            opponentScore = goals;
          }
        });
        scoreFound = true;
      } else if (currentScores.length === 1) {
        // Sadece bir skor varsa (nadir durum)
        const s = currentScores[0];
        if (s.participant_id === teamId) {
          teamScore = s.score?.goals ?? 0;
        } else {
          opponentScore = s.score?.goals ?? 0;
        }
        scoreFound = true;
      }
      
      // Eğer CURRENT bulunamadıysa, 2ND_HALF veya 1ST_HALF'tan hesapla
      if (!scoreFound) {
        const halfScores: Record<number, number> = {};
        match.scores.forEach((s: any) => {
          if (s.description === '2ND_HALF' || s.description === '1ST_HALF' || s.type_id === 1 || s.type_id === 2) {
            const pid = s.participant_id;
            const goals = s.score?.goals ?? 0;
            // En yüksek değeri al (2ND_HALF genelde kümülatif olabilir)
            if (!halfScores[pid] || goals > halfScores[pid]) {
              halfScores[pid] = goals;
            }
          }
        });
        
        if (Object.keys(halfScores).length >= 2) {
          Object.entries(halfScores).forEach(([pid, goals]) => {
            if (parseInt(pid) === teamId) {
              teamScore = goals;
            } else {
              opponentScore = goals;
            }
          });
          scoreFound = true;
        }
      }
    }
    
    // Method 2: result_info'dan parse et (yedek yöntem)
    if (!scoreFound && match.result_info) {
      const resultInfo = match.result_info.toLowerCase();
      // "Team won after full-time" formatında kazananı belirle
      if (resultInfo.includes('won')) {
        // Kazanan takımın adını bul
        const parts = resultInfo.split(' won');
        if (parts.length > 0) {
          const winnerName = parts[0].trim().toLowerCase();
          const teamFirstWord = teamName.toLowerCase().split(' ')[0];
          
          // Basit skor tahmini: kazanan 2-1, berabere 1-1, kaybeden 1-2
          if (winnerName.includes(teamFirstWord) || teamFirstWord.includes(winnerName.split(' ')[0])) {
            teamScore = 2;
            opponentScore = 1;
          } else {
            teamScore = 1;
            opponentScore = 2;
          }
          scoreFound = true;
        }
      } else if (resultInfo.includes('draw')) {
        teamScore = 1;
        opponentScore = 1;
        scoreFound = true;
      }
    }

    // Debug log for first match
    if (index === 0) {
      console.log(`      ─────────────────────────────────────`);
      console.log(`      DEBUG Match 1: ${match.name || 'Unknown'}`);
      console.log(`      Team ID we're looking for: ${teamId}`);
      console.log(`      Scores count: ${match.scores?.length || 0}`);
      if (match.scores && match.scores.length > 0) {
        const currentScores = match.scores.filter((s: any) => s.description === 'CURRENT' || s.type_id === 1525);
        console.log(`      CURRENT scores: ${JSON.stringify(currentScores)}`);
      }
      console.log(`      result_info: "${match.result_info || ''}"`);
      console.log(`      PARSED RESULT: ${teamScore}-${opponentScore} (found: ${scoreFound})`);
      console.log(`      ─────────────────────────────────────`);
    }
    
    // İstatistikleri güncelle
    totalGoalsScored += teamScore;
    totalGoalsConceded += opponentScore;
    
    const totalGoals = teamScore + opponentScore;
    if (totalGoals > 2.5) over25Count++;
    if (teamScore > 0 && opponentScore > 0) bttsCount++;
    if (opponentScore === 0) cleanSheets++;
    if (teamScore === 0) failedToScore++;
    
    // Ev/Deplasman ayrımı
    if (isHome) {
      homeMatches++;
      homeGoalsScored += teamScore;
      homeGoalsConceded += opponentScore;
    } else {
      awayMatches++;
      awayGoalsScored += teamScore;
      awayGoalsConceded += opponentScore;
    }
    
    // Sonuç
    let result = 'D';
    if (teamScore > opponentScore) {
      result = 'W';
      wins++;
    } else if (teamScore < opponentScore) {
      result = 'L';
      losses++;
    } else {
      draws++;
    }
    
    // Son 5 maç için form string
    if (index < 5) {
      form += result;
    }
    
    // Maç detayı
    const opponent = isHome ? awayParticipant?.name : homeParticipant?.name;
    matchDetails.push({
      opponent: opponent || 'Unknown',
      score: `${teamScore}-${opponentScore}`,
      result,
      isHome,
      date: match.starting_at,
    });
  });

  const matchCount = last10.length || 1;
  
  return {
    // Temel form
    form,
    points: (wins * 3) + draws,
    maxPoints: last5.length * 3,
    record: `${wins}W-${draws}D-${losses}L`,
    wins,
    draws,
    losses,
    
    // Gol istatistikleri (GERÇEK VERİ)
    avgGoalsScored: (totalGoalsScored / matchCount).toFixed(2),
    avgGoalsConceded: (totalGoalsConceded / matchCount).toFixed(2),
    avgGoals: (totalGoalsScored / matchCount).toFixed(2), // Eski uyumluluk için
    avgConceded: (totalGoalsConceded / matchCount).toFixed(2), // Eski uyumluluk için
    totalGoalsScored,
    totalGoalsConceded,
    
    // Over/Under & BTTS (GERÇEK VERİ)
    over25Percentage: Math.round((over25Count / matchCount) * 100).toString(),
    over25Count,
    bttsPercentage: Math.round((bttsCount / matchCount) * 100).toString(),
    bttsCount,
    
    // Clean sheet & Failed to score
    cleanSheets,
    cleanSheetPercentage: Math.round((cleanSheets / matchCount) * 100),
    failedToScore,
    failedToScorePercentage: Math.round((failedToScore / matchCount) * 100),
    
    // Ev/Deplasman ayrımı
    homeRecord: homeMatches > 0 ? {
      matches: homeMatches,
      avgScored: (homeGoalsScored / homeMatches).toFixed(2),
      avgConceded: (homeGoalsConceded / homeMatches).toFixed(2),
    } : null,
    awayRecord: awayMatches > 0 ? {
      matches: awayMatches,
      avgScored: (awayGoalsScored / awayMatches).toFixed(2),
      avgConceded: (awayGoalsConceded / awayMatches).toFixed(2),
    } : null,
    
    // Maç detayları
    matches: matchDetails.slice(0, 5),
    matchDetails: matchDetails.slice(0, 5),
    matchCount,
  };
}

// ==================== DETAYLI H2H HESAPLAMA ====================

function calculateDetailedH2H(
  matches: any[], 
  homeTeamId: number, 
  awayTeamId: number,
  homeTeamName: string,
  awayTeamName: string
): any {
  let homeWins = 0, awayWins = 0, draws = 0;
  let totalHomeGoals = 0, totalAwayGoals = 0;
  let over25Count = 0, bttsCount = 0;
  
  const matchDetails: any[] = [];

  console.log(`   📊 Parsing ${matches.length} H2H matches`);

  matches.forEach((match: any, index: number) => {
    // Skorları bul - SPORTMONKS FORMATI
    let homeScore = 0, awayScore = 0;
    let scoreFound = false;
    
    // Hangi takım ev sahibi?
    const participants = match.participants || [];
    const homeParticipant = participants.find((p: any) => p.meta?.location === 'home');
    const awayParticipant = participants.find((p: any) => p.meta?.location === 'away');
    const isHomeTeamHome = homeParticipant?.id === homeTeamId;
    
    // Sportmonks'ta skorlar her takım için ayrı ayrı geliyor
    if (match.scores && Array.isArray(match.scores) && match.scores.length > 0) {
      // CURRENT veya type_id: 1525 olan skorları bul
      const currentScores = match.scores.filter((s: any) => 
        s.description === 'CURRENT' || s.type_id === 1525
      );
      
      if (currentScores.length >= 2) {
        currentScores.forEach((s: any) => {
          const goals = s.score?.goals ?? 0;
          const participantType = s.score?.participant;
          
          if (participantType === 'home') {
            homeScore = goals;
          } else if (participantType === 'away') {
            awayScore = goals;
          } else {
            // participant_id ile eşleştir
            if (s.participant_id === homeParticipant?.id) {
              homeScore = goals;
            } else {
              awayScore = goals;
            }
          }
        });
        scoreFound = true;
      }
    }
    
    // result_info'dan parse et (yedek)
    if (!scoreFound && match.result_info) {
      const resultInfo = match.result_info.toLowerCase();
      if (resultInfo.includes('won')) {
        const winnerName = resultInfo.split(' won')[0].trim().toLowerCase();
        const homeTeamFirst = homeTeamName.toLowerCase().split(' ')[0];
        const awayTeamFirst = awayTeamName.toLowerCase().split(' ')[0];
        
        if (winnerName.includes(homeTeamFirst)) {
          homeScore = 2;
          awayScore = 1;
        } else if (winnerName.includes(awayTeamFirst)) {
          homeScore = 1;
          awayScore = 2;
        }
        scoreFound = true;
      } else if (resultInfo.includes('draw')) {
        homeScore = 1;
        awayScore = 1;
        scoreFound = true;
      }
    }

    // Debug log for first H2H match
    if (index === 0) {
      console.log(`      H2H Match 1: ${match.name}`);
      console.log(`      Scores: ${JSON.stringify(match.scores?.filter((s: any) => s.description === 'CURRENT'))}`);
      console.log(`      Parsed: ${homeScore}-${awayScore}`);
    }
    
    // Eğer isHomeTeamHome false ise, skorları ters çevir
    if (!isHomeTeamHome) {
      [homeScore, awayScore] = [awayScore, homeScore];
    }
    
    totalHomeGoals += homeScore;
    totalAwayGoals += awayScore;
    
    const totalGoals = homeScore + awayScore;
    if (totalGoals > 2.5) over25Count++;
    if (homeScore > 0 && awayScore > 0) bttsCount++;
    
    if (homeScore > awayScore) homeWins++;
    else if (awayScore > homeScore) awayWins++;
    else draws++;
    
    matchDetails.push({
      date: match.starting_at,
      homeTeam: homeParticipant?.name || homeTeamName,
      awayTeam: awayParticipant?.name || awayTeamName,
      score: `${homeScore}-${awayScore}`,
      winner: homeScore > awayScore ? homeTeamName : (awayScore > homeScore ? awayTeamName : 'Draw'),
    });
  });

  const matchCount = matches.length || 1;
  
  return {
    totalMatches: matches.length,
    homeWins,
    awayWins,
    draws,
    
    // Gol istatistikleri
    totalHomeGoals,
    totalAwayGoals,
    avgHomeGoals: (totalHomeGoals / matchCount).toFixed(2),
    avgAwayGoals: (totalAwayGoals / matchCount).toFixed(2),
    avgTotalGoals: ((totalHomeGoals + totalAwayGoals) / matchCount).toFixed(2),
    avgGoals: ((totalHomeGoals + totalAwayGoals) / matchCount).toFixed(2), // Eski uyumluluk
    
    // Over/Under & BTTS
    over25Percentage: Math.round((over25Count / matchCount) * 100).toString(),
    over25Count,
    bttsPercentage: Math.round((bttsCount / matchCount) * 100).toString(),
    bttsCount,
    
    // Maç detayları
    matchDetails: matchDetails.slice(0, 5),
  };
}

// ==================== SAKATLIK VERİSİ ====================

function parseInjuries(injuryData: any[]): any[] {
  if (!Array.isArray(injuryData)) return [];
  
  return injuryData
    .filter((injury: any) => {
      // Sadece aktif sakatlıkları al
      const endDate = injury.end_date;
      if (!endDate) return true; // Bitiş tarihi yoksa hala sakat
      return new Date(endDate) > new Date();
    })
    .map((injury: any) => ({
      player: injury.player?.display_name || injury.player?.name || 'Unknown',
      type: injury.type?.name || injury.category || 'Injury',
      startDate: injury.start_date,
      expectedReturn: injury.end_date || 'Unknown',
    }))
    .slice(0, 5); // En fazla 5 sakatlık
}

// ==================== ODDS PARSE ====================

function parseOdds(oddsData: any[]): any {
  const result: any = {
    matchWinner: {},
    overUnder: { '2.5': {}, '3.5': {} },
    btts: {},
    doubleChance: {},
  };

  if (!oddsData || !Array.isArray(oddsData)) return result;

  oddsData.forEach((odd: any) => {
    const marketName = odd.market_description?.toLowerCase() || odd.market?.name?.toLowerCase() || '';

    // 1X2 / Fulltime Result
    if (marketName.includes('fulltime result') || marketName.includes('match winner') || marketName.includes('1x2')) {
      if (odd.label === 'Home' || odd.label === '1') result.matchWinner.home = parseFloat(odd.value);
      if (odd.label === 'Draw' || odd.label === 'X') result.matchWinner.draw = parseFloat(odd.value);
      if (odd.label === 'Away' || odd.label === '2') result.matchWinner.away = parseFloat(odd.value);
    }

    // Over/Under
    if (marketName.includes('over/under') || marketName.includes('goals')) {
      if (odd.total === 2.5 || odd.total === '2.5' || marketName.includes('2.5')) {
        if (odd.label === 'Over') result.overUnder['2.5'].over = parseFloat(odd.value);
        if (odd.label === 'Under') result.overUnder['2.5'].under = parseFloat(odd.value);
      }
      if (odd.total === 3.5 || odd.total === '3.5' || marketName.includes('3.5')) {
        if (odd.label === 'Over') result.overUnder['3.5'].over = parseFloat(odd.value);
        if (odd.label === 'Under') result.overUnder['3.5'].under = parseFloat(odd.value);
      }
    }

    // BTTS
    if (marketName.includes('both teams') || marketName.includes('btts')) {
      if (odd.label === 'Yes') result.btts.yes = parseFloat(odd.value);
      if (odd.label === 'No') result.btts.no = parseFloat(odd.value);
    }

    // Double Chance
    if (marketName.includes('double chance')) {
      if (odd.label === '1X') result.doubleChance.homeOrDraw = parseFloat(odd.value);
      if (odd.label === '12') result.doubleChance.homeOrAway = parseFloat(odd.value);
      if (odd.label === 'X2') result.doubleChance.drawOrAway = parseFloat(odd.value);
    }
  });

  return result;
}

// ==================== DEFAULT VALUES ====================

function getDefaultStats(): any {
  return { 
    form: 'N/A', 
    points: 0,
    maxPoints: 15,
    record: '0W-0D-0L',
    wins: 0,
    draws: 0,
    losses: 0,
    avgGoalsScored: '1.20',
    avgGoalsConceded: '1.00',
    avgGoals: '1.20',
    avgConceded: '1.00',
    totalGoalsScored: 0,
    totalGoalsConceded: 0,
    over25Percentage: '50', 
    over25Count: 0,
    bttsPercentage: '50',
    bttsCount: 0,
    cleanSheets: 0,
    cleanSheetPercentage: 0,
    failedToScore: 0,
    failedToScorePercentage: 0,
    matches: [],
    matchDetails: [],
    matchCount: 0,
  };
}

function getDefaultH2H(): any {
  return { 
    totalMatches: 0, 
    homeWins: 0, 
    awayWins: 0, 
    draws: 0, 
    totalHomeGoals: 0,
    totalAwayGoals: 0,
    avgHomeGoals: '0',
    avgAwayGoals: '0',
    avgTotalGoals: '2.50',
    avgGoals: '2.50',
    over25Percentage: '50', 
    over25Count: 0,
    bttsPercentage: '50',
    bttsCount: 0,
    matchDetails: [],
  };
}

// ==================== API ENDPOINT ====================

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const ip = request.headers.get('x-forwarded-for')?.split(',')[0] || 'unknown';
    const access = await checkUserAccess(session.user.email, ip);

    if (!access.canUseAgents) {
      return NextResponse.json({ 
        error: 'Pro subscription required for AI Agents',
        requiresPro: true 
      }, { status: 403 });
    }

    const body = await request.json();
    const { fixtureId, homeTeam, awayTeam, homeTeamId, awayTeamId, league = '', language = 'en', useMultiModel = true } = body;

    if (!fixtureId) {
      return NextResponse.json({ error: 'Fixture ID required' }, { status: 400 });
    }

    console.log('');
    console.log('🤖 ═══════════════════════════════════════════════════');
    console.log('🤖 AGENT ANALYSIS REQUEST (ENHANCED)');
    console.log('🤖 ═══════════════════════════════════════════════════');
    console.log(`📍 Match: ${homeTeam} vs ${awayTeam}`);
    console.log(`🏆 League: ${league}`);
    console.log(`🔮 Multi-Model: ${useMultiModel ? 'ENABLED' : 'DISABLED'}`);
    console.log('');

    // DETAYLI VERİ ÇEK
    const { odds, homeStats, awayStats, h2h, injuries } = await fetchDetailedMatchData(
      fixtureId, homeTeamId, awayTeamId, homeTeam, awayTeam
    );
    
    console.log('');
    console.log('📊 ═══════════════════════════════════════════════════');
    console.log('📊 DATA SUMMARY');
    console.log('📊 ═══════════════════════════════════════════════════');
    console.log(`   🎯 Odds: ${odds?.matchWinner?.home ? `1=${odds.matchWinner.home} X=${odds.matchWinner.draw} 2=${odds.matchWinner.away}` : '❌ NO DATA'}`);
    console.log(`   🏠 ${homeTeam}: ${homeStats?.form || 'N/A'} | ${homeStats?.avgGoalsScored || '?'}⚽ scored | ${homeStats?.avgGoalsConceded || '?'}⚽ conceded | Over25: ${homeStats?.over25Percentage || '?'}%`);
    console.log(`   🚌 ${awayTeam}: ${awayStats?.form || 'N/A'} | ${awayStats?.avgGoalsScored || '?'}⚽ scored | ${awayStats?.avgGoalsConceded || '?'}⚽ conceded | Over25: ${awayStats?.over25Percentage || '?'}%`);
    console.log(`   🔄 H2H: ${h2h?.totalMatches || 0} matches | ${h2h?.homeWins || 0}-${h2h?.draws || 0}-${h2h?.awayWins || 0} | Avg: ${h2h?.avgTotalGoals || '?'} goals | Over25: ${h2h?.over25Percentage || '?'}%`);
    console.log(`   🏥 Injuries: ${homeTeam}: ${injuries?.home?.length || 0} | ${awayTeam}: ${injuries?.away?.length || 0}`);
    console.log('');

    // Match data objesi - MatchData tipine uyumlu
    const matchData: any = {
      fixtureId,
      homeTeam,
      awayTeam,
      homeTeamId,
      awayTeamId,
      league,
      date: new Date().toISOString(),
      odds,
      // MatchData tipine uygun homeForm
      homeForm: {
        form: homeStats.form,
        points: homeStats.points,
        wins: homeStats.wins,
        draws: homeStats.draws,
        losses: homeStats.losses,
        avgGoals: homeStats.avgGoals,
        avgConceded: homeStats.avgConceded,
        over25Percentage: homeStats.over25Percentage,
        bttsPercentage: homeStats.bttsPercentage,
        cleanSheetPercentage: homeStats.cleanSheetPercentage,
        matches: homeStats.matches || [],
      },
      // MatchData tipine uygun awayForm
      awayForm: {
        form: awayStats.form,
        points: awayStats.points,
        wins: awayStats.wins,
        draws: awayStats.draws,
        losses: awayStats.losses,
        avgGoals: awayStats.avgGoals,
        avgConceded: awayStats.avgConceded,
        over25Percentage: awayStats.over25Percentage,
        bttsPercentage: awayStats.bttsPercentage,
        cleanSheetPercentage: awayStats.cleanSheetPercentage,
        matches: awayStats.matches || [],
      },
      // H2H
      h2h: {
        totalMatches: h2h.totalMatches,
        homeWins: h2h.homeWins,
        awayWins: h2h.awayWins,
        draws: h2h.draws,
        avgGoals: h2h.avgGoals,
        over25Percentage: h2h.over25Percentage,
        bttsPercentage: h2h.bttsPercentage,
      },
      // Detaylı veriler (ek olarak)
      detailedStats: {
        home: homeStats,
        away: awayStats,
        h2h: h2h,
        injuries: injuries,
      },
    };

    // Multi-Model Analysis
    let multiModelResult = null;
    if (useMultiModel) {
      console.log('🔮 Starting Multi-Model Analysis...');
      try {
        multiModelResult = await runMultiModelAnalysis(matchData);
        console.log(`🎯 Multi-Model Agreement: ${multiModelResult?.modelAgreement || 0}%`);
      } catch (mmError) {
        console.error('⚠️ Multi-Model Analysis failed:', mmError);
      }
    }

    // Standard Agent Analysis
    const result = await runFullAnalysis(matchData, language as 'tr' | 'en' | 'de');

    console.log('');
    console.log('✅ ═══════════════════════════════════════════════════');
    console.log('✅ ANALYSIS COMPLETE');
    console.log('✅ ═══════════════════════════════════════════════════');
    console.log('');

    return NextResponse.json({
      success: result.success,
      reports: result.reports,
      timing: result.timing,
      errors: result.errors,
      multiModel: multiModelResult ? {
        enabled: true,
        predictions: multiModelResult.predictions,
        consensus: multiModelResult.consensus,
        unanimousDecisions: multiModelResult.unanimousDecisions,
        conflictingDecisions: multiModelResult.conflictingDecisions,
        bestBet: multiModelResult.bestBet,
        modelAgreement: multiModelResult.modelAgreement,
      } : { enabled: false },
      dataUsed: {
        hasOdds: !!odds?.matchWinner?.home,
        hasHomeForm: !!homeStats?.form && homeStats.form !== 'N/A',
        hasAwayForm: !!awayStats?.form && awayStats.form !== 'N/A',
        hasH2H: !!h2h?.totalMatches && h2h.totalMatches > 0,
        hasInjuries: (injuries?.home?.length > 0) || (injuries?.away?.length > 0),
        // Detaylı veri özeti
        homeMatchCount: homeStats?.matchCount || 0,
        awayMatchCount: awayStats?.matchCount || 0,
        h2hMatchCount: h2h?.totalMatches || 0,
        homeInjuryCount: injuries?.home?.length || 0,
        awayInjuryCount: injuries?.away?.length || 0,
      },
      // Ham veriyi de gönder (debug için)
      rawStats: {
        home: homeStats,
        away: awayStats,
        h2h: h2h,
        injuries: injuries,
      },
    });
  } catch (error: any) {
    console.error('❌ Agent error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
