export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { checkUserAccess } from '@/lib/accessControl';
import { runFullAnalysis } from '@/lib/heurist/orchestrator';
import { runMultiModelAnalysis } from '@/lib/heurist/multiModel';
import { savePrediction } from '@/lib/predictions';

const SPORTMONKS_API_KEY = process.env.SPORTMONKS_API_KEY;
const BASE_URL = 'https://api.sportmonks.com/v3/football';

// ==================== PROFESYONEL VERİ ÇEKİMİ ====================

async function fetchDetailedMatchData(
  fixtureId: number, 
  homeTeamId: number, 
  awayTeamId: number, 
  homeTeamName: string, 
  awayTeamName: string
) {
  console.log('📊 ═══════════════════════════════════════════════════');
  console.log('📊 PROFESSIONAL DATA FETCHING (V3 - HOME/AWAY SPLIT)');
  console.log('📊 ═══════════════════════════════════════════════════');
  console.log(`   🔍 Fixture ID: ${fixtureId}`);
  console.log(`   🏠 Home: ${homeTeamName} (ID: ${homeTeamId})`);
  console.log(`   🚌 Away: ${awayTeamName} (ID: ${awayTeamId})`);
  
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

    // Paralel API çağrıları
    const [
      fixtureRes,
      homeScheduleRes,
      awayScheduleRes,
      h2hRes,
      homeInjuriesRes,
      awayInjuriesRes
    ] = await Promise.all([
      fetch(`${BASE_URL}/fixtures/${fixtureId}?api_token=${SPORTMONKS_API_KEY}&include=odds;scores;venue;weather;participants`),
      fetch(`${BASE_URL}/schedules/teams/${homeTeamId}?api_token=${SPORTMONKS_API_KEY}`),
      fetch(`${BASE_URL}/schedules/teams/${awayTeamId}?api_token=${SPORTMONKS_API_KEY}`),
      fetch(`${BASE_URL}/fixtures/head-to-head/${homeTeamId}/${awayTeamId}?api_token=${SPORTMONKS_API_KEY}&include=scores;participants`),
      fetch(`${BASE_URL}/sidelined/teams/${homeTeamId}?api_token=${SPORTMONKS_API_KEY}&include=player;type`),
      fetch(`${BASE_URL}/sidelined/teams/${awayTeamId}?api_token=${SPORTMONKS_API_KEY}&include=player;type`),
    ]);

    const [fixtureData, homeScheduleData, awayScheduleData, h2hData, homeInjuriesData, awayInjuriesData] = 
      await Promise.all([
        fixtureRes.json(),
        homeScheduleRes.json(),
        awayScheduleRes.json(),
        h2hRes.json(),
        homeInjuriesRes.json(),
        awayInjuriesRes.json(),
      ]);

    // Bitmiş maçları çıkar
    const extractFinishedMatches = (scheduleData: any, teamId: number): any[] => {
      const matches: any[] = [];
      
      if (!scheduleData.data) return matches;
      
      for (const stage of scheduleData.data) {
        if (stage.rounds) {
          for (const round of stage.rounds) {
            if (round.fixtures) {
              for (const fixture of round.fixtures) {
                if (fixture.state_id === 5 && fixture.scores && fixture.scores.length > 0) {
                  matches.push(fixture);
                }
              }
            }
          }
        }
        if (stage.fixtures) {
          for (const fixture of stage.fixtures) {
            if (fixture.state_id === 5 && fixture.scores && fixture.scores.length > 0) {
              matches.push(fixture);
            }
          }
        }
      }
      
      matches.sort((a, b) => new Date(b.starting_at).getTime() - new Date(a.starting_at).getTime());
      return matches.slice(0, 20);
    };

    const homeMatches = extractFinishedMatches(homeScheduleData, homeTeamId);
    const awayMatches = extractFinishedMatches(awayScheduleData, awayTeamId);

    console.log(`   📡 Home finished matches: ${homeMatches.length}`);
    console.log(`   📡 Away finished matches: ${awayMatches.length}`);
    console.log(`   📡 H2H matches: ${h2hData.data?.length || 0}`);

    // ========== ODDS ==========
    if (fixtureData.data?.odds && fixtureData.data.odds.length > 0) {
      odds = parseOdds(fixtureData.data.odds);
    }

    // ========== HOME TEAM STATS (SADECE EVDEKİ MAÇLAR!) ==========
    if (homeMatches.length > 0) {
      homeStats = calculateProfessionalStats(homeMatches, homeTeamId, homeTeamName, 'home');
    } else {
      homeStats = getDefaultStats();
    }

    // ========== AWAY TEAM STATS (SADECE DEPLASMANDAKİ MAÇLAR!) ==========
    if (awayMatches.length > 0) {
      awayStats = calculateProfessionalStats(awayMatches, awayTeamId, awayTeamName, 'away');
    } else {
      awayStats = getDefaultStats();
    }

    // ========== H2H ==========
    if (h2hData.data && h2hData.data.length > 0) {
      h2h = calculateDetailedH2H(h2hData.data, homeTeamId, awayTeamId, homeTeamName, awayTeamName);
    } else {
      h2h = getDefaultH2H();
    }

    // ========== INJURIES ==========
    if (homeInjuriesData.data) {
      injuries.home = parseInjuries(homeInjuriesData.data);
    }
    if (awayInjuriesData.data) {
      injuries.away = parseInjuries(awayInjuriesData.data);
    }

    // ========== LOG SUMMARY ==========
    console.log('');
    console.log('📊 ═══════════════════════════════════════════════════');
    console.log('📊 PROFESSIONAL STATS SUMMARY');
    console.log('📊 ═══════════════════════════════════════════════════');
    console.log(`   🏠 ${homeTeamName} (EVDEKİ MAÇLAR):`);
    console.log(`      Form: ${homeStats.venueForm} | ${homeStats.venueRecord}`);
    console.log(`      Goals: ${homeStats.venueAvgScored} scored, ${homeStats.venueAvgConceded} conceded`);
    console.log(`      Over 2.5: ${homeStats.venueOver25Pct}% | BTTS: ${homeStats.venueBttsPct}%`);
    console.log(`   🚌 ${awayTeamName} (DEPLASMANDAKİ MAÇLAR):`);
    console.log(`      Form: ${awayStats.venueForm} | ${awayStats.venueRecord}`);
    console.log(`      Goals: ${awayStats.venueAvgScored} scored, ${awayStats.venueAvgConceded} conceded`);
    console.log(`      Over 2.5: ${awayStats.venueOver25Pct}% | BTTS: ${awayStats.venueBttsPct}%`);
    console.log(`   🔄 H2H: ${h2h.totalMatches} maç | Over 2.5: ${h2h.over25Percentage}% | BTTS: ${h2h.bttsPercentage}%`);
    console.log('');

  } catch (error) {
    console.error('❌ Sportmonks fetch error:', error);
    homeStats = getDefaultStats();
    awayStats = getDefaultStats();
    h2h = getDefaultH2H();
  }

  return { odds, homeStats, awayStats, h2h, injuries };
}

