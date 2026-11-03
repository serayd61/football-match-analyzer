// ============================================================================
// CRON — AKIŞ ARŞİVİ (03:40 UTC): son N günün maçlarını feed_matches'e yazar.
// ----------------------------------------------------------------------------
// Varsayılan ?back=3&forward=2 → D-3..D+2 (6 çağrı; dünün maçları final, geç
// biten/ertelenen için iki gün pay; ileri günler çünkü akışın gün kovası UTC değil,
// günün geç maçları "yarın" altında gelir — ayrıca yaklaşan fikstürler tabloya girer).
// Geri doldurma: ?from=YYYY-MM-DD&to=YYYY-MM-DD (en çok 14 gün; 60 gün için
// scripts/backfill-feed-matches.ts). Yalnız feed_matches'e yazar.
// ============================================================================
import { NextRequest, NextResponse } from 'next/server';
import { ingestFeedDays } from '@/lib/site/feed-matches';
import { recentDays, dayRange } from '@/lib/site/feed-matches-pure';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function GET(request: NextRequest) {
  const auth = request.headers.get('authorization');
  const ok = [process.env.CRON_SECRET, process.env.ADMIN_SECRET].filter(Boolean).some((s) => auth === `Bearer ${s}`);
  if (!ok) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const q = request.nextUrl.searchParams;
  const from = q.get('from'), to = q.get('to');
  let dates: string[];
  if (from && to) {
    dates = dayRange(from, to);
    if (!dates.length) return NextResponse.json({ error: 'bad range' }, { status: 400 });
    if (dates.length > 14) return NextResponse.json({ error: 'range too long (max 14 days); use scripts/backfill-feed-matches.ts' }, { status: 400 });
  } else {
    dates = recentDays(Math.min(7, Math.max(0, Number(q.get('back') || 3))), new Date(), Math.min(7, Math.max(0, Number(q.get('forward') || 2))));
  }
  const days = await ingestFeedDays(dates);
  const totals = days.reduce((a, d) => ({ fetched: a.fetched + d.fetched, written: a.written + d.written, finished: a.finished + d.finished, errors: a.errors + (d.error ? 1 : 0) }), { fetched: 0, written: 0, finished: 0, errors: 0 });
  return NextResponse.json({ ok: totals.errors === 0, totals, days });
}
