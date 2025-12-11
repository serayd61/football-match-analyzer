import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const SPORTMONKS_API_KEY = process.env.SPORTMONKS_API_KEY;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const PERPLEXITY_API_KEY = process.env.PERPLEXITY_API_KEY;

// ============================================================================
// TİPLER
// ============================================================================

interface MatchData {
  date: string;
  opponent: string;
  opponentId: number;
  isHome: boolean;
  goalsFor: number;
  goalsAgainst: number;
  result: 'W' | 'D' | 'L';
  firstHalfGoalsFor: number;
  firstHalfGoalsAgainst: number;
  secondHalfGoalsFor: number;
  secondHalfGoalsAgainst: number;
}

interface TeamStats {
  name: string;
  teamId: number;
  totalMatches: number;
  // Genel
  form: string;
  wins: number;
  draws: number;
  losses: number;
  goalsFor: number;
  goalsAgainst: number;
  avgGoalsFor: number;
  avgGoalsAgainst: number;
  // Ev performansı
  homeMatches: number;
  homeWins: number;
  homeDraws: number;
  homeLosses: number;
  homeGoalsFor: number;
  homeGoalsAgainst: number;
  avgHomeGoalsFor: number;
  avgHomeGoalsAgainst: number;
  // Deplasman performansı
  awayMatches: number;
  awayWins: number;
  awayDraws: number;
  awayLosses: number;
  awayGoalsFor: number;
  awayGoalsAgainst: number;
  avgAwayGoalsFor: number;
  avgAwayGoalsAgainst: number;
  // Özel metrikler
  cleanSheets: number;
  cleanSheetPercent: number;
  failedToScore: number;
  failedToScorePercent: number;
  bttsMatches: number;
  bttsPercent: number;
  over25Matches: number;
  over25Percent: number;
  over15Matches: number;
  over15Percent: number;
  // İlk/İkinci yarı
  firstHalfGoalsFor: number;
  firstHalfGoalsAgainst: number;
  secondHalfGoalsFor: number;
  secondHalfGoalsAgainst: number;
  avgFirstHalfGoals: number;
  avgSecondHalfGoals: number;
  // Win streaks
  currentStreak: string;
  longestWinStreak: number;
  longestLossStreak: number;
  // Detaylı maçlar
  recentMatches: MatchData[];
  last5Form: string;
  last5GoalsFor: number;
  last5GoalsAgainst: number;
}

interface H2HStats {
  totalMatches: number;
  team1Wins: number;
  team2Wins: number;
  draws: number;
  team1Goals: number;
  team2Goals: number;
  avgGoals: number;
  bttsCount: number;
  bttsPercent: number;
  over25Count: number;
  over25Percent: number;
  over15Count: number;
  over15Percent: number;
  recentMatches: {
    date: string;
    homeTeam: string;
    awayTeam: string;
    homeGoals: number;
    awayGoals: number;
    winner: string;
  }[];
  team1HomeRecord: { wins: number; draws: number; losses: number };
  team1AwayRecord: { wins: number; draws: number; losses: number };
}

// ============================================================================
// SPORTMONKS - TAKIM İSTATİSTİKLERİ (DÜZELTILMIŞ ENDPOINT)
// ============================================================================

