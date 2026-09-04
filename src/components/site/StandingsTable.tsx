import { getTranslations } from 'next-intl/server';
import type { StandingRow } from '@/lib/site/standings';
import { Crest } from './PredictionTable';

const crest = (id: number) => `https://images.fotmob.com/image_resources/logo/teamlogo/${id}.png`;

export default async function StandingsTable({ rows, highlight }: { rows: StandingRow[]; highlight?: number[] }) {
  const t = await getTranslations('standings');
  const th = 'py-1.5 text-xs font-medium uppercase tracking-wider text-s-muted';
  const hl = new Set(highlight || []);
  return (
    <div className="tbl-scroll">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-s-line text-left">
            <th className={`${th} w-8 text-right`}>#</th>
            <th className={th}>{t('team')}</th>
            <th className={`${th} text-right`}>{t('played')}</th>
            <th className={`${th} hidden text-right sm:table-cell`}>{t('won')}</th>
            <th className={`${th} hidden text-right sm:table-cell`}>{t('drawn')}</th>
            <th className={`${th} hidden text-right sm:table-cell`}>{t('lost')}</th>
            <th className={`${th} hidden text-right md:table-cell`}>{t('goals')}</th>
            <th className={`${th} text-right`}>{t('gd')}</th>
            <th className={`${th} text-right`}>{t('pts')}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.teamId} className={`border-b border-s-line ${hl.has(r.teamId) ? 'bg-s-raised/60 font-medium' : ''}`}>
              <td className="num py-1.5 text-right text-s-muted" style={r.qualColor ? { boxShadow: `inset 3px 0 0 ${r.qualColor}` } : undefined}>{r.pos}</td>
              <td className="py-1.5"><span className="flex items-center gap-2"><Crest src={crest(r.teamId)} alt="" />{r.name}{r.deduction ? <span className="text-xs text-s-loss">({r.deduction})</span> : null}</span></td>
              <td className="num py-1.5 text-right">{r.played}</td>
              <td className="num hidden py-1.5 text-right sm:table-cell">{r.won}</td>
              <td className="num hidden py-1.5 text-right sm:table-cell">{r.drawn}</td>
              <td className="num hidden py-1.5 text-right sm:table-cell">{r.lost}</td>
              <td className="num hidden py-1.5 text-right md:table-cell">{r.gf}–{r.ga}</td>
              <td className="num py-1.5 text-right">{r.gd > 0 ? `+${r.gd}` : r.gd}</td>
              <td className="num py-1.5 text-right font-semibold">{r.pts}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
