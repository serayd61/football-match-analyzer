import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { SITE_LEAGUES } from '@/lib/site/leagues';

// PageSpeed Insights 2026-11-09 (masaüstü): SEO 92 — "robots.txt geçerli değil:
// Timed out fetching resource"; Ajan Tabanlı Tarama 2/3 — "llms.txt: Timed out".
// Lighthouse iki dosyayı da sayfadan bağımsız fetch eder. llms.txt hiç yoktu
// (sunucuda render edilen 404 HTML, 300–530 ms, CDN MISS); robots.txt Vercel
// varsayılanı `max-age=0, must-revalidate` ile servis ediliyordu. Düzeltme:
// public/llms.txt + iki dosyaya next.config `headers()` ile uzun Cache-Control.

const ROOT = resolve(__dirname, '..');
const LLMS = resolve(ROOT, 'public/llms.txt');
const SITE = 'https://footballanalytics.pro';

test('public/llms.txt var ve llmstxt.org biçiminde (H1 + özet alıntı + bölümler)', () => {
  assert.ok(existsSync(LLMS), 'public/llms.txt yok — Lighthouse ajan taraması 404 alır');
  const txt = readFileSync(LLMS, 'utf8');
  assert.match(txt, /^# Football Analytics\n/, 'ilk satır H1 olmalı');
  assert.match(txt, /\n> .{80,}\n/, 'H1 altında tek paragraf blok-alıntı özet olmalı');
  assert.ok(txt.includes(`> AI football analysis and statistical match predictions for ${SITE_LEAGUES.length} `), `özetteki lig sayısı SITE_LEAGUES (${SITE_LEAGUES.length}) ile aynı olmalı`);
  for (const h of ['## Core pages', '## Covered leagues', '## How the model works', '## Open data', '## Optional']) {
    assert.ok(txt.includes(h), `bölüm eksik: ${h}`);
  }
  assert.ok(!/localhost|vercel\.app/.test(txt), 'llms.txt yalnız üretim adreslerini listelemeli');
});

test('llms.txt her kapsam ligini ve belge sayfalarını mutlak URL ile listeler', () => {
  const txt = readFileSync(LLMS, 'utf8');
  for (const l of SITE_LEAGUES) {
    assert.ok(txt.includes(`${SITE}/en/leagues/${l.slug})`), `lig eksik: ${l.slug} (SITE_LEAGUES ile llms.txt ayrıştı)`);
  }
  for (const p of ['/en/methodology', '/en/glossary', '/en/about', '/en/data', '/en/teams', '/en/performance', '/en/matches', '/sitemap.xml']) {
    assert.ok(txt.includes(`${SITE}${p})`), `sayfa eksik: ${p}`);
  }
  assert.ok(txt.includes(`${SITE}/data/all.csv`) && txt.includes(`${SITE}/data/all.json`), 'açık veri dosyaları eksik');
  // Bağlantı sayısı makul: dosya bir dizin, sitemap kopyası değil.
  const links = txt.match(/\]\(https?:\/\/[^)]+\)/g) ?? [];
  assert.ok(links.length >= 25 && links.length <= 80, `bağlantı sayısı ${links.length}`);
});

test('robots.txt ve llms.txt next.config headers() ile uzun Cache-Control alır', () => {
  const cfg = readFileSync(resolve(ROOT, 'next.config.js'), 'utf8');
  const block = /async headers\(\)\s*\{([\s\S]*?)\n  \},/.exec(cfg);
  assert.ok(block, 'next.config.js içinde headers() yok');
  for (const src of ['/robots.txt', '/llms.txt']) {
    assert.ok(block[1].includes(`source: '${src}'`), `${src} için header kuralı yok`);
  }
  const cc = /Cache-Control',\s*value:\s*'([^']+)'/.exec(block[1]);
  assert.ok(cc, 'Cache-Control değeri bulunamadı');
  const maxAge = Number(/(?:^|,\s*)max-age=(\d+)/.exec(cc[1])?.[1]);
  const sMaxAge = Number(/s-maxage=(\d+)/.exec(cc[1])?.[1]);
  assert.ok(maxAge >= 3600, `tarayıcı max-age ${maxAge} < 3600`);
  assert.ok(sMaxAge >= 86400, `CDN s-maxage ${sMaxAge} < 86400`);
  assert.match(cc[1], /^public,/, 'CDN tutabilsin diye public olmalı');
});

test('middleware robots.txt ve llms.txt için çalışmaz (next-intl yönlendirmesi/gecikme olmasın)', () => {
  const src = readFileSync(resolve(ROOT, 'src/middleware.ts'), 'utf8');
  const block = /export const config = \{\s*matcher:\s*\[([\s\S]*?)\]\s*,?\s*\}/.exec(src);
  assert.ok(block);
  const patterns = [...block[1].matchAll(/'([^']+)'/g)].map((m) => m[1]);
  for (const path of ['/robots.txt', '/llms.txt', '/sitemap.xml']) {
    const hit = patterns.find((p) => {
      const rx = p.replace(/\/:[A-Za-z0-9_]+\*/g, '(?:/.*)?').replace(/:[A-Za-z0-9_]+/g, '[^/]+');
      return new RegExp(`^${rx}$`).test(path);
    });
    assert.equal(hit, undefined, `${path} middleware matcher'ına takılıyor: ${hit}`);
  }
});
