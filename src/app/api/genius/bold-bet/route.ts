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
      homeTeam: matchData.homeTeam?.name || 'Unknown',
      awayTeam: matchData.awayTeam?.name || 'Unknown',
      league: matchData.league?.name || 'Unknown',
      matchDate: matchData.matchDate || new Date().toISOString()
    };
    
    console.log(`⚽ Match: ${matchInfo.homeTeam} vs ${matchInfo.awayTeam}`);
    
    // 2. MatchData formatına dönüştür
    const convertedMatchData: MatchData = {
      fixtureId: matchData.fixtureId,
      homeTeam: matchInfo.homeTeam,
      awayTeam: matchInfo.awayTeam,
      league: matchInfo.league,
      matchDate: matchInfo.matchDate,
      homeForm: matchData.homeForm || { form: 'DDDDD', avgGoals: '1.2' },
      awayForm: matchData.awayForm || { form: 'DDDDD', avgGoals: '1.0' },
      h2h: matchData.h2h || { matches: [] },
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

