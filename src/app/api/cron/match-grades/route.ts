// ============================================================================
// CRON — BİTEN MAÇ DERECE KARTI (saat başı :50, settle-engine :20'den sonra)
// ----------------------------------------------------------------------------
// Son N günde sonuçlanmış resmî satırları grade-1.0 ile dereceler ve
// site_match_grades'e bir kez yazar (grades.ts). ?preview=1 yazmaz; ?days=N (1–60).
// ?lessons=1 (Pazartesi 05:30): önceki ISO haftanın derslerini engine_learning_log'a
// bir kez yazar; ?week=2026-W42 belirli hafta; ?lessons=1&preview=1 yalnız hesaplar.
// Hiçbir seçimi, karneyi ya da kuralı değiştirmez; yalnız kayıt ve özet.
// ============================================================================
import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const maxDuration = 120;

export async function GET(request: NextRequest) {
  const auth = request.headers.get('authorization');
  const ok = [process.env.CRON_SECRET, process.env.ADMIN_SECRET].filter(Boolean).some((s) => auth === `Bearer ${s}`);
  if (!ok) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const q = request.nextUrl.searchParams;
  const preview = q.get('preview') === '1';
  try {
    const { recordMatchGrades, recordWeekLessons } = await import('@/lib/site/grades');
    if (q.get('lessons') === '1') {
      const { parseIsoWeek, previousIsoWeek } = await import('@/lib/engine/scoring');
      const week = parseIsoWeek(q.get('week')) ?? previousIsoWeek();
      const res = await recordWeekLessons(week, !preview);
      return NextResponse.json({ ok: !res.error, preview, ...res }, { status: res.error ? 500 : 200 });
    }
    const days = Math.min(60, Math.max(1, Number(q.get('days') || 14)));
    const res = await recordMatchGrades(days, !preview);
    return NextResponse.json({ ok: !res.error, preview, ...res }, { status: res.error ? 500 : 200 });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? String(e) }, { status: 500 });
  }
}
