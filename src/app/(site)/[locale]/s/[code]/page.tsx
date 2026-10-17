import type { Metadata } from 'next';
import { getFormatter, getTranslations, unstable_setRequestLocale } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { decodeSlip, type SharedLeg } from '@/lib/site/slip-share';
import { legOutcome, slipTotals, slipStatus, type SlipLeg } from '@/lib/site/slip-rule';
import { loadShared, asLeg } from '@/lib/site/slip-shared';
import { Page, PageTitle, EmptyState } from '@/components/site/ui';
import ImportSlipButton from '@/components/site/slip/ImportSlipButton';
import LocalTime from '@/components/site/LocalTime';

// ============================================================================
// Paylaşılan kupon (slip-1.3, 2026-10-17): /{locale}/s/{code}. Herkese açık, indekslenmez.
// Bacaklar koddan, takım/lig/saat/skor veritabanından (resmi sürüm). Üye "Kuponuma al" ile
// kopyalar; ziyaretçiye kayıt bağlantısı. Sunucu kupon saklamaz.
// ============================================================================
export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: { params: { locale: string; code: string } }): Promise<Metadata> {
  const t = await getTranslations({ locale: params.locale, namespace: 'slip' });
  const legs = decodeSlip(params.code);
  const tot = slipTotals(legs.map(asLeg));
  return {
    title: t('sharedTitle'),
    description: tot.totalOdds != null ? t('sharedMetaOdds', { n: legs.length, odds: tot.totalOdds.toFixed(2) }) : t('sharedMeta', { n: legs.length }),
    robots: { index: false, follow: false },
  };
}

const pct = (p: number) => `${Math.round(p * 100)}%`;

export default async function SharedSlipPage({ params }: { params: { locale: string; code: string } }) {
  unstable_setRequestLocale(params.locale);
  const [t, tc, f] = await Promise.all([getTranslations('slip'), getTranslations('common'), getFormatter()]);
  const { legs, missing, results } = await loadShared(params.code);
  const totals = slipTotals(legs);
  const status = slipStatus(legs, results);
  const fo = (o: number) => f.number(o, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const label = (l: SlipLeg) => {
    if (l.market === '1x2') return l.selection === '1' ? l.homeName : l.selection === '2' ? l.awayName : tc('draw');
    if (l.market === 'ou25') return l.selection === 'over' ? t('over') : t('under');
    if (l.market === 'btts') return l.selection === 'yes' ? t('bttsYes') : t('bttsNo');
    const team = l.selection === 'home' ? l.homeName : l.awayName;
    if (l.market === 'dnb') return `${team} · ${t('dnbShort')}`;
    const line = l.selection === 'home' ? (l.line ?? 0) : -(l.line ?? 0);
    return `${team} ${line > 0 ? '+' : ''}${line}`;
  };
  const statusTone = status === 'won' ? 'bg-s-win text-white' : status === 'lost' ? 'bg-s-loss text-white' : 'border border-s-line text-s-muted';

  return (
    <Page>
      <PageTitle eyebrow={t('sharedEyebrow')} title={t('sharedTitle')} lead={t('sharedLead')} />
      {legs.length === 0 ? (
        <EmptyState title={t('sharedEmpty')} lead={t('sharedEmptyLead')} action={<Link href="/" className="btn btn-secondary btn-sm">{tc('home')}</Link>} />
      ) : (
        <div className="card max-w-[720px] !gap-4" data-testid="shared-slip">
          <ol className="divide-y divide-s-line">
            {legs.map((l, i) => {
              const r = results[l.fixtureId];
              const out = legOutcome(l, r);
              const hit = out == null ? null : out === 'won' || out === 'half_won' || out === 'void';
              const outLabel = out === 'void' ? t('outcome.void') : out === 'half_won' ? t('outcome.half_won') : out === 'half_lost' ? t('outcome.half_lost') : null;
              return (
                <li key={`${l.fixtureId}:${l.market}`} className="flex items-start gap-3 py-3 first:pt-0 last:pb-0">
                  <span className="num mt-0.5 w-5 shrink-0 text-center text-[12px] font-semibold text-s-muted">{i + 1}</span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[15px] font-semibold">{l.homeName} – {l.awayName}</p>
                    <p className="mt-0.5 truncate text-[12px] text-s-muted"><LocalTime iso={l.kickoff} format="kickoff" /> · {l.leagueLabel}</p>
                    <p className="mt-1 text-[13.5px]"><span className="font-semibold">{label(l)}</span> <span className="num text-s-muted">· {pct(l.p)}{l.odds != null && <> · {fo(l.odds)}</>}</span>
                      {hit != null && r && <span className={`num ${out === 'void' ? 'text-s-muted' : hit ? 'text-s-win' : 'text-s-loss'}`}> · {r.homeScore}–{r.awayScore} {out === 'void' ? '○' : hit ? '✓' : '✗'}{outLabel && <span className="ml-1 text-[11px] font-normal">{outLabel}</span>}</span>}
                      {hit == null && r?.status === 'started' && <span className="text-[12px] text-s-muted"> · {t('live')}</span>}
                    </p>
                  </div>
                </li>
              );
            })}
          </ol>
          <dl className="grid grid-cols-3 gap-3 border-t border-s-line pt-3 text-[13px]">
            <div><dt className="text-[11.5px] text-s-muted">{t('legs')}</dt><dd className="num font-semibold">{totals.n}</dd>{totals.fixtures < totals.n && <dd className="text-[11px] text-s-muted">{t('fixtures', { n: totals.fixtures })}</dd>}</div>
            <div><dt className="text-[11.5px] text-s-muted">{t('totalOdds')}</dt><dd className="num font-semibold">{totals.totalOdds != null ? fo(totals.totalOdds) : '–'}</dd>{totals.missingOdds > 0 && <dd className="text-[11px] text-s-muted">{t('missingOdds', { n: totals.missingOdds })}</dd>}</div>
            <div><dt className="text-[11.5px] text-s-muted">{t('jointP')}</dt><dd className="num font-semibold">{pct(totals.jointP)}</dd></div>
          </dl>
          {missing > 0 && <p className="text-[12px] text-s-muted">{t('sharedMissing', { n: missing })}</p>}
          <div className="flex flex-wrap items-center gap-3">
            <span className={`rounded-md px-1.5 py-0.5 text-[11px] font-bold uppercase tracking-wide ${statusTone}`}>{t(`status.${status}`)}</span>
            <span className="flex-1" />
            <ImportSlipButton legs={legs.map(({ addedAt: _a, ...l }) => l)} />
          </div>
          <p className="text-[11.5px] leading-snug text-s-muted">{t('sharedNote')}</p>
        </div>
      )}
    </Page>
  );
}
