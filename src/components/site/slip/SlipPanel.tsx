'use client';

import { useEffect, useMemo, useState } from 'react';
import { useFormatter, useTranslations } from 'next-intl';
import { Copy, Check, Trash2, X } from 'lucide-react';
import { Link } from '@/i18n/navigation';
import { useSlip } from './SlipProvider';
import { slipTotals, slipText, legOutcome, slipStatus, legKey, MAX_LEGS, type SlipLeg, type SlipResult } from '@/lib/site/slip-rule';

// ============================================================================
// Kuponum — bacak listesi (slip-1.0). Çubuğun çekmecesinde ve /coupon sayfasında
// aynı bileşen. Başlangıca göre sıralı; biten maçların skoru /api/site/slip'ten
// (üye kapılı) gelir ve bacak bazında ✓/✗ işlenir. Sunucuya kupon yazılmaz.
// ============================================================================

export function useSlipLabel() {
  const t = useTranslations('slip');
  const tc = useTranslations('common');
  return (l: Pick<SlipLeg, 'market' | 'selection' | 'homeName' | 'awayName' | 'line'>) => {
    if (l.market === '1x2') return l.selection === '1' ? l.homeName : l.selection === '2' ? l.awayName : tc('draw');
    if (l.market === 'ou25') return l.selection === 'over' ? t('over') : t('under');
    if (l.market === 'btts') return l.selection === 'yes' ? t('bttsYes') : t('bttsNo');
    const team = l.selection === 'home' ? l.homeName : l.awayName;
    if (l.market === 'dnb') return `${team} · ${t('dnbShort')}`;
    const line = l.selection === 'home' ? (l.line ?? 0) : -(l.line ?? 0);
    return `${team} ${line > 0 ? '+' : ''}${line}`;
  };
}

