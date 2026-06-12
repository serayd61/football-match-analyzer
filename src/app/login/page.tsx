'use client';

import { useState } from 'react';
import { signIn } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { track } from '@/lib/analytics';
import Link from 'next/link';
import { Activity, Check, Star, AlertCircle } from 'lucide-react';
import { useLanguage } from '@/components/LanguageProvider';
import LanguageSelector from '@/components/LanguageSelector';
import { Spinner } from '@/components/ui';

export default function LoginPage() {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const router = useRouter();
  const { lang } = useLanguage();

  const labels = {
    tr: {
      title: 'Football Analytics Pro', subtitle: 'Yapay Zeka Destekli Profesyonel Futbol Analiz Platformu',
      login: 'Giriş Yap', register: 'Kayıt Ol', email: 'E-posta Adresi', password: 'Şifre', name: 'Ad Soyad',
      loginButton: 'Giriş Yap', registerButton: 'Hesap Oluştur', noAccount: 'Hesabınız yok mu?', hasAccount: 'Zaten hesabınız var mı?',
      forgotPassword: 'Şifremi Unuttum', or: 'veya',
      features: ['📊 İstatistik motoru — kalibre olasılıklar', '🧠 Match Intelligence — haber özeti + maç önizlemesi', '💰 Value Bet tespiti', '🌍 50+ lig · 3 dil (TR · EN · DE)'],
      trusted: '10.000+ kullanıcı tarafından tercih ediliyor',
      errorInvalid: 'Geçersiz e-posta veya şifre', errorExists: 'Bu e-posta zaten kayıtlı', errorGeneral: 'Bir hata oluştu, tekrar deneyin',
      processing: 'İşleniyor...', leagues: 'Lig', languages: 'Dil (TR·EN·DE)', accuracy: 'Doğruluk',
    },
    en: {
      title: 'Football Analytics Pro', subtitle: 'AI-Powered Professional Football Analysis Platform',
      login: 'Sign In', register: 'Sign Up', email: 'Email Address', password: 'Password', name: 'Full Name',
      loginButton: 'Sign In', registerButton: 'Create Account', noAccount: "Don't have an account?", hasAccount: 'Already have an account?',
      forgotPassword: 'Forgot Password', or: 'or',
      features: ['📊 Statistical engine — calibrated probabilities', '🧠 Match Intelligence — news digest + match preview', '💰 Value bet detection', '🌍 50+ leagues · 3 languages (TR · EN · DE)'],
      trusted: 'Trusted by 10,000+ users',
      errorInvalid: 'Invalid email or password', errorExists: 'This email is already registered', errorGeneral: 'An error occurred, please try again',
      processing: 'Processing...', leagues: 'Leagues', languages: 'Languages', accuracy: 'Accuracy',
    },
    de: {
      title: 'Football Analytics Pro', subtitle: 'KI-gestützte Professionelle Fußball-Analyseplattform',
      login: 'Anmelden', register: 'Registrieren', email: 'E-Mail-Adresse', password: 'Passwort', name: 'Vollständiger Name',
      loginButton: 'Anmelden', registerButton: 'Konto erstellen', noAccount: 'Noch kein Konto?', hasAccount: 'Bereits ein Konto?',
      forgotPassword: 'Passwort vergessen', or: 'oder',
      features: ['📊 Statistik-Engine — kalibrierte Wahrscheinlichkeiten', '🧠 Match Intelligence — Nachrichten + Spielvorschau', '💰 Value-Bet-Erkennung', '🌍 50+ Ligen · 3 Sprachen (TR · EN · DE)'],
      trusted: 'Von über 10.000 Nutzern vertraut',
      errorInvalid: 'Ungültige E-Mail oder Passwort', errorExists: 'Diese E-Mail ist bereits registriert', errorGeneral: 'Ein Fehler ist aufgetreten, bitte erneut versuchen',
      processing: 'Verarbeitung...', leagues: 'Ligen', languages: 'Sprachen', accuracy: 'Genauigkeit',
    },
  };

  const l = labels[lang] || labels.en;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      if (isLogin) {
        const result = await signIn('credentials', { email, password, redirect: false });
        if (result?.error) {
          setError(l.errorInvalid);
        } else {
          track.login('credentials');
          router.push('/dashboard');
        }
      } else {
        const res = await fetch('/api/auth/register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password, name }),
        });
        const data = await res.json();
        if (!res.ok) {
          setError(data.error || l.errorGeneral);
        } else {
          const result = await signIn('credentials', { email, password, redirect: false });
          if (result?.ok) {
            track.signUp('credentials');
            router.push('/dashboard');
          }
        }
      }
    } catch (err) {
      setError(l.errorGeneral);
    }
    setLoading(false);
  };

  return (
    <div className="fa-shell min-h-screen flex">
      {/* Left — branding */}
      <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden border-r border-line">
        <div className="absolute inset-0 bg-grid-faint [background-size:40px_40px] opacity-50" />
        <div className="absolute -top-24 -left-16 w-96 h-96 rounded-full pointer-events-none" style={{ background: 'radial-gradient(circle, rgba(16,185,129,0.14), transparent 65%)' }} />
        <div className="relative z-10 flex flex-col justify-center px-12 xl:px-20">
          <div className="flex items-center gap-3 mb-8">
            <div className="w-12 h-12 rounded-2xl grid place-items-center bg-gradient-to-br from-brand-500 to-brand-700 shadow-glow-brand">
              <Activity size={24} className="text-[#06281d]" strokeWidth={2.5} />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-content tracking-tight">{l.title}</h1>
              <div className="flex items-center gap-2 mt-1">
                <span className="px-2 py-0.5 rounded-full bg-brand-500/15 text-brand-300 text-[11px] font-semibold border border-brand-500/25">PRO</span>
                <span className="px-2 py-0.5 rounded-full bg-sky-500/15 text-sky-400 text-[11px] font-semibold border border-sky-500/25">AI-POWERED</span>
              </div>
            </div>
          </div>

          <p className="text-lg text-content-muted mb-10 max-w-md leading-relaxed">{l.subtitle}</p>

          <div className="space-y-3.5 mb-12">
            {l.features.map((feature, idx) => (
              <div key={idx} className="flex items-center gap-3 text-content-muted">
                <span className="w-6 h-6 rounded-full bg-brand-500/15 grid place-items-center shrink-0"><Check size={14} className="text-brand-400" /></span>
                <span className="text-[15px]">{feature}</span>
              </div>
            ))}
          </div>

          <div className="flex items-center gap-4">
            <div className="flex -space-x-2.5">
              {['🧑‍💼', '👨‍💻', '👩‍💼', '🧑‍💻', '👨‍💼'].map((emoji, idx) => (
                <div key={idx} className="w-9 h-9 rounded-full bg-surface-3 border-2 border-surface-0 grid place-items-center text-base">{emoji}</div>
              ))}
            </div>
            <div className="text-sm text-content-subtle">
              <div className="flex text-amber-400">{Array.from({ length: 5 }).map((_, i) => <Star key={i} size={12} fill="currentColor" />)}</div>
              {l.trusted}
            </div>
          </div>

          <div className="grid grid-cols-3 gap-6 mt-12 pt-8 border-t border-line">
            <div><div className="text-2xl font-bold text-content">50+</div><div className="text-sm text-content-subtle">{l.leagues}</div></div>
            <div><div className="text-2xl font-bold text-content">3</div><div className="text-sm text-content-subtle">{l.languages}</div></div>
            <div><div className="text-2xl font-bold text-content">85%+</div><div className="text-sm text-content-subtle">{l.accuracy}</div></div>
          </div>
        </div>
      </div>

      {/* Right — form */}
      <div className="w-full lg:w-1/2 flex flex-col">
        <div className="flex justify-end p-6"><LanguageSelector /></div>
        <div className="flex-1 flex items-center justify-center px-6 pb-12">
          <div className="w-full max-w-md">
            <div className="lg:hidden text-center mb-8">
              <div className="w-14 h-14 rounded-2xl grid place-items-center mx-auto mb-4 bg-gradient-to-br from-brand-500 to-brand-700 shadow-glow-brand">
                <Activity size={26} className="text-[#06281d]" strokeWidth={2.5} />
              </div>
              <h1 className="text-xl font-bold text-content">{l.title}</h1>
              <p className="text-content-subtle text-sm mt-2">{l.subtitle}</p>
            </div>

            {/* Tabs */}
            <div className="flex p-1 rounded-xl bg-surface-1 border border-line mb-8">
              <button onClick={() => setIsLogin(true)} className={`flex-1 py-2.5 rounded-lg text-sm font-semibold transition-colors ${isLogin ? 'bg-brand-500 text-[#06281d]' : 'text-content-muted hover:text-content'}`}>{l.login}</button>
              <button onClick={() => setIsLogin(false)} className={`flex-1 py-2.5 rounded-lg text-sm font-semibold transition-colors ${!isLogin ? 'bg-brand-500 text-[#06281d]' : 'text-content-muted hover:text-content'}`}>{l.register}</button>
            </div>

            {error && (
              <div className="mb-6 p-4 rounded-xl bg-negative/10 border border-negative/30 text-negative text-sm flex items-center gap-2">
                <AlertCircle size={18} className="shrink-0" /> {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              {!isLogin && (
                <div>
                  <label className="block text-sm font-medium text-content-muted mb-2">{l.name}</label>
                  <input type="text" value={name} onChange={(e) => setName(e.target.value)} required={!isLogin} className="fa-input w-full" placeholder="John Doe" />
                </div>
              )}
              <div>
                <label className="block text-sm font-medium text-content-muted mb-2">{l.email}</label>
                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required className="fa-input w-full" placeholder="you@example.com" />
              </div>
              <div>
                <label className="block text-sm font-medium text-content-muted mb-2">{l.password}</label>
                <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required className="fa-input w-full" placeholder="••••••••" />
              </div>

              {isLogin && (
                <div className="flex justify-end">
                  <button type="button" onClick={() => router.push('/forgot-password')} className="text-sm text-brand-400 hover:text-brand-300 transition-colors">{l.forgotPassword}</button>
                </div>
              )}

              <button type="submit" disabled={loading} className="fa-btn fa-btn-primary fa-btn-lg w-full">
                {loading ? <><Spinner size={16} /> {l.processing}</> : <span>{isLogin ? l.loginButton : l.registerButton}</span>}
              </button>
            </form>

            <div className="flex items-center gap-4 my-7">
              <div className="flex-1 h-px bg-line" />
              <span className="text-content-subtle text-sm">{l.or}</span>
              <div className="flex-1 h-px bg-line" />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <button type="button" onClick={() => { track.login('google'); signIn('google', { callbackUrl: '/dashboard' }); }} className="fa-btn fa-btn-secondary">
                <svg className="w-4 h-4" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                </svg>
                Google
              </button>
              <button type="button" className="fa-btn fa-btn-secondary">
                <svg className="w-4 h-4 text-content" fill="currentColor" viewBox="0 0 24 24"><path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" /></svg>
                GitHub
              </button>
            </div>

            <p className="text-center text-content-muted mt-7 text-sm">
              {isLogin ? l.noAccount : l.hasAccount}{' '}
              <button type="button" onClick={() => setIsLogin(!isLogin)} className="text-brand-400 hover:text-brand-300 font-medium transition-colors">
                {isLogin ? l.register : l.login}
              </button>
            </p>

            <div className="text-center text-content-subtle text-xs mt-8">© 2026 Football Analytics Pro. All rights reserved.</div>
          </div>
        </div>
      </div>
    </div>
  );
}
