import { test } from 'node:test';
import assert from 'node:assert/strict';
import { faqPageJsonLd, datasetJsonLd, organizationJsonLd } from '@/lib/site/jsonld';
import { pickMessages, CLIENT_NAMESPACES } from '@/lib/site/messages';
import { signInHref } from '@/lib/site/access';
import en from '../messages/en.json';
import de from '../messages/de.json';
import it from '../messages/it.json';
import tr from '../messages/tr.json';

// SEO Faz 0 (2026-10-17): structured data, client message bundle, title lengths.

test('FAQPage carries every question/answer pair', () => {
  const ld = faqPageJsonLd([{ q: 'Q1', a: 'A1' }, { q: 'Q2', a: 'A2' }]);
  assert.equal(ld['@type'], 'FAQPage');
  assert.equal(ld.mainEntity.length, 2);
  assert.equal(ld.mainEntity[1].acceptedAnswer.text, 'A2');
});

test('Dataset points at the performance page and the organisation', () => {
  const ld = datasetJsonLd('de', { name: 'Bilanz', description: 'x', settled: 1234, dateModified: new Date('2026-10-16T00:00:00Z') });
  assert.equal(ld.url, 'https://footballanalytics.pro/de/performance');
  assert.equal(ld.creator['@id'], 'https://footballanalytics.pro/#organization');
  assert.equal(ld.dateModified, '2026-10-16T00:00:00.000Z');
  assert.equal(ld.isAccessibleForFree, true);
});

test('Organization lists its public profiles (sameAs)', () => {
  const [org] = organizationJsonLd('en', 'desc') as any[];
  assert.ok(org.sameAs.includes('https://t.me/fanalytics_pro'));
  assert.ok(org.sameAs.includes('https://x.com/fanalytics_pro'));
});

test('client bundle keeps only the namespaces client components read', () => {
  const picked = pickMessages(en as any);
  assert.deepEqual(Object.keys(picked).sort(), [...CLIENT_NAMESPACES].sort());
  assert.ok(JSON.stringify(picked).length < JSON.stringify(en).length / 4, 'bundle should shrink to well under a quarter');
});

test('sign-in href returns to the gated page without a redirect hop', () => {
  assert.equal(signInHref('tr', '/predictions/5'), '/login?callbackUrl=%2Ftr%2Fpredictions%2F5');
  assert.equal(signInHref('en', '/picks?date=2026-10-18', true), '/login?mode=register&callbackUrl=%2Fen%2Fpicks%3Fdate%3D2026-10-18');
});

test('titles fit in 60 characters with the site-name suffix, descriptions in 160', () => {
  const suffix = ' · Football Analytics'.length;
  for (const [name, m] of Object.entries({ en, de, it, tr }) as Array<[string, any]>) {
    for (const key of ['home.metaTitle', 'leagues.metaTitle', 'matches.hub.metaTitle', 'v2.performance.metaTitle', 'docs.methodology.metaTitle']) {
      const v = key.split('.').reduce((o, k) => o[k], m) as string;
      assert.ok(v.length + suffix <= 60, `${name} ${key} too long: ${v.length + suffix}`);
    }
    for (const key of ['home.metaDescription', 'matches.hub.metaDescription', 'matches.match.metaDescription', 'matches.match.metaDescriptionSettled', 'league.metaDescription', 'meta.description']) {
      const v = key.split('.').reduce((o, k) => o[k], m) as string;
      assert.ok(v.length <= 170, `${name} ${key} too long: ${v.length}`); // placeholders ({count}) are shorter than their values
    }
  }
});
