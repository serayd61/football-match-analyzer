import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseFlashOdds, parseFlashEvents, matchFlashEvents, flashTeamSim, quotaFromHeaders, flashSpendable, FL_RESERVE_PER_DAY, type FlashQuota } from '@/lib/data-sources/flashlive-pure';
import { fillFlashOu, type FlashDeps, type FlashRow } from '@/lib/site/flash-ou';

// Gerçek yanıtın (Bristol City – Wrexham, 2026-11-24) kırpılmış biçimi.
const mk = (id: number, name: string, cells: Array<number | null>) => ({ BOOKMAKER_ID: id, BOOKMAKER_NAME: name, ODDS_AVAILABLE: 1,
  ...(cells[0] != null ? { ODD_CELL_FIRST: { MOVE: 's', VALUE: cells[0] } } : {}), ODD_CELL_SECOND: { MOVE: 's', VALUE: cells[1] }, ODD_CELL_THIRD: { MOVE: 's', VALUE: cells[2] } });
const period = (stage: string, obn: string, groups: any[]) => ({ ODDS_STAGE: stage, OBN: obn, GROUPS: groups });
const ODDS = [
  { BETTING_TYPE: '*1X2', PERIODS: [
    period('*Full Time', 'HOME_DRAW_AWAY-FULL_TIME', [{ GROUP_NAME: null, MARKETS: [mk(16, 'bet365', [2.35, 3.25, 3.0]), mk(5, 'Unibet', [2.33, 3.3, 2.95])] }]),
    period('1st Half', 'HOME_DRAW_AWAY-FIRST_HALF', [{ GROUP_NAME: null, MARKETS: [mk(16, 'bet365', [9, 9, 9])] }]),
  ] },
  { BETTING_TYPE: 'Over/Under', PERIODS: [
    period('1st Half', 'OVER_UNDER-FIRST_HALF', [{ GROUP_NAME: 'Total: 2.5', MARKETS: [mk(16, 'bet365', [null, 8, 1.05])] }]),
    period('*Full Time', 'OVER_UNDER-FULL_TIME', [
      { GROUP_NAME: 'Total: 1.5', MARKETS: [mk(16, 'bet365', [null, 1.36, 3.0])] },
      { GROUP_NAME: 'Total: 2.5', MARKETS: [mk(5, 'Unibet', [null, 1.97, 1.76]), mk(16, 'bet365', [null, 2.1, 1.73])] },
      { GROUP_NAME: 'Total: 2.25', MARKETS: [mk(16, 'bet365', [null, 1.9, 1.9])] },
    ]),
  ] },
  { BETTING_TYPE: 'Both teams to score', PERIODS: [period('*Full Time', 'BOTH_TEAMS_TO_SCORE-FULL_TIME', [{ GROUP_NAME: null, MARKETS: [mk(16, 'bet365', [null, 1.8, 1.91])] }])] },
];

test('parseFlashOdds reads full-time 1X2, Total 2.5 and BTTS from the preferred bookmaker', () => {
  const o = parseFlashOdds(ODDS)!;
  assert.equal(o.bookmaker, 'bet365');
  assert.deepEqual([o.home, o.draw, o.away, o.over25, o.under25, o.bttsYes, o.bttsNo], [2.35, 3.25, 3.0, 2.1, 1.73, 1.8, 1.91]);
  assert.equal(parseFlashOdds([]), null);
});

test('parseFlashOdds falls back to a bookmaker that has Total 2.5 and ignores unavailable prices', () => {
  const noB365 = JSON.parse(JSON.stringify(ODDS));
  noB365[1].PERIODS[1].GROUPS[1].MARKETS[1].ODDS_AVAILABLE = 0;
  const o = parseFlashOdds(noB365)!;
  assert.equal(o.bookmaker, 'Unibet');
  assert.deepEqual([o.over25, o.under25, o.home, o.bttsYes], [1.97, 1.76, 2.33, null]);
  const onlyX12 = [ODDS[0]];
  assert.deepEqual([parseFlashOdds(onlyX12)!.over25, parseFlashOdds(onlyX12)!.home], [null, 2.35]);
});

