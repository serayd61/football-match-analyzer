import { test } from 'node:test';
import assert from 'node:assert/strict';
import { toIntelView, pickLatestIntel, sourceOf, fmtPts } from '@/lib/site/intel-view';

// İstihbarat katmanı görünümü (2026-10-16): engine_intel satırı → kart verisi.
// Durumu değiştirmez; yalnız isimli faktör + sapma + kaynak taşır, LLM metni taşımaz.

const row = (over: Record<string, unknown> = {}) => ({
  fixture_id: 5795478, agent_version: 'intel-1.0', model_version: 'dc-1.0', llm_model: 'claude-haiku-5-5',
  analyzed_at: '2026-10-16T16:45:33+00:00', issued_after_kickoff: false,
  baseline: { home: 0.3998, draw: 0.2575, away: 0.3427, over25: 0.6074, btts: 0.6369, lambdaHome: 1.636, lambdaAway: 1.504, modelVersion: 'dc-1.0' },
  final: { home: 0.4198, draw: 0.2575, away: 0.3227 },
  goals: { over25: 0.6147, btts: 0.6413, adjusted: true, lambdaHome: 1.685, lambdaAway: 1.489 },
  deviations: [{
    factor: 'Reece James (RB, kaptan) diz ameliyatı: kesin yok', category: 'key_absence', team: 'away', severity: 'normal',
    shift: { home: 0.02, draw: 0, away: -0.02 }, lambdaMult: { home: 1.03, away: 0.99 },
    reason: 'uzun gerekçe metni — kartta gösterilmez', source: 'https://www.evertonfc.com/news/2026/october/16/Chelseateamnews ; Yahoo', asOf: '2026-10-16T13:29:00+00:00',
  }],
  confidence: 'medium', data_completeness: 0.65, warnings: [],
  ...over,
});

test('toIntelView: deltas in points, factor with host label, goals adjusted, no free text', () => {
  const v = toIntelView(row())!;
  assert.ok(v);
  assert.deepEqual(v.deltaPts, { home: 2, draw: 0, away: -2 });
  assert.equal(v.changed, true);
  assert.equal(v.provider, 'claude');
  assert.equal(v.factors.length, 1);
  assert.equal(v.factors[0].category, 'key_absence');
  assert.equal(v.factors[0].team, 'away');
  assert.deepEqual(v.factors[0].shiftPts, { home: 2, draw: 0, away: -2 });
  assert.equal(v.factors[0].sourceUrl, 'https://www.evertonfc.com/news/2026/october/16/Chelseateamnews');
  assert.equal(v.factors[0].sourceLabel, 'evertonfc.com');
  assert.equal(v.goals.adjusted, true);
  assert.equal(v.goals.over25?.to, 0.6147);
  assert.equal(v.clipped, false);
  assert.ok(!('reason' in v.factors[0]));
});

test('toIntelView: no deviations → changed=false, empty factors; unknown category → other', () => {
  const v = toIntelView(row({ final: { home: 0.3998, draw: 0.2575, away: 0.3427 }, goals: { over25: 0.6074, btts: 0.6369, adjusted: false }, deviations: [] }))!;
  assert.equal(v.changed, false);
  assert.deepEqual(v.factors, []);
  assert.equal(v.goals.adjusted, false);
  const w = toIntelView(row({ deviations: [{ factor: 'x', category: 'form', team: 'home', shift: { home: 0.01, draw: 0, away: -0.01 } }], warnings: ['kırpıldı'] }))!;
  assert.equal(w.factors[0].category, 'other');
  assert.equal(w.clipped, true);
});

test('toIntelView: kickoff-sonrası analiz ve bozuk satır gizlenir', () => {
  assert.equal(toIntelView(row({ issued_after_kickoff: true })), null);
  assert.equal(toIntelView({ fixture_id: 1 }), null);
  assert.equal(toIntelView(null), null);
});

test('pickLatestIntel: en son analyzed_at kazanır (model karşılaştırma satırları arasından)', () => {
  const a = row({ agent_version: 'intel-1.0', analyzed_at: '2026-10-16T16:45:00Z' });
  const b = row({ agent_version: 'intel-1.0-haiku', analyzed_at: '2026-10-16T17:10:00Z', llm_model: 'claude-haiku-5-5' });
  const c = row({ agent_version: 'late', analyzed_at: '2026-10-17T12:00:00Z', issued_after_kickoff: true });
  const v = pickLatestIntel([a, b, c])!;
  assert.equal(v.agentVersion, 'intel-1.0-haiku');
  assert.equal(pickLatestIntel([]), null);
});

test('sourceOf / fmtPts', () => {
  assert.deepEqual(sourceOf('Kulüp açıklaması'), { url: null, label: 'Kulüp açıklaması' });
  assert.deepEqual(sourceOf(''), { url: null, label: null });
  assert.equal(sourceOf('bkz https://sports.yahoo.com/articles/x.html, 16.10').url, 'https://sports.yahoo.com/articles/x.html');
  assert.equal(sourceOf('https://www.sportsmole.co.uk/a').label, 'sportsmole.co.uk');
  assert.equal(fmtPts(0), '0');
  assert.equal(fmtPts(3), '+3');
  assert.equal(fmtPts(-2), '−2');
});
