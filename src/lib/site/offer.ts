// ============================================================================
// Lansman teklifi (2026-09-26): "ilk ay $9,90" — süreli, env ile açılır/kapanır.
// ----------------------------------------------------------------------------
// Neden: Eylül kohortunda 35 kayıt / 0 dönüşüm; fiyatı kalıcı indirmek yerine
// süreli kupon ile ölçmek kararı (kullanıcı, 26 Eyl). Kalıcı fiyat değişmez.
//   LAUNCH_OFFER_COUPON  Stripe kupon id (örn. "launch-990"); boşsa teklif yok
//   LAUNCH_OFFER_PRICE   gösterilen ilk-ay fiyatı (varsayılan 9.90)
//   LAUNCH_OFFER_UNTIL   son gün YYYY-MM-DD (UTC, dahil); geçince kendiliğinden kapanır
// Checkout: aylık plana `discounts:[{coupon}]` eklenir (Stripe ile promosyon
// kodu alanı aynı anda olamaz → o oturumda kapanır). Haftalık plana uygulanmaz.
// ============================================================================

export interface LaunchOffer { coupon: string; price: number; until: string | null }

const YMD = /^\d{4}-\d{2}-\d{2}$/;

export function launchOffer(env: Record<string, string | undefined> = process.env, now: Date = new Date()): LaunchOffer | null {
  const coupon = (env.LAUNCH_OFFER_COUPON || '').trim();
  if (!coupon) return null;
  const until = (env.LAUNCH_OFFER_UNTIL || '').trim();
  if (until) {
    if (!YMD.test(until)) return null;
    if (now.getTime() > Date.parse(`${until}T23:59:59Z`)) return null;
  }
  const price = Number(env.LAUNCH_OFFER_PRICE || '9.90');
  if (!Number.isFinite(price) || price <= 0) return null;
  return { coupon, price, until: until || null };
}
