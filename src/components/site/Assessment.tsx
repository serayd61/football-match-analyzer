import type { ReactNode } from 'react';
import type { MarketAssessment, MatchAssessment, AssessmentStatus, AssessmentMarket } from '@/lib/site/assessment';
import { fmtPts, type IntelView, type IntelFactor, type IntelCategory } from '@/lib/site/intel-view';

// ============================================================================
// "Bu maç için değerlendirme" — ortak değerlendirme çıktısının kartı ve çipi.
// Sunucu bileşenleri; metinler sayfadan çevrilmiş gelir (MatchStanding deseni).
// Durum rengi yalnız durumdan: supported = win, conflicting = loss, insufficient = outline.
// Pazarlar ayrı satırlar; hiçbir pazar diğerini gizlemez. Model / piyasa / kayıt üç
// ayrı hücre: üçü aynı şeyi ölçmez, yan yana ama ayrı durur.
// İstihbarat satırı (2026-10-16, engine_intel): Claude'un web aramasıyla bulduğu İSİMLİ
// faktörler ve kodda kırpılmış sapma. Durumu DEĞİŞTİRMEZ; pazar satırlarının altında ayrı
// blok. LLM serbest metni yok: faktör başlığı, kategori, taraf, sapma, kaynak, tarih.
// ============================================================================

export const STATUS_TAG: Record<AssessmentStatus, string> = { supported: 'tag-win', conflicting: 'tag-loss', insufficient: 'tag-outline' };

export function AssessmentChip({ status, label, className = '' }: { status: AssessmentStatus; label: string; className?: string }) {
  return <span className={`tag ${STATUS_TAG[status]} ${className}`}>{label}</span>;
}

export interface AssessmentLabels {
  title: string;
  lead: string;
  status: Record<AssessmentStatus, string>;
  market: Record<AssessmentMarket, string>;
  selection: (m: MarketAssessment) => string;
  /** birincil gerekçe cümlesi (reasons[0]) */
  reason: (m: MarketAssessment) => string;
  /** bilgi notları (eksik oran / bayat oran / kalibrasyon yok) — birincil değilse */
  notes: (m: MarketAssessment) => string[];
  model: string;
  calibrated: (p: number) => string;
  rawOnly: string;
  marketCol: string;
  marketSub: (m: MarketAssessment) => string | null;
  noMarket: string;
  recordCol: string;
  recordSub: (m: MarketAssessment) => string | null;
  noRecord: string;
  thinRecord: (n: number) => string;
  footer: ReactNode;
}

export interface IntelLabels {
  title: string;
  /** rozet: "Claude ile kontrol edildi" */
  badge: string;
  /** analiz zamanı, biçimlenmiş */
  checkedAt: string;
  lead: string;
  noFactors: string;
  /** "Model %40 / %26 / %34 → istihbarat sonrası %42 / %26 / %32" */
  probLine: string;
  goalsLine: string | null;
  team: Record<'home' | 'away' | 'both', string>;
  category: Record<IntelCategory, string>;
  /** faktörün 1X2 kaydırması: "Everton +2 · X 0 · Chelsea −2 puan" */
  shift: (f: IntelFactor) => string;
  source: string;
  asOf: (iso: string) => string;
  note: string;
}

export function IntelBlock({ intel, labels }: { intel: IntelView; labels: IntelLabels }) {
  return (
    <div className="rounded-lg border border-s-line px-3.5 py-3 sm:px-4" data-testid="intel-block">
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1.5">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[12px] font-semibold uppercase tracking-wide text-s-muted">{labels.title}</span>
          <span className="tag tag-outline">{labels.badge}</span>
        </div>
        <span className="num text-[11px] text-s-muted">{labels.checkedAt}</span>
      </div>
      <p className="mt-1.5 text-[12.5px] leading-snug text-s-muted">{labels.lead}</p>
      {intel.factors.length === 0 ? (
        <p className="mt-2.5 text-[13px] leading-snug">{labels.noFactors}</p>
      ) : (
        <ul className="mt-2.5 space-y-2.5">
          {intel.factors.map((f, i) => (
            <li key={i} className="text-[13px] leading-snug">
              <p className="font-semibold">{f.factor}</p>
              <p className="num mt-0.5 text-[12px] text-s-muted">
                <span>{labels.category[f.category]}</span>
                <span className="mx-1.5" aria-hidden>·</span>
                <span>{labels.team[f.team]}</span>
                <span className="mx-1.5" aria-hidden>·</span>
                <span>{labels.shift(f)}</span>
                {(f.sourceLabel || f.asOf) && <span className="mx-1.5" aria-hidden>·</span>}
                {f.sourceLabel && (
                  <>
                    {labels.source}{' '}
                    {f.sourceUrl ? <a href={f.sourceUrl} target="_blank" rel="noopener noreferrer nofollow" className="underline">{f.sourceLabel}</a> : <span>{f.sourceLabel}</span>}
                  </>
                )}
                {f.asOf && <>{f.sourceLabel ? ', ' : ''}{labels.asOf(f.asOf)}</>}
              </p>
            </li>
          ))}
        </ul>
      )}
      {intel.factors.length > 0 && (
        <p className="num mt-2.5 text-[13px] font-semibold">{labels.probLine}{labels.goalsLine ? <span className="ml-2 font-normal text-s-muted">{labels.goalsLine}</span> : null}</p>
      )}
      <p className="mt-2 text-[12px] leading-snug text-s-muted">{labels.note}</p>
    </div>
  );
}

