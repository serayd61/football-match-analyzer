import 'server-only';
import { z } from 'zod';
import { db } from './db';
import { resolveOfficialVersion, officialFilter } from './official';
import { coveredLeagueIds } from './results';
import type { SitePrediction } from './predictions';
import type { MatchAssessment } from './assessment';
import { buildEvidence, SIMILARITY, type PoolRow, type EvidenceTarget, type EvidenceReport } from './evidence-rule';

// ============================================================================
// GEÇMİŞ KANIT ANALİZİ — sunucu veri yolu (evidence-1.0, 2026-10-16)
// ----------------------------------------------------------------------------
// Havuz: resmî model sürümünün sonuçlanmış `engine_predictions` satırları (tüm ligler,
// son 365 gün). Satırın λ ve p'leri motorun maç-öncesi çıktısıdır: ingest yalnız kickoff > now
// satırları yazar (api/v2/predictions/ingest), sonuç adımı yalnız skor/puan sütunlarını
// günceller (lib/engine/settle.ts rowScores).
// Sıkı zaman damgası gereken retrospektif ölçümde `engine_prediction_history.issued_at`
// kullanılmalıdır; ilk sürüm bunu yapmaz ve docs/evidence-agent.md'de söyler.
//
// Önbellek: havuz süreç belleğinde 30 dk (sürüm + asOf günü anahtarıyla). unstable_cache
// kullanılmadı: 12k+ satır 2 MB veri-önbelleği sınırına yaklaşır. Rapor her istekte
// yeniden kurulur (saf, ~ms). Sayfa ve API aynı fonksiyonu çağırır.
// ============================================================================

const Row = z.object({
  fixture_id: z.coerce.number(),
  league_id: z.coerce.number().nullable(),
  home_id: z.coerce.number().nullable(),
  away_id: z.coerce.number().nullable(),
  home_name: z.string(),
  away_name: z.string(),
  kickoff: z.string(),
  settled_at: z.string().nullable().optional(),
  p_home: z.coerce.number(),
  p_draw: z.coerce.number(),
  p_away: z.coerce.number(),
  p_over25: z.coerce.number().nullable(),
  p_btts_yes: z.coerce.number().nullable(),
  lambda_home: z.coerce.number(),
  lambda_away: z.coerce.number(),
  home_score: z.coerce.number(),
  away_score: z.coerce.number(),
});
const COLS = 'fixture_id, league_id, home_id, away_id, home_name, away_name, kickoff, settled_at, p_home, p_draw, p_away, p_over25, p_btts_yes, lambda_home, lambda_away, home_score, away_score';
const PAGE = 1000;
const MAX_ROWS = 40000;
const POOL_TTL_MS = 30 * 60 * 1000;

export interface EvidencePool { rows: PoolRow[]; truncated: boolean; official: string | null; loadedAt: string }

const poolCache = new Map<string, { at: number; value: Promise<EvidencePool> }>();

function toRow(raw: unknown): PoolRow | null {
  const p = Row.safeParse(raw);
  if (!p.success) return null;
  const r = p.data;
  return {
    fixtureId: r.fixture_id, leagueId: r.league_id, homeId: r.home_id, awayId: r.away_id, homeName: r.home_name, awayName: r.away_name,
    kickoff: r.kickoff, settledAt: r.settled_at ?? null, pHome: r.p_home, pDraw: r.p_draw, pAway: r.p_away, pOver25: r.p_over25, pBtts: r.p_btts_yes,
    lambdaHome: r.lambda_home, lambdaAway: r.lambda_away, homeScore: r.home_score, awayScore: r.away_score,
  };
}

