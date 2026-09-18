import { test } from 'node:test';
import assert from 'node:assert/strict';
import { oauth1Header, oauth1Signature, pctEncode } from '@/lib/social/oauth1';
import { pickLegs, dailyText, tweetLength, resultText, weeklyText, marketLabel, hashtags, matchTrends, toTag, type Leg } from '@/lib/social/content';

// X belgelerindeki "Creating a signature" örneği (bilinen vektör).
test('oauth1 signature matches the X documentation example', () => {
  const params = {
    include_entities: 'true',
    status: 'Hello Ladies + Gentlemen, a signed OAuth request!',
    oauth_consumer_key: 'xvz1evFS4wEEPTGEFPHBog',
    oauth_nonce: 'kYjzVBB8Y0ZFabxSWbWovY3uYSQ2pTgmZeNu2VS4cg',
    oauth_signature_method: 'HMAC-SHA1',
    oauth_timestamp: '1318622958',
    oauth_token: '370773112-GmHxMAgYyLbNEtIKZeRNFsMKPR9EyMZeS9weJAEb',
    oauth_version: '1.0',
  };
  const sig = oauth1Signature('POST', 'https://api.twitter.com/1.1/statuses/update.json', params, 'kAcSOqF21Fu85e7zjz7ZN2U4ZRhfV3WpwPAoE3Z7kBw', 'LswwdoUaIvS8ltyTt5jkRh4J50vUPVVHtR2YPi5kE');
  assert.equal(sig, 'hCtSmYh+iHYCEqBWrE7C7hYmtUk=');
  assert.equal(pctEncode("Ladies + Gentlemen!*'()"), 'Ladies%20%2B%20Gentlemen%21%2A%27%28%29');
  const header = oauth1Header('POST', 'https://api.twitter.com/1.1/statuses/update.json?include_entities=true', { apiKey: 'xvz1evFS4wEEPTGEFPHBog', apiSecret: 'kAcSOqF21Fu85e7zjz7ZN2U4ZRhfV3WpwPAoE3Z7kBw', accessToken: '370773112-GmHxMAgYyLbNEtIKZeRNFsMKPR9EyMZeS9weJAEb', accessSecret: 'LswwdoUaIvS8ltyTt5jkRh4J50vUPVVHtR2YPi5kE' }, { status: 'Hello Ladies + Gentlemen, a signed OAuth request!' }, { nonce: 'kYjzVBB8Y0ZFabxSWbWovY3uYSQ2pTgmZeNu2VS4cg', timestamp: '1318622958' });
  assert.ok(header.startsWith('OAuth '));
  assert.ok(header.includes('oauth_signature="hCtSmYh%2BiHYCEqBWrE7C7hYmtUk%3D"'));
});

const leg = (id: number, market: Leg['market'], sel: string, p: number, odds: number | null, src: Leg['source'], ko = '2026-09-19T13:30:00Z'): Leg =>
  ({ fixtureId: id, leagueSlug: 'bundesliga', leagueName: 'Bundesliga', homeName: `Home${id}`, awayName: `Away${id}`, kickoff: ko, market, selection: sel, modelP: p, odds, source: src });

test('pickLegs: daily first, then showcase goal markets by model, then 1X2; one leg per match; max 3; sorted by kickoff', () => {
  const daily = [leg(1, 'btts', 'yes', 0.62, 1.6, 'daily', '2026-09-19T16:00:00Z')];
  const showcase = [leg(1, 'ou25', 'over', 0.9, 1.3, 'showcase'), leg(2, 'ou25', 'over', 0.7, 1.5, 'showcase', '2026-09-19T11:30:00Z'), leg(3, '1x2', '1', 0.8, 1.4, 'showcase'), leg(4, 'btts', 'yes', 0.66, 1.6, 'showcase', '2026-09-19T13:00:00Z')];
  const out = pickLegs(daily, showcase, 3);
  assert.deepEqual(out.map((l) => l.fixtureId), [2, 4, 1]);
  assert.equal(out.find((l) => l.fixtureId === 1)!.market, 'btts');
});

