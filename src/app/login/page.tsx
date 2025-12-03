'use client';

import { useState, Suspense } from 'react';
import { signIn } from 'next-auth/react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useLanguage } from '@/components/LanguageProvider';
import LanguageSelector from '@/components/LanguageSelector';

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get('callbackUrl') || '/dashboard';
  const error = searchParams.get('error');
  const paymentCancelled = searchParams.get('payment') === 'cancelled';
  const { t } = useLanguage();

  const [isLogin, setIsLogin] = useState(true);
  const [loading, setLoading] = useState(false);
  const [formError, setFormError] = useState('');
  const [formData, setFormData] = useState({ email: '', password: '', name: '' });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setFormError('');

    try {
      if (isLogin) {
        const result = await signIn('credentials', {
          email: formData.email,
          password: formData.password,
          redirect: false,
        });

        if (result?.error) {
          setFormError(result.error);
        } else {
          router.push(callbackUrl);
        }
      } else {
        const res = await fetch('/api/auth/register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(formData),
        });

        const data = await res.json();

        if (!res.ok) {
          setFormError(data.error);
        } else if (data.checkoutUrl) {
          window.location.href = data.checkoutUrl;
        }
      }
    } catch (err) {
      setFormError(t('error'));
    }

    setLoading(false);
  };

  return (
    <div className="max-w-md w-full">
      <div className="text-center mb-8">
        <h1 className="text-4xl font-bold text-white mb-2">⚽ {t('appName')}</h1>
        <p className="text-gray-400">{t('appDesc')}</p>
      </div>

      <div className="bg-gray-800 rounded-2xl p-8 shadow-xl">
        <div className="flex mb-6 bg-gray-700 rounded-lg p-1">
          <button
            onClick={() => setIsLogin(true)}
            className={`flex-1 py-2 rounded-lg font-medium transition-all ${isLogin ? 'bg-green-600 text-white' : 'text-gray-400'}`}
          >
            {t('loginTitle')}
          </button>
          <button
            onClick={() => setIsLogin(false)}
            className={`flex-1 py-2 rounded-lg font-medium transition-all ${!isLogin ? 'bg-green-600 text-white' : 'text-gray-400'}`}
          >
            {t('registerTitle')}
          </button>
        </div>

        {paymentCancelled && (
          <div className="mb-4 p-3 bg-yellow-500/20 border border-yellow-500 rounded-lg text-yellow-400 text-sm">
            {t('paymentCancelled')}
          </div>
        )}

        {(error || formError) && (
          <div className="mb-4 p-3 bg-red-500/20 border border-red-500 rounded-lg text-red-400 text-sm">
            {error === 'CredentialsSignin' ? t('invalidCredentials') : formError || error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {!isLogin && (
            <div>
              <label className="block text-gray-300 text-sm mb-1">{t('name')}</label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:border-green-500"
                placeholder={t('name')}
              />
            </div>
          )}

          <div>
            <label className="block text-gray-300 text-sm mb-1">{t('email')}</label>
            <input
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:border-green-500"
              placeholder="email@example.com"
              required
            />
          </div>

          <div>
            <label className="block text-gray-300 text-sm mb-1">{t('password')}</label>
            <input
              type="password"
              value={formData.password}
              onChange={(e) => setFormData({ ...formData, password: e.target.value })}
              className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:border-green-500"
              placeholder="••••••••"
              minLength={8}
              required
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 bg-green-600 hover:bg-green-500 text-white font-bold rounded-lg transition-all disabled:opacity-50"
          >
            {loading ? t('loading') : isLogin ? t('loginButton') : t('registerButton')}
          </button>
        </form>

        {!isLogin && (
          <div className="mt-6 p-4 bg-green-500/10 border border-green-500/30 rounded-lg">
            <div className="flex items-center gap-2 text-green-400 font-medium mb-1">
              🎁 {t('trialBadge')}
            </div>
            <p className="text-gray-400 text-sm">{t('trialInfo')}</p>
          </div>
        )}
      </div>

      <div className="text-center mt-6 text-gray-500 text-sm">
        <Link href="/" className="hover:text-gray-300">{t('backToHome')}</Link>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 flex items-center justify-center p-4">
      <div className="absolute top-4 right-4">
        <LanguageSelector />
      </div>
      <Suspense fallback={
        <div className="text-white text-center">
          <div className="animate-spin w-8 h-8 border-4 border-green-500 border-t-transparent rounded-full mx-auto mb-4"></div>
        </div>
      }>
        <LoginForm />
      </Suspense>
    </div>
  );
}