async function fetchTeamStats(teamId: number, teamName: string): Promise<TeamStats> {
  const defaults: TeamStats = {
    name: teamName,
    teamId: teamId,
    totalMatches: 0,
    form: 'DDDDD',
    wins: 0, draws: 0, losses: 0,
    goalsFor: 0, goalsAgainst: 0,
    avgGoalsFor: 0, avgGoalsAgainst: 0,
    homeMatches: 0, homeWins: 0, homeDraws: 0, homeLosses: 0,
    homeGoalsFor: 0, homeGoalsAgainst: 0,
    avgHomeGoalsFor: 0, avgHomeGoalsAgainst: 0,
    awayMatches: 0, awayWins: 0, awayDraws: 0, awayLosses: 0,
    awayGoalsFor: 0, awayGoalsAgainst: 0,
    avgAwayGoalsFor: 0, avgAwayGoalsAgainst: 0,
    cleanSheets: 0, cleanSheetPercent: 0,
    failedToScore: 0, failedToScorePercent: 0,
    bttsMatches: 0, bttsPercent: 0,
    over25Matches: 0, over25Percent: 0,
    over15Matches: 0, over15Percent: 0,
    firstHalfGoalsFor: 0, firstHalfGoalsAgainst: 0,
    secondHalfGoalsFor: 0, secondHalfGoalsAgainst: 0,
    avgFirstHalfGoals: 0, avgSecondHalfGoals: 0,
    currentStreak: 'N/A',
    longestWinStreak: 0, longestLossStreak: 0,
    recentMatches: [],
    last5Form: 'DDDDD',
    last5GoalsFor: 0, last5GoalsAgainst: 0,
  };

  if (!teamId || !SPORTMONKS_API_KEY) {
    console.log(`⚠️ No teamId or API key for ${teamName}, using defaults`);
    return defaults;
  }

  try {
    // ✅ ÇALIŞAN ENDPOINT - Teams API with latest matches
    const url = `https://api.sportmonks.com/v3/football/teams/${teamId}?api_token=${SPORTMONKS_API_KEY}&include=latest.scores;latest.participants`;
    
    console.log(`📊 Fetching stats for ${teamName} (ID: ${teamId})`);
    
    const response = await fetch(url, { 
      cache: 'no-store',
      headers: { 'Accept': 'application/json' }
    });

    if (!response.ok) {
      console.log(`❌ API error for ${teamName}: ${response.status}`);
      return defaults;
    }

    const json = await response.json();
    const teamData = json.data;
    const matches = teamData?.latest || [];

    if (matches.length === 0) {
      console.log(`⚠️ No matches found for ${teamName}`);
      return defaults;
    }

    console.log(`✅ Found ${matches.length} matches for ${teamName}`);

    // İstatistik değişkenleri
    let wins = 0, draws = 0, losses = 0;
    let goalsFor = 0, goalsAgainst = 0;
    let homeMatches = 0, homeWins = 0, homeDraws = 0, homeLosses = 0;
    let homeGoalsFor = 0, homeGoalsAgainst = 0;
    let awayMatches = 0, awayWins = 0, awayDraws = 0, awayLosses = 0;
    let awayGoalsFor = 0, awayGoalsAgainst = 0;
    let cleanSheets = 0, failedToScore = 0;
    let bttsMatches = 0, over25Matches = 0, over15Matches = 0;
    let firstHalfGF = 0, firstHalfGA = 0;
    let secondHalfGF = 0, secondHalfGA = 0;
    
    const formArray: string[] = [];
    const recentMatches: MatchData[] = [];
    
    let currentWinStreak = 0, currentLossStreak = 0;
    let longestWinStreak = 0, longestLossStreak = 0;
    let lastResult = '';

    // Son 20 maçı işle (en yeniden eskiye sıralı)
    const processMatches = matches.slice(0, 20);
    
    for (let i = 0; i < processMatches.length; i++) {
      const match = processMatches[i];
      const participants = match.participants || [];
      const scores = match.scores || [];
      
      // Bu takım ev sahibi mi deplasman mı?
      const teamParticipant = participants.find((p: any) => p.id === teamId);
      const isHome = teamParticipant?.meta?.location === 'home';
      
      // Rakibi bul
      const opponent = participants.find((p: any) => p.id !== teamId);
      const opponentName = opponent?.name || 'Unknown';
      const opponentId = opponent?.id || 0;
      
      // Final skorunu bul (CURRENT type)
      let teamGoals = 0, opponentGoals = 0;
      let fhTeamGoals = 0, fhOpponentGoals = 0;
      let shTeamGoals = 0, shOpponentGoals = 0;
      
      for (const score of scores) {
        if (score.description === 'CURRENT' && score.participant_id === teamId) {
          teamGoals = score.score?.goals ?? 0;
        }
        if (score.description === 'CURRENT' && score.participant_id === opponentId) {
          opponentGoals = score.score?.goals ?? 0;
        }
        // İlk yarı
        if (score.description === '1ST_HALF' && score.participant_id === teamId) {
          fhTeamGoals = score.score?.goals ?? 0;
        }
        if (score.description === '1ST_HALF' && score.participant_id === opponentId) {
          fhOpponentGoals = score.score?.goals ?? 0;
        }
        // İkinci yarı (2ND_HALF_ONLY)
        if (score.description === '2ND_HALF_ONLY' && score.participant_id === teamId) {
          shTeamGoals = score.score?.goals ?? 0;
        }
        if (score.description === '2ND_HALF_ONLY' && score.participant_id === opponentId) {
          shOpponentGoals = score.score?.goals ?? 0;
        }
      }

      // Sonuç belirleme
      let result: 'W' | 'D' | 'L';
      if (teamGoals > opponentGoals) {
        result = 'W';
        wins++;
        if (isHome) homeWins++; else awayWins++;
        
        if (lastResult === 'W' || lastResult === '') currentWinStreak++;
        else currentWinStreak = 1;
        currentLossStreak = 0;
        longestWinStreak = Math.max(longestWinStreak, currentWinStreak);
      } else if (teamGoals < opponentGoals) {
        result = 'L';
        losses++;
        if (isHome) homeLosses++; else awayLosses++;
        
        if (lastResult === 'L' || lastResult === '') currentLossStreak++;
        else currentLossStreak = 1;
        currentWinStreak = 0;
        longestLossStreak = Math.max(longestLossStreak, currentLossStreak);
      } else {
        result = 'D';
        draws++;
        if (isHome) homeDraws++; else awayDraws++;
        currentWinStreak = 0;
        currentLossStreak = 0;
      }
      lastResult = result;

      // Gol istatistikleri
      goalsFor += teamGoals;
      goalsAgainst += opponentGoals;
      firstHalfGF += fhTeamGoals;
      firstHalfGA += fhOpponentGoals;
      secondHalfGF += shTeamGoals;
      secondHalfGA += shOpponentGoals;

      if (isHome) {
        homeMatches++;
        homeGoalsFor += teamGoals;
        homeGoalsAgainst += opponentGoals;
      } else {
        awayMatches++;
        awayGoalsFor += teamGoals;
        awayGoalsAgainst += opponentGoals;
      }

      // Özel metrikler
      if (opponentGoals === 0) cleanSheets++;
      if (teamGoals === 0) failedToScore++;
      if (teamGoals > 0 && opponentGoals > 0) bttsMatches++;
      if (teamGoals + opponentGoals > 2.5) over25Matches++;
      if (teamGoals + opponentGoals > 1.5) over15Matches++;

      formArray.push(result);
      
      // Detaylı maç verisi
      recentMatches.push({
        date: match.starting_at?.split('T')[0] || 'Unknown',
        opponent: opponentName,
        opponentId,
        isHome,
        goalsFor: teamGoals,
        goalsAgainst: opponentGoals,
        result,
        firstHalfGoalsFor: fhTeamGoals,
        firstHalfGoalsAgainst: fhOpponentGoals,
        secondHalfGoalsFor: shTeamGoals,
        secondHalfGoalsAgainst: shOpponentGoals,
      });
    }

    const totalMatches = processMatches.length;
    const last5 = recentMatches.slice(0, 5);
    
    // Current streak hesaplama
    let streakType = formArray[0];
    let streakCount = 0;
    for (const r of formArray) {
      if (r === streakType) streakCount++;
      else break;
    }
    const currentStreak = streakCount > 0 ? `${streakCount}${streakType}` : 'N/A';

    const stats: TeamStats = {
      name: teamName,
      teamId,
      totalMatches,
      form: formArray.slice(0, 10).join(''),
      wins, draws, losses,
      goalsFor, goalsAgainst,
      avgGoalsFor: Number((goalsFor / totalMatches).toFixed(2)),
      avgGoalsAgainst: Number((goalsAgainst / totalMatches).toFixed(2)),
      homeMatches, homeWins, homeDraws, homeLosses,
      homeGoalsFor, homeGoalsAgainst,
      avgHomeGoalsFor: homeMatches > 0 ? Number((homeGoalsFor / homeMatches).toFixed(2)) : 0,
      avgHomeGoalsAgainst: homeMatches > 0 ? Number((homeGoalsAgainst / homeMatches).toFixed(2)) : 0,
      awayMatches, awayWins, awayDraws, awayLosses,
      awayGoalsFor, awayGoalsAgainst,
      avgAwayGoalsFor: awayMatches > 0 ? Number((awayGoalsFor / awayMatches).toFixed(2)) : 0,
      avgAwayGoalsAgainst: awayMatches > 0 ? Number((awayGoalsAgainst / awayMatches).toFixed(2)) : 0,
      cleanSheets,
      cleanSheetPercent: Math.round((cleanSheets / totalMatches) * 100),
      failedToScore,
      failedToScorePercent: Math.round((failedToScore / totalMatches) * 100),
      bttsMatches,
      bttsPercent: Math.round((bttsMatches / totalMatches) * 100),
      over25Matches,
      over25Percent: Math.round((over25Matches / totalMatches) * 100),
      over15Matches,
      over15Percent: Math.round((over15Matches / totalMatches) * 100),
      firstHalfGoalsFor: firstHalfGF,
      firstHalfGoalsAgainst: firstHalfGA,
      secondHalfGoalsFor: secondHalfGF,
      secondHalfGoalsAgainst: secondHalfGA,
      avgFirstHalfGoals: Number(((firstHalfGF + firstHalfGA) / totalMatches).toFixed(2)),
      avgSecondHalfGoals: Number(((secondHalfGF + secondHalfGA) / totalMatches).toFixed(2)),
      currentStreak,
      longestWinStreak,
      longestLossStreak,
      recentMatches,
      last5Form: formArray.slice(0, 5).join(''),
      last5GoalsFor: last5.reduce((sum, m) => sum + m.goalsFor, 0),
      last5GoalsAgainst: last5.reduce((sum, m) => sum + m.goalsAgainst, 0),
    };

    console.log(`📈 ${teamName} stats: Form=${stats.form}, AvgGF=${stats.avgGoalsFor}, AvgGA=${stats.avgGoalsAgainst}`);

    return stats;
  } catch (error) {
    console.error(`❌ Error fetching ${teamName}:`, error);
    return defaults;
  }
}

// ============================================================================
// SPORTMONKS - H2H (Karşılıklı Maçlar)
// ============================================================================