export default function SlipPanel({ variant = 'drawer', from = 'from=slip' }: { variant?: 'drawer' | 'page'; from?: string }) {
  const t = useTranslations('slip');
  const f = useFormatter();
  const { legs, ready, remove, clear, setOpen } = useSlip();
  const label = useSlipLabel();
  const [results, setResults] = useState<Record<number, SlipResult>>({});
  const [copied, setCopied] = useState(false);

  const sorted = useMemo(() => [...legs].sort((a, b) => a.kickoff.localeCompare(b.kickoff) || a.fixtureId - b.fixtureId || legKey(a).localeCompare(legKey(b))), [legs]);
  const totals = useMemo(() => slipTotals(legs), [legs]);
  const status = slipStatus(legs, results);

  // Skorlar: yalnız başlamış bacak varsa sor; 60 sn'de bir tazele.
  const startedIds = useMemo(() => { const now = Date.now(); return sorted.filter((l) => Date.parse(l.kickoff) <= now).map((l) => l.fixtureId).join(','); }, [sorted]);
  useEffect(() => {
    if (!startedIds) { setResults({}); return; }
    let alive = true;
    const load = async () => {
      try {
        const r = await fetch(`/api/site/slip?ids=${startedIds}`, { cache: 'no-store' });
        if (!r.ok) return;
        const j = await r.json();
        if (alive && j?.ok && j.results) setResults(j.results);
      } catch { /* ağ: sessiz */ }
    };
    load();
    const id = setInterval(load, 60_000);
    return () => { alive = false; clearInterval(id); };
  }, [startedIds]);

  const fo = (o: number) => f.number(o, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const pct = (p: number) => `${Math.round(p * 100)}%`;
  const time = (iso: string) => f.dateTime(new Date(iso), { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });

  const copy = async () => {
    const txt = slipText(sorted, label, { time, odds: fo, pct, title: t('title'), total: t('totalOdds'), note: t('shareNote') });
    try { await navigator.clipboard.writeText(txt); setCopied(true); setTimeout(() => setCopied(false), 2000); } catch { /* izin yok */ }
  };

  if (!ready) return null;
  if (!legs.length) {
    return (
      <div className={variant === 'page' ? 'mt-3 rounded-xl border border-dashed border-s-line p-5 text-[13.5px] text-s-muted' : 'p-4 text-[13.5px] text-s-muted'}>
        <p>{t('empty', { max: MAX_LEGS })}</p>
        <Link href="/predictions" className="btn btn-secondary btn-xs mt-3" onClick={() => setOpen(false)}>{t('toMatches')}</Link>
      </div>
    );
  }

  const statusTone = status === 'won' ? 'bg-s-win text-white' : status === 'lost' ? 'bg-s-loss text-white' : 'border border-s-line text-s-muted';

  return (
    <div className={variant === 'page' ? 'mt-3' : ''}>
      <ol className="divide-y divide-s-line" data-testid="slip-legs">
        {sorted.map((l, i) => {
          const r = results[l.fixtureId];
          const out = legOutcome(l, r);
          const hit = out == null ? null : out === 'won' || out === 'half_won' || out === 'void';
          const outLabel = out === 'void' ? t('outcome.void') : out === 'half_won' ? t('outcome.half_won') : out === 'half_lost' ? t('outcome.half_lost') : null;
          return (
            <li key={legKey(l)} className="flex items-start gap-3 py-2.5">
              <span className="num mt-0.5 w-5 shrink-0 text-center text-[12px] font-semibold text-s-muted">{i + 1}</span>
              <div className="min-w-0 flex-1">
                <Link href={`/predictions/${l.fixtureId}?back=${encodeURIComponent(from)}`} className="block truncate text-[14px] font-semibold hover:underline" onClick={() => setOpen(false)}>{l.homeName} – {l.awayName}</Link>
                <p className="mt-0.5 truncate text-[12px] text-s-muted"><span className="num">{time(l.kickoff)}</span> · {l.leagueLabel}</p>
                <p className="mt-1 text-[13px]"><span className="font-semibold">{label(l)}</span> <span className="num text-s-muted">· {pct(l.p)}{l.odds != null && <> · {fo(l.odds)}</>}</span>
                  {hit != null && r && <span className={`num ${out === 'void' ? 'text-s-muted' : hit ? 'text-s-win' : 'text-s-loss'}`}> · {r.homeScore}–{r.awayScore} {out === 'void' ? '○' : hit ? '✓' : '✗'}{outLabel && <span className="ml-1 text-[11px] font-normal">{outLabel}</span>}</span>}
                  {hit == null && r?.status === 'started' && <span className="text-[12px] text-s-muted"> · {t('live')}</span>}
                </p>
              </div>
              <button type="button" onClick={() => remove(l)} className="btn btn-ghost btn-xs !px-1.5 shrink-0" aria-label={t('remove')} title={t('remove')}><X size={14} aria-hidden /></button>
            </li>
          );
        })}
      </ol>
      <dl className="mt-3 grid grid-cols-3 gap-3 border-t border-s-line pt-3 text-[13px]">
        <div><dt className="text-[11.5px] text-s-muted">{t('legs')}</dt><dd className="num font-semibold">{totals.n}/{MAX_LEGS}</dd>{totals.fixtures < totals.n && <dd className="text-[11px] text-s-muted">{t('fixtures', { n: totals.fixtures })}</dd>}</div>
        <div><dt className="text-[11.5px] text-s-muted">{t('totalOdds')}</dt><dd className="num font-semibold">{totals.totalOdds != null ? fo(totals.totalOdds) : '–'}</dd>{totals.missingOdds > 0 && <dd className="text-[11px] text-s-muted">{t('missingOdds', { n: totals.missingOdds })}</dd>}</div>
        <div><dt className="text-[11.5px] text-s-muted">{t('jointP')}</dt><dd className="num font-semibold">{pct(totals.jointP)}</dd></div>
      </dl>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <span className={`rounded-md px-1.5 py-0.5 text-[11px] font-bold uppercase tracking-wide ${statusTone}`}>{t(`status.${status}`)}</span>
        <span className="flex-1" />
        <button type="button" onClick={copy} className="btn btn-secondary btn-xs">{copied ? <Check size={14} aria-hidden /> : <Copy size={14} aria-hidden />}<span className="ml-1">{copied ? t('copied') : t('copy')}</span></button>
        <button type="button" onClick={() => { if (window.confirm(t('clearConfirm'))) clear(); }} className="btn btn-ghost btn-xs"><Trash2 size={14} aria-hidden /><span className="ml-1">{t('clear')}</span></button>
      </div>
      <p className="mt-3 text-[11.5px] leading-snug text-s-muted">{t('note')}</p>
    </div>
  );
}
