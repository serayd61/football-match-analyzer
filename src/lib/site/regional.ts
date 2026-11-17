// Bölgesel (satın alma gücü paritesi) fiyat — 2026-11-16.
// Afrika'dan gelen ziyaretçiye Pro yıllık $49 yerine $19, aylık $9,90 yerine
// $2,99 sunulur (aylık 2026-11-16 akşamı eklendi; önce yalnız yıllıktı). Neden:
// 13 Eki–16 Kas arası 30 checkout'tan 29'u ödenmeden kapandı; kitle
// (Nijerya, Mali, Bahreyn…) için $49 asgari ücretin üstünde. Tek ödeyen
// (11 Kas, Nijerya) o kitleden geldi. $19 kayıp değil, sıfırdan gelir.
//
// Kurallar
// - İki plan da bölgesel; yıllık/aylık oranı standartla aynı düzende
//   (19 / 35,88 → %47 tasarruf) ki yıllık hâlâ teşvik edilsin.
// - Ülke, Vercel'in her isteğe eklediği `x-vercel-ip-country` başlığından
//   okunur; istemci plan adıyla PPP isteyemez (route sunucuda türetir).
// - Bölgesel fiyatta kupon alanı kapalı (PRO50 ile $9,50 / $1,50'ye düşmesin);
//   fiyat sayfası bölgesel ziyaretçiye PRO50 notunu da göstermez.
// - Checkout tamamlanınca fatura adresi bölge dışındaysa webhook yalnız
//   log'a yazar (VPN izleme); iptal etmez.
// Fiyat listesi plans.ts'deki PLAN_PRICES ile aynı düzende; Stripe tarafı
// scripts/stripe-setup-ppp.mjs (lookup pro_yearly_19_ppp, pro_monthly_299_ppp).
import { PLAN_PRICES, yearlyEnabled } from './plans';

export const REGIONAL_YEARLY = { amount: 19, currency: 'USD', interval: 'year' as const, key: 'PRO_YEARLY_PPP' as const };
export const REGIONAL_MONTHLY = { amount: 2.99, currency: 'USD', interval: 'month' as const, key: 'PRO_PPP' as const };
/** Checkout metadata.plan değerleri — webhook bölge/fatura adresi karşılaştırmasını bunlarda yapar. */
export const REGIONAL_PLAN_IDS: ReadonlySet<string> = new Set([REGIONAL_YEARLY.key, REGIONAL_MONTHLY.key]);

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
 *  Üretim dışında `x-ppp-country` ile taklit edilebilir (önizleme testi);
 *  yerel tarayıcı testinde başlık eklenemediği için `PPP_DEV_COUNTRY=NG npm run dev`
 *  tüm istekleri o ülkeden sayar (üretimde okunmaz). */
export function countryFromHeaders(headers: { get(name: string): string | null }): string | null {
  const dev = process.env.NODE_ENV !== 'production' || process.env.VERCEL_ENV === 'preview';
  const raw = (dev && (headers.get('x-ppp-country') || process.env.PPP_DEV_COUNTRY)) || headers.get('x-vercel-ip-country');
  const code = raw?.trim().toUpperCase() ?? '';
  return /^[A-Z]{2}$/.test(code) ? code : null;
}

/** Server-only: bölgesel yıllık, Stripe price id'si ve standart yıllık plan varsa sunulur. */
export const regionalYearlyEnabled = () => yearlyEnabled() && Boolean(process.env.STRIPE_PRICE_ID_YEARLY_PPP);
/** Server-only: bölgesel aylık, Stripe price id'si varsa sunulur. */
export const regionalMonthlyEnabled = () => Boolean(process.env.STRIPE_PRICE_ID_MONTHLY_PPP);
/** @deprecated yıllık için regionalYearlyEnabled; eski çağrılar için tutuldu. */
export const regionalEnabled = regionalYearlyEnabled;

/** Bu ülkeye yıllık hangi fiyat gösterilir: bölgesel 19 ya da standart 49. */
export function yearlyAmountFor(country: string | null | undefined, enabled = regionalYearlyEnabled()): { amount: number; regional: boolean } {
  if (enabled && isRegionalCountry(country)) return { amount: REGIONAL_YEARLY.amount, regional: true };
  return { amount: PLAN_PRICES.yearly.amount, regional: false };
}

