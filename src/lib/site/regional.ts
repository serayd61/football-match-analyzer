// Bölgesel (satın alma gücü paritesi) fiyat — 2026-11-16.
// Afrika'dan gelen ziyaretçiye yıllık Pro $49 yerine $19 sunulur. Neden:
// 13 Eki–16 Kas arası 30 checkout'tan 29'u ödenmeden kapandı; kitle
// (Nijerya, Mali, Bahreyn…) için $49 asgari ücretin üstünde. Tek ödeyen
// (11 Kas, Nijerya) o kitleden geldi. $19 kayıp değil, sıfırdan gelir.
//
// Kurallar
// - Yalnız YILLIK plan bölgesel; aylık $9,90 her yerde aynı (yıllık ödeme
//   teşvik edilir, chargeback maruziyeti tek sefer kalır).
// - Ülke, Vercel'in her isteğe eklediği `x-vercel-ip-country` başlığından
//   okunur; istemci plan adıyla PPP isteyemez (route sunucuda türetir).
// - Bölgesel fiyatta kupon alanı kapalı (PRO50 ile $9,50'ye düşmesin).
// - Checkout tamamlanınca fatura adresi bölge dışındaysa webhook yalnız
//   log'a yazar (VPN izleme); iptal etmez.
// Fiyat listesi plans.ts'deki PLAN_PRICES ile aynı düzende; Stripe tarafı
// scripts/stripe-setup-ppp.mjs (lookup_key pro_yearly_19_ppp).
import { PLAN_PRICES, yearlyEnabled } from './plans';

export const REGIONAL_YEARLY = { amount: 19, currency: 'USD', interval: 'year' as const, key: 'PRO_YEARLY_PPP' as const };

/** Afrika — 54 BM üyesi (ISO 3166-1 alpha-2). Genişletme kararı lig/ülke
 *  verisiyle bir ay sonra (Pakistan, Bangladeş, Nepal, Venezuela adayları). */
export const REGIONAL_COUNTRIES: ReadonlySet<string> = new Set([
  'DZ', 'AO', 'BJ', 'BW', 'BF', 'BI', 'CM', 'CV', 'CF', 'TD', 'KM', 'CG', 'CD', 'CI', 'DJ', 'EG', 'GQ', 'ER',
  'SZ', 'ET', 'GA', 'GM', 'GH', 'GN', 'GW', 'KE', 'LS', 'LR', 'LY', 'MG', 'MW', 'ML', 'MR', 'MU', 'MA', 'MZ',
  'NA', 'NE', 'NG', 'RW', 'ST', 'SN', 'SC', 'SL', 'SO', 'ZA', 'SS', 'SD', 'TZ', 'TG', 'TN', 'UG', 'ZM', 'ZW',
]);

export const isRegionalCountry = (country: string | null | undefined): boolean =>
  Boolean(country) && REGIONAL_COUNTRIES.has(String(country).toUpperCase());

/** İstek başlıklarından ISO ülke kodu. Vercel: `x-vercel-ip-country`.
 *  Üretim dışında `x-ppp-country` ile taklit edilebilir (önizleme testi). */
export function countryFromHeaders(headers: { get(name: string): string | null }): string | null {
  const dev = process.env.NODE_ENV !== 'production' || process.env.VERCEL_ENV === 'preview';
  const raw = (dev && headers.get('x-ppp-country')) || headers.get('x-vercel-ip-country');
  const code = raw?.trim().toUpperCase() ?? '';
  return /^[A-Z]{2}$/.test(code) ? code : null;
}

/** Server-only: bölgesel fiyat, Stripe price id'si ve yıllık plan varsa sunulur. */
export const regionalEnabled = () => yearlyEnabled() && Boolean(process.env.STRIPE_PRICE_ID_YEARLY_PPP);

/** Bu ülkeye yıllık hangi fiyat gösterilir: bölgesel 19 ya da standart 49. */
export function yearlyAmountFor(country: string | null | undefined, enabled = regionalEnabled()): { amount: number; regional: boolean } {
  if (enabled && isRegionalCountry(country)) return { amount: REGIONAL_YEARLY.amount, regional: true };
  return { amount: PLAN_PRICES.yearly.amount, regional: false };
}
