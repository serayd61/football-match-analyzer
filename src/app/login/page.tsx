'use client';

import { useState } from 'react';
import { signIn } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useLanguage } from '@/components/LanguageProvider';
import LanguageSelector from '@/components/LanguageSelector';
import CustomCursor from '@/components/CustomCursor';
import { FootballBall3D } from '@/components/Football3D';
import { motion } from 'framer-motion';

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
      title: 'Football Analytics Pro',
      subtitle: 'Yapay Zeka Destekli Profesyonel Futbol Analiz Platformu',
      login: 'Giriş Yap',
      register: 'Kayıt Ol',
      email: 'E-posta Adresi',
      password: 'Şifre',
      name: 'Ad Soyad',
      loginButton: 'Giriş Yap',
      registerButton: 'Hesap Oluştur',
      noAccount: 'Hesabınız yok mu?',
      hasAccount: 'Zaten hesabınız var mı?',
      forgotPassword: 'Şifremi Unuttum',
      or: 'veya',
      features: [
        '🤖 4 AI + 5 Heurist Agent ile Analiz',
        '📊 Detaylı İstatistik ve Form Analizi',
        '💰 Value Bet Tespiti',
        '🌍 50+ Lig Desteği',
      ],
      trusted: '10.000+ kullanıcı tarafından tercih ediliyor',
      errorInvalid: 'Geçersiz e-posta veya şifre',
      errorExists: 'Bu e-posta zaten kayıtlı',
      errorGeneral: 'Bir hata oluştu, tekrar deneyin',
    },
    en: {
      title: 'Football Analytics Pro',
      subtitle: 'AI-Powered Professional Football Analysis Platform',
      login: 'Sign In',
      register: 'Sign Up',
      email: 'Email Address',
      password: 'Password',
      name: 'Full Name',
      loginButton: 'Sign In',
      registerButton: 'Create Account',
      noAccount: "Don't have an account?",
      hasAccount: 'Already have an account?',
      forgotPassword: 'Forgot Password',
      or: 'or',
      features: [
        '🤖 Analysis with 4 AI + 5 Heurist Agents',
        '📊 Detailed Statistics & Form Analysis',
        '💰 Value Bet Detection',
        '🌍 50+ Leagues Supported',
      ],
      trusted: 'Trusted by 10,000+ users',
      errorInvalid: 'Invalid email or password',
      errorExists: 'This email is already registered',
      errorGeneral: 'An error occurred, please try again',
    },
    de: {
      title: 'Football Analytics Pro',
      subtitle: 'KI-gestützte Professionelle Fußball-Analyseplattform',
      login: 'Anmelden',
      register: 'Registrieren',
      email: 'E-Mail-Adresse',
      password: 'Passwort',
      name: 'Vollständiger Name',
      loginButton: 'Anmelden',
      registerButton: 'Konto erstellen',
      noAccount: 'Noch kein Konto?',
      hasAccount: 'Bereits ein Konto?',
      forgotPassword: 'Passwort vergessen',
      or: 'oder',
      features: [
        '🤖 Analyse mit 4 KI + 5 Heurist Agenten',
        '📊 Detaillierte Statistiken & Formanalyse',
        '💰 Value Bet Erkennung',
        '🌍 50+ Ligen unterstützt',
      ],
      trusted: 'Von über 10.000 Nutzern vertraut',
      errorInvalid: 'Ungültige E-Mail oder Passwort',
      errorExists: 'Diese E-Mail ist bereits registriert',
      errorGeneral: 'Ein Fehler ist aufgetreten, bitte erneut versuchen',
    },
  };

  const l = labels[lang] || labels.en;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      if (isLogin) {
        const result = await signIn('credentials', {
          email,
          password,
          redirect: false,
        });

        if (result?.error) {
          setError(l.errorInvalid);
        } else {
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
          const result = await signIn('credentials', {
            email,
            password,
            redirect: false,
          });

          if (result?.ok) {
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
    <div className="min-h-screen bg-black relative flex">
      <CustomCursor />
      
      {/* 3D Football Decorations */}
      <div className="fixed top-20 right-10 z-0 opacity-10 pointer-events-none">
        <FootballBall3D size={150} />
      </div>
      {/* Left Side - Branding */}
      <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden">
        {/* Background Pattern */}
        <div className="absolute inset-0 bg-gradient-to-br from-green-600/20 via-blue-600/20 to-purple-600/20"></div>
        <div className="absolute inset-0" style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%2322c55e' fill-opacity='0.08'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
        }}></div>
        
        {/* Content */}
        <div className="relative z-10 flex flex-col justify-center px-12 xl:px-20">
          {/* Logo */}
          <div className="flex items-center gap-3 mb-8">
            <div className="w-14 h-14 bg-gradient-to-br from-green-500 to-green-600 rounded-2xl flex items-center justify-center shadow-lg shadow-green-500/30">
              <span className="text-3xl">⚽</span>
            </div>
            <div>
              <h1 className="text-3xl font-bold text-white">{l.title}</h1>
              <div className="flex items-center gap-2 mt-1">
                <span className="px-2 py-0.5 bg-green-500/20 text-green-400 text-xs font-medium rounded-full">PRO</span>
                <span className="px-2 py-0.5 bg-purple-500/20 text-purple-400 text-xs font-medium rounded-full">AI-POWERED</span>
              </div>
            </div>
          </div>

          {/* Subtitle */}
          <p className="text-xl text-gray-300 mb-10 max-w-md leading-relaxed">
            {l.subtitle}
          </p>

          {/* Features */}
          <div className="space-y-4 mb-12">
            {l.features.map((feature, idx) => (
              <div key={idx} className="flex items-center gap-3 text-gray-300">
                <div className="w-6 h-6 bg-green-500/20 rounded-full flex items-center justify-center">
                  <svg className="w-4 h-4 text-green-500" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                </div>
                <span>{feature}</span>
              </div>
            ))}
          </div>

          {/* Trust Badge */}
          <div className="flex items-center gap-4">
            <div className="flex -space-x-3">
              {['🧑‍💼', '👨‍💻', '👩‍💼', '🧑‍💻', '👨‍💼'].map((emoji, idx) => (
                <div key={idx} className="w-10 h-10 bg-gray-700 rounded-full border-2 border-gray-800 flex items-center justify-center text-lg">
                  {emoji}
                </div>
              ))}
            </div>
            <div className="text-sm text-gray-400">
              <span className="text-green-400 font-semibold">★★★★★</span>
              <br />
              {l.trusted}
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-3 gap-6 mt-12 pt-8 border-t border-gray-700/50">
            <div>
              <div className="text-3xl font-bold text-white">50+</div>
              <div className="text-sm text-gray-400">{lang === 'tr' ? 'Lig' : lang === 'de' ? 'Ligen' : 'Leagues'}</div>
            </div>
            <div>
              <div className="text-3xl font-bold text-white">9</div>
              <div className="text-sm text-gray-400">{lang === 'tr' ? 'AI Model' : lang === 'de' ? 'KI-Modelle' : 'AI Models'}</div>
            </div>
            <div>
              <div className="text-3xl font-bold text-white">85%+</div>
              <div className="text-sm text-gray-400">{lang === 'tr' ? 'Doğruluk' : lang === 'de' ? 'Genauigkeit' : 'Accuracy'}</div>
            </div>
          </div>
        </div>
      </div>

      {/* Right Side - Form */}
      <div className="w-full lg:w-1/2 flex flex-col">
        {/* Language Selector */}
        <div className="flex justify-end p-6">
          <LanguageSelector />
        </div>

        {/* Form Container */}
        <div className="flex-1 flex items-center justify-center px-6 pb-12">
          <div className="w-full max-w-md">
            {/* Mobile Logo */}
            <div className="lg:hidden text-center mb-8">
              <div className="w-16 h-16 bg-gradient-to-br from-green-500 to-green-600 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg shadow-green-500/30">
                <span className="text-4xl">⚽</span>
              </div>
              <h1 className="text-2xl font-bold text-white">{l.title}</h1>
              <p className="text-gray-400 text-sm mt-2">{l.subtitle}</p>
            </div>

            {/* Tabs */}
            <div className="flex bg-gray-800/50 rounded-xl p-1 mb-8">
              <button
                onClick={() => setIsLogin(true)}
                className={`flex-1 py-3 px-4 rounded-lg font-medium transition-all ${
                  isLogin
                    ? 'bg-gradient-to-r from-green-600 to-green-500 text-white shadow-lg'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                {l.login}
              </button>
              <button
                onClick={() => setIsLogin(false)}
                className={`flex-1 py-3 px-4 rounded-lg font-medium transition-all ${
                  !isLogin
                    ? 'bg-gradient-to-r from-green-600 to-green-500 text-white shadow-lg'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                {l.register}
              </button>
            </div>

            {/* Error Message */}
            {error && (
              <div className="mb-6 p-4 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400 text-sm flex items-center gap-2">
                <svg className="w-5 h-5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
                {error}
              </div>
            )}

            {/* Form */}
            <form onSubmit={handleSubmit} className="space-y-5">
              {!isLogin && (
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">{l.name}</label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required={!isLogin}
                    className="w-full px-4 py-3 bg-gray-800/50 border border-gray-700 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-green-500/50 focus:border-green-500 transition-all"
                    placeholder="John Doe"
                  />
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">{l.email}</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="w-full px-4 py-3 bg-gray-800/50 border border-gray-700 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-green-500/50 focus:border-green-500 transition-all"
                  placeholder="you@example.com"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">{l.password}</label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="w-full px-4 py-3 bg-gray-800/50 border border-gray-700 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-green-500/50 focus:border-green-500 transition-all"
                  placeholder="••••••••"
                />
              </div>

              {isLogin && (
                <div className="flex justify-end">
                  <button type="button" className="text-sm text-green-400 hover:text-green-300 transition-colors">
                    {l.forgotPassword}
                  </button>
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full py-4 bg-gradient-to-r from-green-600 to-green-500 hover:from-green-500 hover:to-green-400 text-white font-semibold rounded-xl shadow-lg shadow-green-500/30 hover:shadow-green-500/40 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {loading ? (
                  <>
                    <svg className="animate-spin w-5 h-5" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    <span>{lang === 'tr' ? 'İşleniyor...' : lang === 'de' ? 'Verarbeitung...' : 'Processing...'}</span>
                  </>
                ) : (
                  <span>{isLogin ? l.loginButton : l.registerButton}</span>
                )}
              </button>
            </form>

            {/* Divider */}
            <div className="flex items-center gap-4 my-8">
              <div className="flex-1 h-px bg-gray-700"></div>
              <span className="text-gray-500 text-sm">{l.or}</span>
              <div className="flex-1 h-px bg-gray-700"></div>
            </div>

            {/* Social Login */}
            <div className="grid grid-cols-2 gap-4">
              <button
                type="button"
                onClick={() => signIn('google', { callbackUrl: '/dashboard' })}
                className="flex items-center justify-center gap-2 py-3 bg-gray-800/50 border border-gray-700 rounded-xl text-gray-300 hover:bg-gray-700/50 hover:border-gray-600 transition-all"
              >
                <svg className="w-5 h-5" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                </svg>
                <span>Google</span>
              </button>
              <button
                type="button"
                className="flex items-center justify-center gap-2 py-3 bg-gray-800/50 border border-gray-700 rounded-xl text-gray-300 hover:bg-gray-700/50 hover:border-gray-600 transition-all"
              >
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
                </svg>
                <span>GitHub</span>
              </button>
            </div>

            {/* Switch Form */}
            <p className="text-center text-gray-400 mt-8">
              {isLogin ? l.noAccount : l.hasAccount}{' '}
              <button
                type="button"
                onClick={() => setIsLogin(!isLogin)}
                className="text-green-400 hover:text-green-300 font-medium transition-colors"
              >
                {isLogin ? l.register : l.login}
              </button>
            </p>

            {/* Footer */}
            <div className="text-center text-gray-500 text-xs mt-8">
              © 2024 Football Analytics Pro. All rights reserved.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
