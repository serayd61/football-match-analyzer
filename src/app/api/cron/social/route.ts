// ============================================================================
// CRON — SOSYAL PAYLAŞIM (X/Twitter + Telegram)
// ----------------------------------------------------------------------------
//   ?kind=daily    07:00 UTC her gün   → günün seçimleri + görsel
//   ?kind=results  saat başı :40       → sonuçlanan bacaklara yanıt
//   ?kind=weekly   Pazartesi 06:00 UTC → haftalık karne dizisi + görsel
//   &dry=1         hiçbir yere göndermez, metni döner
//   &image=1       (daily/weekly) görselin PNG'sini döner, gönderi yok
//   &day=YYYY-MM-DD gün seçimi (varsayılan bugün)
//   ?status=1      hangi hesaplar tanımlı
//   ?trends=1      günün X trendleri + bacaklarla eşleşen etiketler (teşhis)
// ============================================================================
import { NextRequest, NextResponse } from 'next/server';
import { publishDaily, publishResults, publishWeekly, socialStatus, dailyLegs, dayTrends } from '@/lib/social/publish';
import { hashtags, matchTrends } from '@/lib/social/content';
import { dailyImage, weeklyImage } from '@/lib/social/image';
import { showcaseRecord } from '@/lib/site/showcase';
import { todayYmd, addDays } from '@/lib/site/time';

export const dynamic = 'force-dynamic';
export const maxDuration = 120;

export async function GET(request: NextRequest) {
  const auth = request.headers.get('authorization');
  const ok = [process.env.CRON_SECRET, process.env.ADMIN_SECRET].filter(Boolean).some((s) => auth === `Bearer ${s}`);
  if (!ok) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const q = request.nextUrl.searchParams;
  if (q.get('status') === '1') return NextResponse.json(socialStatus());
  if (q.get('trends') === '1') {
    const legs = await dailyLegs(q.get('day') || todayYmd());
    const trends = await dayTrends();
    return NextResponse.json({ trends: trends.length, sample: trends.slice(0, 30), matched: matchTrends(legs, trends), tags: hashtags(legs, trends) });
  }
  const kind = q.get('kind') || 'daily';
  const dry = q.get('dry') === '1';
  const day = q.get('day') || todayYmd();
  const lang = (q.get('lang') === 'en' ? 'en' : 'tr') as 'tr' | 'en';
  try {
    if (q.get('image') === '1') {
      let png: Buffer;
      if (kind === 'weekly') {
        const rec = await showcaseRecord(7, Date.parse(`${day}T00:00:00Z`));
        png = await weeklyImage({ from: addDays(day, -7), to: addDays(day, -1), n: rec.n, won: rec.won, byMarket: rec.byMarket, noPick: rec.noPick }, lang);
      } else {
        const legs = await dailyLegs(day);
        if (!legs.length) return NextResponse.json({ ok: false, error: 'bacak yok' });
        const rec = await showcaseRecord(7).catch(() => null);
        png = await dailyImage(legs, day, lang, rec && rec.n ? { n: rec.n, won: rec.won } : null);
      }
      return new NextResponse(new Uint8Array(png), { headers: { 'Content-Type': 'image/png', 'Cache-Control': 'no-store' } });
    }
    if (kind === 'results') return NextResponse.json(await publishResults({ dry }));
    if (kind === 'weekly') return NextResponse.json(await publishWeekly({ dry, day }));
    return NextResponse.json(await publishDaily({ dry, day }));
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: String(e?.message || e).slice(0, 300) }, { status: 500 });
  }
}
