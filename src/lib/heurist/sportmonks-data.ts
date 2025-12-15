// src/lib/heurist/sportmonks-data.ts
// Sportmonks Complete Data Layer - PROFESSIONAL FIX v4
// ═══════════════════════════════════════════════════════════════════════════════
// CHANGELOG:
// v4 - Added proper includes to ALL endpoints
// v4 - Fixed schedule endpoint to include scores;participants
// v4 - Added retry logic and better error handling
// v4 - Added data quality scoring
// ═══════════════════════════════════════════════════════════════════════════════

const SPORTMONKS_TOKEN = process.env.SPORTMONKS_API_KEY || process.env.SPORTMONKS_API_TOKEN;
const BASE_URL = 'https://api.sportmonks.com/v3/football';

// ==================== TYPES ====================

export interface TeamStats {
  form: string;
  points: number;
  avgGoalsScored: string;
  avgGoalsConceded: string;
  over25Percentage: string;
  bttsPercentage: string;
  cleanSheetPercentage: string;
  failedToScorePercentage: string;
  record: string;
  matchCount: number;
  matchDetails: MatchDetail[];
  
  // Venue-specific stats (ÖNEMLİ!)
  venueForm?: string;
  venuePoints?: number;
  venueAvgScored?: string;
  venueAvgConceded?: string;
  venueOver25Pct?: number;
  venueBttsPct?: number;
  venueMatchCount?: number;
  venueRecord?: string;
}

export interface MatchDetail {
  opponent: string;
  score: string;
  result: 'W' | 'D' | 'L';
  goalsScored: number;
  goalsConceded: number;
  date: string;
  isHome?: boolean;
  totalGoals?: number;
}

export interface H2HStats {
  totalMatches: number;
  homeWins: number;
  awayWins: number;
  draws: number;
  avgTotalGoals: string;
  over25Percentage: string;
  bttsPercentage: string;
  matchDetails: MatchDetail[];
}

export interface CompleteMatchData {
  fixtureId: number;
  homeTeam: string;
  awayTeam: string;
  homeTeamId: number;
  awayTeamId: number;
  league: string;
  leagueId: number;
  kickOff: string;
  
  homeForm: TeamStats;
  awayForm: TeamStats;
  h2h: H2HStats;
  
  odds: {
    matchWinner: { home: number; draw: number; away: number };
    overUnder: { '2.5': { over: number; under: number } };
    btts: { yes: number; no: number };
  };
  
  oddsHistory?: any;
  
  // Data quality indicator
  dataQuality?: {
    score: number;
    homeFormQuality: number;
    awayFormQuality: number;
    h2hQuality: number;
    oddsQuality: number;
    warnings: string[];
  };
}

// ==================== HELPER FUNCTIONS ====================

async function fetchSportmonks(endpoint: string, retries: number = 2): Promise<any> {
  if (!SPORTMONKS_TOKEN) {
    console.error('❌ SPORTMONKS_TOKEN is not set!');
    return null;
  }
  
  const separator = endpoint.includes('?') ? '&' : '?';
  const url = `${BASE_URL}${endpoint}${separator}api_token=${SPORTMONKS_TOKEN}`;
  
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      console.log(`📡 [${attempt}/${retries}] Fetching: ${endpoint.substring(0, 80)}...`);
      
      const response = await fetch(url, { 
        next: { revalidate: 300 },
        headers: { 'Accept': 'application/json' }
      });
      
      if (!response.ok) {
        console.error(`❌ Sportmonks API error: ${response.status} ${response.statusText}`);
        if (attempt < retries) {
          await new Promise(r => setTimeout(r, 1000 * attempt));
          continue;
        }
        return null;
      }
      
      const data = await response.json();
      
      // Rate limit check
      if (data.message?.includes('rate limit')) {
        console.warn('⚠️ Rate limit hit, waiting...');
        await new Promise(r => setTimeout(r, 2000));
        continue;
      }
      
      return data;
    } catch (error) {
      console.error(`❌ Sportmonks fetch error (attempt ${attempt}):`, error);
      if (attempt < retries) {
        await new Promise(r => setTimeout(r, 1000 * attempt));
        continue;
      }
      return null;
    }
  }
  
  return null;
}

// ═══════════════════════════════════════════════════════════════════════════════
// SKOR PARSE - type_id'lere göre doğru skor çıkarma
// ═══════════════════════════════════════════════════════════════════════════════

