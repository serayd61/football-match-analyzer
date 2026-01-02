// Check is_settled values in unified_analysis
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  
  if (!supabaseUrl || !supabaseKey) {
    return NextResponse.json({ error: 'No credentials' }, { status: 500 });
  }
  
  const supabase = createClient(supabaseUrl, supabaseKey);
  
  // Get ALL records with correctness values
  const { data, error } = await supabase
    .from('unified_analysis')
    .select('fixture_id, home_team, is_settled, match_result_correct, over_under_correct, btts_correct');
  
  // Count by is_settled
  const settledTrue = data?.filter(r => r.is_settled === true).length || 0;
  const settledFalse = data?.filter(r => r.is_settled === false).length || 0;
  
  // Count correct predictions for settled matches
  const settledMatches = data?.filter(r => r.is_settled === true) || [];
  const mrCorrect = settledMatches.filter(r => r.match_result_correct === true).length;
  const ouCorrect = settledMatches.filter(r => r.over_under_correct === true).length;
  const bttsCorrect = settledMatches.filter(r => r.btts_correct === true).length;
  
  // Detailed correctness analysis
  const mrTrue = settledMatches.filter(r => r.match_result_correct === true).length;
  const mrFalse = settledMatches.filter(r => r.match_result_correct === false).length;
  const mrNull = settledMatches.filter(r => r.match_result_correct === null).length;
  
  const ouTrue = settledMatches.filter(r => r.over_under_correct === true).length;
  const ouFalse = settledMatches.filter(r => r.over_under_correct === false).length;
  const ouNull = settledMatches.filter(r => r.over_under_correct === null).length;
  
  return NextResponse.json({
    error: error?.message,
    settledSample: settledMatches.slice(0, 5),
    counts: { 
      total: data?.length || 0,
      settledTrue, 
      settledFalse,
      mrCorrect,
      ouCorrect,
      bttsCorrect
    },
    detailedCounts: {
      mr: { true: mrTrue, false: mrFalse, null: mrNull },
      ou: { true: ouTrue, false: ouFalse, null: ouNull }
    }
  });
}

