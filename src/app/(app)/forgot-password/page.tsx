'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Activity } from 'lucide-react';
import { Spinner } from '@/components/ui';
import { useLanguage } from '@/components/LanguageProvider';

// Three languages, same as the login page (2026-09-08: this page was Turkish
// only, so a German-browser user saw a German login and a Turkish reset form).
const L = {
  tr: {
    title: 'Şifremi Unuttum', lead: 'Hesabınla ilişkili e-posta adresini gir; sana bir sıfırlama bağlantısı gönderelim.',
    email: 'E-posta Adresi', send: 'Sıfırlama Bağlantısı Gönder', sending: 'Gönderiliyor...',
    sent: 'Eğer bu e-posta kayıtlıysa, şifre sıfırlama bağlantısını gönderdik. Gelen kutunu (ve spam klasörünü) kontrol et. Bağlantı 1 saat geçerlidir.',
    back: '← Giriş sayfasına dön', error: 'Bir hata oluştu. Lütfen tekrar deneyin.',
  },
  en: {
    title: 'Forgot password', lead: 'Enter the email address linked to your account and we will send you a reset link.',
    email: 'Email address', send: 'Send reset link', sending: 'Sending...',
    sent: 'If this email is registered, we have sent a password reset link. Check your inbox (and spam folder). The link is valid for 1 hour.',
    back: '← Back to sign in', error: 'Something went wrong. Please try again.',
  },
  de: {
    title: 'Passwort vergessen', lead: 'Gib die E-Mail-Adresse deines Kontos ein; wir schicken dir einen Link zum Zurücksetzen.',
    email: 'E-Mail-Adresse', send: 'Link zum Zurücksetzen senden', sending: 'Wird gesendet...',
    sent: 'Falls diese E-Mail registriert ist, haben wir dir einen Link zum Zurücksetzen geschickt. Prüfe deinen Posteingang (und den Spam-Ordner). Der Link ist 1 Stunde gültig.',
    back: '← Zurück zur Anmeldung', error: 'Etwas ist schiefgelaufen. Bitte versuche es erneut.',
  },
} as const;

export default function ForgotPasswordPage() {
  const { lang } = useLanguage();
  const l = L[lang] || L.en;
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
        body: JSON.stringify({ email, lang }),
      });
      if (!res.ok) throw new Error();
      setSent(true);
    } catch {
      setError(l.error);
    }
    setLoading(false);
  }

  return (
    <div className="fa-shell min-h-screen flex items-center justify-center px-4">
      <div className="fa-card w-full max-w-md mx-auto p-8">
        <div className="w-12 h-12 rounded-2xl grid place-items-center bg-gradient-to-br from-brand-500 to-brand-700 shadow-glow-brand mb-6">
          <Activity size={24} className="text-[#06281d]" strokeWidth={2.5} />
        </div>
        <h1 className="text-2xl font-semibold text-content tracking-tight">{l.title}</h1>

        {sent ? (
          <div className="mt-4 space-y-4">
            <div className="rounded-xl border border-positive/30 bg-positive/10 p-4 text-positive">{l.sent}</div>
            <Link href="/login" className="block text-center text-brand-400 hover:text-brand-300 transition-colors">{l.back}</Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="mt-4 space-y-4">
            <p className="text-sm text-content-muted">{l.lead}</p>
            <div>
              <label className="block text-sm font-medium text-content-muted mb-2">{l.email}</label>
              <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@example.com" className="fa-input w-full" />
            </div>
            {error && <div className="p-4 rounded-xl bg-negative/10 border border-negative/30 text-negative text-sm">{error}</div>}
            <button type="submit" disabled={loading} className="fa-btn fa-btn-primary fa-btn-lg w-full">
              {loading ? <><Spinner size={16} /> {l.sending}</> : <span>{l.send}</span>}
            </button>
            <Link href="/login" className="block text-center text-sm text-content-muted hover:text-content transition-colors">{l.back}</Link>
          </form>
        )}
      </div>
    </div>
  );
}