/** Bu ülkeye aylık hangi fiyat gösterilir: bölgesel 2,99 ya da standart 9,90. */
export function monthlyAmountFor(country: string | null | undefined, enabled = regionalMonthlyEnabled()): { amount: number; regional: boolean } {
  if (enabled && isRegionalCountry(country)) return { amount: REGIONAL_MONTHLY.amount, regional: true };
  return { amount: PLAN_PRICES.monthly.amount, regional: false };
}

/** Fiyat sayfası için ikisi birden; `regional` en az biri bölgeselse true. */
export function pricesFor(country: string | null | undefined, enabled = { monthly: regionalMonthlyEnabled(), yearly: regionalYearlyEnabled() }) {
  const m = monthlyAmountFor(country, enabled.monthly);
  const y = yearlyAmountFor(country, enabled.yearly);
  return { monthly: m.amount, yearly: y.amount, regional: m.regional || y.regional };
}

// ── Bölgesel fiyatın site genelinde gösterimi (2026-11-17) ──────────────────
// Sorun: bölgesel fiyat yalnız /pricing'de görünüyordu; maç sayfası, kilitli
// seçim, ana sayfa fiyat kutusu ve şerit herkese $9,90 yazıyordu. Afrika'daki
// ziyaretçi indirimi görmeden ayrılıyordu.
// Çözüm: anonim sayfalar ISR (URL başına tek HTML) olduğu için ülke sunucu
// render'ında okunamaz. Middleware ülkeyi `fa_ppp` çerezine bayrak olarak
// yazar ('m' aylık, 'y' yıllık, 'my' ikisi); layout'taki boot script çerezi
// `.site[data-ppp]` özniteliğine taşır; fiyat yazan yerler iki metni birden
// basar (<Regional/>), CSS doğru olanı gösterir. Hidrasyon beklenmez, $9,90
// bir an bile görünmez. Çerez yalnız GÖSTERİM içindir: checkout fiyatı
// sunucuda IP'den türetir (create-checkout), çerezle oynamak fiyat düşürmez.
export const REGION_COOKIE = 'fa_ppp';
export const REGION_COOKIE_MAX_AGE = 60 * 60 * 24 * 30;
export type RegionFlags = '' | 'm' | 'y' | 'my';

/** Bu ülke için çerez değeri; bölge dışı ya da fiyat kapalıysa ''. */
export function regionFlags(country: string | null | undefined, enabled = { monthly: regionalMonthlyEnabled(), yearly: regionalYearlyEnabled() }): RegionFlags {
  if (!isRegionalCountry(country)) return '';
  return `${enabled.monthly ? 'm' : ''}${enabled.yearly ? 'y' : ''}` as RegionFlags;
}

/** Çerez değerini doğrular; tanınmayan her şey ''. */
export const parseRegionFlags = (raw: string | null | undefined): RegionFlags =>
  (raw === 'm' || raw === 'y' || raw === 'my' ? raw : '');

/** `document.cookie` / Cookie başlığından bayrak. */
export function regionFlagsFromCookie(cookie: string | null | undefined): RegionFlags {
  const m = /(?:^|;\s*)fa_ppp=([a-z]{1,2})(?:;|$)/.exec(cookie || '');
  return parseRegionFlags(m?.[1]);
}

/** Bayraktan gösterilecek fiyatlar (istemci ve sunucu ortak; env okumaz). */
export function pricesFromFlags(flags: RegionFlags) {
  return {
    monthly: flags.includes('m') ? REGIONAL_MONTHLY.amount : PLAN_PRICES.monthly.amount,
    yearly: flags.includes('y') ? REGIONAL_YEARLY.amount : PLAN_PRICES.yearly.amount,
    regional: flags !== '',
  };
}

/**
 * Sunucu (e-posta cron'ları): bu ülkedeki üyeye yazılacak teklif. Yıllık plan
 * kapalıysa `yearly` null; bölgesel fiyatta kupon geçmediği için `promo` false.
 */
export function offerFor(country: string | null | undefined, enabled = { monthly: regionalMonthlyEnabled(), yearly: regionalYearlyEnabled(), yearlyPlan: yearlyEnabled() }) {
  const p = pricesFor(country, { monthly: enabled.monthly, yearly: enabled.yearly });
  return { monthly: p.monthly, yearly: enabled.yearlyPlan ? p.yearly : null, regional: p.regional, promo: !p.regional };
}
