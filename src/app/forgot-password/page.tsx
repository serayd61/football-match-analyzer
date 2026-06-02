'use client';

import { useState } from 'react';
import Link from 'next/link';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      if (!res.ok) throw new Error();
      setSent(true);
    } catch {
      setError('Bir hata oluştu. Lütfen tekrar deneyin.');
    }
    setLoading(false);
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-gradient-to-b from-gray-950 via-gray-900 to-gray-950 px-4">
      <div className="w-full max-w-md rounded-2xl border border-white/10 bg-gray-900/60 p-8">
        <h1 className="text-2xl font-bold text-white">Şifremi Unuttum</h1>

        {sent ? (
          <div className="mt-4 space-y-4">
            <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-emerald-300">
              Eğer bu e-posta kayıtlıysa, şifre sıfırlama bağlantısını gönderdik. Gelen kutunu (ve spam
              klasörünü) kontrol et. Bağlantı 1 saat geçerlidir.
            </div>
            <Link href="/login" className="block text-center text-green-400 hover:text-green-300">
              ← Giriş sayfasına dön
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="mt-4 space-y-4">
            <p className="text-sm text-gray-400">
              Hesabınla ilişkili e-posta adresini gir; sana bir sıfırlama bağlantısı gönderelim.
            </p>
            <div>
              <label className="block text-sm text-gray-300 mb-1">E-posta Adresi</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="ornek@email.com"
                className="w-full px-4 py-3 bg-gray-800/50 border border-gray-700 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-green-500/50 focus:border-green-500 transition-all"
              />
            </div>
            {error && <p className="text-sm text-rose-400">{error}</p>}
            <button
              type="submit"
              disabled={loading}
              className="w-full py-4 bg-gradient-to-r from-green-600 to-green-500 hover:from-green-500 hover:to-green-400 text-white font-semibold rounded-xl transition-all disabled:opacity-50"
            >
              {loading ? 'Gönderiliyor...' : 'Sıfırlama Bağlantısı Gönder'}
            </button>
            <Link href="/login" className="block text-center text-sm text-gray-400 hover:text-white">
              ← Giriş sayfasına dön
            </Link>
          </form>
        )}
      </div>
    </main>
  );
}
