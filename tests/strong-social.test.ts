import { test } from 'node:test';
import assert from 'node:assert/strict';
import { strongText, strongBoardText, tweetLength } from '@/lib/social/content';

const legs = [
  { fixtureId: 1, homeName: 'Bodø/Glimt 2', awayName: 'Sandefjord 2', kickoff: '2026-09-26T16:00:00Z', leagueName: '3. Divisjon Avd. 5', market: 'ou25' as const, selection: 'over', modelP: 0.82, won: 33, n: 38 },
  { fixtureId: 2, homeName: 'Hashtag United', awayName: 'Cray Valley PM', kickoff: '2026-09-26T14:00:00Z', leagueName: 'Isthmian Premier Division', market: 'btts' as const, selection: 'yes', modelP: 0.74, won: 17, n: 24 },
  { fixtureId: 3, homeName: 'Esteghlal Khuzestan', awayName: 'Shahrdari Astara', kickoff: '2026-09-26T13:30:00Z', leagueName: 'Azadegan League', market: 'under25' as const, selection: 'under', modelP: 0.79, won: 38, n: 51 },
];
test('strongText fits a tweet and keeps the record per league; telegram gets the full form', () => {
  const tw = strongText(legs, '2026-09-26', 'en', 'twitter', ['#NonLeague', '#Eliteserien', '#football', '#extra']);
  assert.ok(tweetLength(tw) <= 280, `len ${tweetLength(tw)}`);
  assert.match(tw, /^Strong markets today · 26 September/);
  assert.match(tw, /Over 2\.5 82%/);
  assert.match(tw, /utm_campaign=strong-markets/);
  const tg = strongText(legs, '2026-09-26', 'tr', 'telegram');
  assert.match(tg, /Bugün güçlü pazarlar/);
  assert.match(tg, /Isthmian Premier Division 17\/24/);
  assert.match(tg, /Garanti değil/);
});
test('strongBoardText trims leagues per market until the tweet fits', () => {
  const board = [
    { market: 'ou25' as const, leagues: [{ name: '3. Divisjon Avd. 5', won: 33, n: 38 }, { name: '3. Divisjon Avd. 2', won: 26, n: 29 }, { name: 'Highland / Lowland', won: 16, n: 19 }] },
    { market: 'btts' as const, leagues: [{ name: '1. Divisjon', won: 40, n: 57 }, { name: 'Isthmian Premier Division', won: 17, n: 24 }, { name: 'Eerste Divisie', won: 17, n: 22 }] },
    { market: 'under25' as const, leagues: [{ name: 'Azadegan League', won: 38, n: 51 }, { name: 'Primera B Metropolitana', won: 31, n: 41 }, { name: 'Liga Profesional Clausura', won: 21, n: 27 }] },
    { market: 'x12' as const, leagues: [{ name: 'Latvian Virsliga', won: 15, n: 19 }, { name: 'Premier League', won: 14, n: 15 }] },
  ];
  const tw = strongBoardText(board, 'en', 'twitter');
  assert.ok(tweetLength(tw) <= 280, `len ${tweetLength(tw)}`);
  assert.match(tw, /Over 2\.5: 3\. Divisjon Avd\. 5 33\/38/);
  const tg = strongBoardText(board, 'tr', 'telegram');
  assert.match(tg, /Üst 2,5: 3\. Divisjon Avd\. 5 33\/38 · 3\. Divisjon Avd\. 2 26\/29 · Highland \/ Lowland 16\/19/);
});