// ==================== PROFESYONEL İSTATİSTİK HESAPLAMA ====================

function calculateProfessionalStats(
  allMatches: any[], 
  teamId: number, 
  teamName: string, 
  venueFilter: 'home' | 'away'
): any {
  
  const generalStats = calculateMatchStats(allMatches.slice(0, 10), teamId, teamName, null);
  
  const venueMatches = allMatches.filter(match => {
    const participants = match.participants || [];
    const homeParticipant = participants.find((p: any) => p.meta?.location === 'home');
    const isTeamHome = homeParticipant?.id === teamId;
    
    if (venueFilter === 'home') return isTeamHome;
    else return !isTeamHome;
  });

  const venueStats = calculateMatchStats(venueMatches.slice(0, 7), teamId, teamName, venueFilter);

  console.log(`   📊 ${teamName} - ${venueFilter === 'home' ? 'HOME' : 'AWAY'} matches found: ${venueMatches.length}`);

  return {
    form: generalStats.form,
    points: generalStats.points,
    record: generalStats.record,
    wins: generalStats.wins,
    draws: generalStats.draws,
    losses: generalStats.losses,
    avgGoalsScored: generalStats.avgScored,
    avgGoalsConceded: generalStats.avgConceded,
    avgGoals: generalStats.avgScored,
    avgConceded: generalStats.avgConceded,
    over25Percentage: generalStats.over25Pct.toString(),
    bttsPercentage: generalStats.bttsPct.toString(),
    cleanSheetPercentage: generalStats.cleanSheetPct,
    failedToScorePercentage: generalStats.failedToScorePct,
    matchCount: generalStats.matchCount,
    matches: generalStats.matchDetails,
    matchDetails: generalStats.matchDetails,
    
    venueForm: venueStats.form,
    venueRecord: venueStats.record,
    venueWins: venueStats.wins,
    venueDraws: venueStats.draws,
    venueLosses: venueStats.losses,
    venueAvgScored: venueStats.avgScored,
    venueAvgConceded: venueStats.avgConceded,
    venueOver25Pct: venueStats.over25Pct,
    venueBttsPct: venueStats.bttsPct,
    venueCleanSheetPct: venueStats.cleanSheetPct,
    venueFailedToScorePct: venueStats.failedToScorePct,
    venueMatchCount: venueStats.matchCount,
    venueMatches: venueStats.matchDetails,
    
    homeRecord: venueFilter === 'home' ? {
      matches: venueStats.matchCount,
      avgScored: venueStats.avgScored,
      avgConceded: venueStats.avgConceded,
      over25Pct: venueStats.over25Pct,
      bttsPct: venueStats.bttsPct,
    } : null,
    awayRecord: venueFilter === 'away' ? {
      matches: venueStats.matchCount,
      avgScored: venueStats.avgScored,
      avgConceded: venueStats.avgConceded,
      over25Pct: venueStats.over25Pct,
      bttsPct: venueStats.bttsPct,
    } : null,
  };
}

