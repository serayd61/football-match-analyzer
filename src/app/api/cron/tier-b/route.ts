// ============================================================================
// CRON — KAPSAM DIŞI YÜKSEK GÜVEN LİSTESİ (her gün 06:30 UTC; settle-engine :20'den sonra)
// ----------------------------------------------------------------------------
// Önce bekleyen ayakları kapatır, sonra günün listesini dondurur, oranlar ve
// admin Telegram DM'ine gönderir. ?date=YYYY-MM-DD (yarın için), ?dry=1
// (kaydetme/gönderme), ?resend=1 (DM'i yeniden gönder), ?skipOdds=1,
// ?kind=settle (yalnız sonuçlandır), ?kind=dm (yalnız metni döndür),
// ?kind=price&minP=0.62[&whitelist=1] (günün adaylarını bet365 ile fiyatla, kaydetme).
// ============================================================================
import { NextRequest, NextResponse } from 'next/server';
import { generateTierB, settleTierB, buildDm, priceDay } from '@/lib/tierb/daily';
import { todayYmd, YMD_RE } from '@/lib/site/time';

export const dynamic = 'force-dynamic';
export const maxDuration = 120;

export async function GET(request: NextRequest) {
  const auth = request.headers.get('authorization');
  const ok = [process.env.CRON_SECRET, process.env.ADMIN_SECRET].filter(Boolean).some((s) => auth === `Bearer ${s}`);
  if (!ok) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const q = request.nextUrl.searchParams;
  const date = YMD_RE.test(q.get('date') ?? '') ? q.get('date')! : todayYmd();
  const kind = q.get('kind') ?? 'daily';
  try {
    const settle = kind === 'dm' || kind === 'price' ? null : await settleTierB();
    if (kind === 'settle') return NextResponse.json({ ok: true, settle });
    if (kind === 'dm') return NextResponse.json({ ok: true, date, text: await buildDm(date) });
    if (kind === 'price') { const minP = Number(q.get('minP')); return NextResponse.json({ ok: true, ...(await priceDay(date, Number.isFinite(minP) && minP > 0 ? minP : 0.62, { includeWhitelist: q.get('whitelist') === '1' })) }); }
    const gen = await generateTierB(date, { dry: q.get('dry') === '1', resend: q.get('resend') === '1', skipOdds: q.get('skipOdds') === '1' });
    return NextResponse.json({ ok: true, settle, ...gen });
  } catch (e: any) {
    console.error('[tier-b]', e?.message || e);
    return NextResponse.json({ ok: false, error: String(e?.message || e).slice(0, 300) }, { status: 500 });
  }
}
