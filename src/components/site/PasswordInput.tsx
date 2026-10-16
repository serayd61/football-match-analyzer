'use client';

// Password field with a show/hide toggle (Testers Community feedback,
// 2026-10-16). Keeps the `.input` look; the eye button sits inside the
// field, is a real <button type="button"> (never submits the form), has an
// accessible label + aria-pressed, and the input keeps its value and focus
// when the type flips. Controlled by the parent like a plain <input>.
import { useRef, useState, type InputHTMLAttributes } from 'react';
import { Eye, EyeOff } from 'lucide-react';

type Props = Omit<InputHTMLAttributes<HTMLInputElement>, 'type' | 'className'> & {
  showLabel: string;
  hideLabel: string;
  className?: string;
};

export default function PasswordInput({ showLabel, hideLabel, className = '', ...rest }: Props) {
  const [visible, setVisible] = useState(false);
  const ref = useRef<HTMLInputElement>(null);

  function toggle(e: React.MouseEvent<HTMLButtonElement>) {
    e.preventDefault(); // inside a <label>: do not re-trigger label activation
    setVisible((v) => !v);
    // keep the caret where it was
    const el = ref.current;
    if (el) {
      const pos = el.selectionEnd;
      requestAnimationFrame(() => { try { el.focus({ preventScroll: true }); if (pos != null) el.setSelectionRange(pos, pos); } catch {} });
    }
  }

  const Icon = visible ? EyeOff : Eye;
  return (
    <span className="relative block">
      <input ref={ref} {...rest} type={visible ? 'text' : 'password'} className={`input pr-11 ${className}`} />
      <button
        type="button"
        onClick={toggle}
        aria-label={visible ? hideLabel : showLabel}
        aria-pressed={visible}
        title={visible ? hideLabel : showLabel}
        data-testid="password-toggle"
        className="absolute right-1 top-1/2 inline-flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-[2px] text-s-muted hover:text-s-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-s-accent"
      >
        <Icon size={18} strokeWidth={2} aria-hidden />
      </button>
    </span>
  );
}