function calculateMatchStats(
  matches: any[], 
  teamId: number, 
  teamName: string,
  venueType: 'home' | 'away' | null
): any {
  if (matches.length === 0) {
    return {
      form: 'N/A',
      record: '0W-0D-0L',
      wins: 0, draws: 0, losses: 0,
      avgScored: '0.00', avgConceded: '0.00',
      over25Pct: 50, bttsPct: 50,
      cleanSheetPct: 0, failedToScorePct: 0,
      matchCount: 0,
      matchDetails: [],
    };
  }

  let form = '';
  let totalScored = 0, totalConceded = 0;
  let over25Count = 0, bttsCount = 0;
  let cleanSheets = 0, failedToScore = 0;
  let wins = 0, draws = 0, losses = 0;
  const matchDetails: any[] = [];

  matches.forEach((match: any, index: number) => {
    const participants = match.participants || [];
    const homeParticipant = participants.find((p: any) => p.meta?.location === 'home');
    const awayParticipant = participants.find((p: any) => p.meta?.location === 'away');
    const isHome = homeParticipant?.id === teamId;
    
    const { teamScore, opponentScore } = parseMatchScore(match, teamId, teamName);
    
    totalScored += teamScore;
    totalConceded += opponentScore;
    
    const totalGoals = teamScore + opponentScore;
    if (totalGoals > 2.5) over25Count++;
    if (teamScore > 0 && opponentScore > 0) bttsCount++;
    if (opponentScore === 0) cleanSheets++;
    if (teamScore === 0) failedToScore++;
    
    let result = 'D';
    if (teamScore > opponentScore) { result = 'W'; wins++; }
    else if (teamScore < opponentScore) { result = 'L'; losses++; }
    else { draws++; }
    
    if (index < 5) form += result;
    
    const opponent = isHome ? awayParticipant?.name : homeParticipant?.name;
    matchDetails.push({
      opponent: opponent || 'Unknown',
      score: `${teamScore}-${opponentScore}`,
      result,
      isHome,
      totalGoals,
      btts: teamScore > 0 && opponentScore > 0,
      over25: totalGoals > 2.5,
      date: match.starting_at,
    });
  });

  const count = matches.length;
  
  return {
    form,
    record: `${wins}W-${draws}D-${losses}L`,
    wins, draws, losses,
    avgScored: (totalScored / count).toFixed(2),
    avgConceded: (totalConceded / count).toFixed(2),
    over25Pct: Math.round((over25Count / count) * 100),
    bttsPct: Math.round((bttsCount / count) * 100),
    cleanSheetPct: Math.round((cleanSheets / count) * 100),
    failedToScorePct: Math.round((failedToScore / count) * 100),
    matchCount: count,
    matchDetails: matchDetails.slice(0, 5),
  };
}

