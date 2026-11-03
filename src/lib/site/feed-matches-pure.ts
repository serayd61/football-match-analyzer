// ============================================================================
// feed_matches — saf eşleyiciler (feed-1.0, 2026-11-03). Sunucu/DB importu yok
// ki testler ve betikler doğrudan kullanabilsin. Yazan: feed-matches.ts.
// ============================================================================
import type { FFMatch } from '@/lib/data-sources/free-football';

export type FeedStatus = 'scheduled' | 'live' | 'finished' | 'cancelled';

export interface FeedMatchRow {
  fixture_id: number;
  league_id: number;
  league_name: string;
  league_ccode: string;
  home_id: number;
  home_name: string;
  away_id: number;
  away_name: string;
  home_score: number | null;
  away_score: number | null;
  kickoff: string;
  status: FeedStatus;
  updated_at: string;
}

export function feedStatus(m: Pick<FFMatch, 'finished' | 'started' | 'cancelled'>): FeedStatus {
  if (m.cancelled) return 'cancelled';
  if (m.finished) return 'finished';
  if (m.started) return 'live';
  return 'scheduled';
}

/** Akış maçını tablo satırına çevirir; id'si/saati eksik maç null (atlanır). */
export function toFeedRow(m: FFMatch, now = new Date()): FeedMatchRow | null {
  const id = Number(m.id), home = Number(m.homeId), away = Number(m.awayId);
  if (!Number.isFinite(id) || !Number.isFinite(home) || !Number.isFinite(away) || !m.utcTime) return null;
  const kickoff = new Date(m.utcTime);
  if (Number.isNaN(kickoff.getTime())) return null;
  const status = feedStatus(m);
  // Bitmemiş maçın skoru kalıcı değil; yalnız bitmiş maçta yazılır ki yarım skor "sonuç" sanılmasın.
  const scored = status === 'finished';
  return {
    fixture_id: id,
    league_id: Number(m.leagueId),
    league_name: m.leagueName || '',
    league_ccode: m.leagueCountry || '',
    home_id: home,
    home_name: m.homeName,
    away_id: away,
    away_name: m.awayName,
    home_score: scored && typeof m.homeScore === 'number' ? m.homeScore : null,
    away_score: scored && typeof m.awayScore === 'number' ? m.awayScore : null,
    kickoff: kickoff.toISOString(),
    status,
    updated_at: now.toISOString(),
  };
}

/** UTC gün listesi: bugünden `back` gün geriye (bugün dahil), eskiden yeniye. */
export function recentDays(back: number, today = new Date()): string[] {
  const n = Math.max(0, Math.floor(back));
  const base = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate());
  const out: string[] = [];
  for (let i = n; i >= 0; i--) out.push(new Date(base - i * 86_400_000).toISOString().slice(0, 10));
  return out;
}

/** from..to (YYYY-MM-DD, ikisi dahil) gün listesi; ters sıra veya hatalı tarih → []. */
export function dayRange(from: string, to: string): string[] {
  const a = Date.parse(`${from}T00:00:00Z`), b = Date.parse(`${to}T00:00:00Z`);
  if (Number.isNaN(a) || Number.isNaN(b) || a > b) return [];
  const out: string[] = [];
  for (let t = a; t <= b; t += 86_400_000) out.push(new Date(t).toISOString().slice(0, 10));
  return out;
}
