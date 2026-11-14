import 'server-only';
import { unstable_cache } from 'next/cache';
import { dbFresh } from './db';
import { todayYmd, addDays } from './time';
import { FREE_KINDS, freeFromPosts, type FreeFixtures, type FreePostRow } from './free-today-rule';

// Günün ücretsiz maçları (2026-11-14) — kural: free-today-rule.ts. Salt okur:
// yayınlanmış günlük gönderi + geri kazanım e-postasının kaydı (social_posts).
// 5 dk önbellek; anahtar güne bağlı, gece yarısı (Zürih) kendiliğinden döner.

const EMPTY: FreeFixtures = { today: [], open: [] };

const load = unstable_cache(
  async (today: string): Promise<FreeFixtures> => {
    const yesterday = addDays(today, -1);
    const { data, error } = await dbFresh().from('social_posts')
      .select('kind, day, status, fixture_ids')
      .in('kind', [...FREE_KINDS]).eq('status', 'posted').in('day', [yesterday, today]);
    if (error) throw new Error(error.message); // hata önbelleğe girmesin
    return freeFromPosts((data ?? []) as FreePostRow[], today, yesterday);
  },
  ['site-free-today-v1'],
  { revalidate: 300 },
);

/** Bugünün listesi + kapının açtığı maçlar. Okuma hatasında boş (kapı kapalı kalır). */
export async function freeFixtures(): Promise<FreeFixtures> {
  return load(todayYmd()).catch(() => EMPTY);
}

/** Bu maç bugün (ya da dün) ücretsiz yayınlananlardan mı? */
export async function isFreeFixture(fixtureId: number): Promise<boolean> {
  return (await freeFixtures()).open.includes(fixtureId);
}
