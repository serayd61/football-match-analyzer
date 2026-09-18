import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pickBigMatches, replyText, followUpText, targets, packMessage, type EngageMatch } from '@/lib/social/engage-content';
import { tweetLength } from '@/lib/social/content';

const mk = (id: number, slug: string, league: string, h: string, a: string, pH: number, pD: number, pA: number, extra: Partial<EngageMatch> = {}): EngageMatch =>
  ({ fixtureId: id, leagueSlug: slug, leagueName: league, homeName: h, awayName: a, kickoff: '2026-09-18T19:00:00Z', pHome: pH, pDraw: pD, pAway: pA, pOver: 0.61, pBtts: 0.58, ...extra });

test('big matches: big clubs first, then league weight; reply ≤280 without a link; targets list handles', () => {
  const all = [
    mk(1, 'eredivisie', 'Eredivisie', 'FC Groningen', 'PEC Zwolle', 0.45, 0.27, 0.28),
    mk(2, 'premier-league', 'Premier League', 'Brentford', 'Chelsea', 0.33, 0.26, 0.41),
    mk(3, 'bundesliga', 'Bundesliga', 'Bayern München', 'Union Berlin', 0.8, 0.12, 0.08),
    mk(4, 'ligue-1', 'Ligue 1', 'Monaco', 'Lens', 0.5, 0.25, 0.25),
    mk(5, 'super-lig', 'Süper Lig', 'Galatasaray', 'Fenerbahçe', 0.45, 0.28, 0.27),
  ];
  const top = pickBigMatches(all, 3).map((m) => m.fixtureId);
  assert.deepEqual(top, [2, 5, 3]); // iki büyük kulüp > bir büyük kulüp; aynı kulüp sayısında lig ağırlığı (PL > Süper Lig > Bundesliga tek kulüp)
  const r = replyText(all[1]);
  assert.ok(tweetLength(r) <= 280 && !r.includes('http'), r);
  assert.ok(r.includes('Brentford 33%') && r.includes('Over 2.5 61%'));
  assert.deepEqual(targets(all[1]), ['@premierleague', '@BrentfordFC', '@ChelseaFC']);
});

test('follow-up marks favourite / over / btts against the score; null without a score', () => {
  const m = mk(2, 'premier-league', 'Premier League', 'Brentford', 'Chelsea', 0.33, 0.26, 0.41, { homeScore: 2, awayScore: 1 });
  const t = followUpText(m)!;
  assert.ok(t.startsWith('Result: Brentford 2-1 Chelsea.'));
  assert.ok(t.includes('Chelsea 41% ✗') && t.includes('Over 2.5 61% ✓') && t.includes('BTTS 58% ✓'), t);
  assert.equal(followUpText(mk(9, 'premier-league', 'PL', 'A', 'B', 0.5, 0.3, 0.2)), null);
  const msg = packMessage('2026-09-18', [m], [m]);
  assert.ok(msg.includes('X engagement pack · 18 September') && msg.includes('Paste:') && msg.includes("Yesterday's follow-ups"));
});