const pct = (p: number | null | undefined) => (p == null ? '–' : `${Math.round(p * 100)}%`);

export default function AssessmentCard({ assessment, labels, aside, intel, intelLabels }: { assessment: MatchAssessment; labels: AssessmentLabels; aside?: ReactNode; intel?: IntelView | null; intelLabels?: IntelLabels }) {
  return (
    <section className="card !gap-4 !p-5 sm:!p-6" aria-labelledby="assessment-title">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p id="assessment-title" className="kicker">{labels.title}</p>
          <p className="mt-1 text-[13px] leading-snug text-s-muted">{labels.lead}</p>
        </div>
        {aside}
      </div>
      <ul className="divide-y divide-s-line">
        {assessment.markets.map((m) => {
          const rec = m.record;
          const thin = rec != null && rec.n > 0 && rec.acc != null && m.reasons.includes('record_thin');
          const notes = labels.notes(m);
          return (
            <li key={m.market} className="flex flex-col gap-3 py-4 first:pt-0 last:pb-0">
              <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1.5">
                <div className="min-w-0">
                  <span className="text-[12px] font-semibold uppercase tracking-wide text-s-muted">{labels.market[m.market]}</span>
                  <span className="mx-1.5 text-s-muted" aria-hidden>·</span>
                  <span className="text-[16px] font-bold">{labels.selection(m)}</span>
                </div>
                <AssessmentChip status={m.status} label={labels.status[m.status]} />
              </div>
              <dl className="grid grid-cols-3 gap-2">
                <div className="rounded-lg bg-s-raised/60 px-2.5 py-2">
                  <dt className="text-[11px] font-semibold uppercase tracking-wide text-s-muted">{labels.model}</dt>
                  <dd className="num text-[20px] font-bold leading-none">{pct(m.model.p)}</dd>
                  <dd className="num mt-1 text-[11px] leading-tight text-s-muted">{m.calibration.available && m.calibration.p != null ? labels.calibrated(m.calibration.p) : labels.rawOnly}</dd>
                </div>
                <div className="rounded-lg bg-s-raised/60 px-2.5 py-2">
                  <dt className="text-[11px] font-semibold uppercase tracking-wide text-s-muted">{labels.marketCol}</dt>
                  <dd className="num text-[20px] font-bold leading-none">{pct(m.price.p)}</dd>
                  <dd className="num mt-1 text-[11px] leading-tight text-s-muted">{m.price.p == null ? labels.noMarket : labels.marketSub(m)}</dd>
                </div>
                <div className="rounded-lg bg-s-raised/60 px-2.5 py-2">
                  <dt className="text-[11px] font-semibold uppercase tracking-wide text-s-muted">{labels.recordCol}</dt>
                  <dd className={`num text-[20px] font-bold leading-none ${rec && !thin && rec.acc != null ? (m.status === 'supported' ? 'text-s-win' : m.status === 'conflicting' ? 'text-s-loss' : '') : 'text-s-muted'}`}>
                    {rec && rec.n > 0 && !thin ? pct(rec.acc) : '–'}
                  </dd>
                  <dd className="num mt-1 text-[11px] leading-tight text-s-muted">{!rec ? labels.noRecord : thin ? labels.thinRecord(rec.n) : labels.recordSub(m)}</dd>
                </div>
              </dl>
              <p className="text-[13px] leading-snug">{labels.reason(m)}</p>
              {notes.length > 0 && <p className="text-[12px] leading-snug text-s-muted">{notes.join(' ')}</p>}
            </li>
          );
        })}
      </ul>
      {intel && intelLabels && <IntelBlock intel={intel} labels={intelLabels} />}
      <div className="text-[12px] leading-snug text-s-muted">{labels.footer}</div>
    </section>
  );
}
