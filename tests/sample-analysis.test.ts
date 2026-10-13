import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sampleEligible, pickSamplePool, SAMPLE_MIN_CONF, SAMPLE_WINDOW_DAYS, SAMPLE_POOL, type SampleInput } from '@/lib/site/sample-analysis-rule';

const NOW = Date.parse('2026-10-13T12:00:00Z');
const daysAgo = (d: number) => new Date(NOW - d * 86_400_000).toISOString();
const base: SampleInput = {
  fixtureId: 1, kickoff: daysAgo(2), covered: true, hasLeague: true, settled: true,
  outcome: 'won', confidence: 0.71, homeScore: 2, awayScore: 0, publishedAfterKickoff: false,
};

test('a recent, settled, won, confident pick in a covered league is eligible', () => {
  assert.equal(sampleEligible(base, NOW), true);
});

test('losing, void or pending picks are never shown as the sample', () => {
  for (const outcome of ['lost', 'void', 'pending'] as const) assert.equal(sampleEligible({ ...base, outcome }, NOW), false);
});

test('coverage, league, score, settlement and publication guards', () => {
  assert.equal(sampleEligible({ ...base, covered: false }, NOW), false);
  assert.equal(sampleEligible({ ...base, hasLeague: false }, NOW), false);
  assert.equal(sampleEligible({ ...base, settled: false }, NOW), false);
  assert.equal(sampleEligible({ ...base, homeScore: null }, NOW), false);
  assert.equal(sampleEligible({ ...base, publishedAfterKickoff: true }, NOW), false);
});

test('confidence threshold is inclusive; missing confidence is out', () => {
  assert.equal(sampleEligible({ ...base, confidence: SAMPLE_MIN_CONF }, NOW), true);
  assert.equal(sampleEligible({ ...base, confidence: SAMPLE_MIN_CONF - 0.01 }, NOW), false);
  assert.equal(sampleEligible({ ...base, confidence: null }, NOW), false);
});

test('window: too old or in the future is out', () => {
  assert.equal(sampleEligible({ ...base, kickoff: daysAgo(SAMPLE_WINDOW_DAYS + 1) }, NOW), false);
  assert.equal(sampleEligible({ ...base, kickoff: daysAgo(-1) }, NOW), false);
  assert.equal(sampleEligible({ ...base, kickoff: 'nope' }, NOW), false);
});

test('pool: newest first, capped, only eligible rows', () => {
  const rows: SampleInput[] = [
    { ...base, fixtureId: 10, kickoff: daysAgo(10) },
    { ...base, fixtureId: 11, kickoff: daysAgo(1) },
    { ...base, fixtureId: 12, kickoff: daysAgo(5), outcome: 'lost' },
    { ...base, fixtureId: 13, kickoff: daysAgo(3) },
    { ...base, fixtureId: 14, kickoff: daysAgo(4) },
    { ...base, fixtureId: 15, kickoff: daysAgo(6) },
    { ...base, fixtureId: 16, kickoff: daysAgo(7) },
    { ...base, fixtureId: 17, kickoff: daysAgo(8) },
  ];
  const pool = pickSamplePool(rows, NOW);
  assert.equal(pool.length, SAMPLE_POOL);
  assert.deepEqual(pool.map((r) => r.fixtureId), [11, 13, 14, 15, 16]);
  assert.deepEqual(pickSamplePool(rows, NOW, 2).map((r) => r.fixtureId), [11, 13]);
});
