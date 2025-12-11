// ============================================================================
// FOOTBALL ANALYTICS PRO - SONUÇ GÜNCELLEME API
// ============================================================================
// /api/update-results endpoint - Maç sonuçlarını günceller
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { updateMatchResult, prisma } from '@/lib/prediction-service';

export const dynamic = 'force-dynamic';

const SPORTMONKS_API_KEY = process.env.SPORTMONKS_API_KEY;

// ============================================================================
// TEK MAÇ SONUCU GÜNCELLE (Manuel)
// ============================================================================

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { fixtureId, homeTeamId, awayTeamId, matchDate, homeGoals, awayGoals } = body;
    
    if (homeGoals === undefined || awayGoals === undefined) {
      return NextResponse.json({
        success: false,
        error: 'homeGoals and awayGoals are required',
      }, { status: 400 });
    }
    
    const result = await updateMatchResult({
      fixtureId,
      homeTeamId,
      awayTeamId,
      matchDate: new Date(matchDate),
      homeGoals,
      awayGoals,
    });
    
    if (!result) {
      return NextResponse.json({
        success: false,
        error: 'No prediction found for this match',
      }, { status: 404 });
    }
    
    return NextResponse.json({
      success: true,
      message: 'Result updated successfully',
      data: {
        id: result.id,
        match: `${result.homeTeam} vs ${result.awayTeam}`,
        score: `${homeGoals}-${awayGoals}`,
        accuracy: {
          matchResult: result.matchResultCorrect,
          overUnder: result.overUnderCorrect,
          btts: result.bttsCorrect,
          bestBet: result.bestBetCorrect,
        },
      },
    });
  } catch (error: any) {
    console.error('Update result error:', error);
    return NextResponse.json({
      success: false,
      error: error.message,
    }, { status: 500 });
  }
}

// ============================================================================
// TÜM BEKLEYEN MAÇLARI OTOMATİK GÜNCELLE (Sportmonks'tan)
// ============================================================================

export async function PUT(request: NextRequest) {
  if (!SPORTMONKS_API_KEY) {
    return NextResponse.json({
      success: false,
      error: 'Sportmonks API key not configured',
    }, { status: 500 });
  }
  
  try {
    // Bekleyen tahminleri al
    const pendingPredictions = await prisma.prediction.findMany({
      where: { 
        status: 'pending',
        matchDate: {
          lt: new Date(), // Geçmiş maçlar
        },
      },
    });
    
    if (pendingPredictions.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No pending predictions to update',
        updated: 0,
      });
    }
    
    console.log(`📋 Found ${pendingPredictions.length} pending predictions to check`);
    
    const results = {
      updated: 0,
      notFinished: 0,
      errors: 0,
      details: [] as any[],
    };
    
    for (const prediction of pendingPredictions) {
      try {
        // Maç sonucunu Sportmonks'tan al
        let fixtureData = null;
        
        if (prediction.fixtureId) {
          // Fixture ID varsa direkt sorgula
          const url = `https://api.sportmonks.com/v3/football/fixtures/${prediction.fixtureId}?api_token=${SPORTMONKS_API_KEY}&include=scores`;
          const response = await fetch(url);
          
          if (response.ok) {
            const json = await response.json();
            fixtureData = json.data;
          }
        } else if (prediction.homeTeamId && prediction.awayTeamId) {
          // H2H'dan bugünün maçını bul
          const matchDateStr = prediction.matchDate.toISOString().split('T')[0];
          const url = `https://api.sportmonks.com/v3/football/fixtures/date/${matchDateStr}?api_token=${SPORTMONKS_API_KEY}&include=scores;participants`;
          const response = await fetch(url);
          
          if (response.ok) {
            const json = await response.json();
            const fixtures = json.data || [];
            
            // Bu takımların maçını bul
            fixtureData = fixtures.find((f: any) => {
              const participants = f.participants || [];
              const teamIds = participants.map((p: any) => p.id);
              return teamIds.includes(prediction.homeTeamId) && teamIds.includes(prediction.awayTeamId);
            });
          }
        }
        
        if (!fixtureData) {
          console.log(`⚠️ Fixture not found: ${prediction.homeTeam} vs ${prediction.awayTeam}`);
          results.errors++;
          continue;
        }
        
        // Maç durumunu kontrol et (5 = Finished)
        if (fixtureData.state_id !== 5) {
          console.log(`⏳ Match not finished: ${prediction.homeTeam} vs ${prediction.awayTeam}`);
          results.notFinished++;
          continue;
        }
        
        // Skoru bul
        const scores = fixtureData.scores || [];
        let homeGoals = 0, awayGoals = 0;
        
        // Participants'tan home/away belirle
        const participants = fixtureData.participants || [];
        const homeParticipant = participants.find((p: any) => p.meta?.location === 'home');
        const homeTeamIdInFixture = homeParticipant?.id;
        
        for (const score of scores) {
          if (score.description === 'CURRENT') {
            if (score.participant_id === homeTeamIdInFixture) {
              homeGoals = score.score?.goals ?? 0;
            } else {
              awayGoals = score.score?.goals ?? 0;
            }
          }
        }
        
        // Sonucu güncelle
        const updated = await updateMatchResult({
          fixtureId: fixtureData.id,
          homeTeamId: prediction.homeTeamId!,
          awayTeamId: prediction.awayTeamId!,
          matchDate: prediction.matchDate,
          homeGoals,
          awayGoals,
        });
        
        if (updated) {
          results.updated++;
          results.details.push({
            match: `${prediction.homeTeam} vs ${prediction.awayTeam}`,
            score: `${homeGoals}-${awayGoals}`,
            accuracy: {
              matchResult: updated.matchResultCorrect,
              overUnder: updated.overUnderCorrect,
              btts: updated.bttsCorrect,
            },
          });
        }
        
        // Rate limit için bekle
        await new Promise(resolve => setTimeout(resolve, 200));
        
      } catch (error: any) {
        console.error(`Error updating ${prediction.homeTeam} vs ${prediction.awayTeam}:`, error.message);
        results.errors++;
      }
    }
    
    console.log(`✅ Update complete: ${results.updated} updated, ${results.notFinished} not finished, ${results.errors} errors`);
    
    return NextResponse.json({
      success: true,
      message: `Updated ${results.updated} predictions`,
      ...results,
    });
    
  } catch (error: any) {
    console.error('Auto update error:', error);
    return NextResponse.json({
      success: false,
      error: error.message,
    }, { status: 500 });
  }
}
