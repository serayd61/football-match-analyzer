'use client';

import { useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useLanguage } from '@/components/LanguageProvider';
import LanguageSelector from '@/components/LanguageSelector';

export default function HomePage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const { lang } = useLanguage();

  useEffect(() => {
    if (session) {
      router.push('/dashboard');
    }
  }, [session, router]);

  const labels = {
    tr: {
      hero: {
        badge: '🚀 Yeni: 5 AI Agent Sistemi Aktif',
        title: 'Futbol Analizinde',
        titleHighlight: 'Yapay Zeka Devrimi',
        subtitle: '4 Güçlü AI + 5 Özel Heurist Agent ile dünyanın en gelişmiş futbol analiz platformu. Profesyonel bahis analistlerinin kullandığı teknolojiyi şimdi siz de kullanın.',
        cta: 'Ücretsiz Başla',
        ctaSecondary: 'Demo İzle',
        trustedBy: '10.000+ kullanıcı güveniyor',
      },
      features: {
        title: 'Neden Football Analytics Pro?',
        subtitle: 'Rakiplerinizden bir adım önde olmanızı sağlayan özellikler',
        items: [
          {
            icon: '🤖',
            title: '9 AI Model',
            desc: 'Claude, GPT-4, Gemini + 5 Heurist Agent bir arada çalışır',
          },
          {
            icon: '🎯',
            title: '%85+ Doğruluk',
            desc: 'Gelişmiş algoritmalar ile yüksek başarı oranı',
          },
          {
            icon: '⚡',
            title: 'Gerçek Zamanlı',
            desc: 'Anlık oran değişiklikleri ve canlı analiz',
          },
          {
            icon: '💎',
            title: 'Value Bet Tespiti',
            desc: 'Bookmaker hatalarını otomatik yakala',
          },
          {
            icon: '📊',
            title: '50+ Lig',
            desc: 'Dünya genelinde tüm büyük ligler',
          },
          {
            icon: '🔒',
            title: 'Güvenli & Gizli',
            desc: 'Verileriniz şifrelenerek korunur',
          },
        ],
      },
      agents: {
        title: 'Heurist Multi-Agent Sistemi',
        subtitle: 'Her biri uzman olan 5 AI ajanı birlikte çalışır',
        items: [
          {
            name: 'Scout Agent',
            icon: '🔍',
            color: 'blue',
            desc: 'Sakatlıklar, kadro değişiklikleri ve son dakika haberlerini takip eder',
          },
          {
            name: 'Stats Agent',
            icon: '📊',
            color: 'green',
            desc: 'Detaylı istatistik analizi ve form karşılaştırması yapar',
          },
          {
            name: 'Odds Agent',
            icon: '💰',
            color: 'yellow',
            desc: 'Oran hareketlerini analiz eder ve value bet\'leri tespit eder',
          },
          {
            name: 'Strategy Agent',
            icon: '🧠',
            color: 'purple',
            desc: 'Risk yönetimi ve optimal bahis stratejisi belirler',
          },
          {
            name: 'Consensus Agent',
            icon: '⚖️',
            color: 'pink',
            desc: 'Tüm ajanların görüşlerini birleştirerek final kararı verir',
          },
        ],
      },
      stats: {
        matches: 'Günlük Maç',
        accuracy: 'Doğruluk Oranı',
        users: 'Aktif Kullanıcı',
        leagues: 'Desteklenen Lig',
      },
      pricing: {
        title: 'Basit Fiyatlandırma',
        subtitle: 'Gizli ücret yok, istediğiniz zaman iptal edin',
        free: {
          name: 'Ücretsiz',
          price: '₺0',
          period: '/ay',
          features: ['Günde 5 analiz', '3 AI modeli', 'Temel istatistikler', 'E-posta desteği'],
          cta: 'Ücretsiz Başla',
        },
        pro: {
          name: 'Pro',
          price: '₺299',
          period: '/ay',
          popular: 'En Popüler',
          features: ['Sınırsız analiz', '9 AI modeli (Agent dahil)', 'Value bet tespiti', 'Gerçek zamanlı oranlar', 'Öncelikli destek', 'API erişimi'],
          cta: 'Pro\'ya Geç',
        },
      },
      testimonials: {
        title: 'Kullanıcılarımız Ne Diyor?',
        items: [
          {
            text: 'Agent sistemi gerçekten oyunun kurallarını değiştirdi. Her maç için 5 farklı uzman görüşü almak paha biçilemez.',
            author: 'Mehmet K.',
            role: 'Profesyonel Bahisçi',
          },
          {
            text: 'Value bet tespiti özelliği sayesinde aylık kazancım %40 arttı. Kesinlikle tavsiye ederim.',
            author: 'Ali Y.',
            role: 'Spor Analisti',
          },
          {
            text: 'Kullanımı çok kolay ve analizler gerçekten detaylı. Pro üyelik her kuruşuna değer.',
            author: 'Emre S.',
            role: 'Hobi Bahisçi',
          },
        ],
      },
      cta: {
        title: 'Kazanmaya Hazır mısınız?',
        subtitle: 'Hemen ücretsiz hesap oluşturun ve AI destekli analizlere erişin',
        button: 'Ücretsiz Hesap Oluştur',
      },
      footer: {
        product: 'Ürün',
        features: 'Özellikler',
        pricing: 'Fiyatlandırma',
        demo: 'Demo',
        company: 'Şirket',
        about: 'Hakkımızda',
        blog: 'Blog',
        careers: 'Kariyer',
        legal: 'Yasal',
        privacy: 'Gizlilik',
        terms: 'Kullanım Şartları',
        copyright: '© 2024 Football Analytics Pro. Tüm hakları saklıdır.',
      },
    },
    en: {
      hero: {
        badge: '🚀 New: 5 AI Agent System Active',
        title: 'AI Revolution in',
        titleHighlight: 'Football Analytics',
        subtitle: "The world's most advanced football analysis platform with 4 Powerful AI + 5 Custom Heurist Agents. Now you can use the same technology professional betting analysts use.",
        cta: 'Start Free',
        ctaSecondary: 'Watch Demo',
        trustedBy: 'Trusted by 10,000+ users',
      },
      features: {
        title: 'Why Football Analytics Pro?',
        subtitle: 'Features that keep you one step ahead of your competitors',
        items: [
          {
            icon: '🤖',
            title: '9 AI Models',
            desc: 'Claude, GPT-4, Gemini + 5 Heurist Agents working together',
          },
          {
            icon: '🎯',
            title: '85%+ Accuracy',
            desc: 'High success rate with advanced algorithms',
          },
          {
            icon: '⚡',
            title: 'Real-Time',
            desc: 'Instant odds changes and live analysis',
          },
          {
            icon: '💎',
            title: 'Value Bet Detection',
            desc: 'Automatically catch bookmaker mistakes',
          },
          {
            icon: '📊',
            title: '50+ Leagues',
            desc: 'All major leagues worldwide',
          },
          {
            icon: '🔒',
            title: 'Secure & Private',
            desc: 'Your data is encrypted and protected',
          },
        ],
      },
      agents: {
        title: 'Heurist Multi-Agent System',
        subtitle: '5 expert AI agents working together',
        items: [
          {
            name: 'Scout Agent',
            icon: '🔍',
            color: 'blue',
            desc: 'Tracks injuries, lineup changes, and breaking news',
          },
          {
            name: 'Stats Agent',
            icon: '📊',
            color: 'green',
            desc: 'Performs detailed statistical analysis and form comparison',
          },
          {
            name: 'Odds Agent',
            icon: '💰',
            color: 'yellow',
            desc: 'Analyzes odds movements and detects value bets',
          },
          {
            name: 'Strategy Agent',
            icon: '🧠',
            color: 'purple',
            desc: 'Determines risk management and optimal betting strategy',
          },
          {
            name: 'Consensus Agent',
            icon: '⚖️',
            color: 'pink',
            desc: 'Combines all agent opinions to make the final decision',
          },
        ],
      },
      stats: {
        matches: 'Daily Matches',
        accuracy: 'Accuracy Rate',
        users: 'Active Users',
        leagues: 'Supported Leagues',
      },
      pricing: {
        title: 'Simple Pricing',
        subtitle: 'No hidden fees, cancel anytime',
        free: {
          name: 'Free',
          price: '$0',
          period: '/mo',
          features: ['5 analyses per day', '3 AI models', 'Basic statistics', 'Email support'],
          cta: 'Start Free',
        },
        pro: {
          name: 'Pro',
          price: '$9.99',
          period: '/mo',
          popular: 'Most Popular',
          features: ['Unlimited analyses', '9 AI models (incl. Agents)', 'Value bet detection', 'Real-time odds', 'Priority support', 'API access'],
          cta: 'Go Pro',
        },
      },
      testimonials: {
        title: 'What Our Users Say',
        items: [
          {
            text: 'The Agent system really changed the game. Getting 5 different expert opinions for each match is priceless.',
            author: 'Michael K.',
            role: 'Professional Bettor',
          },
          {
            text: 'Thanks to the value bet detection feature, my monthly earnings increased by 40%. Highly recommended.',
            author: 'James Y.',
            role: 'Sports Analyst',
          },
          {
            text: 'Very easy to use and the analyses are really detailed. Pro membership is worth every penny.',
            author: 'David S.',
            role: 'Hobby Bettor',
          },
        ],
      },
      cta: {
        title: 'Ready to Win?',
        subtitle: 'Create a free account now and access AI-powered analyses',
        button: 'Create Free Account',
      },
      footer: {
        product: 'Product',
        features: 'Features',
        pricing: 'Pricing',
        demo: 'Demo',
        company: 'Company',
        about: 'About',
        blog: 'Blog',
        careers: 'Careers',
        legal: 'Legal',
        privacy: 'Privacy',
        terms: 'Terms',
        copyright: '© 2024 Football Analytics Pro. All rights reserved.',
      },
    },
    de: {
      hero: {
        badge: '🚀 Neu: 5 KI-Agent-System Aktiv',
        title: 'KI-Revolution in der',
        titleHighlight: 'Fußballanalyse',
        subtitle: 'Die weltweit fortschrittlichste Fußball-Analyseplattform mit 4 leistungsstarken KI + 5 benutzerdefinierten Heurist-Agenten.',
        cta: 'Kostenlos starten',
        ctaSecondary: 'Demo ansehen',
        trustedBy: 'Über 10.000 Nutzer vertrauen uns',
      },
      features: {
        title: 'Warum Football Analytics Pro?',
        subtitle: 'Funktionen, die Sie einen Schritt voraus halten',
        items: [
          { icon: '🤖', title: '9 KI-Modelle', desc: 'Claude, GPT-4, Gemini + 5 Heurist Agenten' },
          { icon: '🎯', title: '85%+ Genauigkeit', desc: 'Hohe Erfolgsquote mit fortschrittlichen Algorithmen' },
          { icon: '⚡', title: 'Echtzeit', desc: 'Sofortige Quotenänderungen und Live-Analyse' },
          { icon: '💎', title: 'Value Bet Erkennung', desc: 'Buchmacher-Fehler automatisch erkennen' },
          { icon: '📊', title: '50+ Ligen', desc: 'Alle großen Ligen weltweit' },
          { icon: '🔒', title: 'Sicher & Privat', desc: 'Ihre Daten werden verschlüsselt' },
        ],
      },
      agents: {
        title: 'Heurist Multi-Agent-System',
        subtitle: '5 Experten-KI-Agenten arbeiten zusammen',
        items: [
          { name: 'Scout Agent', icon: '🔍', color: 'blue', desc: 'Verfolgt Verletzungen, Aufstellungsänderungen und Nachrichten' },
          { name: 'Stats Agent', icon: '📊', color: 'green', desc: 'Führt detaillierte statistische Analysen durch' },
          { name: 'Odds Agent', icon: '💰', color: 'yellow', desc: 'Analysiert Quotenbewegungen und erkennt Value Bets' },
          { name: 'Strategy Agent', icon: '🧠', color: 'purple', desc: 'Bestimmt Risikomanagement und optimale Wettstrategie' },
          { name: 'Consensus Agent', icon: '⚖️', color: 'pink', desc: 'Kombiniert alle Agentenmeinungen für die Endentscheidung' },
        ],
      },
      stats: { matches: 'Tägliche Spiele', accuracy: 'Genauigkeitsrate', users: 'Aktive Nutzer', leagues: 'Unterstützte Ligen' },
      pricing: {
        title: 'Einfache Preisgestaltung',
        subtitle: 'Keine versteckten Gebühren, jederzeit kündbar',
        free: { name: 'Kostenlos', price: '€0', period: '/Mo', features: ['5 Analysen pro Tag', '3 KI-Modelle', 'Grundlegende Statistiken', 'E-Mail-Support'], cta: 'Kostenlos starten' },
        pro: { name: 'Pro', price: '€9,99', period: '/Mo', popular: 'Am beliebtesten', features: ['Unbegrenzte Analysen', '9 KI-Modelle (inkl. Agenten)', 'Value Bet Erkennung', 'Echtzeit-Quoten', 'Prioritäts-Support', 'API-Zugang'], cta: 'Pro werden' },
      },
      testimonials: {
        title: 'Was unsere Nutzer sagen',
        items: [
          { text: 'Das Agent-System hat das Spiel wirklich verändert. 5 verschiedene Expertenmeinungen für jedes Spiel zu bekommen ist unbezahlbar.', author: 'Michael K.', role: 'Professioneller Wetter' },
          { text: 'Dank der Value-Bet-Erkennung sind meine monatlichen Einnahmen um 40% gestiegen.', author: 'Thomas Y.', role: 'Sportanalyst' },
          { text: 'Sehr einfach zu bedienen und die Analysen sind wirklich detailliert.', author: 'David S.', role: 'Hobby-Wetter' },
        ],
      },
      cta: { title: 'Bereit zu gewinnen?', subtitle: 'Erstellen Sie jetzt ein kostenloses Konto', button: 'Kostenloses Konto erstellen' },
      footer: { product: 'Produkt', features: 'Funktionen', pricing: 'Preise', demo: 'Demo', company: 'Unternehmen', about: 'Über uns', blog: 'Blog', careers: 'Karriere', legal: 'Rechtliches', privacy: 'Datenschutz', terms: 'AGB', copyright: '© 2024 Football Analytics Pro. Alle Rechte vorbehalten.' },
    },
  };

  const l = labels[lang as keyof typeof labels] || labels.en;

  if (status === 'loading') {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-green-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-slate-900 to-gray-900">
      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-gray-900/80 backdrop-blur-xl border-b border-gray-800">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-green-500 to-green-600 rounded-xl flex items-center justify-center shadow-lg shadow-green-500/20">
                <span className="text-xl">⚽</span>
              </div>
              <span className="text-xl font-bold text-white">Football Analytics Pro</span>
            </div>
            <div className="flex items-center gap-4">
              <LanguageSelector />
              <Link href="/login" className="px-5 py-2.5 bg-gradient-to-r from-green-600 to-green-500 hover:from-green-500 hover:to-green-400 text-white font-semibold rounded-xl shadow-lg shadow-green-500/20 transition-all">
                {l.hero.cta}
              </Link>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="pt-32 pb-20 px-4">
        <div className="max-w-7xl mx-auto">
          <div className="text-center max-w-4xl mx-auto">
            {/* Badge */}
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-green-500/10 border border-green-500/20 rounded-full text-green-400 text-sm font-medium mb-8">
              {l.hero.badge}
            </div>

            {/* Title */}
            <h1 className="text-5xl md:text-7xl font-bold text-white mb-6 leading-tight">
              {l.hero.title}{' '}
              <span className="bg-gradient-to-r from-green-400 via-blue-500 to-purple-500 bg-clip-text text-transparent">
                {l.hero.titleHighlight}
              </span>
            </h1>

            {/* Subtitle */}
            <p className="text-xl text-gray-400 mb-10 max-w-2xl mx-auto leading-relaxed">
              {l.hero.subtitle}
            </p>

            {/* CTAs */}
            <div className="flex flex-col sm:flex-row gap-4 justify-center mb-12">
              <Link href="/login" className="px-8 py-4 bg-gradient-to-r from-green-600 to-green-500 hover:from-green-500 hover:to-green-400 text-white font-bold text-lg rounded-2xl shadow-xl shadow-green-500/30 transition-all flex items-center justify-center gap-2">
                {l.hero.cta}
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                </svg>
              </Link>
              <button className="px-8 py-4 bg-gray-800 hover:bg-gray-700 text-white font-semibold text-lg rounded-2xl border border-gray-700 transition-all flex items-center justify-center gap-2">
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd" />
                </svg>
                {l.hero.ctaSecondary}
              </button>
            </div>

            {/* Trust Badge */}
            <div className="flex items-center justify-center gap-4">
              <div className="flex -space-x-3">
                {['🧑‍💼', '👨‍💻', '👩‍💼', '🧑‍💻', '👨‍💼'].map((emoji, idx) => (
                  <div key={idx} className="w-10 h-10 bg-gray-700 rounded-full border-2 border-gray-800 flex items-center justify-center text-lg">
                    {emoji}
                  </div>
                ))}
              </div>
              <div className="text-left">
                <div className="text-yellow-400">★★★★★</div>
                <div className="text-sm text-gray-400">{l.hero.trustedBy}</div>
              </div>
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mt-20">
            {[
              { value: '500+', label: l.stats.matches },
              { value: '85%+', label: l.stats.accuracy },
              { value: '10K+', label: l.stats.users },
              { value: '50+', label: l.stats.leagues },
            ].map((stat, idx) => (
              <div key={idx} className="text-center p-6 bg-gray-800/50 backdrop-blur border border-gray-700/50 rounded-2xl">
                <div className="text-4xl font-bold text-white mb-1">{stat.value}</div>
                <div className="text-gray-400">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Agent System Section */}
      <section className="py-20 px-4 bg-gradient-to-b from-transparent via-purple-900/10 to-transparent">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-white mb-4">{l.agents.title}</h2>
            <p className="text-xl text-gray-400">{l.agents.subtitle}</p>
          </div>

          <div className="grid md:grid-cols-5 gap-4">
            {l.agents.items.map((agent, idx) => {
              const colors: Record<string, string> = {
                blue: 'from-blue-500/20 to-blue-600/20 border-blue-500/30',
                green: 'from-green-500/20 to-green-600/20 border-green-500/30',
                yellow: 'from-yellow-500/20 to-yellow-600/20 border-yellow-500/30',
                purple: 'from-purple-500/20 to-purple-600/20 border-purple-500/30',
                pink: 'from-pink-500/20 to-pink-600/20 border-pink-500/30',
              };
              return (
                <div key={idx} className={`p-6 bg-gradient-to-br ${colors[agent.color]} border rounded-2xl text-center hover:scale-105 transition-transform`}>
                  <div className="text-4xl mb-4">{agent.icon}</div>
                  <h3 className="text-lg font-bold text-white mb-2">{agent.name}</h3>
                  <p className="text-sm text-gray-400">{agent.desc}</p>
                </div>
              );
            })}
          </div>

          {/* Agent Flow Diagram */}
          <div className="mt-12 p-8 bg-gray-800/50 backdrop-blur border border-gray-700/50 rounded-3xl">
            <div className="flex flex-wrap items-center justify-center gap-4 text-center">
              <div className="px-4 py-2 bg-blue-500/20 rounded-xl text-blue-400 font-medium">🔍 Scout</div>
              <span className="text-gray-500">→</span>
              <div className="px-4 py-2 bg-green-500/20 rounded-xl text-green-400 font-medium">📊 Stats</div>
              <span className="text-gray-500">→</span>
              <div className="px-4 py-2 bg-yellow-500/20 rounded-xl text-yellow-400 font-medium">💰 Odds</div>
              <span className="text-gray-500">→</span>
              <div className="px-4 py-2 bg-purple-500/20 rounded-xl text-purple-400 font-medium">🧠 Strategy</div>
              <span className="text-gray-500">→</span>
              <div className="px-4 py-2 bg-pink-500/20 rounded-xl text-pink-400 font-medium">⚖️ Consensus</div>
              <span className="text-gray-500">→</span>
              <div className="px-4 py-2 bg-gradient-to-r from-green-500 to-blue-500 rounded-xl text-white font-bold">🎯 Final Prediction</div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20 px-4">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-white mb-4">{l.features.title}</h2>
            <p className="text-xl text-gray-400">{l.features.subtitle}</p>
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            {l.features.items.map((feature, idx) => (
              <div key={idx} className="p-6 bg-gray-800/50 backdrop-blur border border-gray-700/50 rounded-2xl hover:border-green-500/50 transition-colors group">
                <div className="text-4xl mb-4 group-hover:scale-110 transition-transform">{feature.icon}</div>
                <h3 className="text-xl font-bold text-white mb-2">{feature.title}</h3>
                <p className="text-gray-400">{feature.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section className="py-20 px-4 bg-gradient-to-b from-transparent via-green-900/10 to-transparent">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-white mb-4">{l.pricing.title}</h2>
            <p className="text-xl text-gray-400">{l.pricing.subtitle}</p>
          </div>

          <div className="grid md:grid-cols-2 gap-8">
            {/* Free Plan */}
            <div className="p-8 bg-gray-800/50 backdrop-blur border border-gray-700/50 rounded-3xl">
              <h3 className="text-2xl font-bold text-white mb-2">{l.pricing.free.name}</h3>
              <div className="flex items-baseline gap-1 mb-6">
                <span className="text-5xl font-bold text-white">{l.pricing.free.price}</span>
                <span className="text-gray-400">{l.pricing.free.period}</span>
              </div>
              <ul className="space-y-4 mb-8">
                {l.pricing.free.features.map((feature, idx) => (
                  <li key={idx} className="flex items-center gap-3 text-gray-300">
                    <svg className="w-5 h-5 text-green-500" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                    {feature}
                  </li>
                ))}
              </ul>
              <Link href="/login" className="block w-full py-4 bg-gray-700 hover:bg-gray-600 text-white font-semibold rounded-xl text-center transition-colors">
                {l.pricing.free.cta}
              </Link>
            </div>

            {/* Pro Plan */}
            <div className="p-8 bg-gradient-to-br from-green-500/10 to-blue-500/10 border-2 border-green-500/50 rounded-3xl relative">
              <div className="absolute -top-4 left-1/2 -translate-x-1/2 px-4 py-1 bg-gradient-to-r from-green-500 to-blue-500 text-white text-sm font-bold rounded-full">
                {l.pricing.pro.popular}
              </div>
              <h3 className="text-2xl font-bold text-white mb-2">{l.pricing.pro.name}</h3>
              <div className="flex items-baseline gap-1 mb-6">
                <span className="text-5xl font-bold text-white">{l.pricing.pro.price}</span>
                <span className="text-gray-400">{l.pricing.pro.period}</span>
              </div>
              <ul className="space-y-4 mb-8">
                {l.pricing.pro.features.map((feature, idx) => (
                  <li key={idx} className="flex items-center gap-3 text-gray-300">
                    <svg className="w-5 h-5 text-green-500" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                    {feature}
                  </li>
                ))}
              </ul>
              <Link href="/login" className="block w-full py-4 bg-gradient-to-r from-green-600 to-green-500 hover:from-green-500 hover:to-green-400 text-white font-bold rounded-xl text-center shadow-lg shadow-green-500/30 transition-all">
                {l.pricing.pro.cta}
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section className="py-20 px-4">
        <div className="max-w-7xl mx-auto">
          <h2 className="text-4xl font-bold text-white text-center mb-16">{l.testimonials.title}</h2>
          <div className="grid md:grid-cols-3 gap-8">
            {l.testimonials.items.map((testimonial, idx) => (
              <div key={idx} className="p-6 bg-gray-800/50 backdrop-blur border border-gray-700/50 rounded-2xl">
                <div className="text-yellow-400 mb-4">★★★★★</div>
                <p className="text-gray-300 mb-6">"{testimonial.text}"</p>
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-gradient-to-br from-green-500 to-blue-500 rounded-full flex items-center justify-center text-white font-bold">
                    {testimonial.author.charAt(0)}
                  </div>
                  <div>
                    <div className="font-medium text-white">{testimonial.author}</div>
                    <div className="text-sm text-gray-400">{testimonial.role}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="py-20 px-4">
        <div className="max-w-4xl mx-auto text-center">
          <div className="p-12 bg-gradient-to-br from-green-500/20 to-blue-500/20 border border-green-500/30 rounded-3xl">
            <h2 className="text-4xl font-bold text-white mb-4">{l.cta.title}</h2>
            <p className="text-xl text-gray-300 mb-8">{l.cta.subtitle}</p>
            <Link href="/login" className="inline-flex items-center gap-2 px-8 py-4 bg-gradient-to-r from-green-600 to-green-500 hover:from-green-500 hover:to-green-400 text-white font-bold text-lg rounded-2xl shadow-xl shadow-green-500/30 transition-all">
              {l.cta.button}
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
              </svg>
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 px-4 border-t border-gray-800">
        <div className="max-w-7xl mx-auto">
          <div className="grid md:grid-cols-4 gap-8 mb-8">
            <div>
              <div className="flex items-center gap-2 mb-4">
                <div className="w-8 h-8 bg-gradient-to-br from-green-500 to-green-600 rounded-lg flex items-center justify-center">
                  <span>⚽</span>
                </div>
                <span className="font-bold text-white">Football Analytics Pro</span>
              </div>
              <p className="text-gray-400 text-sm">AI-powered football analysis platform</p>
            </div>
            <div>
              <h4 className="font-semibold text-white mb-4">{l.footer.product}</h4>
              <ul className="space-y-2 text-gray-400">
                <li><Link href="#" className="hover:text-white transition-colors">{l.footer.features}</Link></li>
                <li><Link href="/pricing" className="hover:text-white transition-colors">{l.footer.pricing}</Link></li>
                <li><Link href="#" className="hover:text-white transition-colors">{l.footer.demo}</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold text-white mb-4">{l.footer.company}</h4>
              <ul className="space-y-2 text-gray-400">
                <li><Link href="#" className="hover:text-white transition-colors">{l.footer.about}</Link></li>
                <li><Link href="#" className="hover:text-white transition-colors">{l.footer.blog}</Link></li>
                <li><Link href="#" className="hover:text-white transition-colors">{l.footer.careers}</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold text-white mb-4">{l.footer.legal}</h4>
              <ul className="space-y-2 text-gray-400">
                <li><Link href="#" className="hover:text-white transition-colors">{l.footer.privacy}</Link></li>
                <li><Link href="#" className="hover:text-white transition-colors">{l.footer.terms}</Link></li>
              </ul>
            </div>
          </div>
          <div className="pt-8 border-t border-gray-800 text-center text-gray-500 text-sm">
            {l.footer.copyright}
          </div>
        </div>
      </footer>
    </div>
  );
}
