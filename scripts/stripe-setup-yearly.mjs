#!/usr/bin/env node
// ============================================================================
// Stripe kurulumu — yıllık plan + yıl sonu PRO50 kodu (2026-11-04)
// Kullanım (repo kökünde, .env.local STRIPE_SECRET_KEY ile):
//   node scripts/stripe-setup-yearly.mjs            # oluşturur (idempotent)
//   node scripts/stripe-setup-yearly.mjs --dry      # yalnız mevcut durumu yazar
// Yaptıkları (hepsi varsa atlanır):
//   1. price  : $49/yıl USD, ürün prod_TXFx9DYEur3yFE, lookup_key pro_yearly_49
//   2. coupon : PRO50 — %50, 3 ay tekrar (repeating), yalnız bu ürün
//   3. promo  : PRO50 — 31 Ara 2026 23:59 UTC'ye kadar, yalnız ilk ödeme (first_time_transaction)
// Sonra: Vercel'e STRIPE_PRICE_ID_YEARLY=<price id> (Production+Preview, Sensitive) ekle + redeploy.
// Not: Checkout'ta kupon alanı yalnız aylık planda açık (src/lib/stripe.ts).
// ============================================================================
import fs from 'node:fs';

const env = Object.fromEntries(
  fs.readFileSync('.env.local', 'utf8').split('\n').filter((l) => /^[A-Z_]+=/.test(l))
    .map((l) => { const i = l.indexOf('='); return [l.slice(0, i), l.slice(i + 1).replace(/^"|"$/g, '')]; }),
);
const KEY = process.env.STRIPE_SECRET_KEY || env.STRIPE_SECRET_KEY;
if (!KEY) { console.error('STRIPE_SECRET_KEY yok (.env.local)'); process.exit(1); }
const DRY = process.argv.includes('--dry');

const PRODUCT = 'prod_TXFx9DYEur3yFE'; // Football Analytics Pro
const LOOKUP = 'pro_yearly_49';
const YEARLY_CENTS = 4900;
const CODE = 'PRO50';
const EXPIRES = Math.floor(Date.parse('2026-12-31T23:59:59Z') / 1000);

async function api(path, params) {
  const res = await fetch(`https://api.stripe.com/v1/${path}`, {
    method: params ? 'POST' : 'GET',
    headers: { Authorization: `Basic ${Buffer.from(`${KEY}:`).toString('base64')}`, ...(params ? { 'Content-Type': 'application/x-www-form-urlencoded' } : {}) },
    body: params ? new URLSearchParams(params).toString() : undefined,
  });
  const j = await res.json();
  if (!res.ok && !(res.status === 404 && !params)) throw new Error(`${path}: ${j.error?.message || res.status}`);
  return j;
}

const mode = KEY.startsWith('sk_live_') ? 'LIVE' : 'test';
console.log(`Stripe ${mode}${DRY ? ' (dry run)' : ''}`);

// 1. yearly price
let price = (await api(`prices?lookup_keys[]=${LOOKUP}&active=true`)).data?.[0];
if (price) console.log(`price   : var  ${price.id} ${price.unit_amount / 100} ${price.currency}/${price.recurring?.interval}`);
else if (DRY) console.log('price   : YOK (oluşturulacak)');
else {
  price = await api('prices', {
    product: PRODUCT, currency: 'usd', unit_amount: String(YEARLY_CENTS), 'recurring[interval]': 'year',
    nickname: 'Pro Yearly $49 (2026-11-04)', lookup_key: LOOKUP, 'metadata[plan]': 'PRO_YEARLY',
  });
  console.log(`price   : OLUŞTU ${price.id}`);
}

// 2. coupon
let coupon = await api(`coupons/${CODE}`);
if (coupon?.id) console.log(`coupon  : var  ${coupon.id} ${coupon.percent_off}% ${coupon.duration} ${coupon.duration_in_months || ''}`);
else if (DRY) console.log('coupon  : YOK (oluşturulacak)');
else {
  coupon = await api('coupons', {
    id: CODE, name: 'Pro 50% off first 3 months', percent_off: '50', duration: 'repeating', duration_in_months: '3',
    'applies_to[products][]': PRODUCT, 'metadata[campaign]': 'yearend-2026',
  });
  console.log(`coupon  : OLUŞTU ${coupon.id}`);
}

// 3. promotion code
let promo = (await api(`promotion_codes?code=${CODE}`)).data?.[0];
if (promo) console.log(`promo   : var  ${promo.id} active=${promo.active} expires=${promo.expires_at ? new Date(promo.expires_at * 1000).toISOString() : '-'}`);
else if (DRY) console.log('promo   : YOK (oluşturulacak)');
else {
  // Yeni API sürümleri `promotion[coupon]`, eskiler `coupon` ister; sırayla dene.
  const base = { code: CODE, expires_at: String(EXPIRES), 'restrictions[first_time_transaction]': 'true', 'metadata[campaign]': 'yearend-2026' };
  try {
    promo = await api('promotion_codes', { 'promotion[type]': 'coupon', 'promotion[coupon]': CODE, ...base });
  } catch (e) {
    if (!/unknown parameter: promotion/i.test(String(e.message))) throw e;
    promo = await api('promotion_codes', { coupon: CODE, ...base });
  }
  console.log(`promo   : OLUŞTU ${promo.id}`);
}

if (price?.id) {
  console.log('\nVercel env (Production + Preview, Sensitive), sonra redeploy:');
  console.log(`  STRIPE_PRICE_ID_YEARLY=${price.id}`);
}
