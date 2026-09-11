import { getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import type { SitePrediction } from '@/lib/site/predictions';
import { riskOf } from '@/lib/site/risk';
import ProbBar from './ProbBar';
import ConfidenceRing from './ConfidenceRing';
import { RiskLabel } from './Risk';
import LocalTime from './LocalTime';
import { LockedPick } from './Paywall';
import { StatusChip } from './PredictionTable';

// Prediction card (design 2026-09-11): surface fill, 2px ink top rule, 16px
// padding. Kicker "League · time" + RiskLabel; title "Home / vs Away" 22px
// beside a 68px ring; 10px ProbBar; bottom row (1px top rule) with the pick
// and "@fair · value". Whole card links to the match page. `locked` blurs the
// pick and shows the Pro CTA (kept for the `unlockAll` preview flag).

const STATUS_KEY = {
  scheduled: 'statusScheduled', live: 'statusLive', finished: 'statusFinished',
  postponed: 'statusPostponed', cancelled: 'statusCancelled', unknown: 'statusUnknown',
} as const;

const fair = (p: number) => (p > 0 ? (1 / p).toFixed(2) : '–');

export default async function PredictionCard({ p, locked = false, market }: { p: SitePrediction; locked?: boolean; market?: { pick: number | null } | null }) {
  const t = await getTranslations('v2.predictions');
  const th = await getTranslations('v2.home');
  const tc = await getTranslations('common');
  const conf = p.confidence ?? p.confidenceRaw;
  const pickP = p.pick === '1' ? p.pHome : p.pick === '2' ? p.pAway : p.pick === 'X' ? p.pDraw : 0;
  const pickName = p.pick === '1' ? th('pickWin', { team: p.homeName }) : p.pick === '2' ? th('pickWin', { team: p.awayName }) : th('pickDraw');
  // Value = model probability minus the market's implied probability of the same pick, in points.
  const value = market?.pick != null ? Math.round((pickP - market.pick) * 100) : null;
  const showState = p.status !== 'scheduled' && p.status !== 'unknown';
  const score = p.homeScore != null && p.awayScore != null && (p.status === 'live' || p.status === 'finished');

  const body = (
    <>
      <div className="flex items-center justify-between gap-2">
        <span className="kicker flex items-center gap-2">
          <span className="truncate">{p.leagueName} · <LocalTime iso={p.kickoff} format="time" /></span>
          {showState && <StatusChip status={p.status} label={tc(STATUS_KEY[p.status])} />}
        </span>
        {p.hasModel ? <RiskLabel risk={riskOf(conf)} /> : <span className="text-[11px] font-semibold text-s-muted">{t('pendingModel')}</span>}
      </div>
      <div className="flex items-center justify-between gap-3">
        <h3 className="min-w-0 text-[22px] leading-[1.05]">
          <span className="block truncate">{p.homeName}{score && <span className="num ml-2 text-s-muted">{p.homeScore}</span>}</span>
          <span className="block truncate"><span className="text-s-muted">{th('vs')}</span> {p.awayName}{score && <span className="num ml-2 text-s-muted">{p.awayScore}</span>}</span>
        </h3>
        {p.hasModel && <ConfidenceRing conf={conf} size={68} inner="surface" />}
      </div>
      {p.hasModel ? (
        <ProbBar home={p.pHome} draw={p.pDraw} away={p.pAway} highlight={p.pick} labels={{ home: tc('home'), draw: tc('draw'), away: tc('away') }} size="sm" />
      ) : (
        <p className="text-[13px] text-s-muted">{t('pendingModel')}</p>
      )}
      {p.hasModel && (
        <div className="rule-t-1 flex items-center justify-between gap-2 pt-2">
          {locked ? (
            <LockedPick />
          ) : (
            <>
              <span className="truncate text-[13px] font-semibold">{pickName}</span>
              <span className="num shrink-0 text-[12px] text-s-muted">@{fair(pickP)}{value != null && <> · {t('value', { value: `${value >= 0 ? '+' : '−'}${Math.abs(value)}%` })}</>}</span>
            </>
          )}
        </div>
      )}
    </>
  );

  return p.hasModel && !locked ? (
    <Link href={`/predictions/${p.fixtureId}`} className="card card-top">{body}</Link>
  ) : (
    <div className="card card-top">{body}</div>
  );
}
