export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { checkUserAccess } from '@/lib/accessControl';
import { runFullAnalysis } from '@/lib/heurist/orchestrator';
import { runMultiModelAnalysis } from '@/lib/heurist/multiModel';

const SPORTMONKS_API_KEY = process.env.SPORTMONKS_API_KEY;

async function fetchMatchDataForAgents(fixtureId: number, homeTeamId: number, awayTeamId: number) {
  let odds: any = {};
  let homeForm: any = {};
  let awayForm: any = {};
  let h2h: any = {};

  try {
    if (SPORTMONKS_API_KEY) {
     const [fixtureRes, homeFormRes, awayFormRes, h2hRes] = await Promise.all([
        fetch(`https://api.sportmonks.com/v3/football/fixtures/${fixtureId}?api_token=${SPORTMONKS_API_KEY}&include=odds;scores;participants`),
        fetch(`https://api.sportmonks.com/v3/football/teams/${homeTeamId}?api_token=${SPORTMONKS_API_KEY}&include=latest.scores;latest.participants`),
        fetch(`https://api.sportmonks.com/v3/football/teams/${awayTeamId}?api_token=${SPORTMONKS_API_KEY}&include=latest.scores;latest.participants`),
        fetch(`https://api.sportmonks.com/v3/football/fixtures/head-to-head/${homeTeamId}/${awayTeamId}?api_token=${SPORTMONKS_API_KEY}&include=scores;participants`),
      ]);

      const [fixtureData, homeFormData, awayFormData, h2hData] = await Promise.all([
        fixtureRes.json(),
        homeFormRes.json(),
        awayFormRes.json(),
        h2hRes.json(),
      ]);

      // 🔍 DEBUG - Raw API response
      console.log('🔍 DEBUG homeFormData.data keys:', homeFormData.data ? Object.keys(homeFormData.data) : 'NO DATA');
      console.log('🔍 DEBUG homeFormData.data.latest:', homeFormData.data?.latest ? `${homeFormData.data.latest.length} matches` : 'NO LATEST');
      console.log('🔍 DEBUG first match sample:', JSON.stringify(homeFormData.data?.latest?.[0], null, 2)?.substring(0, 500));

      if (fixtureData.data?.odds) {
        odds = parseOdds(fixtureData.data.odds);
      }
      
      if (homeFormData.data?.latest && homeFormData.data.latest.length > 0) {
        homeForm = calculateForm(homeFormData.data.latest, homeTeamId);
        console.log('✅ Home form calculated:', homeForm);
      } else {
        console.log('⚠️ No latest data for home team!');
      }
      
      if (awayFormData.data?.latest && awayFormData.data.latest.length > 0) {
        awayForm = calculateForm(awayFormData.data.latest, awayTeamId);
        console.log('✅ Away form calculated:', awayForm);
      } else {
        console.log('⚠️ No latest data for away team!');
      }
      
      if (h2hData.data && h2hData.data.length > 0) {
        h2h = calculateH2H(h2hData.data, homeTeamId, awayTeamId);
      }
    }
  } catch (error) {
    console.error('Sportmonks fetch error:', error);
  }

  return { odds, homeForm, awayForm, h2h };
}

function parseOdds(oddsData: any[]): any {
  const result: any = {
    matchWinner: {},
    overUnder: { '2.5': {} },
    btts: {},
  };

  if (!oddsData || !Array.isArray(oddsData)) return result;

  oddsData.forEach((market: any) => {
    const marketName = market.market?.name?.toLowerCase() || '';

    if (marketName.includes('fulltime result') || marketName.includes('match winner') || marketName.includes('1x2')) {
      market.odds?.forEach((odd: any) => {
        if (odd.label === '1' || odd.label === 'Home') result.matchWinner.home = odd.value;
        if (odd.label === 'X' || odd.label === 'Draw') result.matchWinner.draw = odd.value;
        if (odd.label === '2' || odd.label === 'Away') result.matchWinner.away = odd.value;
      });
    }

    if (marketName.includes('over/under') || marketName.includes('goals')) {
      market.odds?.forEach((odd: any) => {
        if (odd.total === 2.5 || marketName.includes('2.5')) {
          if (odd.label === 'Over') result.overUnder['2.5'].over = odd.value;
          if (odd.label === 'Under') result.overUnder['2.5'].under = odd.value;
        }
      });
    }

    if (marketName.includes('both teams') || marketName.includes('btts')) {
      market.odds?.forEach((odd: any) => {
        if (odd.label === 'Yes') result.btts.yes = odd.value;
        if (odd.label === 'No') result.btts.no = odd.value;
      });
    }
  });

  return result;
}

