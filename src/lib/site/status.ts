// Pure match-state helpers (no server-only imports so they can be unit-tested).
export type MatchStatus = 'scheduled' | 'live' | 'finished' | 'postponed' | 'cancelled' | 'unknown';
export type ModelStatus = 'ready' | 'pending';

/** Status of an engine row without feed information. */
export function statusOfRow(r: { settled: boolean | null; result: string | null; kickoff: string }, now = Date.now()): MatchStatus {
  if (r.settled) return r.result == null ? 'unknown' : 'finished';
  return Date.parse(r.kickoff) > now ? 'scheduled' : 'unknown';
}

/** Feed status code → match state. */
export function feedStatus(status: string): MatchStatus {
  switch (status) {
    case 'NS': return 'scheduled';
    case 'LIVE': return 'live';
    case 'FT': return 'finished';
    case 'CANC': return 'cancelled';
    case 'PST': return 'postponed';
    default: return 'unknown';
  }
}
