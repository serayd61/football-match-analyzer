// Instagram açıklaması: oran yok, bahis dili yok, "link in bio", ≤2200, etiket ≤30.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { instagramDailyCaption, instagramWeeklyCaption, instagramTags, type Leg } from '../src/lib/social/content';

const legs: Leg[] = [
  { fixtureId: 1, leagueSlug: 'premier-league', leagueName: 'Premier League', homeName: 'Arsenal', awayName: 'Chelsea', kickoff: '2026-10-31T15:00:00Z', market: 'ou25', selection: 'over', modelP: 0.68, odds: 1.55, source: 'daily' },
  { fixtureId: 2, leagueSlug: 'bundesliga', leagueName: 'Bundesliga', homeName: 'Bayern', awayName: 'Köln', kickoff: '2026-10-31T17:30:00Z', market: '1x2', selection: '1', modelP: 0.81, odds: 1.2, source: 'showcase' },
];

test('günlük açıklama: oran ve bahis kelimesi yok, link in bio var', () => {
  const t = instagramDailyCaption(legs, '2026-10-31', 'en', { n: 17, won: 12 }, ['#PL']);
  assert.ok(!/1\.55|1\.20|odds|bet|tip/i.test(t), t);
  assert.ok(t.includes('link in bio'));
  assert.ok(t.includes('Arsenal – Chelsea: Over 2.5 · model 68%'));
  assert.ok(t.includes('Last 7 days: 12/17'));
  assert.ok(t.includes('#PL') && t.includes('#footballanalytics'));
  assert.ok(t.length <= 2200);
  assert.ok(!t.includes('http'), 'Instagram açıklamasında tıklanmaz link olmasın');
});

test('etiketler tekilleşir ve 30 ile sınırlanır', () => {
  const many = Array.from({ length: 40 }, (_, i) => `#t${i}`);
  const tags = instagramTags('en', ['#footballanalytics', '#XG', ...many]).split(' ');
  assert.equal(tags.length, 30);
  assert.equal(new Set(tags.map((x) => x.toLowerCase())).size, 30);
});

test('haftalık açıklama: iki metin birleşir, URL bio işaretine döner', () => {
  const t = instagramWeeklyCaption({ from: '2026-10-19', to: '2026-10-25', n: 20, won: 14, byMarket: { '1x2': { n: 8, won: 5 }, ou25: { n: 7, won: 5 }, btts: { n: 5, won: 4 } }, noPick: 3 }, 'en');
  assert.ok(t.startsWith('Weekly record'));
  assert.ok(t.includes('Showcase picks: 14/20 (70%)'));
  assert.ok(!t.includes('http'));
  assert.ok(t.includes('link in bio'));
});
