#!/usr/bin/env node
// ============================================================================
// Stripe kurulumu — bölgesel yıllık fiyat $19 (Afrika, 2026-11-16)
// Kullanım (repo kökünde, .env.local STRIPE_SECRET_KEY ile ya da env olarak):
//   node scripts/stripe-setup-ppp.mjs            # oluşturur (idempotent)
//   node scripts/stripe-setup-ppp.mjs --dry      # yalnız mevcut durumu yazar
// Yaptığı: price $19/yıl USD, ürün prod_TXFx9DYEur3yFE, lookup_key pro_yearly_19_ppp
// Sonra: Vercel'e STRIPE_PRICE_ID_YEARLY_PPP=<price id> (Production+Preview) ekle + redeploy.
// Ülke listesi ve seçim kuralı: src/lib/site/regional.ts
// ============================================================================
import fs from 'node:fs';

const env = fs.existsSync('.env.local')
  ? Object.fromEntries(fs.readFileSync('.env.local', 'utf8').split('\n').filter((l) => /^[A-Z_]+=/.test(l))
      .map((l) => { const i = l.indexOf('='); return [l.slice(0, i), l.slice(i + 1).replace(/^"|"$/g, '')]; }))
  : {};
const KEY = process.env.STRIPE_SECRET_KEY || env.STRIPE_SECRET_KEY;
if (!KEY) { console.error('STRIPE_SECRET_KEY yok (.env.local)'); process.exit(1); }
const DRY = process.argv.includes('--dry');

const PRODUCT = 'prod_TXFx9DYEur3yFE'; // Football Analytics Pro
const LOOKUP = 'pro_yearly_19_ppp';
const CENTS = 1900;

async function api(path, params) {
  const res = await fetch(`https://api.stripe.com/v1/${path}`, {
    method: params ? 'POST' : 'GET',
    headers: { Authorization: `Basic ${Buffer.from(`${KEY}:`).toString('base64')}`, ...(params ? { 'Content-Type': 'application/x-www-form-urlencoded' } : {}) },
    body: params ? new URLSearchParams(params).toString() : undefined,
  });
  const j = await res.json();
  if (!res.ok) throw new Error(`${path}: ${j.error?.message || res.status}`);
  return j;
}

console.log(`Stripe ${KEY.startsWith('sk_live_') ? 'LIVE' : 'test'}${DRY ? ' (dry run)' : ''}`);
let price = (await api(`prices?lookup_keys[]=${LOOKUP}&active=true`)).data?.[0];
if (price) console.log(`price : var  ${price.id} ${price.unit_amount / 100} ${price.currency}/${price.recurring?.interval}`);
else if (DRY) console.log('price : YOK (oluşturulacak)');
else {
  price = await api('prices', {
    product: PRODUCT, currency: 'usd', unit_amount: String(CENTS), 'recurring[interval]': 'year',
    nickname: 'Pro Yearly $19 regional/Africa (2026-11-16)', lookup_key: LOOKUP, 'metadata[plan]': 'PRO_YEARLY_PPP', 'metadata[region]': 'africa',
  });
  console.log(`price : OLUŞTU ${price.id}`);
}
console.log(`\nVercel: STRIPE_PRICE_ID_YEARLY_PPP=${price.id}`);