function calculateForm(matches: any[], teamId: number): any {
  if (!matches || !Array.isArray(matches) || matches.length === 0) {
    console.log('⚠️ calculateForm: No matches provided');
    return { form: 'N/A', points: 0, avgGoals: '0', avgConceded: '0', over25Percentage: '0', bttsPercentage: '0' };
  }

  const last5 = matches.slice(0, 5);
  let form = '';
  let points = 0;
  let totalGoals = 0;
  let totalConceded = 0;
  let over25Count = 0;
  let bttsCount = 0;

  console.log(`🔍 Calculating form for teamId ${teamId} from ${last5.length} matches`);

  last5.forEach((match: any, index: number) => {
    // Sportmonks yapısı: scores içinde participant bazlı veya direkt
    let homeScore = 0;
    let awayScore = 0;
    let isHome = false;

    // Yöntem 1: participants array'inden bul
    if (match.participants && Array.isArray(match.participants)) {
      const homeTeam = match.participants.find((p: any) => p.meta?.location === 'home');
      const awayTeam = match.participants.find((p: any) => p.meta?.location === 'away');
      
      homeScore = homeTeam?.meta?.score || 0;
      awayScore = awayTeam?.meta?.score || 0;
      isHome = homeTeam?.id === teamId;
      
      console.log(`  Match ${index + 1}: ${homeTeam?.name || 'H'} ${homeScore}-${awayScore} ${awayTeam?.name || 'A'} | TeamIsHome: ${isHome}`);
    }
    // Yöntem 2: scores objesi
    else if (match.scores) {
      homeScore = match.scores.home_score || match.scores.home || 0;
      awayScore = match.scores.away_score || match.scores.away || 0;
      isHome = match.participant?.meta?.location === 'home' || match.home_team_id === teamId;
    }
    // Yöntem 3: Direkt score alanları
    else {
      homeScore = match.home_score || match.homeScore || 0;
      awayScore = match.away_score || match.awayScore || 0;
      isHome = match.home_team_id === teamId || match.localteam_id === teamId;
    }

    const teamGoals = isHome ? homeScore : awayScore;
    const opponentGoals = isHome ? awayScore : homeScore;

    totalGoals += teamGoals;
    totalConceded += opponentGoals;

    const totalMatchGoals = homeScore + awayScore;
    if (totalMatchGoals > 2.5) over25Count++;
    if (homeScore > 0 && awayScore > 0) bttsCount++;

    if (teamGoals > opponentGoals) { form += 'W'; points += 3; }
    else if (teamGoals < opponentGoals) { form += 'L'; }
    else { form += 'D'; points += 1; }
  });

  const result = {
    form,
    points,
    avgGoals: (totalGoals / last5.length).toFixed(1),
    avgConceded: (totalConceded / last5.length).toFixed(1),
    over25Percentage: Math.round((over25Count / last5.length) * 100).toString(),
    bttsPercentage: Math.round((bttsCount / last5.length) * 100).toString(),
  };

  console.log(`✅ Form result: ${form} | Goals: ${result.avgGoals} | Over25: ${result.over25Percentage}%`);
  
  return result;
}

