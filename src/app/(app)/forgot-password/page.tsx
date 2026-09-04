'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Activity } from 'lucide-react';
import { Spinner } from '@/components/ui';

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
    <div className="fa-shell min-h-screen flex items-center justify-center px-4">
      <div className="fa-card w-full max-w-md mx-auto p-8">
        <div className="w-12 h-12 rounded-2xl grid place-items-center bg-gradient-to-br from-brand-500 to-brand-700 shadow-glow-brand mb-6">
          <Activity size={24} className="text-[#06281d]" strokeWidth={2.5} />
        </div>
        <h1 className="text-2xl font-semibold text-content tracking-tight">Şifremi Unuttum</h1>

        {sent ? (
          <div className="mt-4 space-y-4">
            <div className="rounded-xl border border-positive/30 bg-positive/10 p-4 text-positive">
              Eğer bu e-posta kayıtlıysa, şifre sıfırlama bağlantısını gönderdik. Gelen kutunu (ve spam
              klasörünü) kontrol et. Bağlantı 1 saat geçerlidir.
            </div>
            <Link href="/login" className="block text-center text-brand-400 hover:text-brand-300 transition-colors">
              ← Giriş sayfasına dön
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="mt-4 space-y-4">
            <p className="text-sm text-content-muted">
              Hesabınla ilişkili e-posta adresini gir; sana bir sıfırlama bağlantısı gönderelim.
            </p>
            <div>
              <label className="block text-sm font-medium text-content-muted mb-2">E-posta Adresi</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="ornek@email.com"
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
              {loading ? <><Spinner size={16} /> Gönderiliyor...</> : <span>Sıfırlama Bağlantısı Gönder</span>}
            </button>
            <Link href="/login" className="block text-center text-sm text-content-muted hover:text-content transition-colors">
              ← Giriş sayfasına dön
            </Link>
          </form>
        )}
      </div>
    </div>
  );
}
