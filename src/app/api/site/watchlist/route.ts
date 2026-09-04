// ============================================================================
// API: SITE/WATCHLIST — followed clubs of the signed-in user (new dashboard).
// GET    → { ok, items: [{ teamId, teamName, leagueSlug }] }
// POST   { teamId, teamName, leagueSlug? } → add (idempotent, max 30)
// DELETE { teamId } → remove
// Table: site_watchlist (src/lib/supabase/migrations/create_site_watchlist.sql)
// ============================================================================
export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { z } from 'zod';
import { authOptions } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';

const MAX_ITEMS = 30;

async function email(): Promise<string | null> {
  const session = await getServerSession(authOptions);
  return session?.user?.email || null;
}

function tableMissing(msg: string | undefined): boolean {
  return !!msg && (/site_watchlist/.test(msg) || /relation .* does not exist/.test(msg));
}

export async function GET() {
  const who = await email();
  if (!who) return NextResponse.json({ ok: false, code: 'auth_required' }, { status: 401 });
  const { data, error } = await supabaseAdmin
    .from('site_watchlist')
    .select('team_id, team_name, league_slug')
    .eq('user_email', who)
    .order('created_at', { ascending: true });
  if (error) {
    return NextResponse.json({ ok: false, code: tableMissing(error.message) ? 'unavailable' : 'internal_error' }, { status: 503 });
  }
  return NextResponse.json({
    ok: true,
    items: (data || []).map((r: any) => ({ teamId: Number(r.team_id), teamName: r.team_name, leagueSlug: r.league_slug ?? null })),
  });
}

const AddBody = z.object({
  teamId: z.coerce.number().int().positive(),
  teamName: z.string().trim().min(1).max(80),
  leagueSlug: z.string().trim().max(60).nullable().optional(),
});

export async function POST(req: NextRequest) {
  const who = await email();
  if (!who) return NextResponse.json({ ok: false, code: 'auth_required' }, { status: 401 });
  const body = AddBody.safeParse(await req.json().catch(() => null));
  if (!body.success) return NextResponse.json({ ok: false, code: 'bad_request' }, { status: 400 });

  const { count } = await supabaseAdmin
    .from('site_watchlist')
    .select('id', { count: 'exact', head: true })
    .eq('user_email', who);
  if ((count ?? 0) >= MAX_ITEMS) return NextResponse.json({ ok: false, code: 'limit' }, { status: 409 });

  const { error } = await supabaseAdmin
    .from('site_watchlist')
    .upsert(
      { user_email: who, team_id: body.data.teamId, team_name: body.data.teamName, league_slug: body.data.leagueSlug ?? null },
      { onConflict: 'user_email,team_id' },
    );
  if (error) {
    return NextResponse.json({ ok: false, code: tableMissing(error.message) ? 'unavailable' : 'internal_error' }, { status: 503 });
  }
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  const who = await email();
  if (!who) return NextResponse.json({ ok: false, code: 'auth_required' }, { status: 401 });
  const body = z.object({ teamId: z.coerce.number().int().positive() }).safeParse(await req.json().catch(() => null));
  if (!body.success) return NextResponse.json({ ok: false, code: 'bad_request' }, { status: 400 });
  const { error } = await supabaseAdmin
    .from('site_watchlist')
    .delete()
    .eq('user_email', who)
    .eq('team_id', body.data.teamId);
  if (error) {
    return NextResponse.json({ ok: false, code: tableMissing(error.message) ? 'unavailable' : 'internal_error' }, { status: 503 });
  }
  return NextResponse.json({ ok: true });
}
