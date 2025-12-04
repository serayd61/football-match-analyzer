export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { checkUserAccess } from '@/lib/accessControl';
import { runFullAnalysis } from '@/lib/heurist/orchestrator';

const SPORTMONKS_API_KEY = process.env.SPORTMONKS_API_KEY;

// ==================== DATA FETCHING (ONLY SPORTMONKS) ====================

async function fetchMatchDataForAgents(fixtureId: number, homeTeamId: number, awayTeamId: number) {
  let odds: any = {};
  let homeForm: any = {};
  let awayForm: any = {};
  let h2h: any = {};

  try {
    if (SPORTMONKS_API_KEY) {
      // Fixture with odds
      const fixtureRes = await fetch(
        `https://api.sportmonks.com/v3/football/fixtures/${fixtureId}?api_token=${SPORTMONKS_API_KEY}&include=odds`
      );
      const fixtureData = await fixtureRes.json();
      if (fixtureData.data?.odds) {
        odds = parseOdds(fixtureData.data.odds);
      }

      // Home team form
      const homeFormRes = await fetch(
        `https://api.sportmonks.com/v3/football/teams/${homeTeamId}?api_token=${SPORTMONKS_API_KEY}&include=latest`
      );
      const homeFormData = await homeFormRes.json();
      if (homeFormData.data?.latest) {
        homeForm = calculateForm(homeFormData.data.latest, 'home');
      }

      // Away team form
      const awayFormRes = await fetch(
        `https://api.sportmonks.com/v3/football/teams/${awayTeamId}?api_token=${SPORTMONKS_API_KEY}&include=latest`
      );
      const awayFormData = await awayFormRes.json();
      if (awayFormData.data?.latest) {
        awayForm = calculateForm(awayFormData.data.latest, 'away');
      }

      // H2H
      const h2hRes = await fetch(
        `https://api.sportmonks.com/v3/football/fixtures/head-to-head/${homeTeamId}/${awayTeamId}?api_token=${SPORTMONKS_API_KEY}`
      );
      const h2hData = await h2hRes.json();
      if (h2hData.data) {
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
    doubleChance: {},
    halfTime: {},
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

    if (marketName.includes('double chance')) {
      market.odds?.forEach((odd: any) => {
        if (odd.label === '1X') result.doubleChance.homeOrDraw = odd.value;
        if (odd.label === 'X2') result.doubleChance.awayOrDraw = odd.value;
        if (odd.label === '12') result.doubleChance.homeOrAway = odd.value;
      });
    }
  });

  return result;
}

function calculateForm(matches: any[], location: string): any {
  if (!matches || !Array.isArray(matches) || matches.length === 0) {
    return { form: 'N/A', points: 0, avgGoals: '0', avgConceded: '0', over25Percentage: '0', bttsPercentage: '0' };
  }

  const last5 = matches.slice(0, 5);
  let form = '';
  let points = 0;
  let totalGoals = 0;
  let totalConceded = 0;
  let over25Count = 0;
  let bttsCount = 0;

  last5.forEach((match: any) => {
    const homeScore = match.scores?.home || 0;
    const awayScore = match.scores?.away || 0;
    const isHome = match.participant?.meta?.location === 'home';
    const teamGoals = isHome ? homeScore : awayScore;
    const opponentGoals = isHome ? awayScore : homeScore;

    totalGoals += teamGoals;
    totalConceded += opponentGoals;

    if (homeScore + awayScore > 2.5) over25Count++;
    if (homeScore > 0 && awayScore > 0) bttsCount++;

    if (teamGoals > opponentGoals) { form += 'W'; points += 3; }
    else if (teamGoals < opponentGoals) { form += 'L'; }
    else { form += 'D'; points += 1; }
  });

  return {
    form,
    points,
    avgGoals: (totalGoals / last5.length).toFixed(1),
    avgConceded: (totalConceded / last5.length).toFixed(1),
    over25Percentage: Math.round((over25Count / last5.length) * 100).toString(),
    bttsPercentage: Math.round((bttsCount / last5.length) * 100).toString(),
  };
}

function calculateH2H(matches: any[], homeTeamId: number, awayTeamId: number): any {
  if (!matches || matches.length === 0) {
    return { totalMatches: 0, homeWins: 0, awayWins: 0, draws: 0, avgGoals: '0', over25Percentage: '0', bttsPercentage: '0' };
  }

  let homeWins = 0, awayWins = 0, draws = 0, totalGoals = 0, over25Count = 0, bttsCount = 0;

  matches.forEach((match: any) => {
    const homeScore = match.scores?.home || 0;
    const awayScore = match.scores?.away || 0;
    totalGoals += homeScore + awayScore;

    if (homeScore + awayScore > 2.5) over25Count++;
    if (homeScore > 0 && awayScore > 0) bttsCount++;

    const matchHomeTeamId = match.participants?.find((p: any) => p.meta?.location === 'home')?.id;

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

// ==================== MAIN HANDLER ====================

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Pro kontrolü
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0] || 'unknown';
    const access = await checkUserAccess(session.user.email, ip);

    if (!access.canUseAgents) {
      return NextResponse.json({ 
        error: 'Pro subscription required for AI Agents',
        requiresPro: true 
      }, { status: 403 });
    }

    const body = await request.json();
    const { fixtureId, homeTeam, awayTeam, homeTeamId, awayTeamId, league = '', language = 'en' } = body;

    if (!fixtureId) {
      return NextResponse.json({ error: 'Fixture ID required' }, { status: 400 });
    }

    console.log('🤖 AGENT ANALYSIS REQUEST');
    console.log(`📍 Match: ${homeTeam} vs ${awayTeam}`);
    console.log(`🌍 Language: ${language}`);

    // VERİLERİ ÇEK (SADECE SPORTMONKS)
    console.log('📊 Fetching match data from Sportmonks...');
    const { odds, homeForm, awayForm, h2h } = await fetchMatchDataForAgents(fixtureId, homeTeamId, awayTeamId);
    
    console.log(`✅ Data ready:`);
    console.log(`   Odds: ${odds?.matchWinner?.home ? 'YES' : 'NO'}`);
    console.log(`   Home Form: ${homeForm?.form || 'N/A'}`);
    console.log(`   Away Form: ${awayForm?.form || 'N/A'}`);
    console.log(`   H2H: ${h2h?.totalMatches || 0} matches`);

    // VERİLERİ AJANLARA AKTAR
    const result = await runFullAnalysis({
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
    }, language as 'tr' | 'en' | 'de');

    console.log('✅ Agent Analysis Complete');
    console.log(`   Scout: ${result.reports.scout ? 'OK' : 'FAIL'}`);
    console.log(`   Stats: ${result.reports.stats ? 'OK' : 'FAIL'}`);
    console.log(`   Odds: ${result.reports.odds ? 'OK' : 'FAIL'}`);
    console.log(`   Strategy: ${result.reports.strategy ? 'OK' : 'FAIL'}`);
    console.log(`   Consensus: ${result.reports.consensus ? 'OK' : 'FAIL'}`);

    return NextResponse.json({
      success: result.success,
      reports: result.reports,
      timing: result.timing,
      errors: result.errors,
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

