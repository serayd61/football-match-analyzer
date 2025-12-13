// src/lib/heurist/sportmonks-data.ts
// Sportmonks Complete Data Layer - FIXED v3

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
}

export interface MatchDetail {
  opponent: string;
  score: string;
  result: 'W' | 'D' | 'L';
  goalsScored: number;
  goalsConceded: number;
  date: string;
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
}

// ==================== HELPER FUNCTIONS ====================

async function fetchSportmonks(endpoint: string): Promise<any> {
  try {
    if (!SPORTMONKS_TOKEN) {
      console.error('❌ SPORTMONKS_TOKEN is not set!');
      return null;
    }
    
    const separator = endpoint.includes('?') ? '&' : '?';
    const url = `${BASE_URL}${endpoint}${separator}api_token=${SPORTMONKS_TOKEN}`;
    
    console.log(`📡 Fetching: ${endpoint.substring(0, 100)}...`);
    
    const response = await fetch(url, { 
      next: { revalidate: 300 },
      headers: { 'Accept': 'application/json' }
    });
    
    if (!response.ok) {
      console.error(`❌ Sportmonks API error: ${response.status}`);
      return null;
    }
    
    return await response.json();
  } catch (error) {
    console.error(`❌ Sportmonks fetch error:`, error);
    return null;
  }
}

// Skorları parse et - type_id 1525 = CURRENT/FULLTIME
function parseScores(scores: any[]): { home: number; away: number } {
  let homeScore = 0;
  let awayScore = 0;
  
  if (!scores || scores.length === 0) {
    return { home: 0, away: 0 };
  }
  
  for (const score of scores) {
    if (score.type_id === 1525 || score.description === 'CURRENT') {
      if (score.score?.participant === 'home') {
        homeScore = score.score.goals || 0;
      } else if (score.score?.participant === 'away') {
        awayScore = score.score.goals || 0;
      }
    }
  }
  
  return { home: homeScore, away: awayScore };
}

function calculateForm(matches: any[], teamId: number): { form: string; points: number; details: MatchDetail[] } {
  if (!matches || matches.length === 0) {
    console.log(`⚠️ No matches found for team ${teamId}`);
    return { form: 'NNNNN', points: 0, details: [] };
  }
  
  console.log(`📊 Calculating form from ${matches.length} matches for team ${teamId}`);
  
  let form = '';
  let points = 0;
  const details: MatchDetail[] = [];
  
  // Bitmiş maçları filtrele (state_id = 5) ve tarihe göre sırala
  const finishedMatches = matches
    .filter((m: any) => m.state_id === 5)
    .sort((a: any, b: any) => new Date(b.starting_at).getTime() - new Date(a.starting_at).getTime())
    .slice(0, 5);
  
  if (finishedMatches.length === 0) {
    console.log(`⚠️ No finished matches found`);
    return { form: 'NNNNN', points: 0, details: [] };
  }
  
  for (const match of finishedMatches) {
    const scores = match.scores || [];
    const participants = match.participants || [];
    
    const { home: homeScore, away: awayScore } = parseScores(scores);
    
    const homeTeam = participants.find((p: any) => p.meta?.location === 'home');
    const awayTeam = participants.find((p: any) => p.meta?.location === 'away');
    
    if (!homeTeam || !awayTeam) continue;
    
    const isHome = homeTeam.id === teamId;
    const teamScore = isHome ? homeScore : awayScore;
    const oppScore = isHome ? awayScore : homeScore;
    const opponent = isHome ? awayTeam.name : homeTeam.name;
    
    let result: 'W' | 'D' | 'L';
    if (teamScore > oppScore) {
      result = 'W';
      points += 3;
    } else if (teamScore < oppScore) {
      result = 'L';
    } else {
      result = 'D';
      points += 1;
    }
    
    form += result;
    details.push({
      opponent: opponent || 'Unknown',
      score: `${teamScore}-${oppScore}`,
      result,
      goalsScored: teamScore,
      goalsConceded: oppScore,
      date: match.starting_at || '',
    });
  }
  
  console.log(`   ✅ Form: ${form} (${points} pts) from ${details.length} matches`);
  
  return { form: form || 'NNNNN', points, details };
}

function calculateGoalStats(details: MatchDetail[]): {
  avgScored: number;
  avgConceded: number;
  over25: number;
  btts: number;
  cleanSheet: number;
  failedToScore: number;
} {
  if (details.length === 0) {
    return { avgScored: 1.2, avgConceded: 1.0, over25: 50, btts: 50, cleanSheet: 30, failedToScore: 20 };
  }
  
  let totalScored = 0;
  let totalConceded = 0;
  let over25Count = 0;
  let bttsCount = 0;
  let cleanSheetCount = 0;
  let failedToScoreCount = 0;
  
  for (const match of details) {
    totalScored += match.goalsScored;
    totalConceded += match.goalsConceded;
    
    const totalGoals = match.goalsScored + match.goalsConceded;
    if (totalGoals > 2.5) over25Count++;
    if (match.goalsScored > 0 && match.goalsConceded > 0) bttsCount++;
    if (match.goalsConceded === 0) cleanSheetCount++;
    if (match.goalsScored === 0) failedToScoreCount++;
  }
  
  const count = details.length;
  return {
    avgScored: totalScored / count,
    avgConceded: totalConceded / count,
    over25: Math.round((over25Count / count) * 100),
    btts: Math.round((bttsCount / count) * 100),
    cleanSheet: Math.round((cleanSheetCount / count) * 100),
    failedToScore: Math.round((failedToScoreCount / count) * 100),
  };
}

