import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { shouldShowAppBanner } from '@/components/site/AppBanner';
import en from '../messages/en.json';
import de from '../messages/de.json';
import it from '../messages/it.json';
import tr from '../messages/tr.json';

// Android şerit + manifest Play ilişkisi (2026-10-31).
const ANDROID = 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 Chrome/130 Mobile Safari/537.36';
const IOS = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148 Safari/604.1';
const now = Date.parse('2026-10-31T10:00:00Z');

test('banner: Android browser only, not inside the Play app, 14-day dismiss', () => {
  assert.equal(shouldShowAppBanner(ANDROID, '', null, now), true);
  assert.equal(shouldShowAppBanner(IOS, '', null, now), false);
  assert.equal(shouldShowAppBanner('Mozilla/5.0 (Macintosh) Chrome/130', '', null, now), false);
  assert.equal(shouldShowAppBanner(ANDROID + ' FootballAnalyticsPro/5 (Android WebView)', '', null, now), false);
  assert.equal(shouldShowAppBanner(ANDROID, 'theme=dark; fa_twa=1', null, now), false);
  assert.equal(shouldShowAppBanner(ANDROID, 'notfa_twa=1', null, now), true);
  assert.equal(shouldShowAppBanner(ANDROID, '', String(now - 13 * 86_400_000), now), false);
  assert.equal(shouldShowAppBanner(ANDROID, '', String(now - 15 * 86_400_000), now), true);
  assert.equal(shouldShowAppBanner(ANDROID, '', 'garbage', now), true);
});

test('banner strings exist in all four locales', () => {
  for (const m of [en, de, it, tr] as any[]) for (const k of ['bannerTitle', 'bannerLead', 'bannerCta', 'bannerClose']) assert.ok(m.playApp?.[k], k);
});

test('manifest declares the Play app as related application', () => {
  const mf = JSON.parse(readFileSync(join(__dirname, '..', 'public', 'manifest.json'), 'utf8'));
  assert.equal(mf.prefer_related_applications, true);
  assert.deepEqual(mf.related_applications, [{ platform: 'play', id: 'pro.footballanalytics', url: 'https://play.google.com/store/apps/details?id=pro.footballanalytics' }]);
});
