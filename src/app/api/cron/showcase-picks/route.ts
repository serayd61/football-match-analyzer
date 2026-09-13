// ============================================================================
// CRON — VİTRİN SEÇİMİ (saat başı :20, snapshot-odds :10'dan sonra)
// ----------------------------------------------------------------------------
// D..D+2 penceresindeki kapsanan maçlar için kural E'yi son piyasa görüşüyle
// çalıştırır, site_showcase_picks'e yazar; başlamaya ≤3 saat kala dondurur.
// ?preview=1 yazmaz; ?days=N pencere; ?record=1 yalnız karne. Hetzner'daki
// kural cron'u da aynı uca çağrı yapabilir (yedek).
// ============================================================================
import { NextRequest, NextResponse } from 'next/server';
import { computeShowcase, showcaseRecord } from '@/lib/site/showcase';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function GET(request: NextRequest) {
  const auth = request.headers.get('authorization');
  const ok = [process.env.CRON_SECRET, process.env.ADMIN_SECRET].filter(Boolean).some((s) => auth === `Bearer ${s}`);
  if (!ok) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const q = request.nextUrl.searchParams;
  if (q.get('record') === '1') return NextResponse.json({ ok: true, record: await showcaseRecord(Number(q.get('days') || 30)) });
  const days = Math.min(5, Math.max(1, Number(q.get('days') || 3)));
  const res = await computeShowcase(days, q.get('preview') !== '1');
  const record = await showcaseRecord(30);
  return NextResponse.json({ ok: !res.error, preview: q.get('preview') === '1', ...res, picks: res.picks.map((p) => ({ fixtureId: p.fixtureId, kickoff: p.kickoff, league: p.leagueSlug, match: `${p.homeName} – ${p.awayName}`, market: p.market, selection: p.selection, modelP: p.modelP, edge1x2: p.edge1x2, phase: p.marketPhase, reason: p.reason, frozen: p.frozen })), record });
}