async function fetchH2H(
  team1Id: number, 
  team2Id: number, 
  team1Name: string, 
  team2Name: string
): Promise<H2HStats> {
  const defaults: H2HStats = {
    totalMatches: 0,
    team1Wins: 0, team2Wins: 0, draws: 0,
    team1Goals: 0, team2Goals: 0,
    avgGoals: 0,
    bttsCount: 0, bttsPercent: 0,
    over25Count: 0, over25Percent: 0,
    over15Count: 0, over15Percent: 0,
    recentMatches: [],
    team1HomeRecord: { wins: 0, draws: 0, losses: 0 },
    team1AwayRecord: { wins: 0, draws: 0, losses: 0 },
  };

  if (!team1Id || !team2Id || !SPORTMONKS_API_KEY) {
    console.log('⚠️ No H2H data available');
    return defaults;
  }

  try {
    const url = `https://api.sportmonks.com/v3/football/fixtures/head-to-head/${team1Id}/${team2Id}?api_token=${SPORTMONKS_API_KEY}&include=scores;participants`;
    
    console.log(`🔄 Fetching H2H: ${team1Name} vs ${team2Name}`);

    const response = await fetch(url, { 
      cache: 'no-store',
      headers: { 'Accept': 'application/json' }
    });

    if (!response.ok) {
      console.log(`❌ H2H API error: ${response.status}`);
      return defaults;
    }

    const json = await response.json();
    const matches = json.data || [];

    if (matches.length === 0) {
      console.log('⚠️ No H2H matches found');
      return defaults;
    }

    console.log(`✅ Found ${matches.length} H2H matches`);

    let team1Wins = 0, team2Wins = 0, draws = 0;
    let team1Goals = 0, team2Goals = 0;
    let bttsCount = 0, over25Count = 0, over15Count = 0;
    const recentMatches: H2HStats['recentMatches'] = [];
    const team1HomeRecord = { wins: 0, draws: 0, losses: 0 };
    const team1AwayRecord = { wins: 0, draws: 0, losses: 0 };

    for (const match of matches.slice(0, 15)) {
      const participants = match.participants || [];
      const scores = match.scores || [];
      
      // Ev sahibi ve deplasman takımlarını bul
      const homeParticipant = participants.find((p: any) => p.meta?.location === 'home');
      const awayParticipant = participants.find((p: any) => p.meta?.location === 'away');
      
      const homeTeamId = homeParticipant?.id;
      const homeTeamName = homeParticipant?.name || 'Unknown';
      const awayTeamName = awayParticipant?.name || 'Unknown';
      
      // Skorları bul
      let homeGoals = 0, awayGoals = 0;
      for (const score of scores) {
        if (score.description === 'CURRENT') {
          if (score.participant_id === homeTeamId) {
            homeGoals = score.score?.goals ?? 0;
          } else {
            awayGoals = score.score?.goals ?? 0;
          }
        }
      }

      // Team1 açısından hesapla
      const team1IsHome = homeTeamId === team1Id;
      const t1Goals = team1IsHome ? homeGoals : awayGoals;
      const t2Goals = team1IsHome ? awayGoals : homeGoals;
      
      team1Goals += t1Goals;
      team2Goals += t2Goals;

      // Kazanan
      let winner = 'Draw';
      if (t1Goals > t2Goals) {
        team1Wins++;
        winner = team1Name;
        if (team1IsHome) team1HomeRecord.wins++;
        else team1AwayRecord.wins++;
      } else if (t2Goals > t1Goals) {
        team2Wins++;
        winner = team2Name;
        if (team1IsHome) team1HomeRecord.losses++;
        else team1AwayRecord.losses++;
      } else {
        draws++;
        if (team1IsHome) team1HomeRecord.draws++;
        else team1AwayRecord.draws++;
      }

      // Metrikler
      if (homeGoals > 0 && awayGoals > 0) bttsCount++;
      if (homeGoals + awayGoals > 2.5) over25Count++;
      if (homeGoals + awayGoals > 1.5) over15Count++;

      if (recentMatches.length < 10) {
        recentMatches.push({
          date: match.starting_at?.split('T')[0] || 'Unknown',
          homeTeam: homeTeamName,
          awayTeam: awayTeamName,
          homeGoals,
          awayGoals,
          winner,
        });
      }
    }

    const totalMatches = Math.min(matches.length, 15);

    const h2h: H2HStats = {
      totalMatches,
      team1Wins, team2Wins, draws,
      team1Goals, team2Goals,
      avgGoals: Number(((team1Goals + team2Goals) / totalMatches).toFixed(2)),
      bttsCount,
      bttsPercent: Math.round((bttsCount / totalMatches) * 100),
      over25Count,
      over25Percent: Math.round((over25Count / totalMatches) * 100),
      over15Count,
      over15Percent: Math.round((over15Count / totalMatches) * 100),
      recentMatches,
      team1HomeRecord,
      team1AwayRecord,
    };

    console.log(`📊 H2H: ${team1Name} ${team1Wins}W-${draws}D-${team2Wins}L ${team2Name}, AvgGoals=${h2h.avgGoals}`);

    return h2h;
  } catch (error) {
    console.error('❌ H2H fetch error:', error);
    return defaults;
  }
}

// ============================================================================
// PROFESYONEL AI PROMPT - ÇOK DETAYLI ANALİZ
// ============================================================================

