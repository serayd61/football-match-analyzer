// ============================================================================
// CRON — /picks KAYDI (saat başı :45, snapshot-odds :10 ve showcase :20'den sonra)
// ----------------------------------------------------------------------------
// D..D+2 penceresinde "karneye uyan" güçlü seçimleri sayfayla aynı kuraldan
// (dailyStandingBoard) hesaplar, site_standing_picks'e yazar; başlamaya ≤3 saat
// kala dondurur. ?preview=1 yazmaz; ?days=N pencere (1–5); ?history=1 yalnız
// gün gün karne (?days=gün). Aynı tur ortak değerlendirmenin gölge kaydını da
// yazar (assessment-snapshots.ts); ?assessment=history keşifsel gölge karnesi.
// ============================================================================
import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const maxDuration = 120;

export async function GET(request: NextRequest) {
  const auth = request.headers.get('authorization');
  const ok = [process.env.CRON_SECRET, process.env.ADMIN_SECRET].filter(Boolean).some((s) => auth === `Bearer ${s}`);
  if (!ok) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  // Yetki kontrolünden sonra yüklenir: modül 'server-only' (route-guards testi düz Node'da çalışır).
  const { computeStandingPicks, standingHistory } = await import('@/lib/site/standing-picks');
  const q = request.nextUrl.searchParams;
  try {
    if (q.get('history') === '1') {
      const days = await standingHistory(Math.min(90, Math.max(1, Number(q.get('days') || 14))));
      return NextResponse.json({ ok: true, days: days.map((d) => ({ day: d.day, n: d.n, won: d.won, pending: d.pending, byMarket: d.byMarket })) });
    }
    if (q.get('assessment') === 'history') {
      const { assessmentHistory } = await import('@/lib/site/assessment-snapshots');
      const rec = await assessmentHistory(Math.min(180, Math.max(1, Number(q.get('days') || 30))));
      return NextResponse.json({ ok: true, ...rec });
    }
    const preview = q.get('preview') === '1';
    const days = Math.min(5, Math.max(1, Number(q.get('days') || 3)));
    const res = await computeStandingPicks(days, !preview);
    // Ortak değerlendirme gölge kaydı (2026-10-16): aynı pencere, aynı tur; hatası /picks kaydını etkilemez.
    let assessment: unknown = null;
    try {
      const { recordAssessmentSnapshots } = await import('@/lib/site/assessment-snapshots');
      assessment = await recordAssessmentSnapshots(days, !preview);
    } catch (e: any) {
      assessment = { error: e?.message ?? String(e) };
      console.error('[standing-picks] assessment snapshots failed', e);
    }
    return NextResponse.json({ ok: !res.error, preview, ...res, assessment }, { status: res.error ? 500 : 200 });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? String(e) }, { status: 500 });
  }
}
