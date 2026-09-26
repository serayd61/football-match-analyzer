import Image from 'next/image';
import { getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import type { SitePrediction } from '@/lib/site/predictions';
import { riskOf } from '@/lib/site/risk';
import type { OutsideRisk } from './PredictionCard';
import { RiskLabel } from './Risk';
import LocalTime from './LocalTime';
import { StatusChip } from './PredictionTable';

// Match row v3 — one fixture per line inside a league group:
//   time | crests + names (+ score) | 1·X·2 mini bar (pick bold) | confidence + risk
// The whole row links to the match page when the model has rated it.

const STATUS_KEY = {
  scheduled: 'statusScheduled', live: 'statusLive', finished: 'statusFinished',
  postponed: 'statusPostponed', cancelled: 'statusCancelled', unknown: 'statusUnknown',
} as const;

function Crest({ src }: { src: string | null }) {
  return src
    ? <Image src={src} alt="" width={20} height={20} className="h-5 w-5 shrink-0 object-contain" unoptimized />
    : <span className="h-5 w-5 shrink-0 rounded-full bg-s-raised" aria-hidden />;
}

export default async function MatchRow({ p, outside = null, back = null, spot = null }: { p: SitePrediction; outside?: OutsideRisk | null; back?: string | null; spot?: { label: string; p: number } | null }) {
  const t = await getTranslations('v2.predictions');
  const tc = await getTranslations('common');
  const conf = p.confidence ?? p.confidenceRaw;
  const confPct = conf == null ? null : Math.round(conf * 100);
  const live = p.status === 'live';
  const done = p.status === 'finished';
  const score = p.homeScore != null && p.awayScore != null && (live || done);
  const pct = (x: number) => Math.round(x * 100);
  const risk = p.hasModel ? (outside ? outside.risk : riskOf(conf)) : null;
  const pickWon = done && p.outcome === 'won';
  const pickLost = done && p.outcome === 'lost';

  const body = (
    <>
      {/* time / status */}
      <div className="flex flex-col items-start gap-1 text-[13px] leading-none">
        {live ? <StatusChip status="live" label={tc(STATUS_KEY.live)} /> : done ? <span className="tag tag-outline">{tc(STATUS_KEY.finished)}</span> : <LocalTime iso={p.kickoff} format="time" className="font-semibold" />}
        {(p.status === 'postponed' || p.status === 'cancelled') && <StatusChip status={p.status} label={tc(STATUS_KEY[p.status])} />}
      </div>

      {/* teams */}
      <div className="min-w-0">
        <div className="flex items-center gap-2 text-[14.5px] leading-tight">
          <Crest src={p.homeCrest} />
          <span className={`min-w-0 truncate ${p.pick === '1' ? 'font-bold' : 'font-medium'}`}>{p.homeName}</span>
          {score && <span className="num ml-auto pl-2 text-[14px] font-bold">{p.homeScore}</span>}
        </div>
        <div className="mt-1.5 flex items-center gap-2 text-[14.5px] leading-tight">
          <Crest src={p.awayCrest} />
          <span className={`min-w-0 truncate ${p.pick === '2' ? 'font-bold' : 'font-medium'}`}>{p.awayName}</span>
          {score && <span className="num ml-auto pl-2 text-[14px] font-bold">{p.awayScore}</span>}
        </div>
        {outside?.note && <p className="mt-1.5 truncate text-[11.5px] text-s-muted">{outside.note}</p>}
      </div>

      {/* probabilities */}
      <div className="mrow-prob">
        {p.hasModel ? (
          <>
            <div className="flex h-[6px] w-full gap-[2px] overflow-hidden rounded-full" aria-hidden>
              <span className="bg-s-accent" style={{ width: `${pct(p.pHome)}%` }} />
              <span className="bg-s-n400" style={{ width: `${pct(p.pDraw)}%` }} />
              <span className="bg-s-away" style={{ width: `${pct(p.pAway)}%` }} />
            </div>
            <div className="num mt-1.5 flex justify-between text-[11.5px] leading-none text-s-muted" aria-label={`${tc('home')} ${pct(p.pHome)}%, ${tc('draw')} ${pct(p.pDraw)}%, ${tc('away')} ${pct(p.pAway)}%`}>
              <span className={p.pick === '1' ? 'font-bold text-s-accent-700' : ''}>1 {pct(p.pHome)}</span>
              <span className={p.pick === 'X' ? 'font-bold text-s-ink' : ''}>X {pct(p.pDraw)}</span>
              <span className={p.pick === '2' ? 'font-bold text-s-away' : ''}>2 {pct(p.pAway)}</span>
            </div>
          </>
        ) : <span className="text-[12px] text-s-muted">{t('pendingModel')}</span>}
      </div>

      {/* confidence + risk */}
      <div className="flex flex-col items-end gap-1.5">
        {spot ? <span className="tag tag-accent num">{spot.label} {Math.round(spot.p * 100)}%</span> : null}
        {p.hasModel ? (
          <>
            <span className={`num text-[17px] font-bold leading-none ${pickWon ? 'text-s-win' : pickLost ? 'text-s-loss' : ''}`}>{confPct != null ? `${confPct}%` : '–'}</span>
            {done && p.outcome !== 'pending' ? <span className={`tag ${pickWon ? 'tag-win' : pickLost ? 'tag-loss' : 'tag-outline'}`}>{tc(p.outcome)}</span> : risk && <RiskLabel risk={risk} short />}
          </>
        ) : <span className="text-[11.5px] font-semibold text-s-muted">–</span>}
      </div>
    </>
  );

  return p.hasModel
    ? <Link href={`/predictions/${p.fixtureId}${back ? `?back=${encodeURIComponent(back)}` : ''}`} className="mrow">{body}</Link>
    : <div className="mrow">{body}</div>;
}
