import { getTranslations } from 'next-intl/server';
import type { Outcome } from '@/lib/site/predictions';

// Tags (design 2026-09-11): WON = neutral tag (neutral-200 fill, ink text),
// LOST = accent tag (accent-100 fill, accent-800 text). 11px uppercase, 0 radius.
const STYLE: Record<Outcome, string> = {
  won: 'tag',
  lost: 'tag tag-accent',
  void: 'tag tag-outline',
  pending: 'tag tag-outline',
};

export default async function OutcomeBadge({ outcome }: { outcome: Outcome }) {
  const t = await getTranslations('common');
  return <span className={STYLE[outcome]}>{t(outcome)}</span>;
}
