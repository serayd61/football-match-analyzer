// Risk label for a pick, derived from its calibrated confidence (0–1).
// Thresholds (design handoff 2026-09-11): Low ≥ 74%, Medium 65–73%, High < 65%.
// A pick without a calibrated confidence is treated as High risk — the
// honest default when the model can't say how sure it is.
export type Risk = 'low' | 'medium' | 'high';

export const RISK_LOW = 0.74;
export const RISK_MEDIUM = 0.65;

export function riskOf(confidence: number | null | undefined): Risk {
  if (confidence == null) return 'high';
  if (confidence >= RISK_LOW) return 'low';
  if (confidence >= RISK_MEDIUM) return 'medium';
  return 'high';
}

/** Expected loss rate in whole percent (100 − confidence). */
export function lossRate(confidence: number | null | undefined): number | null {
  if (confidence == null) return null;
  return Math.max(0, Math.min(100, 100 - Math.round(confidence * 100)));
}
