// ============================================================================
// API: Kullanıcının kendi analiz geçmişi (dashboard "Analizlerim")
// user_analysis_history'den son analizleri döndürür — sadece oturum sahibinin
// kayıtları. Lig adı çözümsüz kalmışsa ("League X") katalogdan onarılır.
// ============================================================================

export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getCatalogMap, isUnresolvedLeagueName } from '@/lib/league-catalog';

let _sb: SupabaseClient | null = null;
function sb(): SupabaseClient {
  if (!_sb) {
    // no-store fetch: route handler içindeki Supabase GET'leri Next fetch
    // cache'ine takılmasın (bkz. email kampanyası mükerrer gönderim vakası).
    _sb = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        auth: { persistSession: false },
        global: { fetch: (i, init) => fetch(i, { ...init, cache: 'no-store' }) },
      },
    );
  }
  return _sb;
}

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  const email = session?.user?.email;
  if (!email) {
    return NextResponse.json(
      { ok: false, code: 'auth_required', analyses: [] },
      { status: 401 },
    );
  }

  const { searchParams } = new URL(request.url);
  const limit = Math.min(parseInt(searchParams.get('limit') || '30', 10) || 30, 100);

  const { data, error } = await sb()
    .from('user_analysis_history')
    .select('fixture_id, home_team, away_team, home_id, away_id, league, match_date, analyzed_at')
    .eq('email', email)
    .order('analyzed_at', { ascending: false })
    .limit(limit);

  if (error) {
    console.error('[me/analyses] error:', error.message);
    return NextResponse.json({ ok: false, error: error.message, analyses: [] }, { status: 500 });
  }

  const catalog = await getCatalogMap().catch(() => new Map());

  const analyses = (data || []).map((r: any) => {
    // league sütununda ad tutulur; id yoksa katalog eşleşmesi ad üzerinden yapılamaz,
    // bu yüzden yalnızca "League <id>" biçimindeki adlar id'siyle onarılır.
    let league = r.league || '';
    let leagueCcode = '';
    const m = /^League (\d+)$/.exec(String(league).trim());
    if (m) {
      const cat = catalog.get(Number(m[1]));
      if (cat) {
        if (isUnresolvedLeagueName(league)) league = cat.name;
        leagueCcode = cat.ccode || '';
      }
    }
    return {
      fixtureId: r.fixture_id,
      homeTeam: r.home_team,
      awayTeam: r.away_team,
      homeId: r.home_id,
      awayId: r.away_id,
      league,
      leagueCcode,
      matchDate: r.match_date,
      analyzedAt: r.analyzed_at,
    };
  });

  return NextResponse.json({ ok: true, count: analyses.length, analyses });
}
