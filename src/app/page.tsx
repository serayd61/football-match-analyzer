'use client';

import { useSession } from 'next-auth/react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useLanguage } from '@/components/LanguageProvider';
import LanguageSelector from '@/components/LanguageSelector';

const stats = {
  tr: {
    successRate: '78%',
    successLabel: 'Başarı Oranı',
    analyzedMatches: '15,000+',
    analyzedLabel: 'Analiz Edilen Maç',
    activeUsers: '2,500+',
    usersLabel: 'Aktif Kullanıcı',
    leagues: '27',
    leaguesLabel: 'Avrupa Ligi',
  },
  en: {
    successRate: '78%',
    successLabel: 'Success Rate',
    analyzedMatches: '15,000+',
    analyzedLabel: 'Matches Analyzed',
    activeUsers: '2,500+',
    usersLabel: 'Active Users',
    leagues: '27',
    leaguesLabel: 'European Leagues',
  },
  de: {
    successRate: '78%',
    successLabel: 'Erfolgsquote',
    analyzedMatches: '15,000+',
    analyzedLabel: 'Analysierte Spiele',
    activeUsers: '2,500+',
    usersLabel: 'Aktive Nutzer',
    leagues: '27',
    leaguesLabel: 'Europäische Ligen',
  },
};

const betTypes = {
  tr: [
    { icon: '⚽', name: 'Maç Sonucu (1X2)', desc: 'Ev sahibi, beraberlik veya deplasman galibiyeti', rate: '82%' },
    { icon: '🎯', name: 'Üst/Alt 2.5 Gol', desc: '2.5 gol üstü veya altı tahmini', rate: '76%' },
    { icon: '🔥', name: 'Karşılıklı Gol (KG)', desc: 'Her iki takım da gol atar mı?', rate: '74%' },
    { icon: '📊', name: 'Çifte Şans', desc: '1X, 12, X2 kombinasyonları', rate: '85%' },
    { icon: '🏆', name: 'Doğru Skor', desc: 'Maçın tam skorunu tahmin et', rate: '45%' },
    { icon: '⚡', name: 'İlk Yarı Sonucu', desc: 'İlk yarı galibini tahmin et', rate: '71%' },
  ],
  en: [
    { icon: '⚽', name: 'Match Result (1X2)', desc: 'Home win, draw or away win', rate: '82%' },
    { icon: '🎯', name: 'Over/Under 2.5 Goals', desc: 'Over or under 2.5 goals prediction', rate: '76%' },
    { icon: '🔥', name: 'Both Teams to Score', desc: 'Will both teams score?', rate: '74%' },
    { icon: '📊', name: 'Double Chance', desc: '1X, 12, X2 combinations', rate: '85%' },
    { icon: '🏆', name: 'Correct Score', desc: 'Predict the exact score', rate: '45%' },
    { icon: '⚡', name: 'Half Time Result', desc: 'Predict the first half winner', rate: '71%' },
  ],
  de: [
    { icon: '⚽', name: 'Spielergebnis (1X2)', desc: 'Heimsieg, Unentschieden oder Auswärtssieg', rate: '82%' },
    { icon: '🎯', name: 'Über/Unter 2.5 Tore', desc: 'Über oder unter 2.5 Tore Vorhersage', rate: '76%' },
    { icon: '🔥', name: 'Beide Teams treffen', desc: 'Werden beide Teams ein Tor erzielen?', rate: '74%' },
    { icon: '📊', name: 'Doppelte Chance', desc: '1X, 12, X2 Kombinationen', rate: '85%' },
    { icon: '🏆', name: 'Genaues Ergebnis', desc: 'Das genaue Ergebnis vorhersagen', rate: '45%' },
    { icon: '⚡', name: 'Halbzeitergebnis', desc: 'Den Gewinner der ersten Halbzeit vorhersagen', rate: '71%' },
  ],
};