function createProfessionalPrompt(
  homeTeam: string,
  awayTeam: string,
  homeStats: TeamStats,
  awayStats: TeamStats,
  h2h: H2HStats,
  lang: string,
  aiModel: string
): string {
  
  // Son 5 maç detayları
  const homeRecent = homeStats.recentMatches.slice(0, 5).map(m => 
    `${m.result} ${m.goalsFor}-${m.goalsAgainst} vs ${m.opponent} (${m.isHome ? 'H' : 'A'})`
  ).join('\n    ');
  
  const awayRecent = awayStats.recentMatches.slice(0, 5).map(m => 
    `${m.result} ${m.goalsFor}-${m.goalsAgainst} vs ${m.opponent} (${m.isHome ? 'H' : 'A'})`
  ).join('\n    ');

  // H2H detayları
  const h2hRecent = h2h.recentMatches.slice(0, 5).map(m =>
    `${m.homeTeam} ${m.homeGoals}-${m.awayGoals} ${m.awayTeam} (${m.date})`
  ).join('\n    ');

  // Win rate hesaplamaları
  const homeWinRate = homeStats.totalMatches > 0 ? Math.round((homeStats.wins / homeStats.totalMatches) * 100) : 0;
  const awayWinRate = awayStats.totalMatches > 0 ? Math.round((awayStats.wins / awayStats.totalMatches) * 100) : 0;
  const homeHomeWinRate = homeStats.homeMatches > 0 ? Math.round((homeStats.homeWins / homeStats.homeMatches) * 100) : 0;
  const awayAwayWinRate = awayStats.awayMatches > 0 ? Math.round((awayStats.awayWins / awayStats.awayMatches) * 100) : 0;

  // TÜRKÇE PROMPT
  if (lang === 'tr') {
    return `Sen ${aiModel} adlı profesyonel futbol analisti yapay zekasısın. Aşağıdaki kapsamlı istatistikleri kullanarak bu maç için detaylı tahmin yap.

╔══════════════════════════════════════════════════════════════════════════════╗
║                    ⚽ MAÇ ANALİZİ: ${homeTeam} vs ${awayTeam}                    
╚══════════════════════════════════════════════════════════════════════════════╝

┌──────────────────────────────────────────────────────────────────────────────┐
│ 📊 ${homeTeam.toUpperCase()} - DETAYLI İSTATİSTİKLER (EV SAHİBİ)                       
├──────────────────────────────────────────────────────────────────────────────┤
│ 
│ GENEL PERFORMANS (Son ${homeStats.totalMatches} maç):
│   • Form: ${homeStats.form}
│   • Galibiyet: ${homeStats.wins} (${homeWinRate}%) | Beraberlik: ${homeStats.draws} | Mağlubiyet: ${homeStats.losses}
│   • Attığı Gol: ${homeStats.goalsFor} (Maç başı: ${homeStats.avgGoalsFor})
│   • Yediği Gol: ${homeStats.goalsAgainst} (Maç başı: ${homeStats.avgGoalsAgainst})
│   • Mevcut Seri: ${homeStats.currentStreak}
│   
│ EV SAHİBİ PERFORMANSI (${homeStats.homeMatches} maç):
│   • Galibiyet: ${homeStats.homeWins} (${homeHomeWinRate}%) | Beraberlik: ${homeStats.homeDraws} | Mağlubiyet: ${homeStats.homeLosses}
│   • Evde Attığı: ${homeStats.homeGoalsFor} (Maç başı: ${homeStats.avgHomeGoalsFor})
│   • Evde Yediği: ${homeStats.homeGoalsAgainst} (Maç başı: ${homeStats.avgHomeGoalsAgainst})
│   
│ ÖZEL METRİKLER:
│   • Clean Sheet (Gol yemeden): ${homeStats.cleanSheets}/${homeStats.totalMatches} (${homeStats.cleanSheetPercent}%)
│   • Gol Atamadığı Maçlar: ${homeStats.failedToScore}/${homeStats.totalMatches} (${homeStats.failedToScorePercent}%)
│   • KG VAR Maçları: ${homeStats.bttsMatches}/${homeStats.totalMatches} (${homeStats.bttsPercent}%)
│   • 2.5 Üst Maçlar: ${homeStats.over25Matches}/${homeStats.totalMatches} (${homeStats.over25Percent}%)
│   • 1.5 Üst Maçlar: ${homeStats.over15Matches}/${homeStats.totalMatches} (${homeStats.over15Percent}%)
│   
│ YARI BAZLI ANALİZ:
│   • İlk Yarı Gol Ort.: ${homeStats.avgFirstHalfGoals}
│   • İkinci Yarı Gol Ort.: ${homeStats.avgSecondHalfGoals}
│   
│ SON 5 MAÇ (En yeniden eskiye):
│   ${homeRecent || 'Veri yok'}
│   • Son 5 Maçta: ${homeStats.last5GoalsFor} gol attı, ${homeStats.last5GoalsAgainst} gol yedi
└──────────────────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────────────────┐
│ 📊 ${awayTeam.toUpperCase()} - DETAYLI İSTATİSTİKLER (DEPLASMAN)                       
├──────────────────────────────────────────────────────────────────────────────┤
│ 
│ GENEL PERFORMANS (Son ${awayStats.totalMatches} maç):
│   • Form: ${awayStats.form}
│   • Galibiyet: ${awayStats.wins} (${awayWinRate}%) | Beraberlik: ${awayStats.draws} | Mağlubiyet: ${awayStats.losses}
│   • Attığı Gol: ${awayStats.goalsFor} (Maç başı: ${awayStats.avgGoalsFor})
│   • Yediği Gol: ${awayStats.goalsAgainst} (Maç başı: ${awayStats.avgGoalsAgainst})
│   • Mevcut Seri: ${awayStats.currentStreak}
│   
│ DEPLASMAN PERFORMANSI (${awayStats.awayMatches} maç):
│   • Galibiyet: ${awayStats.awayWins} (${awayAwayWinRate}%) | Beraberlik: ${awayStats.awayDraws} | Mağlubiyet: ${awayStats.awayLosses}
│   • Deplasmanda Attığı: ${awayStats.awayGoalsFor} (Maç başı: ${awayStats.avgAwayGoalsFor})
│   • Deplasmanda Yediği: ${awayStats.awayGoalsAgainst} (Maç başı: ${awayStats.avgAwayGoalsAgainst})
│   
│ ÖZEL METRİKLER:
│   • Clean Sheet (Gol yemeden): ${awayStats.cleanSheets}/${awayStats.totalMatches} (${awayStats.cleanSheetPercent}%)
│   • Gol Atamadığı Maçlar: ${awayStats.failedToScore}/${awayStats.totalMatches} (${awayStats.failedToScorePercent}%)
│   • KG VAR Maçları: ${awayStats.bttsMatches}/${awayStats.totalMatches} (${awayStats.bttsPercent}%)
│   • 2.5 Üst Maçlar: ${awayStats.over25Matches}/${awayStats.totalMatches} (${awayStats.over25Percent}%)
│   • 1.5 Üst Maçlar: ${awayStats.over15Matches}/${awayStats.totalMatches} (${awayStats.over15Percent}%)
│   
│ YARI BAZLI ANALİZ:
│   • İlk Yarı Gol Ort.: ${awayStats.avgFirstHalfGoals}
│   • İkinci Yarı Gol Ort.: ${awayStats.avgSecondHalfGoals}
│   
│ SON 5 MAÇ (En yeniden eskiye):
│   ${awayRecent || 'Veri yok'}
│   • Son 5 Maçta: ${awayStats.last5GoalsFor} gol attı, ${awayStats.last5GoalsAgainst} gol yedi
└──────────────────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────────────────┐
│ 🔄 KARŞILAŞMA GEÇMİŞİ (H2H) - Son ${h2h.totalMatches} maç                              
├──────────────────────────────────────────────────────────────────────────────┤
│ 
│ GENEL KARŞILAŞMA:
│   • ${homeTeam}: ${h2h.team1Wins} galibiyet
│   • ${awayTeam}: ${h2h.team2Wins} galibiyet  
│   • Beraberlik: ${h2h.draws}
│   
│ GOL İSTATİSTİKLERİ:
│   • ${homeTeam} toplam: ${h2h.team1Goals} gol (Maç başı: ${(h2h.team1Goals / Math.max(h2h.totalMatches, 1)).toFixed(2)})
│   • ${awayTeam} toplam: ${h2h.team2Goals} gol (Maç başı: ${(h2h.team2Goals / Math.max(h2h.totalMatches, 1)).toFixed(2)})
│   • Ortalama Toplam Gol: ${h2h.avgGoals}
│   
│ H2H ÖZEL METRİKLER:
│   • KG VAR: ${h2h.bttsCount}/${h2h.totalMatches} (${h2h.bttsPercent}%)
│   • 2.5 Üst: ${h2h.over25Count}/${h2h.totalMatches} (${h2h.over25Percent}%)
│   • 1.5 Üst: ${h2h.over15Count}/${h2h.totalMatches} (${h2h.over15Percent}%)
│   
│ ${homeTeam} EV SAHİBİYKEN vs ${awayTeam}:
│   • ${h2h.team1HomeRecord.wins}G - ${h2h.team1HomeRecord.draws}B - ${h2h.team1HomeRecord.losses}M
│   
│ SON KARŞILAŞMALAR:
│   ${h2hRecent || 'Veri yok'}
└──────────────────────────────────────────────────────────────────────────────┘

╔══════════════════════════════════════════════════════════════════════════════╗
║ 🎯 ANALİZ TALİMATLARI                                                        
╠══════════════════════════════════════════════════════════════════════════════╣
║ 
║ Sen ${aiModel} olarak, yukarıdaki verileri dikkatli analiz et ve her tahmin
║ için NEDEN o sonuca vardığını açıkla. Analiz şunları içermeli:
║ 
║ 1. MAÇ SONUCU için değerlendir:
║    - Her iki takımın form durumu
║    - Ev sahibinin evdeki performansı vs Deplasmanın dışarıdaki performansı
║    - H2H geçmişi ve psikolojik üstünlük
║    - Gol atma/yeme oranları karşılaştırması
║    
║ 2. TOPLAM GOL (2.5 Üst/Alt) için değerlendir:
║    - Her iki takımın maç başı gol ortalaması
║    - H2H maçlarındaki gol ortalaması
║    - Her iki takımın 2.5 üst/alt yüzdeleri
║    - Defansif/ofansif güçleri
║    
║ 3. KG VAR (BTTS) için değerlendir:
║    - Her iki takımın KG VAR yüzdeleri
║    - Clean sheet oranları
║    - Gol atamama oranları
║    - H2H'daki KG VAR oranı
║    
║ GÜVEN HESAPLAMA KRİTERLERİ:
║ • %85-95: Çok güçlü veri desteği, açık trend, H2H uyumlu
║ • %70-84: İyi veri desteği, belirgin trend
║ • %55-69: Orta düzey veri, karışık sinyaller
║ • %50-54: Zayıf veri, belirsiz durum
║ 
╚══════════════════════════════════════════════════════════════════════════════╝

TAHMİNLERİNİ TAM OLARAK AŞAĞIDAKİ FORMATTA VER:

═══════════════════════════════════════════════════════════
📌 MAÇ SONUCU TAHMİNİ
═══════════════════════════════════════════════════════════
MAC_SONUCU: [Ev Sahibi Kazanir / Beraberlik / Deplasman Kazanir]
MAC_GUVEN: [50-95 arasi sayi]
MAC_GEREKCE: [Bu sonuca neden vardığını 2-3 cümle ile açıkla. Hangi istatistikler seni bu karara yönlendirdi?]

═══════════════════════════════════════════════════════════
📌 TOPLAM GOL TAHMİNİ
═══════════════════════════════════════════════════════════
TOPLAM_GOL: [Ust 2.5 / Alt 2.5]
GOL_GUVEN: [50-95 arasi sayi]
GOL_GEREKCE: [Bu sonuca neden vardığını 2-3 cümle ile açıkla. Gol ortalamalarını ve özel metrikleri referans göster.]

═══════════════════════════════════════════════════════════
📌 KG VAR TAHMİNİ  
═══════════════════════════════════════════════════════════
KG_VAR: [Evet / Hayir]
KG_GUVEN: [50-95 arasi sayi]
KG_GEREKCE: [Bu sonuca neden vardığını 2-3 cümle ile açıkla. Clean sheet ve KG VAR yüzdelerini referans göster.]

═══════════════════════════════════════════════════════════
📌 ${aiModel} GENEL DEĞERLENDİRME
═══════════════════════════════════════════════════════════
GENEL_ANALIZ: [Bu maç hakkında 3-4 cümlelik genel değerlendirme. En güvenilir bahis hangisi ve neden?]`;
  }

  // İNGİLİZCE PROMPT (default)
  return `You are ${aiModel}, a professional football analyst AI. Using the comprehensive statistics below, provide a detailed prediction for this match.

╔══════════════════════════════════════════════════════════════════════════════╗
║                    ⚽ MATCH ANALYSIS: ${homeTeam} vs ${awayTeam}                    
╚══════════════════════════════════════════════════════════════════════════════╝

┌──────────────────────────────────────────────────────────────────────────────┐
│ 📊 ${homeTeam.toUpperCase()} - DETAILED STATISTICS (HOME TEAM)                       
├──────────────────────────────────────────────────────────────────────────────┤
│ 
│ OVERALL PERFORMANCE (Last ${homeStats.totalMatches} matches):
│   • Form: ${homeStats.form}
│   • Wins: ${homeStats.wins} (${homeWinRate}%) | Draws: ${homeStats.draws} | Losses: ${homeStats.losses}
│   • Goals Scored: ${homeStats.goalsFor} (Per match: ${homeStats.avgGoalsFor})
│   • Goals Conceded: ${homeStats.goalsAgainst} (Per match: ${homeStats.avgGoalsAgainst})
│   • Current Streak: ${homeStats.currentStreak}
│   
│ HOME PERFORMANCE (${homeStats.homeMatches} matches):
│   • Wins: ${homeStats.homeWins} (${homeHomeWinRate}%) | Draws: ${homeStats.homeDraws} | Losses: ${homeStats.homeLosses}
│   • Home Goals Scored: ${homeStats.homeGoalsFor} (Per match: ${homeStats.avgHomeGoalsFor})
│   • Home Goals Conceded: ${homeStats.homeGoalsAgainst} (Per match: ${homeStats.avgHomeGoalsAgainst})
│   
│ KEY METRICS:
│   • Clean Sheets: ${homeStats.cleanSheets}/${homeStats.totalMatches} (${homeStats.cleanSheetPercent}%)
│   • Failed to Score: ${homeStats.failedToScore}/${homeStats.totalMatches} (${homeStats.failedToScorePercent}%)
│   • BTTS Matches: ${homeStats.bttsMatches}/${homeStats.totalMatches} (${homeStats.bttsPercent}%)
│   • Over 2.5 Matches: ${homeStats.over25Matches}/${homeStats.totalMatches} (${homeStats.over25Percent}%)
│   • Over 1.5 Matches: ${homeStats.over15Matches}/${homeStats.totalMatches} (${homeStats.over15Percent}%)
│   
│ HALF-TIME ANALYSIS:
│   • Avg First Half Goals: ${homeStats.avgFirstHalfGoals}
│   • Avg Second Half Goals: ${homeStats.avgSecondHalfGoals}
│   
│ LAST 5 MATCHES (Most recent first):
│   ${homeRecent || 'No data'}
│   • Last 5: ${homeStats.last5GoalsFor} scored, ${homeStats.last5GoalsAgainst} conceded
└──────────────────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────────────────┐
│ 📊 ${awayTeam.toUpperCase()} - DETAILED STATISTICS (AWAY TEAM)                       
├──────────────────────────────────────────────────────────────────────────────┤
│ 
│ OVERALL PERFORMANCE (Last ${awayStats.totalMatches} matches):
│   • Form: ${awayStats.form}
│   • Wins: ${awayStats.wins} (${awayWinRate}%) | Draws: ${awayStats.draws} | Losses: ${awayStats.losses}
│   • Goals Scored: ${awayStats.goalsFor} (Per match: ${awayStats.avgGoalsFor})
│   • Goals Conceded: ${awayStats.goalsAgainst} (Per match: ${awayStats.avgGoalsAgainst})
│   • Current Streak: ${awayStats.currentStreak}
│   
│ AWAY PERFORMANCE (${awayStats.awayMatches} matches):
│   • Wins: ${awayStats.awayWins} (${awayAwayWinRate}%) | Draws: ${awayStats.awayDraws} | Losses: ${awayStats.awayLosses}
│   • Away Goals Scored: ${awayStats.awayGoalsFor} (Per match: ${awayStats.avgAwayGoalsFor})
│   • Away Goals Conceded: ${awayStats.awayGoalsAgainst} (Per match: ${awayStats.avgAwayGoalsAgainst})
│   
│ KEY METRICS:
│   • Clean Sheets: ${awayStats.cleanSheets}/${awayStats.totalMatches} (${awayStats.cleanSheetPercent}%)
│   • Failed to Score: ${awayStats.failedToScore}/${awayStats.totalMatches} (${awayStats.failedToScorePercent}%)
│   • BTTS Matches: ${awayStats.bttsMatches}/${awayStats.totalMatches} (${awayStats.bttsPercent}%)
│   • Over 2.5 Matches: ${awayStats.over25Matches}/${awayStats.totalMatches} (${awayStats.over25Percent}%)
│   • Over 1.5 Matches: ${awayStats.over15Matches}/${awayStats.totalMatches} (${awayStats.over15Percent}%)
│   
│ HALF-TIME ANALYSIS:
│   • Avg First Half Goals: ${awayStats.avgFirstHalfGoals}
│   • Avg Second Half Goals: ${awayStats.avgSecondHalfGoals}
│   
│ LAST 5 MATCHES (Most recent first):
│   ${awayRecent || 'No data'}
│   • Last 5: ${awayStats.last5GoalsFor} scored, ${awayStats.last5GoalsAgainst} conceded
└──────────────────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────────────────┐
│ 🔄 HEAD TO HEAD - Last ${h2h.totalMatches} matches                              
├──────────────────────────────────────────────────────────────────────────────┤
│ 
│ OVERALL RECORD:
│   • ${homeTeam}: ${h2h.team1Wins} wins
│   • ${awayTeam}: ${h2h.team2Wins} wins  
│   • Draws: ${h2h.draws}
│   
│ GOALS STATISTICS:
│   • ${homeTeam} total: ${h2h.team1Goals} goals (Per match: ${(h2h.team1Goals / Math.max(h2h.totalMatches, 1)).toFixed(2)})
│   • ${awayTeam} total: ${h2h.team2Goals} goals (Per match: ${(h2h.team2Goals / Math.max(h2h.totalMatches, 1)).toFixed(2)})
│   • Average Total Goals: ${h2h.avgGoals}
│   
│ H2H KEY METRICS:
│   • BTTS: ${h2h.bttsCount}/${h2h.totalMatches} (${h2h.bttsPercent}%)
│   • Over 2.5: ${h2h.over25Count}/${h2h.totalMatches} (${h2h.over25Percent}%)
│   • Over 1.5: ${h2h.over15Count}/${h2h.totalMatches} (${h2h.over15Percent}%)
│   
│ ${homeTeam} AT HOME vs ${awayTeam}:
│   • ${h2h.team1HomeRecord.wins}W - ${h2h.team1HomeRecord.draws}D - ${h2h.team1HomeRecord.losses}L
│   
│ RECENT MEETINGS:
│   ${h2hRecent || 'No data'}
└──────────────────────────────────────────────────────────────────────────────┘

╔══════════════════════════════════════════════════════════════════════════════╗
║ 🎯 ANALYSIS INSTRUCTIONS                                                     
╠══════════════════════════════════════════════════════════════════════════════╣
║ 
║ As ${aiModel}, carefully analyze the data above and explain WHY you reached
║ each prediction. Your analysis should include:
║ 
║ 1. For MATCH RESULT, evaluate:
║    - Both teams' current form
║    - Home team's home performance vs Away team's away performance
║    - H2H history and psychological advantage
║    - Goal scoring/conceding rate comparison
║    
║ 2. For TOTAL GOALS (Over/Under 2.5), evaluate:
║    - Both teams' goals per match average
║    - H2H match goal average
║    - Both teams' over 2.5 percentages
║    - Defensive/offensive strengths
║    
║ 3. For BTTS, evaluate:
║    - Both teams' BTTS percentages
║    - Clean sheet rates
║    - Failed to score rates
║    - H2H BTTS rate
║    
║ CONFIDENCE CALCULATION CRITERIA:
║ • 85-95%: Very strong data support, clear trend, H2H aligned
║ • 70-84%: Good data support, noticeable trend
║ • 55-69%: Medium data, mixed signals
║ • 50-54%: Weak data, uncertain situation
║ 
╚══════════════════════════════════════════════════════════════════════════════╝

PROVIDE YOUR PREDICTIONS IN THIS EXACT FORMAT:

═══════════════════════════════════════════════════════════
📌 MATCH RESULT PREDICTION
═══════════════════════════════════════════════════════════
MATCH_RESULT: [Home Win / Draw / Away Win]
RESULT_CONFIDENCE: [50-95]
RESULT_REASONING: [Explain in 2-3 sentences why you reached this conclusion. Which statistics led you to this decision?]

═══════════════════════════════════════════════════════════
📌 TOTAL GOALS PREDICTION
═══════════════════════════════════════════════════════════
TOTAL_GOALS: [Over 2.5 / Under 2.5]
GOALS_CONFIDENCE: [50-95]
GOALS_REASONING: [Explain in 2-3 sentences why you reached this conclusion. Reference goal averages and key metrics.]

═══════════════════════════════════════════════════════════
📌 BTTS PREDICTION  
═══════════════════════════════════════════════════════════
BTTS: [Yes / No]
BTTS_CONFIDENCE: [50-95]
BTTS_REASONING: [Explain in 2-3 sentences why you reached this conclusion. Reference clean sheet and BTTS percentages.]

═══════════════════════════════════════════════════════════
📌 ${aiModel} OVERALL ASSESSMENT
═══════════════════════════════════════════════════════════
OVERALL_ANALYSIS: [Provide a 3-4 sentence overall assessment. Which bet is most reliable and why?]`;
}

