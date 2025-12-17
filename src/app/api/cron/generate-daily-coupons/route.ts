// ============================================================================
// CRON JOB - GENERATE DAILY COUPONS
// Her gün sabah 07:00'de (UTC) günlük kuponları oluşturur
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

// SportMonks API
const SPORTMONKS_API = 'https://api.sportmonks.com/v3/football';
const API_TOKEN = process.env.SPORTMONKS_API_KEY || '';

// Desteklenen ligler (çok geniş liste - 40+ lig)
const SUPPORTED_LEAGUES = [
  // Top 5 Ligler
  8,    // Premier League
  564,  // La Liga
  82,   // Bundesliga
  301,  // Serie A
  384,  // Ligue 1
  
  // Avrupa Kupaları
  2,    // Champions League
  5,    // Europa League
  7,    // Conference League
  
  // Diğer Avrupa Ligleri
  271,  // Süper Lig (Türkiye)
  501,  // Primeira Liga (Portekiz)
  72,   // Eredivisie (Hollanda)
  208,  // Belgian Pro League
  244,  // Danish Superliga
  203,  // Russian Premier League
  318,  // Ukrainian Premier League
  27,   // Scottish Premiership
  513,  // Austrian Bundesliga
  66,   // Swiss Super League
  600,  // Greek Super League
  462,  // Czech First League
  106,  // Polish Ekstraklasa
  169,  // Croatian HNL
  99,   // Serbian SuperLiga
  
  // İkinci Ligler
  9,    // Championship (İngiltere)
  565,  // La Liga 2 (İspanya)
  83,   // 2. Bundesliga (Almanya)
  302,  // Serie B (İtalya)
  385,  // Ligue 2 (Fransa)
  
  // Amerika
  462,  // MLS
  268,  // Brasileirão
  239,  // Argentina Primera
  273,  // Liga MX
  
  // Asya & Orta Doğu
  1659, // Saudi Pro League
  406,  // Japanese J1 League
  292,  // Korean K League
  636,  // Chinese Super League
  325,  // Australian A-League
  
  // Kupa Maçları
  24,   // FA Cup
  320,  // Copa del Rey
  529,  // DFB Pokal
  308,  // Coppa Italia
  19,   // Türkiye Kupası
];

interface MatchData {
  id: number;
  home: string;
  away: string;
  league: string;
  time: string;
  odds: {
    home: number;
    draw: number;
    away: number;
  };
}

// ============================================================================
// MAIN HANDLER
// ============================================================================

export async function GET(request: NextRequest) {
  const startTime = Date.now();
  
  try {
    console.log('\n' + '═'.repeat(70));
    console.log('🎯 DAILY COUPONS GENERATION CRON JOB');
    console.log('═'.repeat(70));

    const today = new Date().toISOString().split('T')[0];
    const supabase = getSupabaseAdmin();

    // Check if coupons already exist for today
    const { data: existing } = await supabase
      .from('daily_coupons')
      .select('id')
      .eq('date', today)
      .limit(1);

    if (existing && existing.length > 0) {
      console.log('⏭️ Coupons already exist for today');
      return NextResponse.json({ 
        success: true, 
        message: 'Coupons already exist for today',
        date: today 
      });
    }

    // Fetch today's matches from SportMonks
    console.log('📡 Fetching matches from SportMonks...');
    const matches = await fetchTodayMatches();
    
    if (matches.length < 1) {
      console.log(`❌ No matches found`);
      return NextResponse.json({ 
        success: false, 
        error: 'No matches found today',
        count: matches.length 
      }, { status: 400 });
    }
    
    // Minimum 3 maç yoksa bile devam et, mevcut maçlarla kupon oluştur
    const minPicks = Math.min(3, matches.length);

    console.log(`✅ Found ${matches.length} matches with odds`);

    // Generate coupons (use available matches, max 3)
    const pickCount = Math.min(3, matches.length);
    const safeCoupon = generateSafeCoupon(matches, today, pickCount);
    const riskyCoupon = generateRiskyCoupon(matches, today, pickCount);

    // Save to database
    const { error: safeError } = await supabase
      .from('daily_coupons')
      .insert(safeCoupon);

    if (safeError) {
      console.error('❌ Error saving safe coupon:', safeError);
    } else {
      console.log('✅ Safe coupon saved');
    }

    const { error: riskyError } = await supabase
      .from('daily_coupons')
      .insert(riskyCoupon);

    if (riskyError) {
      console.error('❌ Error saving risky coupon:', riskyError);
    } else {
      console.log('✅ Risky coupon saved');
    }

    const totalTime = Date.now() - startTime;

    console.log('\n' + '═'.repeat(70));
    console.log('✅ CRON JOB COMPLETED');
    console.log(`   📊 Matches analyzed: ${matches.length}`);
    console.log(`   💚 Safe coupon: ${safeCoupon.matches.length} picks, odds ${safeCoupon.total_odds.toFixed(2)}`);
    console.log(`   🔴 Risky coupon: ${riskyCoupon.matches.length} picks, odds ${riskyCoupon.total_odds.toFixed(2)}`);
    console.log(`   ⏱️ Time: ${totalTime}ms`);
    console.log('═'.repeat(70) + '\n');

    return NextResponse.json({
      success: true,
      date: today,
      stats: {
        matchesAnalyzed: matches.length,
        safeCoupon: {
          picks: safeCoupon.matches.length,
          totalOdds: safeCoupon.total_odds,
        },
        riskyCoupon: {
          picks: riskyCoupon.matches.length,
          totalOdds: riskyCoupon.total_odds,
        },
        duration: totalTime,
      },
    });

  } catch (error: any) {
    console.error('❌ CRON JOB ERROR:', error);
    return NextResponse.json({ 
      success: false, 
      error: error.message 
    }, { status: 500 });
  }
}

