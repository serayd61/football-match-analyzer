// Fresh stats - new endpoint
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  
  if (!supabaseUrl || !supabaseKey) {
    return NextResponse.json({ error: 'Missing credentials' }, { status: 500 });
  }
  
  const supabase = createClient(supabaseUrl, supabaseKey);
  
  const { data, error } = await supabase
    .from('unified_analysis')
    .select('fixture_id, home_team, is_settled, match_result_correct, over_under_correct, btts_correct')
    .order('fixture_id', { ascending: true });
  
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  
  const settled = (data || []).filter(r => r.is_settled === true);
  
  let mrCorrect = 0;
  let ouCorrect = 0;
  let bttsCorrect = 0;
  
  for (const m of settled) {
    if (m.match_result_correct === true) mrCorrect++;
    if (m.over_under_correct === true) ouCorrect++;
    if (m.btts_correct === true) bttsCorrect++;
  }
  
  const total = settled.length;
  
  // Show sample data with fixture_id
  const sampleData = settled.slice(0, 5).map(r => ({
    fixture_id: r.fixture_id,
    home_team: r.home_team,
    mr_correct: r.match_result_correct,
    ou_correct: r.over_under_correct,
    btts_correct: r.btts_correct
  }));
  
  return NextResponse.json({
    timestamp: new Date().toISOString(),
    total: data?.length || 0,
    settled: total,
    counts: { mrCorrect, ouCorrect, bttsCorrect },
    percentages: {
      mr: total > 0 ? Math.round((mrCorrect / total) * 100) : 0,
      ou: total > 0 ? Math.round((ouCorrect / total) * 100) : 0,
      btts: total > 0 ? Math.round((bttsCorrect / total) * 100) : 0
    },
    sampleData
  });
}

