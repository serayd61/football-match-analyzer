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

test('güçlü pazarlar açıklaması: lig karnesi var, oran yok, link in bio', async () => {
  const { instagramStrongCaption } = await import('../src/lib/social/content');
  const t = instagramStrongCaption([
    { fixtureId: 1, homeName: 'Bodø/Glimt 2', awayName: 'Sandefjord 2', kickoff: '2026-11-14T16:00:00Z', leagueName: '3. Divisjon', market: 'ou25', selection: 'over', modelP: 0.82, won: 33, n: 38 },
    { fixtureId: 2, homeName: 'A', awayName: 'B', kickoff: '2026-11-14T16:00:00Z', leagueName: 'L2', market: 'btts', selection: 'yes', modelP: 0.7, won: 20, n: 25 },
    { fixtureId: 3, homeName: 'C', awayName: 'D', kickoff: '2026-11-14T16:00:00Z', leagueName: 'L3', market: 'ou25', selection: 'over', modelP: 0.7, won: 20, n: 25 },
    { fixtureId: 4, homeName: 'E', awayName: 'F', kickoff: '2026-11-14T16:00:00Z', leagueName: 'L4', market: 'ou25', selection: 'over', modelP: 0.7, won: 20, n: 25 },
  ], '2026-11-14', 'en', ['#Eliteserien']);
  assert.ok(t.startsWith('Strong markets today · 14 November'));
  assert.ok(t.includes('Over 2.5 · model 82% · 3. Divisjon 33/38'));
  assert.ok(t.includes('A – B: BTTS Yes'));
  assert.ok(!t.includes('C – D') && !t.includes('E – F'), 'üçüncü ve sonrası gizli');
  assert.ok(t.includes('+2 more matches today'));
  assert.ok(!/odds|bet|tip|http/i.test(t), t);
  assert.ok(t.includes('link in bio') && t.includes('#Eliteserien'));
});

test('günün ikilisi: kupon kelimesi, oran ve ROI yok; sonuç yorumu kısa', async () => {
  const { instagramComboCaption, instagramComboResult } = await import('../src/lib/social/content');
  const legs = [
    { fixtureId: 1, kickoff: '2026-11-14T19:00:00Z', leagueLabel: 'Eerste Divisie', homeName: 'FC Dordrecht', awayName: 'Heracles', market: '1x2' as const, selection: '2', p: 0.8, homeScore: 0, awayScore: 2, won: true },
    { fixtureId: 2, kickoff: '2026-11-14T15:00:00Z', leagueLabel: 'Regionalliga', homeName: 'A', awayName: 'B', market: 'ou25' as const, selection: 'under', p: 0.66, homeScore: 1, awayScore: 0, won: true },
  ];
  const t = instagramComboCaption(legs, '2026-11-14', 'en', 0.53, { n: 9, won: 4 });
  assert.ok(t.startsWith('Model duo of the day · 14 November'));
  assert.ok(t.includes('FC Dordrecht – Heracles: Heracles win · model 80%'));
  assert.ok(t.includes('A – B: Under 2.5 · model 66%'));
  assert.ok(t.includes('Joint model probability of both landing: 53%'));
  assert.ok(!/coupon|odds|roi|stake|bet|http|\d\.\d\d/i.test(t), t);
  const r = instagramComboResult({ legs, status: 'won' }, '2026-11-14', 'en');
  assert.ok(r.startsWith('Result · 14 November ✓'));
  assert.ok(r.includes('FC Dordrecht 0-2 Heracles · Heracles win ✓') && r.endsWith('Both landed.'));
  assert.ok(!/coupon|odds|\d\.\d\d/i.test(r), r);
});
