// ============================================================================
// ADMIN — haftalık rapor + öğrenme günlüğü (middleware /api/admin/* korur:
// admin e-posta oturumu ya da Bearer ADMIN_SECRET/CRON_SECRET)
//   GET  ?week=2026-W36            → summary, metrics (tüm sürüm/lig), pairs, log
//   GET  (haftasız)                → son 12 rapor özeti + son 50 günlük kaydı
//   POST { action:'recompute', week } → computeWeek + buildReport (idempotent)
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { computeWeek, buildReport } from '@/lib/engine/weekly';
import { parseIsoWeek, previousIsoWeek } from '@/lib/engine/scoring';

export const dynamic = 'force-dynamic';
export const maxDuration = 120;

function sb() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false },
    global: { fetch: (i, init) => fetch(i, { ...init, cache: 'no-store' }) },
  });
}

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const weekParam = url.searchParams.get('week');
  const client = sb();

  if (!weekParam) {
    const [{ data: reports }, { data: log }] = await Promise.all([
      client.from('engine_weekly_reports').select('iso_year, iso_week, generated_at, summary').order('iso_year', { ascending: false }).order('iso_week', { ascending: false }).limit(12),
      client.from('engine_learning_log').select('*').order('occurred_at', { ascending: false }).limit(50),
    ]);
    return NextResponse.json({
      ok: true,
      reports: (reports || []).map((r: any) => ({
        week: r.summary?.week, generatedAt: r.generated_at, quality: r.summary?.quality, markets: r.summary?.markets, benchmark: r.summary?.benchmark,
        alerts: r.summary?.alerts ?? [], proposals: r.summary?.proposals ?? [],
      })),
      log: log || [],
    });
  }

  const key = parseIsoWeek(weekParam);
  if (!key) return NextResponse.json({ ok: false, error: 'week must be YYYY-Www' }, { status: 400 });

  const [{ data: report }, { data: metrics }, { data: pairs }, { data: log }] = await Promise.all([
    client.from('engine_weekly_reports').select('summary, generated_at').eq('iso_year', key.isoYear).eq('iso_week', key.isoWeek).maybeSingle(),
    client.from('engine_weekly_metrics').select('*').eq('iso_year', key.isoYear).eq('iso_week', key.isoWeek).order('league_id').order('model_version').order('market').limit(2000),
    client.from('engine_version_pairs').select('*').eq('iso_year', key.isoYear).eq('iso_week', key.isoWeek),
    client.from('engine_learning_log').select('*').like('subject', `${weekParam}%`).order('occurred_at', { ascending: false }).limit(100),
  ]);
  return NextResponse.json({ ok: true, week: weekParam, report: report ?? null, metrics: metrics || [], pairs: pairs || [], log: log || [] });
}

export async function POST(request: NextRequest) {
  let body: any = {};
  try { body = await request.json(); } catch { /* boş gövde */ }
  if (body?.action !== 'recompute') return NextResponse.json({ ok: false, error: 'action must be "recompute"' }, { status: 400 });
  const key = body.week ? parseIsoWeek(String(body.week)) : previousIsoWeek(new Date(), 1);
  if (!key) return NextResponse.json({ ok: false, error: 'week must be YYYY-Www' }, { status: 400 });
  try {
    const client = sb();
    const computed = await computeWeek(client, key);
    const summary = await buildReport(client, key, computed);
    return NextResponse.json({ ok: true, week: computed.week, counts: computed.counts, written: computed.written, summary });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || 'recompute failed' }, { status: 500 });
  }
}
