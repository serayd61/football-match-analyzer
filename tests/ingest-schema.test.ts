import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateIngestBatch, toEngineRow, IncomingPredictionSchema } from '@/lib/engine/ingest-schema';

const FUTURE = '2099-01-01T15:00:00Z';
const base = { fixtureId: 1, kickoff: FUTURE, p_home: 0.5, p_draw: 0.25, p_away: 0.25, pick: '1', confidence: 0.5 };

test('valid row passes and missing markets stay null (never 0)', () => {
  const { valid, rejected } = validateIngestBatch([base]);
  assert.equal(rejected.length, 0);
  const row = toEngineRow(valid[0]);
  assert.equal(row.p_over25, null);
  assert.equal(row.p_btts_yes, null);
  assert.equal(row.model_version, 'dc-1.0');
  // A re-ingest must not touch settlement columns (history is preserved by omission).
  for (const k of ['settled', 'home_score', 'away_score', 'result', 'correct']) assert.ok(!(k in row), `${k} must not be written by ingest`);
});

test('null / empty / non-finite probabilities are rejected, not coerced', () => {
  for (const bad of [null, '', 'abc', Infinity, NaN, -0.1, 1.2]) {
    const { rejected } = validateIngestBatch([{ ...base, p_home: bad, p_draw: 0.5, p_away: 0.5 }]);
    assert.equal(rejected.length, 1, `p_home=${String(bad)} should be rejected`);
  }
  const { rejected } = validateIngestBatch([{ ...base, p_over25: '' }]);
  assert.equal(rejected.length, 1);
});

test('1X2 probabilities must sum to 1 within tolerance', () => {
  assert.equal(validateIngestBatch([{ ...base, p_home: 0.5, p_draw: 0.5, p_away: 0.3 }]).rejected.length, 1);
  assert.equal(validateIngestBatch([{ ...base, p_home: 0.5, p_draw: 0.26, p_away: 0.25 }]).rejected.length, 0);
});

test('pick must be the most likely outcome', () => {
  const { rejected } = validateIngestBatch([{ ...base, pick: '2' }]);
  assert.equal(rejected.length, 1);
  assert.match(rejected[0].issues[0], /pick/);
});

test('kickoff in the past is rejected unless explicitly allowed', () => {
  const past = { ...base, kickoff: '2020-01-01T15:00:00Z' };
  assert.equal(validateIngestBatch([past]).rejected.length, 1);
  assert.equal(validateIngestBatch([past], { allowPastKickoff: true }).valid.length, 1);
});

test('invalid ids / dates / versions are rejected', () => {
  assert.equal(validateIngestBatch([{ ...base, fixtureId: 'x' }]).rejected.length, 1);
  assert.equal(validateIngestBatch([{ ...base, kickoff: 'not-a-date' }]).rejected.length, 1);
  assert.equal(validateIngestBatch([{ ...base, modelVersion: 'has space' }]).rejected.length, 1);
  assert.ok(IncomingPredictionSchema.safeParse({ ...base, lambda_home: -1 }).success === false);
});

test('per-row quarantine keeps valid rows and reports duplicates', () => {
  const { valid, rejected } = validateIngestBatch([base, { ...base, p_home: 2 }, { ...base, fixtureId: 2 }, { ...base }]);
  assert.equal(valid.length, 2);
  assert.equal(rejected.length, 2);
  assert.match(rejected[1].issues[0], /duplicate/);
});
