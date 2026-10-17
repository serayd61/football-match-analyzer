import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isModelCovered, isCoveredLeagueName } from '@/lib/model-coverage';

test('isModelCovered folds feed aliases and seasonal ccode suffixes', () => {
  assert.equal(isModelCovered('Championship', 48, 'ENG'), true);
  assert.equal(isModelCovered('English Football League - Championship', 1000001801, 'ENG'), true);
  assert.equal(isModelCovered('EFL Championship', 1000001801, 'ENG'), true);
  assert.equal(isModelCovered('Champions League', 943230, 'INT-2'), true);
  assert.equal(isModelCovered('English Football League - League One', 1000001802, 'ENG'), false);
  assert.equal(isModelCovered('Championship', 937668, 'SCO'), false);
});

test('isCoveredLeagueName accepts the long Championship feed name', () => {
  assert.equal(isCoveredLeagueName('English Football League - Championship'), true);
  assert.equal(isCoveredLeagueName('Russian Premier League'), false);
});
