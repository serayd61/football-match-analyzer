import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pickFirstStep, type FirstStepRow } from '@/lib/site/first-step';

const now = Date.parse('2026-10-26T12:00:00Z');
const row = (o: Partial<FirstStepRow> & { fixtureId: number }): FirstStepRow => ({
  homeName: `H${o.fixtureId}`, awayName: `A${o.fixtureId}`, kickoff: '2026-10-26T18:00:00Z', leagueName: 'L', hasModel: true, settled: false,
  pick: '1', confidence: 0.6, confidenceRaw: 0.6, ...o,
});
const strong = (r: FirstStepRow) => ({ row: r, leagueName: 'Eredivisie', pick: { market: 'ou25' as const, selection: 'over' as const, p: 0.71, sm: { won: 18, n: 24 } } });
const pick = (fixtureId: number, kickoff = '2026-10-26T19:00:00Z') => ({ fixtureId, homeName: 'P', awayName: 'Q', kickoff, leagueSlug: 'serie-a', market: 'ou25', modelP: 0.66 });

test('strong-zone match wins when it has not kicked off', () => {
  const r = pickFirstStep({ strong: [strong(row({ fixtureId: 1 }))], picks: [pick(2)], today: [row({ fixtureId: 3, confidence: 0.9 })], tomorrow: [] }, { now });
  assert.equal(r?.kind, 'strong');
  assert.equal(r && 'row' in r ? r.row.fixtureId : null, 1);
});

test('started strong match is skipped; daily pick is next in line', () => {
  const r = pickFirstStep({ strong: [strong(row({ fixtureId: 1, kickoff: '2026-10-26T11:00:00Z' }))], picks: [pick(2)], today: [row({ fixtureId: 3 })], tomorrow: [] }, { now });
  assert.equal(r?.kind, 'pick');
  assert.equal(r?.kind === 'pick' ? r.fixtureId : null, 2);
  assert.equal(r?.kind === 'pick' ? r.leagueName : null, 'serie a');
});

test('falls back to the highest-confidence upcoming model pick across today and tomorrow', () => {
  const today = [row({ fixtureId: 3, confidence: 0.55 }), row({ fixtureId: 4, confidence: 0.72 }), row({ fixtureId: 5, confidence: 0.95, settled: true }), row({ fixtureId: 6, confidence: null, confidenceRaw: 0.8, hasModel: false })];
  const r = pickFirstStep({ strong: [], picks: [pick(2, '2026-10-26T09:00:00Z')], today, tomorrow: [] }, { now });
  assert.equal(r?.kind, 'model');
  assert.equal(r?.kind === 'model' ? r.row.fixtureId : null, 4);
  const r2 = pickFirstStep({ strong: [], picks: [], today: [row({ fixtureId: 3, kickoff: '2026-10-26T10:00:00Z' })], tomorrow: [row({ fixtureId: 9, kickoff: '2026-10-27T15:00:00Z', confidence: null, confidenceRaw: 0.58 })] }, { now });
  assert.equal(r2?.kind === 'model' ? r2.row.fixtureId : null, 9);
  assert.equal(r2?.kind === 'model' ? r2.p : null, 0.58);
  // yarının %72'si bugünün %49'unu geçer (tek havuz)
  const r3 = pickFirstStep({ strong: [], picks: [], today: [row({ fixtureId: 3, confidence: 0.49 })], tomorrow: [row({ fixtureId: 9, kickoff: '2026-10-27T20:45:00Z', confidence: 0.72 })] }, { now });
  assert.equal(r3?.kind === 'model' ? r3.row.fixtureId : null, 9);
});

test('nothing upcoming → null', () => {
  assert.equal(pickFirstStep({ strong: [], picks: [], today: [row({ fixtureId: 1, settled: true })], tomorrow: [] }, { now }), null);
});
