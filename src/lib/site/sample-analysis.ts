import 'server-only';
import { unstable_cache } from 'next/cache';
import { REVALIDATE } from './db';
import { listResults } from './results';
import { getPrediction, type SitePrediction } from './predictions';
import { pickSamplePool, SAMPLE_POOL } from './sample-analysis-rule';

// Ana sayfa "Örnek analizi gör" (2026-10-13): kural sample-analysis-rule.ts'te.
// Havuz saatte bir yenilenir; maç sayfası havuzdaki her maçı ziyaretçiye açar.
// SITE_SAMPLE_FIXTURE_ID ile elle bir maç sabitlenebilir (kampanya, tanıtım).

const pinnedId = (): number | null => {
  const n = Number(process.env.SITE_SAMPLE_FIXTURE_ID);
  return Number.isInteger(n) && n > 0 ? n : null;
};

/** Herkese açık örnek maçlar (fixtureId), en yeni önce. */
export const sampleFixtureIds = unstable_cache(
  async (): Promise<number[]> => {
    const pinned = pinnedId();
    const ids: number[] = [];
    if (pinned) {
      const p = await getPrediction(pinned).catch(() => null);
      if (p?.settled && p.homeScore != null) ids.push(pinned);
    }
    // Son 60 sonuç yeter: 45 günlük pencere + ≥%60 güven + kazanmış filtre.
    const page = await listResults({ league: null, from: null, to: null, page: 1, pageSize: 60 }).catch(() => null);
    const pool = pickSamplePool(
      (page?.rows ?? []).map((r) => ({ ...r, hasLeague: !!r.league })),
      Date.now(),
      SAMPLE_POOL,
    );
    for (const r of pool) if (!ids.includes(r.fixtureId)) ids.push(r.fixtureId);
    return ids;
  },
  ['site-sample-analysis-v1'],
  { revalidate: REVALIDATE.performance },
);

/** Ana sayfa kartı için ilk örnek (yoksa null → temsili kart). */
export async function getSampleAnalysis(): Promise<SitePrediction | null> {
  const [id] = await sampleFixtureIds();
  return id ? getPrediction(id) : null;
}

/** Bu maç ziyaretçiye açık örnek mi? (maç sayfası erişim kapısı) */
export async function isSampleFixture(fixtureId: number): Promise<boolean> {
  return (await sampleFixtureIds().catch(() => [] as number[])).includes(fixtureId);
}
