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
  
  // Get ALL records with is_settled values
  const { data, error } = await supabase
    .from('unified_analysis')
    .select('fixture_id, home_team, is_settled, actual_home_score, actual_away_score');
  
  // Count by is_settled
  const settledTrue = data?.filter(r => r.is_settled === true).length || 0;
  const settledFalse = data?.filter(r => r.is_settled === false).length || 0;
  const settledNull = data?.filter(r => r.is_settled === null).length || 0;
  
  return NextResponse.json({
    error: error?.message,
    records: data,
    counts: { settledTrue, settledFalse, settledNull }
  });
}

