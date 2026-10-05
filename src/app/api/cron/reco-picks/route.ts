// ============================================================================
// CRON — ÖNERİLEN SEÇİM (saat başı :35)
// ----------------------------------------------------------------------------
// Son 180 günden modeli kurar, önümüzdeki 3 günün maçlarına kural best-1.0 ile
// seçim yazar (site_reco_picks); başlamaya ≤3 saat kala dondurur.
// ?preview=1 yazmaz; ?days=N pencere (1–5); ?record=1 yalnız karne (?days=gün).
// Faz 2: yalnız kayıt, sitede gösterilmez.
// ============================================================================
import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const maxDuration = 120;

export async function GET(request: NextRequest) {
  const auth = request.headers.get('authorization');
  const ok = [process.env.CRON_SECRET, process.env.ADMIN_SECRET].filter(Boolean).some((s) => auth === `Bearer ${s}`);
  if (!ok) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  // Yetki kontrolünden sonra yüklenir: modül 'server-only' (route-guards testi düz Node'da çalışır).
  const { computeReco, recoRecord } = await import('@/lib/site/reco');
  const q = request.nextUrl.searchParams;
  if (q.get('record') === '1') return NextResponse.json({ ok: true, record: await recoRecord(Math.min(180, Math.max(1, Number(q.get('days') || 30)))) });
  const preview = q.get('preview') === '1';
  const days = Math.min(5, Math.max(1, Number(q.get('days') || 3)));
  try {
    const res = await computeReco(days, !preview);
    const record = preview ? null : await recoRecord(30);
    const withPick = res.picks.filter((p) => p.market);
    return NextResponse.json({
      ok: !res.error, preview, ...res,
      picks: res.picks.slice(0, 50).map((p) => ({ fixtureId: p.fixtureId, kickoff: p.kickoff, match: `${p.homeName} – ${p.awayName}`, league: p.leagueName, covered: p.covered, market: p.market, selection: p.selection, pDisplay: p.pDisplay, q: p.q, frozen: p.frozen })),
      summary: { matches: res.picks.length, withPick: withPick.length, byMarket: withPick.reduce<Record<string, number>>((m, p) => ((m[`${p.market}:${p.selection}`] = (m[`${p.market}:${p.selection}`] ?? 0) + 1), m), {}) },
      record,
    });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? String(e) }, { status: 500 });
  }
}
