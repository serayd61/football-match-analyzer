'use client';

import { useTranslations } from 'next-intl';
import { Plus, Check } from 'lucide-react';
import { useSlip } from './SlipProvider';
import type { SlipLegInput } from './AddToSlipButton';

// Pazar ızgarasındaki seçim çipi (slip-1.1): etiket + model % + oran, tıklayınca kupona
// girer/çıkar. Sunucu sayfası yalnız üye görünümünde ve başlamamış maçta basar.
export default function SlipOptionButton({ leg, label, meta }: { leg: SlipLegInput; label: string; meta: string }) {
  const t = useTranslations('slip');
  const { has, toggle, ready, setOpen } = useSlip();
  const started = Date.parse(leg.kickoff) <= Date.now();
  const inSlip = ready && has(leg);
  return (
    <button
      type="button"
      onClick={() => { const r = toggle({ ...leg, addedAt: new Date().toISOString() }); if (r === 'added' || r === 'replaced') setOpen(true); }}
      disabled={!ready || started}
      aria-pressed={inSlip}
      title={started ? t('started') : inSlip ? t('remove') : t('add')}
      className={`flex min-w-0 items-center gap-2 rounded-xl border px-3 py-2 text-left transition disabled:cursor-not-allowed disabled:opacity-50 ${inSlip ? 'border-s-accent bg-s-accent-100/60' : 'border-s-line hover:border-s-ink/40 hover:bg-s-raised/60'}`}
      data-testid="slip-option"
    >
      <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${inSlip ? 'bg-s-accent-600 text-white' : 'bg-s-raised text-s-muted'}`} aria-hidden>
        {inSlip ? <Check size={14} strokeWidth={2.5} /> : <Plus size={14} strokeWidth={2.5} />}
      </span>
      <span className="min-w-0">
        <span className="block truncate text-[13.5px] font-semibold leading-tight">{label}</span>
        <span className="num block text-[11.5px] leading-tight text-s-muted">{meta}</span>
      </span>
    </button>
  );
}
