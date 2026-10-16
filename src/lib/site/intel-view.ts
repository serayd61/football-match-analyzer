// ============================================================================
// İSTİHBARAT KATMANI — görünüm modeli (saf, testli; 'server-only' yok)
// ----------------------------------------------------------------------------
// Kaynak: engine_intel (engine/intel_agent.py, 2026-10-16). Motorun çıpa olasılığı
// üzerine Claude'un web aramasıyla bulduğu İSİMLİ faktörlerin (sakat/ceza/rotasyon)
// kodda kırpılmış sapmaları. Bu katman assess-1.0 durumunu DEĞİŞTİRMEZ: kartta
// ayrı bir satır olarak gösterilir; katkısı engine_intel.settle karnesinde ölçülür
// (baseline vs final Brier). LLM serbest metni (reason/narrative) burada taşınmaz;
// yalnız faktör başlığı, kategori, taraf, sapma, kaynak ve tarih.
// ============================================================================
import { z } from 'zod';

const num = z.coerce.number();
const tri = z.object({ home: num, draw: num, away: num });

export const IntelRowSchema = z.object({
  fixture_id: num,
  agent_version: z.string(),
  model_version: z.string(),
  llm_model: z.string().nullable().optional(),
  analyzed_at: z.string(),
  issued_after_kickoff: z.boolean().nullable().optional(),
  baseline: tri.extend({ over25: num.nullable().optional(), btts: num.nullable().optional() }),
  final: tri,
  goals: z.object({ over25: num.nullable().optional(), btts: num.nullable().optional(), adjusted: z.boolean().optional() }).nullable().optional(),
  deviations: z.array(z.object({
    factor: z.string(),
    category: z.string().nullable().optional(),
    team: z.enum(['home', 'away', 'both']).nullable().optional(),
    severity: z.string().nullable().optional(),
    shift: tri,
    source: z.string().nullable().optional(),
    asOf: z.string().nullable().optional(),
  })).nullable().optional(),
  confidence: z.enum(['low', 'medium', 'high']).nullable().optional(),
  data_completeness: num.nullable().optional(),
  warnings: z.array(z.string()).nullable().optional(),
});
export type IntelRow = z.infer<typeof IntelRowSchema>;

export type IntelCategory = 'key_absence' | 'multiple_absences' | 'rotation' | 'tactical_mismatch' | 'travel_congestion' | 'weather_pitch' | 'motivation' | 'other';
export const INTEL_CATEGORIES: IntelCategory[] = ['key_absence', 'multiple_absences', 'rotation', 'tactical_mismatch', 'travel_congestion', 'weather_pitch', 'motivation', 'other'];

export interface IntelFactor {
  factor: string;
  category: IntelCategory;
  team: 'home' | 'away' | 'both';
  /** yüzde puanı, tam sayı (örn. +2 / 0 / −2) */
  shiftPts: { home: number; draw: number; away: number };
  /** kaynak metnindeki ilk http(s) adresi; yoksa null */
  sourceUrl: string | null;
  /** kaynak kısa adı: URL varsa alan adı, yoksa metnin kendisi (kısaltılmış) */
  sourceLabel: string | null;
  asOf: string | null;
}

export interface IntelView {
  fixtureId: number;
  agentVersion: string;
  modelVersion: string;
  /** 'claude' | diğer — rozet metni için sağlayıcı */
  provider: 'claude' | 'other';
  llmModel: string | null;
  analyzedAt: string;
  baseline: { home: number; draw: number; away: number };
  final: { home: number; draw: number; away: number };
  /** final − baseline, yüzde puanı tam sayı */
  deltaPts: { home: number; draw: number; away: number };
  /** herhangi bir 1X2 bileşeni ≥1 puan oynadı mı */
  changed: boolean;
  goals: { over25: { from: number; to: number } | null; btts: { from: number; to: number } | null; adjusted: boolean };
  factors: IntelFactor[];
  confidence: 'low' | 'medium' | 'high' | null;
  dataCompleteness: number | null;
  /** kural kırpması oldu mu (model sınır aştı, kod düzeltti) */
  clipped: boolean;
}

