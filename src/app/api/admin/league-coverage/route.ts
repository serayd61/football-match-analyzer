// ============================================================================
// ADMIN — kapsam sicili: liste + bekleyen öneriler; durum/kademe kararı (middleware korur)
//   GET                                              → satırlar + son 60 günlük coverage günlüğü
//   POST { action: 'set', leagueId, status, tier?, reason?, note?, reviewAt? } → karar (log: approve)
//   POST { action: 'reject', leagueId, note }        → öneriyi reddet (log: reject; satır değişmez)
//   POST { action: 'refresh' }                        → sicili şimdi yenile (istatistik + öneri)
// ============================================================================
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { z } from 'zod';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { refreshCoverage } from '@/lib/coverage/refresh';
import { invalidateCoverage } from '@/lib/coverage/registry';

export const dynamic = 'force-dynamic';
export const maxDuration = 120;

function sb() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false },
    global: { fetch: (i, init) => fetch(i, { ...init, cache: 'no-store' }) },
  });
}
async function actorOf(): Promise<string> {
  const email = (await getServerSession(authOptions).catch(() => null))?.user?.email;
  return email ? `admin:${email}` : 'admin:secret';
}

export async function GET() {
  const client = sb();
  const since = new Date(Date.now() - 60 * 86_400_000).toISOString();
  const [{ data: rows, error }, { data: log }] = await Promise.all([
    client.from('league_coverage').select('*').order('status').order('tier').order('name'),
    client.from('engine_learning_log').select('*').eq('layer', 'coverage').gte('occurred_at', since).order('occurred_at', { ascending: false }).limit(200),
  ]);
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  const decided = new Set((log ?? []).filter((l: any) => l.action !== 'propose').map((l: any) => `${l.subject}|${l.evidence?.proposalType ?? l.after?.type ?? ''}`));
  const pending = (log ?? []).filter((l: any) => l.action === 'propose' && !decided.has(`${l.subject}|${l.after?.type ?? ''}`));
  return NextResponse.json({ ok: true, leagues: rows ?? [], pending, log: log ?? [] });
}

const Body = z.discriminatedUnion('action', [
  z.object({ action: z.literal('set'), leagueId: z.number().int(), status: z.enum(['whitelist', 'observe', 'excluded']), tier: z.number().int().min(0).max(9).optional(), reason: z.string().max(500).optional(), note: z.string().max(2000).optional(), reviewAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional() }),
  z.object({ action: z.literal('reject'), leagueId: z.number().int(), proposalType: z.enum(['promote', 'demote', 'watch']).optional(), note: z.string().max(2000).optional() }),
  z.object({ action: z.literal('refresh') }),
]);

export async function POST(request: NextRequest) {
  let raw: unknown;
  try { raw = await request.json(); } catch { return NextResponse.json({ ok: false, error: 'invalid JSON' }, { status: 400 }); }
  const parsed = Body.safeParse(raw);
  if (!parsed.success) return NextResponse.json({ ok: false, error: parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ') }, { status: 400 });
  const body = parsed.data;
  const client = sb();
  const actor = await actorOf();
  const now = new Date().toISOString();

  if (body.action === 'refresh') {
    const r = await refreshCoverage(client);
    invalidateCoverage();
    return NextResponse.json({ ok: true, ...r });
  }

  const { data: existing } = await client.from('league_coverage').select('*').eq('league_id', body.leagueId).maybeSingle();
  if (!existing) return NextResponse.json({ ok: false, error: 'league not in registry (run refresh first)' }, { status: 404 });
  const subject = `league:${body.leagueId}`;

  if (body.action === 'reject') {
    await client.from('engine_learning_log').insert({ layer: 'coverage', action: 'reject', subject, before: { status: existing.status }, after: { status: existing.status }, evidence: { league: existing.name, proposalType: body.proposalType ?? null }, actor, note: body.note ?? null });
    return NextResponse.json({ ok: true, leagueId: body.leagueId, status: existing.status });
  }

  const patch: any = { status: body.status, decided_at: now, decided_by: actor, updated_at: now };
  if (body.tier != null) patch.tier = body.tier;
  if (body.reason) patch.reason = body.reason;
  if (body.reviewAt) patch.review_at = body.reviewAt;
  const { error } = await client.from('league_coverage').update(patch).eq('league_id', body.leagueId);
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  await client.from('engine_learning_log').insert({ layer: 'coverage', action: 'approve', subject, before: { status: existing.status, tier: existing.tier }, after: { status: body.status, tier: patch.tier ?? existing.tier }, evidence: { league: existing.name, stats: existing.stats ?? null }, actor, note: body.note ?? body.reason ?? null });
  invalidateCoverage();
  return NextResponse.json({ ok: true, leagueId: body.leagueId, status: body.status, tier: patch.tier ?? existing.tier });
}
