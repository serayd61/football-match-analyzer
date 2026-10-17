import { test } from 'node:test';
import assert from 'node:assert/strict';
import { legacyLocale, legacyRedirectTarget } from '@/lib/site/legacy-paths';

// SEO Faz 0 (2026-10-17): legacy unlocalized pages 301 to the localized site.

test('legacy locale: valid cookie wins, anything else → default', () => {
  assert.equal(legacyLocale('de'), 'de');
  assert.equal(legacyLocale('tr'), 'tr');
  assert.equal(legacyLocale('fr'), 'en');
  assert.equal(legacyLocale(undefined), 'en');
});

test('/analysis/{slug} keeps its slug on the public match page', () => {
  assert.equal(legacyRedirectTarget('/analysis/spain-vs-cape-verde-4667798', 'en'), '/en/matches/spain-vs-cape-verde-4667798');
  assert.equal(legacyRedirectTarget('/analysis/bochum-vs-ajax-5847094/', 'de'), '/de/matches/bochum-vs-ajax-5847094');
  assert.equal(legacyRedirectTarget('/analysis', 'tr'), '/tr/matches');
});

test('other legacy public pages map to their replacement', () => {
  assert.equal(legacyRedirectTarget('/leaderboard', 'en'), '/en/performance');
  assert.equal(legacyRedirectTarget('/ai-performance', 'it'), '/it/performance');
  assert.equal(legacyRedirectTarget('/track-record/', 'en'), '/en/performance');
  assert.equal(legacyRedirectTarget('/match/5103654', 'en'), '/en/predictions/5103654');
  assert.equal(legacyRedirectTarget('/live', 'de'), '/de/matches');
  assert.equal(legacyRedirectTarget('/contact', 'tr'), '/tr/contact');
});

test('members-only account pages and unknown paths are not redirected', () => {
  assert.equal(legacyRedirectTarget('/favorites', 'en'), null);
  assert.equal(legacyRedirectTarget('/settings', 'en'), null);
  assert.equal(legacyRedirectTarget('/analysis/not-a-match', 'en'), null);
  assert.equal(legacyRedirectTarget('/en/matches', 'en'), null);
});
