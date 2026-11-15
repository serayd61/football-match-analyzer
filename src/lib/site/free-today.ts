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

/** Ücretsiz maçın yayınlanan seçimi (uygulamanın "Bugün" ekranındaki kart). */
export interface FreeLeg { fixtureId: number; market: 'ou25' | 'btts' | '1x2'; selection: string; modelP: number }

// Salt okur: site_daily_picks (o günün dondurulmuş seçimleri) ve site_showcase_picks.
// Üretim yok; getDailyPicks/dailyLegs BURADAN çağrılmaz (bkz. free-today-rule.ts).
const loadLegs = unstable_cache(
  async (today: string, idsKey: string): Promise<FreeLeg[]> => {
    const ids = idsKey.split(',').map(Number).filter((n) => Number.isInteger(n) && n > 0);
    if (!ids.length) return [];
    const [daily, showcase] = await Promise.all([
      dbFresh().from('site_daily_picks').select('fixture_id, market, selection, model_p').eq('pick_date', today).in('fixture_id', ids),
      dbFresh().from('site_showcase_picks').select('fixture_id, market, selection, model_p').in('fixture_id', ids).not('market', 'is', null),
    ]);
    if (daily.error) throw new Error(daily.error.message);
    if (showcase.error) throw new Error(showcase.error.message);
    const out = new Map<number, FreeLeg>();
    for (const r of [...((daily.data ?? []) as any[]), ...((showcase.data ?? []) as any[])]) {
      const id = Number(r.fixture_id), p = Number(r.model_p), m = String(r.market);
      if (out.has(id) || !Number.isFinite(p) || !(m === 'ou25' || m === 'btts' || m === '1x2')) continue;
      out.set(id, { fixtureId: id, market: m, selection: String(r.selection ?? ''), modelP: p });
    }
    return [...out.values()];
  },
  ['site-free-today-legs-v1'],
  { revalidate: 300 },
);

/** Bugünün ücretsiz maçlarının yayınlanan seçimleri. Bulunamayan maç listede yer almaz. */
export async function freeLegsToday(): Promise<FreeLeg[]> {
  const { today } = await freeFixtures();
  if (!today.length) return [];
  return loadLegs(todayYmd(), [...today].sort((a, b) => a - b).join(',')).catch(() => []);
}
