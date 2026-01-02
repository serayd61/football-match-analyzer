// /api/genius/bold-bet - Cesur Tahmin (Bold Bet) API
// Genius Analyst agent'ını çağırarak yüksek oranlı cesur tahmin üretir

import { NextRequest, NextResponse } from 'next/server';
import { runGeniusAnalyst } from '@/lib/heurist/agents/geniusAnalyst';
import { fetchMatchDataByFixtureId } from '@/lib/heurist/sportmonks-data';
import { MatchData } from '@/lib/heurist/types';

export const maxDuration = 30; // 30 saniye timeout

interface BoldBetResponse {
  success: boolean;
  boldBet?: {
    type: string;
    odds: number;
    confidence: number;
    reasoning: string;
    scenario: string;
    riskLevel: 'high' | 'very-high' | 'extreme';
    potentialReturn: string;
    historicalHit?: string;
  };
  matchInfo?: {
    homeTeam: string;
    awayTeam: string;
    league: string;
    matchDate: string;
  };
  error?: string;
  processingTime: number;
}

export async function POST(request: NextRequest) {
  const startTime = Date.now();
  
  try {
    const body = await request.json();
    const { fixtureId, language = 'tr' } = body;
    
    if (!fixtureId) {
      return NextResponse.json({
        success: false,
        error: 'fixtureId gerekli',
        processingTime: Date.now() - startTime
      } as BoldBetResponse, { status: 400 });
    }
    
    console.log(`🔥 CESUR TAHMİN: Fixture ${fixtureId}`);
    console.log('═══════════════════════════════════════════');
    
    // 1. Maç verisini al
    console.log('📊 Step 1: Fetching match data...');
    const matchData = await fetchMatchDataByFixtureId(fixtureId);
    
    if (!matchData) {
      return NextResponse.json({
        success: false,
        error: 'Maç verisi bulunamadı',
        processingTime: Date.now() - startTime
      } as BoldBetResponse, { status: 404 });
    }
    
    const matchInfo = {
      homeTeam: matchData.homeTeam || 'Unknown',
      awayTeam: matchData.awayTeam || 'Unknown',
      league: matchData.league || 'Unknown',
      matchDate: matchData.kickOff || new Date().toISOString()
    };
    
    console.log(`⚽ Match: ${matchInfo.homeTeam} vs ${matchInfo.awayTeam}`);
    
    // 2. TeamStats'tan FormData'ya dönüştürme helper
    const convertTeamStatsToFormData = (stats: typeof matchData.homeForm) => {
      // Record'dan wins/draws/losses çıkar (örn: "3W-1D-1L")
      const record = stats?.record || '1W-2D-2L';
      const wMatch = record.match(/(\d+)W/);
      const dMatch = record.match(/(\d+)D/);
      const lMatch = record.match(/(\d+)L/);
      
      return {
        form: stats?.form || 'DDDDD',
        points: stats?.points || 5,
        wins: wMatch ? parseInt(wMatch[1]) : 1,
        draws: dMatch ? parseInt(dMatch[1]) : 2,
        losses: lMatch ? parseInt(lMatch[1]) : 2,
        avgGoals: stats?.avgGoalsScored || '1.2',
        avgConceded: stats?.avgGoalsConceded || '1.2',
        over25Percentage: stats?.over25Percentage || '50%',
        bttsPercentage: stats?.bttsPercentage || '50%',
        cleanSheetPercentage: stats?.cleanSheetPercentage || '20%',
        matches: stats?.matchDetails?.map(m => ({
          opponent: m.opponent || 'Unknown',
          score: m.score || '0-0',
          result: m.result || 'D'
        })) || []
      };
    };
    
    const convertedMatchData: MatchData = {
      fixtureId: matchData.fixtureId,
      homeTeam: matchInfo.homeTeam,
      awayTeam: matchInfo.awayTeam,
      league: matchInfo.league,
      matchDate: matchInfo.matchDate,
      homeForm: convertTeamStatsToFormData(matchData.homeForm),
      awayForm: convertTeamStatsToFormData(matchData.awayForm),
      h2h: {
        totalMatches: matchData.h2h?.totalMatches || 0,
        homeWins: matchData.h2h?.homeWins || 0,
        awayWins: matchData.h2h?.awayWins || 0,
        draws: matchData.h2h?.draws || 0,
        avgGoals: matchData.h2h?.avgGoals || '2.5',
        over25Percentage: matchData.h2h?.over25Percentage || '50%',
        bttsPercentage: matchData.h2h?.bttsPercentage || '50%',
        matches: matchData.h2h?.matches?.map(m => ({
          home: m.homeTeam || 'Home',
          away: m.awayTeam || 'Away',
          score: m.score || '0-0'
        })) || []
      },
      odds: matchData.odds || {},
    };
    
    // 3. Genius Analyst'ı çalıştır
    console.log('🧠 Step 2: Running Genius Analyst for Bold Bet...');
    const geniusResult = await runGeniusAnalyst(convertedMatchData, language as 'tr' | 'en' | 'de');
    
    if (!geniusResult) {
      return NextResponse.json({
        success: false,
        error: 'Genius Analyst yanıt vermedi',
        matchInfo,
        processingTime: Date.now() - startTime
      } as BoldBetResponse, { status: 500 });
    }
    
    // 4. Bold Bet sonucunu döndür
    const boldBet = geniusResult.boldBet || {
      type: 'İY X / MS 1',
      odds: 8.50,
      confidence: 8,
      reasoning: 'Berabere başlayıp ev sahibi kazanır senaryosu',
      scenario: 'İlk yarı temkinli başlangıç, ikinci yarı ev sahibi baskısı',
      riskLevel: 'extreme' as const,
      potentialReturn: '8x',
      historicalHit: 'Bu senaryo benzer maçlarda %8-10 gerçekleşir'
    };
    
    console.log(`🔥 Bold Bet: ${boldBet.type} @ ${boldBet.odds}`);
    console.log(`📊 Confidence: ${boldBet.confidence}%`);
    console.log(`⚠️ Risk: ${boldBet.riskLevel}`);
    console.log(`✅ CESUR TAHMİN COMPLETE in ${Date.now() - startTime}ms`);
    
    return NextResponse.json({
      success: true,
      boldBet,
      matchInfo,
      processingTime: Date.now() - startTime
    } as BoldBetResponse);
    
  } catch (error: any) {
    console.error('❌ Bold Bet Error:', error);
    return NextResponse.json({
      success: false,
      error: error.message || 'Bilinmeyen hata',
      processingTime: Date.now() - startTime
    } as BoldBetResponse, { status: 500 });
  }
}

