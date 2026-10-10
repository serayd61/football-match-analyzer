import { test } from 'node:test';
import assert from 'node:assert/strict';
import { publicMatchView, PREMIUM_FIELDS, matchPath, fixtureIdFromSlug, isCanonicalSlug, formLetters, h2hTally } from '@/lib/site/match-public';
import { leagueBySlug } from '@/lib/site/leagues';
import type { SitePrediction } from '@/lib/site/predictions';

// Herkese açık maç sayfaları (SEO 2026-10-10): URL sözleşmesi ve premium veri sızıntısı koruması.

const row = (over: Partial<SitePrediction> = {}): SitePrediction => ({
  fixtureId: 4193188, league: leagueBySlug('premier-league'), leagueName: 'Premier League', leagueId: 47, covered: true,
  homeId: 9825, homeName: 'Arsenal', awayId: 8455, awayName: 'Chelsea', homeCrest: 'https://x/9825.png', awayCrest: null,
  kickoff: '2026-10-18T15:30:00Z', pHome: 0.52, pDraw: 0.26, pAway: 0.22, lambdaHome: 1.7, lambdaAway: 1.1, pick: '1',
  confidence: 0.55, confidenceRaw: 0.52, doubleChance: { '1X': 0.78, X2: 0.48, '12': 0.74 } as any, overUnder: { pick: 'over', p: 0.56, pRaw: 0.54 } as any, btts: { pick: 'yes', p: 0.5, pRaw: 0.49 } as any,
  rationale: 'secret', settled: false, homeScore: null, awayScore: null, result: null, outcome: 'pending', modelVersion: 'dc-2.0', updatedAt: '2026-10-17T20:00:00Z',
  hasModel: true, status: 'scheduled', modelStatus: 'ready', publishedAfterKickoff: false, ...over,
});

test('publicMatchView carries no model figure, pick, confidence or outcome', () => {
  const v = publicMatchView(row({ settled: true, homeScore: 2, awayScore: 1, result: 'H', outcome: 'won', status: 'finished' }));
  for (const k of PREMIUM_FIELDS) assert.ok(!(k in v), `premium field leaked: ${k}`);
  const json = JSON.stringify(v);
  for (const needle of ['0.52', '0.26', '0.22', 'secret', 'won', '"pick"', 'lambda', 'dc-2.0']) assert.ok(!json.includes(needle), `serialised view contains ${needle}`);
  // Olgular kalır: skor, durum, takımlar, lig, veri zamanı.
  assert.equal(v.homeScore, 2); assert.equal(v.awayScore, 1); assert.equal(v.status, 'finished');
  assert.equal(v.league?.slug, 'premier-league'); assert.equal(v.updatedAt, '2026-10-17T20:00:00Z');
  assert.equal(v.slug, 'arsenal-vs-chelsea-4193188');
});

test('match URL: slug round-trips, diacritics are folded, canonical check and redirect input', () => {
  const p = row({ homeName: 'Fenerbahçe', awayName: 'Beşiktaş', fixtureId: 777 });
  assert.equal(matchPath(p), '/matches/fenerbahce-vs-besiktas-777');
  assert.equal(fixtureIdFromSlug('fenerbahce-vs-besiktas-777'), 777);
  assert.equal(fixtureIdFromSlug('777'), null); // no trailing "-id" form
  assert.equal(fixtureIdFromSlug('arsenal-vs-chelsea-0'), null);
  assert.equal(fixtureIdFromSlug('arsenal-vs-chelsea'), null);
  assert.ok(isCanonicalSlug('fenerbahce-vs-besiktas-777', p));
  assert.ok(!isCanonicalSlug('fener-vs-besiktas-777', p), 'a stale or hand-typed slug is not canonical (page redirects)');
  assert.ok(!isCanonicalSlug('Fenerbahce-vs-Besiktas-777', p));
});

test('form letters and head-to-head tally are computed from scores only', () => {
  const rows = [
    { homeId: 1, awayId: 2, homeScore: 2, awayScore: 0 }, // team 1 W
    { homeId: 3, awayId: 1, homeScore: 1, awayScore: 1 }, // team 1 D
    { homeId: 1, awayId: 2, homeScore: 0, awayScore: 3 }, // team 1 L
    { homeId: 2, awayId: 1, homeScore: null, awayScore: null }, // unsettled → skipped
  ];
  assert.deepEqual(formLetters(1, rows), ['W', 'D', 'L']);
  assert.deepEqual(formLetters(2, rows), ['L', 'W']);
  assert.deepEqual(h2hTally(1, rows.filter((r) => (r.homeId === 1 && r.awayId === 2) || (r.homeId === 2 && r.awayId === 1))), { n: 2, homeWins: 1, draws: 0, awayWins: 1 });
});

test('every locale carries the public match copy and the slogan stays as a secondary line', async () => {
  const { readFileSync } = await import('node:fs');
  for (const l of ['en', 'de', 'it', 'tr']) {
    const m = JSON.parse(readFileSync(`messages/${l}.json`, 'utf8'));
    assert.ok(m.matches?.hub?.metaTitle && m.matches?.match?.metaTitle, `${l}: matches namespace`);
    for (const k of ['sTable', 'sForm', 'sH2h', 'sNoH2h', 'sVenue', 'sFinal', 'modelLockedLead', 'updated', 'tzNote']) assert.ok(m.matches.match[k], `${l}: matches.match.${k}`);
    assert.ok(m.v3.landing.title && m.v3.landing.tagline && m.v3.landing.title !== m.v3.landing.tagline, `${l}: H1 and tagline`);
    assert.ok(m.nav.matches, `${l}: nav.matches`);
    assert.equal(m.docs.methodology.sections.length, 11, `${l}: methodology sections`);
    // Yeni metinler sonuç vaat etmez (home.disclaimer'daki "not guarantees" olumsuzlaması kapsam dışı).
    const text = (JSON.stringify(m.matches) + JSON.stringify(m.v3.landing) + m.home.metaTitle + m.home.metaDescription).toLowerCase();
    for (const bad of ['guaranteed', 'garantili', 'garantiert', 'garantito', 'sure win', 'kesin kazan', 'sicherer gewinn', 'vincita sicura']) assert.ok(!text.includes(bad), `${l}: marketing copy must not promise outcomes (${bad})`);
  }
});
