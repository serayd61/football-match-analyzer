import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { planAppToday, legLabelKey, APP_TODAY_LOCKED_ROWS } from '../src/lib/site/app-today-rule';
import { parseAppUa, appSignalOf, appSellsPro } from '../src/lib/site/app-ua';

// Uygulamanın "Bugün" açılış ekranı + kayıt kaynağı ölçümü (2026-11-15).

const now = Date.parse('2026-11-21T12:00:00Z');
const at = (h: number) => new Date(now + h * 3600_000).toISOString();
const rows = [
  { fixtureId: 1, kickoff: at(-3) },  // already played
  { fixtureId: 2, kickoff: at(2) },
  { fixtureId: 3, kickoff: at(5) },
  { fixtureId: 4, kickoff: at(1) },
  { fixtureId: 5, kickoff: at(6) },
  { fixtureId: 6, kickoff: at(7) },
  { fixtureId: 7, kickoff: at(8) },
  { fixtureId: 8, kickoff: at(9) },
];

test('today screen: trial and Pro members get the full list, no free or locked split', () => {
  for (const s of ['trial', 'pro'] as const) {
    assert.deepEqual(planAppToday(s, rows, [2, 3], now), { mode: 'member', free: [], locked: [], more: 0, total: 8 });
  }
});

test('today screen: visitor and expired member see the free matches with numbers, the rest locked', () => {
  for (const s of ['anon', 'expired'] as const) {
    const p = planAppToday(s, rows, [3, 2, 3], now);
    assert.equal(p.mode, 'guest');
    assert.deepEqual(p.free, [3, 2]);                       // de-duplicated, never in the locked list
    assert.deepEqual(p.locked, [4, 5, 6, 7, 8]);            // upcoming first, by kick-off
    assert.equal(p.locked.length, APP_TODAY_LOCKED_ROWS);
    assert.equal(p.more, 1);                                // the match already played comes last
    assert.equal(p.total, 8);
    assert.ok(!p.locked.some((id) => p.free.includes(id)));
  }
});

test('today screen: a free match outside the rated list still shows; empty day stays empty', () => {
  const p = planAppToday('anon', rows.slice(0, 2), [99], now);
  assert.deepEqual(p.free, [99]);
  assert.deepEqual(p.locked, [2, 1]);
  assert.deepEqual(planAppToday('anon', [], [], now), { mode: 'guest', free: [], locked: [], more: 0, total: 0 });
  assert.deepEqual(planAppToday('expired', rows, [], now).free, []);
});

test('published selection → label key', () => {
  assert.equal(legLabelKey('ou25', 'over'), 'selOver25');
  assert.equal(legLabelKey('btts', 'yes'), 'selBtts');
  assert.equal(legLabelKey('1x2', '1'), 'selHome');
  assert.equal(legLabelKey('1x2', '2'), 'selAway');
  assert.equal(legLabelKey('1x2', 'X'), 'selDraw');
});

const UA = 'Mozilla/5.0 (Linux; Android 14; SM-A155F Build/UP1A; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/131.0.0.0 Mobile Safari/537.36';

test('app signature: version from the user agent, web otherwise', () => {
  assert.deepEqual(parseAppUa(`${UA} FootballAnalyticsPro/1.3.0 (Android WebView)`), { app: true, version: '1.3.0' });
  assert.deepEqual(parseAppUa(`${UA} FootballAnalyticsPro/1.2 (Android WebView)`), { app: true, version: '1.2' });
  assert.deepEqual(parseAppUa(UA), { app: false, version: null });
  assert.deepEqual(parseAppUa(null), { app: false, version: null });
  assert.deepEqual(parseAppUa('FootballAnalyticsPro/<script>'), { app: true, version: null }); // nothing unparsed is stored
});

test('signup source: app by user agent or by the old TWA cookie, web otherwise', () => {
  assert.deepEqual(appSignalOf(`${UA} FootballAnalyticsPro/1.3.0 (Android WebView)`, false), { source: 'app', appVersion: '1.3.0' });
  assert.deepEqual(appSignalOf(UA, true), { source: 'app', appVersion: null });
  assert.deepEqual(appSignalOf(UA, false), { source: 'web', appVersion: null });
  assert.deepEqual(appSignalOf(undefined, false), { source: 'web', appVersion: null });
});

test('which versions can sell Pro in the app (1.3.0+)', () => {
  assert.equal(appSellsPro('1.3.0'), true);
  assert.equal(appSellsPro('1.4'), true);
  assert.equal(appSellsPro('2.0.0'), true);
  assert.equal(appSellsPro('1.2.0'), false);
  assert.equal(appSellsPro('1.0'), false);
  assert.equal(appSellsPro(null), null);
});

test('today screen strings exist in every locale and avoid promotional betting wording', () => {
  const keys = Object.keys(JSON.parse(readFileSync('messages/en.json', 'utf8')).appToday);
  assert.ok(keys.length >= 20);
  for (const loc of ['en', 'de', 'it', 'tr']) {
    const m = JSON.parse(readFileSync(`messages/${loc}.json`, 'utf8')).appToday;
    assert.deepEqual(Object.keys(m).sort(), [...keys].sort(), loc);
    const all = Object.values(m).join(' ').toLowerCase();
    for (const w of ['tips', 'sure bet', 'banko', 'kesin', 'bonus', 'scommesse', 'wette', 'guaranteed']) assert.ok(!all.includes(w), `${loc}: ${w}`);
  }
});

test('the app opens on the today screen; the web member home is unchanged', () => {
  const src = readFileSync('src/app/(site)/[locale]/m/page.tsx', 'utf8');
  assert.ok(src.includes('if (twa) return <AppTodayPage locale={locale} access={access} memberHero={unlocked ? await HomeMemberHero({ locale }) : null} />;'));
  assert.ok(src.indexOf('if (twa) return <AppTodayPage') < src.indexOf('<HomePage '));
});
