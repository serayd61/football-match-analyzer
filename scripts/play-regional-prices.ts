#!/usr/bin/env -S npx tsx
// ============================================================================
// Google Play — Afrika için bölgesel abonelik fiyatları (2026-11-16)
//
// Web'de Stripe tarafı (src/lib/site/regional.ts) Afrika IP'sine aylık $2,99 /
// yıllık $19 sunar. Play tarafında fiyat kodda değil, Play Console'daki
// abonelik ürününün base plan'ında ülke bazlı tutulur ve Play, alıcının Play
// hesabı ülkesine göre uygular (IP'ye değil). Bu betik aynı 54 ülkeye aynı
// USD karşılığını Play Developer API ile yazar; diğer ülkelere dokunmaz.
//
// Kullanım (repo kökünde):
//   npx tsx scripts/play-regional-prices.ts --sa ~/play-sa.json            # dry run: ne yazılacağını gösterir
//   npx tsx scripts/play-regional-prices.ts --sa ~/play-sa.json --apply    # yazar
//   PLAY_SERVICE_ACCOUNT_JSON='{...}' npx tsx scripts/play-regional-prices.ts --apply
//
// Gerekenler:
//   - Play Console'da fa_pro_monthly (base plan `monthly`) ve fa_pro_yearly
//     (base plan `yearly`) ürünleri (docs/play-billing.md adım 2).
//   - Service account'a Play Console'da ürün düzenleme izni: "Mağaza
//     varlığını yönetme / Store listing, pricing and distribution"
//     (verify/RTDN için verilen "Siparişleri yönetme" yetmez).
//
// Yaptığı:
//   1. pricing:convertRegionPrices ile $2,99 ve $19'u Play'in her bölge için
//      yerel para karşılığına çevirir (Play'in kendi kuru ve yuvarlaması).
//   2. Afrika bölgelerinin (regional.ts listesi ∩ Play'in desteklediği
//      bölgeler) regionalConfigs girdilerini bu fiyatla değiştirir, kalan
//      bölgeleri olduğu gibi bırakır; subscriptions.patch (updateMask=basePlans).
//   3. Mevcut aboneler eski fiyatta kalır; indirimi onlara da uygulamak
//      için --migrate ile basePlans:migratePrices çağrılır (isteğe bağlı).
// ============================================================================
import { createSign } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { REGIONAL_COUNTRIES, REGIONAL_MONTHLY, REGIONAL_YEARLY } from '../src/lib/site/regional';

const PACKAGE = process.env.PLAY_PACKAGE_NAME || 'pro.footballanalytics';
const API = 'https://androidpublisher.googleapis.com/androidpublisher/v3';
const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const SCOPE = 'https://www.googleapis.com/auth/androidpublisher';
/**
 * Play'in bölge/para tablosu sürümü — patch ve migrate çağrılarında zorunlu.
 * Sabit yazılmaz: eski sürümde bazı bölgelerin para birimi farklıdır (ör. AR
 * 2022/02'de USD, sonrasında ARS) ve Play tüm isteği 400 ile reddeder. Sürüm,
 * convertRegionPrices yanıtındaki regionVersion'dan alınır; gerekirse
 * PLAY_REGIONS_VERSION ya da --regions-version ile ezilir.
 */
export function pickRegionsVersion(override: string | undefined, fromConvert: string | undefined): string {
  const v = (override || fromConvert || '').trim();
  if (!/^\d{4}\/\d{2}$/.test(v)) throw new Error(`bölge sürümü belirlenemedi (${v || 'boş'}); --regions-version 2025/01 gibi ver`);
  return v;
}

export const TARGETS = [
  { productId: 'fa_pro_monthly', basePlanId: 'monthly', usd: REGIONAL_MONTHLY.amount },
  { productId: 'fa_pro_yearly', basePlanId: 'yearly', usd: REGIONAL_YEARLY.amount },
] as const;

type Money = { currencyCode: string; units?: string; nanos?: number };
type RegionalConfig = { regionCode: string; newSubscriberAvailability?: boolean; price?: Money };
type BasePlan = { basePlanId: string; regionalConfigs?: RegionalConfig[]; [k: string]: unknown };
type Subscription = { packageName: string; productId: string; basePlans: BasePlan[]; [k: string]: unknown };

export const usdMoney = (usd: number): Money => {
  const cents = Math.round(usd * 100);
  return { currencyCode: 'USD', units: String(Math.floor(cents / 100)), nanos: (cents % 100) * 10_000_000 };
};

export const fmt = (m: Money | undefined) => (m ? `${m.units ?? '0'}${m.nanos ? '.' + String(Math.round(m.nanos / 1e7)).padStart(2, '0') : ''} ${m.currencyCode}` : '—');

/**
 * Afrika bölgelerinin fiyatını `converted` (regionCode → yerel fiyat) ile
 * değiştirir; Play'in desteklemediği Afrika ülkeleri atlanır, diğer bölgeler
 * aynen korunur. Döner: yeni liste + hangi bölgelerin değiştiği.
 */
export function mergeRegionalConfigs(existing: RegionalConfig[] | undefined, converted: Record<string, Money>, regions: ReadonlySet<string> = REGIONAL_COUNTRIES) {
  const changed: string[] = []; const skipped: string[] = [];
  const byRegion = new Map((existing ?? []).map((c) => [c.regionCode, c] as const));
  for (const code of [...regions].sort()) {
    const price = converted[code];
    if (!price) { skipped.push(code); continue; }
    byRegion.set(code, { ...(byRegion.get(code) ?? {}), regionCode: code, newSubscriberAvailability: true, price });
    changed.push(code);
  }
  return { regionalConfigs: [...byRegion.values()], changed, skipped };
}

