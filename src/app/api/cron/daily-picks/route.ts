// ============================================================================
// CRON — GÜNÜN 3 SEÇİMİ (her gün 06:15 UTC, snapshot-odds :10'dan sonra)
// ----------------------------------------------------------------------------
// Günün seçimlerini sabah dondurur (site_daily_picks). Panel ilk açılışta da
// üretebilir; cron, kullanıcı gelmeden kaydın oluşmasını ve karnenin "sabah ne
// dedik"e göre ölçülmesini garanti eder. ?date=YYYY-MM-DD ile yarın da
// üretilebilir; ?force=1 günün satırlarını silip yeniden üretir; ?preview=1&asOf=ISO
// kaydetmeden üretir; ?debug=1 kural girdilerini döker (admin).
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { getDailyPicks, dailyPicksRecord, debugInputs, previewDailyPicks } from '@/lib/site/daily-picks';
import { db } from '@/lib/site/db';
import { todayYmd, YMD_RE } from '@/lib/site/time';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function GET(request: NextRequest) {
  const auth = request.headers.get('authorization');
  const ok = [process.env.CRON_SECRET, process.env.ADMIN_SECRET].filter(Boolean).some((s) => auth === `Bearer ${s}`);
  if (!ok) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const q = request.nextUrl.searchParams;
  const date = YMD_RE.test(q.get('date') ?? '') ? q.get('date')! : todayYmd();
  if (q.get('debug') === '1') return NextResponse.json(await debugInputs(date));
  // ?preview=1[&asOf=ISO]: kaydetmeden üret (kural denemesi / geçmiş gün simülasyonu).
  if (q.get('preview') === '1') {
    const asOf = q.get('asOf') ? Date.parse(q.get('asOf')!) : undefined;
    return NextResponse.json({ ok: true, date, preview: true, picks: await previewDailyPicks(date, Number.isFinite(asOf) ? asOf : undefined) });
  }
  if (q.get('force') === '1') await db().from('site_daily_picks').delete().eq('pick_date', date);

  const { picks, generated } = await getDailyPicks(date);
  const record = await dailyPicksRecord(30);
  return NextResponse.json({ ok: true, date, generated, count: picks.length, picks, record });
}
