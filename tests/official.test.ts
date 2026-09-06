import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pickOfficial } from '@/lib/site/official';

const rows = [
  { fixture_id: 10, model_version: 'dc-1.0', updated_at: '2026-09-01T00:00:00Z', tag: 'a' },
  { fixture_id: 10, model_version: 'dc-xg-1.1', updated_at: '2026-09-02T00:00:00Z', tag: 'b' },
  { fixture_id: 11, model_version: 'dc-1.0', updated_at: '2026-09-01T00:00:00Z', tag: 'c' },
  { fixture_id: 12, model_version: 'dc-xg-1.1', updated_at: null, tag: 'd' },
];

test('two model versions of one fixture collapse to a single official row', () => {
  const out = pickOfficial(rows, null);
  assert.deepEqual(out.map((r) => r.fixture_id), [10, 11, 12]);
  assert.equal(out[0].tag, 'b', 'latest updated_at wins when no version is configured');
});

test('a configured official version is the only one shown and filters the rest', () => {
  const out = pickOfficial(rows, 'dc-1.0');
  assert.deepEqual(out.map((r) => r.tag), ['a', 'c']);
});

test('tie on updated_at is broken deterministically by version name', () => {
  const tie = [
    { fixture_id: 1, model_version: 'a-1', updated_at: '2026-09-01T00:00:00Z' },
    { fixture_id: 1, model_version: 'b-1', updated_at: '2026-09-01T00:00:00Z' },
  ];
  assert.equal(pickOfficial(tie, null)[0].model_version, 'b-1');
  assert.equal(pickOfficial([...tie].reverse(), null)[0].model_version, 'b-1');
});