const aiModels = [
  { name: 'Claude', company: 'Anthropic', color: 'from-orange-500 to-amber-500', icon: '🧠' },
  { name: 'GPT-4', company: 'OpenAI', color: 'from-green-500 to-emerald-500', icon: '🤖' },
  { name: 'Gemini', company: 'Google', color: 'from-blue-500 to-cyan-500', icon: '💎' },
];

const liveExamples = {
  tr: {
    title: 'Canlı AI Analiz Örneği',
    match: 'Manchester City vs Arsenal',
    predictions: [
      { type: 'Maç Sonucu', prediction: 'Manchester City (1)', confidence: 68 },
      { type: 'Üst/Alt 2.5', prediction: 'Üst', confidence: 72 },
      { type: 'KG Var/Yok', prediction: 'Var', confidence: 65 },
    ],
    consensus: '3 AI modeli de Manchester City galibiyetinde hemfikir',
  },
  en: {
    title: 'Live AI Analysis Example',
    match: 'Manchester City vs Arsenal',
    predictions: [
      { type: 'Match Result', prediction: 'Manchester City (1)', confidence: 68 },
      { type: 'Over/Under 2.5', prediction: 'Over', confidence: 72 },
      { type: 'BTTS', prediction: 'Yes', confidence: 65 },
    ],
    consensus: 'All 3 AI models agree on Manchester City win',
  },
  de: {
    title: 'Live-KI-Analyse Beispiel',
    match: 'Manchester City vs Arsenal',
    predictions: [
      { type: 'Spielergebnis', prediction: 'Manchester City (1)', confidence: 68 },
      { type: 'Über/Unter 2.5', prediction: 'Über', confidence: 72 },
      { type: 'Beide treffen', prediction: 'Ja', confidence: 65 },
    ],
    consensus: 'Alle 3 KI-Modelle sind sich einig: Manchester City gewinnt',
  },
};

