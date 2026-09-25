import { test } from 'node:test';
import assert from 'node:assert/strict';
import { backHref, sanitizeBackQs } from '@/lib/site/back-link';

test('back query keeps known keys only and drops junk', () => {
  assert.equal(sanitizeBackQs('date=2026-09-26&scope=all&country=NED&evil=1&league=u111'), 'date=2026-09-26&scope=all&country=NED&league=u111');
  assert.equal(sanitizeBackQs('scope=none&date=x'), null);
  assert.equal(sanitizeBackQs(''), null);
  assert.equal(sanitizeBackQs('market=btts&minp=65&minp=99'), 'market=btts&minp=65');
});

test('uncovered match returns to the list with scope=all and a league anchor; covered match to the day', () => {
  assert.equal(backHref({ back: 'date=2026-09-26&scope=all', covered: false, leagueId: 111, kickoffYmd: '2026-09-26', todayYmd: '2026-09-25' }), '/predictions?date=2026-09-26&scope=all#lg-111');
  assert.equal(backHref({ back: null, covered: false, leagueId: 111, kickoffYmd: '2026-09-26', todayYmd: '2026-09-25' }), '/predictions?date=2026-09-26&scope=all#lg-111');
  assert.equal(backHref({ back: null, covered: true, leagueId: 47, kickoffYmd: '2026-09-25', todayYmd: '2026-09-25' }), '/predictions');
  assert.equal(backHref({ back: 'league=premier-league', covered: true, leagueId: 47, kickoffYmd: '2026-09-25', todayYmd: '2026-09-25' }), '/predictions?league=premier-league');
});
