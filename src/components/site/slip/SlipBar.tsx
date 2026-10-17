'use client';

import { useEffect, useRef } from 'react';
import { useTranslations } from 'next-intl';
import { useSession } from 'next-auth/react';
import { usePathname } from '@/i18n/navigation';
import { ChevronUp, ChevronDown, Ticket } from 'lucide-react';
import { useSlip } from './SlipProvider';
import SlipPanel from './SlipPanel';
import { slipTotals, MAX_LEGS } from '@/lib/site/slip-rule';

// ============================================================================
// Kuponum — yüzen çubuk (slip-1.0). Oturum açık ve kuponda bacak varken görünür;
// mobilde alt sekme çubuğunun üstüne oturur (site.css .slipbar). Tıklayınca çekmece.
// /coupon sayfasında gizli: kupon orada zaten tam alanıyla var.
// ============================================================================

export default function SlipBar() {
  const t = useTranslations('slip');
  const { status } = useSession();
  const pathname = usePathname();
  const { legs, ready, open, setOpen, flash } = useSlip();
  const ref = useRef<HTMLDivElement>(null);

  // Dışarı tıklayınca / Esc ile kapat.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onDown); document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onDown); document.removeEventListener('keydown', onKey); };
  }, [open, setOpen]);

  if (!ready || status !== 'authenticated' || pathname === '/coupon') return null;
  const totals = slipTotals(legs);
  const msg = flash && (flash.outcome === 'full' ? t('full', { max: MAX_LEGS }) : flash.outcome === 'started' ? t('started') : flash.outcome === 'replaced' ? t('replaced') : null);
  if (!legs.length && !msg) return null;

  return (
    <div ref={ref} className="slipbar" data-testid="slip-bar">
      {open && legs.length > 0 && (
        <div className="slipdrawer card !gap-0 !p-4" role="dialog" aria-label={t('title')}>
          <div className="flex items-center justify-between gap-2 border-b border-s-line pb-2">
            <p className="kicker">{t('title')}</p>
            <button type="button" onClick={() => setOpen(false)} className="btn btn-ghost btn-xs">{t('close')}</button>
          </div>
          <div className="max-h-[55vh] overflow-y-auto"><SlipPanel variant="drawer" /></div>
        </div>
      )}
      {msg && <p className="slipflash num" role="status">{msg}</p>}
      {legs.length > 0 && (
        <button type="button" onClick={() => setOpen(!open)} className="slipbtn" aria-expanded={open} aria-controls="slip-drawer">
          <Ticket size={18} strokeWidth={2.2} aria-hidden />
          <span className="font-bold">{t('title')}</span>
          <span className="num rounded-md bg-white/20 px-1.5 py-0.5 text-[12px] font-bold">{totals.n}</span>
          {totals.totalOdds != null && <span className="num text-[13px] opacity-90">{t('totalOddsShort')} {totals.totalOdds.toFixed(2)}</span>}
          <span className="ml-auto">{open ? <ChevronDown size={18} aria-hidden /> : <ChevronUp size={18} aria-hidden />}</span>
        </button>
      )}
    </div>
  );
}
