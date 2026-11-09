import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';

// SC "Bulunamadı (404)" (2026-11-09): 60 eski /analysis/{slug} URL'si 301 → /{l}/matches/{slug}
// → 404 zinciriyle duruyordu (kapsam dışı lig). Artık app/(app)/analysis/[slug]/route.ts
// veritabanına bakar: maç herkese açık sayfada varsa tek hop 301, yoksa 410.

const ROOT = resolve(__dirname, '..');
const SEG = resolve(ROOT, 'src/app/(app)/analysis/[slug]');
const ROUTE = readFileSync(resolve(SEG, 'route.ts'), 'utf8');

test('eski /analysis/[slug] segmentinde yalnız route.ts var (page.tsx ile aynı segmentte duramaz)', () => {
  const files = readdirSync(SEG);
  assert.deepEqual(files, ['route.ts'], `segment: ${files.join(', ')}`);
  assert.ok(!existsSync(resolve(SEG, 'page.tsx')));
});

test('route.ts: maç varsa kanonik slug ile 301, yoksa 410; maç sayfasıyla aynı yükleyici', () => {
  assert.match(ROUTE, /export async function GET\(/);
  assert.match(ROUTE, /export const dynamic = 'force-dynamic'/);
  assert.match(ROUTE, /getPublicMatch\(id\)/, 'MatchPage ile aynı fonksiyon: 410 ancak sayfa da 404 verecekse');
  assert.match(ROUTE, /fixtureIdFromSlug\(params\.slug\)/);
  assert.match(ROUTE, /NextResponse\.redirect\([\s\S]*?\/\$\{locale\}\/matches\/\$\{m\.slug\}[\s\S]*?,\s*301\)/, 'kanonik slug + 301');
  assert.match(ROUTE, /status: 410/);
  assert.match(ROUTE, /legacyLocale\(req\.cookies\.get\('NEXT_LOCALE'\)/, 'dil tercihi middleware ile aynı kaynaktan');
  assert.ok(!/notFound\(/.test(ROUTE), '404 değil 410');
});

test('middleware matcher /analysis/:path* içermez ama /analysis dizinini korur; helper slug için null döner', () => {
  const src = readFileSync(resolve(ROOT, 'src/middleware.ts'), 'utf8');
  const block = /export const config = \{\s*matcher:\s*\[([\s\S]*?)\]\s*,?\s*\}/.exec(src);
  assert.ok(block);
  const patterns = [...block[1].matchAll(/'([^']+)'/g)].map((m) => m[1]);
  assert.ok(!patterns.includes('/analysis/:path*'), 'middleware rotadan önce 301 atarsa 410 hiç çalışmaz');
  assert.ok(patterns.includes('/analysis'));
  const legacy = readFileSync(resolve(ROOT, 'src/lib/site/legacy-paths.ts'), 'utf8');
  assert.ok(!/MATCH_SLUG/.test(legacy), 'legacy-paths helper slug dalını hâlâ taşıyor');
});
