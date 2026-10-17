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

// 2026-10-13: FotMob re-keyed the 2026-27 Championship to 1000001801 with the
// long feed/catalog name. Site coverage must fold it onto the championship slug.
test('championship resolves under the 2026-27 seasonal id and long feed name', () => {
  assert.equal(resolveLeague('English Football League - Championship', 1000001801, 'ENG')?.slug, 'championship');
  // other EFL divisions stay outside coverage
  assert.equal(resolveLeague('English Football League - League One', 1000001802, 'ENG'), null);
});