const pts = (x: number) => Math.round(x * 100);

const URL_RE = /https?:\/\/[^\s;,)]+/i;

/** Kaynak metninden ilk URL ve kısa etiket. */
export function sourceOf(src: string | null | undefined): { url: string | null; label: string | null } {
  const s = (src || '').trim();
  if (!s) return { url: null, label: null };
  const m = s.match(URL_RE);
  if (!m) return { url: null, label: s.length > 60 ? `${s.slice(0, 57)}…` : s };
  let host: string | null = null;
  try { host = new URL(m[0]).hostname.replace(/^www\./, ''); } catch { host = null; }
  return { url: m[0], label: host ?? m[0] };
}

const asCategory = (c: string | null | undefined): IntelCategory => (INTEL_CATEGORIES.includes(c as IntelCategory) ? (c as IntelCategory) : 'other');

/** Ham satır → görünüm. Geçersiz satır → null (sayfa katmanı sessizce gizler). */
export function toIntelView(raw: unknown): IntelView | null {
  const r = IntelRowSchema.safeParse(raw);
  if (!r.success) return null;
  const d = r.data;
  if (d.issued_after_kickoff) return null; // karneye girmeyen analiz gösterilmez
  const delta = { home: pts(d.final.home - d.baseline.home), draw: pts(d.final.draw - d.baseline.draw), away: pts(d.final.away - d.baseline.away) };
  const g = d.goals ?? null;
  const over = g?.over25 != null && d.baseline.over25 != null ? { from: d.baseline.over25, to: g.over25 } : null;
  const btts = g?.btts != null && d.baseline.btts != null ? { from: d.baseline.btts, to: g.btts } : null;
  const factors: IntelFactor[] = (d.deviations ?? []).filter((x) => x.factor.trim()).map((x) => {
    const s = sourceOf(x.source);
    return {
      factor: x.factor.trim(),
      category: asCategory(x.category),
      team: x.team ?? 'both',
      shiftPts: { home: pts(x.shift.home), draw: pts(x.shift.draw), away: pts(x.shift.away) },
      sourceUrl: s.url, sourceLabel: s.label,
      asOf: x.asOf || null,
    };
  });
  return {
    fixtureId: d.fixture_id,
    agentVersion: d.agent_version,
    modelVersion: d.model_version,
    provider: (d.llm_model || '').startsWith('claude') ? 'claude' : 'other',
    llmModel: d.llm_model ?? null,
    analyzedAt: d.analyzed_at,
    baseline: { home: d.baseline.home, draw: d.baseline.draw, away: d.baseline.away },
    final: { home: d.final.home, draw: d.final.draw, away: d.final.away },
    deltaPts: delta,
    changed: Math.abs(delta.home) >= 1 || Math.abs(delta.draw) >= 1 || Math.abs(delta.away) >= 1,
    goals: { over25: over, btts, adjusted: !!g?.adjusted },
    factors,
    confidence: d.confidence ?? null,
    dataCompleteness: d.data_completeness ?? null,
    clipped: (d.warnings ?? []).length > 0,
  };
}

/**
 * Aynı maç için birden çok analiz (model karşılaştırması: intel-1.0 / intel-1.0-haiku)
 * olabilir; kartta EN SON analiz gösterilir. Kickoff sonrası üretilenler elenir.
 */
export function pickLatestIntel(rows: unknown[]): IntelView | null {
  let best: IntelView | null = null;
  for (const raw of rows) {
    const v = toIntelView(raw);
    if (!v) continue;
    if (!best || Date.parse(v.analyzedAt) > Date.parse(best.analyzedAt)) best = v;
  }
  return best;
}

/** "+2" / "0" / "−3" biçimi (tipografik eksi). */
export const fmtPts = (v: number): string => (v === 0 ? '0' : `${v > 0 ? '+' : '−'}${Math.abs(v)}`);
