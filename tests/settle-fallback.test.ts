import { test } from 'node:test';
import assert from 'node:assert/strict';
import { settleEnginePredictions } from '../src/lib/engine/settle';
import type { FFMatch } from '../src/lib/data-sources/free-football';

const ff = (id: number, hs: number | null, as: number | null, finished = true): FFMatch => ({
  id, leagueId: 47, leagueName: 'PL', leagueLogo: '', leagueCountry: 'ENG', homeId: 1, homeName: 'A', homeLogo: '', awayId: 2, awayName: 'B', awayLogo: '',
  homeScore: hs, awayScore: as, utcTime: '2026-10-01T13:00:00Z', finished, started: true, cancelled: false,
});

// Sahte Supabase: pending satırlar + update kaydı
function fakeSb(rows: any[]) {
  const updates: any[] = [];
  const q: any = {
    select: () => q, eq: () => q, lt: () => q, order: () => q, in: (_c: string, ids: number[]) => { updates.push({ in: ids }); return q; },
    limit: async () => ({ data: rows, error: null }),
    update: (patch: any) => { updates.push({ patch }); return q; },
    then: (res: any) => res({ data: null, error: null }),
  };
  return { sb: { from: () => q } as any, updates };
}
const row = (id: number, fixture_id: number, kickoff: string) => ({ id, fixture_id, kickoff, pick: 'home', p_home: 0.5, p_draw: 0.3, p_away: 0.2, p_over25: 0.5, p_btts_yes: 0.5 });

test('ana kaynak düşünce yedek devreye girer, eşleşmeyen satır void edilmez', async () => {
  const old = '2026-09-01T13:00:00Z'; // 7 günden eski → normalde void adayı
  const { sb, updates } = fakeSb([row(1, 10, old), row(2, 11, old)]);
  const res = await settleEnginePredictions(sb, {
    now: new Date('2026-10-18T20:00:00Z'),
    fetch: async () => { throw new Error('502'); },
    fallback: async () => [ff(10, 2, 0)],
  });
  assert.deepEqual(res.fallbackDates, ['2026-09-01']);
  assert.equal(res.failedDates.length, 0);
  assert.equal(res.settled, 1);
  assert.equal(res.voided, 0);
  assert.equal(res.skipped.notFound, 1);
  assert.ok(updates.some((u) => u.patch?.settled === true && u.patch?.result != null), 'eşleşen satır sonuçlandı');
});

test('yedek de düşerse tarih ertelenir', async () => {
  const { sb } = fakeSb([row(1, 10, '2026-10-17T13:00:00Z')]);
  const res = await settleEnginePredictions(sb, {
    now: new Date('2026-10-18T20:00:00Z'),
    fetch: async () => { throw new Error('502'); },
    fallback: async () => { throw new Error('fd 429'); },
  });
  assert.deepEqual(res.failedDates, ['2026-10-17']);
  assert.equal(res.settled, 0);
});
