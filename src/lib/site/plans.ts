// Public plan facts for the localized pricing page. Mirrors `PLANS` in
// src/lib/stripe.ts (which cannot be imported by a page: it constructs the
// Stripe client at module load). Change prices in both places.
// 2026-10-13: monthly $19.90 → $9.90, no Stripe trial (the 7 free days come
// from registration, card-free; checkout charges immediately). Weekly plan
// removed the same day (Stripe price archived); Pro is monthly only.
export const PLAN_PRICES = {
  monthly: { amount: 9.90, currency: 'USD', interval: 'month' as const, trialDays: 0, key: 'PRO' as const },
};
export const money = (n: number) => `$${n.toFixed(2)}`;
