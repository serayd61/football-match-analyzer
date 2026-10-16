// ============================================================================
// API: SITE/EVIDENCE/[fixtureId] — geçmiş kanıt analizi (evidence-1.0), üyelere.
// GET ?asOf=<ISO>  → { ok, report, generatedAt }   (asOf gelecekteyse şimdiye kırpılır)
// Erişim: maç sayfasıyla aynı kapı (getSiteAccess + canSeeMatches; örnek maç herkese).
// Rate limit: mevcut Redis tabanlı checkRateLimit (IP + kullanıcı). LLM yok, dış çağrı yok.
// Önbellek: private/no-store — üye verisi; havuz lib katmanında süreç belleğinde (30 dk).
// Ajanın yazma yetkisi yok: yalnız okur, hiçbir seçimi/karneyi değiştirmez.
// ============================================================================
export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getPrediction } from '@/lib/site/predictions';
import { assessRows } from '@/lib/site/assess';
import { getEvidence } from '@/lib/site/evidence';
import { getSiteAccess, canSeeMatches } from '@/lib/site/access';
import { isSampleFixture } from '@/lib/site/sample-analysis';
import { checkRateLimit } from '@/lib/middleware/rate-limit';

const noStore = { 'cache-control': 'private, no-store' };

export async function GET(req: NextRequest, { params }: { params: { fixtureId: string } }) {
  const id = Number(params.fixtureId);
  if (!Number.isInteger(id) || id <= 0) return NextResponse.json({ ok: false, code: 'bad_request' }, { status: 400, headers: noStore });

  const access = await getSiteAccess();
  const allowed = canSeeMatches(access) || (await isSampleFixture(id).catch(() => false));
  if (!allowed) {
    return NextResponse.json({ ok: false, code: access.state === 'anon' ? 'auth_required' : 'membership_required' }, { status: access.state === 'anon' ? 401 : 403, headers: noStore });
  }

  const rl = await checkRateLimit(req, { limit: 30, window: 60, type: 'both', proLimit: 60 }, access.email).catch(() => null);
  if (rl && !rl.success) return NextResponse.json({ ok: false, code: 'rate_limited' }, { status: 429, headers: { ...noStore, 'retry-after': String(Math.max(1, Math.ceil((rl.reset - Date.now()) / 1000))) } });

  const p = await getPrediction(id).catch(() => null);
  if (!p) return NextResponse.json({ ok: false, code: 'not_found' }, { status: 404, headers: noStore });
  if (!p.hasModel) return NextResponse.json({ ok: false, code: 'no_model' }, { status: 404, headers: noStore });

  try {
    const assessed = await assessRows([p]);
    const { report, generatedAt, poolLoadedAt } = await getEvidence(p, assessed.get(p.fixtureId)?.assessment ?? null, req.nextUrl.searchParams.get('asOf'));
    return NextResponse.json({ ok: true, report, generatedAt, poolLoadedAt }, { headers: noStore });
  } catch (e) {
    console.error('[api/site/evidence] failed', e);
    return NextResponse.json({ ok: false, code: 'internal_error' }, { status: 503, headers: noStore });
  }
}