// ============================================================================
// AI API ÇAĞRILARI
// ============================================================================

async function callClaude(prompt: string): Promise<string | null> {
  if (!ANTHROPIC_API_KEY) {
    console.log('⚠️ Claude API key missing');
    return null;
  }

  try {
    console.log('🤖 Calling Claude...');
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 2000,
        messages: [{ role: 'user', content: prompt }],
      }),
    });

    if (!response.ok) {
      console.log(`❌ Claude error: ${response.status}`);
      return null;
    }

    const data = await response.json();
    const text = data.content?.[0]?.text;
    console.log('✅ Claude responded');
    return text || null;
  } catch (error) {
    console.error('❌ Claude exception:', error);
    return null;
  }
}

async function callOpenAI(prompt: string): Promise<string | null> {
  if (!OPENAI_API_KEY) {
    console.log('⚠️ OpenAI API key missing');
    return null;
  }

  try {
    console.log('🤖 Calling OpenAI...');
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 2000,
        temperature: 0.7,
      }),
    });

    if (!response.ok) {
      console.log(`❌ OpenAI error: ${response.status}`);
      return null;
    }

    const data = await response.json();
    const text = data.choices?.[0]?.message?.content;
    console.log('✅ OpenAI responded');
    return text || null;
  } catch (error) {
    console.error('❌ OpenAI exception:', error);
    return null;
  }
}

