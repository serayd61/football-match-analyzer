import 'server-only';
import { db } from './db';
import { localizeCachedAnalysis } from '@/lib/i18n/analysis-l10n';

// Maç sayfasındaki "Yapay zeka görüşü" bölümü (18 Eki): ai-picks cron'unun
// karneye uyan maçlar için ÜRETTİĞİ unified_analysis satırı salt-okunur
// gösterilir. Sayfa asla yeni analiz tetiklemez (kredi kontrolü kullanıcıda değil).

export interface AiView {
  createdAt: string;
  matchResult: { pick: '1' | 'X' | '2'; confidence: number; score: string | null; reasoning: string };
  overUnder: { pick: 'Over' | 'Under'; confidence: number; reasoning: string };
  btts: { pick: 'Yes' | 'No'; confidence: number; reasoning: string };
  bestBet: { market: string; selection: string; confidence: number; reasoning: string } | null;
  verdict: { market: string; selection: string; confidence: number; reasoning: string; agents: string | null; history: string | null } | null;
  agreement: number | null;
  risk: 'low' | 'medium' | 'high' | null;
  systems: string[];
}

const isFull = (systems: unknown) => Array.isArray(systems) && systems.some((s) => s !== 'smart');

export async function getAiAnalysis(fixtureId: number, locale: string): Promise<AiView | null> {
  const { data } = await db().from('unified_analysis').select('analysis, systems_used, created_at').eq('fixture_id', fixtureId).maybeSingle();
  if (!data?.analysis || !isFull(data.systems_used)) return null;
  const lang = locale === 'tr' || locale === 'de' ? locale : 'en';
  let a: any = data.analysis;
  if ((a.lang || 'tr') !== lang) { try { a = await localizeCachedAnalysis(a, lang, fixtureId); } catch { /* orijinal dil */ } }
  const pr = a.predictions || {};
  if (!pr.matchResult?.prediction) return null;
  const sv = a.survivalVerdict;
  return {
    createdAt: data.created_at,
    matchResult: { pick: pr.matchResult.prediction, confidence: Math.round(pr.matchResult.confidence ?? 0), score: pr.matchResult.scorePrediction || null, reasoning: pr.matchResult.reasoning || '' },
    overUnder: { pick: pr.overUnder?.prediction ?? 'Over', confidence: Math.round(pr.overUnder?.confidence ?? 0), reasoning: pr.overUnder?.reasoning || '' },
    btts: { pick: pr.btts?.prediction ?? 'Yes', confidence: Math.round(pr.btts?.confidence ?? 0), reasoning: pr.btts?.reasoning || '' },
    bestBet: a.bestBet?.market ? { market: a.bestBet.market, selection: a.bestBet.selection, confidence: Math.round(a.bestBet.confidence ?? 0), reasoning: a.bestBet.reasoning || '' } : null,
    verdict: sv?.market ? { market: sv.marketLabel || sv.market, selection: sv.selectionLabel || sv.selection, confidence: Math.round(sv.confidence ?? 0), reasoning: sv.reasoning || '', agents: sv.agentAgreement || null, history: sv.historicalBacking || null } : null,
    agreement: a.systemPerformance?.agreement ?? null,
    risk: a.systemPerformance?.riskLevel ?? null,
    systems: Array.isArray(data.systems_used) ? data.systems_used : [],
  };
}

/** Liste rozeti bilgisi: görüş hazır mı, ajanların ortak kararı (survivalVerdict) var mı. */
export interface AiListFlag { verdict: boolean }

/**
 * Listeler için: tam AI görüşü olan maçlar → { verdict } (24 Eki: rozet "ajan kararı var"
 * bilgisini de taşır; blok eşik altında bilerek susar, bkz. survival-agent/verdict.ts).
 * Tek sorgu; survivalVerdict.market JSON yolundan okunur, analiz gövdesi taşınmaz.
 */
export async function aiFixtureFlags(ids: number[]): Promise<Map<number, AiListFlag>> {
  const out = new Map<number, AiListFlag>();
  if (!ids.length) return out;
  const { data } = await db().from('unified_analysis').select('fixture_id, systems_used, verdict_market:analysis->survivalVerdict->>market').in('fixture_id', ids);
  for (const r of (data || []) as any[]) {
    if (!isFull(r.systems_used)) continue;
    out.set(Number(r.fixture_id), { verdict: typeof r.verdict_market === 'string' && r.verdict_market.length > 0 });
  }
  return out;
}

/** Geriye uyumluluk: yalnız kimlik kümesi. */
export async function aiFixtureIds(ids: number[]): Promise<Set<number>> {
  return new Set((await aiFixtureFlags(ids)).keys());
}
