import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sportsEventsJsonLd } from '@/lib/site/jsonld';
import { venueFor } from '@/lib/site/stadiums';
import { leagueCountryName } from '@/lib/site/countries';
import { leagueBySlug } from '@/lib/site/leagues';
import { buildSitemapXml } from '@/lib/site/sitemap';
import type { SitePrediction } from '@/lib/site/predictions';

// SEO denetimi 2026-10-10: SportsEvent JSON-LD, localised country names, image sitemap.

const row = (over: Partial<SitePrediction>): SitePrediction => ({
  fixtureId: 1, league: leagueBySlug('premier-league'), leagueName: 'Premier League', leagueId: 47, covered: true,
  homeId: 9825, homeName: 'Arsenal', awayId: 8455, awayName: 'Chelsea', homeCrest: null, awayCrest: null,
  kickoff: '2026-10-18T15:30:00Z', pHome: 0.5, pDraw: 0.25, pAway: 0.25, lambdaHome: null, lambdaAway: null, pick: '1',
  confidence: null, confidenceRaw: null, doubleChance: null as any, overUnder: null, btts: null, rationale: null,
  settled: false, homeScore: null, awayScore: null, result: null, outcome: 'pending', modelVersion: null, updatedAt: null,
  hasModel: true, status: 'scheduled', modelStatus: 'rated' as any, publishedAfterKickoff: false, ...over,
});

test('venue registry: generated entry, hand override, unknown id', () => {
  assert.equal(venueFor(9825)?.venue, 'Emirates Stadium'); // football-data
  assert.equal(venueFor(9937)?.venue, 'Gtech Community Stadium'); // hand override beats stale "Griffin Park"
  assert.equal(venueFor(8637)?.city, 'İstanbul'); // Süper Lig hand entry
  assert.equal(venueFor(999999999), null);
  assert.equal(venueFor(null), null);
});

test('SportsEvent carries the required fields and skips unknown venues / finished matches', () => {
  const league = leagueBySlug('premier-league')!;
  const rows = [row({}), row({ fixtureId: 2, homeId: 999999999 }), row({ fixtureId: 3, status: 'finished', settled: true }), row({ fixtureId: 4, status: 'postponed' })];
  const events = sportsEventsJsonLd('en', league, rows, (r) => `${r.homeName} v ${r.awayName}`);
  assert.deepEqual(events.map((e) => e['@id']), [
    'https://footballanalytics.pro/en/leagues/premier-league#fixture-1',
    'https://footballanalytics.pro/en/leagues/premier-league#fixture-4',
  ]);
  const e = events[0];
  assert.equal(e['@type'], 'SportsEvent');
  assert.equal(e.name, 'Arsenal vs Chelsea');
  assert.equal(e.startDate, '2026-10-18T15:30:00.000Z');
  assert.equal(e.location.name, 'Emirates Stadium');
  assert.equal(e.location.address.addressCountry, 'GB');
  assert.equal(e.location.address.streetAddress, '75 Drayton Park London N5 1BU');
  assert.equal(e.eventStatus, 'https://schema.org/EventScheduled');
  assert.equal(events[1].eventStatus, 'https://schema.org/EventPostponed');
  assert.equal(e.homeTeam.name, 'Arsenal');
  assert.equal(e.organizer.name, 'Premier League');
});

test('league country line is localised', () => {
  const bl = leagueBySlug('bundesliga')!;
  assert.equal(leagueCountryName(bl, 'en'), 'Germany');
  assert.equal(leagueCountryName(bl, 'de'), 'Deutschland');
  assert.equal(leagueCountryName(bl, 'it'), 'Germania');
  assert.equal(leagueCountryName(bl, 'tr'), 'Almanya');
  assert.equal(leagueCountryName(leagueBySlug('premier-league')!, 'tr'), 'İngiltere');
  assert.equal(leagueCountryName(leagueBySlug('champions-league')!, 'tr'), 'Avrupa');
});

test('sitemap XML lists every locale with hreflang links, the content images and the public match pages', () => {
  const xml = buildSitemapXml({
    dataUpdated: new Date('2026-10-10T09:00:00Z'),
    matches: [{ path: '/matches/arsenal-vs-chelsea-1', lastmod: new Date('2026-10-09T18:30:00Z') }, { path: '/matches/x-vs-y-2', lastmod: null }],
  });
  assert.match(xml, /^<\?xml version="1.0" encoding="UTF-8"\?>\n<urlset /);
  assert.ok(xml.includes('xmlns:image="http://www.google.com/schemas/sitemap-image/1.1"'));
  const urls = xml.match(/<loc>[^<]+<\/loc>/g)!;
  assert.equal(urls.length, (9 + 11 + 2) * 4); // 9 static pages + 11 leagues + 2 matches, 4 locales
  assert.ok(urls.includes('<loc>https://footballanalytics.pro/tr/leagues/super-lig</loc>'));
  assert.ok(urls.includes('<loc>https://footballanalytics.pro/de/matches/arsenal-vs-chelsea-1</loc>'));
  assert.ok(urls.includes('<loc>https://footballanalytics.pro/en/matches</loc>'));
  assert.ok(xml.includes('<xhtml:link rel="alternate" hreflang="x-default" href="https://footballanalytics.pro/en/methodology"/>'));
  assert.ok(xml.includes('<xhtml:link rel="alternate" hreflang="it" href="https://footballanalytics.pro/it/matches/arsenal-vs-chelsea-1"/>'));
  assert.equal((xml.match(/<image:loc>https:\/\/footballanalytics\.pro\/images\/prediction-track-record-hit-rate-roi\.png<\/image:loc>/g) ?? []).length, 8); // home + methodology × 4 locales
  // lastmod: real data write for data pages, the row's updated_at for a match, the doc revision for docs — never "now"
  assert.ok(xml.includes('<lastmod>2026-10-10T09:00:00.000Z</lastmod>'));
  assert.ok(xml.includes('<lastmod>2026-10-09T18:30:00.000Z</lastmod>'));
  assert.ok(xml.includes('<lastmod>2026-09-04T12:00:00.000Z</lastmod>'));
  const todayIso = new Date().toISOString().slice(0, 13);
  assert.ok(!xml.includes(`<lastmod>${todayIso}`), 'lastmod must not be the request time');
  assert.ok(!xml.includes('/predictions'));
  assert.ok(!xml.includes('/login'));
  assert.ok(!xml.includes('/dashboard'));
});

test('sitemap without database input still lists the static pages, without lastmod on data pages', () => {
  const xml = buildSitemapXml();
  assert.equal(xml.match(/<loc>[^<]+<\/loc>/g)!.length, (9 + 11) * 4);
  assert.ok(!xml.includes('<loc>https://footballanalytics.pro/en</loc>\n    <lastmod>'));
});
