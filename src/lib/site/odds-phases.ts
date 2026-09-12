// ============================================================================
// Oran anlık görüntüsü fazları — açılıştan kapanışa saat bazlı seri
// ----------------------------------------------------------------------------
// Eskiden yalnız 'opening' (ilk görüş) ve 'closing' (≤90 dk) vardı; gün içi
// hareket görülmüyordu. Şimdi her maç için en fazla 6 nokta: ilk görüş, 24s,
// 12s, 6s, 3s ve kapanış. (fixture_id, phase) tekil; snapshot-odds tur başına
// maç başına tek API çağrısı yapar ve o anki fazı yazar. Sıra `PHASE_ORDER`
// ile karşılaştırılır; 'closing' her zaman en sondur.
// ============================================================================

export const ODDS_PHASES = ['opening', 'h24', 'h12', 'h6', 'h3', 'closing'] as const;
export type OddsPhase = (typeof ODDS_PHASES)[number];
export const PHASE_ORDER: Record<OddsPhase, number> = { opening: 0, h24: 1, h12: 2, h6: 3, h3: 4, closing: 5 };
export const isOddsPhase = (s: unknown): s is OddsPhase => typeof s === 'string' && (ODDS_PHASES as readonly string[]).includes(s);

/** Başlamaya kalan dakikaya göre o anda yazılacak faz. */
export function phaseForMinutes(mins: number): OddsPhase {
  if (mins <= 90) return 'closing';
  if (mins <= 180) return 'h3';
  if (mins <= 360) return 'h6';
  if (mins <= 720) return 'h12';
  if (mins <= 1440) return 'h24';
  return 'opening';
}

/** En geç faz (kapanış > 3s > … > açılış); eşitlikte en yeni captured_at. */
export function latestPhase<T extends { phase: string; captured_at?: string; capturedAt?: string }>(rows: T[]): T | null {
  let best: T | null = null;
  for (const r of rows) {
    if (!isOddsPhase(r.phase)) continue;
    if (!best) { best = r; continue; }
    const a = PHASE_ORDER[r.phase], b = PHASE_ORDER[best.phase as OddsPhase];
    if (a > b || (a === b && String(r.captured_at ?? r.capturedAt ?? '') > String(best.captured_at ?? best.capturedAt ?? ''))) best = r;
  }
  return best;
}
