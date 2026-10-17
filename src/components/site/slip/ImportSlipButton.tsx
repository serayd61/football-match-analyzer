'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { useSession } from 'next-auth/react';
import { Ticket, Check } from 'lucide-react';
import { Link } from '@/i18n/navigation';
import { useSlip } from './SlipProvider';
import type { SlipLeg } from '@/lib/site/slip-rule';

// Paywall.tsx'ten alınmadı: o modül sunucu-only (next/headers) twa.ts'i çeker, istemci paketine giremez.
const REGISTER_HREF = '/login?mode=register';

// Paylaşılan kupon sayfası (slip-1.3): üye "Kuponuma al" ile bacakları kendi kuponuna
// kopyalar (başlamış maçlar atlanır); ziyaretçiye kayıt bağlantısı.
export default function ImportSlipButton({ legs }: { legs: Omit<SlipLeg, 'addedAt'>[] }) {
  const t = useTranslations('slip');
  const { status } = useSession();
  const { toggle, has, ready, setOpen } = useSlip();
  const [done, setDone] = useState<number | null>(null);
  if (status !== 'authenticated') return <Link href={REGISTER_HREF} className="btn btn-primary btn-sm">{t('sharedCta')}</Link>;
  const run = () => {
    let n = 0;
    for (const l of legs) { if (has(l)) continue; const r = toggle({ ...l, addedAt: new Date().toISOString() }); if (r === 'added' || r === 'replaced') n++; }
    setDone(n); setOpen(true);
  };
  return (
    <button type="button" onClick={run} disabled={!ready} className="btn btn-primary btn-sm">
      {done != null ? <Check size={16} aria-hidden /> : <Ticket size={16} aria-hidden />}
      <span className="ml-1.5">{done != null ? t('imported', { n: done }) : t('importBtn')}</span>
    </button>
  );
}
