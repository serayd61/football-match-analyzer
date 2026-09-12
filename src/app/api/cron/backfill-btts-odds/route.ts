// ============================================================================
// ADMIN — prediction_odds.btts_yes_odds / btts_no_odds geri doldurma
// ----------------------------------------------------------------------------
// Migration 2026-09-13_prediction_odds_btts.sql uygulandıktan sonra bir kez
// çalıştırılır: raw jsonb'si olan ve KG sütunu boş satırları küçük sayfalarla
// okur, parseMarkets ile ayrıştırır, sütunları günceller. İdempotent; her
// çağrı en fazla ?limit= (varsayılan 150) satır işler, kalan varsa `remaining`
// döner → tekrar çağır. Bearer CRON_SECRET | ADMIN_SECRET.
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/site/db';
import { parseMarkets } from '@/lib/site/markets';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function GET(request: NextRequest) {
  const auth = request.headers.get('authorization');
  const ok = [process.env.CRON_SECRET, process.env.ADMIN_SECRET].filter(Boolean).some((s) => auth === `Bearer ${s}`);
  if (!ok) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const limit = Math.min(300, Math.max(10, Number(request.nextUrl.searchParams.get('limit')) || 150));
  const PAGE = 25; // raw ~75 KB/satır → sayfa başına ~2 MB
  let scanned = 0, updated = 0, noBook = 0;
  const started = Date.now();

  while (scanned < limit && Date.now() - started < 45_000) {
    const { data, error } = await db()
      .from('prediction_odds')
      .select('id, raw')
      .is('btts_yes_odds', null)
      .not('raw', 'is', null)
      .order('captured_at', { ascending: false })
      .range(scanned, scanned + PAGE - 1);
    if (error) return NextResponse.json({ ok: false, error: error.message, scanned, updated }, { status: 500 });
    if (!data?.length) break;
    for (const row of data as any[]) {
      const bk = parseMarkets(row.raw);
      if (bk?.btts) {
        const { error: upErr } = await db().from('prediction_odds').update({ btts_yes_odds: bk.btts.a, btts_no_odds: bk.btts.b }).eq('id', row.id);
        if (!upErr) updated++;
      } else {
        // Kitapta KG yok: 0 yazarak bir daha taranmasın (0 = "yok" işareti).
        const { error: upErr } = await db().from('prediction_odds').update({ btts_yes_odds: 0, btts_no_odds: 0 }).eq('id', row.id);
        if (!upErr) noBook++;
      }
    }
    scanned += data.length;
    if (data.length < PAGE) break;
  }

  const { count } = await db().from('prediction_odds').select('id', { count: 'exact', head: true }).is('btts_yes_odds', null).not('raw', 'is', null);
  return NextResponse.json({ ok: true, scanned, updated, noBook, remaining: count ?? null });
}
