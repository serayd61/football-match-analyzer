// Public plan facts for the localized pricing page. Mirrors `PLANS` in
// src/lib/stripe.ts (which cannot be imported by a page: it constructs the
// Stripe client at module load). Change prices in both places.
// 2026-10-13: monthly $19.90 → $9.90, no Stripe trial (the 7 free days come
// from registration, card-free; checkout charges immediately). Weekly plan
// removed the same day (Stripe price archived).
// 2026-11-04: yearly $49 added (≈ $4.08/month, 59% under monthly). The yearly
// column only renders when STRIPE_PRICE_ID_YEARLY is set (see `yearlyEnabled`),
// so the code can ship before the Stripe price / env exist. Year-end promo
// code PRO50 (50% off the first 3 months, monthly only) until 2026-12-31.
export const PLAN_PRICES = {
  monthly: { amount: 9.90, currency: 'USD', interval: 'month' as const, trialDays: 0, key: 'PRO' as const },
  yearly: { amount: 49, currency: 'USD', interval: 'year' as const, trialDays: 0, key: 'PRO_YEARLY' as const },
};
export type PlanKey = (typeof PLAN_PRICES)[keyof typeof PLAN_PRICES]['key'];
export const money = (n: number) => `$${n.toFixed(2)}`;

/** Yearly price expressed per month (two decimals, e.g. 4.08). */
export const yearlyPerMonth = (yearly = PLAN_PRICES.yearly.amount) => Math.round((yearly / 12) * 100) / 100;
/** Whole-percent saving of the yearly plan against 12 monthly payments. */
export const yearlySavingPct = (monthly = PLAN_PRICES.monthly.amount, yearly = PLAN_PRICES.yearly.amount) =>
  Math.round((1 - yearly / (monthly * 12)) * 100);

/** Server-only: the yearly plan is offered once its Stripe price id is configured. */
export const yearlyEnabled = () => Boolean(process.env.STRIPE_PRICE_ID_YEARLY);

// Year-end promotion (Stripe coupon + promotion code, created by
// scripts/stripe-setup-yearly.mjs). Checkout has allow_promotion_codes on for
// the monthly plan only, so the code cannot halve the yearly price.
export const PROMO = {
  code: 'PRO50',
  percentOff: 50,
  months: 3,
  /** last valid moment, UTC */
  endsAt: Date.parse('2026-12-31T23:59:59Z'),
};
export const promoActive = (now = Date.now()) => now <= PROMO.endsAt;
/** Monthly price while the promo applies (e.g. 4.95). */
export const promoMonthly = (monthly = PLAN_PRICES.monthly.amount) => Math.round(monthly * (1 - PROMO.percentOff / 100) * 100) / 100;
