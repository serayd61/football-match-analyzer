// ============================================================================
// PUBLIC — motor parametreleri (Hetzner servisi buradan okur; 5 dk CDN cache)
// GET /api/v2/engine/params → { active: {version, kind, params}, shadow: [...] }
// Tablo yoksa/boşsa `active` null döner; motor kendi varsayılanlarına düşer.
// ============================================================================

import { NextResponse } from 'next/server';
import { loadEngineVersions } from '@/lib/engine/versions';

export const dynamic = 'force-dynamic';

export async function GET() {
  const v = await loadEngineVersions();
  const strip = (s: NonNullable<typeof v.active>) => ({ version: s.version, kind: s.kind, params: s.params, activated_at: s.activated_at ?? null });
  return NextResponse.json(
    { ok: true, active: v.active ? strip(v.active) : null, shadow: v.shadow.map(strip), fetchedAt: v.fetchedAt },
    { headers: { 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=900' } },
  );
}
