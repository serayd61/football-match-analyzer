// ============================================================================
// ANALYSIS L10N — cache'lenmiş analizin LLM SERBEST METİNLERİ için
// okuma-anında çeviri (translate-on-read)
// ----------------------------------------------------------------------------
// unified_analysis cache'i fixture başına TEK satırdır ve üç dil paylaşır;
// analiz hangi dille üretildiyse (result.lang) LLM serbest metinleri o dilde
// kalır. Şablon cümleleri istemcideki server-text.ts çevirir; bu modül ise
// şablon OLMAYAN LLM metinlerini (Devil's Advocate, bestBet gerekçesi, maç
// bağlam etiketi, çelişki açıklamaları) hedef dile TEK ucuz LLM çağrısıyla
// çevirir ve fixture+dil başına redis'te saklar (7 gün) — maliyet fixture
// başına dil başına 1 çağrıdır, sonrası cache.
// Her hata yolunda ORİJİNAL analiz döner (çeviri asla akışı kırmaz).
// ============================================================================

import { aiClient } from '@/lib/ai-client';
import { getRedisClient } from '@/lib/cache/redis';

type Lang = 'tr' | 'en' | 'de';
const LANG_NAME: Record<Lang, string> = { tr: 'Turkish', en: 'English', de: 'German' };
const TTL = 7 * 24 * 3600;
const LLM_TIMEOUT_MS = 15_000;

interface ProseBundle {
  da?: {
    contrarianView?: string;
    risks?: string[];
    trapMatchIndicators?: string[];
    whyFavoriteMightFail?: string;
    agentSummary?: string;
  };
  bestBetReasoning?: string;
  matchContextLabel?: string;
  conflicts?: { description?: string; resolution?: string }[];
}

function extractProse(analysis: any): ProseBundle | null {
  const b: ProseBundle = {};
  const da = analysis?.sources?.agents?.devilsAdvocate;
  if (da) {
    b.da = {
      contrarianView: da.contrarianView,
      risks: Array.isArray(da.risks) ? da.risks : undefined,
      trapMatchIndicators: Array.isArray(da.trapMatchIndicators) ? da.trapMatchIndicators : undefined,
      whyFavoriteMightFail: da.whyFavoriteMightFail,
      agentSummary: da.agentSummary,
    };
  }
  if (analysis?.bestBet?.reasoning) b.bestBetReasoning = analysis.bestBet.reasoning;
  if (analysis?.matchContext?.label) b.matchContextLabel = analysis.matchContext.label;
  const conflicts = analysis?.systemPerformance?.conflicts;
  if (Array.isArray(conflicts) && conflicts.length) {
    b.conflicts = conflicts.map((c: any) => ({ description: c.description, resolution: c.resolution }));
  }
  return b.da || b.bestBetReasoning || b.matchContextLabel || b.conflicts ? b : null;
}

function mergeProse(analysis: any, t: ProseBundle): any {
  // Yalnızca metin alanlarını değiştiren sığ-klon birleştirme
  const out = { ...analysis };
  if (t.da && out.sources?.agents?.devilsAdvocate) {
    out.sources = {
      ...out.sources,
      agents: {
        ...out.sources.agents,
        devilsAdvocate: { ...out.sources.agents.devilsAdvocate, ...stripUndef(t.da) },
      },
    };
  }
  if (t.bestBetReasoning && out.bestBet) {
    out.bestBet = { ...out.bestBet, reasoning: t.bestBetReasoning };
  }
  if (t.matchContextLabel && out.matchContext) {
    out.matchContext = { ...out.matchContext, label: t.matchContextLabel };
  }
  if (t.conflicts && Array.isArray(out.systemPerformance?.conflicts)) {
    out.systemPerformance = {
      ...out.systemPerformance,
      conflicts: out.systemPerformance.conflicts.map((c: any, i: number) => ({
        ...c,
        ...(t.conflicts![i] ? stripUndef(t.conflicts![i]) : {}),
      })),
    };
  }
  return out;
}

function stripUndef<T extends object>(o: T): Partial<T> {
  const r: any = {};
  for (const [k, v] of Object.entries(o)) if (v !== undefined) r[k] = v;
  return r;
}

async function translateBundle(bundle: ProseBundle, target: Lang): Promise<ProseBundle | null> {
  const prompt =
    `Translate every string value in this JSON to ${LANG_NAME[target]}. ` +
    `Keep the JSON structure, keys, arrays, emojis, numbers and team names EXACTLY as they are. ` +
    `Return ONLY the translated JSON, no commentary.`;
  const resp = await Promise.race<string | null>([
    aiClient.chat([
      { role: 'system', content: prompt },
      { role: 'user', content: JSON.stringify(bundle) },
    ]),
    new Promise<null>((resolve) => setTimeout(() => resolve(null), LLM_TIMEOUT_MS)),
  ]);
  if (!resp) return null;
  const jsonStr = resp.match(/\{[\s\S]*\}/)?.[0];
  if (!jsonStr) return null;
  try {
    return JSON.parse(jsonStr) as ProseBundle;
  } catch {
    return null;
  }
}

/**
 * Cache'ten dönen analizi hedef dile uyarlar. Üretim dili (analysis.lang;
 * eski satırlarda alan yok → 'tr' varsayılır) hedefle aynıysa dokunmaz.
 * Çeviri redis'te fixture+dil başına saklanır; her hata orijinali döndürür.
 */
export async function localizeCachedAnalysis(
  analysis: any,
  targetLang: string,
  fixtureId: number,
): Promise<any> {
  try {
    const target = (['tr', 'en', 'de'].includes(targetLang) ? targetLang : 'en') as Lang;
    const genLang: Lang = analysis?.lang || 'tr';
    if (genLang === target) return analysis;

    const bundle = extractProse(analysis);
    if (!bundle) return analysis;

    const redis = getRedisClient();
    const key = `analysis-l10n:v1:${fixtureId}:${target}`;
    const cached = await redis.get<ProseBundle>(key).catch(() => null);
    if (cached) return mergeProse(analysis, cached);

    const translated = await translateBundle(bundle, target);
    if (!translated) return analysis;

    redis.set(key, translated, { ex: TTL }).catch(() => {});
    return mergeProse(analysis, translated);
  } catch (e: any) {
    console.warn('[analysis-l10n] skipped:', e?.message);
    return analysis;
  }
}