const LIST = [
  { NAME: 'England: Championship', EVENTS: [
    { EVENT_ID: 'hvQs781c', START_UTIME: Date.parse('2026-11-24T19:45:00Z') / 1000, HOME_NAME: 'Bristol City', AWAY_NAME: 'Wrexham' },
    { EVENT_ID: 'zzzz0001', START_UTIME: Date.parse('2026-11-24T19:45:00Z') / 1000, HOME_NAME: 'Sheffield Utd', AWAY_NAME: 'Hull City' },
  ] },
  { NAME: 'England: Championship Women', EVENTS: [
    { EVENT_ID: 'wwww0001', START_UTIME: Date.parse('2026-11-24T19:45:00Z') / 1000, HOME_NAME: 'Bristol City W', AWAY_NAME: 'Wrexham W' },
    { EVENT_ID: 'late0001', START_UTIME: Date.parse('2026-11-24T22:00:00Z') / 1000, HOME_NAME: 'Bristol City', AWAY_NAME: 'Wrexham' },
    { EVENT_ID: '', START_UTIME: 1, HOME_NAME: 'X', AWAY_NAME: 'Y' },
    { EVENT_ID: 'hvQs781c', START_UTIME: Date.parse('2026-11-24T19:45:00Z') / 1000, HOME_NAME: 'Bristol City', AWAY_NAME: 'Wrexham' }, // yinelenen kayıt
  ] },
];

test('parseFlashEvents flattens tournaments and matchFlashEvents needs kickoff and both names', () => {
  const ev = parseFlashEvents(LIST);
  assert.equal(ev.length, 4);
  assert.equal(ev[0].kickoff, '2026-11-24T19:45:00.000Z');
  const ours = [
    { fixtureId: 1, kickoff: '2026-11-24T19:45:00Z', home: 'Bristol City', away: 'Wrexham AFC' },
    { fixtureId: 2, kickoff: '2026-11-24T19:45:00Z', home: 'Sheffield United', away: 'Hull City' },
    { fixtureId: 3, kickoff: '2026-11-24T15:00:00Z', home: 'Bristol City', away: 'Wrexham' }, // saat tutmuyor
    { fixtureId: 4, kickoff: '2026-11-24T19:45:00Z', home: 'Bristol City', away: 'Leeds United' }, // tek taraf tutuyor
  ];
  assert.deepEqual(matchFlashEvents(ours, ev).map((m) => [m.fixtureId, m.eventId]), [[1, 'hvQs781c'], [2, 'zzzz0001']]);
});

test('flashTeamSim understands Flashscore short names but never crosses squads', () => {
  for (const [a, b] of [['Cardiff City', 'Cardiff'], ['Sheffield United', 'Sheffield Utd'], ['Queens Park Rangers', 'QPR'], ['Wolverhampton Wanderers', 'Wolves'],
    ['Borussia Dortmund', 'Dortmund'], ['Bodø/Glimt', 'Bodo/Glimt'], ['PSV Eindhoven', 'PSV'], ['Paris Saint-Germain', 'PSG'], ['Borussia Mönchengladbach', 'B. Monchengladbach']]) {
    assert.ok(flashTeamSim(a, b) >= 0.8, `${a} ~ ${b}: ${flashTeamSim(a, b)}`);
  }
  for (const [a, b] of [['Bristol City', 'Bristol City W'], ['Ajax', 'Jong Ajax'], ['Arsenal', 'Arsenal U21'], ['Manchester United', 'Manchester City'], ['Norwich City', 'Bristol City'], ['Derby County', 'Wingate & Finchley']]) {
    assert.ok(flashTeamSim(a, b) < 0.6, `${a} !~ ${b}: ${flashTeamSim(a, b)}`);
  }
});

test('quota is read from headers and the daily reserve protects the rest of the month', () => {
  const now = Date.parse('2026-11-24T10:00:00Z');
  const h = new Map([['x-ratelimit-requests-remaining', '494'], ['x-ratelimit-requests-reset', String(30 * 86_400)]]);
  const q = quotaFromHeaders((n) => h.get(n) ?? null, now)!;
  assert.deepEqual(q, { remaining: 494, resetAtMs: now + 30 * 86_400_000 });
  assert.equal(quotaFromHeaders(() => null, now), null);
  assert.equal(flashSpendable(q, now), 494 - FL_RESERVE_PER_DAY * 29);
  assert.equal(flashSpendable({ remaining: 20, resetAtMs: now + 10 * 86_400_000 }, now), 0); // pay ayrılmış
  assert.equal(flashSpendable({ remaining: 20, resetAtMs: now + 3600_000 }, now), 20); // son gün: hepsi
  assert.equal(flashSpendable(null, now), 1); // bilinmiyor: tek istekle öğren
  assert.equal(flashSpendable({ remaining: 0, resetAtMs: now - 1 }, now), 1); // ay döndü
});

