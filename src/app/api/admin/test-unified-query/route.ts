// Test query on unified_analysis
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    
    if (!supabaseUrl || !supabaseKey) {
      return NextResponse.json({ error: 'No credentials' }, { status: 500 });
    }
    
    // Create fresh client each time
    const supabase = createClient(supabaseUrl, supabaseKey);
    
    // Simple count query
    const { count: totalCount, error: countError } = await supabase
      .from('unified_analysis')
      .select('*', { count: 'exact', head: true });
    
    // Full query without filters
    const { data, error, count } = await supabase
      .from('unified_analysis')
      .select('fixture_id, home_team, away_team, created_at', { count: 'exact' })
      .order('created_at', { ascending: false })
      .limit(50);
    
    return NextResponse.json({
      totalCount,
      countError: countError?.message,
      queryCount: count,
      queryError: error?.message,
      dataLength: data?.length || 0,
      records: data?.slice(0, 5) || []
    });
    
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

