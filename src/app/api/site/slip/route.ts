// ============================================================================
// API: SITE/SLIP — kullanıcı kuponu (slip-1.0 skorlar · slip-2.0 sunucu kuponu), üyelere.
// GET ?ids=1,2,3 (≤ 20) → { ok, results: { [fixtureId]: { homeScore, awayScore, settled, status } } }
// GET ?mine=1          → { ok, legs: SlipLeg[] }  aktif bacaklar (site_slip_legs, removed_at null)
// PUT { legs }         → kuponun tamamını eşitle: yeni/değişen upsert, listede olmayan removed_at
// Tablo yoksa (migration bekliyor) mine/PUT { ok:false, code:'unavailable' } döner; istemci
// localStorage ile devam eder. Skor okuması site istemcisi (db), kupon okuma/yazma supabaseAdmin
// (kişiye özel; 5 dk'lık fetch önbelleğine girmesin).
// ============================================================================
export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getSiteAccess, canSeeMatches } from '@/lib/site/access';
import { db } from '@/lib/site/db';
import { supabaseAdmin } from '@/lib/supabase';
import { resolveOfficialVersion, officialFilter } from '@/lib/site/official';
import { isValidLeg, MAX_LEGS, type SlipLeg, type SlipResult } from '@/lib/site/slip-rule';
import { planSlipSync, rowToLeg, legToRow, type SlipRow } from '@/lib/site/slip-sync';

const noStore = { 'cache-control': 'private, no-store' };
const MAX_IDS = 20;
const TABLE = 'site_slip_legs';
const tableMissing = (msg: string | undefined) => !!msg && (/site_slip_legs/.test(msg) || /relation .* does not exist/.test(msg));

async function gate() {
  const access = await getSiteAccess();
  if (!canSeeMatches(access) || !access.email) {
    return { res: NextResponse.json({ ok: false, code: access.state === 'anon' ? 'auth_required' : 'membership_required' }, { status: access.state === 'anon' ? 401 : 403, headers: noStore }), email: null };
  }
  return { res: null, email: access.email.toLowerCase().trim() };
}

async function activeRows(email: string): Promise<{ rows: SlipRow[]; error: string | null }> {
  const { data, error } = await supabaseAdmin.from(TABLE).select('leg_key, fixture_id, market, selection, line, p, odds, home_name, away_name, league_label, kickoff, added_at, removed_at').eq('user_email', email).is('removed_at', null).order('added_at', { ascending: true }).limit(MAX_LEGS * 2);
  return { rows: (data ?? []) as SlipRow[], error: error?.message ?? null };
}

export async function GET(req: NextRequest) {
  const g = await gate();
  if (g.res) return g.res;

  if (req.nextUrl.searchParams.get('mine') === '1') {
    const { rows, error } = await activeRows(g.email!);
    if (error) {
      if (!tableMissing(error)) console.error('[api/site/slip] read failed', error);
      return NextResponse.json({ ok: false, code: tableMissing(error) ? 'unavailable' : 'internal_error' }, { status: 503, headers: noStore });
    }
    const legs = rows.map(rowToLeg).filter((l): l is SlipLeg => !!l).slice(0, MAX_LEGS);
    return NextResponse.json({ ok: true, legs }, { headers: noStore });
  }

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

export async function PUT(req: NextRequest) {
  const g = await gate();
  if (g.res) return g.res;
  const email = g.email!;
  const body = await req.json().catch(() => null);
  const raw: unknown[] = Array.isArray(body?.legs) ? body.legs : [];
  if (!Array.isArray(body?.legs) || raw.length > MAX_LEGS * 2) return NextResponse.json({ ok: false, code: 'bad_request' }, { status: 400, headers: noStore });
  const legs = raw.filter(isValidLeg);

  const { rows, error } = await activeRows(email);
  if (error) {
    if (!tableMissing(error)) console.error('[api/site/slip] read failed', error);
    return NextResponse.json({ ok: false, code: tableMissing(error) ? 'unavailable' : 'internal_error' }, { status: 503, headers: noStore });
  }
  const plan = planSlipSync(rows.map((r) => r.leg_key), legs);
  const nowIso = new Date().toISOString();
  const writes: Array<PromiseLike<{ error: { message: string } | null }>> = [];
  if (plan.upserts.length) writes.push(supabaseAdmin.from(TABLE).upsert(plan.upserts.map((l) => legToRow(email, l)), { onConflict: 'user_email,leg_key' }));
  if (plan.removeKeys.length) writes.push(supabaseAdmin.from(TABLE).update({ removed_at: nowIso }).eq('user_email', email).is('removed_at', null).in('leg_key', plan.removeKeys));
  const results = await Promise.all(writes);
  const wErr = results.find((r) => r.error)?.error;
  if (wErr) {
    console.error('[api/site/slip] write failed', wErr.message);
    return NextResponse.json({ ok: false, code: 'internal_error' }, { status: 503, headers: noStore });
  }
  return NextResponse.json({ ok: true, n: plan.upserts.length, removed: plan.removeKeys.length }, { headers: noStore });
}