// ==================== MAIN DATA FETCHERS ====================

// Takımın son maçlarını çek - /schedules/teams endpoint'i
export async function fetchTeamRecentMatches(teamId: number, leagueId?: number, count: number = 10): Promise<any[]> {
  const endpoint = `/schedules/teams/${teamId}`;
  
  console.log(`📡 Fetching schedule for team ${teamId}...`);
  const data = await fetchSportmonks(endpoint);
  
  if (!data?.data || data.data.length === 0) {
    console.log(`⚠️ No schedule data for team ${teamId}`);
    return [];
  }
  
  // Schedule yapısı: data[0].rounds[].fixtures[]
  // Tüm fixture'ları topla
  const allFixtures: any[] = [];
  
  for (const stage of data.data) {
    if (stage.rounds && Array.isArray(stage.rounds)) {
      for (const round of stage.rounds) {
        if (round.fixtures && Array.isArray(round.fixtures)) {
          allFixtures.push(...round.fixtures);
        }
      }
    }
  }
  
  console.log(`   📊 Found ${allFixtures.length} total fixtures for team ${teamId}`);
  
  // Bitmiş maçları filtrele ve tarihe göre sırala
  const finishedFixtures = allFixtures
    .filter((f: any) => f.state_id === 5)
    .sort((a: any, b: any) => new Date(b.starting_at).getTime() - new Date(a.starting_at).getTime());
  
  console.log(`   📊 Found ${finishedFixtures.length} finished fixtures`);
  
  if (finishedFixtures.length > 0) {
    const first = finishedFixtures[0];
    console.log(`   📊 Most recent: ${first.name} (${first.starting_at})`);
  }
  
  return finishedFixtures.slice(0, count);
}

// H2H verilerini çek
export async function fetchH2H(team1Id: number, team2Id: number): Promise<H2HStats> {
  const endpoint = `/fixtures/head-to-head/${team1Id}/${team2Id}?include=scores;participants&per_page=10`;
  const data = await fetchSportmonks(endpoint);
  
  const matches = data?.data || [];
  
  if (matches.length === 0) {
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
  
  let homeWins = 0, awayWins = 0, draws = 0;
  let totalGoals = 0;
  let over25Count = 0;
  let bttsCount = 0;
  const matchDetails: MatchDetail[] = [];
  
  for (const match of matches) {
    const scores = match.scores || [];
    const { home: homeScore, away: awayScore } = parseScores(scores);
    
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
    });
  }
  
  const count = matches.length;
  return {
    totalMatches: count,
    homeWins,
    awayWins,
    draws,
    avgTotalGoals: (totalGoals / count).toFixed(2),
    over25Percentage: Math.round((over25Count / count) * 100).toString(),
    bttsPercentage: Math.round((bttsCount / count) * 100).toString(),
    matchDetails,
  };
}