test('dailyText stays within 280 weighted chars and carries the UTM link', () => {
  const legs = [leg(1, 'ou25', 'over', 0.73, 1.62, 'daily'), leg(2, 'btts', 'yes', 0.66, 1.62, 'showcase'), leg(3, '1x2', '2', 0.61, 1.27, 'showcase')];
  const t = dailyText(legs, '2026-09-19', 'tr', { n: 21, won: 11 });
  assert.ok(tweetLength(t) <= 280, `len ${tweetLength(t)}`);
  assert.ok(t.includes('utm_source=twitter'));
  assert.ok(t.includes('Üst 2,5'));
  assert.ok(t.includes('1,62'));
  assert.ok(t.includes('Son 7 gün: 11/21'));
  const tg = dailyText(legs, '2026-09-19', 'en', null, 'telegram');
  assert.ok(tg.includes('utm_source=telegram'));
  assert.ok(/Today's picks · 19 September · CES?T/.test(tg), tg.split('\n')[0]);
  const en = dailyText(legs, '2026-09-19', 'en', null);
  assert.ok(en.startsWith("Today's picks"));
  assert.ok(en.includes('Over 2.5') && en.includes('Away3 win'));
});

test('result and weekly texts', () => {
  const l = leg(7, 'btts', 'yes', 0.66, 1.62, 'daily');
  assert.equal(resultText(l, 2, 1, true, 'tr'), 'Home7 2-1 Away7 · KG Var ✓');
  assert.equal(marketLabel({ market: '1x2', selection: 'X', homeName: 'A', awayName: 'B' }, 'en'), 'Draw');
  const w = weeklyText({ from: '2026-09-13', to: '2026-09-19', n: 21, won: 11, byMarket: { '1x2': { n: 10, won: 7 }, ou25: { n: 3, won: 2 }, btts: { n: 8, won: 2 } }, noPick: 9 }, 'tr');
  assert.equal(w.length, 2);
  assert.ok(w[0].includes('11/21 (%52)') && w[0].includes('KG 2/8'));
  assert.ok(w[1].includes('utm_campaign=weekly-record'));
  assert.ok(tweetLength(w[0]) <= 280 && tweetLength(w[1]) <= 280);
});

test('hashtags: trend matches on team/league words, league tags follow, max 3, twitter only', () => {
  const legs: Leg[] = [
    { fixtureId: 1, leagueSlug: 'bundesliga', leagueName: 'Bundesliga', homeName: 'Bayern München', awayName: 'Union Berlin', kickoff: '2026-09-18T18:30:00Z', market: 'ou25', selection: 'over', modelP: 0.89, odds: 1.11, source: 'daily' },
    { fixtureId: 2, leagueSlug: 'premier-league', leagueName: 'Premier League', homeName: 'Brentford', awayName: 'Chelsea', kickoff: '2026-09-18T19:00:00Z', market: 'btts', selection: 'yes', modelP: 0.68, odds: 1.4, source: 'daily' },
    { fixtureId: 3, leagueSlug: 'eredivisie', leagueName: 'Eredivisie', homeName: 'FC Groningen', awayName: 'PEC Zwolle', kickoff: '2026-09-18T18:00:00Z', market: 'ou25', selection: 'over', modelP: 0.67, odds: 1.44, source: 'daily' },
  ];
  const trends = ['Taylor Swift', '#Bayern', 'Chelsea', 'Manchester United', '#Eredivisie', 'Union'];
  assert.deepEqual(matchTrends(legs, trends), ['#Bayern', '#Chelsea', '#Eredivisie']); // 'Union' generic → yok
  assert.deepEqual(hashtags(legs, trends), ['#Bayern', '#Chelsea', '#Bundesliga']);
  assert.deepEqual(hashtags(legs, []), ['#Bundesliga', '#PL', '#Eredivisie']);
  assert.equal(toTag('Bayern Munich'), '#BayernMunich');
  const tw = dailyText(legs, '2026-09-18', 'en', null, 'twitter', hashtags(legs, trends));
  assert.ok(tw.includes('#Bayern #Chelsea #Bundesliga'), tw);
  assert.ok(tweetLength(tw) <= 280);
  const tg = dailyText(legs, '2026-09-18', 'en', null, 'telegram', hashtags(legs, trends));
  assert.ok(!tg.includes('#'), tg);
  const w = weeklyText({ from: '2026-09-13', to: '2026-09-19', n: 21, won: 11, byMarket: {}, noPick: 9 }, 'en', 'twitter', ['#football']);
  assert.ok(w[0].endsWith('#football'));
});
