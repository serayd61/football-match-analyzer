#!/usr/bin/env node
// ============================================================================
// Stripe kurulumu — bölgesel fiyatlar: yıllık $19 + aylık $2,99 (Afrika, 2026-11-16)
// Kullanım (repo kökünde, .env.local STRIPE_SECRET_KEY ile ya da env olarak):
//   node scripts/stripe-setup-ppp.mjs            # oluşturur (idempotent)
//   node scripts/stripe-setup-ppp.mjs --dry      # yalnız mevcut durumu yazar
// Yaptığı (varsa atlar): $19/yıl (lookup pro_yearly_19_ppp) ve $2,99/ay (lookup pro_monthly_299_ppp),
// ürün prod_TXFx9DYEur3yFE. Sonra Vercel'e STRIPE_PRICE_ID_YEARLY_PPP ve
// STRIPE_PRICE_ID_MONTHLY_PPP (Production+Preview) ekle + redeploy.
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
const PRICES = [
  { lookup: 'pro_yearly_19_ppp', cents: 1900, interval: 'year', nickname: 'Pro Yearly $19 regional/Africa (2026-11-16)', plan: 'PRO_YEARLY_PPP', env: 'STRIPE_PRICE_ID_YEARLY_PPP' },
  { lookup: 'pro_monthly_299_ppp', cents: 299, interval: 'month', nickname: 'Pro Monthly $2.99 regional/Africa (2026-11-16)', plan: 'PRO_PPP', env: 'STRIPE_PRICE_ID_MONTHLY_PPP' },
];

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
const out = [];
for (const p of PRICES) {
  let price = (await api(`prices?lookup_keys[]=${p.lookup}&active=true`)).data?.[0];
  if (price) console.log(`${p.lookup}: var  ${price.id} ${price.unit_amount / 100} ${price.currency}/${price.recurring?.interval}`);
  else if (DRY) { console.log(`${p.lookup}: YOK (oluşturulacak)`); continue; }
  else {
    price = await api('prices', {
      product: PRODUCT, currency: 'usd', unit_amount: String(p.cents), [`recurring[interval]`]: p.interval,
      nickname: p.nickname, lookup_key: p.lookup, 'metadata[plan]': p.plan, 'metadata[region]': 'africa',
    });
    console.log(`${p.lookup}: OLUŞTU ${price.id}`);
  }
  out.push(`${p.env}=${price.id}`);
}
console.log('\nVercel:\n' + out.join('\n'));