function parseScores(scores: any[]): { home: number; away: number; found: boolean } {
  if (!scores || scores.length === 0) {
    return { home: 0, away: 0, found: false };
  }
  
  let homeScore = -1;
  let awayScore = -1;
  
  // Öncelik 1: CURRENT/FULLTIME (type_id: 1525)
  for (const score of scores) {
    if (score.type_id === 1525 || score.description === 'CURRENT') {
      const participant = score.score?.participant;
      const goals = score.score?.goals ?? 0;
      
      if (participant === 'home') homeScore = goals;
      else if (participant === 'away') awayScore = goals;
    }
  }
  
  // Eğer CURRENT bulunamadıysa, 2ND_HALF'tan hesapla
  if (homeScore === -1 || awayScore === -1) {
    for (const score of scores) {
      if (score.description === '2ND_HALF' || score.type_id === 1527) {
        const participant = score.score?.participant;
        const goals = score.score?.goals ?? 0;
        
        if (participant === 'home' && homeScore === -1) homeScore = goals;
        else if (participant === 'away' && awayScore === -1) awayScore = goals;
      }
    }
  }
  
  // Son çare: FT_ skorlarını topla
  if (homeScore === -1 || awayScore === -1) {
    let ftHome = 0, ftAway = 0;
    for (const score of scores) {
      if (score.description?.startsWith('FT_') || score.description === 'FULLTIME') {
        const participant = score.score?.participant;
        const goals = score.score?.goals ?? 0;
        
        if (participant === 'home') ftHome = Math.max(ftHome, goals);
        else if (participant === 'away') ftAway = Math.max(ftAway, goals);
      }
    }
    if (ftHome > 0 || ftAway > 0) {
      homeScore = ftHome;
      awayScore = ftAway;
    }
  }
  
  return { 
    home: homeScore >= 0 ? homeScore : 0, 
    away: awayScore >= 0 ? awayScore : 0,
    found: homeScore >= 0 && awayScore >= 0
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// FORM HESAPLAMA - Detaylı ve doğru
// ═══════════════════════════════════════════════════════════════════════════════

function calculateForm(
  matches: any[], 
  teamId: number,
  venueFilter?: 'home' | 'away'
): { 
  form: string; 
  points: number; 
  details: MatchDetail[];
  wins: number;
  draws: number;
  losses: number;
  goalsScored: number;
  goalsConceded: number;
  over25Count: number;
  bttsCount: number;
  cleanSheets: number;
  failedToScore: number;
} {
  if (!matches || matches.length === 0) {
    console.log(`⚠️ No matches found for team ${teamId}${venueFilter ? ` (${venueFilter})` : ''}`);
    return { 
      form: 'NNNNN', points: 0, details: [],
      wins: 0, draws: 0, losses: 0,
      goalsScored: 0, goalsConceded: 0,
      over25Count: 0, bttsCount: 0,
      cleanSheets: 0, failedToScore: 0
    };
  }
  
  // Bitmiş maçları filtrele (state_id = 5)
  let finishedMatches = matches
    .filter((m: any) => m.state_id === 5)
    .sort((a: any, b: any) => new Date(b.starting_at).getTime() - new Date(a.starting_at).getTime());
  
  // Venue filter uygula
  if (venueFilter) {
    finishedMatches = finishedMatches.filter((match: any) => {
      const participants = match.participants || [];
      const homeParticipant = participants.find((p: any) => p.meta?.location === 'home');
      const isTeamHome = homeParticipant?.id === teamId;
      
      return venueFilter === 'home' ? isTeamHome : !isTeamHome;
    });
  }
  
  // İlk 10 maçı al (venue filter için 7)
  const limit = venueFilter ? 7 : 10;
  finishedMatches = finishedMatches.slice(0, limit);
  
  if (finishedMatches.length === 0) {
    console.log(`⚠️ No ${venueFilter || 'finished'} matches found for team ${teamId}`);
    return { 
      form: 'NNNNN', points: 0, details: [],
      wins: 0, draws: 0, losses: 0,
      goalsScored: 0, goalsConceded: 0,
      over25Count: 0, bttsCount: 0,
      cleanSheets: 0, failedToScore: 0
    };
  }
  
  let form = '';
  let points = 0;
  let wins = 0, draws = 0, losses = 0;
  let goalsScored = 0, goalsConceded = 0;
  let over25Count = 0, bttsCount = 0;
  let cleanSheets = 0, failedToScore = 0;
  const details: MatchDetail[] = [];
  
  for (const match of finishedMatches) {
    const scores = match.scores || [];
    const participants = match.participants || [];
    
    const { home: homeScore, away: awayScore, found } = parseScores(scores);
    
    if (!found) {
      console.log(`⚠️ Score not found for match ${match.id}`);
      continue;
    }
    
    const homeTeam = participants.find((p: any) => p.meta?.location === 'home');
    const awayTeam = participants.find((p: any) => p.meta?.location === 'away');
    
    if (!homeTeam || !awayTeam) continue;
    
    const isHome = homeTeam.id === teamId;
    const teamScore = isHome ? homeScore : awayScore;
    const oppScore = isHome ? awayScore : homeScore;
    const opponent = isHome ? awayTeam.name : homeTeam.name;
    
    goalsScored += teamScore;
    goalsConceded += oppScore;
    
    const totalGoals = teamScore + oppScore;
    if (totalGoals > 2.5) over25Count++;
    if (teamScore > 0 && oppScore > 0) bttsCount++;
    if (oppScore === 0) cleanSheets++;
    if (teamScore === 0) failedToScore++;
    
    let result: 'W' | 'D' | 'L';
    if (teamScore > oppScore) {
      result = 'W';
      points += 3;
      wins++;
    } else if (teamScore < oppScore) {
      result = 'L';
      losses++;
    } else {
      result = 'D';
      points += 1;
      draws++;
    }
    
    // Form sadece ilk 5 maç
    if (form.length < 5) {
      form += result;
    }
    
    details.push({
      opponent: opponent || 'Unknown',
      score: `${teamScore}-${oppScore}`,
      result,
      goalsScored: teamScore,
      goalsConceded: oppScore,
      date: match.starting_at || '',
      isHome,
      totalGoals
    });
  }
  
  // Form'u 5 karaktere tamamla
  while (form.length < 5) form += 'N';
  
  console.log(`   ✅ ${venueFilter || 'General'} Form: ${form} (${points} pts) from ${details.length} matches`);
  
  return { 
    form, points, details,
    wins, draws, losses,
    goalsScored, goalsConceded,
    over25Count, bttsCount,
    cleanSheets, failedToScore
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// GOL İSTATİSTİKLERİ
// ═══════════════════════════════════════════════════════════════════════════════

function calculateGoalStats(formResult: ReturnType<typeof calculateForm>): {
  avgScored: number;
  avgConceded: number;
  over25: number;
  btts: number;
  cleanSheet: number;
  failedToScore: number;
} {
  const count = formResult.details.length;
  
  if (count === 0) {
    return { avgScored: 1.2, avgConceded: 1.0, over25: 50, btts: 50, cleanSheet: 30, failedToScore: 20 };
  }
  
  return {
    avgScored: formResult.goalsScored / count,
    avgConceded: formResult.goalsConceded / count,
    over25: Math.round((formResult.over25Count / count) * 100),
    btts: Math.round((formResult.bttsCount / count) * 100),
    cleanSheet: Math.round((formResult.cleanSheets / count) * 100),
    failedToScore: Math.round((formResult.failedToScore / count) * 100),
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN DATA FETCHERS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Takımın son maçlarını çek
 * ÖNEMLİ: include=scores;participants ŞART!
 */
export async function fetchTeamRecentMatches(
  teamId: number, 
  leagueId?: number, 
  count: number = 15
): Promise<any[]> {
  // ✅ Takımın son maçları - teams endpoint ile
  const endpoint = `/teams/${teamId}?include=latest.scores;latest.participants`;
  
  console.log(`📡 Fetching team ${teamId} with latest matches...`);
  const data = await fetchSportmonks(endpoint);
  
  if (!data?.data) {
    console.log(`⚠️ No data for team ${teamId}`);
    return [];
  }
  
  // latest içinde son maçlar var
  const allFixtures = data.data.latest || [];
  console.log(`   📊 Total fixtures found: ${allFixtures.length}`);
  
  if (allFixtures.length === 0) {
    // Alternatif: fixtures by team endpoint
    console.log(`   🔄 Trying alternative endpoint...`);
    const altEndpoint = `/fixtures/latest/by-team/${teamId}?include=scores;participants`;
    const altData = await fetchSportmonks(altEndpoint);
    
    if (altData?.data) {
      const fixtures = Array.isArray(altData.data) ? altData.data : [altData.data];
      console.log(`   📊 Alt endpoint fixtures: ${fixtures.length}`);
      return fixtures.filter((f: any) => f.state_id === 5).slice(0, count);
    }
    return [];
  }
  
  // Bitmiş maçları filtrele
  const finishedWithScores = allFixtures
    .filter((f: any) => {
      const hasScores = f.scores && Array.isArray(f.scores) && f.scores.length > 0;
      const hasParticipants = f.participants && Array.isArray(f.participants) && f.participants.length >= 2;
      const isFinished = f.state_id === 5;
      
      return isFinished && hasScores && hasParticipants;
    })
    .sort((a: any, b: any) => new Date(b.starting_at).getTime() - new Date(a.starting_at).getTime());
  
  console.log(`   ✅ Finished matches with scores: ${finishedWithScores.length}`);
  
  if (finishedWithScores.length > 0) {
    const first = finishedWithScores[0];
    const { home, away, found } = parseScores(first.scores);
    console.log(`   📊 Most recent: ${first.name} | Score: ${home}-${away} | Found: ${found}`);
  }
  
  return finishedWithScores.slice(0, count);
}

/**
 * H2H verilerini çek
 */
export async function fetchH2H(team1Id: number, team2Id: number): Promise<H2HStats> {
  // ✅ Include parametresi zaten var ama doğrulayalım
  const endpoint = `/fixtures/head-to-head/${team1Id}/${team2Id}?include=scores;participants&per_page=10`;
  const data = await fetchSportmonks(endpoint);
  
  const matches = data?.data || [];
  
  if (matches.length === 0) {
    console.log(`⚠️ No H2H matches found for ${team1Id} vs ${team2Id}`);
    return {
      totalMatches: 0,
      homeWins: 0,
      awayWins: 0,
      draws: 0,
      avgTotalGoals: '2.5',
      over25Percentage: '50',
      bttsPercentage: '50',
      matchDetails: [],
    };
  }
  
  console.log(`   📊 H2H matches found: ${matches.length}`);
  
  let homeWins = 0, awayWins = 0, draws = 0;
  let totalGoals = 0;
  let over25Count = 0;
  let bttsCount = 0;
  const matchDetails: MatchDetail[] = [];
  
  for (const match of matches) {
    const scores = match.scores || [];
    const { home: homeScore, away: awayScore, found } = parseScores(scores);
    
    if (!found) {
      console.log(`   ⚠️ H2H match ${match.id} has no parseable score`);
      continue;
    }
    
    const total = homeScore + awayScore;
    totalGoals += total;
    
    if (total > 2.5) over25Count++;
    if (homeScore > 0 && awayScore > 0) bttsCount++;
    
    if (homeScore > awayScore) homeWins++;
    else if (awayScore > homeScore) awayWins++;
    else draws++;
    
    const participants = match.participants || [];
    const homeTeam = participants.find((p: any) => p.meta?.location === 'home');
    const awayTeam = participants.find((p: any) => p.meta?.location === 'away');
    
    matchDetails.push({
      opponent: `${homeTeam?.name || '?'} vs ${awayTeam?.name || '?'}`,
      score: `${homeScore}-${awayScore}`,
      result: homeScore > awayScore ? 'W' : awayScore > homeScore ? 'L' : 'D',
      goalsScored: homeScore,
      goalsConceded: awayScore,
      date: match.starting_at || '',
      totalGoals: total
    });
  }
  
  const validMatches = matchDetails.length;
  const count = validMatches || 1;
  
  console.log(`   ✅ H2H: ${homeWins}W-${draws}D-${awayWins}L | Avg: ${(totalGoals/count).toFixed(1)} goals | Over25: ${Math.round((over25Count/count)*100)}%`);
  
  return {
    totalMatches: validMatches,
    homeWins,
    awayWins,
    draws,
    avgTotalGoals: (totalGoals / count).toFixed(2),
    over25Percentage: Math.round((over25Count / count) * 100).toString(),
    bttsPercentage: Math.round((bttsCount / count) * 100).toString(),
    matchDetails,
  };
}

/**
 * Pre-match oranları çek
 */
export async function fetchPreMatchOdds(fixtureId: number): Promise<any> {
  const endpoint = `/odds/pre-match/fixtures/${fixtureId}?include=market;bookmaker`;
  const data = await fetchSportmonks(endpoint);
  
  const odds = data?.data || [];
  
  let home = 0, draw = 0, away = 0;
  let over25 = 0, under25 = 0;
  let bttsYes = 0, bttsNo = 0;
  
  // Opening odds for history
  let homeOpening = 0, homeCurrent = 0;
  let over25Opening = 0, over25Current = 0;
  let bttsYesOpening = 0, bttsYesCurrent = 0;
  
  for (const odd of odds) {
    const marketId = odd.market_id;
    const label = (odd.label || '').toString();
    const value = parseFloat(odd.value) || 0;
    const isOriginal = odd.original === true;
    
    if (value <= 1) continue; // Invalid odds
    
    // 1X2 Market (ID: 1)
    if (marketId === 1) {
      if (label === '1' || label.toLowerCase() === 'home') {
        if (isOriginal) homeOpening = value;
        homeCurrent = Math.max(homeCurrent, value);
        home = value;
      } else if (label === 'X' || label.toLowerCase() === 'draw') {
        draw = value;
      } else if (label === '2' || label.toLowerCase() === 'away') {
        away = value;
      }
    }
    
    // Over/Under 2.5 (Market ID: 12 veya 18)
    if ((marketId === 12 || marketId === 18)) {
      const total = odd.total || odd.handicap || '';
      if (total.toString().includes('2.5') || odd.name?.includes('2.5')) {
        if (label.toLowerCase() === 'over') {
          if (isOriginal) over25Opening = value;
          over25Current = Math.max(over25Current, value);
          over25 = value;
        } else if (label.toLowerCase() === 'under') {
          under25 = value;
        }
      }
    }
    
    // BTTS (Market ID: 28 veya 29)
    if (marketId === 28 || marketId === 29) {
      if (label.toLowerCase() === 'yes') {
        if (isOriginal) bttsYesOpening = value;
        bttsYesCurrent = Math.max(bttsYesCurrent, value);
        bttsYes = value;
      } else if (label.toLowerCase() === 'no') {
        bttsNo = value;
      }
    }
  }
  
  // Default values if not found
  if (!home) home = 2.0;
  if (!draw) draw = 3.5;
  if (!away) away = 3.5;
  if (!over25) over25 = 1.9;
  if (!under25) under25 = 1.9;
  if (!bttsYes) bttsYes = 1.85;
  if (!bttsNo) bttsNo = 1.95;
  
  console.log(`   ✅ Odds: 1=${home} X=${draw} 2=${away} | O2.5=${over25} U2.5=${under25} | BTTS Y=${bttsYes}`);
  
  return {
    current: {
      matchWinner: { home, draw, away },
      overUnder: { '2.5': { over: over25, under: under25 } },
      btts: { yes: bttsYes, no: bttsNo },
    },
    history: {
      homeWin: { opening: homeOpening || home, current: homeCurrent || home },
      over25: { opening: over25Opening || over25, current: over25Current || over25 },
      bttsYes: { opening: bttsYesOpening || bttsYes, current: bttsYesCurrent || bttsYes },
    },
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// DATA QUALITY ASSESSMENT
// ═══════════════════════════════════════════════════════════════════════════════

function assessDataQuality(
  homeFormResult: ReturnType<typeof calculateForm>,
  awayFormResult: ReturnType<typeof calculateForm>,
  homeVenueResult: ReturnType<typeof calculateForm>,
  awayVenueResult: ReturnType<typeof calculateForm>,
  h2h: H2HStats,
  odds: any
): CompleteMatchData['dataQuality'] {
  const warnings: string[] = [];
  
  // Home form quality (0-25)
  let homeFormQuality = Math.min(25, homeFormResult.details.length * 5);
  if (homeFormResult.form === 'NNNNN') {
    homeFormQuality = 0;
    warnings.push('Home team form data missing');
  }
  
  // Away form quality (0-25)
  let awayFormQuality = Math.min(25, awayFormResult.details.length * 5);
  if (awayFormResult.form === 'NNNNN') {
    awayFormQuality = 0;
    warnings.push('Away team form data missing');
  }
  
  // H2H quality (0-25)
  let h2hQuality = Math.min(25, h2h.totalMatches * 5);
  if (h2h.totalMatches === 0) {
    warnings.push('No H2H history available');
  }
  
  // Odds quality (0-25)
  let oddsQuality = 0;
  if (odds?.current?.matchWinner?.home > 1) oddsQuality += 10;
  if (odds?.current?.overUnder?.['2.5']?.over > 1) oddsQuality += 10;
  if (odds?.current?.btts?.yes > 1) oddsQuality += 5;
  if (oddsQuality < 10) {
    warnings.push('Limited odds data');
  }
  
  // Venue-specific bonus
  if (homeVenueResult.details.length >= 3) homeFormQuality += 5;
  if (awayVenueResult.details.length >= 3) awayFormQuality += 5;
  
  const score = Math.min(100, homeFormQuality + awayFormQuality + h2hQuality + oddsQuality);
  
  return {
    score,
    homeFormQuality,
    awayFormQuality,
    h2hQuality,
    oddsQuality,
    warnings
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// COMPLETE MATCH DATA - Ana fonksiyon
// ═══════════════════════════════════════════════════════════════════════════════

export async function fetchCompleteMatchData(
  fixtureId: number,
  homeTeamId: number,
  awayTeamId: number,
  homeTeamName: string,
  awayTeamName: string,
  league: string,
  leagueId?: number
): Promise<CompleteMatchData> {
  console.log(`\n${'═'.repeat(60)}`);
  console.log(`🔄 FETCHING COMPLETE DATA: ${homeTeamName} vs ${awayTeamName}`);
  console.log(`   IDs: Home=${homeTeamId}, Away=${awayTeamId}, Fixture=${fixtureId}`);
  console.log(`${'═'.repeat(60)}`);
  
  // Paralel API çağrıları
  const [homeMatches, awayMatches, h2hData, oddsData] = await Promise.all([
    fetchTeamRecentMatches(homeTeamId, undefined, 15),
    fetchTeamRecentMatches(awayTeamId, undefined, 15),
    fetchH2H(homeTeamId, awayTeamId),
    fetchPreMatchOdds(fixtureId),
  ]);
  
  // GENEL FORM hesapla
  const homeFormData = calculateForm(homeMatches, homeTeamId);
  const awayFormData = calculateForm(awayMatches, awayTeamId);
  
  // VENUE-SPECİFİC FORM hesapla (ÇOK ÖNEMLİ!)
  const homeVenueData = calculateForm(homeMatches, homeTeamId, 'home');
  const awayVenueData = calculateForm(awayMatches, awayTeamId, 'away');
  
  // Gol istatistikleri
  const homeGoalStats = calculateGoalStats(homeFormData);
  const homeVenueGoalStats = calculateGoalStats(homeVenueData);
  const awayGoalStats = calculateGoalStats(awayFormData);
  const awayVenueGoalStats = calculateGoalStats(awayVenueData);
  
  // Data quality
  const dataQuality = assessDataQuality(
    homeFormData, awayFormData,
    homeVenueData, awayVenueData,
    h2hData, oddsData
  );
  
  // HomeForm objesi
  const homeForm: TeamStats = {
    form: homeFormData.form,
    points: homeFormData.points,
    avgGoalsScored: homeGoalStats.avgScored.toFixed(2),
    avgGoalsConceded: homeGoalStats.avgConceded.toFixed(2),
    over25Percentage: homeGoalStats.over25.toString(),
    bttsPercentage: homeGoalStats.btts.toString(),
    cleanSheetPercentage: homeGoalStats.cleanSheet.toString(),
    failedToScorePercentage: homeGoalStats.failedToScore.toString(),
    record: `${homeFormData.wins}W-${homeFormData.draws}D-${homeFormData.losses}L`,
    matchCount: homeFormData.details.length,
    matchDetails: homeFormData.details,
    
    // Venue-specific (EVDEKİ MAÇLAR)
    venueForm: homeVenueData.form,
    venuePoints: homeVenueData.points,
    venueAvgScored: homeVenueGoalStats.avgScored.toFixed(2),
    venueAvgConceded: homeVenueGoalStats.avgConceded.toFixed(2),
    venueOver25Pct: homeVenueGoalStats.over25,
    venueBttsPct: homeVenueGoalStats.btts,
    venueMatchCount: homeVenueData.details.length,
    venueRecord: `${homeVenueData.wins}W-${homeVenueData.draws}D-${homeVenueData.losses}L`,
  };
  
  // AwayForm objesi
  const awayForm: TeamStats = {
    form: awayFormData.form,
    points: awayFormData.points,
    avgGoalsScored: awayGoalStats.avgScored.toFixed(2),
    avgGoalsConceded: awayGoalStats.avgConceded.toFixed(2),
    over25Percentage: awayGoalStats.over25.toString(),
    bttsPercentage: awayGoalStats.btts.toString(),
    cleanSheetPercentage: awayGoalStats.cleanSheet.toString(),
    failedToScorePercentage: awayGoalStats.failedToScore.toString(),
    record: `${awayFormData.wins}W-${awayFormData.draws}D-${awayFormData.losses}L`,
    matchCount: awayFormData.details.length,
    matchDetails: awayFormData.details,
    
    // Venue-specific (DEPLASMANDAKİ MAÇLAR)
    venueForm: awayVenueData.form,
    venuePoints: awayVenueData.points,
    venueAvgScored: awayVenueGoalStats.avgScored.toFixed(2),
    venueAvgConceded: awayVenueGoalStats.avgConceded.toFixed(2),
    venueOver25Pct: awayVenueGoalStats.over25,
    venueBttsPct: awayVenueGoalStats.btts,
    venueMatchCount: awayVenueData.details.length,
    venueRecord: `${awayVenueData.wins}W-${awayVenueData.draws}D-${awayVenueData.losses}L`,
  };
  
  // Summary log
  console.log(`\n📊 FINAL DATA SUMMARY:`);
  console.log(`   🏠 ${homeTeamName}:`);
  console.log(`      General: ${homeForm.form} | ${homeForm.avgGoalsScored} gol/maç | Over25: ${homeForm.over25Percentage}%`);
  console.log(`      Home:    ${homeForm.venueForm} | ${homeForm.venueAvgScored} gol/maç | Over25: ${homeForm.venueOver25Pct}%`);
  console.log(`   🚌 ${awayTeamName}:`);
  console.log(`      General: ${awayForm.form} | ${awayForm.avgGoalsScored} gol/maç | Over25: ${awayForm.over25Percentage}%`);
  console.log(`      Away:    ${awayForm.venueForm} | ${awayForm.venueAvgScored} gol/maç | Over25: ${awayForm.venueOver25Pct}%`);
  console.log(`   🔄 H2H: ${h2hData.totalMatches} maç | Over25: ${h2hData.over25Percentage}% | BTTS: ${h2hData.bttsPercentage}%`);
  if (dataQuality) {
    console.log(`   📊 Data Quality: ${dataQuality.score}/100`);
    if (dataQuality.warnings.length > 0) {
      console.log(`   ⚠️ Warnings: ${dataQuality.warnings.join(', ')}`);
    }
  }
  console.log(`${'═'.repeat(60)}\n`);
  
  return {
    fixtureId,
    homeTeam: homeTeamName,
    awayTeam: awayTeamName,
    homeTeamId,
    awayTeamId,
    league,
    leagueId: leagueId || 0,
    kickOff: '',
    homeForm,
    awayForm,
    h2h: h2hData,
    odds: oddsData.current,
    oddsHistory: oddsData.history,
    dataQuality,
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// QUICK FETCH BY FIXTURE ID
// ═══════════════════════════════════════════════════════════════════════════════

export async function fetchMatchDataByFixtureId(fixtureId: number): Promise<CompleteMatchData | null> {
  console.log(`\n🔍 Fetching fixture ${fixtureId}...`);
  
  const fixtureData = await fetchSportmonks(`/fixtures/${fixtureId}?include=participants;league`);
  
  if (!fixtureData?.data) {
    console.error('❌ Fixture not found:', fixtureId);
    return null;
  }
  
  const fixture = fixtureData.data;
  const participants = fixture.participants || [];
  
  const homeTeam = participants.find((p: any) => p.meta?.location === 'home');
  const awayTeam = participants.find((p: any) => p.meta?.location === 'away');
  
  if (!homeTeam || !awayTeam) {
    console.error('❌ Teams not found in fixture');
    return null;
  }
  
  return fetchCompleteMatchData(
    fixtureId,
    homeTeam.id,
    awayTeam.id,
    homeTeam.name,
    awayTeam.name,
    fixture.league?.name || 'Unknown',
    fixture.league?.id
  );
}