async function callGemini(prompt: string): Promise<string | null> {
  if (!GEMINI_API_KEY) {
    console.log('⚠️ Gemini API key missing');
    return null;
  }

  try {
    console.log('🤖 Calling Gemini...');
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { maxOutputTokens: 2000, temperature: 0.7 },
        }),
      }
    );

    if (!response.ok) {
      console.log(`❌ Gemini error: ${response.status}`);
      return null;
    }

    const data = await response.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
    console.log('✅ Gemini responded');
    return text || null;
  } catch (error) {
    console.error('❌ Gemini exception:', error);
    return null;
  }
}

async function callPerplexity(prompt: string): Promise<string | null> {
  if (!PERPLEXITY_API_KEY) {
    console.log('⚠️ Perplexity API key missing');
    return null;
  }

  try {
    console.log('🤖 Calling Perplexity...');
    const response = await fetch('https://api.perplexity.ai/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${PERPLEXITY_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'sonar',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 2000,
        temperature: 0.7,
      }),
    });

    if (!response.ok) {
      console.log(`❌ Perplexity error: ${response.status}`);
      return null;
    }

    const data = await response.json();
    const text = data.choices?.[0]?.message?.content;
    console.log('✅ Perplexity responded');
    return text || null;
  } catch (error) {
    console.error('❌ Perplexity exception:', error);
    return null;
  }
}

// ============================================================================
// AI YANITINI PARSE ETME - GELİŞMİŞ
// ============================================================================

interface ParsedPrediction {
  matchResult: { prediction: string; confidence: number; reasoning: string };
  overUnder25: { prediction: string; confidence: number; reasoning: string };
  btts: { prediction: string; confidence: number; reasoning: string };
  overallAnalysis: string;
}

