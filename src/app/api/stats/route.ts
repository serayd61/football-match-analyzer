// src/app/api/stats/route.ts
// Performans istatistiklerini döndürür

export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type') || 'overall';

    const supabase = getSupabaseAdmin();

    // Tüm bitmiş tahminleri çek
    const { data: predictions, error } = await supabase
      .from('predictions')
      .select('*')
      .eq('match_finished', true);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (!predictions || predictions.length === 0) {
      return NextResponse.json({
        success: true,
        data: {
          overall: {
            total: 0,
            matchResult: { correct: 0, total: 0, accuracy: 0 },
            overUnder: { correct: 0, total: 0, accuracy: 0 },
            btts: { correct: 0, total: 0, accuracy: 0 },
          },
          message: 'No finished predictions yet',
        },
      });
    }

    const total = predictions.length;

    // Match Result accuracy
    const matchResultPredictions = predictions.filter(p => p.final_match_result_correct !== null);
    const matchResultCorrect = matchResultPredictions.filter(p => p.final_match_result_correct === true).length;

    // Over/Under accuracy
    const overUnderPredictions = predictions.filter(p => p.final_over_under_correct !== null);
    const overUnderCorrect = overUnderPredictions.filter(p => p.final_over_under_correct === true).length;

    // BTTS accuracy
    const bttsPredictions = predictions.filter(p => p.final_btts_correct !== null);
    const bttsCorrect = bttsPredictions.filter(p => p.final_btts_correct === true).length;

    // Lig bazlı performans
    const leagueStats: Record<string, { total: number; overUnder: number; matchResult: number; btts: number }> = {};
    predictions.forEach(p => {
      const league = p.league || 'Unknown';
      if (!leagueStats[league]) {
        leagueStats[league] = { total: 0, overUnder: 0, matchResult: 0, btts: 0 };
      }
      leagueStats[league].total++;
      if (p.final_over_under_correct === true) leagueStats[league].overUnder++;
      if (p.final_match_result_correct === true) leagueStats[league].matchResult++;
      if (p.final_btts_correct === true) leagueStats[league].btts++;
    });

    const leaguePerformance = Object.entries(leagueStats)
      .map(([league, stats]) => ({
        league,
        total: stats.total,
        overUnderAccuracy: stats.total > 0 ? Math.round((stats.overUnder / stats.total) * 100) : 0,
        matchResultAccuracy: stats.total > 0 ? Math.round((stats.matchResult / stats.total) * 100) : 0,
        bttsAccuracy: stats.total > 0 ? Math.round((stats.btts / stats.total) * 100) : 0,
      }))
      .sort((a, b) => b.total - a.total);

    const calcAccuracy = (correct: number, total: number) => 
      total > 0 ? Math.round((correct / total) * 100) : 0;

    return NextResponse.json({
      success: true,
      data: {
        overall: {
          total,
          matchResult: {
            correct: matchResultCorrect,
            total: matchResultPredictions.length,
            accuracy: calcAccuracy(matchResultCorrect, matchResultPredictions.length),
          },
          overUnder: {
            correct: overUnderCorrect,
            total: overUnderPredictions.length,
            accuracy: calcAccuracy(overUnderCorrect, overUnderPredictions.length),
          },
          btts: {
            correct: bttsCorrect,
            total: bttsPredictions.length,
            accuracy: calcAccuracy(bttsCorrect, bttsPredictions.length),
          },
        },
        leaguePerformance,
      },
    });

  } catch (error: any) {
    console.error('Stats error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
```

---

## Klasör Yapısı
```
src/app/api/
├── update-results/
│   └── route.ts      ← Yukarıdaki 1. dosya
├── stats/
│   └── route.ts      ← Yukarıdaki 2. dosya
└── ... (diğer api klasörleri)
