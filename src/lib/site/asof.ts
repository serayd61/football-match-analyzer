/**
 * "As of kick-off" bound for form / head-to-head queries: only matches that
 * kicked off strictly before `before` (ISO) are eligible, so a past match can
 * never list itself or later games as its own form (denetim 2026-09-05).
 * Kept separate so the contract is unit-testable with a stub builder.
 */
export function asOfFilter<Q extends { lt(col: string, v: string): Q }>(q: Q, before: string | null | undefined): Q {
  if (!before) return q;
  if (Number.isNaN(Date.parse(before))) throw new Error(`asOfFilter: invalid datetime "${before}"`);
  return q.lt('kickoff', before);
}
