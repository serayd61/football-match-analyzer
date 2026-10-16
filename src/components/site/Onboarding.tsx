'use client';

// First-run tour (Testers Community feedback, 2026-10-16).
//
// Five short steps describing features that exist today (matches &
// probabilities, edge vs market and its limits, the public record, where to
// start). Opens automatically only inside the Google Play app (fa_twa cookie)
// on the first visit — on the web it never auto-opens, so SEO pages and the
// sign-up funnel are untouched — and can be re-opened from Account → Settings
// ("Show the tour again") through requestOnboarding(). State lives in
// localStorage (KEY): 'done' | 'skipped'. Accessible: role=dialog, aria-modal,
// focus trap, Esc = skip, progress announced as "Step n of 5".
import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { X, ChevronLeft, ChevronRight, Activity, Percent, Scale, ClipboardCheck, Rocket } from 'lucide-react';
import { Link } from '@/i18n/navigation';
import { readTwaCookie } from '@/lib/site/twa-client';
import { trackEvent, Events } from '@/lib/analytics';

export const ONBOARDING_KEY = 'fa-onboarding';
const OPEN_EVENT = 'fa:onboarding';
export const STEPS = ['welcome', 'matches', 'edge', 'record', 'start'] as const;
type StepId = (typeof STEPS)[number];
const ICONS: Record<StepId, typeof Activity> = { welcome: Activity, matches: Percent, edge: Scale, record: ClipboardCheck, start: Rocket };

/** Re-open the tour from anywhere (Account → "Show the tour again"). */
export function requestOnboarding(source: string): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(OPEN_EVENT, { detail: { source } }));
}

/** Should the tour auto-open? Only in the Play app and only once. Exported for tests/debugging. */
export function shouldAutoOpen(inApp: boolean, stored: string | null): boolean {
  return inApp && stored !== 'done' && stored !== 'skipped';
}

function readState(): string | null {
  try { return localStorage.getItem(ONBOARDING_KEY); } catch { return null; }
}
function writeState(v: 'done' | 'skipped'): void {
  try { localStorage.setItem(ONBOARDING_KEY, v); } catch { /* storage may be blocked */ }
}

const FOCUSABLE = 'a[href],button:not([disabled]),[tabindex]:not([tabindex="-1"])';

