import { getFormatter, getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import type { SitePrediction } from '@/lib/site/predictions';
import OutcomeBadge from './OutcomeBadge';
import { pickLabel } from './PredictionTable';

// Settled picks as a `.table` (design 2026-09-11): Date / Match (+ league
// 11px muted) / Pick / Conf / Odds / Score / Result tag. Newest first. Odds
// are the model's fair odds for the pick (1 / probability).
const pct = (x: number | null | undefined) => (x == null ? '–' : `${Math.round(x * 100)}%`);
const fair = (r: SitePrediction) => {
  const p = r.pick === '1' ? r.pHome : r.pick === '2' ? r.pAway : r.pick === 'X' ? r.pDraw : 0;
  return p > 0 ? (1 / p).toFixed(2) : '–';
};

export default async function ResultsTable({ rows }: { rows: SitePrediction[] }) {
  const t = await getTranslations('v2.performance');
  const tc = await getTranslations('common');
  const f = await getFormatter();

  return (
    <div className="tbl-scroll mt-3">
      <table className="table min-w-[640px]">
        <thead>
          <tr>
            <th>{t('colDate')}</th>
            <th>{t('colMatch')}</th>
            <th>{t('colPick')}</th>
            <th className="text-right">{t('colConf')}</th>
            <th className="text-right">{t('colOdds')}</th>
            <th className="text-right">{t('colScore')}</th>
            <th className="text-right">{t('colResult')}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.fixtureId}>
              <td className="num whitespace-nowrap text-s-muted">{f.dateTime(new Date(r.kickoff), 'dayShort')}</td>
              <td>
                <Link href={`/predictions/${r.fixtureId}`} className="font-semibold hover:text-s-accent-600">{r.homeName} – {r.awayName}</Link>
                <div className="text-[11px] text-s-muted">{r.leagueName}</div>
              </td>
              <td>{pickLabel(r, tc)}</td>
              <td className="num text-right">{pct(r.confidence)}</td>
              <td className="num text-right">{fair(r)}</td>
              <td className="num text-right font-semibold">{r.homeScore != null && r.awayScore != null ? `${r.homeScore}–${r.awayScore}` : '–'}</td>
              <td className="text-right"><OutcomeBadge outcome={r.outcome} /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
