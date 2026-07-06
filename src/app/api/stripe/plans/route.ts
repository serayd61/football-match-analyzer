// ============================================================================
// API: PLAN AVAILABILITY (public, salt okuma)
// Hangi faturalama seçeneklerinin YAPILANDIRILMIŞ olduğunu döner. Haftalık
// plan STRIPE_PRICE_ID_WEEKLY env'ine bağlı — env yokken UI seçeneği hiç
// göstermesin diye (aksi halde canlıda checkout 503 verir). Secret sızdırmaz:
// yalnızca boolean döner.
// ============================================================================

export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({
    ok: true,
    weekly: !!process.env.STRIPE_PRICE_ID_WEEKLY,
    monthly: !!process.env.STRIPE_PRICE_ID,
  });
}