export default function Onboarding() {
  const t = useTranslations('onboarding');
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);
  const [maxSeen, setMaxSeen] = useState(0);
  const box = useRef<HTMLDivElement>(null);
  const returnFocus = useRef<HTMLElement | null>(null);

  const start = useCallback((source: string) => {
    returnFocus.current = (document.activeElement as HTMLElement | null) ?? null;
    setStep(0); setMaxSeen(0); setOpen(true);
    trackEvent(source === 'auto' ? Events.ONBOARDING_STARTED : Events.TUTORIAL_REOPENED, { source });
  }, []);

  // Auto-open (Play app, first visit) + manual re-open event.
  useEffect(() => {
    if (shouldAutoOpen(readTwaCookie(), readState())) {
      const id = window.setTimeout(() => start('auto'), 400); // let the page paint first
      return () => window.clearTimeout(id);
    }
  }, [start]);
  useEffect(() => {
    const onOpen = (e: Event) => start((e as CustomEvent<{ source?: string }>).detail?.source || 'manual');
    window.addEventListener(OPEN_EVENT, onOpen);
    return () => window.removeEventListener(OPEN_EVENT, onOpen);
  }, [start]);

  // Focus management + scroll lock while open.
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const id = window.requestAnimationFrame(() => box.current?.querySelector<HTMLElement>('[data-autofocus]')?.focus());
    return () => {
      document.body.style.overflow = prev;
      window.cancelAnimationFrame(id);
      returnFocus.current?.focus?.();
    };
  }, [open]);

  function close(kind: 'done' | 'skipped') {
    writeState(kind);
    setOpen(false);
    if (kind === 'done') trackEvent(Events.ONBOARDING_COMPLETED, { steps_viewed: maxSeen + 1 });
    else trackEvent(Events.ONBOARDING_SKIPPED, { step: step + 1, steps_viewed: maxSeen + 1 });
  }
  function go(n: number) {
    const next = Math.min(Math.max(n, 0), STEPS.length - 1);
    setStep(next); setMaxSeen((m) => Math.max(m, next));
  }
  // Keyboard: Esc = skip, Tab cycles inside the dialog. Listened on the
  // document so it works even when focus fell to <body> (e.g. after the
  // focused "Back" button became disabled).
  const closeRef = useRef(close); closeRef.current = close;
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.preventDefault(); closeRef.current('skipped'); return; }
      if (e.key !== 'Tab' || !box.current) return;
      const items = Array.from(box.current.querySelectorAll<HTMLElement>(FOCUSABLE)).filter((el) => el.offsetParent !== null);
      if (items.length === 0) return;
      const first = items[0], last = items[items.length - 1];
      const inside = box.current.contains(document.activeElement);
      if (!inside) { e.preventDefault(); (e.shiftKey ? last : first).focus(); }
      else if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open]);

  if (!open) return null;
  const id = STEPS[step];
  const Icon = ICONS[id];
  const last = step === STEPS.length - 1;

  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center bg-black/50 p-0 sm:items-center sm:p-6" data-testid="onboarding">
      <div
        ref={box}
        role="dialog"
        aria-modal="true"
        aria-labelledby="onb-title"
        aria-describedby="onb-body"
        className="w-full max-w-[480px] border border-s-line bg-s-surface text-s-ink shadow-xl sm:rounded-[2px]"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        <div className="flex items-center justify-between gap-3 border-b border-s-line px-5 py-3">
          <span className="text-xs font-semibold uppercase tracking-wider text-s-muted" aria-live="polite">{t('stepOf', { n: step + 1, total: STEPS.length })}</span>
          <button type="button" onClick={() => close('skipped')} className="inline-flex h-9 w-9 items-center justify-center rounded-[2px] text-s-muted hover:text-s-ink" aria-label={t('skip')} data-testid="onboarding-skip">
            <X size={18} aria-hidden />
          </button>
        </div>
        <div className="px-5 pt-5">
          <div className="mb-4 inline-flex h-11 w-11 items-center justify-center rounded-[2px] bg-s-brand text-s-brand-ink"><Icon size={22} aria-hidden /></div>
          <h2 id="onb-title" className="text-[22px] leading-tight" data-autofocus tabIndex={-1}>{t(`steps.${id}.title`)}</h2>
          <p id="onb-body" className="mt-2 text-[15px] leading-relaxed text-s-muted">{t(`steps.${id}.body`)}</p>
        </div>
        <ol className="mt-5 flex justify-center gap-2 px-5" aria-hidden>
          {STEPS.map((s, i) => <li key={s} className={`h-1.5 w-6 rounded-full ${i <= step ? 'bg-s-brand' : 'bg-s-line'}`} />)}
        </ol>
        <div className="mt-4 flex items-center justify-between gap-2 border-t border-s-line px-5 py-3">
          <button type="button" onClick={() => close('skipped')} className="text-sm text-s-muted underline underline-offset-4 hover:text-s-ink">{t('skip')}</button>
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => go(step - 1)} disabled={step === 0} className="inline-flex h-10 items-center gap-1 rounded-[2px] border border-s-line px-3 text-sm font-medium hover:border-s-muted disabled:opacity-40" data-testid="onboarding-back">
              <ChevronLeft size={16} aria-hidden />{t('back')}
            </button>
            {last ? (
              <>
                <Link href="/matches" onClick={() => close('done')} className="inline-flex h-10 items-center rounded-[2px] border border-s-line px-3 text-sm font-medium hover:border-s-muted">{t('cta')}</Link>
                <button type="button" onClick={() => close('done')} className="inline-flex h-10 items-center rounded-[2px] bg-s-brand px-4 text-sm font-medium text-s-brand-ink hover:opacity-90" data-testid="onboarding-done">{t('done')}</button>
              </>
            ) : (
              <button type="button" onClick={() => go(step + 1)} className="inline-flex h-10 items-center gap-1 rounded-[2px] bg-s-brand px-4 text-sm font-medium text-s-brand-ink hover:opacity-90" data-testid="onboarding-next">
                {t('next')}<ChevronRight size={16} aria-hidden />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
