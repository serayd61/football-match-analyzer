import type { ReactNode } from 'react';
import type { AssessmentMarket, AssessmentStatus } from '@/lib/site/assessment';
import type { EvidenceReport, MarketEvidence, GroupStats, GroupFixture, Rate, MissingItem, EvidenceFinding } from '@/lib/site/evidence-rule';
import { Link } from '@/i18n/navigation';
import { AssessmentChip } from './Assessment';

// ============================================================================
// "Geçmiş kanıt analizi" — evidence-1.0 raporunun bölümü. Sunucu bileşeni; metinler
// sayfadan çevrilmiş gelir (Assessment/MatchStanding deseni). Sayılar yalnız rapordan;
// burada hesap yok. Durum çipi assess-1.0'ın aynısı (AssessmentChip) — bu bölüm durumu
// değiştirmez. Üç gerçekleşme hücresi (benzer / ev sahibi iç saha / deplasman dış saha)
// ayrı durur: örtüşen gruplar toplanmaz.
// ============================================================================

export interface EvidenceLabels {
  title: string;
  meta: string;
  lead: string;
  market: Record<AssessmentMarket, string>;
  selection: (m: MarketEvidence) => string;
  status: Record<AssessmentStatus, string>;
  noStatus: string;
  cols: { model: string; market: string; similar: string; home: string; away: string };
  modelSub: (m: MarketEvidence) => string;
  marketSub: (m: MarketEvidence) => string;
  /** "won/n · %lower–%upper" */
  rateSub: (r: Rate) => string;
  rateNone: string;
  finding: (code: EvidenceFinding, m: MarketEvidence) => string;
  groupsTitle: string;
  groupLine: (g: GroupStats) => string;
  groupModelLine: (g: GroupStats) => string;
  homeGroup: string;
  awayGroup: string;
  similarTitle: string;
  similarMeta: (r: EvidenceReport) => string;
  similarEmpty: string;
  similarRowMeta: (f: GroupFixture) => string;
  kickoff: (iso: string) => string;
  overlap: (home: number, away: number) => string | null;
  missingTitle: string;
  missing: (item: MissingItem) => string;
  featuresAfterAsOf: string | null;
  footer: ReactNode;
}

const pct = (p: number | null | undefined) => (p == null || Number.isNaN(p) ? '–' : `${Math.round(p * 100)}%`);
const toneOf = (m: MarketEvidence, r: Rate | null) => (!r ? 'text-s-muted' : r.upper < m.modelP ? 'text-s-loss' : r.lower > m.modelP ? 'text-s-win' : '');

function RateCell({ label, rate, m, labels }: { label: string; rate: Rate | null; m: MarketEvidence; labels: EvidenceLabels }) {
  return (
    <div className="rounded-lg bg-s-raised/60 px-2.5 py-2">
      <dt className="text-[11px] font-semibold uppercase tracking-wide text-s-muted">{label}</dt>
      <dd className={`num text-[20px] font-bold leading-none ${toneOf(m, rate)}`}>{rate ? pct(rate.p) : '–'}</dd>
      <dd className="num mt-1 text-[11px] leading-tight text-s-muted">{rate ? labels.rateSub(rate) : labels.rateNone}</dd>
    </div>
  );
}

