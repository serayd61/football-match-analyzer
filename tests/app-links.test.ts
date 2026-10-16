import { test } from 'node:test';
import assert from 'node:assert/strict';
import { shareUrl, rateUrl, buildShareTarget, shareOrCopy, requestNativeReview, PLAY_STORE_URL, PLAY_MARKET_URL } from '@/lib/site/app-links';

test('shareUrl: localized site on the web, Play listing inside the app, both UTM-tagged', () => {
  assert.equal(shareUrl('tr', false), 'https://footballanalytics.pro/tr?utm_source=share&utm_medium=app_share');
  assert.equal(shareUrl('en', false), 'https://footballanalytics.pro/en?utm_source=share&utm_medium=app_share');
  assert.equal(shareUrl('../x', false), 'https://footballanalytics.pro/en?utm_source=share&utm_medium=app_share');
  assert.equal(shareUrl('de', true), `${PLAY_STORE_URL}&utm_source=share&utm_medium=app_share`);
});

test('rateUrl: market:// inside the WebView, https listing on the web', () => {
  assert.equal(rateUrl(true), PLAY_MARKET_URL);
  assert.equal(rateUrl(false), PLAY_STORE_URL);
  assert.match(PLAY_MARKET_URL, /^market:\/\/details\?id=pro\.footballanalytics$/);
});

test('buildShareTarget carries title/text and the share URL', () => {
  const t = buildShareTarget('it', false, 'T', 'X');
  assert.deepEqual(t, { title: 'T', text: 'X', url: 'https://footballanalytics.pro/it?utm_source=share&utm_medium=app_share' });
});

test('shareOrCopy: uses navigator.share when present, reports cancel, falls back to clipboard', async () => {
  const target = buildShareTarget('en', false, 'T', 'X');
  const calls: string[] = [];
  assert.equal(await shareOrCopy(target, { share: async () => { calls.push('share'); } }), 'shared');
  assert.equal(await shareOrCopy(target, { share: async () => { throw Object.assign(new Error('x'), { name: 'AbortError' }); } }), 'cancelled');
  assert.equal(await shareOrCopy(target, { share: async () => { throw new Error('boom'); }, clipboard: { writeText: async (s) => { calls.push(`copy:${s}`); } } }), 'copied');
  assert.equal(await shareOrCopy(target, { canShare: () => false, share: async () => { calls.push('nope'); }, clipboard: { writeText: async () => {} } }), 'copied');
  assert.equal(await shareOrCopy(target, {}), 'failed');
  assert.equal(await shareOrCopy(target, { clipboard: { writeText: async () => { throw new Error('denied'); } } }), 'failed');
  assert.deepEqual(calls, ['share', `copy:${target.url}`]);
});

test('native bridge (Play app ≥ v4) wins over navigator.share; review falls back to the link without it', async () => {
  const target = buildShareTarget('en', true, 'T', 'X');
  const calls: string[] = [];
  const bridge = { share: (t: string, x: string, u: string) => { calls.push(`native:${t}|${x}|${u}`); }, requestReview: () => { calls.push('review'); } };
  assert.equal(await shareOrCopy(target, { share: async () => { calls.push('web'); } }, bridge), 'shared');
  assert.equal(await shareOrCopy(target, { share: async () => { calls.push('web'); } }, { share: () => { throw new Error('x'); } }), 'shared'); // broken bridge → web share
  assert.equal(requestNativeReview(bridge), true);
  assert.equal(requestNativeReview(null), false);
  assert.equal(requestNativeReview({}), false);
  assert.deepEqual(calls, [`native:T|X|${target.url}`, 'web', 'review']);
});
