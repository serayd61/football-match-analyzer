// Gerçek örnek analiz kartı (2026-10-13): ana sayfada ziyaretçiye, geçmişte
// yayımlanmış ve sonuçlanmış bir maçın analizi — üyenin gördüğü sayıların
// aynısı, üstünde skor ve "Kazandı" rozeti. Kartın tamamı herkese açık
// maç sayfasına bağlanır (lib/site/sample-analysis.ts havuzu).
import Image from 'next/image';
import { getFormatter, getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import type { SitePrediction } from '@/lib/site/predictions';
import { yesSideP } from '@/lib/site/goal-blend';
import { riskOf } from '@/lib/site/risk';
import ProbBar from './ProbBar';
import ConfidenceRing from './ConfidenceRing';
import OutcomeBadge from './OutcomeBadge';
import { RiskLabel } from './Risk';

export const sampleHref = (p: SitePrediction) => `/predictions/${p.fixtureId}`;

export default async function SampleAnalysis({ p, id }: { p: SitePrediction; id?: string }) {
  const t = await getTranslations('v2.landing');
  const tl = await getTranslations('v3.landing');
  const th = await getTranslations('v2.home');
  const tc = await getTranslations('common');
  const f = await getFormatter();
  const conf = p.confidence ?? p.confidenceRaw;
  const pct = (x: number | null) => (x == null ? '–' : `${Math.round(x * 100)}%`);
  const pickName = p.pick === '1' ? th('pickWin', { team: p.homeName }) : p.pick === '2' ? th('pickWin', { team: p.awayName }) : th('pickDraw');
  const over = yesSideP(p.overUnder, 'over');
  const btts = yesSideP(p.btts, 'yes');
  const team = (name: string, crest: string | null, score: number | null, bold: boolean) => (
    <p className={`flex items-center gap-2.5 text-[22px] leading-[1.1] sm:text-[26px] ${bold ? 'font-extrabold' : 'font-extrabold text-s-muted'}`}>
      {crest ? <Image src={crest} alt={tc('crestAlt', { team: name })} width={28} height={28} className="h-7 w-7 shrink-0 object-contain" unoptimized /> : null}
      <span className="min-w-0 truncate">{name}</span>
      {score != null && <span className="num ml-auto pl-3 text-s-ink">{score}</span>}
    </p>
  );

  return (
    <Link href={sampleHref(p)} id={id} className="card !gap-5 scroll-mt-24 transition-colors hover:border-s-n400" aria-label={tl('sampleTag')} data-cta="hero-sample">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="tag tag-outline">{tl('sampleTag')}</span>
        <span className="text-[13px] text-s-muted">{p.leagueName} · <span className="num">{f.dateTime(new Date(p.kickoff), { day: 'numeric', month: 'short' })}</span></span>
      </div>

      <div className="flex items-center justify-between gap-4">
        <div className="min-w-0 flex-1 space-y-1.5">
          {team(p.homeName, p.homeCrest, p.homeScore, p.pick === '1')}
          {team(p.awayName, p.awayCrest, p.awayScore, p.pick === '2')}
        </div>
        <ConfidenceRing conf={conf} size={96} label={t('demoConf')} inner="surface" />
      </div>

      <div>
        <p className="kicker mb-2">{t('demoProb')}</p>
        <ProbBar home={p.pHome} draw={p.pDraw} away={p.pAway} highlight={p.pick} size="lg" labels={{ home: tc('home'), draw: tc('draw'), away: tc('away') }} />
      </div>

      <dl className="grid grid-cols-2 gap-x-4 gap-y-3 border-t border-s-line pt-4 text-[14px] sm:grid-cols-4">
        <div><dt className="text-[12px] text-s-muted">{t('demoPick')}</dt><dd className="flex flex-wrap items-center gap-2 font-semibold">{pickName} <OutcomeBadge outcome={p.outcome} /></dd></div>
        <div><dt className="text-[12px] text-s-muted">{t('demoRisk')}</dt><dd><RiskLabel risk={riskOf(conf)} className="!text-[14px]" /></dd></div>
        <div><dt className="text-[12px] text-s-muted">{t('demoXg')}</dt><dd className="num font-semibold">{p.lambdaHome != null && p.lambdaAway != null ? `${p.lambdaHome.toFixed(1)} – ${p.lambdaAway.toFixed(1)}` : '–'}</dd></div>
        <div><dt className="text-[12px] text-s-muted">{t('demoOu')} · {t('demoBtts')}</dt><dd className="num font-semibold">{pct(over)} · {pct(btts)}</dd></div>
      </dl>

      <p className="flex flex-wrap items-center justify-between gap-2 text-[13px] text-s-muted">
        <span>{tl('sampleNote')}</span>
        <span className="font-semibold text-s-accent-700">{tl('sampleOpen')} →</span>
      </p>
    </Link>
  );
}
