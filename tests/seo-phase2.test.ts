import { test } from 'node:test';
import assert from 'node:assert/strict';
import IntlMessageFormat from 'intl-messageformat';
import { toOpenDataRow, toCsv, toJson, csvCell, parseOpenDataFile, openDataNames, openDataMeta, countByLeague, OPEN_DATA_COLUMNS, OPEN_DATA_LICENSE } from '@/lib/site/open-data';
import { PREMIUM_FIELDS } from '@/lib/site/match-public';
import { openDatasetJsonLd } from '@/lib/site/jsonld';
import { STATIC_PATHS, entries } from '@/lib/site/sitemap';
import { SITE_LEAGUES } from '@/lib/site/leagues';
import type { SitePrediction } from '@/lib/site/predictions';
import en from '../messages/en.json';
import de from '../messages/de.json';
import it from '../messages/it.json';
import tr from '../messages/tr.json';

// SEO Faz 2.1 (2026-10-17): open data — settled model predictions as CSV/JSON.
const pred = (o: Partial<SitePrediction>): SitePrediction => ({
  fixtureId: 4193188, league: SITE_LEAGUES[0], leagueName: 'Premier League', leagueId: 47, covered: true,
  homeId: 1, homeName: 'Arsenal', awayId: 2, awayName: 'Chelsea', homeCrest: null, awayCrest: null,
  kickoff: '2026-09-13T15:30:00+00:00', pHome: 0.51234, pDraw: 0.24, pAway: 0.24766, lambdaHome: 1.71, lambdaAway: 1.02,
  pick: '1', confidence: 0.5, confidenceRaw: 0.5, confidenceCalibrated: false, calibrationSegment: null,
  doubleChance: null as any, overUnder: null, btts: null, rationale: 'secret', settled: true, homeScore: 2, awayScore: 1,
  result: 'H', outcome: 'won', modelVersion: 'dc-1.0', updatedAt: '2026-09-13T18:00:00Z', hasModel: true, status: 'finished' as any,
  modelStatus: 'ready' as any, publishedAfterKickoff: false, ...o,
});

test('open data: a settled match becomes one flat row; result and pick_correct derive from the score', () => {
  const r = toOpenDataRow(pred({}))!;
  assert.ok(r);
  assert.equal(r.kickoff_utc, '2026-09-13T15:30:00.000Z');
  assert.equal(r.league_slug, 'premier-league'); assert.equal(r.country, 'England');
  assert.equal(r.result, '1'); assert.equal(r.pick, '1'); assert.equal(r.pick_correct, 1);
  assert.equal(r.p_home, 0.5123); assert.equal(r.p_away, 0.2477);
  assert.equal(r.match_url, 'https://footballanalytics.pro/en/matches/arsenal-vs-chelsea-4193188');
  assert.deepEqual(Object.keys(r), OPEN_DATA_COLUMNS, 'row keys are the documented columns, in order');
  assert.equal(toOpenDataRow(pred({ homeScore: 1, awayScore: 1, pick: '2' }))!.pick_correct, 0);
  const noPick = toOpenDataRow(pred({ pick: null }))!;
  assert.equal(noPick.pick, ''); assert.equal(noPick.pick_correct, '');
  assert.equal(toOpenDataRow(pred({ lambdaHome: null }))!.lambda_home, null);
});

test('open data: upcoming, unscored, uncovered and unrated matches never leave the server', () => {
  assert.equal(toOpenDataRow(pred({ settled: false, homeScore: null, awayScore: null })), null, 'upcoming');
  assert.equal(toOpenDataRow(pred({ settled: true, homeScore: null, awayScore: null })), null, 'settled without score (void)');
  assert.equal(toOpenDataRow(pred({ league: null, covered: false })), null, 'uncovered league');
  assert.equal(toOpenDataRow(pred({ hasModel: false })), null, 'no model figures');
  // the premium fields that are *not* part of the public record stay out of the row
  const r = toOpenDataRow(pred({}))!;
  for (const k of ['rationale', 'confidence', 'confidenceRaw', 'doubleChance', 'overUnder', 'btts', 'outcome', 'modelStatus']) assert.ok(!(k in r), `${k} leaked`);
  assert.ok((PREMIUM_FIELDS as readonly string[]).includes('rationale'));
});

