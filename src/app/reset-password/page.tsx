'use client';

import { Suspense, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { Activity } from 'lucide-react';
import { Spinner } from '@/components/ui';

export const dynamic = 'force-dynamic';

function ResetPasswordForm() {
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
    if (password.length < 8) {
      setError('Şifre en az 8 karakter olmalı.');
      return;
    }
    if (password !== confirm) {
      setError('Şifreler eşleşmiyor.');
      return;
    }
    setLoading(true);
    try {
      const res = await fetch('/api/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, newPassword: password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Bir hata oluştu.');
      } else {
        setDone(true);
        setTimeout(() => router.push('/login'), 2500);
      }
    } catch {
      setError('Bir hata oluştu. Lütfen tekrar deneyin.');
    }
    setLoading(false);
  }

  if (!token) {
    return (
      <div className="rounded-xl border border-negative/30 bg-negative/10 p-4 text-negative">
        Geçersiz bağlantı. Lütfen{' '}
        <Link href="/forgot-password" className="underline">
          yeni bir sıfırlama isteyin
        </Link>
        .
      </div>
    );
  }

  if (done) {
    return (
      <div className="space-y-4">
        <div className="rounded-xl border border-positive/30 bg-positive/10 p-4 text-positive">
          Şifren güncellendi! Giriş sayfasına yönlendiriliyorsun...
        </div>
        <Link href="/login" className="block text-center text-brand-400 hover:text-brand-300 transition-colors">
          Hemen giriş yap →
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <p className="text-sm text-content-muted">Yeni şifreni belirle.</p>
      <div>
        <label className="block text-sm font-medium text-content-muted mb-2">Yeni Şifre</label>
        <input
          type="password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="••••••••"
          className="fa-input w-full"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-content-muted mb-2">Yeni Şifre (Tekrar)</label>
        <input
          type="password"
          required
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          placeholder="••••••••"
          className="fa-input w-full"
        />
      </div>
      {error && (
        <div className="p-4 rounded-xl bg-negative/10 border border-negative/30 text-negative text-sm">
          {error}
        </div>
      )}
      <button
        type="submit"
        disabled={loading}
        className="fa-btn fa-btn-primary fa-btn-lg w-full"
      >
        {loading ? <><Spinner size={16} /> Güncelleniyor...</> : <span>Şifreyi Güncelle</span>}
      </button>
    </form>
  );
}

export default function ResetPasswordPage() {
  return (
    <div className="fa-shell min-h-screen flex items-center justify-center px-4">
      <div className="fa-card w-full max-w-md mx-auto p-8">
        <div className="w-12 h-12 rounded-2xl grid place-items-center bg-gradient-to-br from-brand-500 to-brand-700 shadow-glow-brand mb-6">
          <Activity size={24} className="text-[#06281d]" strokeWidth={2.5} />
        </div>
        <h1 className="text-2xl font-semibold text-content tracking-tight mb-4">Şifre Sıfırla</h1>
        <Suspense fallback={<p className="text-content-muted">Yükleniyor...</p>}>
          <ResetPasswordForm />
        </Suspense>
      </div>
    </div>
  );
}