function parseMatchScore(match: any, teamId: number, teamName: string): { teamScore: number; opponentScore: number } {
  let teamScore = 0;
  let opponentScore = 0;
  let scoreFound = false;
  
  if (match.scores && Array.isArray(match.scores) && match.scores.length > 0) {
    const currentScores = match.scores.filter((s: any) => 
      s.description === 'CURRENT' || s.type_id === 1525
    );
    
    if (currentScores.length >= 2) {
      currentScores.forEach((s: any) => {
        const goals = s.score?.goals ?? 0;
        if (s.participant_id === teamId) {
          teamScore = goals;
        } else {
          opponentScore = goals;
        }
      });
      scoreFound = true;
    }
    
    if (!scoreFound) {
      const halfScores: Record<number, number> = {};
      match.scores.forEach((s: any) => {
        if (s.description === '2ND_HALF' || s.type_id === 2) {
          const pid = s.participant_id;
          const goals = s.score?.goals ?? 0;
          if (!halfScores[pid] || goals > halfScores[pid]) {
            halfScores[pid] = goals;
          }
        }
      });
      
      if (Object.keys(halfScores).length >= 2) {
        Object.entries(halfScores).forEach(([pid, goals]) => {
          if (parseInt(pid) === teamId) teamScore = goals;
          else opponentScore = goals;
        });
        scoreFound = true;
      }
    }
  }
  
  if (!scoreFound && match.result_info) {
    const resultInfo = match.result_info.toLowerCase();
    const teamFirstWord = teamName.toLowerCase().split(' ')[0];
    
    if (resultInfo.includes('won')) {
      const winnerName = resultInfo.split(' won')[0].trim().toLowerCase();
      if (winnerName.includes(teamFirstWord)) {
        teamScore = 2; opponentScore = 1;
      } else {
        teamScore = 1; opponentScore = 2;
      }
    } else if (resultInfo.includes('draw')) {
      teamScore = 1; opponentScore = 1;
    }
  }
  
  return { teamScore, opponentScore };
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

  matches.forEach((match: any) => {
    const participants = match.participants || [];
    const homeParticipant = participants.find((p: any) => p.meta?.location === 'home');
    const awayParticipant = participants.find((p: any) => p.meta?.location === 'away');
    const isHomeTeamHome = homeParticipant?.id === homeTeamId;
    
    let homeScore = 0, awayScore = 0;
    
    if (match.scores && Array.isArray(match.scores)) {
      const currentScores = match.scores.filter((s: any) => 
        s.description === 'CURRENT' || s.type_id === 1525
      );
      
      if (currentScores.length >= 2) {
        currentScores.forEach((s: any) => {
          const goals = s.score?.goals ?? 0;
          const participant = s.score?.participant;
          
          if (participant === 'home') homeScore = goals;
          else if (participant === 'away') awayScore = goals;
          else {
            if (s.participant_id === homeParticipant?.id) homeScore = goals;
            else awayScore = goals;
          }
        });
      }
    }
    
    let team1Score = homeScore, team2Score = awayScore;
    if (!isHomeTeamHome) {
      [team1Score, team2Score] = [team2Score, team1Score];
    }
    
    totalHomeGoals += team1Score;
    totalAwayGoals += team2Score;
    
    const totalGoals = team1Score + team2Score;
    if (totalGoals > 2.5) over25Count++;
    if (team1Score > 0 && team2Score > 0) bttsCount++;
    
    if (team1Score > team2Score) homeWins++;
    else if (team2Score > team1Score) awayWins++;
    else draws++;
    
    matchDetails.push({
      date: match.starting_at,
      score: `${team1Score}-${team2Score}`,
      totalGoals,
      btts: team1Score > 0 && team2Score > 0,
      over25: totalGoals > 2.5,
      winner: team1Score > team2Score ? homeTeamName : (team2Score > team1Score ? awayTeamName : 'Draw'),
    });
  });

  const count = matches.length || 1;
  
  return {
    totalMatches: matches.length,
    homeWins, awayWins, draws,
    totalHomeGoals, totalAwayGoals,
    avgHomeGoals: (totalHomeGoals / count).toFixed(2),
    avgAwayGoals: (totalAwayGoals / count).toFixed(2),
    avgTotalGoals: ((totalHomeGoals + totalAwayGoals) / count).toFixed(2),
    avgGoals: ((totalHomeGoals + totalAwayGoals) / count).toFixed(2),
    over25Percentage: Math.round((over25Count / count) * 100).toString(),
    over25Count,
    bttsPercentage: Math.round((bttsCount / count) * 100).toString(),
    bttsCount,
    matchDetails: matchDetails.slice(0, 5),
  };
}

// ==================== SAKATLIK VERİSİ ====================