function parseAIResponse(text: string, lang: string): ParsedPrediction {
  const result: ParsedPrediction = {
    matchResult: { prediction: 'Draw', confidence: 55, reasoning: '' },
    overUnder25: { prediction: 'Under 2.5', confidence: 55, reasoning: '' },
    btts: { prediction: 'No', confidence: 55, reasoning: '' },
    overallAnalysis: '',
  };

  if (!text) return result;

  const upper = text.toUpperCase();

  // ===== MAÇ SONUCU =====
  // Türkçe
  if (upper.includes('MAC_SONUCU:') || upper.includes('MAÇ_SONUCU:')) {
    if (upper.includes('EV SAHIBI') || upper.includes('EV_SAHIBI') || upper.includes('EV SAHIBI KAZANIR')) {
      result.matchResult.prediction = 'Home Win';
    } else if (upper.includes('DEPLASMAN') || upper.includes('DEPLASMAN KAZANIR')) {
      result.matchResult.prediction = 'Away Win';
    } else if (upper.includes('BERABERLIK')) {
      result.matchResult.prediction = 'Draw';
    }
  }
  // İngilizce
  else if (upper.includes('MATCH_RESULT:') || upper.includes('RESULT:')) {
    if (upper.includes('HOME WIN') || upper.includes('HOME_WIN')) {
      result.matchResult.prediction = 'Home Win';
    } else if (upper.includes('AWAY WIN') || upper.includes('AWAY_WIN')) {
      result.matchResult.prediction = 'Away Win';
    } else if (upper.includes('DRAW')) {
      result.matchResult.prediction = 'Draw';
    }
  }

  // Maç sonucu güven
  const matchConfPatterns = [
    /MAC_GUVEN[:\s]*(\d+)/i,
    /MAÇ_GÜVEN[:\s]*(\d+)/i,
    /RESULT_CONFIDENCE[:\s]*(\d+)/i,
  ];
  for (const pattern of matchConfPatterns) {
    const match = text.match(pattern);
    if (match) {
      result.matchResult.confidence = Math.min(95, Math.max(50, parseInt(match[1])));
      break;
    }
  }

  // Maç sonucu gerekçe
  const matchReasonPatterns = [
    /MAC_GEREKCE[:\s]*([\s\S]*?)(?=\n\n|═|$)/i,
    /MAÇ_GEREKÇE[:\s]*([\s\S]*?)(?=\n\n|═|$)/i,
    /RESULT_REASONING[:\s]*([\s\S]*?)(?=\n\n|═|$)/i,
  ];
  for (const pattern of matchReasonPatterns) {
    const match = text.match(pattern);
    if (match) {
      result.matchResult.reasoning = match[1].trim().substring(0, 500);
      break;
    }
  }

  // ===== TOPLAM GOL =====
  if (upper.includes('TOPLAM_GOL:') || upper.includes('TOPLAM GOL:')) {
    if (upper.includes('UST 2.5') || upper.includes('ÜST 2.5') || upper.includes('UST_2.5')) {
      result.overUnder25.prediction = 'Over 2.5';
    } else if (upper.includes('ALT 2.5') || upper.includes('ALT_2.5')) {
      result.overUnder25.prediction = 'Under 2.5';
    }
  } else if (upper.includes('TOTAL_GOALS:') || upper.includes('GOALS:')) {
    if (upper.includes('OVER 2.5') || upper.includes('OVER_2.5')) {
      result.overUnder25.prediction = 'Over 2.5';
    } else if (upper.includes('UNDER 2.5') || upper.includes('UNDER_2.5')) {
      result.overUnder25.prediction = 'Under 2.5';
    }
  }

  // Gol güven
  const goalConfPatterns = [
    /GOL_GUVEN[:\s]*(\d+)/i,
    /GOL_GÜVEN[:\s]*(\d+)/i,
    /GOALS_CONFIDENCE[:\s]*(\d+)/i,
  ];
  for (const pattern of goalConfPatterns) {
    const match = text.match(pattern);
    if (match) {
      result.overUnder25.confidence = Math.min(95, Math.max(50, parseInt(match[1])));
      break;
    }
  }

  // Gol gerekçe
  const goalReasonPatterns = [
    /GOL_GEREKCE[:\s]*([\s\S]*?)(?=\n\n|═|$)/i,
    /GOL_GEREKÇE[:\s]*([\s\S]*?)(?=\n\n|═|$)/i,
    /GOALS_REASONING[:\s]*([\s\S]*?)(?=\n\n|═|$)/i,
  ];
  for (const pattern of goalReasonPatterns) {
    const match = text.match(pattern);
    if (match) {
      result.overUnder25.reasoning = match[1].trim().substring(0, 500);
      break;
    }
  }

  // ===== KG VAR / BTTS =====
  if (upper.includes('KG_VAR:') || upper.includes('KG VAR:')) {
    if (upper.includes('EVET')) {
      result.btts.prediction = 'Yes';
    } else if (upper.includes('HAYIR')) {
      result.btts.prediction = 'No';
    }
  } else if (upper.includes('BTTS:')) {
    if (upper.includes('YES') || upper.includes('EVET')) {
      result.btts.prediction = 'Yes';
    } else if (upper.includes('NO') || upper.includes('HAYIR')) {
      result.btts.prediction = 'No';
    }
  }

  // BTTS güven
  const bttsConfPatterns = [
    /KG_GUVEN[:\s]*(\d+)/i,
    /KG_GÜVEN[:\s]*(\d+)/i,
    /BTTS_CONFIDENCE[:\s]*(\d+)/i,
  ];
  for (const pattern of bttsConfPatterns) {
    const match = text.match(pattern);
    if (match) {
      result.btts.confidence = Math.min(95, Math.max(50, parseInt(match[1])));
      break;
    }
  }

  // BTTS gerekçe
  const bttsReasonPatterns = [
    /KG_GEREKCE[:\s]*([\s\S]*?)(?=\n\n|═|$)/i,
    /KG_GEREKÇE[:\s]*([\s\S]*?)(?=\n\n|═|$)/i,
    /BTTS_REASONING[:\s]*([\s\S]*?)(?=\n\n|═|$)/i,
  ];
  for (const pattern of bttsReasonPatterns) {
    const match = text.match(pattern);
    if (match) {
      result.btts.reasoning = match[1].trim().substring(0, 500);
      break;
    }
  }

  // ===== GENEL ANALİZ =====
  const overallPatterns = [
    /GENEL_ANALIZ[:\s]*([\s\S]*?)$/i,
    /GENEL_ANALİZ[:\s]*([\s\S]*?)$/i,
    /OVERALL_ANALYSIS[:\s]*([\s\S]*?)$/i,
  ];
  for (const pattern of overallPatterns) {
    const match = text.match(pattern);
    if (match) {
      result.overallAnalysis = match[1].trim().substring(0, 600);
      break;
    }
  }

  return result;
}

// ============================================================================
// CONSENSUS HESAPLAMA - GELİŞMİŞ
// ============================================================================

function calculateConsensus(results: ParsedPrediction[]) {
  const matchVotes: Record<string, { count: number; totalConf: number; reasonings: string[] }> = {};
  const goalVotes: Record<string, { count: number; totalConf: number; reasonings: string[] }> = {};
  const bttsVotes: Record<string, { count: number; totalConf: number; reasonings: string[] }> = {};

  for (const r of results) {
    // Match Result
    const mr = r.matchResult.prediction;
    if (!matchVotes[mr]) matchVotes[mr] = { count: 0, totalConf: 0, reasonings: [] };
    matchVotes[mr].count++;
    matchVotes[mr].totalConf += r.matchResult.confidence;
    if (r.matchResult.reasoning) matchVotes[mr].reasonings.push(r.matchResult.reasoning);

    // Goals
    const g = r.overUnder25.prediction;
    if (!goalVotes[g]) goalVotes[g] = { count: 0, totalConf: 0, reasonings: [] };
    goalVotes[g].count++;
    goalVotes[g].totalConf += r.overUnder25.confidence;
    if (r.overUnder25.reasoning) goalVotes[g].reasonings.push(r.overUnder25.reasoning);

    // BTTS
    const b = r.btts.prediction;
    if (!bttsVotes[b]) bttsVotes[b] = { count: 0, totalConf: 0, reasonings: [] };
    bttsVotes[b].count++;
    bttsVotes[b].totalConf += r.btts.confidence;
    if (r.btts.reasoning) bttsVotes[b].reasonings.push(r.btts.reasoning);
  }

  const getWinner = (votes: Record<string, { count: number; totalConf: number; reasonings: string[] }>) => {
    let best = { prediction: 'Unknown', confidence: 50, votes: 0, reasonings: [] as string[] };
    for (const [pred, data] of Object.entries(votes)) {
      const avgConf = Math.round(data.totalConf / data.count);
      if (data.count > best.votes || (data.count === best.votes && avgConf > best.confidence)) {
        best = { prediction: pred, confidence: avgConf, votes: data.count, reasonings: data.reasonings };
      }
    }
    return best;
  };

  return {
    matchResult: getWinner(matchVotes),
    overUnder25: getWinner(goalVotes),
    btts: getWinner(bttsVotes),
  };
}

