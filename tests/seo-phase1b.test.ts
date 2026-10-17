import { test } from 'node:test';
import assert from 'node:assert/strict';
import IntlMessageFormat from 'intl-messageformat';
import { parseDayHub, namedHubFor, dayHubPath, dayHubNeighbours, PAST_DAYS, FUTURE_DAYS } from '@/lib/site/day-hub';
import { buildTeamIndex, teamPath } from '@/lib/site/teams';
import { leagueBySlug } from '@/lib/site/leagues';
import { sportsTeamJsonLd, definedTermSetJsonLd } from '@/lib/site/jsonld';
import en from '../messages/en.json';
import de from '../messages/de.json';
import it from '../messages/it.json';
import tr from '../messages/tr.json';

// SEO Faz 1b (2026-10-17): day hubs, club pages, per-league track record, glossary.
const TODAY = '2026-10-17';

test('day hub slugs: named hubs, dated days inside the window, nothing else', () => {
  assert.deepEqual(parseDayHub('today', TODAY), { kind: 'today', ymd: '2026-10-17' });
  assert.deepEqual(parseDayHub('tomorrow', TODAY), { kind: 'tomorrow', ymd: '2026-10-18' });
  assert.deepEqual(parseDayHub('yesterday', TODAY), { kind: 'yesterday', ymd: '2026-10-16' });
  assert.deepEqual(parseDayHub('2026-10-10', TODAY), { kind: 'date', ymd: '2026-10-10' });
  assert.deepEqual(parseDayHub('2026-11-07', TODAY), { kind: 'date', ymd: '2026-11-07' }); // +21
  assert.equal(parseDayHub('2026-11-08', TODAY), null); // +22: beyond the fixture window
  assert.deepEqual(parseDayHub('2026-06-19', TODAY), { kind: 'date', ymd: '2026-06-19' }); // -120: still inside the results window
  assert.equal(parseDayHub('2026-06-18', TODAY), null); // -121: outside
  assert.equal(parseDayHub('2026-02-30', TODAY), null); // impossible date
  assert.equal(parseDayHub('arsenal-vs-chelsea-4193188', TODAY), null); // a match slug (trailing number must not be read as a day)
  assert.equal(parseDayHub('2026-10-17-5', TODAY), null);
  assert.equal(parseDayHub('', TODAY), null);
  assert.equal(PAST_DAYS, 120); assert.equal(FUTURE_DAYS, 21);
});

test('dated twins of today/tomorrow/yesterday resolve to the named hub; neighbours clip at the window', () => {
  assert.equal(namedHubFor('2026-10-17', TODAY), 'today');
  assert.equal(namedHubFor('2026-10-18', TODAY), 'tomorrow');
  assert.equal(namedHubFor('2026-10-16', TODAY), 'yesterday');
  assert.equal(namedHubFor('2026-10-15', TODAY), null);
  assert.equal(dayHubPath('2026-10-17', TODAY), '/matches/today');
  assert.equal(dayHubPath('2026-10-15', TODAY), '/matches/2026-10-15');
  assert.deepEqual(dayHubNeighbours('2026-10-17', TODAY), { prev: '/matches/yesterday', next: '/matches/tomorrow' });
  assert.deepEqual(dayHubNeighbours('2026-10-18', TODAY), { prev: '/matches/today', next: '/matches/2026-10-19' });
  assert.deepEqual(dayHubNeighbours('2026-11-07', TODAY), { prev: '/matches/2026-11-06', next: null });
  assert.deepEqual(dayHubNeighbours('2026-06-19', TODAY), { prev: null, next: '/matches/2026-06-20' });
});

test('team index: slugified names, the busier club keeps a contested slug, stable sort', () => {
  const pl = leagueBySlug('premier-league')!, tsl = leagueBySlug('super-lig')!, bl = leagueBySlug('bundesliga')!;
  const idx = buildTeamIndex([
    { id: 8456, name: 'Manchester City', league: pl, n: 9 },
    { id: 9823, name: 'Bayern München', league: bl, n: 7 },
    { id: 1, name: 'Göztepe', league: tsl, n: 8 },
    { id: 2, name: 'Göztepe', league: pl, n: 3 }, // contested slug: fewer matches → id suffix
    { id: 0, name: 'Ghost', league: pl, n: 1 }, // no id → dropped
    { id: 3, name: '', league: pl, n: 1 }, // no name → dropped
  ]);
  assert.deepEqual(idx.map((t) => t.slug), ['bayern-munchen', 'goztepe-2', 'manchester-city', 'goztepe']);
  assert.equal(teamPath(idx[0]), '/teams/bayern-munchen');
  assert.equal(idx[0].crest, 'https://images.fotmob.com/image_resources/logo/teamlogo/9823.png');
});

