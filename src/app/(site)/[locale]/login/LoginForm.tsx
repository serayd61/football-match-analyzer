'use client';

import { useState } from 'react';
import { signIn } from 'next-auth/react';
import { track } from '@/lib/analytics';

type Labels = {
  name: string; email: string; password: string; signIn: string; register: string; google: string;
  noAccount: string; startFree: string; hasAccount: string; signInLink: string; forgot: string;
  processing: string; errorInvalid: string; errorGeneral: string; or: string;
};

// Credentials + Google sign-in, and registration (POST /api/auth/register,
// then sign-in). Fields: `.field` label 12px + `.input` 40px, 0 radius.
export default function LoginForm({ locale, callbackUrl, initialMode, forgotHref, labels: l }: {
  locale: string; callbackUrl: string; initialMode: 'signin' | 'register'; forgotHref: string; labels: Labels;
}) {
  const [mode, setMode] = useState<'signin' | 'register'>(initialMode);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true); setError('');
    try {
      if (mode === 'register') {
        const res = await fetch('/api/auth/register', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password, name, lang: locale }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) { setError(data?.error || l.errorGeneral); setLoading(false); return; }
        track.signUp('credentials');
      }
      const result = await signIn('credentials', { email, password, redirect: false });
      if (result?.error) { setError(l.errorInvalid); setLoading(false); return; }
      if (mode === 'signin') track.login('credentials');
      window.location.assign(callbackUrl);
    } catch {
      setError(l.errorGeneral);
      setLoading(false);
    }
  };

  return (
    <div className="flex max-w-[480px] flex-col gap-3">
      {error && <p role="alert" className="risk-note">{error}</p>}
      <form onSubmit={submit} className="flex flex-col gap-3">
        {mode === 'register' && (
          <label className="field">
            <span>{l.name}</span>
            <input className="input" type="text" value={name} onChange={(e) => setName(e.target.value)} required autoComplete="name" />
          </label>
        )}
        <label className="field">
          <span>{l.email}</span>
          <input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" />
        </label>
        <label className="field">
          <span>{l.password}</span>
          <input className="input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required autoComplete={mode === 'register' ? 'new-password' : 'current-password'} minLength={6} />
        </label>
        <button type="submit" disabled={loading} className="btn btn-primary btn-block mt-1">{loading ? l.processing : mode === 'register' ? l.register : l.signIn}</button>
      </form>
      <button type="button" onClick={() => { track.login('google'); signIn('google', { callbackUrl }); }} className="btn btn-secondary btn-block">{l.google}</button>
      <p className="text-[13px] text-s-muted">
        {mode === 'signin' ? (
          <>{l.noAccount} <button type="button" onClick={() => { setMode('register'); setError(''); }} className="font-semibold text-s-ink hover:text-s-accent-600">{l.startFree}</button>
            <span className="mx-2">·</span><a href={forgotHref} className="hover:text-s-ink">{l.forgot}</a></>
        ) : (
          <>{l.hasAccount} <button type="button" onClick={() => { setMode('signin'); setError(''); }} className="font-semibold text-s-ink hover:text-s-accent-600">{l.signInLink}</button></>
        )}
      </p>
    </div>
  );
}
