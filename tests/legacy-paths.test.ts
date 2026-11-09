import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { doubleLocaleTarget, legacyLocale, legacyRedirectTarget } from '@/lib/site/legacy-paths';
import { routing } from '@/i18n/routing';
import { STATIC_PATHS } from '@/lib/site/sitemap';
import { SITE_LEAGUES } from '@/lib/site/leagues';

// SEO Faz 0 (2026-10-17): legacy unlocalized pages 301 to the localized site.

test('legacy locale: valid cookie wins, anything else → default', () => {
  assert.equal(legacyLocale('de'), 'de');
  assert.equal(legacyLocale('tr'), 'tr');
  assert.equal(legacyLocale('fr'), 'en');
  assert.equal(legacyLocale(undefined), 'en');
});

test('/analysis/{slug} is not redirected blindly any more (route handler answers 301 or 410)', () => {
  // 2026-11-09: kör 301 kapsam dışı maçlarda 404'e çıkıyordu (SC: 60 URL 301→404).
  assert.equal(legacyRedirectTarget('/analysis/spain-vs-cape-verde-4667798', 'en'), null);
  assert.equal(legacyRedirectTarget('/analysis/bochum-vs-ajax-5847094/', 'de'), null);
  assert.equal(legacyRedirectTarget('/analysis', 'tr'), '/tr/matches');
});

test('other legacy public pages map to their replacement', () => {
  assert.equal(legacyRedirectTarget('/leaderboard', 'en'), '/en/performance');
  assert.equal(legacyRedirectTarget('/ai-performance', 'it'), '/it/performance');
  assert.equal(legacyRedirectTarget('/track-record/', 'en'), '/en/performance');
  assert.equal(legacyRedirectTarget('/match/5103654', 'en'), '/en/predictions/5103654');
  assert.equal(legacyRedirectTarget('/live', 'de'), '/de/matches');
  assert.equal(legacyRedirectTarget('/contact', 'tr'), '/tr/contact');
});

test('members-only account pages and unknown paths are not redirected', () => {
  assert.equal(legacyRedirectTarget('/favorites', 'en'), null);
  assert.equal(legacyRedirectTarget('/settings', 'en'), null);
  assert.equal(legacyRedirectTarget('/analysis/not-a-match', 'en'), null);
  assert.equal(legacyRedirectTarget('/en/matches', 'en'), null);
});

// ---------------------------------------------------------------------------
// Çift dil öneki (2026-11-09). `signInHref()` `/${locale}/login` döndürüyor,
// Paywall onu next-intl `Link`'ine veriyordu → `/en/en/login`. Bağlantı PR #218
// ile düzeldi ama Google 115 URL'yi hâlâ tutuyor ve "Düzeltmeyi doğrula" onları
// yeniden tarıyor: 404 dönmeye devam eden URL doğrulamayı geçemez.
// ---------------------------------------------------------------------------

test('çift dil öneki tek öneğe iner, yol ve dil korunur', () => {
  assert.equal(doubleLocaleTarget('/en/en/login'), '/en/login');
  assert.equal(doubleLocaleTarget('/tr/tr/predictions/5104944'), '/tr/predictions/5104944');
  // Çapraz çift (ör. NEXT_LOCALE çerezi başka dildeyken üretilmiş bağlantı):
  // İLK önek kazanır — ziyaretçinin adres çubuğundaki dil odur.
  assert.equal(doubleLocaleTarget('/de/it/matches'), '/de/matches');
  // Yolsuz hal.
  assert.equal(doubleLocaleTarget('/it/it'), '/it');
  // 16 dil çiftinin hepsi.
  for (const a of routing.locales) {
    for (const b of routing.locales) {
      assert.equal(doubleLocaleTarget(`/${a}/${b}/login`), `/${a}/login`, `${a}/${b}`);
    }
  }
});

test('tek önekli ve önceden önekli gerçek yollar dokunulmadan geçer', () => {
  for (const path of ['/en/login', '/en/matches/arsenal-vs-chelsea-123', '/tr/teams/galatasaray', '/de/leagues/bundesliga', '/', '/en', '/analysis/bochum-vs-ajax-5847094', '/api/og/match/1']) {
    assert.equal(doubleLocaleTarget(path), null, path);
  }
});

// Kural yalnız "hiçbir rota segmenti bir dil koduyla aynı adı taşımıyor"
// varsayımıyla güvenli. Biri /en/tr diye bir sayfa eklerse bu test düşsün.
test('hiçbir rota segmenti dil kodlarıyla çakışmıyor', () => {
  const locales = routing.locales as readonly string[];
  for (const p of STATIC_PATHS) {
    const first = p.split('/').filter(Boolean)[0];
    if (first) assert.ok(!locales.includes(first), `STATIC_PATHS "${p}" bir dil koduyla başlıyor`);
  }
  for (const l of SITE_LEAGUES) {
    assert.ok(!locales.includes(l.slug), `lig slug'ı "${l.slug}" bir dil kodu`);
  }
});

test('middleware yönlendirmeyi arama sorgusunu koruyarak ve intl öncesinde yapıyor', () => {
  const src = readFileSync(resolve(__dirname, '../src/middleware.ts'), 'utf8');
  assert.match(src, /doubleLocaleTarget\(path\)/, 'middleware doubleLocaleTarget çağırmıyor');
  // ?callbackUrl=… taşıyan giriş bağlantılarıydı: sorgu düşerse kullanıcı
  // giriş sonrası geldiği sayfaya dönemez.
  assert.match(src, /doubled \+ req\.nextUrl\.search/, 'yönlendirme arama sorgusunu düşürüyor');
  assert.match(src, /NextResponse\.redirect\(new URL\(doubled[^)]*\), 301\)/, 'yönlendirme 301 değil');
  assert.ok(src.indexOf('doubleLocaleTarget(path)') < src.indexOf('intlMiddleware(req)'), 'çift önek kontrolü intlMiddleware sonrasında');
});
