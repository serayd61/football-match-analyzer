import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseFdMatches, overlayFd, fdCodeForLeagueId, fdStatusFlags } from '../src/lib/data-sources/football-data-pure';

const raw = { matches: [
  { id: 1, competition: { code: 'PL' }, utcDate: '2026-10-18T13:00:00Z', status: 'FINISHED', homeTeam: { name: 'AFC Bournemouth' }, awayTeam: { name: 'Sunderland AFC' }, score: { fullTime: { home: 2, away: 0 } } },
  { id: 2, competition: { code: 'PL' }, utcDate: '2026-10-18T13:00:00Z', status: 'IN_PLAY', homeTeam: { name: 'Leeds United FC' }, awayTeam: { name: 'Manchester United FC' }, score: { fullTime: { home: 1, away: 1 } } },
  { id: 3, competition: { code: 'PD' }, utcDate: '2026-10-18T19:00:00Z', status: 'TIMED', homeTeam: { name: 'Real Madrid CF' }, awayTeam: { name: 'Sevilla FC' }, score: { fullTime: { home: null, away: null } } },
  { id: 4, competition: { code: 'PL' }, utcDate: '2026-10-18T15:30:00Z', status: 'POSTPONED', homeTeam: { name: 'Nottingham Forest FC' }, awayTeam: { name: 'Arsenal FC' }, score: { fullTime: { home: null, away: null } } },
  { id: 5, competition: { code: 'FL1' }, utcDate: '2026-10-18T18:45:00Z', status: 'TIMED', homeTeam: { name: 'Olympique Lyonnais', shortName: 'Lyon' }, awayTeam: { name: 'OGC Nice', shortName: 'Nice' }, score: { fullTime: { home: null, away: null } } },
] };

test('parseFdMatches sadeleştirir', () => {
  const m = parseFdMatches(raw);
  assert.equal(m.length, 5);
  assert.deepEqual(m[0], { id: 1, code: 'PL', utcDate: '2026-10-18T13:00:00Z', status: 'FINISHED', home: 'AFC Bournemouth', away: 'Sunderland AFC', homeShort: 'AFC Bournemouth', awayShort: 'Sunderland AFC', homeScore: 2, awayScore: 0 });
  assert.equal(m[4].homeShort, 'Lyon');
  assert.equal(m[2].homeScore, null);
  assert.deepEqual(parseFdMatches({}), []);
});

test('fdCodeForLeagueId: yalnız ücretsiz katman', () => {
  assert.equal(fdCodeForLeagueId(47), 'PL');
  assert.equal(fdCodeForLeagueId(87), 'PD');
  assert.equal(fdCodeForLeagueId(71), null);   // Süper Lig (TSL) ücretsiz katmanda yok
  assert.equal(fdCodeForLeagueId(59), null);   // Eliteserien
  assert.equal(fdCodeForLeagueId(null), null);
});

test('fdStatusFlags', () => {
  assert.deepEqual(fdStatusFlags('FINISHED'), { finished: true, started: true, cancelled: false });
  assert.deepEqual(fdStatusFlags('IN_PLAY'), { finished: false, started: true, cancelled: false });
  assert.deepEqual(fdStatusFlags('TIMED'), { finished: false, started: false, cancelled: false });
  assert.deepEqual(fdStatusFlags('POSTPONED'), { finished: false, started: false, cancelled: true });
});

test('overlayFd: lig + saat + ad eşlemesi, eşleşmeyen dışarıda', () => {
  const rows = [
    { id: 101, kickoff: '2026-10-18T13:00:00Z', home: 'AFC Bournemouth', away: 'Sunderland', leagueId: 47 },
    { id: 102, kickoff: '2026-10-18T13:00:00Z', home: 'Leeds United', away: 'Manchester United', leagueId: 47 },
    { id: 103, kickoff: '2026-10-18T19:00:00Z', home: 'Real Madrid', away: 'Sevilla', leagueId: 87 },
    { id: 104, kickoff: '2026-10-18T15:30:00Z', home: 'Nottingham Forest', away: 'Arsenal', leagueId: 47 },
    { id: 105, kickoff: '2026-10-18T13:00:00Z', home: 'Kasımpaşa', away: 'Samsunspor', leagueId: 71 },      // TSL: kaynak yok
    { id: 106, kickoff: '2026-10-18T13:00:00Z', home: 'Brighton', away: 'Crystal Palace', leagueId: 47 },   // akışta yok
    { id: 107, kickoff: '2026-10-18T18:45:00Z', home: 'Lyon', away: 'Nice', leagueId: 53 },                 // yalnız kısa adla eşleşir
  ];
  const o = overlayFd(rows, parseFdMatches(raw));
  assert.equal(o.size, 5);
  assert.equal(o.get(107)?.fdId, 5);
  assert.deepEqual(o.get(101), { fdId: 1, finished: true, started: true, cancelled: false, homeScore: 2, awayScore: 0, score: 1 });
  assert.equal(o.get(102)?.started, true);
  assert.equal(o.get(102)?.finished, false);
  assert.equal(o.get(103)?.started, false);
  assert.equal(o.get(104)?.cancelled, true);
  assert.equal(o.has(105), false);
  assert.equal(o.has(106), false);
});

test('overlayFd: lig kodu farklıysa aynı ad bile eşleşmez', () => {
  const o = overlayFd([{ id: 1, kickoff: '2026-10-18T13:00:00Z', home: 'AFC Bournemouth', away: 'Sunderland', leagueId: 87 }], parseFdMatches(raw));
  assert.equal(o.size, 0);
});