function parseInjuries(injuryData: any[]): any[] {
  if (!Array.isArray(injuryData)) return [];
  
  return injuryData
    .filter((injury: any) => {
      const endDate = injury.end_date;
      if (!endDate) return true;
      return new Date(endDate) > new Date();
    })
    .map((injury: any) => ({
      player: injury.player?.display_name || injury.player?.name || 'Unknown',
      type: injury.type?.name || injury.category || 'Injury',
      startDate: injury.start_date,
      expectedReturn: injury.end_date || 'Unknown',
    }))
    .slice(0, 5);
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

  const getBestOdd = (odds: any[], marketFilter: (m: string) => boolean, labelFilter: string): number | null => {
    const filtered = odds.filter(o => {
      const market = (o.market_description || '').toLowerCase();
      return marketFilter(market) && (o.label === labelFilter || o.name === labelFilter);
    });
    
    if (filtered.length === 0) return null;
    const bet365 = filtered.find(o => o.bookmaker_id === 2);
    if (bet365) return parseFloat(bet365.value);
    return parseFloat(filtered[0].value);
  };

  const is1X2Market = (m: string) => 
    m === 'full time result' || m === 'fulltime result' || 
    m === 'match winner' || m === '1x2' || m === 'home/away';
  
  result.matchWinner.home = getBestOdd(oddsData, is1X2Market, '1') || getBestOdd(oddsData, is1X2Market, 'Home');
  result.matchWinner.draw = getBestOdd(oddsData, is1X2Market, 'X') || getBestOdd(oddsData, is1X2Market, 'Draw');
  result.matchWinner.away = getBestOdd(oddsData, is1X2Market, '2') || getBestOdd(oddsData, is1X2Market, 'Away');

  oddsData.forEach((odd: any) => {
    const marketName = (odd.market_description || '').toLowerCase();
    
    if (marketName.includes('goals over/under') || marketName === 'alternative total goals') {
      const total = odd.total || odd.handicap;
      
      if (total == 2.5 || total === '2.5') {
        if (odd.label === 'Over' && !result.overUnder['2.5'].over) {
          result.overUnder['2.5'].over = parseFloat(odd.value);
        }
        if (odd.label === 'Under' && !result.overUnder['2.5'].under) {
          result.overUnder['2.5'].under = parseFloat(odd.value);
        }
      }
      if (total == 3.5 || total === '3.5') {
        if (odd.label === 'Over' && !result.overUnder['3.5'].over) {
          result.overUnder['3.5'].over = parseFloat(odd.value);
        }
        if (odd.label === 'Under' && !result.overUnder['3.5'].under) {
          result.overUnder['3.5'].under = parseFloat(odd.value);
        }
      }
    }
  });

  const isBttsMarket = (m: string) => m.includes('both teams');
  result.btts.yes = getBestOdd(oddsData, isBttsMarket, 'Yes');
  result.btts.no = getBestOdd(oddsData, isBttsMarket, 'No');

  const isDCMarket = (m: string) => m === 'double chance';
  result.doubleChance.homeOrDraw = getBestOdd(oddsData, isDCMarket, '1X');
  result.doubleChance.homeOrAway = getBestOdd(oddsData, isDCMarket, '12');
  result.doubleChance.drawOrAway = getBestOdd(oddsData, isDCMarket, 'X2');

  console.log(`   ✅ Odds: 1=${result.matchWinner.home || 'N/A'} X=${result.matchWinner.draw || 'N/A'} 2=${result.matchWinner.away || 'N/A'}`);
  console.log(`   ✅ O/U 2.5: O=${result.overUnder['2.5'].over || 'N/A'} U=${result.overUnder['2.5'].under || 'N/A'}`);
  console.log(`   ✅ BTTS: Yes=${result.btts.yes || 'N/A'} No=${result.btts.no || 'N/A'}`);

  return result;
}

// ==================== DEFAULT VALUES ====================

function getDefaultStats(): any {
  return { 
    form: 'N/A', points: 0, record: '0W-0D-0L',
    wins: 0, draws: 0, losses: 0,
    avgGoalsScored: '1.20', avgGoalsConceded: '1.00',
    avgGoals: '1.20', avgConceded: '1.00',
    over25Percentage: '50', bttsPercentage: '50',
    cleanSheetPercentage: 0, failedToScorePercentage: 0,
    venueForm: 'N/A', venueRecord: '0W-0D-0L',
    venueAvgScored: '1.20', venueAvgConceded: '1.00',
    venueOver25Pct: 50, venueBttsPct: 50,
    venueMatchCount: 0,
    matches: [], matchDetails: [], matchCount: 0,
  };
}

