export const dynamic = 'force-dynamic';
// Deneme bitimi şeridi (2026-11-02): istemci bileşenleri (TrialEndedBanner) oturum
// sahibinin plan durumunu buradan okur. E-posta dönmez; yalnız durum + kalan gün.
// Layout'ta sunucu tarafı getSiteAccess() okumak her ISR sayfasını dinamiğe
// çevirirdi (AppBanner ile aynı gerekçe), bu yüzden ayrı uç nokta.
import { NextResponse } from 'next/server';
import { getSiteAccess } from '@/lib/site/access';

export async function GET() {
  const a = await getSiteAccess();
  return NextResponse.json({ state: a.state, trialDaysLeft: a.trialDaysLeft }, { headers: { 'Cache-Control': 'private, no-store' } });
}
