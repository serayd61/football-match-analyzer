// ============================================================================
// CRON — MAÇ BAĞLAMI (saat başı :25): eksikler + açıklanan kadro (API-Football)
// ----------------------------------------------------------------------------
// D..D+2 eşlenmiş maçlar; eksikler ≤48 s kala 6 s'de bir, kadro ~75 dk kala.
// ?days=N pencere, ?max=N çağrı tavanı. Yalnız af_fixture_context'e yazar.
// ============================================================================
import { NextRequest, NextResponse } from 'next/server';
import { syncAfContext } from '@/lib/site/af-context';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function GET(request: NextRequest) {
  const auth = request.headers.get('authorization');
  const ok = [process.env.CRON_SECRET, process.env.ADMIN_SECRET].filter(Boolean).some((s) => auth === `Bearer ${s}`);
  if (!ok) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const q = request.nextUrl.searchParams;
  const days = Math.min(5, Math.max(1, Number(q.get('days') || 3)));
  const max = Math.min(200, Math.max(1, Number(q.get('max') || 80)));
  return NextResponse.json(await syncAfContext(days, max));
}
