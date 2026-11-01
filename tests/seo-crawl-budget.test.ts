import { test } from 'node:test';
import assert from 'node:assert/strict';
import IntlMessageFormat from 'intl-messageformat';
import { buildSitemapIndexXml, buildSectionXml, entriesFor, SITEMAP_SECTIONS, sectionLastmod, isSitemapSection } from '@/lib/site/sitemap';
import { SITE_LEAGUES } from '@/lib/site/leagues';
import en from '../messages/en.json';
import de from '../messages/de.json';
import it from '../messages/it.json';
import tr from '../messages/tr.json';

// Tarama bütçesi (2026-11-01): sitemap türlere bölünür; bitmiş maçlar 'results', yaklaşanlar 'matches'.
const input = {
  dataUpdated: new Date('2026-11-01T09:00:00Z'),
  matches: [
    { path: '/matches/arsenal-vs-chelsea-1', lastmod: new Date('2026-10-30T18:30:00Z'), settled: true },
    { path: '/matches/x-vs-y-2', lastmod: new Date('2026-11-01T06:00:00Z'), settled: false },
    { path: '/matches/old-vs-older-3', lastmod: null },  // settled bilgisi yok → yaklaşan sayılır
  ],
  teams: [{ path: '/teams/arsenal', lastmod: '2026-10-30T18:30:00Z' }, { path: '/teams/newclub', lastmod: null }, '/teams/legacy-string'],
};

test('sitemap index lists the five sections with the newest lastmod of each', () => {
  const xml = buildSitemapIndexXml(input);
  assert.match(xml, /^<\?xml version="1.0" encoding="UTF-8"\?>\n<sitemapindex /);
  for (const s of SITEMAP_SECTIONS) assert.ok(xml.includes(`<loc>https://footballanalytics.pro/sitemaps/${s}.xml</loc>`), s);
  assert.equal((xml.match(/<sitemap>/g) ?? []).length, 5);
  assert.equal(sectionLastmod('results', input), '2026-10-30T18:30:00.000Z');
  assert.equal(sectionLastmod('matches', input), '2026-11-01T06:00:00.000Z');
  assert.equal(sectionLastmod('teams', input), '2026-10-30T18:30:00.000Z');
  assert.ok(isSitemapSection('teams') && !isSitemapSection('login'));
});

test('settled matches go to results (monthly), upcoming to matches (daily); sections do not overlap', () => {
  const results = buildSectionXml('results', input);
  const matches = buildSectionXml('matches', input);
  assert.ok(results.includes('/en/matches/arsenal-vs-chelsea-1</loc>') && !matches.includes('arsenal-vs-chelsea-1'));
  assert.ok(matches.includes('/de/matches/x-vs-y-2</loc>') && matches.includes('/tr/matches/old-vs-older-3</loc>'));
  assert.ok(!results.includes('x-vs-y-2'));
  assert.ok(results.includes('<changefreq>monthly</changefreq>') && !results.includes('<changefreq>daily</changefreq>'));
  assert.equal((matches.match(/<loc>/g) ?? []).length, 2 * 4);
  assert.equal(entriesFor('leagues', input).length, SITE_LEAGUES.length * 5);
  assert.equal(entriesFor('pages', input).length, 17);
});

test('team pages carry their own last-played lastmod, never the global hourly write', () => {
  const xml = buildSectionXml('teams', input);
  assert.ok(xml.includes('<lastmod>2026-10-30T18:30:00.000Z</lastmod>'));
  assert.ok(!xml.includes('<lastmod>2026-11-01T09:00:00.000Z</lastmod>'));
  assert.equal((xml.match(/<loc>/g) ?? []).length, 3 * 4);
  assert.ok(xml.includes('/it/teams/legacy-string</loc>'));
});

// Başlık/açıklama (SC 2026-11-01): gösterim alan sorgular "tabelle / classifica / puan durumu" niyetli.
test('match meta templates name the table in every locale and render with and without standings', () => {
  const must: Record<string, RegExp> = { en: /table/i, de: /Tabelle/, it: /classifica/i, tr: /puan durumu/ };
  const base = { home: 'Wrexham', away: 'Preston North End', league: 'Championship', date: '1 Nov 2026', hs: 2, as: 1 };
  for (const [name, m] of Object.entries({ en, de, it, tr }) as Array<[string, any]>) {
    const t = m.matches.match as Record<string, string>;
    for (const k of ['metaTitle', 'metaTitleSettled']) assert.match(t[k], must[name], `${name} ${k}`);
    for (const k of ['metaTitle', 'metaTitleSettled', 'metaDescription', 'metaDescriptionSettled', 'metaDescriptionRanked', 'metaDescriptionSettledRanked']) {
      const vars = k.endsWith('Ranked') ? { ...base, hpos: 3, hpts: 24, apos: 11, apts: 19 } : base;
      const out = String(new IntlMessageFormat(t[k], name === 'de' ? 'de-CH' : name).format(vars));
      assert.ok(out.length > 20 && !/\{[a-z]+\}/i.test(out), `${name} ${k}: ${out}`);
      if (k.endsWith('Ranked')) assert.ok(/24/.test(out) && /19/.test(out), `${name} ${k} lacks points: ${out}`);
    }
    // gambling-coded wording stays out of the SERP snippet
    assert.ok(!/bookmaker|buchmacher|bahis|iddaa|wett-?tipp|scommess|odds|quote/i.test(JSON.stringify(Object.values(t).filter((v) => typeof v === 'string' && /^\{/.test(v)))), `${name}: gambling-coded meta`);
  }
  // English ordinals
  const enR = String(new IntlMessageFormat((en as any).matches.match.metaDescriptionRanked, 'en').format({ ...base, hpos: 1, hpts: 30, apos: 22, apts: 5 }));
  assert.ok(enR.includes('1st') && enR.includes('22nd'), enR);
});
