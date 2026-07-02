// ============================================================================
// API: ME/ACCESS — oturumlu kullanıcının plan + günlük analiz hakkı durumu.
// Dashboard sayaçları (hero rozeti, TopBar chip'i) bunu tüketir.
// Yan etki: checkUserAccess profil yoksa 'free' oluşturur (idempotent) — yeni
// kayıtlar için istenen davranış. Veri sızdırmaz: yalnız kendi durumun.
// ============================================================================

export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { checkUserAccess, hasEnginePredictionAccess } from '@/lib/accessControl';

export async function GET() {
  const session = await getServerSession(authOptions);
  const email = session?.user?.email;
  if (!email) {
    return NextResponse.json({ ok: false, code: 'auth_required' }, { status: 401 });
  }

  try {
    const [access, engineAccess] = await Promise.all([
      checkUserAccess(email),
      hasEnginePredictionAccess(email),
    ]);

    return NextResponse.json({
      ok: true,
      plan: access.isPro ? 'pro' : 'free',
      isPro: access.isPro,
      engineAccess, // motor tahminleri (engine_predictions) görülebilir mi
      analysesUsed: access.analysesUsed,
      analysesLimit: access.analysesLimit,
      analysesLeft: Math.max(0, access.analysesLimit - access.analysesUsed),
      canAnalyze: access.canAnalyze,
    });
  } catch (e: any) {
    console.error('[me/access] error', e?.message);
    return NextResponse.json({ ok: false, code: 'internal_error' }, { status: 500 });
  }
}
