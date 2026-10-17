// ============================================================================
// API: SITE/SLIP — kullanıcı kuponundaki maçların skor/durumu (slip-1.0), üyelere.
// GET ?ids=1,2,3 (≤ 20) → { ok, results: { [fixtureId]: { homeScore, awayScore, settled, status } } }
// Yalnız okur; kupon istemcide (localStorage) durur, sunucu kupon tutmaz.
// ============================================================================
export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getSiteAccess, canSeeMatches } from '@/lib/site/access';
import { db } from '@/lib/site/db';
import { resolveOfficialVersion, officialFilter } from '@/lib/site/official';
import type { SlipResult } from '@/lib/site/slip-rule';

const noStore = { 'cache-control': 'private, no-store' };
const MAX_IDS = 20;

export async function GET(req: NextRequest) {
  const access = await getSiteAccess();
  if (!canSeeMatches(access)) return NextResponse.json({ ok: false, code: access.state === 'anon' ? 'auth_required' : 'membership_required' }, { status: access.state === 'anon' ? 401 : 403, headers: noStore });
  const ids = [...new Set((req.nextUrl.searchParams.get('ids') || '').split(',').map((s) => Number(s)).filter((n) => Number.isInteger(n) && n > 0))].slice(0, MAX_IDS);
  if (!ids.length) return NextResponse.json({ ok: true, results: {} }, { headers: noStore });
  try {
    const official = await resolveOfficialVersion();
    const { data, error } = await officialFilter(db().from('engine_predictions').select('fixture_id, home_score, away_score, settled, kickoff').in('fixture_id', ids), official).limit(ids.length * 4);
    if (error) throw new Error(error.message);
    const results: Record<number, SlipResult> = {};
    const now = Date.now();
    for (const r of (data ?? []) as any[]) {
      const id = Number(r.fixture_id);
      if (results[id]?.settled) continue;
      const settled = !!r.settled && r.home_score != null && r.away_score != null;
      const ko = Date.parse(String(r.kickoff));
      results[id] = { homeScore: r.home_score == null ? null : Number(r.home_score), awayScore: r.away_score == null ? null : Number(r.away_score), settled, status: settled ? 'finished' : Number.isFinite(ko) && ko <= now ? 'started' : 'scheduled' };
    }
    return NextResponse.json({ ok: true, results }, { headers: noStore });
  } catch (e) {
    console.error('[api/site/slip] failed', e);
    return NextResponse.json({ ok: false, code: 'internal_error' }, { status: 503, headers: noStore });
  }
}