test('open data: CSV is RFC 4180 (quoted commas/quotes, CRLF) and JSON carries licence + provenance', () => {
  assert.equal(csvCell('Brighton & Hove Albion'), 'Brighton & Hove Albion');
  assert.equal(csvCell('Inter, Milan'), '"Inter, Milan"');
  assert.equal(csvCell('St "Pauli"'), '"St ""Pauli"""');
  assert.equal(csvCell(null), '');
  const rows = [toOpenDataRow(pred({}))!, toOpenDataRow(pred({ fixtureId: 2, homeName: 'Inter, Milan', kickoff: '2026-09-14T18:45:00Z', pick: null }))!];
  const csv = toCsv(rows);
  const lines = csv.split('\r\n');
  assert.equal(lines[0], OPEN_DATA_COLUMNS.join(','));
  assert.equal(lines.length, 4, 'header + 2 rows + trailing CRLF');
  assert.ok(lines[2].startsWith('2,2026-09-14T18:45:00.000Z,Premier League,premier-league,England,"Inter, Milan",Chelsea,2,1,1,'));
  assert.ok(lines[2].endsWith(',,,dc-1.0,https://footballanalytics.pro/en/matches/inter-milan-vs-chelsea-2'), lines[2]);
  const meta = openDataMeta('all', rows, new Date('2026-10-17T12:00:00Z'));
  assert.deepEqual(meta, { name: 'all', generated_at: '2026-10-17T12:00:00.000Z', rows: 2, first_kickoff_utc: '2026-09-13T15:30:00.000Z', last_kickoff_utc: '2026-09-14T18:45:00.000Z' });
  const j = JSON.parse(toJson(rows, meta));
  assert.equal(j.license, OPEN_DATA_LICENSE);
  assert.equal(j.documentation, 'https://footballanalytics.pro/en/data');
  assert.deepEqual(j.columns, OPEN_DATA_COLUMNS);
  assert.equal(j.rows, 2); assert.equal(j.data.length, 2); assert.equal(j.data[1].home_team, 'Inter, Milan');
  assert.deepEqual(countByLeague(rows), { 'premier-league': 2 });
});

test('open data: file names are "all" plus the covered league slugs, csv or json only', () => {
  assert.deepEqual(openDataNames(), ['all', ...SITE_LEAGUES.map((l) => l.slug)]);
  assert.deepEqual(parseOpenDataFile('all.csv'), { name: 'all', ext: 'csv' });
  assert.deepEqual(parseOpenDataFile('super-lig.json'), { name: 'super-lig', ext: 'json' });
  for (const bad of ['all.xml', 'nope.csv', 'all', '../all.csv', 'ALL.CSV', 'all.csv.json']) assert.equal(parseOpenDataFile(bad), null, bad);
});

test('open data: Dataset JSON-LD lists one CSV and one JSON distribution per file with the licence', () => {
  const d = openDatasetJsonLd('de', { name: 'N', description: 'D', rows: 12, dateModified: new Date('2026-10-17T10:00:00Z'), license: OPEN_DATA_LICENSE, since: '2026-06-01', files: [{ name: 'All', csv: '/data/all.csv', json: '/data/all.json' }, { name: 'Bundesliga', csv: '/data/bundesliga.csv', json: '/data/bundesliga.json' }] });
  assert.equal(d.url, 'https://footballanalytics.pro/de/data');
  assert.equal(d.license, 'https://creativecommons.org/licenses/by/4.0/');
  assert.equal(d.distribution.length, 4);
  assert.deepEqual(d.distribution[1], { '@type': 'DataDownload', name: 'All (JSON)', encodingFormat: 'application/json', contentUrl: 'https://footballanalytics.pro/data/all.json' });
  assert.equal(d.distribution[2].contentUrl, 'https://footballanalytics.pro/data/bundesliga.csv');
  assert.equal(d.size, '12 settled matches');
  assert.equal(d.temporalCoverage, '2026-06-01/..');
});

test('open data: /data is in the sitemap and the footer label exists in every locale', () => {
  assert.ok((STATIC_PATHS as readonly string[]).includes('/data'));
  assert.ok(entries({ dataUpdated: null, matches: [] }).some((e) => e.path === '/data'));
  for (const [name, m] of Object.entries({ en, de, it, tr }) as Array<[string, any]>) {
    assert.ok(m.nav.data, `${name}: nav.data`);
    assert.ok(m.league.downloadCsv, `${name}: league.downloadCsv`);
  }
});

test('open data: the four locales carry the same keys, every column is documented, strings compile', () => {
  const keys = (o: any) => Object.keys(o).sort();
  const ref = keys(en.openData);
  for (const [name, m] of Object.entries({ en, de, it, tr }) as Array<[string, any]>) {
    assert.deepEqual(keys(m.openData), ref, `${name}: openData keys differ`);
    assert.deepEqual(keys(m.openData.cols), [...OPEN_DATA_COLUMNS].sort(), `${name}: column docs`);
    assert.equal(m.openData.caveats.length, 6, `${name}: caveats`);
    assert.equal(m.openData.faqs.length, 4, `${name}: faqs`);
    for (const f of m.openData.faqs) assert.ok(f.q.endsWith('?') && f.a.length > 60, `${name}: faq ${f.q}`);
    for (const [k, v] of Object.entries(m.openData)) {
      if (typeof v !== 'string') continue;
      const out = new IntlMessageFormat(v, name).format({ n: '1,234', leagues: 11, from: 'x', to: 'y', year: 2026, url: 'u', license: 'L' });
      assert.ok(typeof out === 'string' && !/\{/.test(out), `${name}.openData.${k} left a placeholder`);
    }
    const text = JSON.stringify(m.openData).toLowerCase();
    for (const w of ['cc by 4.0', 'footballanalytics.pro/data']) assert.ok(text.includes(w), `${name}: missing "${w}"`);
  }
});
