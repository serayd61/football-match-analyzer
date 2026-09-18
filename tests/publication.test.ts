// Denetim 2026-09-18 (B06): model terfisi geçmiş müşteri karnesini değiştirmemeli.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildTimeline, officialAt, pickPublished, publishedFields, type HistoryRow } from '@/lib/site/publication';

const tl = buildTimeline([{ version: 'B', at: '2026-10-01T00:00:00Z' }, { version: 'A', at: '2026-09-06T00:00:00Z' }]);

test('official version is the one active at kickoff, not today', () => {
  assert.equal(officialAt(tl, '2026-09-20T18:00:00Z'), 'A');
  assert.equal(officialAt(tl, '2026-10-02T18:00:00Z'), 'B');
  assert.equal(officialAt(tl, '2026-08-01T00:00:00Z'), null); // yayın kaydı öncesi → arşiv
});

const h = (v: string, at: string, pHome: number): HistoryRow => ({ fixture_id: 1, model_version: v, issued_at: at, p_raw: { p_home: pHome, p_draw: 0.3, p_away: 0.7 - pHome, pick: '1', confidence: pHome } });

test('promotion A→B leaves a September fixture scored on what A published', () => {
  const rows = [h('A', '2026-09-19T06:00:00Z', 0.5), h('B', '2026-09-19T06:00:00Z', 0.2)];
  const ko = '2026-09-20T18:00:00Z';
  assert.equal(pickPublished(rows, ko, officialAt(tl, ko))?.model_version, 'A');
});

test('the last pre-kickoff issue wins; post-kickoff rewrites never enter the record', () => {
  const ko = '2026-09-20T18:00:00Z';
  const rows = [h('A', '2026-09-19T06:00:00Z', 0.5), h('A', '2026-09-20T06:00:00Z', 0.55), h('A', '2026-09-20T19:00:00Z', 0.9)];
  assert.equal(publishedFields(pickPublished(rows, ko, 'A')!)?.p_home, 0.55);
  assert.equal(pickPublished([h('A', '2026-09-20T19:00:00Z', 0.9)], ko, 'A'), null);
});

test('incomplete p_raw yields null instead of zeros', () => {
  assert.equal(publishedFields({ fixture_id: 1, model_version: 'A', issued_at: '2026-09-19T06:00:00Z', p_raw: { p_home: 0.5 } }), null);
});
