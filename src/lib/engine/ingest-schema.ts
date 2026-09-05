// ============================================================================
// Ingest sözleşmesi — n8n / predict-service → /api/v2/predictions/ingest
// ----------------------------------------------------------------------------
// Denetim 2026-09-05 (P1): eski ingest yalnız "sonlu sayı" dönüşümü yapıyor,
// aralık (0–1), toplam (=1) ve tarih/id kontrolü yapmıyordu; eksik değerler
// sessizce null'a dönüşüyordu. Bu modül katı bir şema tanımlar ve satır bazlı
// karantina yapar: geçerli satırlar yazılır, geçersizler nedenleriyle raporlanır.
// Batch tamamen geçersizse 422. Sessiz başarı yok.
// ============================================================================

import { z } from 'zod';

/** |p_home + p_draw + p_away − 1| için tolerans. */
export const PROB_SUM_TOLERANCE = 0.02;

const prob = z.number().finite().min(0).max(1);
const probOpt = prob.nullable().optional();
const lambda = z.number().finite().min(0).max(10).nullable().optional();
const idNum = z.coerce.number().int().positive();

export const IncomingPredictionSchema = z
  .object({
    fixtureId: idNum,
    leagueId: z.coerce.number().int().nullable().optional(),
    leagueName: z.string().max(200).nullable().optional(),
    homeId: z.coerce.number().int().nullable().optional(),
    homeName: z.string().max(200).nullable().optional(),
    awayId: z.coerce.number().int().nullable().optional(),
    awayName: z.string().max(200).nullable().optional(),
    kickoff: z
      .string()
      .refine((s) => !Number.isNaN(Date.parse(s)), { message: 'kickoff must be an ISO-8601 datetime' }),
    p_home: prob,
    p_draw: prob,
    p_away: prob,
    p_over25: probOpt,
    p_btts_yes: probOpt,
    lambda_home: lambda,
    lambda_away: lambda,
    pick: z.enum(['1', 'X', '2']).nullable().optional(),
    confidence: probOpt,
    rationale: z.string().max(4000).nullable().optional(),
    modelVersion: z.string().min(1).max(40).regex(/^[a-z0-9][a-z0-9._-]*$/i).optional(),
  })
  .superRefine((p, ctx) => {
    const sum = p.p_home + p.p_draw + p.p_away;
    if (Math.abs(sum - 1) > PROB_SUM_TOLERANCE) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['p_home'], message: `1X2 probabilities sum to ${sum.toFixed(4)}, expected 1 ± ${PROB_SUM_TOLERANCE}` });
    }
    if (p.pick) {
      const argmax = p.p_home >= p.p_draw && p.p_home >= p.p_away ? '1' : p.p_draw >= p.p_away ? 'X' : '2';
      if (argmax !== p.pick) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['pick'], message: `pick ${p.pick} is not the most likely outcome (${argmax})` });
      }
    }
  });

export type IncomingPrediction = z.infer<typeof IncomingPredictionSchema>;

export interface RejectedRow { index: number; fixtureId: number | string | null; issues: string[] }

export interface IngestValidation {
  valid: IncomingPrediction[];
  rejected: RejectedRow[];
}

export interface ValidateOptions {
  /** Kick-off'u geçmiş maçlar için pre-match tahmin yazımı reddedilir (varsayılan). */
  now?: Date;
  allowPastKickoff?: boolean;
}

/** Satır bazlı doğrulama: geçerli satırlar + nedenleriyle reddedilenler. */
export function validateIngestBatch(list: unknown[], opts: ValidateOptions = {}): IngestValidation {
  const now = opts.now ?? new Date();
  const valid: IncomingPrediction[] = [];
  const rejected: RejectedRow[] = [];
  const seen = new Map<string, number>();

  list.forEach((raw, index) => {
    const fixtureId = raw && typeof raw === 'object' && 'fixtureId' in (raw as any) ? (raw as any).fixtureId ?? null : null;
    const parsed = IncomingPredictionSchema.safeParse(raw);
    if (!parsed.success) {
      rejected.push({ index, fixtureId, issues: parsed.error.issues.map((i) => `${i.path.join('.') || '(root)'}: ${i.message}`) });
      return;
    }
    const p = parsed.data;
    if (!opts.allowPastKickoff && Date.parse(p.kickoff) < now.getTime()) {
      rejected.push({ index, fixtureId: p.fixtureId, issues: ['kickoff: match already started — pre-match prediction cannot be (re)written after kick-off'] });
      return;
    }
    const key = `${p.fixtureId}|${p.modelVersion ?? 'dc-1.0'}`;
    if (seen.has(key)) {
      rejected.push({ index, fixtureId: p.fixtureId, issues: [`duplicate fixtureId/modelVersion in batch (first at index ${seen.get(key)})`] });
      return;
    }
    seen.set(key, index);
    valid.push(p);
  });

  return { valid, rejected };
}

/** engine_predictions satırına dönüştür (eksik → null, asla 0 değil). */
export function toEngineRow(p: IncomingPrediction) {
  return {
    fixture_id: p.fixtureId,
    league_id: p.leagueId ?? null,
    league_name: p.leagueName ?? null,
    home_id: p.homeId ?? null,
    home_name: p.homeName ?? null,
    away_id: p.awayId ?? null,
    away_name: p.awayName ?? null,
    kickoff: new Date(p.kickoff).toISOString(),
    p_home: p.p_home,
    p_draw: p.p_draw,
    p_away: p.p_away,
    p_over25: p.p_over25 ?? null,
    p_btts_yes: p.p_btts_yes ?? null,
    lambda_home: p.lambda_home ?? null,
    lambda_away: p.lambda_away ?? null,
    pick: p.pick ?? null,
    confidence: p.confidence ?? null,
    rationale: p.rationale ?? null,
    model_version: p.modelVersion || 'dc-1.0',
  };
}
