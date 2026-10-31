// ============================================================================
// HERKESE AÇIK sosyal görsel ucu — Instagram API görseli bizden URL ile çeker
// ----------------------------------------------------------------------------
//   ?kind=daily&day=YYYY-MM-DD&lang=en   günün seçimleri (1080×1350)
//   ?kind=weekly&day=YYYY-MM-DD&lang=en  haftalık karne (day = pazartesi)
//   ?kind=proof&lang=en                  kanıt kartı (/api/v2/proof)
// Kimlik doğrulaması yok (Instagram anonim çeker); kötüye kullanım sınırı:
// yalnız bugünün ±10 günü, çıktı 1 saat önbellekte. Yetkili üretim/teşhis için
// /api/cron/social?image=1 duruyor.
// ============================================================================
import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const YMD = /^\d{4}-\d{2}-\d{2}$/;
const MAX_DAYS = 10;

export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams;
  const kind = q.get('kind') || 'daily';
  const lang = (q.get('lang') === 'tr' ? 'tr' : 'en') as 'tr' | 'en';
  const { todayYmd, addDays } = await import('@/lib/site/time');
  const day = q.get('day') && YMD.test(q.get('day')!) ? q.get('day')! : todayYmd();
  const dist = Math.abs((Date.parse(`${day}T00:00:00Z`) - Date.parse(`${todayYmd()}T00:00:00Z`)) / 86_400_000);
  if (!(dist <= MAX_DAYS)) return NextResponse.json({ error: 'day out of range' }, { status: 400 });
  try {
    const { dailyImage, weeklyImage, proofImage } = await import('@/lib/social/image');
    let png: Buffer;
    if (kind === 'proof') {
      const { SITE } = await import('@/lib/social/content');
      const r = await fetch(`${SITE}/api/v2/proof`, { cache: 'no-store' });
      const j: any = await r.json();
      if (!j?.ok) return NextResponse.json({ error: 'proof unavailable' }, { status: 503 });
      png = await proofImage(j, lang);
    } else if (kind === 'weekly') {
      const { showcaseRecord } = await import('@/lib/site/showcase');
      const rec = await showcaseRecord(7, Date.parse(`${day}T00:00:00Z`));
      png = await weeklyImage({ from: addDays(day, -7), to: addDays(day, -1), n: rec.n, won: rec.won, byMarket: rec.byMarket, noPick: rec.noPick }, lang);
    } else {
      const { dailyLegs } = await import('@/lib/social/publish');
      const { showcaseRecord } = await import('@/lib/site/showcase');
      const legs = await dailyLegs(day);
      if (!legs.length) return NextResponse.json({ error: 'no legs' }, { status: 404 });
      const rec = await showcaseRecord(7).catch(() => null);
      png = await dailyImage(legs, day, lang, rec && rec.n ? { n: rec.n, won: rec.won } : null);
    }
    return new NextResponse(new Uint8Array(png), { headers: { 'Content-Type': 'image/png', 'Cache-Control': 'public, max-age=3600, s-maxage=3600' } });
  } catch (e: any) {
    return NextResponse.json({ error: String(e?.message || e).slice(0, 300) }, { status: 500 });
  }
}