function harness(rows: FlashRow[], opts: { quota?: FlashQuota | null; odds?: any; events?: any[] } = {}) {
  const kv = new Map<string, any>();
  const now = new Date('2026-11-24T10:00:00Z');
  if (opts.quota !== null) kv.set('fl:quota', opts.quota ?? { remaining: 400, resetAtMs: now.getTime() + 20 * 86_400_000 });
  const log = { list: [] as number[], odds: [] as string[], updates: [] as Array<[number, string, Record<string, number | string>]> };
  let remaining = (kv.get('fl:quota')?.remaining ?? 500) as number;
  const quota = () => ({ remaining: --remaining, resetAtMs: now.getTime() + 20 * 86_400_000 });
  const deps: FlashDeps = {
    now, sleep: async () => {},
    rows: async () => rows,
    update: async (f, p, c) => { log.updates.push([f, p, c]); return null; },
    kv: { get: async (k) => kv.get(k) ?? null, set: async (k, v) => { kv.set(k, v); } },
    events: async (i) => { log.list.push(i); return { ok: true, events: parseFlashEvents(opts.events ?? LIST), quota: quota() }; },
    odds: async (id) => { log.odds.push(id); return { ok: true, odds: opts.odds === undefined ? parseFlashOdds(ODDS) : opts.odds, quota: quota() }; },
  };
  return { deps, kv, log };
}
const row = (fid: number, phase: string, over = 0, btts = 1.8): FlashRow => ({ fixture_id: fid, phase, over25_odds: over, under25_odds: over ? 1.9 : 0, ou_provider: over ? 'FlashLive/bet365' : null, btts_yes_odds: btts });
const JOB = { fixtureId: 1, kickoff: '2026-11-24T19:45:00Z', home: 'Bristol City', away: 'Wrexham' };

test('fillFlashOu maps once, fetches once and writes to the latest phase row', async () => {
  const { deps, kv, log } = harness([row(1, 'opening'), row(1, 'h12', 0, 0)]);
  const r = await fillFlashOu([JOB], deps);
  assert.deepEqual([r.need, r.listCalls, r.oddsCalls, r.filled, r.carried], [1, 1, 1, 1, 0]);
  assert.deepEqual(log.list, [0]);
  assert.deepEqual(log.updates, [[1, 'h12', { over25_odds: 2.1, under25_odds: 1.73, ou_provider: 'FlashLive/bet365', btts_yes_odds: 1.8, btts_no_odds: 1.91 }]]);
  assert.equal(kv.get('fl:ev:1'), 'hvQs781c');
  assert.equal(r.remaining, 398);
  assert.equal(kv.get('fl:quota').remaining, 398);
});

test('fillFlashOu never re-fetches a match that has O/U: it carries the last known price forward', async () => {
  const { deps, log } = harness([row(1, 'h12', 2.05), row(1, 'h6')]);
  const r = await fillFlashOu([JOB], deps);
  assert.deepEqual([r.need, r.listCalls, r.oddsCalls, r.carried], [0, 0, 0, 1]);
  assert.deepEqual(log.updates, [[1, 'h6', { over25_odds: 2.05, under25_odds: 1.9, ou_provider: 'FlashLive/bet365' }]]);
  const same = harness([row(1, 'h12', 2.05)]);
  assert.deepEqual((await fillFlashOu([JOB], same.deps)).carried, 0);
  assert.equal(same.log.updates.length, 0);
});

test('fillFlashOu stops at the budget, skips recent misses and does not list a day twice', async () => {
  const now = Date.parse('2026-11-24T10:00:00Z');
  const broke = harness([row(1, 'h12')], { quota: { remaining: 20, resetAtMs: now + 10 * 86_400_000 } });
  const r1 = await fillFlashOu([JOB], broke.deps);
  assert.deepEqual([r1.listCalls, r1.oddsCalls, r1.filled], [0, 0, 0]);

  const noOdds = harness([row(1, 'h12')], { odds: null });
  const r2 = await fillFlashOu([JOB], noOdds.deps);
  assert.deepEqual([r2.oddsCalls, r2.noOdds, r2.filled], [1, 1, 0]);
  const r3 = await fillFlashOu([JOB], noOdds.deps); // 12 saat içinde yeniden denenmez
  assert.deepEqual([r3.listCalls, r3.oddsCalls], [0, 0]);

  const unknown = harness([row(9, 'h12')], {});
  const stranger = { fixtureId: 9, kickoff: '2026-11-24T19:45:00Z', home: 'Nobody FC', away: 'Nowhere' };
  assert.deepEqual([(await fillFlashOu([stranger], unknown.deps)).unmatched, unknown.log.list.length], [1, 1]);
  assert.deepEqual([(await fillFlashOu([stranger], unknown.deps)).unmatched, unknown.log.list.length], [1, 1]);

  const noRow = harness([]);
  assert.deepEqual((await fillFlashOu([JOB], noRow.deps)).need, 0); // 1X2 satırı yoksa yazılacak yer yok
});