// ============================================================================
// ANA API HANDLER
// ============================================================================

export async function POST(request: NextRequest) {
  const startTime = Date.now();

  try {
    const body = await request.json();
    const { homeTeam, awayTeam, homeTeamId, awayTeamId, league, language = 'tr' } = body;

    console.log('═══════════════════════════════════════════════════════════');
    console.log(`⚽ NEW ANALYSIS REQUEST: ${homeTeam} vs ${awayTeam}`);
    console.log(`📍 League: ${league || 'Unknown'}, Language: ${language}`);
    console.log('═══════════════════════════════════════════════════════════');

    if (!homeTeam || !awayTeam) {
      return NextResponse.json({
        success: false,
        error: language === 'tr' ? 'Takım adları gerekli.' : 'Team names required.',
      }, { status: 400 });
    }

    // 1. VERİ ÇEKME
    console.log('\n📊 FETCHING DATA...');
    const [homeStats, awayStats, h2h] = await Promise.all([
      fetchTeamStats(homeTeamId, homeTeam),
      fetchTeamStats(awayTeamId, awayTeam),
      fetchH2H(homeTeamId, awayTeamId, homeTeam, awayTeam),
    ]);

    const dataTime = Date.now();
    console.log(`✅ Data fetched in ${dataTime - startTime}ms`);
    console.log(`   ${homeTeam}: ${homeStats.totalMatches} matches, Form: ${homeStats.form}`);
    console.log(`   ${awayTeam}: ${awayStats.totalMatches} matches, Form: ${awayStats.form}`);
    console.log(`   H2H: ${h2h.totalMatches} matches`);

    // 2. AI PROMPT'LARI OLUŞTUR - HER AI İÇİN AYRI
    const claudePrompt = createProfessionalPrompt(homeTeam, awayTeam, homeStats, awayStats, h2h, language, 'Claude AI');
    const openaiPrompt = createProfessionalPrompt(homeTeam, awayTeam, homeStats, awayStats, h2h, language, 'GPT-4 AI');
    const geminiPrompt = createProfessionalPrompt(homeTeam, awayTeam, homeStats, awayStats, h2h, language, 'Gemini AI');
    const perplexityPrompt = createProfessionalPrompt(homeTeam, awayTeam, homeStats, awayStats, h2h, language, 'Perplexity AI');

    // 3. AI'LARI PARALEL ÇAĞIR
    console.log('\n🤖 CALLING AI MODELS...');
    const [claudeText, openaiText, geminiText, perplexityText] = await Promise.all([
      callClaude(claudePrompt),
      callOpenAI(openaiPrompt),
      callGemini(geminiPrompt),
      callPerplexity(perplexityPrompt),
    ]);

    const aiTime = Date.now();
    console.log(`✅ AI calls completed in ${aiTime - dataTime}ms`);

    // 4. SONUÇLARI TOPLA
    const aiStatus = {
      claude: !!claudeText,
      openai: !!openaiText,
      gemini: !!geminiText,
      perplexity: !!perplexityText,
    };

    const parsed: ParsedPrediction[] = [];
    const individualAnalyses: Record<string, ParsedPrediction & { rawResponse?: string }> = {};

    if (claudeText) {
      const p = parseAIResponse(claudeText, language);
      parsed.push(p);
      individualAnalyses.claude = { ...p, rawResponse: claudeText.substring(0, 1000) };
    }
    if (openaiText) {
      const p = parseAIResponse(openaiText, language);
      parsed.push(p);
      individualAnalyses.openai = { ...p, rawResponse: openaiText.substring(0, 1000) };
    }
    if (geminiText) {
      const p = parseAIResponse(geminiText, language);
      parsed.push(p);
      individualAnalyses.gemini = { ...p, rawResponse: geminiText.substring(0, 1000) };
    }
    if (perplexityText) {
      const p = parseAIResponse(perplexityText, language);
      parsed.push(p);
      individualAnalyses.perplexity = { ...p, rawResponse: perplexityText.substring(0, 1000) };
    }

    console.log(`\n📈 RESULTS: ${parsed.length}/4 AI models responded`);

    if (parsed.length === 0) {
      return NextResponse.json({
        success: false,
        error: language === 'tr'
          ? 'Hiçbir AI modeli yanıt vermedi. API anahtarlarını kontrol edin.'
          : 'No AI models responded. Check API keys.',
      }, { status: 500 });
    }

    // 5. CONSENSUS HESAPLA
    const consensus = calculateConsensus(parsed);
    const totalModels = parsed.length;

    // 6. EN İYİ BAHİSLER
    const bets = [
      { type: 'MATCH_RESULT', ...consensus.matchResult },
      { type: 'OVER_UNDER_25', ...consensus.overUnder25 },
      { type: 'BTTS', ...consensus.btts },
    ].sort((a, b) => (b.votes * 100 + b.confidence) - (a.votes * 100 + a.confidence));

    const bestBet = bets[0];
    const riskLevel = bestBet.votes >= 3 ? 'Low' : bestBet.votes >= 2 ? 'Medium' : 'High';

    // 7. GENEL ANALİZLERİ TOPLA
    const overallAnalyses = parsed.map(p => p.overallAnalysis).filter(Boolean);

    // 8. RESPONSE
    const totalTime = Date.now() - startTime;
    console.log(`\n✅ ANALYSIS COMPLETE in ${totalTime}ms`);
    console.log('═══════════════════════════════════════════════════════════\n');

    return NextResponse.json({
      success: true,
      analysis: {
        matchResult: {
          prediction: consensus.matchResult.prediction,
          confidence: consensus.matchResult.confidence,
          votes: consensus.matchResult.votes,
          totalVotes: totalModels,
          reasonings: consensus.matchResult.reasonings,
        },
        overUnder25: {
          prediction: consensus.overUnder25.prediction,
          confidence: consensus.overUnder25.confidence,
          votes: consensus.overUnder25.votes,
          totalVotes: totalModels,
          reasonings: consensus.overUnder25.reasonings,
        },
        btts: {
          prediction: consensus.btts.prediction,
          confidence: consensus.btts.confidence,
          votes: consensus.btts.votes,
          totalVotes: totalModels,
          reasonings: consensus.btts.reasonings,
        },
        riskLevel,
        bestBets: bets.slice(0, 3).map(bet => ({
          type: bet.type,
          selection: bet.prediction,
          confidence: bet.confidence,
          votes: bet.votes,
          totalVotes: totalModels,
          consensusStrength: bet.votes >= 3 ? 'Strong' : bet.votes >= 2 ? 'Moderate' : 'Weak',
          reasoning: language === 'tr'
            ? `${bet.votes}/${totalModels} AI model bu tahmin üzerinde uzlaştı (Ortalama güven: %${bet.confidence}).`
            : `${bet.votes}/${totalModels} AI models agreed on this prediction (Average confidence: ${bet.confidence}%).`,
        })),
        overallAnalyses,
      },
      aiStatus,
      individualAnalyses,
      modelsUsed: Object.keys(individualAnalyses),
      totalModels,
      stats: {
        home: homeStats,
        away: awayStats,
        h2h,
      },
      timing: {
        dataFetch: `${dataTime - startTime}ms`,
        aiCalls: `${aiTime - dataTime}ms`,
        total: `${totalTime}ms`,
      },
    });

  } catch (error: any) {
    console.error('❌ ANALYSIS ERROR:', error);
    return NextResponse.json({
      success: false,
      error: `Error: ${error.message}`,
    }, { status: 500 });
  }
}
