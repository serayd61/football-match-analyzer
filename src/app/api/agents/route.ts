export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { checkUserAccess } from '@/lib/accessControl';
import { runFullAnalysis } from '@/lib/heurist/orchestrator';
import { runMultiModelAnalysis } from '@/lib/heurist/multiModel';

const SPORTMONKS_API_KEY = process.env.SPORTMONKS_API_KEY;

async function fetchMatchDataForAgents(fixtureId: number, homeTeamId: number, awayTeamId: number, homeTeamName: string, awayTeamName: string) {
  let odds: any = {};
  let homeForm: any = {};
  let awayForm: any = {};
  let h2h: any = {};

  try {
    if (SPORTMONKS_API_KEY) {
      const [fixtureRes, homeFormRes, awayFormRes, h2hRes] = await Promise.all([
        fetch(`https://api.sportmonks.com/v3/football/fixtures/${fixtureId}?api_token=${SPORTMONKS_API_KEY}&include=odds;scores;participants`),
        fetch(`https://api.sportmonks.com/v3/football/teams/${homeTeamId}?api_token=${SPORTMONKS_API_KEY}&include=latest`),
        fetch(`https://api.sportmonks.com/v3/football/teams/${awayTeamId}?api_token=${SPORTMONKS_API_KEY}&include=latest`),
        fetch(`https://api.sportmonks.com/v3/football/fixtures/head-to-head/${homeTeamId}/${awayTeamId}?api_token=${SPORTMONKS_API_KEY}&include=scores;participants`),
      ]);

      const [fixtureData, homeFormData, awayFormData, h2hData] = await Promise.all([
        fixtureRes.json(),
        homeFormRes.json(),
        awayFormRes.json(),
        h2hRes.json(),
      ]);

      // Fixture odds
      if (fixtureData.data?.odds) {
        odds = parseOdds(fixtureData.data.odds);
      }

      // Home team form
      if (homeFormData.data?.latest && homeFormData.data.latest.length > 0) {
        homeForm = calculateForm(homeFormData.data.latest, homeTeamId, homeTeamName);
      } else {
        console.log('⚠️ No latest data for home team');
        homeForm = getDefaultForm();
      }

      // Away team form
      if (awayFormData.data?.latest && awayFormData.data.latest.length > 0) {
        awayForm = calculateForm(awayFormData.data.latest, awayTeamId, awayTeamName);
      } else {
        console.log('⚠️ No latest data for away team');
        awayForm = getDefaultForm();
      }

      // H2H
      if (h2hData.data && h2hData.data.length > 0) {
        h2h = calculateH2H(h2hData.data, homeTeamId, awayTeamId, homeTeamName);
      } else {
        h2h = getDefaultH2H();
      }
    }
  } catch (error) {
    console.error('Sportmonks fetch error:', error);
  }

  return { odds, homeForm, awayForm, h2h };
}

function getDefaultForm() {
  return { 
    form: 'N/A', 
    points: 0, 
    avgGoals: '1.2', 
    avgConceded: '1.0', 
    over25Percentage: '50', 
    bttsPercentage: '50' 
  };
}

function getDefaultH2H() {
  return { 
    totalMatches: 0, 
    homeWins: 0, 
    awayWins: 0, 
    draws: 0, 
    avgGoals: '2.5', 
    over25Percentage: '50', 
    bttsPercentage: '50' 
  };
}

function parseOdds(oddsData: any[]): any {
  const result: any = {
    matchWinner: {},
    overUnder: { '2.5': {} },
    btts: {},
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

    // Over/Under 2.5
    if (marketName.includes('over/under') || marketName.includes('goals')) {
      if (odd.total === 2.5 || odd.total === '2.5' || marketName.includes('2.5')) {
        if (odd.label === 'Over') result.overUnder['2.5'].over = parseFloat(odd.value);
        if (odd.label === 'Under') result.overUnder['2.5'].under = parseFloat(odd.value);
      }
    }

    // BTTS
    if (marketName.includes('both teams') || marketName.includes('btts')) {
      if (odd.label === 'Yes') result.btts.yes = parseFloat(odd.value);
      if (odd.label === 'No') result.btts.no = parseFloat(odd.value);
    }
  });

  return result;
}

