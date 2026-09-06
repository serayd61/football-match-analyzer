// ============================================================================
// ADMIN — motor sürümleri: öner / aktive et / emekli et (middleware korur)
//   GET  → sürümler + son 8 haftanın eşleştirilmiş karşılaştırması + kapı kararı
//   POST { action: 'propose', version, kind, params, note }          → candidate/shadow
//   POST { action: 'shadow'|'candidate', version, note }              → durum değiştir
//   POST { action: 'activate', version, note, force? }               → kapı SUNUCUDA zorlanır
//   POST { action: 'retire', version, note }
// Her işlem engine_learning_log'a yazılır (actor = admin e-postası ya da 'admin:secret').
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { z } from 'zod';
import { pairedFromSums, promotionVerdict, PROMOTION_GATE, type PairedStats } from '@/lib/engine/gate';
import { invalidateOfficialCache } from '@/lib/site/official';

export const dynamic = 'force-dynamic';

function sb() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false },
    global: { fetch: (i, init) => fetch(i, { ...init, cache: 'no-store' }) },
  });
}

function actorOf(req: NextRequest): string {
  // middleware oturum e-postasını header'a koymaz; en iyi çaba: Bearer → 'admin:secret'
  const email = req.headers.get('x-admin-email') || req.cookies.get('admin_email')?.value;
  return email ? `admin:${email}` : 'admin:secret';
}

const PAIR_WEEKS = 8;

async function comparisons(client: ReturnType<typeof sb>) {
  const { data } = await client
    .from('engine_version_pairs')
    .select('iso_year, iso_week, version_a, version_b, market, n, sum_d, sum_d2, acc_a, acc_b')
    .order('iso_year', { ascending: false }).order('iso_week', { ascending: false })
    .limit(600);
  const rows = (data || []) as any[];
  if (!rows.length) return [];
  const weeks = [...new Set(rows.map((r) => r.iso_year * 100 + r.iso_week))].sort((a, b) => b - a).slice(0, PAIR_WEEKS);
  const keep = new Set(weeks);
  const win = rows.filter((r) => keep.has(r.iso_year * 100 + r.iso_week));
  const keys = [...new Set(win.map((r) => `${r.version_a}|${r.version_b}`))];
  return keys.map((k) => {
    const [a, b] = k.split('|');
    const per: Record<string, (PairedStats & { weeks: number; accA: number; accB: number }) | null> = {};
    for (const m of ['1x2', 'ou25', 'btts']) {
      const rs = win.filter((r) => r.version_a === a && r.version_b === b && r.market === m);
      const n = rs.reduce((s, r) => s + Number(r.n), 0);
      const st = pairedFromSums(n, rs.reduce((s, r) => s + Number(r.sum_d), 0), rs.reduce((s, r) => s + Number(r.sum_d2), 0));
      per[m] = st ? { ...st, weeks: new Set(rs.map((r) => r.iso_year * 100 + r.iso_week)).size, accA: rs.reduce((s, r) => s + Number(r.acc_a), 0), accB: rs.reduce((s, r) => s + Number(r.acc_b), 0) } : null;
    }
    const verdict = promotionVerdict({ weeks: per['1x2']?.weeks ?? 0, primary: per['1x2'], secondary: [per.ou25, per.btts] });
    return { versionA: a, versionB: b, window: PAIR_WEEKS, markets: per, verdict, gate: PROMOTION_GATE };
  });
}

export async function GET() {
  const client = sb();
  const [{ data: versions, error }, cmp, { data: log }] = await Promise.all([
    client.from('engine_model_versions').select('*').order('created_at'),
    comparisons(client),
    client.from('engine_learning_log').select('*').in('layer', ['version', 'params']).order('occurred_at', { ascending: false }).limit(50),
  ]);
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, versions: versions || [], comparisons: cmp, log: log || [] });
}

const Params = z.object({
  kind: z.enum(['goals', 'xg']).optional(),
  half_life_days: z.number().int().min(30).max(1500).optional(),
  window_days: z.number().int().min(90).max(3000).optional(),
  rho: z.number().min(-0.5).max(0.5).optional(),
  iters: z.number().int().min(5).max(200).optional(),
  min_matches: z.number().int().min(20).max(5000).optional(),
  shrink_k: z.number().min(0).max(50).optional(),
  min_team_matches: z.number().min(0).max(40).optional(),
  xg_weight: z.number().min(0).max(1).optional(),
  xg_min_coverage: z.number().min(0).max(1).optional(),
  leagues: z.record(z.string().regex(/^\d+$/), z.record(z.unknown())).optional(),
}).strict();

const Body = z.discriminatedUnion('action', [
  z.object({ action: z.literal('propose'), version: z.string().regex(/^[a-z0-9][a-z0-9._-]*$/i).max(40), kind: z.enum(['goals', 'xg']).default('goals'), params: Params.default({}), status: z.enum(['candidate', 'shadow']).default('candidate'), note: z.string().max(2000).optional(), evidence: z.record(z.unknown()).optional() }),
  z.object({ action: z.literal('candidate'), version: z.string(), note: z.string().max(2000).optional() }),
  z.object({ action: z.literal('shadow'), version: z.string(), note: z.string().max(2000).optional() }),
  z.object({ action: z.literal('activate'), version: z.string(), note: z.string().max(2000).optional(), force: z.boolean().optional() }),
  z.object({ action: z.literal('retire'), version: z.string(), note: z.string().max(2000).optional() }),
]);