export default function EvidenceSection({ report, labels, showFixtures = 8 }: { report: EvidenceReport; labels: EvidenceLabels; showFixtures?: number }) {
  const { groups } = report;
  const sim = groups.similar;
  const overlap = labels.overlap(report.overlap.homeSimilar, report.overlap.awaySimilar);
  return (
    <section className="card !gap-5 !p-5 sm:!p-6" aria-labelledby="evidence-title" data-testid="evidence-section">
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-1">
        <div>
          <p id="evidence-title" className="kicker">{labels.title}</p>
          <p className="mt-1 max-w-[72ch] text-[13px] leading-snug text-s-muted">{labels.lead}</p>
        </div>
        <span className="num text-[12px] text-s-muted">{labels.meta}</span>
      </div>

      {labels.featuresAfterAsOf && report.features.afterAsOf && (
        <p className="rounded-lg border border-s-line px-3 py-2 text-[12.5px] text-s-muted">{labels.featuresAfterAsOf}</p>
      )}

      <ul className="divide-y divide-s-line">
        {report.markets.map((m) => (
          <li key={m.market} className="flex flex-col gap-3 py-4 first:pt-0 last:pb-0">
            <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1.5">
              <div className="min-w-0">
                <span className="text-[12px] font-semibold uppercase tracking-wide text-s-muted">{labels.market[m.market]}</span>
                <span className="mx-1.5 text-s-muted" aria-hidden>·</span>
                <span className="text-[16px] font-bold">{labels.selection(m)}</span>
              </div>
              {m.status ? <AssessmentChip status={m.status} label={labels.status[m.status]} /> : <span className="tag tag-outline">{labels.noStatus}</span>}
            </div>
            <dl className="grid grid-cols-2 gap-2 sm:grid-cols-5">
              <div className="rounded-lg bg-s-raised/60 px-2.5 py-2">
                <dt className="text-[11px] font-semibold uppercase tracking-wide text-s-muted">{labels.cols.model}</dt>
                <dd className="num text-[20px] font-bold leading-none">{pct(m.modelP)}</dd>
                <dd className="num mt-1 text-[11px] leading-tight text-s-muted">{labels.modelSub(m)}</dd>
              </div>
              <div className="rounded-lg bg-s-raised/60 px-2.5 py-2">
                <dt className="text-[11px] font-semibold uppercase tracking-wide text-s-muted">{labels.cols.market}</dt>
                <dd className="num text-[20px] font-bold leading-none">{pct(m.marketP)}</dd>
                <dd className="num mt-1 text-[11px] leading-tight text-s-muted">{labels.marketSub(m)}</dd>
              </div>
              <RateCell label={labels.cols.similar} rate={m.rates.similar} m={m} labels={labels} />
              <RateCell label={labels.cols.home} rate={m.rates.homeAtHome} m={m} labels={labels} />
              <RateCell label={labels.cols.away} rate={m.rates.awayAtAway} m={m} labels={labels} />
            </dl>
            <ul className="space-y-1 text-[13px] leading-snug">
              {m.findings.map((code) => (
                <li key={code} className="flex gap-2">
                  <span className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full bg-s-muted" aria-hidden />
                  <span>{labels.finding(code, m)}</span>
                </li>
              ))}
            </ul>
          </li>
        ))}
      </ul>

      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <p className="text-[12px] font-semibold uppercase tracking-wide text-s-muted">{labels.groupsTitle}</p>
          <dl className="mt-2 space-y-2 text-[13px] leading-snug">
            {[{ k: labels.homeGroup, g: groups.homeAtHome }, { k: labels.awayGroup, g: groups.awayAtAway }].map(({ k, g }) => (
              <div key={k}>
                <dt className="font-semibold">{k}</dt>
                <dd className="num text-s-muted">{g ? labels.groupLine(g) : labels.rateNone}</dd>
                {g && <dd className="num text-[12px] text-s-muted">{labels.groupModelLine(g)}</dd>}
              </div>
            ))}
          </dl>
          {overlap && <p className="mt-2 text-[12px] leading-snug text-s-muted">{overlap}</p>}
        </div>
        <div>
          <p className="text-[12px] font-semibold uppercase tracking-wide text-s-muted">{labels.similarTitle}</p>
          <p className="num mt-1 text-[12px] text-s-muted">{labels.similarMeta(report)}</p>
          {sim && sim.n > 0 ? (
            <>
              <p className="num mt-2 text-[13px] leading-snug text-s-muted">{labels.groupLine(sim)}</p>
              <p className="num text-[12px] text-s-muted">{labels.groupModelLine(sim)}</p>
              <ol className="mt-2 divide-y divide-s-line text-[13px]">
                {sim.fixtures.slice(0, showFixtures).map((f) => (
                  <li key={f.fixtureId} className="flex items-baseline justify-between gap-3 py-1.5">
                    <span className="min-w-0 truncate">
                      <span className="num text-[12px] text-s-muted">{labels.kickoff(f.kickoff)}</span>{' '}
                      <Link href={`/predictions/${f.fixtureId}`} className="underline decoration-s-line underline-offset-2 hover:decoration-s-ink">{f.homeName} – {f.awayName}</Link>
                    </span>
                    <span className="num shrink-0 text-[12px] text-s-muted">
                      <strong className="text-s-ink">{f.homeScore}–{f.awayScore}</strong> · {labels.similarRowMeta(f)}
                    </span>
                  </li>
                ))}
              </ol>
            </>
          ) : (
            <p className="mt-2 text-[13px] text-s-muted">{labels.similarEmpty}</p>
          )}
        </div>
      </div>

      {report.missing.length > 0 && (
        <div>
          <p className="text-[12px] font-semibold uppercase tracking-wide text-s-muted">{labels.missingTitle}</p>
          <ul className="mt-2 space-y-1 text-[13px] leading-snug text-s-muted">
            {report.missing.map((item) => (
              <li key={`${item.key}:${item.reason}`} className="flex gap-2">
                <span className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full bg-s-line" aria-hidden />
                <span>{labels.missing(item)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="text-[12px] leading-snug text-s-muted">{labels.footer}</div>
    </section>
  );
}