export default function LandingPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const { t, lang } = useLanguage();
  const [animatedStats, setAnimatedStats] = useState({ rate: 0, matches: 0, users: 0 });

  useEffect(() => {
    if (session) {
      router.push('/dashboard');
    }
  }, [session, router]);

  useEffect(() => {
    // Animate stats on load
    const timer = setTimeout(() => {
      setAnimatedStats({ rate: 78, matches: 15000, users: 2500 });
    }, 500);
    return () => clearTimeout(timer);
  }, []);

  if (status === 'loading') {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="animate-spin w-12 h-12 border-4 border-green-500 border-t-transparent rounded-full"></div>
      </div>
    );
  }

  const currentStats = stats[lang];
  const currentBetTypes = betTypes[lang];
  const currentLiveExample = liveExamples[lang];

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900">
      {/* Navigation */}
      <nav className="flex items-center justify-between px-6 py-4 max-w-7xl mx-auto">
        <div className="text-2xl font-bold text-white">⚽ {t('appName')}</div>
        <div className="flex items-center gap-4">
          <LanguageSelector />
          <Link href="/pricing" className="text-gray-300 hover:text-white">{t('pricing')}</Link>
          <Link href="/login" className="px-4 py-2 bg-green-600 hover:bg-green-500 text-white rounded-lg font-medium">
            {t('login')}
          </Link>
        </div>
      </nav>

      {/* Hero Section */}
      <div className="max-w-7xl mx-auto px-6 py-16 text-center">
        <div className="inline-flex items-center gap-2 px-4 py-2 bg-green-500/20 border border-green-500/30 rounded-full text-green-400 mb-6 animate-pulse">
          🎁 {t('trialBadge')}
        </div>
        
        <h1 className="text-5xl md:text-7xl font-bold text-white mb-6">
          {t('heroTitle')}<br />
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-green-400 to-emerald-500">
            {t('heroTitleHighlight')}
          </span>
        </h1>
        
        <p className="text-xl text-gray-400 mb-8 max-w-3xl mx-auto">
          {t('heroDesc')}
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-12">
          <Link href="/login" className="px-8 py-4 bg-gradient-to-r from-green-600 to-emerald-500 hover:from-green-500 hover:to-emerald-400 text-white text-lg font-bold rounded-xl shadow-lg shadow-green-500/25 transition-all transform hover:scale-105">
            {t('startFree')} →
          </Link>
          <Link href="/pricing" className="px-8 py-4 bg-gray-700 hover:bg-gray-600 text-white text-lg rounded-xl transition-all">
            {t('seePricing')}
          </Link>
        </div>

        {/* Stats Bar */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 max-w-4xl mx-auto mb-16">
          <div className="bg-gray-800/50 backdrop-blur rounded-2xl p-6 border border-gray-700">
            <div className="text-4xl font-bold text-green-400 mb-1">{currentStats.successRate}</div>
            <div className="text-gray-400 text-sm">{currentStats.successLabel}</div>
          </div>
          <div className="bg-gray-800/50 backdrop-blur rounded-2xl p-6 border border-gray-700">
            <div className="text-4xl font-bold text-blue-400 mb-1">{currentStats.analyzedMatches}</div>
            <div className="text-gray-400 text-sm">{currentStats.analyzedLabel}</div>
          </div>
          <div className="bg-gray-800/50 backdrop-blur rounded-2xl p-6 border border-gray-700">
            <div className="text-4xl font-bold text-purple-400 mb-1">{currentStats.activeUsers}</div>
            <div className="text-gray-400 text-sm">{currentStats.usersLabel}</div>
          </div>
          <div className="bg-gray-800/50 backdrop-blur rounded-2xl p-6 border border-gray-700">
            <div className="text-4xl font-bold text-yellow-400 mb-1">{currentStats.leagues}</div>
            <div className="text-gray-400 text-sm">{currentStats.leaguesLabel}</div>
          </div>
        </div>
      </div>

      {/* AI Models Section */}
      <div className="py-16 px-6 bg-gray-800/30">
        <div className="max-w-7xl mx-auto">
          <h2 className="text-3xl md:text-4xl font-bold text-white text-center mb-4">
            🤖 {lang === 'tr' ? '3 Yapay Zeka, 1 Güçlü Tahmin' : lang === 'de' ? '3 KI-Modelle, 1 Starke Vorhersage' : '3 AI Models, 1 Powerful Prediction'}
          </h2>
          <p className="text-gray-400 text-center mb-12 max-w-2xl mx-auto">
            {lang === 'tr' ? 'Her maç 3 farklı yapay zeka tarafından analiz edilir ve ortak karara varılır.' : lang === 'de' ? 'Jedes Spiel wird von 3 verschiedenen KI-Modellen analysiert und ein Konsens erreicht.' : 'Every match is analyzed by 3 different AI models and a consensus is reached.'}
          </p>
          
          <div className="grid md:grid-cols-3 gap-6 mb-12">
            {aiModels.map((ai, idx) => (
              <div key={idx} className="relative group">
                <div className={`absolute inset-0 bg-gradient-to-r ${ai.color} rounded-2xl blur-xl opacity-30 group-hover:opacity-50 transition-opacity`}></div>
                <div className="relative bg-gray-800 rounded-2xl p-8 border border-gray-700 hover:border-gray-600 transition-all">
                  <div className="text-5xl mb-4">{ai.icon}</div>
                  <h3 className="text-2xl font-bold text-white mb-1">{ai.name}</h3>
                  <p className="text-gray-400">{ai.company}</p>
                  <div className={`mt-4 inline-block px-3 py-1 rounded-full text-sm bg-gradient-to-r ${ai.color} text-white`}>
                    {lang === 'tr' ? 'Aktif' : lang === 'de' ? 'Aktiv' : 'Active'}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Consensus Animation */}
          <div className="flex items-center justify-center gap-4">
            <div className="w-16 h-16 rounded-full bg-orange-500/20 flex items-center justify-center text-2xl">🧠</div>
            <div className="text-green-400 text-2xl">+</div>
            <div className="w-16 h-16 rounded-full bg-green-500/20 flex items-center justify-center text-2xl">🤖</div>
            <div className="text-green-400 text-2xl">+</div>
            <div className="w-16 h-16 rounded-full bg-blue-500/20 flex items-center justify-center text-2xl">💎</div>
            <div className="text-green-400 text-2xl">=</div>
            <div className="px-6 py-3 bg-gradient-to-r from-green-600 to-emerald-500 rounded-xl text-white font-bold text-lg">
              {lang === 'tr' ? 'KONSENSÜS' : lang === 'de' ? 'KONSENS' : 'CONSENSUS'}
            </div>
          </div>
        </div>
      </div>

      {/* Bet Types Section */}
      <div className="py-16 px-6">
        <div className="max-w-7xl mx-auto">
          <h2 className="text-3xl md:text-4xl font-bold text-white text-center mb-4">
            🎯 {lang === 'tr' ? 'Desteklenen Bahis Tipleri' : lang === 'de' ? 'Unterstützte Wettarten' : 'Supported Bet Types'}
          </h2>
          <p className="text-gray-400 text-center mb-12">
            {lang === 'tr' ? '6 farklı bahis tipi için AI destekli tahminler' : lang === 'de' ? 'KI-gestützte Vorhersagen für 6 verschiedene Wettarten' : 'AI-powered predictions for 6 different bet types'}
          </p>
          
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {currentBetTypes.map((bet, idx) => (
              <div key={idx} className="bg-gray-800 rounded-2xl p-6 border border-gray-700 hover:border-green-500/50 transition-all group">
                <div className="flex items-start justify-between mb-4">
                  <div className="text-4xl">{bet.icon}</div>
                  <div className="px-3 py-1 bg-green-500/20 rounded-full">
                    <span className="text-green-400 font-bold">{bet.rate}</span>
                  </div>
                </div>
                <h3 className="text-xl font-bold text-white mb-2 group-hover:text-green-400 transition-colors">{bet.name}</h3>
                <p className="text-gray-400 text-sm">{bet.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Live Example Section */}
      <div className="py-16 px-6 bg-gray-800/30">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-3xl md:text-4xl font-bold text-white text-center mb-12">
            📺 {currentLiveExample.title}
          </h2>
          
          <div className="bg-gray-900 rounded-2xl p-8 border border-gray-700">
            {/* Match Header */}
            <div className="flex items-center justify-center gap-8 mb-8">
              <div className="text-center">
                <div className="w-16 h-16 bg-blue-500/20 rounded-full flex items-center justify-center text-3xl mb-2">🏠</div>
                <div className="text-white font-bold">Man City</div>
              </div>
              <div className="text-4xl font-bold text-gray-500">VS</div>
              <div className="text-center">
                <div className="w-16 h-16 bg-red-500/20 rounded-full flex items-center justify-center text-3xl mb-2">🔴</div>
                <div className="text-white font-bold">Arsenal</div>
              </div>
            </div>

            {/* AI Predictions */}
            <div className="space-y-4 mb-6">
              {currentLiveExample.predictions.map((pred, idx) => (
                <div key={idx} className="bg-gray-800 rounded-xl p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-gray-400">{pred.type}</span>
                    <span className="text-white font-bold">{pred.prediction}</span>
                  </div>
                  <div className="w-full bg-gray-700 rounded-full h-3">
                    <div 
                      className="bg-gradient-to-r from-green-500 to-emerald-400 h-3 rounded-full transition-all duration-1000"
                      style={{ width: `${pred.confidence}%` }}
                    ></div>
                  </div>
                  <div className="text-right text-sm text-green-400 mt-1">{pred.confidence}%</div>
                </div>
              ))}
            </div>

            {/* Consensus */}
            <div className="bg-green-500/10 border border-green-500/30 rounded-xl p-4 text-center">
              <div className="text-green-400 font-bold flex items-center justify-center gap-2">
                ✅ {currentLiveExample.consensus}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Features Section */}
      <div className="py-16 px-6">
        <div className="max-w-7xl mx-auto grid md:grid-cols-3 gap-8">
          <div className="bg-gray-800 rounded-2xl p-8 text-center hover:transform hover:scale-105 transition-all">
            <div className="text-5xl mb-4">📊</div>
            <h3 className="text-xl font-bold text-white mb-3">{t('feature2Title')}</h3>
            <p className="text-gray-400">{t('feature2Desc')}</p>
          </div>
          <div className="bg-gray-800 rounded-2xl p-8 text-center hover:transform hover:scale-105 transition-all">
            <div className="text-5xl mb-4">🏆</div>
            <h3 className="text-xl font-bold text-white mb-3">{t('feature3Title')}</h3>
            <p className="text-gray-400">{t('feature3Desc')}</p>
          </div>
          <div className="bg-gray-800 rounded-2xl p-8 text-center hover:transform hover:scale-105 transition-all">
            <div className="text-5xl mb-4">🎰</div>
            <h3 className="text-xl font-bold text-white mb-3">{lang === 'tr' ? 'Akıllı Kupon' : lang === 'de' ? 'Intelligenter Wettschein' : 'Smart Coupon'}</h3>
            <p className="text-gray-400">{lang === 'tr' ? 'AI\'lar tartışarak en iyi kuponu oluşturur' : lang === 'de' ? 'KI-Modelle diskutieren und erstellen den besten Wettschein' : 'AI models discuss and create the best coupon'}</p>
          </div>
        </div>
      </div>

      {/* CTA Section */}
      <div className="py-16 px-6 bg-gradient-to-r from-green-600/20 to-emerald-500/10">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-4xl font-bold text-white mb-6">
            🚀 {lang === 'tr' ? 'Hemen Başlayın' : lang === 'de' ? 'Jetzt Starten' : 'Get Started Now'}
          </h2>
          <p className="text-xl text-gray-400 mb-8">
            {lang === 'tr' ? '7 gün boyunca tüm özellikleri ücretsiz deneyin. Memnun kalmazsanız iptal edin, hiçbir ücret ödemezsiniz.' : lang === 'de' ? 'Testen Sie alle Funktionen 7 Tage kostenlos. Wenn Sie nicht zufrieden sind, kündigen Sie und zahlen nichts.' : 'Try all features free for 7 days. If not satisfied, cancel and pay nothing.'}
          </p>
          <Link href="/login" className="inline-block px-8 py-4 bg-gradient-to-r from-green-600 to-emerald-500 hover:from-green-500 hover:to-emerald-400 text-white text-lg font-bold rounded-xl shadow-lg shadow-green-500/25 transition-all transform hover:scale-105">
            {t('startFree')} →
          </Link>
          <p className="mt-4 text-gray-500 text-sm">
            {lang === 'tr' ? '✓ Kredi kartı gerekli • ✓ 7 gün ücretsiz • ✓ İstediğin zaman iptal' : lang === 'de' ? '✓ Kreditkarte erforderlich • ✓ 7 Tage kostenlos • ✓ Jederzeit kündbar' : '✓ Credit card required • ✓ 7 days free • ✓ Cancel anytime'}
          </p>
        </div>
      </div>

      {/* Footer */}
      <footer className="py-12 px-6 border-t border-gray-800">
        <div className="max-w-7xl mx-auto text-center text-gray-500">
          <p className="mb-4">⚽ {t('appName')} - {t('appDesc')}</p>
          <p className="text-sm">{t('madeBy')} 🚀</p>
          <div className="mt-4 flex items-center justify-center gap-4 text-xs">
            <span>Powered by: Claude AI • GPT-4 • Gemini</span>
            <span>|</span>
            <span>Data: Sportmonks Pro API</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
