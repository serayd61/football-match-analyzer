// Admin sondası (yazmaz, ?map=1 hariç): API-Football anahtarı/plan, eşleme, oran.
//   ?status=1           → plan, kalan istek
//   ?map=1[&days=3]     → eşleme tablosunu doldur (yazar)
//   ?odds=<fotmobId>    → eşlenmiş maçın API-Football oranları (yazmaz)
//   ?context=<fotmobId> → eksikler + kadroyu zorla tazele (yazar)
import { NextRequest, NextResponse } from 'next/server';
import { afStatus, afOdds } from '@/lib/data-sources/api-football';
import { buildAfMap, afIdsFor } from '@/lib/site/af-map';
import { refreshAfContext } from '@/lib/site/af-context';
import { getPrediction } from '@/lib/site/predictions';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function GET(request: NextRequest) {
  const auth = request.headers.get('authorization');
  const ok = [process.env.CRON_SECRET, process.env.ADMIN_SECRET].filter(Boolean).some((s) => auth === `Bearer ${s}`);
  if (!ok) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const q = request.nextUrl.searchParams;
  if (q.get('map') === '1') return NextResponse.json(await buildAfMap(Number(q.get('days') || 3)));
  if (q.get('odds')) {
    const id = Number(q.get('odds'));
    const af = (await afIdsFor([id])).get(id);
    if (!af) return NextResponse.json({ ok: false, error: 'eşleme yok', fixtureId: id });
    const r = await afOdds(af);
    return NextResponse.json({ fixtureId: id, afFixtureId: af, ...r });
  }
  if (q.get('context')) {
    const id = Number(q.get('context'));
    const p = await getPrediction(id);
    if (!p) return NextResponse.json({ ok: false, error: 'maç yok', fixtureId: id });
    return NextResponse.json({ fixtureId: id, ...(await refreshAfContext(id, p.homeName, p.awayName, p.kickoff)) });
  }
  return NextResponse.json(await afStatus());
}
