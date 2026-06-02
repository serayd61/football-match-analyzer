'use client';

import { Suspense, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';

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
      <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-4 text-rose-300">
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
        <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-emerald-300">
          Şifren güncellendi! Giriş sayfasına yönlendiriliyorsun...
        </div>
        <Link href="/login" className="block text-center text-green-400 hover:text-green-300">
          Hemen giriş yap →
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <p className="text-sm text-gray-400">Yeni şifreni belirle.</p>
      <div>
        <label className="block text-sm text-gray-300 mb-1">Yeni Şifre</label>
        <input
          type="password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="••••••••"
          className="w-full px-4 py-3 bg-gray-800/50 border border-gray-700 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-green-500/50 focus:border-green-500 transition-all"
        />
      </div>
      <div>
        <label className="block text-sm text-gray-300 mb-1">Yeni Şifre (Tekrar)</label>
        <input
          type="password"
          required
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          placeholder="••••••••"
          className="w-full px-4 py-3 bg-gray-800/50 border border-gray-700 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-green-500/50 focus:border-green-500 transition-all"
        />
      </div>
      {error && <p className="text-sm text-rose-400">{error}</p>}
      <button
        type="submit"
        disabled={loading}
        className="w-full py-4 bg-gradient-to-r from-green-600 to-green-500 hover:from-green-500 hover:to-green-400 text-white font-semibold rounded-xl transition-all disabled:opacity-50"
      >
        {loading ? 'Güncelleniyor...' : 'Şifreyi Güncelle'}
      </button>
    </form>
  );
}

export default function ResetPasswordPage() {
  return (
    <main className="min-h-screen flex items-center justify-center bg-gradient-to-b from-gray-950 via-gray-900 to-gray-950 px-4">
      <div className="w-full max-w-md rounded-2xl border border-white/10 bg-gray-900/60 p-8">
        <h1 className="text-2xl font-bold text-white mb-4">Şifre Sıfırla</h1>
        <Suspense fallback={<p className="text-gray-400">Yükleniyor...</p>}>
          <ResetPasswordForm />
        </Suspense>
      </div>
    </main>
  );
}