function loadServiceAccount(saPath: string | undefined) {
  const raw = saPath ? readFileSync(saPath, 'utf8') : process.env.PLAY_SERVICE_ACCOUNT_JSON;
  if (!raw) throw new Error('Service account yok: --sa <json yolu> ver ya da PLAY_SERVICE_ACCOUNT_JSON env');
  const sa = JSON.parse(raw) as { client_email: string; private_key: string };
  if (!sa.client_email || !sa.private_key) throw new Error('Service account JSON eksik (client_email/private_key)');
  return sa;
}

async function accessToken(sa: { client_email: string; private_key: string }) {
  const b64 = (s: string) => Buffer.from(s).toString('base64url');
  const now = Math.floor(Date.now() / 1000);
  const unsigned = `${b64(JSON.stringify({ alg: 'RS256', typ: 'JWT' }))}.${b64(JSON.stringify({ iss: sa.client_email, scope: SCOPE, aud: TOKEN_URL, iat: now, exp: now + 3600 }))}`;
  const signer = createSign('RSA-SHA256'); signer.update(unsigned);
  const jwt = `${unsigned}.${signer.sign(sa.private_key).toString('base64url')}`;
  const res = await fetch(TOKEN_URL, { method: 'POST', body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: jwt }) });
  const j = (await res.json()) as { access_token?: string; error_description?: string };
  if (!j.access_token) throw new Error(`token alınamadı: ${j.error_description || res.status}`);
  return j.access_token;
}

async function api<T>(token: string, path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API}/applications/${PACKAGE}/${path}`, { ...init, headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json', ...(init?.headers || {}) } });
  const j = (await res.json().catch(() => ({}))) as { error?: { message?: string } };
  if (!res.ok) throw new Error(`${path}: ${res.status} ${j.error?.message || ''}`);
  return j as T;
}

async function main() {
  const args = process.argv.slice(2);
  const apply = args.includes('--apply');
  const migrate = args.includes('--migrate');
  const saIdx = args.indexOf('--sa');
  const rvIdx = args.indexOf('--regions-version');
  const versionOverride = (rvIdx >= 0 ? args[rvIdx + 1] : undefined) || process.env.PLAY_REGIONS_VERSION;
  const sa = loadServiceAccount(saIdx >= 0 ? args[saIdx + 1] : undefined);
  const token = await accessToken(sa);
  console.log(`Play ${PACKAGE} — ${apply ? 'YAZILIYOR' : 'dry run'} (bölge listesi: ${REGIONAL_COUNTRIES.size} Afrika ülkesi)\n`);

  const list = await api<{ subscriptions?: Subscription[] }>(token, 'subscriptions?pageSize=50');
  const subs = new Map((list.subscriptions ?? []).map((s) => [s.productId, s] as const));

  for (const t of TARGETS) {
    const sub = subs.get(t.productId);
    if (!sub) { console.log(`✗ ${t.productId}: Play Console'da yok (docs/play-billing.md adım 2)`); continue; }
    const plan = sub.basePlans.find((b) => b.basePlanId === t.basePlanId);
    if (!plan) { console.log(`✗ ${t.productId}: base plan '${t.basePlanId}' yok (mevcut: ${sub.basePlans.map((b) => b.basePlanId).join(', ')})`); continue; }

    const conv = await api<{ convertedRegionPrices?: Record<string, { regionCode: string; price: Money; taxAmount?: Money }>; regionVersion?: { version?: string } }>(
      token, `pricing:convertRegionPrices`, { method: 'POST', body: JSON.stringify({ price: usdMoney(t.usd) }) },
    );
    const converted = Object.fromEntries(Object.values(conv.convertedRegionPrices ?? {}).map((r) => [r.regionCode, r.price]));
    const regionsVersion = pickRegionsVersion(versionOverride, conv.regionVersion?.version);
    const { regionalConfigs, changed, skipped } = mergeRegionalConfigs(plan.regionalConfigs, converted);

    console.log(`${t.productId}/${t.basePlanId} ← $${t.usd}: ${changed.length} bölge yazılacak, ${skipped.length} Play'de yok${skipped.length ? ` (${skipped.join(' ')})` : ''} — bölge sürümü ${regionsVersion}`);
    for (const code of changed) {
      const before = plan.regionalConfigs?.find((c) => c.regionCode === code)?.price;
      console.log(`  ${code}  ${fmt(before)}  →  ${fmt(converted[code])}`);
    }

    if (!apply) continue;
    const body: Subscription = { ...sub, basePlans: sub.basePlans.map((b) => (b.basePlanId === t.basePlanId ? { ...b, regionalConfigs } : b)) };
    await api(token, `subscriptions/${t.productId}?updateMask=basePlans&regionsVersion.version=${encodeURIComponent(regionsVersion)}`, { method: 'PATCH', body: JSON.stringify(body) });
    console.log(`  ✓ yazıldı`);
    if (migrate) {
      await api(token, `subscriptions/${t.productId}/basePlans/${t.basePlanId}:migratePrices`, {
        method: 'POST',
        body: JSON.stringify({ regionalPriceMigrations: changed.map((regionCode) => ({ regionCode, oldestAllowedPriceVersionTime: new Date().toISOString(), priceIncreaseType: 'PRICE_INCREASE_TYPE_OPT_OUT' })), regionsVersion: { version: regionsVersion } }),
      });
      console.log(`  ✓ mevcut aboneler yeni fiyata taşındı (${changed.length} bölge)`);
    }
  }
  if (!apply) console.log('\nYazmak için --apply ekle.');
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((e) => { console.error('HATA:', e.message); process.exit(1); });
}
