import { getTranslations } from 'next-intl/server';
import type { Outcome } from '@/lib/site/predictions';

const STYLE: Record<Outcome, string> = {
  won: 'bg-s-win/12 text-s-win border-s-win/40',
  lost: 'bg-s-loss/12 text-s-loss border-s-loss/40',
  void: 'bg-s-void/12 text-s-void border-s-void/40',
  pending: 'bg-transparent text-s-muted border-s-line',
};

export default async function OutcomeBadge({ outcome }: { outcome: Outcome }) {
  const t = await getTranslations('common');
  return (
    <span className={`inline-flex h-6 items-center rounded-[2px] border px-2 text-xs font-medium ${STYLE[outcome]}`}>
      {t(outcome)}
    </span>
  );
}
