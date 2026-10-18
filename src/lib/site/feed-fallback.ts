// ============================================================================
// Akış kesintisi yedeği: motor tahminlerinden maç listesi + football-data skoru
// ----------------------------------------------------------------------------
// Abone akış (free-football) düşünce (2026-10-18 tüm gün 502) iki yer kör kalır:
//   1) /api/v2/fixtures → site "bugün maç yok"
//   2) settle-engine    → sonuçlanma durur, karne/kupon ilerlemez
// Günün maçları zaten engine_predictions'ta (fixture_id, takım adları, lig, saat).
// Buradan FFMatch şeklinde liste üretir, football-data.org ile eşleşenlere
// skor/durum yazarız. Eşleşmeyenler (küçük ligler, ücretsiz katman dışı)
// listede "başlamadı" görünür; sonuçlanmada "bulunamadı" sayılır ama VOID
// EDİLMEZ (kısmi kaynak). Akış dönünce normal yol devreye girer.
// ============================================================================
import 'server-only';
import { dbFresh as db } from './db';
import { SITE_LEAGUES } from './leagues';
import type { FFMatch } from '@/lib/data-sources/free-football';
import { fdMatchesByDate, overlayFd, hasFootballDataKey } from '@/lib/data-sources/football-data';

const ACTIVE_MODEL = 'dc-1.0';

interface DayRow { fixture_id: number; home_id: number | null; away_id: number | null; home_name: string; away_name: string; league_id: number | null; league_name: string | null; kickoff: string }

async function dayRows(ymd: string): Promise<DayRow[]> {
  const from = `${ymd}T00:00:00Z`, to = `${new Date(Date.parse(from) + 86_400_000).toISOString().slice(0, 10)}T00:00:00Z`;
  const out: DayRow[] = [];
  for (let off = 0; off < 5000; off += 1000) {
    const { data, error } = await db().from('engine_predictions')
      .select('fixture_id, home_id, away_id, home_name, away_name, league_id, league_name, kickoff')
      .eq('model_version', ACTIVE_MODEL).gte('kickoff', from).lt('kickoff', to)
      .order('kickoff').order('fixture_id').range(off, off + 999);
    if (error) throw new Error(error.message);
    out.push(...((data ?? []) as DayRow[]));
    if (!data || data.length < 1000) break;
  }
  const seen = new Set<number>();
  return out.filter((r) => (seen.has(r.fixture_id) ? false : (seen.add(r.fixture_id), true)));
}

export interface FallbackDay { matches: FFMatch[]; scored: number; source: 'football-data' | 'db-only' }

/**
 * Bir UTC gün için yedek maç listesi. `onlyScored=true` (sonuçlanma) yalnız
 * football-data ile eşleşen satırları döndürür; `false` (site) tüm günü.
 */
export async function fallbackDay(ymd: string, onlyScored = false): Promise<FallbackDay> {
  const rows = await dayRows(ymd);
  const fd = hasFootballDataKey() ? await fdMatchesByDate(ymd) : null;
  const overlay = fd ? overlayFd(rows.map((r) => ({ id: r.fixture_id, kickoff: r.kickoff, home: r.home_name, away: r.away_name, leagueId: r.league_id })), fd) : new Map();
  const matches: FFMatch[] = [];
  for (const r of rows) {
    const o = overlay.get(r.fixture_id);
    if (onlyScored && !o) continue;
    const lg = SITE_LEAGUES.find((l) => r.league_id != null && l.ids.includes(r.league_id));
    matches.push({
      id: r.fixture_id, leagueId: r.league_id ?? 0, leagueName: r.league_name || lg?.name || '', leagueLogo: '', leagueCountry: lg?.country || '',
      homeId: r.home_id ?? 0, homeName: r.home_name, homeLogo: '', awayId: r.away_id ?? 0, awayName: r.away_name, awayLogo: '',
      homeScore: o?.homeScore ?? null, awayScore: o?.awayScore ?? null, utcTime: r.kickoff,
      finished: !!o?.finished, started: !!o?.started, cancelled: !!o?.cancelled,
    });
  }
  return { matches, scored: overlay.size, source: fd ? 'football-data' : 'db-only' };
}