// ============================================================================
// FETCH TODAY'S MATCHES
// ============================================================================

async function fetchTodayMatches(): Promise<MatchData[]> {
  const today = new Date().toISOString().split('T')[0];
  const leagueFilter = SUPPORTED_LEAGUES.join(',');
  
  const url = `${SPORTMONKS_API}/fixtures/date/${today}?api_token=${API_TOKEN}&include=participants;league;odds&filters=fixtureLeagues:${leagueFilter}&per_page=50`;
  
  try {
    const response = await fetch(url, { 
      next: { revalidate: 0 },
      headers: { 'Accept': 'application/json' }
    });
    
    if (!response.ok) {
      console.error('SportMonks API error:', response.status);
      return [];
    }
    
    const data = await response.json();
    const fixtures = data.data || [];
    
    return fixtures.map((f: any) => {
      const home = f.participants?.find((p: any) => p.meta?.location === 'home');
      const away = f.participants?.find((p: any) => p.meta?.location === 'away');
      
      // Parse odds
      const odds = parseOdds(f);
      
      return {
        id: f.id,
        home: home?.name || 'Home',
        away: away?.name || 'Away',
        league: f.league?.name || 'Unknown',
        time: f.starting_at,
        odds,
      };
    }).filter((m: MatchData) => m.odds.home > 0 && m.odds.away > 0);
    
  } catch (error: any) {
    console.error('Error fetching matches:', error.message);
    return [];
  }
}

function parseOdds(fixture: any): { home: number; draw: number; away: number } {
  const defaultOdds = { home: 1.5, draw: 3.5, away: 2.5 };
  
  try {
    const oddsData = fixture.odds?.data || fixture.odds || [];
    
    // Find 1X2 market
    const market = oddsData.find((o: any) => 
      o.market_id === 1 || 
      o.name?.toLowerCase().includes('1x2') ||
      o.name?.toLowerCase().includes('match winner')
    );
    
    if (!market) return defaultOdds;
    
    const bookmakers = market.bookmaker?.data || market.bookmakers || [];
    const bookmaker = bookmakers[0];
    
    if (!bookmaker) return defaultOdds;
    
    const odds = bookmaker.odds?.data || bookmaker.odds || [];
    
    const homeOdd = odds.find((o: any) => o.label === '1' || o.name === 'Home')?.value;
    const drawOdd = odds.find((o: any) => o.label === 'X' || o.name === 'Draw')?.value;
    const awayOdd = odds.find((o: any) => o.label === '2' || o.name === 'Away')?.value;
    
    return {
      home: parseFloat(homeOdd) || defaultOdds.home,
      draw: parseFloat(drawOdd) || defaultOdds.draw,
      away: parseFloat(awayOdd) || defaultOdds.away,
    };
  } catch {
    return defaultOdds;
  }
}

// ============================================================================
// COUPON GENERATION LOGIC
// ============================================================================

