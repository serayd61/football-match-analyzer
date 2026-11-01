import { listSitemapMatches, latestDataUpdate } from '@/lib/site/match-public-data';
import { listTeams } from '@/lib/site/team-data';
import { teamPath } from '@/lib/site/teams';
import type { SitemapInput } from '@/lib/site/sitemap';

/** Veri tarafı (indeks ve bölüm rotaları aynı girdiyi kullanır). Okuma hatası → o bölüm boş, gerisi servis edilir. */
export async function loadSitemapInput(): Promise<SitemapInput> {
  const [matches, dataUpdated, teams] = await Promise.all([
    listSitemapMatches().catch((e) => { console.error('[sitemap] matches', e); return []; }),
    latestDataUpdate().catch(() => null),
    // SEO Faz 1b: team pages; lastmod = son oynanmış maç (2026-11-01)
    listTeams().then((ts) => ts.map((t) => ({ path: teamPath(t), lastmod: t.lastPlayed ?? null }))).catch((e) => { console.error('[sitemap] teams', e); return []; }),
  ]);
  return { dataUpdated, matches, teams };
}
