import { getFormatter, getTranslations } from 'next-intl/server';
import type { AiView } from '@/lib/site/ai-analysis';
import { SectionTitle } from './ui';

// "Yapay zeka görüşü" (18 Eki): ai-picks cron'unun ürettiği konsensüs, salt-okunur.
export default async function AiOpinion({ ai, homeName, awayName }: { ai: AiView; homeName: string; awayName: string }) {
  const t = await getTranslations('match.ai');
  const tc = await getTranslations('common');
  const f = await getFormatter();
  const side = (p: '1' | 'X' | '2') => (p === '1' ? homeName : p === '2' ? awayName : tc('draw'));
  const rows = [
    { label: t('m1x2'), pick: side(ai.matchResult.pick), conf: ai.matchResult.confidence },
    { label: t('mOu'), pick: ai.overUnder.pick === 'Over' ? t('over') : t('under'), conf: ai.overUnder.confidence },
    { label: t('mBtts'), pick: ai.btts.pick === 'Yes' ? t('yes') : t('no'), conf: ai.btts.confidence },
  ];
  const risk = ai.risk ? t(`risk_${ai.risk}`) : null;
  return (
    <section>
      <SectionTitle title={t('title')} meta={<>{t('meta', { time: f.dateTime(new Date(ai.createdAt), { dateStyle: 'short', timeStyle: 'short' }) })}</>} />
      <p className="mt-2 max-w-[68ch] text-sm text-s-muted">{t('lead')}</p>
      <div className="mt-5 grid gap-3 sm:grid-cols-3">
        {rows.map((r) => (
          <div key={r.label} className="rounded-lg border border-s-line p-3">
            <p className="text-xs text-s-muted">{r.label}</p>
            <p className="mt-1 text-[17px] font-semibold leading-tight">{r.pick}</p>
            <p className="num mt-1 text-xs text-s-muted">{t('conf', { pct: r.conf })}</p>
          </div>
        ))}
      </div>
      {ai.verdict && (
        <div className="mt-5 rounded-lg bg-s-raised p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-s-muted">{t('verdict')}</p>
          <p className="mt-1 text-[16px] font-semibold">{ai.verdict.market}: {ai.verdict.selection} <span className="num text-sm font-normal text-s-muted">· {t('conf', { pct: ai.verdict.confidence })}</span></p>
          <p className="mt-2 text-sm leading-relaxed">{ai.verdict.reasoning}</p>
          <p className="mt-2 text-xs text-s-muted">{[ai.verdict.agents, ai.verdict.history].filter(Boolean).join(' · ')}</p>
        </div>
      )}
      <p className="mt-4 text-xs text-s-muted">
        {ai.agreement != null && <>{t('agreement', { pct: Math.round(ai.agreement) })} · </>}
        {risk && <>{t('risk', { level: risk })} · </>}
        {t('systems', { list: ai.systems.join(', ') })}
      </p>
      <p className="mt-2 text-xs text-s-muted">{t('note')}</p>
    </section>
  );
}
