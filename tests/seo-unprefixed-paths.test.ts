import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { STATIC_PATHS } from '@/lib/site/sitemap';
import { SITE_LEAGUES } from '@/lib/site/leagues';

// 2026-11-08: /teams, /glossary, /app ve /performance/{lig} dil öneki olmadan
// 404 dönüyordu (SC: 115 "Bulunamadı"). Hepsi sitemap'te ve iç linki olan
// herkese açık sayfa; eksik olan tek şey middleware'in matcher listesiydi.
//
// `config.matcher` Next tarafından statik çözülmek zorunda, yani ayrı bir
// modülden import edilemez — bu yüzden test dosyayı okuyup diziyi ayıklıyor.

const SRC = readFileSync(resolve(__dirname, '../src/middleware.ts'), 'utf8');

function matcherPatterns(): string[] {
  const block = /export const config = \{\s*matcher:\s*\[([\s\S]*?)\]\s*,?\s*\}/.exec(SRC);
  assert.ok(block, 'middleware.ts içinde config.matcher dizisi bulunamadı');
  return [...block[1].matchAll(/'([^']+)'/g)].map((m) => m[1]);
}

/** Next matcher kalıbının bir yolu eşleyip eşlemediği (kullanılan alt küme: `:name*`, `(a|b)`). */
function matches(pattern: string, path: string): boolean {
  const rx = pattern
    .replace(/\/:[A-Za-z0-9_]+\*/g, '(?:/.*)?') // `/:path*` → sıfır ya da daha fazla segment
    .replace(/:[A-Za-z0-9_]+/g, '[^/]+');
  return new RegExp(`^${rx}$`).test(path);
}

test('matcher ayıklayıcı beklendiği gibi çalışır', () => {
  const pats = matcherPatterns();
  assert.ok(pats.includes('/'), 'kök yol listede olmalı');
  assert.ok(pats.length > 20, `matcher kalıpları ayıklanamadı (${pats.length})`);
  // `:path*` sıfır segmenti de eşler (canlıda doğrulandı: /matches → 307 /en/matches)
  assert.ok(matches('/matches/:path*', '/matches'));
  assert.ok(matches('/matches/:path*', '/matches/today'));
  assert.ok(!matches('/matches/:path*', '/matchesx'));
  assert.ok(matches('/(en|de|it|tr)/:path*', '/de/teams'));
});

test('sitemap\'teki her statik sayfa dil öneki olmadan da middleware\'e düşer (404 değil)', () => {
  const pats = matcherPatterns();
  for (const p of STATIC_PATHS) {
    const path = p === '' ? '/' : p;
    assert.ok(pats.some((pat) => matches(pat, path)), `${path} hiçbir matcher kalıbıyla eşleşmiyor → 404`);
  }
});

test('lig alt sayfaları ve lig karnesi de kapsanıyor', () => {
  const pats = matcherPatterns();
  const slug = SITE_LEAGUES[0].slug;
  for (const path of [`/leagues/${slug}`, `/leagues/${slug}/results`, `/leagues/${slug}/xg-table`, `/leagues/${slug}/goals`, `/performance/${slug}`, '/teams/arsenal', '/glossary', '/app']) {
    assert.ok(pats.some((pat) => matches(pat, path)), `${path} hiçbir matcher kalıbıyla eşleşmiyor → 404`);
  }
});

test('/results kalıcı yönlendirme (308) — birleşme 2026-09-11\'de kalıcıydı', () => {
  const page = readFileSync(resolve(__dirname, '../src/app/(site)/[locale]/results/page.tsx'), 'utf8');
  assert.match(page, /permanentRedirect\(`\/\$\{locale\}\/performance/);
  // Yorum satırlarında "redirect()" geçiyor; ölçüt import satırı.
  const imports = page.split('\n').filter((l) => l.startsWith('import'));
  assert.ok(imports.some((l) => l.includes('permanentRedirect')), 'permanentRedirect import edilmeli');
  assert.ok(!imports.some((l) => /\{[^}]*\bredirect\b[^}]*\}/.test(l)), 'geçici redirect hâlâ import ediliyor');
});

test('robots.txt /api/ altında yalnız OG görsellerini açar', () => {
  // 2026-11-09: app/robots.ts → public/robots.txt (PSI "robots.txt zaman aşımı";
  // statik dosya tek Cache-Control ile iner, middleware/render yok).
  const txt = readFileSync(resolve(__dirname, '../public/robots.txt'), 'utf8');
  const directive = (name: string) =>
    txt.split('\n').filter((l) => l.startsWith(`${name}:`)).map((l) => l.slice(name.length + 1).trim());
  const allow = directive('Allow');
  const disallow = directive('Disallow');
  assert.equal(directive('User-Agent')[0] ?? directive('User-agent')[0], '*');
  assert.deepEqual(directive('Sitemap'), ['https://footballanalytics.pro/sitemap.xml']);
  assert.ok(!/^\s*$/m.test(txt.split('User-Agent')[1].split('Host')[0].trim()), 'kural bloğu boş');
  assert.ok(allow.includes('/api/og/'), 'maç OG kartı robots ile engelliyse Google görseli çekemez');
  assert.ok(disallow.includes('/api/'), '/api/ geri kalanı kapalı kalmalı');
  // Daha uzun `allow` kuralı kazanır, ama sitemap'e hiçbir /api yolu girmemeli.
  assert.ok(!allow.includes('/api/'));
});