test('SportsTeam and DefinedTermSet JSON-LD carry ids, urls and the venue when known', () => {
  const t = sportsTeamJsonLd('de', { url: 'https://footballanalytics.pro/de/teams/bayern-munchen', name: 'Bayern München', crest: 'x.png', league: leagueBySlug('bundesliga')!, venue: { name: 'Allianz Arena', city: 'München' } });
  assert.equal(t['@type'], 'SportsTeam');
  assert.equal(t.sport, 'Soccer');
  assert.equal((t.location as any).address.addressLocality, 'München');
  assert.equal(t.memberOf.name, 'Bundesliga');
  const g = definedTermSetJsonLd('en', { url: 'https://footballanalytics.pro/en/glossary', name: 'Glossary', terms: [{ id: 'xg', term: 'xG', description: 'd' }] });
  assert.equal(g.hasDefinedTerm[0].url, 'https://footballanalytics.pro/en/glossary#xg');
  assert.equal(g.hasDefinedTerm[0].inDefinedTermSet, 'https://footballanalytics.pro/en/glossary#terms');
});

test('glossary: the same anchors and term count in all four languages, every term with 2+ paragraphs', () => {
  const ids = (m: any) => (m.docs.glossary.sections as Array<{ id: string; h: string; p: string[] }>).map((s) => s.id);
  const ref = ids(en);
  assert.equal(ref.length, 13);
  assert.ok(ref.includes('xg') && ref.includes('brier') && ref.includes('algorithm'));
  for (const [name, m] of Object.entries({ de, it, tr }) as Array<[string, any]>) {
    assert.deepEqual(ids(m), ref, `${name}: glossary anchors differ`);
    for (const s of m.docs.glossary.sections) assert.ok(s.p.length >= 2 && s.h, `${name} ${s.id}: too thin`);
  }
});

test('new ICU strings compile in every locale and render with sample values', () => {
  const sample: Record<string, unknown> = { count: 2, leagues: 3, date: '17 October', home: 'A', away: 'B', league: 'L', time: '15:00', lhome: 'C', laway: 'D', ltime: '20:45', settled: 1, won: 2, n: 3, team: 'T', pos: 3, played: 8, pts: 17, w: 5, d: 2, l: 1, gf: 14, ga: 7, form: 'W W D', venue: 'V', over: '60%', btts: '50%', acc: '55%', from: '1 August', brier: '0.610', ou: '58%', ouN: 40, bttsN: 40, roi: '+2.1%', bets: 40, list: 'x', country: 'C' };
  for (const [name, m] of Object.entries({ en, de, it, tr }) as Array<[string, any]>) {
    for (const ns of ['dayHub', 'teams', 'team', 'perfLeague']) {
      for (const [k, v] of Object.entries(m[ns] as Record<string, string>)) {
        const out = new IntlMessageFormat(v, name === 'de' ? 'de-CH' : name).format(sample);
        assert.ok(typeof out === 'string' && out.length > 0, `${name} ${ns}.${k} rendered empty`);
        assert.ok(!/\{[a-z]+\}/i.test(out as string), `${name} ${ns}.${k} left a placeholder: ${out}`);
      }
    }
  }
});

test('anonymous surfaces of Faz 1b carry no gambling-coded wording', () => {
  for (const [name, m] of Object.entries({ en, de, it, tr }) as Array<[string, any]>) {
    const text = JSON.stringify([m.dayHub, m.teams, m.team, m.perfLeague, m.docs.glossary]).toLowerCase();
    assert.ok(!/18\+|bookmaker|buchmacher|bahisçi|bahis |iddaa|wett-?tipp|scommess|kumar|gambl/.test(text), `${name}: Faz 1b strings carry gambling-coded wording`);
  }
});
