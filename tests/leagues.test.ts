import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resolveLeague } from '@/lib/site/leagues';

// 2026-27: FotMob gives the Champions League league phase a new seasonal id
// (943230) and a suffixed ccode ("INT-2"). Both must resolve to coverage.
test('champions league resolves by new seasonal id', () => {
  assert.equal(resolveLeague('Champions League', 943230, 'INT-2')?.slug, 'champions-league');
  assert.equal(resolveLeague('Champions League', 42, 'INT')?.slug, 'champions-league');
});

test('suffixed international ccode folds to INT for name matching', () => {
  assert.equal(resolveLeague('Champions League', 999999999, 'INT-2')?.slug, 'champions-league');
  // other INT-2 cups stay outside coverage
  assert.equal(resolveLeague('Europa League', 943229, 'INT-2'), null);
});

test('seasonal ids still resolve by name + country', () => {
  assert.equal(resolveLeague('Championship', 938218, 'ENG')?.slug, 'championship');
  assert.equal(resolveLeague('Eredivisie', 937276, 'NED')?.slug, 'eredivisie');
  assert.equal(resolveLeague('Championship', 937668, 'SCO'), null);
});
