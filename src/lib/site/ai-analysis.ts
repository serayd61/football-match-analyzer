import 'server-only';
import { dbFresh } from './db';
import { localizeCachedAnalysis } from '@/lib/i18n/analysis-l10n';
import { toAiListFlag, aiMarketCode, aiSelCode, agentsShort, historyShort, verdictConflicts, type AiListFlag, type AiListRow, type AiMarket, type AiSel } from './ai-list';

export type { AiListFlag } from './ai-list';

// Maç sayfasındaki "Yapay zeka görüşü" bölümü (18 Eki): ai-picks cron'unun
// karneye uyan maçlar için ÜRETTİĞİ unified_analysis satırı salt-okunur
// gösterilir. Sayfa asla yeni analiz tetiklemez (kredi kontrolü kullanıcıda değil).
//
// Önbelleksiz okuma (24 Eki akşamı): db() GET yanıtları 5 dk Next fetch önbelleğinde
// kalır ve süresi dolunca BİR kez bayat servis edilir (stale-while-revalidate). Analiz
// üretilmeden önce ziyaret edilen maç sayfası "görüş yok"u önbelleğe alıyor, listede rozet
// göründüğü hâlde maça girince bölüm boş çıkıyordu (canlıda 55 kararlı maçın 24'ü; yenileyince
// doluyordu). İki çağırıcı da force-dynamic sayfalarda → no-store güvenli.

export interface AiView {
  createdAt: string;
  matchResult: { pick: '1' | 'X' | '2'; confidence: number; score: string | null; reasoning: string };
  overUnder: { pick: 'Over' | 'Under'; confidence: number; reasoning: string };
  btts: { pick: 'Yes' | 'No'; confidence: number; reasoning: string };
  bestBet: { market: string; selection: string; confidence: number; reasoning: string } | null;
  /** Ajanların ortak kararı — kodlarla (etiket bileşende, yerelde). `conflict`: aynı pazarda konsensüsle ters (31 Eki). */
  verdict: { market: AiMarket; sel: AiSel; confidence: number; reasoning: string; agents: string | null; history: { n: number; pct: number } | null; conflict: boolean } | null;
  agreement: number | null;
  risk: 'low' | 'medium' | 'high' | null;
  systems: string[];
}

const isFull = (systems: unknown) => Array.isArray(systems) && systems.some((s) => s !== 'smart');

export async function getAiAnalysis(fixtureId: number, locale: string): Promise<AiView | null> {
  const { data } = await dbFresh().from('unified_analysis').select('analysis, systems_used, created_at').eq('fixture_id', fixtureId).maybeSingle();
  if (!data?.analysis || !isFull(data.systems_used)) return null;
  const lang = locale === 'tr' || locale === 'de' ? locale : 'en';
  let a: any = data.analysis;
  if ((a.lang || 'tr') !== lang) { try { a = await localizeCachedAnalysis(a, lang, fixtureId); } catch { /* orijinal dil */ } }
  const pr = a.predictions || {};
  if (!pr.matchResult?.prediction) return null;
  const sv = a.survivalVerdict;
  const ouPick: 'Over' | 'Under' = pr.overUnder?.prediction ?? 'Over';
  const bttsPick: 'Yes' | 'No' = pr.btts?.prediction ?? 'Yes';
  const vm = aiMarketCode(sv?.market); const vs = vm ? aiSelCode(vm, sv?.selection) : null;
  const verdict = vm && vs ? {
    market: vm, sel: vs, confidence: Math.round(sv.confidence ?? 0), reasoning: sv.reasoning || '',
    agents: agentsShort(sv.agentAgreement), history: historyShort(sv.historicalBacking),
    conflict: verdictConflicts(vm, vs, { x12: pr.matchResult.prediction, ou25: ouPick === 'Over' ? 'over' : 'under', btts: bttsPick === 'Yes' ? 'yes' : 'no' }),
  } : null;
  return {
    createdAt: data.created_at,
    matchResult: { pick: pr.matchResult.prediction, confidence: Math.round(pr.matchResult.confidence ?? 0), score: pr.matchResult.scorePrediction || null, reasoning: pr.matchResult.reasoning || '' },
    overUnder: { pick: ouPick, confidence: Math.round(pr.overUnder?.confidence ?? 0), reasoning: pr.overUnder?.reasoning || '' },
    btts: { pick: bttsPick, confidence: Math.round(pr.btts?.confidence ?? 0), reasoning: pr.btts?.reasoning || '' },
    bestBet: a.bestBet?.market ? { market: a.bestBet.market, selection: a.bestBet.selection, confidence: Math.round(a.bestBet.confidence ?? 0), reasoning: a.bestBet.reasoning || '' } : null,
    verdict,
    agreement: a.systemPerformance?.agreement ?? null,
    risk: a.systemPerformance?.riskLevel ?? null,
    systems: Array.isArray(data.systems_used) ? data.systems_used : [],
  };
}

/**
 * Listeler için: tam AI görüşü olan maçlar → { verdict, pick, agent } (24 Eki: rozet "ajan kararı
 * var" bilgisini taşır; aynı gün akşamı satır altı özet eklendi — AI en iyi bahis + ajan kararı).
 * Tek sorgu; yalnız gereken JSON yolları okunur, analiz gövdesi taşınmaz. Blok eşik altında
 * bilerek susar, bkz. survival-agent/verdict.ts.
 */
export async function aiFixtureFlags(ids: number[]): Promise<Map<number, AiListFlag>> {
  const out = new Map<number, AiListFlag>();
  if (!ids.length) return out;
  const { data } = await dbFresh().from('unified_analysis').select([
    'fixture_id', 'systems_used',
    'b_market:analysis->bestBet->>market', 'b_sel:analysis->bestBet->>selection', 'b_conf:analysis->bestBet->>confidence',
    'v_market:analysis->survivalVerdict->>market', 'v_sel:analysis->survivalVerdict->>selection', 'v_conf:analysis->survivalVerdict->>confidence', 'v_agents:analysis->survivalVerdict->>agentAgreement',
  ].join(', ')).in('fixture_id', ids);
  for (const r of (data || []) as any[]) {
    if (!isFull(r.systems_used)) continue;
    out.set(Number(r.fixture_id), toAiListFlag(r as AiListRow));
  }
  return out;
}

/** Geriye uyumluluk: yalnız kimlik kümesi. */
export async function aiFixtureIds(ids: number[]): Promise<Set<number>> {
  return new Set((await aiFixtureFlags(ids)).keys());
}