async function fetchPool(asOf: string): Promise<EvidencePool> {
  const official = await resolveOfficialVersion();
  const minKo = new Date(Date.parse(asOf) - SIMILARITY.windowDays * 86_400_000).toISOString();
  const base = () => officialFilter(db()
    .from('engine_predictions')
    .select(COLS, { count: 'exact' })
    .eq('settled', true)
    .not('home_score', 'is', null)
    .not('lambda_home', 'is', null)
    .lt('kickoff', asOf)
    .gte('kickoff', minKo), official)
    .order('kickoff', { ascending: true })
    .order('fixture_id', { ascending: true });
  const first = await base().range(0, PAGE - 1);
  if (first.error) throw new Error(first.error.message);
  const total = Math.min(first.count ?? (first.data?.length ?? 0), MAX_ROWS);
  const pages: PromiseLike<unknown[]>[] = [];
  for (let from = PAGE; from < total; from += PAGE) {
    pages.push(base().range(from, Math.min(from + PAGE, total) - 1).then((r) => { if (r.error) throw new Error(r.error.message); return (r.data || []) as unknown[]; }));
  }
  const rest = (await Promise.all(pages)).flat();
  const rows: PoolRow[] = [];
  let quarantined = 0;
  for (const raw of [...((first.data || []) as unknown[]), ...rest]) { const r = toRow(raw); if (r) rows.push(r); else quarantined++; }
  if (quarantined) console.error(`[site/evidence] ${quarantined} rows quarantined`);
  return { rows, truncated: (first.count ?? 0) > MAX_ROWS, official, loadedAt: new Date().toISOString() };
}

/** Havuz (süreç belleği, 30 dk). Anahtar: asOf günü — aynı gün içinde aynı havuz, gün değişince tazelenir. */
export function loadEvidencePool(asOf: string): Promise<EvidencePool> {
  const key = asOf.slice(0, 10);
  const hit = poolCache.get(key);
  if (hit && Date.now() - hit.at < POOL_TTL_MS) return hit.value;
  const value = fetchPool(asOf).catch((e) => { poolCache.delete(key); throw e; });
  poolCache.set(key, { at: Date.now(), value });
  return value;
}

/** Test/cron kancası: belleği boşaltır. */
export function resetEvidencePool(): void { poolCache.clear(); }

export function targetOf(p: SitePrediction): EvidenceTarget {
  return {
    fixtureId: p.fixtureId, leagueId: p.leagueId, homeId: p.homeId, awayId: p.awayId, homeName: p.homeName, awayName: p.awayName, kickoff: p.kickoff,
    pHome: p.pHome, pDraw: p.pDraw, pAway: p.pAway,
    pOver25: p.overUnder ? (p.overUnder.pick === 'over' ? p.overUnder.pRaw : 1 - p.overUnder.pRaw) : null,
    pBtts: p.btts ? (p.btts.pick === 'yes' ? p.btts.pRaw : 1 - p.btts.pRaw) : null,
    lambdaHome: p.lambdaHome, lambdaAway: p.lambdaAway,
    pick: p.pick, overPick: p.overUnder?.pick ?? null, bttsPick: p.btts?.pick ?? null,
    // settle updated_at'ı günceller; sonuçlanmış satırda maç-öncesi yazım anı bilinmez → null (uyarı üretilmez)
    modelVersion: p.modelVersion, featuresAt: p.settled ? null : p.updatedAt,
  };
}

/**
 * asOf: ISO; gelecek tarih şimdiye kırpılır (gelecek veri yok). Verilmemişse maç-öncesi an:
 * başlamamış maçta şimdi, başlamış/bitmiş maçta kickoff (sonrası o maç için gelecektir).
 */
export function normalizeAsOf(raw: string | null | undefined, kickoff: string, now = Date.now()): string {
  const t = raw ? Date.parse(raw) : NaN;
  const ko = Date.parse(kickoff);
  const dflt = Number.isFinite(ko) ? Math.min(now, ko) : now;
  return new Date(Number.isFinite(t) ? Math.min(t, now) : dflt).toISOString();
}

export interface EvidenceResult { report: EvidenceReport; generatedAt: string; poolLoadedAt: string }

/** Sayfa ve API'nin ortak girişi. `assessment` sayfadan (assessWithDeps) gelir; durum burada hesaplanmaz. */
export async function getEvidence(p: SitePrediction, assessment: MatchAssessment | null, asOfRaw?: string | null): Promise<EvidenceResult> {
  const asOf = normalizeAsOf(asOfRaw, p.kickoff);
  const [pool, covered] = await Promise.all([
    loadEvidencePool(asOf),
    coveredLeagueIds().then((m) => new Set(Object.values(m).flat())).catch(() => null),
  ]);
  const report = buildEvidence({ target: targetOf(p), pool: pool.rows, poolTruncated: pool.truncated, assessment, asOf, coveredLeagueIds: covered });
  return { report, generatedAt: new Date().toISOString(), poolLoadedAt: pool.loadedAt };
}
