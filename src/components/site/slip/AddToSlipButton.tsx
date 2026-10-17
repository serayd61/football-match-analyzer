'use client';

import { useTranslations } from 'next-intl';
import { Plus, Check } from 'lucide-react';
import { useSlip } from './SlipProvider';
import type { SlipLeg } from '@/lib/site/slip-rule';

// "Kupona ekle" düğmesi (slip-1.0). Sunucu sayfası yalnız ÜYE görünümünde basar;
// başlamış maçta pasif. Aynı seçim ikinci tıkta kupondan çıkar; aynı maçın başka
// seçimi eskisini değiştirir (toggleLeg).

export type SlipLegInput = Omit<SlipLeg, 'addedAt'>;

export default function AddToSlipButton({ leg, size = 'xs', className = '' }: { leg: SlipLegInput; size?: 'xs' | 'sm'; className?: string }) {
  const t = useTranslations('slip');
  const { has, toggle, ready, setOpen } = useSlip();
  const started = Date.parse(leg.kickoff) <= Date.now();
  const inSlip = ready && has(leg);
  const onClick = () => {
    const r = toggle({ ...leg, addedAt: new Date().toISOString() });
    if (r === 'added' || r === 'replaced') setOpen(true);
  };
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!ready || started}
      aria-pressed={inSlip}
      title={started ? t('started') : inSlip ? t('remove') : t('add')}
      className={`btn ${size === 'sm' ? 'btn-sm' : 'btn-xs'} ${inSlip ? 'btn-primary' : 'btn-secondary'} num whitespace-nowrap disabled:cursor-not-allowed disabled:opacity-50 ${className}`}
      data-testid="add-to-slip"
    >
      {inSlip ? <Check size={14} strokeWidth={2.5} aria-hidden /> : <Plus size={14} strokeWidth={2.5} aria-hidden />}
      <span className="ml-1">{inSlip ? t('inSlip') : t('add')}</span>
    </button>
  );
}