function calculateForm(matches: any[], teamId: number, teamName: string): any {
  if (!matches || !Array.isArray(matches) || matches.length === 0) {
    return getDefaultForm();
  }

  const last5 = matches.slice(0, 5);
  let form = '';
  let points = 0;
  let wins = 0, draws = 0, losses = 0;

  // Team name'in ilk kelimesini al (Galatasaray vs "Galatasaray SK" için)
  const teamFirstWord = teamName.split(' ')[0].toLowerCase();

  console.log(`🔍 Calculating form for ${teamName} from ${last5.length} matches`);

  last5.forEach((match: any, index: number) => {
    const resultInfo = (match.result_info || '').toLowerCase();
    const matchName = match.name || '';
    
    let result = 'D';
    
    if (resultInfo.includes('draw') || resultInfo.includes('ended in draw')) {
      result = 'D';
      draws++;
      points += 1;
    } else if (resultInfo.includes('won')) {
      // Kazanan takımı bul
      const winnerName = resultInfo.split(' won')[0].trim();
      
      if (winnerName.includes(teamFirstWord) || teamFirstWord.includes(winnerName.split(' ')[0])) {
        result = 'W';
        wins++;
        points += 3;
      } else {
        result = 'L';
        losses++;
      }
    }
    
    form += result;
    console.log(`  ${index + 1}. ${matchName} → ${match.result_info} → ${result}`);
  });

  // Gol ortalaması tahmini (form'a göre)
  const avgGoals = ((wins * 2.0) + (draws * 1.0) + (losses * 0.8)) / last5.length;
  const avgConceded = ((losses * 2.0) + (draws * 1.0) + (wins * 0.6)) / last5.length;
  const over25Pct = Math.round(((wins * 65) + (draws * 45) + (losses * 55)) / last5.length);
  const bttsPct = Math.round(((wins * 55) + (draws * 60) + (losses * 65)) / last5.length);

  const formResult = {
    form,
    points,
    avgGoals: avgGoals.toFixed(1),
    avgConceded: avgConceded.toFixed(1),
    over25Percentage: over25Pct.toString(),
    bttsPercentage: bttsPct.toString(),
  };

  console.log(`✅ Form: ${form} | Points: ${points}/15 | Goals: ${avgGoals.toFixed(1)} | Over25: ${over25Pct}%`);
  
  return formResult;
}

function calculateH2H(matches: any[], homeTeamId: number, awayTeamId: number, homeTeamName: string): any {
  if (!matches || matches.length === 0) {
    return getDefaultH2H();
  }

  let homeWins = 0, awayWins = 0, draws = 0;
  let totalGoals = 0;
  let over25Count = 0;
  let bttsCount = 0;

  const homeFirstWord = homeTeamName.split(' ')[0].toLowerCase();

  matches.forEach((match: any) => {
    const resultInfo = (match.result_info || '').toLowerCase();
    
    // Skor varsa kullan
    if (match.scores && Array.isArray(match.scores)) {
      const homeScore = match.scores.find((s: any) => s.description === 'CURRENT')?.score?.home || 0;
      const awayScore = match.scores.find((s: any) => s.description === 'CURRENT')?.score?.away || 0;
      totalGoals += homeScore + awayScore;
      if (homeScore + awayScore > 2.5) over25Count++;
      if (homeScore > 0 && awayScore > 0) bttsCount++;
    } else {
      // Skor yoksa tahmini değer
      totalGoals += 2.5;
      over25Count += 0.5;
      bttsCount += 0.5;
    }

    // Sonuç
    if (resultInfo.includes('draw')) {
      draws++;
    } else if (resultInfo.includes('won')) {
      const winnerName = resultInfo.split(' won')[0].trim();
      if (winnerName.includes(homeFirstWord)) {
        homeWins++;
      } else {
        awayWins++;
      }
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

    // Veri çek - takım isimlerini de gönder
    const { odds, homeForm, awayForm, h2h } = await fetchMatchDataForAgents(
      fixtureId, homeTeamId, awayTeamId, homeTeam, awayTeam
    );
    
    console.log(`📊 DATA SUMMARY:`);
    console.log(`   Odds: ${odds?.matchWinner?.home ? `1=${odds.matchWinner.home} X=${odds.matchWinner.draw} 2=${odds.matchWinner.away}` : 'NO'}`);
    console.log(`   Home Form: ${homeForm?.form} | Goals: ${homeForm?.avgGoals} | Over25: ${homeForm?.over25Percentage}%`);
    console.log(`   Away Form: ${awayForm?.form} | Goals: ${awayForm?.avgGoals} | Over25: ${awayForm?.over25Percentage}%`);
    console.log(`   H2H: ${h2h?.totalMatches} matches | Avg: ${h2h?.avgGoals} goals`);

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

    // Multi-Model Analysis
    let multiModelResult = null;
    if (useMultiModel) {
      console.log('🔮 Starting Multi-Model Analysis...');
      multiModelResult = await runMultiModelAnalysis(matchData);
      console.log(`🎯 Multi-Model Agreement: ${multiModelResult.modelAgreement}%`);
    }

    // Standard Agent Analysis
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