export async function POST(request: NextRequest) {
  let raw: unknown;
  try { raw = await request.json(); } catch { return NextResponse.json({ ok: false, error: 'invalid JSON' }, { status: 400 }); }
  const parsed = Body.safeParse(raw);
  if (!parsed.success) return NextResponse.json({ ok: false, error: parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ') }, { status: 400 });
  const body = parsed.data;
  const client = sb();
  const actor = actorOf(request);
  const now = new Date().toISOString();

  const { data: existing } = await client.from('engine_model_versions').select('*').eq('version', body.version).maybeSingle();

  if (body.action === 'propose') {
    if (existing) return NextResponse.json({ ok: false, error: `version ${body.version} already exists (${existing.status})` }, { status: 409 });
    const row = { version: body.version, status: body.status, kind: body.kind, params: { kind: body.kind, ...body.params }, notes: body.note ?? null, evidence: body.evidence ?? null, updated_at: now };
    const { error } = await client.from('engine_model_versions').insert(row);
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    await client.from('engine_learning_log').insert({ layer: 'params', action: 'propose', subject: body.version, after: row, evidence: body.evidence ?? null, actor, note: body.note ?? null });
    return NextResponse.json({ ok: true, version: row });
  }

  if (!existing) return NextResponse.json({ ok: false, error: `unknown version ${body.version}` }, { status: 404 });

  if (body.action === 'candidate' || body.action === 'shadow') {
    if (existing.status === 'active') return NextResponse.json({ ok: false, error: 'retire the active version via a new activation, not by demoting it' }, { status: 409 });
    const { error } = await client.from('engine_model_versions').update({ status: body.action, updated_at: now, retired_at: null }).eq('version', body.version);
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    await client.from('engine_learning_log').insert({ layer: 'version', action: 'approve', subject: body.version, before: { status: existing.status }, after: { status: body.action }, actor, note: body.note ?? null });
    return NextResponse.json({ ok: true, version: body.version, status: body.action });
  }

  if (body.action === 'retire') {
    if (existing.status === 'active') return NextResponse.json({ ok: false, error: 'cannot retire the active version; activate another one first' }, { status: 409 });
    const { error } = await client.from('engine_model_versions').update({ status: 'retired', retired_at: now, updated_at: now }).eq('version', body.version);
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    await client.from('engine_learning_log').insert({ layer: 'version', action: 'retire', subject: body.version, before: { status: existing.status }, after: { status: 'retired' }, actor, note: body.note ?? null });
    return NextResponse.json({ ok: true, version: body.version, status: 'retired' });
  }

  // --- activate: kapı sunucuda ---
  const { data: activeRow } = await client.from('engine_model_versions').select('version').eq('status', 'active').maybeSingle();
  const current = activeRow?.version ?? null;
  if (current === body.version) return NextResponse.json({ ok: true, version: body.version, status: 'active', note: 'already active' });

  const cmp = await comparisons(client);
  const pair = current ? cmp.find((c) => c.versionA === current && c.versionB === body.version) ?? null : null;
  const verdict = pair ? pair.verdict : { pass: false, reasons: [current ? `no paired weeks between ${current} and ${body.version}` : 'no active version to compare against'] };

  if (!verdict.pass && !body.force) {
    return NextResponse.json({ ok: false, error: 'promotion gate not passed', verdict, comparison: pair, hint: 'pass force:true with a note to override (logged)' }, { status: 409 });
  }
  if (!verdict.pass && body.force && !(body.note && body.note.trim().length >= 10)) {
    return NextResponse.json({ ok: false, error: 'force requires a note (≥10 chars) explaining why the gate is bypassed' }, { status: 400 });
  }

  // Tek aktif: eskisini 'retired'? Hayır — eski aktif 'shadow'a düşer (geri alma için sonuç üretmeye devam eder).
  if (current) {
    const { error: e1 } = await client.from('engine_model_versions').update({ status: 'shadow', updated_at: now }).eq('version', current);
    if (e1) return NextResponse.json({ ok: false, error: e1.message }, { status: 500 });
  }
  const { error: e2 } = await client.from('engine_model_versions').update({ status: 'active', activated_at: now, updated_at: now, retired_at: null, evidence: pair ? { comparison: pair, verdict, forced: !verdict.pass } : existing.evidence }).eq('version', body.version);
  if (e2) {
    if (current) await client.from('engine_model_versions').update({ status: 'active', updated_at: now }).eq('version', current); // geri al
    return NextResponse.json({ ok: false, error: e2.message }, { status: 500 });
  }
  await client.from('engine_learning_log').insert({
    layer: 'version', action: 'activate', subject: body.version,
    before: { active: current }, after: { active: body.version, previous: current ? 'shadow' : null },
    evidence: { comparison: pair, verdict, forced: !verdict.pass }, actor, note: body.note ?? null,
  });
  await invalidateOfficialCache();
  return NextResponse.json({ ok: true, version: body.version, status: 'active', previous: current, verdict, forced: !verdict.pass });
}
