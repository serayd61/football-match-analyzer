'use client';

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useLanguage } from '@/components/LanguageProvider';
import LanguageSelector from '@/components/LanguageSelector';

// 📹 YOUTUBE VIDEO ID - Buraya kendi video ID'ni yaz
const YOUTUBE_VIDEO_ID = 'YOUR_VIDEO_ID_HERE'; // Örnek: 'dQw4w9WgXcQ'

export default function HomePage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const { lang } = useLanguage();
  const [showVideoModal, setShowVideoModal] = useState(false);

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
      stats: {
        matches: 'Analiz Edilen Maç',
        accuracy: 'Doğruluk Oranı',
        users: 'Aktif Kullanıcı',
        leagues: 'Desteklenen Lig',
      },
      systems: {
        title: 'İki Bağımsız Analiz Motoru',
        subtitle: 'Aynı maç için iki farklı perspektif, maksimum doğruluk',
      },
      aiSystem: {
        badge: 'SİSTEM 1',
        title: 'AI Consensus Engine',
        subtitle: 'Dünyanın en güçlü 4 AI modeli birlikte analiz yapar',
        description: 'Claude (Anthropic), GPT-4 (OpenAI), Gemini (Google) ve Perplexity modelleri aynı anda çalışır. Minimum 2/4 uzlaşı ile tahmin üretilir.',
        features: ['4 AI Model Paralel', 'Consensus Voting', 'Güven Skoru', 'Detaylı Analiz'],
      },
      agentSystem: {
        badge: 'SİSTEM 2',
        title: 'Heurist Agent Network',
        subtitle: 'Merkezi olmayan AI Agent\'lar',
        description: '3 uzman agent (Scout, Analyst, Predictor) Heurist ağı üzerinde bağımsız çalışır. Blockchain destekli şeffaf tahminler.',
        features: ['3 Uzman Agent', 'Web3 Destekli', 'Şeffaf Sonuçlar', 'Gerçek Zamanlı'],
      },
      quadBrain: {
        badge: '🧠 YENİ TEKNOLOJİ',
        title: 'Quad-Brain AI Ensemble',
        subtitle: '4 Uzman AI, 1 Akıllı Karar',
        description: 'Her AI modeli kendi uzmanlık alanında analiz yapar. Çatışma durumunda Debate Protocol devreye girer ve en doğru tahmin üretilir.',
        models: [
          { name: 'Claude', role: 'Taktik Uzmanı', desc: 'Momentum, psikoloji ve taktik analizi', color: 'orange' },
          { name: 'GPT-4', role: 'İstatistik Motoru', desc: 'xG, Poisson dağılımı, matematiksel modeller', color: 'green' },
          { name: 'Gemini', role: 'Pattern Dedektifi', desc: 'H2H kalıpları, seri analizi, anomali tespiti', color: 'blue' },
          { name: 'Perplexity', role: 'Haber Avcısı', desc: 'Sakatlıklar, son dakika haberleri, kadro bilgileri', color: 'purple' },
        ],
        features: [
          { icon: '🎯', title: 'Debate Protocol', desc: 'AI\'lar anlaşamadığında tartışır ve en güçlü argüman kazanır' },
          { icon: '⚖️', title: 'Dinamik Ağırlıklar', desc: 'Veri kalitesine göre her AI\'ın etkisi otomatik ayarlanır' },
          { icon: '📊', title: 'Performans Takibi', desc: 'Her AI\'ın başarı oranı gerçek zamanlı ölçülür' },
          { icon: '🔥', title: 'Value Bet Tespiti', desc: 'Bahisçi hatalarını otomatik yakalar' },
        ],
      },
      features: {
        title: 'Neden Football Analytics Pro?',
        subtitle: 'Rakiplerinizden bir adım önde olmanızı sağlayan özellikler',
        items: [
          { icon: '🤖', title: '7 AI Model', desc: '4 AI + 3 Heurist Agent bir arada çalışır' },
          { icon: '🎯', title: '%70+ Doğruluk', desc: 'Consensus sistemi ile yüksek başarı oranı' },
          { icon: '⚡', title: 'Gerçek Zamanlı', desc: 'Anlık oran değişiklikleri ve canlı analiz' },
          { icon: '💎', title: 'Value Bet Tespiti', desc: 'Bookmaker hatalarını otomatik yakala' },
          { icon: '📊', title: '27+ Lig', desc: 'Avrupa\'nın büyük ligleri kapsanır' },
          { icon: '🔒', title: 'Güvenli & Gizli', desc: 'Verileriniz şifrelenerek korunur' },
        ],
      },
      tipsterLeague: {
        badge: '🏆 YENİ',
        title: 'Tipster League',
        subtitle: 'Kupon oluştur, yarış, kazan!',
        description: 'Kendi kuponlarını oluştur, diğer kullanıcılarla yarış ve liderlik tablosunda yüksel. En iyi tipster\'lar ödül kazanır!',
        features: [
          { icon: '📝', title: 'Kupon Oluştur', desc: 'AI destekli maçlardan kuponunu yap' },
          { icon: '⭐', title: 'Puan Kazan', desc: 'Doğru tahminler ile puan topla' },
          { icon: '🏅', title: 'Liderlik Tablosu', desc: 'Haftalık ve aylık sıralamalar' },
          { icon: '🎁', title: 'Ödül Kazan', desc: 'En iyiler premium üyelik kazanır' },
        ],
        howItWorks: [
          { step: '1', title: 'Üye Ol', desc: 'Ücretsiz hesap oluştur' },
          { step: '2', title: 'Analiz Al', desc: 'AI tahminlerini incele' },
          { step: '3', title: 'Kupon Yap', desc: 'Maçları seç, kuponunu oluştur' },
          { step: '4', title: 'Yarış', desc: 'Liderlik tablosunda yüksel' },
        ],
        multipliers: {
          title: 'Puan Çarpanları',
          items: [
            { type: 'Tekli', multiplier: '×10' },
            { type: '2\'li', multiplier: '×15' },
            { type: '3\'lü', multiplier: '×25' },
            { type: '4+', multiplier: '×50' },
          ],
        },
      },
      pricing: {
        title: 'Basit & Şeffaf Fiyatlandırma',
        subtitle: 'Sizin için en uygun planı seçin',
        free: {
          name: 'Ücretsiz',
          price: '$0',
          period: '/ay',
          features: ['Günlük 3 maç analizi', 'Temel istatistikler', 'Tipster League katılım', 'Email destek'],
          cta: 'Başla',
        },
        pro: {
          badge: 'EN POPÜLER',
          name: 'Pro',
          price: '$19.99',
          period: '/ay',
          features: ['Sınırsız maç analizi', 'Tüm AI + Agent sistemleri', 'Value Bet tespiti', 'Kupon oluşturma', 'Öncelikli destek', 'API erişimi'],
          cta: 'Pro\'ya Geç',
        },
      },
      testimonials: {
        title: 'Kullanıcılarımız Ne Diyor?',
        items: [
          { text: 'İki farklı sistem harika bir fikir. Bazen AI\'lar farklı düşünüyor, o zaman dikkatli oluyorum.', author: 'Ahmet K.', role: 'Pro Üye' },
          { text: 'Heurist Agent\'ları çok ilginç. Web3 dünyasını bahis ile birleştirmişler.', author: 'Mehmet Y.', role: 'Kripto Yatırımcısı' },
          { text: 'Tipster League sayesinde ayın en iyi tahminleri yapanı oldum!', author: 'Can S.', role: 'Tipster League Şampiyonu' },
        ],
      },
      cta: {
        title: 'İki Güçlü Sistemi Deneyin',
        subtitle: 'Ücretsiz hesap oluşturun, Tipster League\'de yarışın!',
        button: 'Ücretsiz Hesap Oluştur',
      },
      footer: {
        product: 'Ürün',
        features: 'Özellikler',
        pricing: 'Fiyatlandırma',
        demo: 'Demo',
        tipsterLeague: 'Tipster League',
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
        titleHighlight: 'Football Analysis',
        subtitle: 'The world\'s first hybrid analysis platform: 4 Elite AI models + 3 Expert Agents working together. Unique accuracy with agents running on decentralized Heurist network.',
        cta: 'Start Free',
        ctaSecondary: 'How It Works?',
        trustedBy: '10,000+ users trust us',
      },
      stats: {
        matches: 'Matches Analyzed',
        accuracy: 'Accuracy Rate',
        users: 'Active Users',
        leagues: 'Leagues Supported',
      },
      systems: {
        title: 'Two Independent Analysis Engines',
        subtitle: 'Two different perspectives for the same match, maximum accuracy',
      },
      aiSystem: {
        badge: 'SYSTEM 1',
        title: 'AI Consensus Engine',
        subtitle: 'World\'s most powerful 4 AI models analyze together',
        description: 'Claude (Anthropic), GPT-4 (OpenAI), Gemini (Google) and Perplexity models work simultaneously. Predictions generated with minimum 2/4 consensus.',
        features: ['4 AI Models Parallel', 'Consensus Voting', 'Confidence Score', 'Detailed Analysis'],
      },
      agentSystem: {
        badge: 'SYSTEM 2',
        title: 'Heurist Agent Network',
        subtitle: 'Decentralized AI Agents',
        description: '3 expert agents (Scout, Analyst, Predictor) work independently on Heurist network. Blockchain-powered transparent predictions.',
        features: ['3 Expert Agents', 'Web3 Powered', 'Transparent Results', 'Real-Time'],
      },
      quadBrain: {
        badge: '🧠 NEW TECHNOLOGY',
        title: 'Quad-Brain AI Ensemble',
        subtitle: '4 Expert AIs, 1 Smart Decision',
        description: 'Each AI model analyzes in its own expertise area. In case of conflict, the Debate Protocol kicks in and produces the most accurate prediction.',
        models: [
          { name: 'Claude', role: 'Tactical Expert', desc: 'Momentum, psychology and tactical analysis', color: 'orange' },
          { name: 'GPT-4', role: 'Statistics Engine', desc: 'xG, Poisson distribution, mathematical models', color: 'green' },
          { name: 'Gemini', role: 'Pattern Detective', desc: 'H2H patterns, streak analysis, anomaly detection', color: 'blue' },
          { name: 'Perplexity', role: 'News Hunter', desc: 'Injuries, last-minute news, lineup info', color: 'purple' },
        ],
        features: [
          { icon: '🎯', title: 'Debate Protocol', desc: 'When AIs disagree, they debate and the strongest argument wins' },
          { icon: '⚖️', title: 'Dynamic Weights', desc: 'Each AI\'s influence is automatically adjusted based on data quality' },
          { icon: '📊', title: 'Performance Tracking', desc: 'Each AI\'s success rate is measured in real-time' },
          { icon: '🔥', title: 'Value Bet Detection', desc: 'Automatically catches bookmaker mistakes' },
        ],
      },
      features: {
        title: 'Why Football Analytics Pro?',
        subtitle: 'Features that keep you ahead of the competition',
        items: [
          { icon: '🤖', title: '7 AI Models', desc: '4 AI + 3 Heurist Agents working together' },
          { icon: '🎯', title: '70%+ Accuracy', desc: 'High success rate with consensus system' },
          { icon: '⚡', title: 'Real-Time', desc: 'Instant odds changes and live analysis' },
          { icon: '💎', title: 'Value Bet Detection', desc: 'Automatically catch bookmaker mistakes' },
          { icon: '📊', title: '27+ Leagues', desc: 'Major European leagues covered' },
          { icon: '🔒', title: 'Secure & Private', desc: 'Your data is encrypted and protected' },
        ],
      },
      tipsterLeague: {
        badge: '🏆 NEW',
        title: 'Tipster League',
        subtitle: 'Create coupons, compete, win!',
        description: 'Create your own coupons, compete with other users and climb the leaderboard. Top tipsters win prizes!',
        features: [
          { icon: '📝', title: 'Create Coupons', desc: 'Make your coupon from AI-powered matches' },
          { icon: '⭐', title: 'Earn Points', desc: 'Collect points with correct predictions' },
          { icon: '🏅', title: 'Leaderboard', desc: 'Weekly and monthly rankings' },
          { icon: '🎁', title: 'Win Prizes', desc: 'Top performers get premium membership' },
        ],
        howItWorks: [
          { step: '1', title: 'Sign Up', desc: 'Create free account' },
          { step: '2', title: 'Get Analysis', desc: 'Review AI predictions' },
          { step: '3', title: 'Make Coupon', desc: 'Select matches, create your coupon' },
          { step: '4', title: 'Compete', desc: 'Climb the leaderboard' },
        ],
        multipliers: {
          title: 'Point Multipliers',
          items: [
            { type: 'Single', multiplier: '×10' },
            { type: 'Double', multiplier: '×15' },
            { type: 'Triple', multiplier: '×25' },
            { type: '4+', multiplier: '×50' },
          ],
        },
      },
      pricing: {
        title: 'Simple & Transparent Pricing',
        subtitle: 'Choose the plan that fits you best',
        free: {
          name: 'Free',
          price: '$0',
          period: '/month',
          features: ['3 match analyses daily', 'Basic statistics', 'Tipster League access', 'Email support'],
          cta: 'Get Started',
        },
        pro: {
          badge: 'MOST POPULAR',
          name: 'Pro',
          price: '$19.99',
          period: '/month',
          features: ['Unlimited match analyses', 'All AI + Agent systems', 'Value Bet detection', 'Coupon creation', 'Priority support', 'API access'],
          cta: 'Go Pro',
        },
      },
      testimonials: {
        title: 'What Our Users Say',
        items: [
          { text: 'Two different systems is a great idea. Sometimes AIs think differently, then I\'m more careful.', author: 'John D.', role: 'Pro Member' },
          { text: 'Heurist Agents are very interesting. They combined Web3 world with betting.', author: 'Mike R.', role: 'Crypto Investor' },
          { text: 'Thanks to Tipster League I became the top predictor of the month!', author: 'Chris S.', role: 'Tipster League Champion' },
        ],
      },
      cta: {
        title: 'Try Two Powerful Systems',
        subtitle: 'Create free account, compete in Tipster League!',
        button: 'Create Free Account',
      },
      footer: {
        product: 'Product',
        features: 'Features',
        pricing: 'Pricing',
        demo: 'Demo',
        tipsterLeague: 'Tipster League',
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
  };

  const labelsDE = {
    hero: {
      badge: '🔗 Web3 + KI-Technologie',
      title: 'Zwei leistungsstarke Systeme für',
      titleHighlight: 'Fußball-Analyse',
      subtitle: 'Die weltweit erste hybride Analyseplattform: 4 Elite-KI-Modelle + 3 Experten-Agenten arbeiten zusammen. Einzigartige Genauigkeit mit Agenten auf dem dezentralen Heurist-Netzwerk.',
      cta: 'Kostenlos starten',
      ctaSecondary: 'Wie funktioniert es?',
      trustedBy: '10.000+ Nutzer vertrauen uns',
    },
    stats: {
      matches: 'Analysierte Spiele',
      accuracy: 'Genauigkeitsrate',
      users: 'Aktive Nutzer',
      leagues: 'Unterstützte Ligen',
    },
    systems: {
      title: 'Zwei unabhängige Analyse-Engines',
      subtitle: 'Zwei verschiedene Perspektiven für dasselbe Spiel, maximale Genauigkeit',
    },
    aiSystem: {
      badge: 'SYSTEM 1',
      title: 'AI Consensus Engine',
      subtitle: 'Die 4 leistungsstärksten KI-Modelle der Welt analysieren gemeinsam',
      description: 'Claude (Anthropic), GPT-4 (OpenAI), Gemini (Google) und Perplexity arbeiten gleichzeitig. Vorhersagen mit mindestens 2/4 Konsens.',
      features: ['4 KI-Modelle Parallel', 'Konsens-Abstimmung', 'Konfidenzwert', 'Detaillierte Analyse'],
    },
    agentSystem: {
      badge: 'SYSTEM 2',
      title: 'Heurist Agent Network',
      subtitle: 'Dezentralisierte KI-Agenten',
      description: '3 Experten-Agenten (Scout, Analyst, Predictor) arbeiten unabhängig im Heurist-Netzwerk. Blockchain-gestützte transparente Vorhersagen.',
      features: ['3 Experten-Agenten', 'Web3-Unterstützung', 'Transparente Ergebnisse', 'Echtzeit'],
    },
    quadBrain: {
      badge: '🧠 NEUE TECHNOLOGIE',
      title: 'Quad-Brain KI-Ensemble',
      subtitle: '4 Experten-KIs, 1 intelligente Entscheidung',
      description: 'Jedes KI-Modell analysiert in seinem eigenen Fachgebiet. Bei Konflikten greift das Debate Protocol ein und liefert die genaueste Vorhersage.',
      models: [
        { name: 'Claude', role: 'Taktik-Experte', desc: 'Momentum-, Psychologie- und Taktikanalyse', color: 'orange' },
        { name: 'GPT-4', role: 'Statistik-Engine', desc: 'xG, Poisson-Verteilung, mathematische Modelle', color: 'green' },
        { name: 'Gemini', role: 'Pattern-Detektiv', desc: 'H2H-Muster, Serienanalyse, Anomalie-Erkennung', color: 'blue' },
        { name: 'Perplexity', role: 'News-Jäger', desc: 'Verletzungen, Last-Minute-News, Aufstellungen', color: 'purple' },
      ],
      features: [
        { icon: '🎯', title: 'Debate Protocol', desc: 'Bei Uneinigkeit debattieren die KIs und das stärkste Argument gewinnt' },
        { icon: '⚖️', title: 'Dynamische Gewichtung', desc: 'Der Einfluss jeder KI wird automatisch basierend auf Datenqualität angepasst' },
        { icon: '📊', title: 'Performance-Tracking', desc: 'Die Erfolgsrate jeder KI wird in Echtzeit gemessen' },
        { icon: '🔥', title: 'Value Bet Erkennung', desc: 'Erkennt automatisch Buchmacher-Fehler' },
      ],
    },
    features: {
      title: 'Warum Football Analytics Pro?',
      subtitle: 'Funktionen, die Sie der Konkurrenz einen Schritt voraus halten',
      items: [
        { icon: '🤖', title: '7 KI-Modelle', desc: '4 KI + 3 Heurist-Agenten arbeiten zusammen' },
        { icon: '🎯', title: '70%+ Genauigkeit', desc: 'Hohe Erfolgsrate durch Konsens-System' },
        { icon: '⚡', title: 'Echtzeit', desc: 'Sofortige Quotenänderungen und Live-Analyse' },
        { icon: '💎', title: 'Value Bet Erkennung', desc: 'Buchmacher-Fehler automatisch finden' },
        { icon: '📊', title: '27+ Ligen', desc: 'Große europäische Ligen abgedeckt' },
        { icon: '🔒', title: 'Sicher & Privat', desc: 'Ihre Daten werden verschlüsselt geschützt' },
      ],
    },
    tipsterLeague: {
      badge: '🏆 NEU',
      title: 'Tipster League',
      subtitle: 'Erstelle Wettscheine, konkurriere, gewinne!',
      description: 'Erstelle eigene Wettscheine, konkurriere mit anderen Nutzern und steige in der Rangliste auf. Top-Tipster gewinnen Preise!',
      features: [
        { icon: '📝', title: 'Wettschein erstellen', desc: 'Erstelle Wettscheine mit KI-gestützten Spielen' },
        { icon: '⭐', title: 'Punkte sammeln', desc: 'Sammle Punkte mit richtigen Vorhersagen' },
        { icon: '🏅', title: 'Rangliste', desc: 'Wöchentliche und monatliche Rankings' },
        { icon: '🎁', title: 'Preise gewinnen', desc: 'Top-Performer erhalten Premium-Mitgliedschaft' },
      ],
      howItWorks: [
        { step: '1', title: 'Registrieren', desc: 'Kostenloses Konto erstellen' },
        { step: '2', title: 'Analyse erhalten', desc: 'KI-Vorhersagen prüfen' },
        { step: '3', title: 'Wettschein erstellen', desc: 'Spiele auswählen, Wettschein erstellen' },
        { step: '4', title: 'Konkurrieren', desc: 'In der Rangliste aufsteigen' },
      ],
      multipliers: {
        title: 'Punktemultiplikatoren',
        items: [
          { type: 'Einzel', multiplier: '×10' },
          { type: 'Doppel', multiplier: '×15' },
          { type: 'Dreifach', multiplier: '×25' },
          { type: '4+', multiplier: '×50' },
        ],
      },
    },
    pricing: {
      title: 'Einfache & transparente Preise',
      subtitle: 'Wählen Sie den Plan, der am besten zu Ihnen passt',
      free: {
        name: 'Kostenlos',
        price: '€0',
        period: '/Monat',
        features: ['3 Spielanalysen täglich', 'Basis-Statistiken', 'Tipster League Zugang', 'E-Mail-Support'],
        cta: 'Loslegen',
      },
      pro: {
        badge: 'AM BELIEBTESTEN',
        name: 'Pro',
        price: '€19,99',
        period: '/Monat',
        features: ['Unbegrenzte Spielanalysen', 'Alle KI + Agent-Systeme', 'Value Bet Erkennung', 'Wettschein-Erstellung', 'Prioritäts-Support', 'API-Zugang'],
        cta: 'Pro werden',
      },
    },
    testimonials: {
      title: 'Was unsere Nutzer sagen',
      items: [
        { text: 'Zwei verschiedene Systeme sind eine großartige Idee. Manchmal denken KIs unterschiedlich, dann bin ich vorsichtiger.', author: 'Thomas M.', role: 'Pro-Mitglied' },
        { text: 'Heurist-Agenten sind sehr interessant. Sie haben Web3 mit Wetten kombiniert.', author: 'Stefan K.', role: 'Krypto-Investor' },
        { text: 'Dank Tipster League wurde ich zum Top-Predictor des Monats!', author: 'Markus H.', role: 'Tipster League Champion' },
      ],
    },
    cta: {
      title: 'Testen Sie zwei leistungsstarke Systeme',
      subtitle: 'Kostenloses Konto erstellen, in der Tipster League konkurrieren!',
      button: 'Kostenloses Konto erstellen',
    },
    footer: {
      product: 'Produkt',
      features: 'Funktionen',
      pricing: 'Preise',
      demo: 'Demo',
      tipsterLeague: 'Tipster League',
      company: 'Unternehmen',
      about: 'Über uns',
      blog: 'Blog',
      careers: 'Karriere',
      legal: 'Rechtliches',
      privacy: 'Datenschutz',
      terms: 'AGB',
      copyright: '© 2024 Football Analytics Pro. Alle Rechte vorbehalten.',
      poweredBy: 'Powered by Heurist Network',
    },
  };

  const allLabels = { ...labels, de: labelsDE };
  const l = allLabels[lang as keyof typeof allLabels] || labels.en;

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
              <button 
                onClick={() => setShowVideoModal(true)}
                className="px-8 py-4 bg-gray-800 hover:bg-gray-700 text-white font-semibold text-lg rounded-2xl border border-gray-700 transition-all flex items-center justify-center gap-2 hover:scale-105"
              >
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
              { value: '70%+', label: l.stats.accuracy },
              { value: '10K+', label: l.stats.users },
              { value: '27+', label: l.stats.leagues },
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
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">{l.systems.title}</h2>
          <p className="text-gray-400 text-lg">{l.systems.subtitle}</p>
        </div>
      </section>

      {/* Two Systems */}
      <section className="py-10 px-4">
        <div className="max-w-7xl mx-auto grid md:grid-cols-2 gap-8">
          {/* AI System */}
          <div className="bg-gradient-to-br from-blue-900/30 to-purple-900/30 border border-blue-500/20 rounded-3xl p-8">
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-blue-500/20 border border-blue-500/30 rounded-full text-blue-400 text-sm font-medium mb-4">
              {l.aiSystem.badge}
            </div>
            <h3 className="text-2xl font-bold text-white mb-2">{l.aiSystem.title}</h3>
            <p className="text-blue-300 mb-4">{l.aiSystem.subtitle}</p>
            <p className="text-gray-400 mb-6">{l.aiSystem.description}</p>
            <div className="flex flex-wrap gap-2">
              {l.aiSystem.features.map((f, idx) => (
                <span key={idx} className="px-3 py-1 bg-blue-500/10 border border-blue-500/20 rounded-full text-blue-300 text-sm">
                  {f}
                </span>
              ))}
            </div>
            <div className="mt-6 flex gap-4">
              <div className="flex -space-x-2">
                {['🤖', '🧠', '💎', '⚡'].map((e, i) => (
                  <div key={i} className="w-10 h-10 bg-blue-900/50 rounded-full border-2 border-blue-500/30 flex items-center justify-center">
                    {e}
                  </div>
                ))}
              </div>
              <div className="text-sm text-gray-400">
                Claude • GPT-4 • Gemini • Perplexity
              </div>
            </div>
          </div>

          {/* Agent System */}
          <div className="bg-gradient-to-br from-purple-900/30 to-pink-900/30 border border-purple-500/20 rounded-3xl p-8">
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-purple-500/20 border border-purple-500/30 rounded-full text-purple-400 text-sm font-medium mb-4">
              {l.agentSystem.badge}
            </div>
            <h3 className="text-2xl font-bold text-white mb-2">{l.agentSystem.title}</h3>
            <p className="text-purple-300 mb-4">{l.agentSystem.subtitle}</p>
            <p className="text-gray-400 mb-6">{l.agentSystem.description}</p>
            <div className="flex flex-wrap gap-2">
              {l.agentSystem.features.map((f, idx) => (
                <span key={idx} className="px-3 py-1 bg-purple-500/10 border border-purple-500/20 rounded-full text-purple-300 text-sm">
                  {f}
                </span>
              ))}
            </div>
            <div className="mt-6 flex gap-4">
              <div className="flex -space-x-2">
                {['🔍', '📊', '🎯'].map((e, i) => (
                  <div key={i} className="w-10 h-10 bg-purple-900/50 rounded-full border-2 border-purple-500/30 flex items-center justify-center">
                    {e}
                  </div>
                ))}
              </div>
              <div className="text-sm text-gray-400">
                Scout • Analyst • Predictor
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Quad-Brain Section */}
      {'quadBrain' in l && (
        <section className="py-20 px-4 bg-gradient-to-br from-cyan-900/20 via-purple-900/20 to-pink-900/20">
          <div className="max-w-7xl mx-auto">
            <div className="text-center mb-12">
              <div className="inline-flex items-center gap-2 px-4 py-2 bg-cyan-500/20 border border-cyan-500/30 rounded-full text-cyan-400 text-sm font-medium mb-4">
                {(l as any).quadBrain.badge}
              </div>
              <h2 className="text-3xl md:text-5xl font-bold text-white mb-4">{(l as any).quadBrain.title}</h2>
              <p className="text-xl text-cyan-300 mb-2">{(l as any).quadBrain.subtitle}</p>
              <p className="text-gray-400 max-w-3xl mx-auto">{(l as any).quadBrain.description}</p>
            </div>

            {/* AI Models Grid */}
            <div className="grid md:grid-cols-4 gap-6 mb-12">
              {(l as any).quadBrain.models.map((model: any, idx: number) => {
                const colors: any = {
                  orange: 'from-orange-500 to-amber-600 border-orange-500/30 bg-orange-500/10',
                  green: 'from-emerald-500 to-green-600 border-emerald-500/30 bg-emerald-500/10',
                  blue: 'from-blue-500 to-indigo-600 border-blue-500/30 bg-blue-500/10',
                  purple: 'from-purple-500 to-violet-600 border-purple-500/30 bg-purple-500/10',
                };
                const colorClass = colors[model.color] || colors.blue;
                return (
                  <div key={idx} className={`rounded-2xl p-6 border ${colorClass.split(' ').slice(1).join(' ')} backdrop-blur-xl`}>
                    <div className={`w-14 h-14 rounded-xl bg-gradient-to-br ${colorClass.split(' ').slice(0, 2).join(' ')} flex items-center justify-center mb-4 shadow-lg`}>
                      <span className="text-2xl">🧠</span>
                    </div>
                    <h3 className="text-xl font-bold text-white mb-1">{model.name}</h3>
                    <p className="text-cyan-400 text-sm font-medium mb-2">{model.role}</p>
                    <p className="text-gray-400 text-sm">{model.desc}</p>
                  </div>
                );
              })}
            </div>

            {/* Features */}
            <div className="grid md:grid-cols-4 gap-6 mb-12">
              {(l as any).quadBrain.features.map((feature: any, idx: number) => (
                <div key={idx} className="bg-gray-800/50 border border-cyan-500/20 rounded-2xl p-6 text-center hover:border-cyan-500/40 transition-all">
                  <div className="text-4xl mb-4">{feature.icon}</div>
                  <h3 className="text-lg font-bold text-white mb-2">{feature.title}</h3>
                  <p className="text-gray-400 text-sm">{feature.desc}</p>
                </div>
              ))}
            </div>

            {/* Debate Protocol Visual */}
            <div className="bg-gradient-to-r from-gray-800/50 to-gray-900/50 border border-cyan-500/20 rounded-3xl p-8">
              <div className="flex flex-col md:flex-row items-center justify-center gap-8">
                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 rounded-full bg-gradient-to-br from-orange-500 to-amber-600 flex items-center justify-center text-2xl shadow-lg shadow-orange-500/30">🧠</div>
                  <div className="text-white font-semibold">Claude</div>
                </div>
                <div className="text-cyan-400 text-3xl">⚔️</div>
                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 rounded-full bg-gradient-to-br from-emerald-500 to-green-600 flex items-center justify-center text-2xl shadow-lg shadow-emerald-500/30">🧠</div>
                  <div className="text-white font-semibold">GPT-4</div>
                </div>
                <div className="text-yellow-400 text-3xl animate-pulse">→</div>
                <div className="flex items-center gap-4">
                  <div className="w-20 h-20 rounded-full bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center text-3xl shadow-lg shadow-cyan-500/30 ring-4 ring-cyan-500/30">🏆</div>
                  <div>
                    <div className="text-white font-bold text-lg">Consensus</div>
                    <div className="text-cyan-400 text-sm">En İyi Tahmin</div>
                  </div>
                </div>
              </div>
              <p className="text-center text-gray-400 mt-6 text-sm">
                AI modelleri farklı düşündüğünde, Debate Protocol devreye girer ve en güçlü argümanlar kazanır.
              </p>
            </div>
          </div>
        </section>
      )}

      {/* Features */}
      <section className="py-20 px-4">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">{l.features.title}</h2>
            <p className="text-gray-400 text-lg">{l.features.subtitle}</p>
          </div>
          <div className="grid md:grid-cols-3 gap-6">
            {l.features.items.map((item, idx) => (
              <div key={idx} className="bg-gray-800/50 border border-gray-700/50 rounded-2xl p-6 hover:border-green-500/30 transition-all">
                <div className="text-4xl mb-4">{item.icon}</div>
                <h3 className="text-xl font-bold text-white mb-2">{item.title}</h3>
                <p className="text-gray-400">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Tipster League Section */}
      <section className="py-20 px-4 bg-gradient-to-br from-orange-900/20 to-yellow-900/20">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-12">
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-orange-500/20 border border-orange-500/30 rounded-full text-orange-400 text-sm font-medium mb-4">
              {l.tipsterLeague.badge}
            </div>
            <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">{l.tipsterLeague.title}</h2>
            <p className="text-xl text-orange-300 mb-2">{l.tipsterLeague.subtitle}</p>
            <p className="text-gray-400 max-w-2xl mx-auto">{l.tipsterLeague.description}</p>
          </div>

          {/* Features Grid */}
          <div className="grid md:grid-cols-4 gap-6 mb-12">
            {l.tipsterLeague.features.map((item, idx) => (
              <div key={idx} className="bg-gray-800/50 border border-orange-500/20 rounded-2xl p-6 text-center hover:border-orange-500/40 transition-all">
                <div className="text-4xl mb-4">{item.icon}</div>
                <h3 className="text-lg font-bold text-white mb-2">{item.title}</h3>
                <p className="text-gray-400 text-sm">{item.desc}</p>
              </div>
            ))}
          </div>

          {/* How It Works */}
          <div className="bg-gray-800/30 border border-gray-700/50 rounded-2xl p-8 mb-12">
            <div className="grid md:grid-cols-4 gap-6">
              {l.tipsterLeague.howItWorks.map((item, idx) => (
                <div key={idx} className="text-center">
                  <div className="w-12 h-12 bg-orange-500 text-white font-bold text-xl rounded-full flex items-center justify-center mx-auto mb-4">
                    {item.step}
                  </div>
                  <h4 className="text-white font-semibold mb-1">{item.title}</h4>
                  <p className="text-gray-400 text-sm">{item.desc}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Multipliers */}
          <div className="bg-gradient-to-r from-orange-900/30 to-yellow-900/30 border border-orange-500/30 rounded-2xl p-6">
            <h3 className="text-xl font-bold text-white text-center mb-6">{l.tipsterLeague.multipliers.title}</h3>
            <div className="flex justify-center gap-4 flex-wrap">
              {l.tipsterLeague.multipliers.items.map((item, idx) => (
                <div key={idx} className="bg-gray-800/50 border border-orange-500/20 rounded-xl px-6 py-4 text-center">
                  <div className="text-orange-400 font-bold text-2xl">{item.multiplier}</div>
                  <div className="text-gray-400 text-sm">{item.type}</div>
                </div>
              ))}
            </div>
          </div>

          {/* CTAs */}
          <div className="flex justify-center gap-4 mt-8">
            <Link href="/login" className="px-8 py-4 bg-gradient-to-r from-orange-600 to-yellow-500 hover:from-orange-500 hover:to-yellow-400 text-white font-bold rounded-2xl shadow-xl shadow-orange-500/30 transition-all">
              🏆 Hemen Katıl
            </Link>
            <Link href="/leaderboard" className="px-8 py-4 bg-gray-800 hover:bg-gray-700 text-white font-semibold rounded-2xl border border-gray-700 transition-all">
              📊 Liderlik Tablosu
            </Link>
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section className="py-20 px-4">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">{l.pricing.title}</h2>
            <p className="text-gray-400 text-lg">{l.pricing.subtitle}</p>
          </div>
          <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto">
            {/* Free */}
            <div className="bg-gray-800/50 border border-gray-700 rounded-3xl p-8">
              <h3 className="text-2xl font-bold text-white mb-2">{l.pricing.free.name}</h3>
              <div className="flex items-baseline gap-1 mb-6">
                <span className="text-4xl font-bold text-white">{l.pricing.free.price}</span>
                <span className="text-gray-400">{l.pricing.free.period}</span>
              </div>
              <ul className="space-y-3 mb-8">
                {l.pricing.free.features.map((f, idx) => (
                  <li key={idx} className="flex items-center gap-2 text-gray-300">
                    <span className="text-green-500">✓</span> {f}
                  </li>
                ))}
              </ul>
              <Link href="/login" className="block w-full py-3 bg-gray-700 hover:bg-gray-600 text-white font-semibold rounded-xl text-center transition-all">
                {l.pricing.free.cta}
              </Link>
            </div>

            {/* Pro */}
            <div className="bg-gradient-to-br from-green-900/30 to-blue-900/30 border-2 border-green-500/50 rounded-3xl p-8 relative">
              <div className="absolute -top-4 left-1/2 -translate-x-1/2 px-4 py-1 bg-green-500 text-white text-sm font-bold rounded-full">
                {l.pricing.pro.badge}
              </div>
              <h3 className="text-2xl font-bold text-white mb-2">{l.pricing.pro.name}</h3>
              <div className="flex items-baseline gap-1 mb-6">
                <span className="text-4xl font-bold text-white">{l.pricing.pro.price}</span>
                <span className="text-gray-400">{l.pricing.pro.period}</span>
              </div>
              <ul className="space-y-3 mb-8">
                {l.pricing.pro.features.map((f, idx) => (
                  <li key={idx} className="flex items-center gap-2 text-gray-300">
                    <span className="text-green-500">✓</span> {f}
                  </li>
                ))}
              </ul>
              <Link href="/login" className="block w-full py-3 bg-gradient-to-r from-green-600 to-green-500 hover:from-green-500 hover:to-green-400 text-white font-semibold rounded-xl text-center transition-all shadow-lg shadow-green-500/30">
                {l.pricing.pro.cta}
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section className="py-20 px-4 bg-gray-800/30">
        <div className="max-w-7xl mx-auto">
          <h2 className="text-3xl md:text-4xl font-bold text-white text-center mb-12">{l.testimonials.title}</h2>
          <div className="grid md:grid-cols-3 gap-6">
            {l.testimonials.items.map((item, idx) => (
              <div key={idx} className="bg-gray-800/50 border border-gray-700/50 rounded-2xl p-6">
                <div className="text-yellow-400 mb-4">★★★★★</div>
                <p className="text-gray-300 mb-4">"{item.text}"</p>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-gradient-to-br from-green-500 to-blue-500 rounded-full flex items-center justify-center text-white font-bold">
                    {item.author.charAt(0)}
                  </div>
                  <div>
                    <div className="text-white font-semibold">{item.author}</div>
                    <div className="text-gray-400 text-sm">{item.role}</div>
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
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">{l.cta.title}</h2>
          <p className="text-gray-400 text-lg mb-8">{l.cta.subtitle}</p>
          <Link href="/login" className="inline-flex items-center gap-2 px-10 py-5 bg-gradient-to-r from-green-600 to-green-500 hover:from-green-500 hover:to-green-400 text-white font-bold text-xl rounded-2xl shadow-xl shadow-green-500/30 transition-all">
            {l.cta.button}
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
            </svg>
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-gray-800 py-12 px-4">
        <div className="max-w-7xl mx-auto">
          <div className="grid md:grid-cols-4 gap-8 mb-8">
            <div>
              <div className="flex items-center gap-2 mb-4">
                <div className="w-8 h-8 bg-gradient-to-br from-green-500 to-green-600 rounded-lg flex items-center justify-center">
                  <span>⚽</span>
                </div>
                <span className="text-white font-bold">Football Analytics Pro</span>
              </div>
              <p className="text-gray-400 text-sm">{l.footer.poweredBy}</p>
            </div>
            <div>
              <h4 className="text-white font-semibold mb-4">{l.footer.product}</h4>
              <ul className="space-y-2 text-gray-400">
                <li><Link href="#" className="hover:text-white transition-colors">{l.footer.features}</Link></li>
                <li><Link href="/pricing" className="hover:text-white transition-colors">{l.footer.pricing}</Link></li>
                <li><Link href="#" className="hover:text-white transition-colors">{l.footer.demo}</Link></li>
                <li><Link href="/leaderboard" className="hover:text-white transition-colors">{l.footer.tipsterLeague}</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="text-white font-semibold mb-4">{l.footer.company}</h4>
              <ul className="space-y-2 text-gray-400">
                <li><Link href="#" className="hover:text-white transition-colors">{l.footer.about}</Link></li>
                <li><Link href="#" className="hover:text-white transition-colors">{l.footer.blog}</Link></li>
                <li><Link href="#" className="hover:text-white transition-colors">{l.footer.careers}</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="text-white font-semibold mb-4">{l.footer.legal}</h4>
              <ul className="space-y-2 text-gray-400">
                <li><Link href="#" className="hover:text-white transition-colors">{l.footer.privacy}</Link></li>
                <li><Link href="#" className="hover:text-white transition-colors">{l.footer.terms}</Link></li>
              </ul>
            </div>
          </div>
          <div className="border-t border-gray-800 pt-8 text-center text-gray-400 text-sm">
            {l.footer.copyright}
          </div>
        </div>
      </footer>

      {/* Video Modal */}
      {showVideoModal && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
          onClick={() => setShowVideoModal(false)}
        >
          <div 
            className="relative w-full max-w-4xl aspect-video bg-gray-900 rounded-2xl overflow-hidden shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Close Button */}
            <button
              onClick={() => setShowVideoModal(false)}
              className="absolute -top-12 right-0 text-white hover:text-gray-300 transition-colors flex items-center gap-2"
            >
              <span className="text-sm">
                {lang === 'tr' ? 'Kapat' : lang === 'de' ? 'Schließen' : 'Close'}
              </span>
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>

            {/* YouTube Embed or Placeholder */}
            {YOUTUBE_VIDEO_ID === 'YOUR_VIDEO_ID_HERE' ? (
              <div className="w-full h-full flex flex-col items-center justify-center text-center p-8">
                <div className="text-6xl mb-4">🎬</div>
                <h3 className="text-2xl font-bold text-white mb-2">
                  {lang === 'tr' ? 'Video Yakında!' : lang === 'de' ? 'Video kommt bald!' : 'Video Coming Soon!'}
                </h3>
                <p className="text-gray-400 max-w-md">
                  {lang === 'tr' 
                    ? 'Tanıtım videomuz hazırlanıyor. Çok yakında burada olacak!' 
                    : lang === 'de'
                    ? 'Unser Einführungsvideo wird vorbereitet. Es wird sehr bald hier sein!'
                    : 'Our introduction video is being prepared. It will be here very soon!'}
                </p>
                <div className="mt-6 flex items-center gap-4">
                  <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse" />
                  <span className="text-green-400 text-sm">
                    {lang === 'tr' ? 'Hazırlanıyor...' : lang === 'de' ? 'In Vorbereitung...' : 'In Progress...'}
                  </span>
                </div>
              </div>
            ) : (
              <iframe
                src={`https://www.youtube.com/embed/${YOUTUBE_VIDEO_ID}?autoplay=1&rel=0`}
                title="How It Works"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
                className="w-full h-full"
              />
            )}
          </div>
        </div>
      )}
    </div>
  );
}