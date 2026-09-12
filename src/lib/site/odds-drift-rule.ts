// ============================================================================
// Oran hareketi (saf) — açılıştan son görüşe piyasa olasılığı nasıl kaydı?
// ----------------------------------------------------------------------------
// Girdi: faz sırasına göre oran noktaları. Çıktı: ilk ve son nokta, her sonuç
// için yüzde puan değişimi, KG Var oranı değişimi ve "kayda değer" eşiği
// (≥ 3 puan). Modelle karşılaştırma sayfada yapılır: hareket modelin seçtiği
// tarafa doğruysa "piyasa modele yaklaşıyor", tersiyse "uzaklaşıyor".
// Not: Backtest (2026-09-12) 1X2'de statik farkın ters sinyal olduğunu gösterdi;
// hareket yönü ayrı bir sinyaldir ve karnede ayrıca ölçülecektir. Şimdilik
// bilgi amaçlı gösterilir, seçim kuralına GİRMEZ.
// ============================================================================
import { isOddsPhase, PHASE_ORDER, type OddsPhase } from './odds-phases';

export interface DriftPoint {
  phase: string;
  capturedAt: string;
  provider: string | null;
  minutesToKickoff: number | null;
  homeOdds: number; drawOdds: number; awayOdds: number;
  pHome: number; pDraw: number; pAway: number;
  bttsYes: number | null; bttsNo: number | null;
}

export interface OddsDrift {
  first: DriftPoint;
  last: DriftPoint;
  /** nokta sayısı (faz) */
  points: number;
  /** yüzde puan: son − ilk (marjsız olasılık) */
  dHome: number; dDraw: number; dAway: number;
  /** KG Var ondalık oran farkı (son − ilk), yoksa null */
  dBttsYes: number | null;
  /** en büyük mutlak hareket ≥ NOTABLE_PP ise */
  notable: boolean;
  /** hareketin en büyük olduğu sonuç */
  mover: '1' | 'X' | '2';
}

export const NOTABLE_PP = 0.03;

export function computeDrift(rows: DriftPoint[]): OddsDrift | null {
  const pts = rows.filter((r) => isOddsPhase(r.phase) && r.homeOdds > 1 && r.drawOdds > 1 && r.awayOdds > 1)
    .sort((a, b) => PHASE_ORDER[a.phase as OddsPhase] - PHASE_ORDER[b.phase as OddsPhase] || a.capturedAt.localeCompare(b.capturedAt));
  if (!pts.length) return null;
  const first = pts[0], last = pts[pts.length - 1];
  const dHome = last.pHome - first.pHome, dDraw = last.pDraw - first.pDraw, dAway = last.pAway - first.pAway;
  const dBttsYes = first.bttsYes != null && last.bttsYes != null ? last.bttsYes - first.bttsYes : null;
  const abs = { '1': Math.abs(dHome), X: Math.abs(dDraw), '2': Math.abs(dAway) } as const;
  const mover = (Object.entries(abs).sort((a, b) => b[1] - a[1])[0][0]) as '1' | 'X' | '2';
  return { first, last, points: pts.length, dHome, dDraw, dAway, dBttsYes, notable: abs[mover] >= NOTABLE_PP, mover };
}

/** Modelin seçimi açısından hareket: piyasa o tarafa yaklaştı (+), uzaklaştı (−), durağan (0). */
export function driftVsPick(d: OddsDrift, pick: '1' | 'X' | '2' | null): 'toward' | 'away' | 'flat' {
  if (!pick) return 'flat';
  const delta = pick === '1' ? d.dHome : pick === '2' ? d.dAway : d.dDraw;
  if (Math.abs(delta) < NOTABLE_PP) return 'flat';
  return delta > 0 ? 'toward' : 'away';
}
