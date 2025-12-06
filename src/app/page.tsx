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
        badge: '🔗 Web3 + AI Teknolojisi',
        title: 'Futbol Analizinde',
        titleHighlight: 'İki Güçlü Sistem',
        subtitle: 'Dünyanın ilk hibrit analiz platformu: 4 Elite AI modeli + 3 Uzman Agent birlikte çalışır. Merkezi olmayan Heurist ağı üzerinde çalışan agent\'lar ile benzersiz doğruluk.',
        cta: 'Ücretsiz Başla',
        ctaSecondary: 'Nasıl Çalışır?',
        trustedBy: '10.000+ kullanıcı güveniyor',
      },
      systems: {
        title: 'İki Bağımsız Analiz Motoru',
        subtitle: 'Aynı maç için iki farklı perspektif, maksimum doğruluk',
      },
      aiSystem: {
        badge: 'SİSTEM 1',
        title: 'AI Consensus Engine',
        subtitle: 'Dünyanın en güçlü 4 AI modeli birlikte analiz yapar',
        description: 'Claude (Anthropic), GPT-4 (OpenAI), Gemini (Google) ve Heurist modelleri aynı anda çalışır. Her biri bağımsız analiz yapar, sonuçlar oylama ile birleştirilir.',
        features: [
          { icon: '🧠', title: 'Claude Sonnet', desc: 'Anthropic\'in en gelişmiş modeli - Derin mantıksal analiz' },
          { icon: '⚡', title: 'GPT-4 Turbo', desc: 'OpenAI\'ın amiral gemisi - Hızlı ve kapsamlı değerlendirme' },
          { icon: '💎', title: 'Gemini Pro', desc: 'Google\'ın yapay zekası - Çok boyutlu analiz' },
          { icon: '🔗', title: 'Heurist LLM', desc: 'Web3 tabanlı - Merkezi olmayan hesaplama' },
        ],
        howItWorks: [
          { step: '1', title: 'Veri Toplama', desc: 'Form, oran ve H2H verileri derlenir' },
          { step: '2', title: 'Paralel Analiz', desc: '4 AI aynı anda bağımsız analiz yapar' },
          { step: '3', title: 'Oylama', desc: 'Sonuçlar demokratik oylama ile birleşir' },
          { step: '4', title: 'Konsensüs', desc: 'En yüksek uzlaşıya sahip tahmin belirlenir' },
        ],
      },
      agentSystem: {
        badge: 'SİSTEM 2',
        title: 'Heurist Agent Network',
        subtitle: 'Web3 altyapısı üzerinde çalışan uzman ajanlar',
        description: 'Merkezi olmayan Heurist ağı üzerinde çalışan 3 uzman agent, her biri farklı bir alanda uzmanlaşmıştır. Ağırlıklı oylama sistemi ile final kararı verilir.',
        web3Badge: '🔗 Decentralized AI',
        agents: [
          {
            name: 'Stats Agent',
            icon: '📊',
            color: 'green',
            weight: '40%',
            title: 'İstatistik Uzmanı',
            desc: 'Form analizi, gol ortalamaları, H2H karşılaştırması. Veriye dayalı matematiksel hesaplamalar yapar.',
            skills: ['Form Analizi', 'Gol Tahmini', 'H2H Değerlendirme'],
          },
          {
            name: 'Odds Agent',
            icon: '💰',
            color: 'yellow',
            weight: '35%',
            title: 'Oran Analisti',
            desc: 'Bahis oranlarını analiz eder, value bet\'leri tespit eder. Piyasa hareketlerini yorumlar.',
            skills: ['Value Bet Tespiti', 'Oran Karşılaştırma', 'Piyasa Analizi'],
          },
          {
            name: 'Strategy Agent',
            icon: '🧠',
            color: 'purple',
            weight: '25%',
            title: 'Strateji Uzmanı',
            desc: 'Risk yönetimi ve optimal bahis stratejisi belirler. Diğer agent\'ların çıktılarını değerlendirir.',
            skills: ['Risk Yönetimi', 'Stake Önerisi', 'Portföy Stratejisi'],
          },
        ],
        weightedSystem: {
          title: 'Ağırlıklı Oylama Sistemi',
          desc: 'Her agent\'ın görüşü, uzmanlık alanına göre ağırlıklandırılır',
        },
      },
      comparison: {
        title: 'Neden İki Sistem?',
        subtitle: 'Farklı yaklaşımlar, daha güvenilir sonuçlar',
        items: [
          {
            icon: '🎯',
            title: 'Çapraz Doğrulama',
            desc: 'İki bağımsız sistem aynı sonuca ulaşırsa güven artar',
          },
          {
            icon: '🔄',
            title: 'Farklı Perspektifler',
            desc: 'AI\'lar genel bakış, Agent\'lar uzman bakışı sunar',
          },
          {
            icon: '⚖️',
            title: 'Denge Kontrolü',
            desc: 'Bir sistem hata yaparsa diğeri dengeler',
          },
          {
            icon: '📈',
            title: '%92 Uyum Oranı',
            desc: 'Sistemler genellikle aynı yönde tahmin yapar',
          },
        ],
      },
      features: {
        title: 'Platform Özellikleri',
        subtitle: 'Profesyonel bahisçilerin ihtiyaç duyduğu her şey',
        items: [
          { icon: '🤖', title: '7 AI Modeli', desc: '4 Elite AI + 3 Uzman Agent birlikte çalışır' },
          { icon: '🎯', title: '%85+ Doğruluk', desc: 'Çift sistem ile yüksek başarı oranı' },
          { icon: '⚡', title: 'Gerçek Zamanlı', desc: 'Anlık oran değişiklikleri ve canlı analiz' },
          { icon: '💎', title: 'Value Bet', desc: 'Bookmaker hatalarını otomatik yakala' },
          { icon: '📊', title: '50+ Lig', desc: 'Dünya genelinde tüm büyük ligler' },
          { icon: '🔒', title: 'Güvenli', desc: 'Verileriniz şifrelenerek korunur' },
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
    name: 'Deneme',
    price: '$0',
    period: '/7 gün',
    features: ['Günde 3 analiz', '4 AI modeli', 'Temel istatistikler', 'E-posta desteği'],
    cta: 'Ücretsiz Dene',
  },
  pro: {
    name: 'Pro',
    price: '$19.90',
    period: '/ay',
    popular: 'En Popüler',
    features: ['Sınırsız analiz', '7 AI modeli (Agent dahil)', 'Value bet tespiti', 'Ağırlıklı konsensüs', 'Öncelikli destek', 'Telegram bildirimleri'],
    cta: 'Pro\'ya Geç',
  },
},
      testimonials: {
        title: 'Kullanıcılarımız Ne Diyor?',
        items: [
          { text: 'İki farklı sistemin aynı sonuca ulaşması bana çok güven veriyor. Artık daha bilinçli bahis yapıyorum.', author: 'Mehmet K.', role: 'Profesyonel Bahisçi' },
          { text: 'Agent sisteminin ağırlıklı oylama mantığı muhteşem. Hangi verinin ne kadar önemli olduğunu anlıyorum.', author: 'Ali Y.', role: 'Spor Analisti' },
          { text: 'Web3 teknolojisi ile çalışan AI\'lar gerçekten fark yaratıyor. Sonuçlar çok tutarlı.', author: 'Emre S.', role: 'Kripto & Bahis Meraklısı' },
        ],
      },
      cta: {
        title: 'İki Güçlü Sistemi Deneyin',
        subtitle: 'Ücretsiz hesap oluşturun, AI ve Agent\'ların gücünü keşfedin',
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
        poweredBy: 'Powered by Heurist Network',
      },
    },
    en: {
      hero: {
        badge: '🔗 Web3 + AI Technology',
        title: 'Two Powerful Systems for',
        titleHighlight: 'Football Analytics',
        subtitle: "World's first hybrid analysis platform: 4 Elite AI models + 3 Expert Agents working together. Unique accuracy with agents running on decentralized Heurist network.",
        cta: 'Start Free',
        ctaSecondary: 'How It Works?',
        trustedBy: 'Trusted by 10,000+ users',
      },
      systems: {
        title: 'Two Independent Analysis Engines',
        subtitle: 'Two different perspectives for the same match, maximum accuracy',
      },
      aiSystem: {
        badge: 'SYSTEM 1',
        title: 'AI Consensus Engine',
        subtitle: "World's 4 most powerful AI models analyze together",
        description: 'Claude (Anthropic), GPT-4 (OpenAI), Gemini (Google) and Heurist models work simultaneously. Each performs independent analysis, results are combined by voting.',
        features: [
          { icon: '🧠', title: 'Claude Sonnet', desc: "Anthropic's most advanced model - Deep logical analysis" },
          { icon: '⚡', title: 'GPT-4 Turbo', desc: "OpenAI's flagship - Fast and comprehensive evaluation" },
          { icon: '💎', title: 'Gemini Pro', desc: "Google's AI - Multi-dimensional analysis" },
          { icon: '🔗', title: 'Heurist LLM', desc: 'Web3 based - Decentralized computation' },
        ],
        howItWorks: [
          { step: '1', title: 'Data Collection', desc: 'Form, odds and H2H data compiled' },
          { step: '2', title: 'Parallel Analysis', desc: '4 AIs analyze independently at once' },
          { step: '3', title: 'Voting', desc: 'Results combined by democratic voting' },
          { step: '4', title: 'Consensus', desc: 'Prediction with highest agreement determined' },
        ],
      },
      agentSystem: {
        badge: 'SYSTEM 2',
        title: 'Heurist Agent Network',
        subtitle: 'Expert agents running on Web3 infrastructure',
        description: '3 expert agents running on decentralized Heurist network, each specialized in a different field. Final decision made with weighted voting system.',
        web3Badge: '🔗 Decentralized AI',
        agents: [
          {
            name: 'Stats Agent',
            icon: '📊',
            color: 'green',
            weight: '40%',
            title: 'Statistics Expert',
            desc: 'Form analysis, goal averages, H2H comparison. Makes data-driven mathematical calculations.',
            skills: ['Form Analysis', 'Goal Prediction', 'H2H Evaluation'],
          },
          {
            name: 'Odds Agent',
            icon: '💰',
            color: 'yellow',
            weight: '35%',
            title: 'Odds Analyst',
            desc: 'Analyzes betting odds, detects value bets. Interprets market movements.',
            skills: ['Value Bet Detection', 'Odds Comparison', 'Market Analysis'],
          },
          {
            name: 'Strategy Agent',
            icon: '🧠',
            color: 'purple',
            weight: '25%',
            title: 'Strategy Expert',
            desc: 'Determines risk management and optimal betting strategy. Evaluates other agents outputs.',
            skills: ['Risk Management', 'Stake Suggestion', 'Portfolio Strategy'],
          },
        ],
        weightedSystem: {
          title: 'Weighted Voting System',
          desc: "Each agent's opinion is weighted according to their expertise",
        },
      },
      comparison: {
        title: 'Why Two Systems?',
        subtitle: 'Different approaches, more reliable results',
        items: [
          { icon: '🎯', title: 'Cross Validation', desc: 'Confidence increases when two systems reach same conclusion' },
          { icon: '🔄', title: 'Different Perspectives', desc: 'AIs provide overview, Agents provide expert view' },
          { icon: '⚖️', title: 'Balance Control', desc: 'If one system errs, the other balances' },
          { icon: '📈', title: '92% Agreement Rate', desc: 'Systems usually predict in same direction' },
        ],
      },
      features: {
        title: 'Platform Features',
        subtitle: 'Everything professional bettors need',
        items: [
          { icon: '🤖', title: '7 AI Models', desc: '4 Elite AI + 3 Expert Agents working together' },
          { icon: '🎯', title: '85%+ Accuracy', desc: 'High success rate with dual system' },
          { icon: '⚡', title: 'Real-Time', desc: 'Instant odds changes and live analysis' },
          { icon: '💎', title: 'Value Bet', desc: 'Automatically catch bookmaker mistakes' },
          { icon: '📊', title: '50+ Leagues', desc: 'All major leagues worldwide' },
          { icon: '🔒', title: 'Secure', desc: 'Your data is encrypted and protected' },
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
          name: 'Trial',
          price: '$0',
          period: '/7 days',
          features: ['3 analyses per day', '4 AI models', 'Basic statistics', 'Email support'],
          cta: 'Try Free',
        },
        pro: {
          name: 'Pro',
          price: '$9.99',
          period: '/mo',
          popular: 'Most Popular',
          features: ['Unlimited analyses', '7 AI models (incl. Agents)', 'Value bet detection', 'Weighted consensus', 'Priority support', 'Telegram notifications'],
          cta: 'Go Pro',
        },
      },
      testimonials: {
        title: 'What Our Users Say',
        items: [
          { text: 'Two different systems reaching the same conclusion gives me great confidence. I now bet more consciously.', author: 'Michael K.', role: 'Professional Bettor' },
          { text: "The Agent system's weighted voting logic is amazing. I understand how important each data point is.", author: 'James Y.', role: 'Sports Analyst' },
          { text: 'AIs working with Web3 technology really make a difference. Results are very consistent.', author: 'David S.', role: 'Crypto & Betting Enthusiast' },
        ],
      },
      cta: {
        title: 'Try Two Powerful Systems',
        subtitle: 'Create a free account, discover the power of AI and Agents',
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
        poweredBy: 'Powered by Heurist Network',
      },
    },
    de: {
      hero: {
        badge: '🔗 Web3 + KI-Technologie',
        title: 'Zwei leistungsstarke Systeme für',
        titleHighlight: 'Fußballanalyse',
        subtitle: 'Die weltweit erste hybride Analyseplattform: 4 Elite-KI-Modelle + 3 Experten-Agenten arbeiten zusammen.',
        cta: 'Kostenlos starten',
        ctaSecondary: 'Wie es funktioniert',
        trustedBy: 'Über 10.000 Nutzer vertrauen uns',
      },
      systems: {
        title: 'Zwei unabhängige Analyse-Engines',
        subtitle: 'Zwei verschiedene Perspektiven für dasselbe Spiel',
      },
      aiSystem: {
        badge: 'SYSTEM 1',
        title: 'KI-Konsens-Engine',
        subtitle: 'Die 4 leistungsstärksten KI-Modelle der Welt analysieren gemeinsam',
        description: 'Claude, GPT-4, Gemini und Heurist-Modelle arbeiten gleichzeitig. Jedes führt unabhängige Analysen durch.',
        features: [
          { icon: '🧠', title: 'Claude Sonnet', desc: 'Anthropics fortschrittlichstes Modell' },
          { icon: '⚡', title: 'GPT-4 Turbo', desc: 'OpenAIs Flaggschiff' },
          { icon: '💎', title: 'Gemini Pro', desc: 'Googles KI' },
          { icon: '🔗', title: 'Heurist LLM', desc: 'Web3-basiert - Dezentrale Berechnung' },
        ],
        howItWorks: [
          { step: '1', title: 'Datensammlung', desc: 'Form-, Quoten- und H2H-Daten kompiliert' },
          { step: '2', title: 'Parallele Analyse', desc: '4 KIs analysieren gleichzeitig' },
          { step: '3', title: 'Abstimmung', desc: 'Ergebnisse durch Abstimmung kombiniert' },
          { step: '4', title: 'Konsens', desc: 'Vorhersage mit höchster Übereinstimmung' },
        ],
      },
      agentSystem: {
        badge: 'SYSTEM 2',
        title: 'Heurist-Agent-Netzwerk',
        subtitle: 'Experten-Agenten auf Web3-Infrastruktur',
        description: '3 Experten-Agenten im dezentralen Heurist-Netzwerk, jeder auf ein anderes Feld spezialisiert.',
        web3Badge: '🔗 Dezentrale KI',
        agents: [
          { name: 'Stats Agent', icon: '📊', color: 'green', weight: '40%', title: 'Statistik-Experte', desc: 'Formanalyse, Tordurchschnitte, H2H-Vergleich.', skills: ['Formanalyse', 'Torvorhersage', 'H2H-Bewertung'] },
          { name: 'Odds Agent', icon: '💰', color: 'yellow', weight: '35%', title: 'Quoten-Analyst', desc: 'Analysiert Wettquoten, erkennt Value Bets.', skills: ['Value-Bet-Erkennung', 'Quotenvergleich', 'Marktanalyse'] },
          { name: 'Strategy Agent', icon: '🧠', color: 'purple', weight: '25%', title: 'Strategie-Experte', desc: 'Bestimmt Risikomanagement und optimale Wettstrategie.', skills: ['Risikomanagement', 'Einsatzvorschlag', 'Portfolio-Strategie'] },
        ],
        weightedSystem: { title: 'Gewichtetes Abstimmungssystem', desc: 'Jede Agentenmeinung wird nach Expertise gewichtet' },
      },
      comparison: {
        title: 'Warum zwei Systeme?',
        subtitle: 'Unterschiedliche Ansätze, zuverlässigere Ergebnisse',
        items: [
          { icon: '🎯', title: 'Kreuzvalidierung', desc: 'Vertrauen steigt, wenn beide Systeme übereinstimmen' },
          { icon: '🔄', title: 'Verschiedene Perspektiven', desc: 'KIs bieten Überblick, Agenten Expertenansicht' },
          { icon: '⚖️', title: 'Balance-Kontrolle', desc: 'Wenn ein System irrt, gleicht das andere aus' },
          { icon: '📈', title: '92% Übereinstimmung', desc: 'Systeme prognostizieren meist gleich' },
        ],
      },
      features: {
        title: 'Plattform-Funktionen',
        subtitle: 'Alles, was professionelle Wetter brauchen',
        items: [
          { icon: '🤖', title: '7 KI-Modelle', desc: '4 Elite-KI + 3 Experten-Agenten' },
          { icon: '🎯', title: '85%+ Genauigkeit', desc: 'Hohe Erfolgsquote mit Dual-System' },
          { icon: '⚡', title: 'Echtzeit', desc: 'Sofortige Quotenänderungen' },
          { icon: '💎', title: 'Value Bet', desc: 'Buchmacher-Fehler automatisch erkennen' },
          { icon: '📊', title: '50+ Ligen', desc: 'Alle großen Ligen weltweit' },
          { icon: '🔒', title: 'Sicher', desc: 'Ihre Daten werden verschlüsselt' },
        ],
      },
      stats: { matches: 'Tägliche Spiele', accuracy: 'Genauigkeitsrate', users: 'Aktive Nutzer', leagues: 'Unterstützte Ligen' },
      pricing: {
        title: 'Einfache Preisgestaltung',
        subtitle: 'Keine versteckten Gebühren',
        free: { name: 'Testversion', price: '€0', period: '/7 Tage', features: ['3 Analysen pro Tag', '4 KI-Modelle', 'Grundlegende Statistiken', 'E-Mail-Support'], cta: 'Kostenlos testen' },
        pro: { name: 'Pro', price: '€9,99', period: '/Mo', popular: 'Am beliebtesten', features: ['Unbegrenzte Analysen', '7 KI-Modelle (inkl. Agenten)', 'Value-Bet-Erkennung', 'Gewichteter Konsens', 'Prioritäts-Support', 'Telegram-Benachrichtigungen'], cta: 'Pro werden' },
      },
      testimonials: {
        title: 'Was unsere Nutzer sagen',
        items: [
          { text: 'Zwei verschiedene Systeme, die zum gleichen Ergebnis kommen, geben mir großes Vertrauen.', author: 'Michael K.', role: 'Professioneller Wetter' },
          { text: 'Die gewichtete Abstimmungslogik des Agent-Systems ist erstaunlich.', author: 'Thomas Y.', role: 'Sportanalyst' },
          { text: 'KIs, die mit Web3-Technologie arbeiten, machen wirklich einen Unterschied.', author: 'David S.', role: 'Krypto & Wett-Enthusiast' },
        ],
      },
      cta: { title: 'Zwei leistungsstarke Systeme testen', subtitle: 'Kostenloses Konto erstellen', button: 'Kostenloses Konto erstellen' },
      footer: { product: 'Produkt', features: 'Funktionen', pricing: 'Preise', demo: 'Demo', company: 'Unternehmen', about: 'Über uns', blog: 'Blog', careers: 'Karriere', legal: 'Rechtliches', privacy: 'Datenschutz', terms: 'AGB', copyright: '© 2024 Football Analytics Pro. Alle Rechte vorbehalten.', poweredBy: 'Powered by Heurist Network' },
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
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-purple-500/10 to-blue-500/10 border border-purple-500/20 rounded-full text-purple-400 text-sm font-medium mb-8">
              {l.hero.badge}
            </div>

            <h1 className="text-5xl md:text-7xl font-bold text-white mb-6 leading-tight">
              {l.hero.title}{' '}
              <span className="bg-gradient-to-r from-green-400 via-blue-500 to-purple-500 bg-clip-text text-transparent">
                {l.hero.titleHighlight}
              </span>
            </h1>

            <p className="text-xl text-gray-400 mb-10 max-w-2xl mx-auto leading-relaxed">
              {l.hero.subtitle}
            </p>

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

      {/* Two Systems Title */}
      <section className="py-10 px-4">
        <div className="max-w-7xl mx-auto text-center">
          <h2 className="text-4xl font-bold text-white mb-4">{l.systems.title}</h2>
          <p className="text-xl text-gray-400">{l.systems.subtitle}</p>
        </div>
      </section>

      {/* System 1: AI Consensus Engine */}
      <section className="py-16 px-4">
        <div className="max-w-7xl mx-auto">
          <div className="p-8 md:p-12 bg-gradient-to-br from-blue-900/20 to-cyan-900/20 border border-blue-500/30 rounded-3xl">
            <div className="flex items-center gap-3 mb-6">
              <span className="px-3 py-1 bg-blue-500/20 text-blue-400 text-sm font-bold rounded-full">{l.aiSystem.badge}</span>
              <span className="text-2xl">🤖</span>
            </div>
            
            <h3 className="text-3xl md:text-4xl font-bold text-white mb-4">{l.aiSystem.title}</h3>
            <p className="text-xl text-blue-200 mb-4">{l.aiSystem.subtitle}</p>
            <p className="text-gray-400 mb-10 max-w-3xl">{l.aiSystem.description}</p>

            {/* AI Models Grid */}
            <div className="grid md:grid-cols-4 gap-4 mb-10">
              {l.aiSystem.features.map((ai, idx) => (
                <div key={idx} className="p-5 bg-gray-800/50 backdrop-blur border border-gray-700/50 rounded-2xl hover:border-blue-500/50 transition-colors">
                  <div className="text-3xl mb-3">{ai.icon}</div>
                  <h4 className="text-lg font-bold text-white mb-2">{ai.title}</h4>
                  <p className="text-sm text-gray-400">{ai.desc}</p>
                </div>
              ))}
            </div>

            {/* How It Works */}
            <div className="p-6 bg-gray-900/50 rounded-2xl">
              <div className="flex flex-wrap items-center justify-center gap-4">
                {l.aiSystem.howItWorks.map((step, idx) => (
                  <div key={idx} className="flex items-center gap-3">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 bg-blue-500 text-white font-bold rounded-full flex items-center justify-center text-sm">{step.step}</div>
                      <div>
                        <div className="text-white font-medium">{step.title}</div>
                        <div className="text-xs text-gray-400">{step.desc}</div>
                      </div>
                    </div>
                    {idx < l.aiSystem.howItWorks.length - 1 && <span className="text-gray-600 text-xl">→</span>}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* System 2: Heurist Agent Network */}
      <section className="py-16 px-4">
        <div className="max-w-7xl mx-auto">
          <div className="p-8 md:p-12 bg-gradient-to-br from-purple-900/20 to-pink-900/20 border border-purple-500/30 rounded-3xl">
            <div className="flex items-center gap-3 mb-6">
              <span className="px-3 py-1 bg-purple-500/20 text-purple-400 text-sm font-bold rounded-full">{l.agentSystem.badge}</span>
              <span className="px-3 py-1 bg-gradient-to-r from-purple-500/20 to-pink-500/20 text-pink-400 text-sm font-medium rounded-full">{l.agentSystem.web3Badge}</span>
            </div>
            
            <h3 className="text-3xl md:text-4xl font-bold text-white mb-4">{l.agentSystem.title}</h3>
            <p className="text-xl text-purple-200 mb-4">{l.agentSystem.subtitle}</p>
            <p className="text-gray-400 mb-10 max-w-3xl">{l.agentSystem.description}</p>

            {/* Agent Cards */}
            <div className="grid md:grid-cols-3 gap-6 mb-10">
              {l.agentSystem.agents.map((agent, idx) => {
                const colors: Record<string, string> = {
                  green: 'from-green-500/20 to-green-600/20 border-green-500/30 hover:border-green-400',
                  yellow: 'from-yellow-500/20 to-yellow-600/20 border-yellow-500/30 hover:border-yellow-400',
                  purple: 'from-purple-500/20 to-purple-600/20 border-purple-500/30 hover:border-purple-400',
                };
                const textColors: Record<string, string> = {
                  green: 'text-green-400',
                  yellow: 'text-yellow-400',
                  purple: 'text-purple-400',
                };
                return (
                  <div key={idx} className={`p-6 bg-gradient-to-br ${colors[agent.color]} border rounded-2xl transition-all hover:scale-[1.02]`}>
                    <div className="flex items-center justify-between mb-4">
                      <div className="text-4xl">{agent.icon}</div>
                      <div className={`px-3 py-1 bg-gray-900/50 rounded-full text-sm font-bold ${textColors[agent.color]}`}>
                        {agent.weight}
                      </div>
                    </div>
                    <h4 className="text-xl font-bold text-white mb-1">{agent.name}</h4>
                    <p className={`text-sm ${textColors[agent.color]} mb-3`}>{agent.title}</p>
                    <p className="text-gray-400 text-sm mb-4">{agent.desc}</p>
                    <div className="flex flex-wrap gap-2">
                      {agent.skills.map((skill, sidx) => (
                        <span key={sidx} className="px-2 py-1 bg-gray-900/50 text-gray-300 text-xs rounded-full">{skill}</span>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Weighted Voting Explanation */}
            <div className="p-6 bg-gray-900/50 rounded-2xl">
              <div className="text-center mb-4">
                <h4 className="text-xl font-bold text-white">{l.agentSystem.weightedSystem.title}</h4>
                <p className="text-gray-400">{l.agentSystem.weightedSystem.desc}</p>
              </div>
              <div className="flex items-center justify-center gap-2">
                <div className="flex items-center gap-2 px-4 py-2 bg-green-500/20 rounded-xl">
                  <span className="text-green-400 font-bold">📊 Stats</span>
                  <span className="text-white font-bold">40%</span>
                </div>
                <span className="text-gray-500 text-xl">+</span>
                <div className="flex items-center gap-2 px-4 py-2 bg-yellow-500/20 rounded-xl">
                  <span className="text-yellow-400 font-bold">💰 Odds</span>
                  <span className="text-white font-bold">35%</span>
                </div>
                <span className="text-gray-500 text-xl">+</span>
                <div className="flex items-center gap-2 px-4 py-2 bg-purple-500/20 rounded-xl">
                  <span className="text-purple-400 font-bold">🧠 Strategy</span>
                  <span className="text-white font-bold">25%</span>
                </div>
                <span className="text-gray-500 text-xl">=</span>
                <div className="px-4 py-2 bg-gradient-to-r from-green-500 to-purple-500 rounded-xl">
                  <span className="text-white font-bold">🎯 Final</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Why Two Systems */}
      <section className="py-16 px-4 bg-gradient-to-b from-transparent via-gray-800/20 to-transparent">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-white mb-4">{l.comparison.title}</h2>
            <p className="text-xl text-gray-400">{l.comparison.subtitle}</p>
          </div>
          <div className="grid md:grid-cols-4 gap-6">
            {l.comparison.items.map((item, idx) => (
              <div key={idx} className="p-6 bg-gray-800/50 backdrop-blur border border-gray-700/50 rounded-2xl text-center hover:border-green-500/50 transition-colors">
                <div className="text-4xl mb-4">{item.icon}</div>
                <h3 className="text-lg font-bold text-white mb-2">{item.title}</h3>
                <p className="text-sm text-gray-400">{item.desc}</p>
              </div>
            ))}
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
          <div className="p-12 bg-gradient-to-br from-green-500/20 to-purple-500/20 border border-green-500/30 rounded-3xl">
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
              <p className="text-gray-400 text-sm mb-2">AI-powered football analysis platform</p>
              <p className="text-purple-400 text-xs">{l.footer.poweredBy}</p>
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
