'use client';

import { Suspense, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { Activity } from 'lucide-react';
import { Spinner } from '@/components/ui';
import { useLanguage } from '@/components/LanguageProvider';

export const dynamic = 'force-dynamic';

const L = {
  tr: {
    title: 'Şifre Sıfırla', lead: 'Yeni şifreni belirle.', pw: 'Yeni Şifre', pw2: 'Yeni Şifre (Tekrar)',
    submit: 'Şifreyi Güncelle', saving: 'Güncelleniyor...', short: 'Şifre en az 8 karakter olmalı.', mismatch: 'Şifreler eşleşmiyor.',
    error: 'Bir hata oluştu. Lütfen tekrar deneyin.', done: 'Şifren güncellendi! Giriş sayfasına yönlendiriliyorsun...', login: 'Hemen giriş yap →',
    invalid: 'Geçersiz bağlantı. Lütfen', invalidLink: 'yeni bir sıfırlama isteyin', loading: 'Yükleniyor...',
  },
  en: {
    title: 'Reset password', lead: 'Choose your new password.', pw: 'New password', pw2: 'New password (again)',
    submit: 'Update password', saving: 'Updating...', short: 'The password must be at least 8 characters.', mismatch: 'The passwords do not match.',
    error: 'Something went wrong. Please try again.', done: 'Your password has been updated. Redirecting you to sign in...', login: 'Sign in now →',
    invalid: 'Invalid link. Please', invalidLink: 'request a new reset link', loading: 'Loading...',
  },
  de: {
    title: 'Passwort zurücksetzen', lead: 'Lege dein neues Passwort fest.', pw: 'Neues Passwort', pw2: 'Neues Passwort (wiederholen)',
    submit: 'Passwort aktualisieren', saving: 'Wird aktualisiert...', short: 'Das Passwort muss mindestens 8 Zeichen haben.', mismatch: 'Die Passwörter stimmen nicht überein.',
    error: 'Etwas ist schiefgelaufen. Bitte versuche es erneut.', done: 'Dein Passwort wurde aktualisiert. Du wirst zur Anmeldung weitergeleitet...', login: 'Jetzt anmelden →',
    invalid: 'Ungültiger Link. Bitte', invalidLink: 'fordere einen neuen Link an', loading: 'Wird geladen...',
  },
} as const;

function ResetPasswordForm({ l }: { l: (typeof L)[keyof typeof L] }) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const token = searchParams.get('token') || '';

  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (password.length < 8) { setError(l.short); return; }
    if (password !== confirm) { setError(l.mismatch); return; }
    setLoading(true);
    try {
      const res = await fetch('/api/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, newPassword: password }),
      });
      if (!res.ok) {
        setError(l.error);
      } else {
        setDone(true);
        setTimeout(() => router.push('/login'), 2500);
      }
    } catch {
      setError(l.error);
    }
    setLoading(false);
  }

  if (!token) {
    return (
      <div className="rounded-xl border border-negative/30 bg-negative/10 p-4 text-negative">
        {l.invalid} <Link href="/forgot-password" className="underline">{l.invalidLink}</Link>.
      </div>
    );
  }

  if (done) {
    return (
      <div className="space-y-4">
        <div className="rounded-xl border border-positive/30 bg-positive/10 p-4 text-positive">{l.done}</div>
        <Link href="/login" className="block text-center text-brand-400 hover:text-brand-300 transition-colors">{l.login}</Link>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <p className="text-sm text-content-muted">{l.lead}</p>
      <div>
        <label className="block text-sm font-medium text-content-muted mb-2">{l.pw}</label>
        <input type="password" required value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" className="fa-input w-full" />
      </div>
      <div>
        <label className="block text-sm font-medium text-content-muted mb-2">{l.pw2}</label>
        <input type="password" required value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder="••••••••" className="fa-input w-full" />
      </div>
      {error && <div className="p-4 rounded-xl bg-negative/10 border border-negative/30 text-negative text-sm">{error}</div>}
      <button type="submit" disabled={loading} className="fa-btn fa-btn-primary fa-btn-lg w-full">
        {loading ? <><Spinner size={16} /> {l.saving}</> : <span>{l.submit}</span>}
      </button>
    </form>
  );
}

export default function ResetPasswordPage() {
  const { lang } = useLanguage();
  const l = L[lang] || L.en;
  return (
    <div className="fa-shell min-h-screen flex items-center justify-center px-4">
      <div className="fa-card w-full max-w-md mx-auto p-8">
        <div className="w-12 h-12 rounded-2xl grid place-items-center bg-gradient-to-br from-brand-500 to-brand-700 shadow-glow-brand mb-6">
          <Activity size={24} className="text-[#06281d]" strokeWidth={2.5} />
        </div>
        <h1 className="text-2xl font-semibold text-content tracking-tight mb-4">{l.title}</h1>
        <Suspense fallback={<p className="text-content-muted">{l.loading}</p>}>
          <ResetPasswordForm l={l} />
        </Suspense>
      </div>
    </div>
  );
}
