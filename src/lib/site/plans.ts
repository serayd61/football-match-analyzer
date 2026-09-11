// Public plan facts for the localized pricing page. Mirrors `PLANS` in
// src/lib/stripe.ts (which cannot be imported by a page: it constructs the
// Stripe client at module load). Change prices in both places.
export const PLAN_PRICES = {
  monthly: { amount: 19.99, currency: 'USD', interval: 'month' as const, trialDays: 7, key: 'PRO' as const },
  weekly: { amount: 6.99, currency: 'USD', interval: 'week' as const, trialDays: 0, key: 'PRO_WEEKLY' as const },
};
export const money = (n: number) => `$${n.toFixed(2)}`;
