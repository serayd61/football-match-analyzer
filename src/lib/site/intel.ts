import 'server-only';
import { unstable_cache } from 'next/cache';
import { db } from './db';
import { pickLatestIntel, type IntelView } from './intel-view';

// ============================================================================
// İSTİHBARAT KATMANI — sunucu okuyucu (2026-10-16)
// ----------------------------------------------------------------------------
// engine_intel'den bir maçın en son, kickoff ÖNCESİ üretilmiş analizini döner.
// Tablo yalnız service_role ile okunur (RLS: anon yok); sayfa üye kapısının
// arkasında. Tablo henüz yoksa / sorgu düşerse null → kart satırı gizlenir.
// ============================================================================

export const getMatchIntel = unstable_cache(
  async (fixtureId: number): Promise<IntelView | null> => {
    try {
      const { data, error } = await db()
        .from('engine_intel')
        .select('fixture_id, agent_version, model_version, llm_model, analyzed_at, issued_after_kickoff, baseline, final, goals, deviations, confidence, data_completeness, warnings')
        .eq('fixture_id', fixtureId)
        .eq('issued_after_kickoff', false)
        .order('analyzed_at', { ascending: false })
        .limit(6);
      if (error) { console.error('[site/intel] query failed', error.message); return null; }
      return pickLatestIntel((data || []) as unknown[]);
    } catch (e) {
      console.error('[site/intel] failed', e);
      return null;
    }
  },
  ['site-match-intel'],
  { revalidate: 5 * 60 },
);
