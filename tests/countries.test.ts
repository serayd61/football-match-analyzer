import { test } from 'node:test';
import assert from 'node:assert/strict';
import { countryName } from '@/lib/site/countries';

test('FIFA codes localize through Intl, specials through the table, unknown codes pass through', () => {
  assert.equal(countryName('NED', 'en'), 'Netherlands');
  assert.equal(countryName('GER', 'tr'), 'Almanya');
  assert.equal(countryName('ENG', 'tr'), 'İngiltere');
  assert.equal(countryName('INT', 'it'), 'Internazionale');
  assert.equal(countryName('XYZ', 'en'), 'XYZ');
  assert.equal(countryName(null, 'en'), null);
});