function getDefaultH2H(): any {
  return { 
    totalMatches: 0, homeWins: 0, awayWins: 0, draws: 0,
    avgTotalGoals: '2.50', avgGoals: '2.50',
    over25Percentage: '50', bttsPercentage: '50',
    matchDetails: [],
  };
}

// ==================== PROFESYONEL OVER/UNDER HESAPLAMA ====================

function calculateProfessionalOverUnder(
  homeStats: any,
  awayStats: any,
  h2h: any
): { prediction: string; confidence: number; breakdown: any } {
  
  const WEIGHTS = {
    homeVenue: 0.30,
    awayVenue: 0.30,
    h2h: 0.25,
    general: 0.15,
  };

  const homeVenueOver = homeStats.venueOver25Pct || parseInt(homeStats.over25Percentage) || 50;
  const awayVenueOver = awayStats.venueOver25Pct || parseInt(awayStats.over25Percentage) || 50;
  const h2hOver = parseInt(h2h.over25Percentage) || 50;
  const generalOver = (parseInt(homeStats.over25Percentage) + parseInt(awayStats.over25Percentage)) / 2;

  const weightedOver = 
    (homeVenueOver * WEIGHTS.homeVenue) +
    (awayVenueOver * WEIGHTS.awayVenue) +
    (h2hOver * WEIGHTS.h2h) +
    (generalOver * WEIGHTS.general);

  const homeExpectedGoals = parseFloat(homeStats.venueAvgScored || homeStats.avgGoalsScored || '1.2');
  const awayExpectedGoals = parseFloat(awayStats.venueAvgScored || awayStats.avgGoalsScored || '1.0');
  const expectedTotal = homeExpectedGoals + 
    parseFloat(awayStats.venueAvgConceded || awayStats.avgGoalsConceded || '1.2') / 2 +
    awayExpectedGoals + 
    parseFloat(homeStats.venueAvgConceded || homeStats.avgGoalsConceded || '1.0') / 2;

  const prediction = weightedOver >= 50 ? 'Over' : 'Under';
  const confidence = Math.abs(weightedOver - 50) + 50;

  return {
    prediction,
    confidence: Math.min(85, Math.max(50, Math.round(confidence))),
    breakdown: {
      homeVenueOver,
      awayVenueOver,
      h2hOver,
      generalOver,
      weightedOver: Math.round(weightedOver),
      expectedTotal: (expectedTotal / 2).toFixed(2),
      weights: WEIGHTS,
    }
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
    console.log('🤖 PROFESSIONAL AGENT ANALYSIS (V3 - HOME/AWAY SPLIT)');
    console.log('🤖 ═══════════════════════════════════════════════════');
    console.log(`📍 Match: ${homeTeam} vs ${awayTeam}`);
    console.log(`🆔 IDs: Home=${homeTeamId}, Away=${awayTeamId}, Fixture=${fixtureId}`);
    console.log('');

    // DETAYLI VERİ ÇEK
    const { odds, homeStats, awayStats, h2h, injuries } = await fetchDetailedMatchData(
      fixtureId, homeTeamId, awayTeamId, homeTeam, awayTeam
    );

    // Profesyonel Over/Under hesaplama
    const overUnderCalc = calculateProfessionalOverUnder(homeStats, awayStats, h2h);
    
    console.log('');
    console.log('🎯 ═══════════════════════════════════════════════════');
    console.log('🎯 PROFESSIONAL OVER/UNDER CALCULATION');
    console.log('🎯 ═══════════════════════════════════════════════════');
    console.log(`   📊 ${homeTeam} EVDEKİ Over 2.5: ${overUnderCalc.breakdown.homeVenueOver}% (ağırlık: 30%)`);
    console.log(`   📊 ${awayTeam} DEPLASMANDAKİ Over 2.5: ${overUnderCalc.breakdown.awayVenueOver}% (ağırlık: 30%)`);
    console.log(`   📊 H2H Over 2.5: ${overUnderCalc.breakdown.h2hOver}% (ağırlık: 25%)`);
    console.log(`   📊 Genel Form Over 2.5: ${overUnderCalc.breakdown.generalOver}% (ağırlık: 15%)`);
    console.log(`   ─────────────────────────────────────`);
    console.log(`   🎯 WEIGHTED OVER 2.5: ${overUnderCalc.breakdown.weightedOver}%`);
    console.log(`   🎯 PREDICTION: ${overUnderCalc.prediction} (${overUnderCalc.confidence}% güven)`);
    console.log(`   🎯 Expected Total Goals: ${overUnderCalc.breakdown.expectedTotal}`);
    console.log('');

    // Match data objesi
    const matchData: any = {
      fixtureId, homeTeam, awayTeam, homeTeamId, awayTeamId, league,
      date: new Date().toISOString(),
      odds,
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
        venueForm: homeStats.venueForm,
        venueAvgScored: homeStats.venueAvgScored,
        venueAvgConceded: homeStats.venueAvgConceded,
        venueOver25Pct: homeStats.venueOver25Pct,
        venueBttsPct: homeStats.venueBttsPct,
      },
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
        venueForm: awayStats.venueForm,
        venueAvgScored: awayStats.venueAvgScored,
        venueAvgConceded: awayStats.venueAvgConceded,
        venueOver25Pct: awayStats.venueOver25Pct,
        venueBttsPct: awayStats.venueBttsPct,
      },
      h2h: {
        totalMatches: h2h.totalMatches,
        homeWins: h2h.homeWins,
        awayWins: h2h.awayWins,
        draws: h2h.draws,
        avgGoals: h2h.avgGoals,
        over25Percentage: h2h.over25Percentage,
        bttsPercentage: h2h.bttsPercentage,
      },
      detailedStats: {
        home: homeStats,
        away: awayStats,
        h2h: h2h,
        injuries: injuries,
      },
      professionalCalc: {
        overUnder: overUnderCalc,
      },
    };

    // Multi-Model Analysis
    let multiModelResult = null;
    if (useMultiModel) {
      try {
        multiModelResult = await runMultiModelAnalysis(matchData);
      } catch (mmError) {
        console.error('⚠️ Multi-Model Analysis failed:', mmError);
      }
    }

    // Standard Agent Analysis
    const result = await runFullAnalysis({ matchData }, language as 'tr' | 'en' | 'de');

    console.log('');
    console.log('✅ ═══════════════════════════════════════════════════');
    console.log('✅ ANALYSIS COMPLETE');
    console.log('✅ ═══════════════════════════════════════════════════');
    console.log('');

    // ═══════════════════════════════════════════════════
    // 📊 TAHMİNİ VERİTABANINA KAYDET (Backtesting için)
    // ═══════════════════════════════════════════════════
    try {
      await savePrediction({
        fixtureId: matchData.fixtureId,
        matchDate: matchData.date,
        homeTeam: matchData.homeTeam,
        awayTeam: matchData.awayTeam,
        league: matchData.league,
        reports: {
          deepAnalysis: result.reports?.deepAnalysis,
          stats: result.reports?.stats,
          odds: result.reports?.odds,
          strategy: result.reports?.strategy,
          weightedConsensus: result.reports?.weightedConsensus,
        },
        multiModel: multiModelResult ? {
          predictions: multiModelResult.predictions,
          consensus: multiModelResult.consensus,
          modelAgreement: multiModelResult.modelAgreement,
        } : undefined,
      });
      console.log('📊 Prediction saved to database for backtesting');
    } catch (saveError) {
      console.error('⚠️ Prediction save failed (non-blocking):', saveError);
    }

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
        hasOdds: !!(odds?.matchWinner?.home),
        hasHomeForm: !!(homeStats?.form && homeStats.form !== 'N/A'),
        hasAwayForm: !!(awayStats?.form && awayStats.form !== 'N/A'),
        hasH2H: !!(h2h?.totalMatches && h2h.totalMatches > 0),
        hasInjuries: (injuries?.home?.length > 0) || (injuries?.away?.length > 0),
        homeVenueMatches: homeStats?.venueMatchCount || 0,
        awayVenueMatches: awayStats?.venueMatchCount || 0,
        h2hMatchCount: h2h?.totalMatches || 0,
      },
      professionalCalc: {
        overUnder: overUnderCalc,
      },
      rawStats: {
        home: homeStats,
        away: awayStats,
        h2h: h2h,
        injuries: injuries,
        odds: odds,
      },
    });
  } catch (error: any) {
    console.error('❌ Agent error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
