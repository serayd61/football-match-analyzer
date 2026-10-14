// ============================================================================
// CRON — GÜNÜN KUPONU (07:30 UTC üret + Telegram; saat başı :50 sonuçlandır)
// ----------------------------------------------------------------------------
//   (varsayılan)   bekleyenleri sonuçlandır → sonuç mesajı; bugünün kuponu yoksa üret → gönder
//   ?settle=1      yalnız sonuçlandırma (+ sonuç mesajı)
//   ?preview=1     yazmaz, göndermez; adaylar + seçilecek kupon
//   ?dry=1         yazar ama Telegram'a göndermez (metni döner)
//   ?day=YYYY-MM-DD
// ============================================================================
import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const maxDuration = 120;

export async function GET(request: NextRequest) {
  const auth = request.headers.get('authorization');
  const ok = [process.env.CRON_SECRET, process.env.ADMIN_SECRET].filter(Boolean).some((s) => auth === `Bearer ${s}`);
  if (!ok) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { buildCoupon, settleCoupons, publishCoupon, publishCouponResults, couponCandidates, couponRecord } = await import('@/lib/site/coupon');
  const { todayYmd, YMD_RE } = await import('@/lib/site/time');
  const q = request.nextUrl.searchParams;
  const day = q.get('day') && YMD_RE.test(q.get('day')!) ? q.get('day')! : todayYmd();
  const dry = q.get('dry') === '1';
  try {
    if (q.get('preview') === '1') {
      const cands = await couponCandidates(day);
      const b = await buildCoupon(day, false);
      return NextResponse.json({ ok: true, day, candidates: cands.length, sample: cands.slice(0, 20), coupon: b.coupon, existed: b.existed });
    }
    const s = await settleCoupons();
    const results = s.settled.length ? await publishCouponResults(s.settled, dry) : [];
    if (q.get('settle') === '1') return NextResponse.json({ ok: true, day, settled: s.settled.map((c) => ({ date: c.date, status: c.status })), results });
    const b = await buildCoupon(day, true);
    const posts = b.stored ? await publishCoupon(day, dry) : { ok: true, note: 'kupon yok', posts: [] };
    return NextResponse.json({ ok: posts.ok, day, existed: b.existed, candidates: b.candidates, coupon: b.coupon, settled: s.settled.map((c) => ({ date: c.date, status: c.status })), results, posts, record: await couponRecord(30, day) });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? String(e) }, { status: 500 });
  }
}