// Pre-match oranları çek
export async function fetchPreMatchOdds(fixtureId: number): Promise<any> {
  const endpoint = `/odds/pre-match/fixtures/${fixtureId}?include=market;bookmaker`;
  const data = await fetchSportmonks(endpoint);
  
  const odds = data?.data || [];
  
  let home = 2.0, draw = 3.5, away = 3.5;
  let over25 = 1.9, under25 = 1.9;
  let bttsYes = 1.85, bttsNo = 1.95;
  
  let homeOpening = 0, homeCurrentList: number[] = [];
  let over25Opening = 0, over25CurrentList: number[] = [];
  let bttsYesOpening = 0, bttsYesCurrentList: number[] = [];
  
  for (const odd of odds) {
    const marketId = odd.market_id;
    const label = odd.label?.toString() || '';
    const value = parseFloat(odd.value) || 0;
    const isOriginal = odd.original === true;
    
    if (marketId === 1) {
      if (label === '1' || label.toLowerCase() === 'home') {
        if (isOriginal) homeOpening = value;
        else homeCurrentList.push(value);
        if (value > 1) home = value;
      } else if (label === 'X' || label.toLowerCase() === 'draw') {
        if (value > 1) draw = value;
      } else if (label === '2' || label.toLowerCase() === 'away') {
        if (value > 1) away = value;
      }
    }
    
    if ((marketId === 12 || marketId === 18) && 
        (odd.total?.toString().includes('2.5') || odd.name?.includes('2.5') || odd.handicap === 2.5)) {
      if (label.toLowerCase() === 'over') {
        if (isOriginal) over25Opening = value;
        else over25CurrentList.push(value);
        if (value > 1) over25 = value;
      } else if (label.toLowerCase() === 'under') {
        if (value > 1) under25 = value;
      }
    }
    
    if (marketId === 28 || marketId === 29) {
      if (label.toLowerCase() === 'yes') {
        if (isOriginal) bttsYesOpening = value;
        else bttsYesCurrentList.push(value);
        if (value > 1) bttsYes = value;
      } else if (label.toLowerCase() === 'no') {
        if (value > 1) bttsNo = value;
      }
    }
  }
  
  const homeCurrent = homeCurrentList.length > 0 ? Math.max(...homeCurrentList) : home;
  const over25Current = over25CurrentList.length > 0 ? Math.max(...over25CurrentList) : over25;
  const bttsYesCurrent = bttsYesCurrentList.length > 0 ? Math.max(...bttsYesCurrentList) : bttsYes;
  
  return {
    current: {
      matchWinner: { home, draw, away },
      overUnder: { '2.5': { over: over25, under: under25 } },
      btts: { yes: bttsYes, no: bttsNo },
    },
    history: {
      homeWin: { opening: homeOpening || home, current: homeCurrent },
      over25: { opening: over25Opening || over25, current: over25Current },
      bttsYes: { opening: bttsYesOpening || bttsYes, current: bttsYesCurrent },
    },
  };
}

// ==================== COMPLETE MATCH DATA ====================

export async function fetchCompleteMatchData(
  fixtureId: number,
  homeTeamId: number,
  awayTeamId: number,
  homeTeamName: string,
  awayTeamName: string,
  league: string,
  leagueId?: number
): Promise<CompleteMatchData> {
  console.log(`\n${'═'.repeat(50)}`);
  console.log(`🔄 Fetching: ${homeTeamName} vs ${awayTeamName}`);
  console.log(`   IDs: Home=${homeTeamId}, Away=${awayTeamId}`);
  console.log(`${'═'.repeat(50)}`);
  
  const [homeMatches, awayMatches, h2hData, oddsData] = await Promise.all([
    fetchTeamRecentMatches(homeTeamId, undefined, 10),
    fetchTeamRecentMatches(awayTeamId, undefined, 10),
    fetchH2H(homeTeamId, awayTeamId),
    fetchPreMatchOdds(fixtureId),
  ]);
  
  const homeFormData = calculateForm(homeMatches, homeTeamId);
  const homeGoalStats = calculateGoalStats(homeFormData.details);
  
  const homeForm: TeamStats = {
    form: homeFormData.form,
    points: homeFormData.points,
    avgGoalsScored: homeGoalStats.avgScored.toFixed(2),
    avgGoalsConceded: homeGoalStats.avgConceded.toFixed(2),
    over25Percentage: homeGoalStats.over25.toString(),
    bttsPercentage: homeGoalStats.btts.toString(),
    cleanSheetPercentage: homeGoalStats.cleanSheet.toString(),
    failedToScorePercentage: homeGoalStats.failedToScore.toString(),
    record: `${homeFormData.form.match(/W/g)?.length || 0}W-${homeFormData.form.match(/D/g)?.length || 0}D-${homeFormData.form.match(/L/g)?.length || 0}L`,
    matchCount: homeFormData.details.length,
    matchDetails: homeFormData.details,
  };
  
  const awayFormData = calculateForm(awayMatches, awayTeamId);
  const awayGoalStats = calculateGoalStats(awayFormData.details);
  
  const awayForm: TeamStats = {
    form: awayFormData.form,
    points: awayFormData.points,
    avgGoalsScored: awayGoalStats.avgScored.toFixed(2),
    avgGoalsConceded: awayGoalStats.avgConceded.toFixed(2),
    over25Percentage: awayGoalStats.over25.toString(),
    bttsPercentage: awayGoalStats.btts.toString(),
    cleanSheetPercentage: awayGoalStats.cleanSheet.toString(),
    failedToScorePercentage: awayGoalStats.failedToScore.toString(),
    record: `${awayFormData.form.match(/W/g)?.length || 0}W-${awayFormData.form.match(/D/g)?.length || 0}D-${awayFormData.form.match(/L/g)?.length || 0}L`,
    matchCount: awayFormData.details.length,
    matchDetails: awayFormData.details,
  };
  
  console.log(`\n📊 SUMMARY:`);
  console.log(`   🏠 ${homeTeamName}: ${homeForm.form} | ${homeForm.avgGoalsScored} gol/maç`);
  console.log(`   🚌 ${awayTeamName}: ${awayForm.form} | ${awayForm.avgGoalsScored} gol/maç`);
  console.log(`${'═'.repeat(50)}\n`);
  
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
  };
}

// ==================== QUICK MATCH DATA ====================

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
