// ============================================================================
// API: Performance Trends
// GET /api/performance/trends
// - Daily/Weekly/Monthly performance trends
// - For charts and visualizations
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

interface DailyTrend {
  date: string;
  totalMatches: number;
  mrCorrect: number;
  mrAccuracy: number;
  ouCorrect: number;
  ouAccuracy: number;
  bttsCorrect: number;
  bttsAccuracy: number;
  overallAccuracy: number;
  avgConfidence: number;
}

interface WeeklyTrend {
  week: string;
  weekStart: string;
  weekEnd: string;
  totalMatches: number;
  mrAccuracy: number;
  ouAccuracy: number;
  bttsAccuracy: number;
  overallAccuracy: number;
}

export async function GET(request: NextRequest) {
  const startTime = Date.now();
  
  try {
    const { searchParams } = new URL(request.url);
    const period = searchParams.get('period') || 'daily'; // daily, weekly, monthly
    const days = parseInt(searchParams.get('days') || '30');

    console.log('📈 GET /api/performance/trends', { period, days });

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseKey) {
      return NextResponse.json({ success: false, error: 'Missing credentials' }, { status: 500 });
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Try materialized view first
    let dailyTrends: DailyTrend[] = [];
    
    const { data: mvData, error: mvError } = await supabase
      .from('mv_daily_performance_trends')
      .select('*')
      .order('match_day', { ascending: false })
      .limit(days);

    if (!mvError && mvData && mvData.length > 0) {
      // Use materialized view data
      dailyTrends = mvData.map(row => ({
        date: row.match_day,
        totalMatches: row.total_matches,
        mrCorrect: row.mr_correct,
        mrAccuracy: row.mr_accuracy,
        ouCorrect: row.ou_correct,
        ouAccuracy: row.ou_accuracy,
        bttsCorrect: row.btts_correct,
        bttsAccuracy: row.btts_accuracy,
        overallAccuracy: Math.round(((row.mr_accuracy + row.ou_accuracy + row.btts_accuracy) / 3) * 10) / 10,
        avgConfidence: row.avg_confidence
      }));
    } else {
      // Fallback: Calculate from analysis_performance
      console.log('⚠️ Trends materialized view not found, using fallback');
      
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - days);
      
      const { data: fallbackData } = await supabase
        .from('analysis_performance')
        .select('match_date, consensus_mr_correct, consensus_ou_correct, consensus_btts_correct, consensus_confidence')
        .eq('match_settled', true)
        .gte('match_date', cutoffDate.toISOString())
        .order('match_date', { ascending: false });

      if (fallbackData && fallbackData.length > 0) {
        // Group by date
        const dateMap = new Map<string, {
          total: number;
          mr: number;
          ou: number;
          btts: number;
          confSum: number;
        }>();

        for (const row of fallbackData) {
          if (!row.match_date) continue;
          
          const dateKey = new Date(row.match_date).toISOString().split('T')[0];
          
          if (!dateMap.has(dateKey)) {
            dateMap.set(dateKey, { total: 0, mr: 0, ou: 0, btts: 0, confSum: 0 });
          }
          
          const stats = dateMap.get(dateKey)!;
          stats.total++;
          if (row.consensus_mr_correct) stats.mr++;
          if (row.consensus_ou_correct) stats.ou++;
          if (row.consensus_btts_correct) stats.btts++;
          stats.confSum += row.consensus_confidence || 0;
        }

        dailyTrends = Array.from(dateMap.entries())
          .map(([date, stats]) => ({
            date,
            totalMatches: stats.total,
            mrCorrect: stats.mr,
            mrAccuracy: Math.round((stats.mr / stats.total) * 100 * 10) / 10,
            ouCorrect: stats.ou,
            ouAccuracy: Math.round((stats.ou / stats.total) * 100 * 10) / 10,
            bttsCorrect: stats.btts,
            bttsAccuracy: Math.round((stats.btts / stats.total) * 100 * 10) / 10,
            overallAccuracy: Math.round(((stats.mr + stats.ou + stats.btts) / (stats.total * 3)) * 100 * 10) / 10,
            avgConfidence: Math.round((stats.confSum / stats.total) * 10) / 10
          }))
          .sort((a, b) => b.date.localeCompare(a.date));
      }
    }

    // Calculate weekly trends from daily data
    const weeklyTrends: WeeklyTrend[] = [];
    if (period === 'weekly' || period === 'all') {
      const weekMap = new Map<string, {
        weekStart: string;
        weekEnd: string;
        total: number;
        mr: number;
        ou: number;
        btts: number;
      }>();

      for (const day of dailyTrends) {
        const date = new Date(day.date);
        const weekStart = new Date(date);
        weekStart.setDate(date.getDate() - date.getDay()); // Sunday
        const weekKey = weekStart.toISOString().split('T')[0];
        
        const weekEnd = new Date(weekStart);
        weekEnd.setDate(weekStart.getDate() + 6);

        if (!weekMap.has(weekKey)) {
          weekMap.set(weekKey, {
            weekStart: weekKey,
            weekEnd: weekEnd.toISOString().split('T')[0],
            total: 0,
            mr: 0,
            ou: 0,
            btts: 0
          });
        }

        const stats = weekMap.get(weekKey)!;
        stats.total += day.totalMatches;
        stats.mr += day.mrCorrect;
        stats.ou += day.ouCorrect;
        stats.btts += day.bttsCorrect;
      }

      for (const [week, stats] of weekMap.entries()) {
        if (stats.total > 0) {
          weeklyTrends.push({
            week,
            weekStart: stats.weekStart,
            weekEnd: stats.weekEnd,
            totalMatches: stats.total,
            mrAccuracy: Math.round((stats.mr / stats.total) * 100 * 10) / 10,
            ouAccuracy: Math.round((stats.ou / stats.total) * 100 * 10) / 10,
            bttsAccuracy: Math.round((stats.btts / stats.total) * 100 * 10) / 10,
            overallAccuracy: Math.round(((stats.mr + stats.ou + stats.btts) / (stats.total * 3)) * 100 * 10) / 10
          });
        }
      }

      weeklyTrends.sort((a, b) => b.week.localeCompare(a.week));
    }

    // Calculate cumulative stats
    const cumulativeStats = {
      totalMatches: dailyTrends.reduce((sum, d) => sum + d.totalMatches, 0),
      avgMrAccuracy: dailyTrends.length > 0 
        ? Math.round(dailyTrends.reduce((sum, d) => sum + d.mrAccuracy, 0) / dailyTrends.length * 10) / 10 
        : 0,
      avgOuAccuracy: dailyTrends.length > 0 
        ? Math.round(dailyTrends.reduce((sum, d) => sum + d.ouAccuracy, 0) / dailyTrends.length * 10) / 10 
        : 0,
      avgBttsAccuracy: dailyTrends.length > 0 
        ? Math.round(dailyTrends.reduce((sum, d) => sum + d.bttsAccuracy, 0) / dailyTrends.length * 10) / 10 
        : 0,
      avgOverallAccuracy: dailyTrends.length > 0 
        ? Math.round(dailyTrends.reduce((sum, d) => sum + d.overallAccuracy, 0) / dailyTrends.length * 10) / 10 
        : 0,
      bestDay: dailyTrends.length > 0 
        ? dailyTrends.reduce((best, d) => d.overallAccuracy > best.overallAccuracy ? d : best) 
        : null,
      worstDay: dailyTrends.length > 0 
        ? dailyTrends.reduce((worst, d) => d.overallAccuracy < worst.overallAccuracy ? d : worst) 
        : null
    };

    const processingTime = Date.now() - startTime;
    console.log(`📈 Trends completed in ${processingTime}ms`);

    const response = NextResponse.json({
      success: true,
      dailyTrends: dailyTrends.slice(0, days),
      weeklyTrends: weeklyTrends.slice(0, Math.ceil(days / 7)),
      cumulativeStats,
      processingTime,
      timestamp: new Date().toISOString()
    });

    // Cache for 5 minutes
    response.headers.set('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=600');

    return response;

  } catch (error: any) {
    console.error('❌ Trends API error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
