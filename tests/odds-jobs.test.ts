import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { oddsCandidates, pickOddsJobs } from '@/lib/site/odds-jobs';

// 10 Eki 2026: hafta sonu oran bütçesi alt liglerde eriyor, akşam maçları ve Pazar oran alamıyordu.
const now = new Date('2026-10-10T10:00:00Z');
const at = (h: number) => new Date(now.getTime() + h * 3600e3).toISOString();
const tier = (id: number) => (id === 87 ? 0 : id === 938776 ? 1 : null);
const cc = () => 'GB';

describe('oddsCandidates', () => {
  it('model sürümlerini tekilleştirir, oran alınmayan ligi eler, fazı o andan hesaplar', () => {
    const preds = [
      { fixture_id: 1, league_id: 87, kickoff: at(9) },
      { fixture_id: 1, league_id: 87, kickoff: at(9) }, // dc-2.0-xg kopyası
      { fixture_id: 2, league_id: 938776, kickoff: at(1) },
      { fixture_id: 3, league_id: 999, kickoff: at(2) }, // kapsam dışı
    ];
    const c = oddsCandidates({ preds, now, tierOf: tier, ccodeOf: cc });
    assert.deepEqual(c.map((j) => [j.fixtureId, j.phase, j.tier]), [[1, 'h12', 0], [2, 'closing', 1]]);
  });
});

describe('pickOddsJobs', () => {
  const c = oddsCandidates({
    preds: [
      { fixture_id: 10, league_id: 938776, kickoff: at(4) },  // gözlem, h6
      { fixture_id: 11, league_id: 87, kickoff: at(9) },      // beyaz liste, h12 (Real Madrid)
      { fixture_id: 12, league_id: 938776, kickoff: at(1) },  // gözlem, kapanış
      { fixture_id: 13, league_id: 87, kickoff: at(30) },     // beyaz liste, açılış (Pazar)
    ], now, tierOf: tier, ccodeOf: cc,
  });

  it('kapanış önce, sonra beyaz liste, sonra gözlem; eşitlikte yakın kickoff', () => {
    const todo = pickOddsJobs(c, { done: new Set(), missed: new Set(), max: 10 });
    assert.deepEqual(todo.map((j) => j.fixtureId), [12, 11, 13, 10]);
  });

  it('yazılmış fazı ve son turda boş döneni atlar, bütçeyi keser', () => {
    const todo = pickOddsJobs(c, { done: new Set(['11:h12']), missed: new Set([12]), max: 1 });
    assert.deepEqual(todo.map((j) => j.fixtureId), [13]);
  });
});