function calculateH2H(matches: any[], homeTeamId: number, awayTeamId: number): any {
  if (!matches || matches.length === 0) {
    return { totalMatches: 0, homeWins: 0, awayWins: 0, draws: 0, avgGoals: '0', over25Percentage: '0', bttsPercentage: '0' };
  }

  let homeWins = 0, awayWins = 0, draws = 0, totalGoals = 0, over25Count = 0, bttsCount = 0;

  matches.forEach((match: any) => {
    let homeScore = 0;
    let awayScore = 0;
    let matchHomeTeamId = null;

    if (match.participants && Array.isArray(match.participants)) {
      const homeTeam = match.participants.find((p: any) => p.meta?.location === 'home');
      const awayTeam = match.participants.find((p: any) => p.meta?.location === 'away');
      
      homeScore = homeTeam?.meta?.score || 0;
      awayScore = awayTeam?.meta?.score || 0;
      matchHomeTeamId = homeTeam?.id;
    } else {
      homeScore = match.scores?.home_score || match.scores?.home || match.home_score || 0;
      awayScore = match.scores?.away_score || match.scores?.away || match.away_score || 0;
      matchHomeTeamId = match.home_team_id || match.localteam_id;
    }

    totalGoals += homeScore + awayScore;

    if (homeScore + awayScore > 2.5) over25Count++;
    if (homeScore > 0 && awayScore > 0) bttsCount++;

    if (homeScore > awayScore) {
      if (matchHomeTeamId === homeTeamId) homeWins++;
      else awayWins++;
    } else if (homeScore < awayScore) {
      if (matchHomeTeamId === homeTeamId) awayWins++;
      else homeWins++;
    } else {
      draws++;
    }
  });

  return {
    totalMatches: matches.length,
    homeWins,
    awayWins,
    draws,
    avgGoals: (totalGoals / matches.length).toFixed(1),
    over25Percentage: Math.round((over25Count / matches.length) * 100).toString(),
    bttsPercentage: Math.round((bttsCount / matches.length) * 100).toString(),
  };
}

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

    console.log('🤖 AGENT ANALYSIS REQUEST');
    console.log(`📍 Match: ${homeTeam} vs ${awayTeam}`);
    console.log(`🔮 Multi-Model: ${useMultiModel ? 'ENABLED' : 'DISABLED'}`);

    const { odds, homeForm, awayForm, h2h } = await fetchMatchDataForAgents(fixtureId, homeTeamId, awayTeamId);
    
    console.log(`📊 Data Summary:`);
    console.log(`   Odds: ${odds?.matchWinner?.home ? 'YES' : 'NO'}`);
    console.log(`   Home Form: ${homeForm?.form || 'N/A'} | Goals: ${homeForm?.avgGoals || '?'}`);
    console.log(`   Away Form: ${awayForm?.form || 'N/A'} | Goals: ${awayForm?.avgGoals || '?'}`);
    console.log(`   H2H: ${h2h?.totalMatches || 0} matches | Avg Goals: ${h2h?.avgGoals || '?'}`);

    const matchData = {
      fixtureId,
      homeTeam,
      awayTeam,
      homeTeamId,
      awayTeamId,
      league,
      date: new Date().toISOString(),
      odds,
      homeForm,
      awayForm,
      h2h,
    };

    let multiModelResult = null;
    if (useMultiModel) {
      console.log('🔮 Starting Multi-Model Analysis...');
      multiModelResult = await runMultiModelAnalysis(matchData);
      console.log(`🎯 Multi-Model Agreement: ${multiModelResult.modelAgreement}%`);
    }

    const result = await runFullAnalysis(matchData, language as 'tr' | 'en' | 'de');

    console.log('✅ Analysis Complete');

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
        hasHomeForm: !!homeForm?.form && homeForm.form !== 'N/A',
        hasAwayForm: !!awayForm?.form && awayForm.form !== 'N/A',
        hasH2H: !!h2h?.totalMatches && h2h.totalMatches > 0,
      }
    });
  } catch (error: any) {
    console.error('❌ Agent error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
