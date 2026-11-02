import { test } from 'node:test';
import assert from 'node:assert/strict';
import { shouldShowTrialBanner } from '@/components/site/TrialEndedBanner';
import en from '../messages/en.json';
import de from '../messages/de.json';
import it from '../messages/it.json';
import tr from '../messages/tr.json';

// Deneme bitimi Pro şeridi (2026-11-02): yalnız web, yalnız süresi dolmuş üye,
// paywall olan sayfalarda değil, kapatınca 30 gün gizli.
const now = Date.parse('2026-11-02T10:00:00Z');

test('banner: expired members on the web, on public pages, 30-day dismiss', () => {
  assert.equal(shouldShowTrialBanner('expired', '/', '', null, now), true);
  assert.equal(shouldShowTrialBanner('expired', '/matches', 'theme=dark', null, now), true);
  assert.equal(shouldShowTrialBanner('expired', '/en/performance', '', null, now), true);
  for (const s of ['anon', 'trial', 'pro', null] as const) assert.equal(shouldShowTrialBanner(s, '/', '', null, now), false, String(s));
  // Play app: Play payments policy forbids steering to a subscription inside the app.
  assert.equal(shouldShowTrialBanner('expired', '/', 'fa_twa=1', null, now), false);
  assert.equal(shouldShowTrialBanner('expired', '/', 'x=1; fa_twa=1', null, now), false);
  assert.equal(shouldShowTrialBanner('expired', '/', 'notfa_twa=1', null, now), true);
  // Pages that already carry a paywall / plan chip.
  for (const p of ['/pricing', '/account', '/login', '/dashboard', '/predictions', '/predictions/123', '/picks', '/coupon', '/tr/pricing', '/de/predictions/5']) {
    assert.equal(shouldShowTrialBanner('expired', p, '', null, now), false, p);
  }
  assert.equal(shouldShowTrialBanner('expired', '/pricing-guide', '', null, now), true);
  // Dismiss window.
  assert.equal(shouldShowTrialBanner('expired', '/', '', String(now - 29 * 86_400_000), now), false);
  assert.equal(shouldShowTrialBanner('expired', '/', '', String(now - 31 * 86_400_000), now), true);
  assert.equal(shouldShowTrialBanner('expired', '/', '', 'garbage', now), true);
});

test('banner strings exist in all four locales and carry no gambling-coded wording', () => {
  for (const [name, m] of Object.entries({ en, de, it, tr }) as Array<[string, any]>) {
    for (const k of ['bannerKicker', 'bannerTitle', 'bannerLead', 'bannerCta', 'bannerClose']) {
      assert.ok(m.paywall?.[k], `${name} ${k}`);
      assert.ok(!/18\+|bookmaker|buchmacher|bahisçi|\btips?\b|\bpicks?\b/i.test(m.paywall[k]), `${name} ${k} wording`);
    }
  }
});