function generateSafeCoupon(matches: MatchData[], date: string, pickCount: number = 3) {
  // Safe kupon: Düşük oranlı favoriler (1.20 - 1.80 arası)
  const safeMatches = matches
    .filter(m => {
      const minOdd = Math.min(m.odds.home, m.odds.away);
      return minOdd >= 1.15 && minOdd <= 1.80;
    })
    .sort((a, b) => {
      const aMin = Math.min(a.odds.home, a.odds.away);
      const bMin = Math.min(b.odds.home, b.odds.away);
      return aMin - bMin; // En düşük orandan başla
    })
    .slice(0, pickCount);

  // Eğer yeterli maç yoksa, tüm maçlardan en düşük oranlıları al
  if (safeMatches.length < pickCount) {
    const remaining = matches
      .filter(m => !safeMatches.includes(m))
      .sort((a, b) => {
        const aMin = Math.min(a.odds.home, a.odds.away);
        const bMin = Math.min(b.odds.home, b.odds.away);
        return aMin - bMin;
      })
      .slice(0, pickCount - safeMatches.length);
    safeMatches.push(...remaining);
  }

  const picks = safeMatches.map(m => {
    const selection = m.odds.home < m.odds.away ? '1' : '2';
    const odds = selection === '1' ? m.odds.home : m.odds.away;
    return {
      fixture_id: m.id,
      home_team: m.home,
      away_team: m.away,
      league: m.league,
      kick_off: m.time,
      selection,
      odds,
    };
  });

  const totalOdds = picks.reduce((acc, p) => acc * p.odds, 1);

  return {
    date,
    coupon_type: 'safe',
    matches: picks,
    total_odds: Math.round(totalOdds * 100) / 100,
    confidence: 75,
    suggested_stake: 100,
    potential_win: Math.round(100 * totalOdds),
    ai_reasoning: JSON.stringify({
      tr: `Güvenli kupon: ${picks.length} favori takım seçildi. Düşük oran, yüksek kazanma şansı.`,
      en: `Safe coupon: ${picks.length} favorite teams selected. Low odds, high winning chance.`,
      de: `Sicherer Tipp: ${picks.length} Favoriten ausgewählt. Niedrige Quote, hohe Gewinnchance.`,
    }),
    status: 'pending',
  };
}

function generateRiskyCoupon(matches: MatchData[], date: string, pickCount: number = 3) {
  // Risky kupon: Yüksek oranlı sürprizler veya beraberliker
  const riskyMatches = matches
    .filter(m => {
      // Beraberlik veya underdog tercihi
      const maxOdd = Math.max(m.odds.home, m.odds.away, m.odds.draw);
      return maxOdd >= 2.5;
    })
    .sort((a, b) => {
      const aMax = Math.max(a.odds.home, a.odds.away, a.odds.draw);
      const bMax = Math.max(b.odds.home, b.odds.away, b.odds.draw);
      return bMax - aMax; // En yüksek orandan başla
    })
    .slice(0, pickCount);

  // Eğer yeterli maç yoksa, beraberlikleri ekle
  if (riskyMatches.length < pickCount) {
    const draws = matches
      .filter(m => !riskyMatches.includes(m) && m.odds.draw >= 3.0)
      .slice(0, pickCount - riskyMatches.length);
    riskyMatches.push(...draws);
  }

  const picks = riskyMatches.map(m => {
    // En yüksek oran hangisiyse onu seç (sürpriz için)
    let selection: string;
    let odds: number;
    
    if (m.odds.draw >= m.odds.home && m.odds.draw >= m.odds.away) {
      selection = 'X';
      odds = m.odds.draw;
    } else if (m.odds.away > m.odds.home) {
      selection = '2';
      odds = m.odds.away;
    } else {
      selection = '1';
      odds = m.odds.home;
    }
    
    return {
      fixture_id: m.id,
      home_team: m.home,
      away_team: m.away,
      league: m.league,
      kick_off: m.time,
      selection,
      odds,
    };
  });

  const totalOdds = picks.reduce((acc, p) => acc * p.odds, 1);

  return {
    date,
    coupon_type: 'risky',
    matches: picks,
    total_odds: Math.round(totalOdds * 100) / 100,
    confidence: 25,
    suggested_stake: 20,
    potential_win: Math.round(20 * totalOdds),
    ai_reasoning: JSON.stringify({
      tr: `Riskli kupon: ${picks.length} sürpriz/beraberlik seçimi. Yüksek oran, yüksek kazanç potansiyeli!`,
      en: `Risky coupon: ${picks.length} surprise/draw picks. High odds, high profit potential!`,
      de: `Riskanter Tipp: ${picks.length} Überraschungen/Unentschieden. Hohe Quote, hohes Gewinnpotenzial!`,
    }),
    status: 'pending',
  };
}

// Also support POST for manual triggers
export async function POST(request: NextRequest) {
  return GET(request);
}

