// ============================================================================
// API: Recalculate Correctness for All Settled Matches
// Fixes incorrectly calculated match_result_correct, over_under_correct, btts_correct
// POST /api/performance/recalculate
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { serviceOnlyGuard } from '@/lib/api/dev-only';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

// Normalizasyon fonksiyonları (DÜZELTME: Daha kapsamlı ve sağlam)
function normalizeMR(val: string | null | undefined): string {
  if (!val) return '';
  const v = val.toLowerCase().trim();
  // Önce tam eşleşmeleri kontrol et (en yaygın formatlar)
  if (v === '1' || v === 'home' || v === 'ev sahibi' || v === 'home_win' || v === 'homewin') return '1';
  if (v === '2' || v === 'away' || v === 'deplasman' || v === 'away_win' || v === 'awaywin') return '2';
  if (v === 'x' || v === 'draw' || v === 'beraberlik' || v === 'tie' || v === 'd') return 'X';
  // Sonra içerik kontrolü (kelime sınırları ile daha güvenli)
  if (v.includes('home') && !v.includes('away')) return '1';
  if (v.includes('away') && !v.includes('home')) return '2';
  return v;
}

function normalizeOU(val: string | null | undefined): string {
  if (!val) return '';
  const v = val.toLowerCase().trim();
  if (v.includes('over') || v.includes('üst') || v === 'o') return 'over';
  if (v.includes('under') || v.includes('alt') || v === 'u') return 'under';
  return v;
}

function normalizeBTTS(val: string | null | undefined): string {
  if (!val) return '';
  const v = val.toLowerCase().trim();
  if (v === 'yes' || v === 'evet' || v === 'var' || v === 'y' || v === 'true') return 'yes';
  if (v === 'no' || v === 'hayır' || v === 'yok' || v === 'n' || v === 'false') return 'no';
  return v;
}

export async function POST(request: NextRequest) {
  const denied = serviceOnlyGuard(request);
  if (denied) return denied;
  try {
    console.log('🔄 Starting recalculation of correctness values...');
    
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    
    if (!supabaseUrl || !supabaseKey) {
      return NextResponse.json({ success: false, error: 'Missing credentials' }, { status: 500 });
    }
    
    const supabase = createClient(supabaseUrl, supabaseKey);
    
    // Tüm sonuçlanmış maçları al
    const { data: settledMatches, error: fetchError } = await supabase
      .from('unified_analysis')
      .select('*')
      .eq('is_settled', true);
    
    if (fetchError) {
      console.error('❌ Fetch error:', fetchError);
      return NextResponse.json({ success: false, error: fetchError.message }, { status: 500 });
    }
    
    if (!settledMatches || settledMatches.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No settled matches to recalculate',
        fixed: 0
      });
    }
    
    console.log(`📊 Recalculating ${settledMatches.length} settled matches...\n`);
    
    let fixedCount = 0;
    let alreadyCorrectCount = 0;
    const changes: any[] = [];
    
    for (const match of settledMatches) {
      // Gerçek sonuçları hesapla
      const homeScore = match.actual_home_score ?? 0;
      const awayScore = match.actual_away_score ?? 0;
      const totalGoals = homeScore + awayScore;
      
      const actualMR = homeScore > awayScore ? '1' : homeScore < awayScore ? '2' : 'X';
      const actualOU = totalGoals > 2.5 ? 'over' : 'under';
      const actualBtts = homeScore > 0 && awayScore > 0;
      
      // Tahminleri normalize et
      const predMR = normalizeMR(match.match_result_prediction);
      const predOU = normalizeOU(match.over_under_prediction);
      const predBTTS = normalizeBTTS(match.btts_prediction);
      
      // Yeni doğruluk değerlerini hesapla
      const newMRCorrect = predMR === actualMR;
      const newOUCorrect = predOU === actualOU;
      const newBTTSCorrect = (predBTTS === 'yes' && actualBtts) || (predBTTS === 'no' && !actualBtts);
      
      // Mevcut değerlerle karşılaştır
      const oldMRCorrect = match.match_result_correct;
      const oldOUCorrect = match.over_under_correct;
      const oldBTTSCorrect = match.btts_correct;
      
      // Değişiklik var mı kontrol et
      const mrChanged = oldMRCorrect !== newMRCorrect;
      const ouChanged = oldOUCorrect !== newOUCorrect;
      const bttsChanged = oldBTTSCorrect !== newBTTSCorrect;
      
      if (mrChanged || ouChanged || bttsChanged) {
        // Güncelle
        const { error: updateError } = await supabase
          .from('unified_analysis')
          .update({
            match_result_correct: newMRCorrect,
            over_under_correct: newOUCorrect,
            btts_correct: newBTTSCorrect,
            updated_at: new Date().toISOString()
          })
          .eq('fixture_id', match.fixture_id);
        
        if (!updateError) {
          fixedCount++;
          
          const change = {
            match: `${match.home_team} vs ${match.away_team}`,
            score: `${homeScore}-${awayScore}`,
            changes: [] as string[]
          };
          
          if (mrChanged) {
            change.changes.push(`MR: ${oldMRCorrect} → ${newMRCorrect} (pred: ${match.match_result_prediction}, actual: ${actualMR})`);
          }
          if (ouChanged) {
            change.changes.push(`O/U: ${oldOUCorrect} → ${newOUCorrect} (pred: ${match.over_under_prediction}, actual: ${actualOU})`);
          }
          if (bttsChanged) {
            change.changes.push(`BTTS: ${oldBTTSCorrect} → ${newBTTSCorrect} (pred: ${match.btts_prediction}, actual: ${actualBtts})`);
          }
          
          changes.push(change);
          console.log(`✅ Fixed: ${change.match} (${homeScore}-${awayScore})`);
          change.changes.forEach(c => console.log(`   ${c}`));
        }
      } else {
        alreadyCorrectCount++;
      }
    }
    
    console.log(`\n✅ Recalculation complete!`);
    console.log(`   Fixed: ${fixedCount}`);
    console.log(`   Already correct: ${alreadyCorrectCount}`);
    
    return NextResponse.json({
      success: true,
      message: `Recalculated ${settledMatches.length} matches`,
      fixed: fixedCount,
      alreadyCorrect: alreadyCorrectCount,
      total: settledMatches.length,
      changes
    });
    
  } catch (error: any) {
    console.error('❌ Recalculate API error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

// GET endpoint for easy browser testing
export async function GET() {
  return NextResponse.json({
    message: 'Use POST to recalculate correctness values for all settled matches',
    endpoint: '/api/performance/recalculate',
    description: 'This will fix incorrectly calculated match_result_correct, over_under_correct, and btts_correct values'
  });
}

