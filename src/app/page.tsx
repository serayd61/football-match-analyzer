'use client';

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useLanguage } from '@/components/LanguageProvider';
import Navigation from '@/components/Navigation';
import { FootballBall3D, SimpleFootballIcon } from '@/components/Football3D';
import { motion } from 'framer-motion';

// 📹 YOUTUBE VIDEO ID - Football Match Analyzer Demo
const YOUTUBE_VIDEO_ID = 'uL6L9QIRs94';

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
        badge: '📊 İstatistiksel Tahmin Motoru',
        title: 'Veriyle Eğitilmiş',
        titleHighlight: 'Futbol Tahmin Motoru',
        subtitle: 'Binlerce gerçek maçla eğitilmiş Dixon-Coles istatistik modeli; 1X2, Üst/Alt 2.5 ve Karşılıklı Gol için kalibre olasılıklar üretir. Her gün otomatik güncellenir.',
        cta: 'Ücretsiz Başla',
        ctaSecondary: 'Nasıl Çalışır?',
        trustedBy: 'Profesyonel futbol analiz platformu',
      },
      engineHow: {
        badge: '⚙️ Nasıl Çalışır',
        title: 'Tahminler Nasıl Üretiliyor?',
        subtitle: 'Sezgi değil, istatistik. Şeffaf ve tekrar üretilebilir bir model.',
        steps: [
          { icon: '📥', title: 'Gerçek Veri', desc: 'Binlerce bitmiş maç sonucu sürekli toplanır.' },
          { icon: '🧮', title: 'Dixon-Coles', desc: 'Zaman ağırlıklı Poisson + Dixon-Coles ile takım hücum/savunma güçleri öğrenilir.' },
          { icon: '🎯', title: 'Kalibre Olasılık', desc: '1X2, Üst/Alt 2.5 ve KG için kalibre olasılıklar hesaplanır.' },
          { icon: '🔄', title: 'Günlük Otomatik', desc: 'Her gün yarının maçları otomatik tahmin edilip yayınlanır.' },
        ],
      },
      livePredictions: {
        badge: '🎯 CANLI',
        title: 'Canlı İstatistik Tahminleri',
        subtitle: 'Gerçek maç verisiyle eğitilmiş Dixon-Coles motoru — her gün otomatik güncellenen kalibre olasılıklar.',
        cta: 'Tüm tahminleri gör',
        lockCta: 'Giriş yap · 7 gün ücretsiz dene',
      },
      stats: [
        { value: 'Dixon-Coles', label: 'İstatistik Motoru' },
        { value: 'Günlük', label: 'Otomatik Tahminler' },
        { value: '1X2 · Üst · KG', label: 'Tahmin Pazarları' },
        { value: 'TR · EN · DE', label: 'Dil Desteği' },
      ],
      features: {
        title: 'Neden Football Analytics Pro?',
        subtitle: 'Rakiplerinizden bir adım önde olmanızı sağlayan özellikler',
        items: [
          { icon: '📈', title: 'Çoklu Pazar', desc: '1X2, Üst/Alt 2.5 ve Karşılıklı Gol olasılıkları' },
          { icon: '🎯', title: 'Kalibre Olasılıklar', desc: 'Dixon-Coles ile kalibre edilmiş olasılıklar' },
          { icon: '🔄', title: 'Günlük Güncelleme', desc: 'Her gün otomatik üretilen yeni tahminler' },
          { icon: '🧮', title: 'İstatistiksel Model', desc: 'Sezgi değil; zaman ağırlıklı Poisson + Dixon-Coles' },
          { icon: '🌍', title: 'Çoklu Lig', desc: 'Birçok ligde günlük kapsama' },
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
        joinCta: '🏆 Hemen Katıl',
        aiPerfCta: '🧠 AI Performans',
      },
      proHighlight: {
        badge: '🚀 PRO ÜYELİK AVANTAJLARI',
        title: 'Sınırsız Erişim, Maksimum Kazanç',
        subtitle: 'Pro üyelikle tüm tahminlere ve derin analize sınırsız erişim',
        cta: 'Hemen Pro\'ya Geç',
        systems: [
          {
            icon: '📊',
            name: 'İstatistik Motoru',
            desc: 'Dixon-Coles ile kalibre edilmiş 1X2, Üst/Alt 2.5 ve KG olasılıkları — her gün otomatik güncellenir.',
            highlight: 'Dixon-Coles',
          },
          {
            icon: '🔓',
            name: 'Sınırsız Tahmin',
            desc: 'Tüm günlük motor tahminlerine ve lig bazlı görünümlere sınırsız erişim.',
            highlight: 'Sınırsız',
          },
          {
            icon: '🧠',
            name: 'Derin Maç Analizi',
            desc: 'Seçtiğin maç için detaylı, yapay zeka destekli analiz ve gerekçe.',
            highlight: 'AI Analiz',
          },
        ],
        bottomText: '💡 Üye olmadan tahminler kilitli. Pro ile tüm tahminlere ve derin analize sınırsız erişin!',
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
          features: ['Sınırsız motor tahminleri', 'Tüm pazarlar (1X2 · Üst/Alt · KG)', 'Derin AI maç analizi', 'Kupon oluşturma', 'Lig bazlı görünümler', 'Öncelikli destek'],
          cta: 'Pro\'ya Geç',
          trial: '🎁 7 Gün Ücretsiz Deneme',
          trialDesc: 'Kredi kartı bilgilerinizi girdikten sonra 7 gün ücretsiz deneyin. İstediğiniz zaman anında iptal edin!',
          cancelAnytime: '✓ İstediğiniz zaman iptal',
        },
      },
      matchIntel: {
        badge: '🧠 YENİ · Match Intelligence',
        title: 'Her maç için akıllı önizleme',
        subtitle: 'İstatistiksel olasılıklar + yapay zekâ haber özeti + 3 dilde maç anlatısı — hepsi tek kartta.',
        bullets: [
          { icon: '📊', title: 'Gerçek olasılıklar', desc: 'Tahminler istatistik modelinden gelir — yapay zekâ skor uydurmaz.' },
          { icon: '📰', title: 'Haber & sakatlık özeti', desc: 'Maç öncesi önemli gelişmeler nötr ve sade biçimde derlenir.' },
          { icon: '🌍', title: '3 dil (TR · EN · DE)', desc: 'Her önizleme Türkçe, İngilizce ve Almanca hazır.' },
          { icon: '🌙', title: 'Her gece güncel', desc: 'Yaklaşan maçlar otomatik analiz edilir, sabaha hazır olur.' },
        ],
        sampleLabel: 'Örnek',
        sampleLeague: 'FIFA Dünya Kupası',
        sampleHome: 'Fransa', sampleAway: 'Belçika',
        probHome: 'Fransa %46', probDraw: 'Beraberlik %27', probAway: 'Belçika %27',
        over: 'Üst 2.5', btts: 'KG Var', previewLabel: 'Önizleme',
        samplePreview: 'Fransa istatistiksel olarak hafif favori (%46). Beklenen goller yakın; her iki takımın da gol atma olasılığı yüksek. Sakatlık tablosu dengeli.',
        cta: 'Ücretsiz Dene',
      },
      testimonials: {
        title: 'Kullanıcılarımız Ne Diyor?',
        items: [
          { text: 'Kalibre olasılıklar çok işime yarıyor; tahminlerin arkasındaki mantığı görmek güven veriyor.', author: 'Ahmet K.', role: 'Pro Üye' },
          { text: 'Her sabah güncel tahminler hazır oluyor. İstatistiksel yaklaşım sezgiye göre çok daha tutarlı.', author: 'Mehmet Y.', role: 'Futbol Analisti' },
          { text: 'Tipster League sayesinde ayın en iyi tahminleri yapanı oldum!', author: 'Can S.', role: 'Tipster League Şampiyonu' },
        ],
      },
      cta: {
        title: 'İstatistik Motorunu Deneyin',
        subtitle: 'Ücretsiz hesap oluşturun, kalibre tahminlere erişin!',
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
        copyright: '© 2026 Football Analytics Pro. Tüm hakları saklıdır.',
        poweredBy: 'Dixon-Coles istatistik motoru',
        developedBy: 'Swiss Digital tarafından geliştirildi',
      },
    },
    en: {
      hero: {
        badge: '📊 Statistical Prediction Engine',
        title: 'A Football Prediction Engine',
        titleHighlight: 'Trained on Real Data',
        subtitle: 'A Dixon-Coles statistical model trained on thousands of real matches; it produces calibrated probabilities for 1X2, Over/Under 2.5 and Both Teams To Score. Updated automatically every day.',
        cta: 'Start Free',
        ctaSecondary: 'How It Works?',
        trustedBy: 'Professional football analytics platform',
      },
      engineHow: {
        badge: '⚙️ How It Works',
        title: 'How Predictions Are Generated',
        subtitle: 'Not intuition — statistics. A transparent, reproducible model.',
        steps: [
          { icon: '📥', title: 'Real Data', desc: 'Thousands of finished match results are continuously collected.' },
          { icon: '🧮', title: 'Dixon-Coles', desc: 'Time-weighted Poisson + Dixon-Coles learns each team\'s attack/defense strength.' },
          { icon: '🎯', title: 'Calibrated Odds', desc: 'Calibrated probabilities are computed for 1X2, Over/Under 2.5 and BTTS.' },
          { icon: '🔄', title: 'Daily Auto', desc: 'Tomorrow\'s matches are predicted and published automatically every day.' },
        ],
      },
      livePredictions: {
        badge: '🎯 LIVE',
        title: 'Live Statistical Predictions',
        subtitle: 'Dixon-Coles engine trained on real match data — calibrated probabilities, updated automatically every day.',
        cta: 'See all predictions',
        lockCta: 'Sign in · 7-day free trial',
      },
      stats: [
        { value: 'Dixon-Coles', label: 'Statistical Engine' },
        { value: 'Daily', label: 'Auto Predictions' },
        { value: '1X2 · O/U · BTTS', label: 'Prediction Markets' },
        { value: 'TR · EN · DE', label: 'Languages' },
      ],
      features: {
        title: 'Why Football Analytics Pro?',
        subtitle: 'Features that keep you ahead of the competition',
        items: [
          { icon: '📈', title: 'Multiple Markets', desc: '1X2, Over/Under 2.5 and Both Teams To Score probabilities' },
          { icon: '🎯', title: 'Calibrated Probabilities', desc: 'Calibrated probabilities via Dixon-Coles' },
          { icon: '🔄', title: 'Daily Updates', desc: 'Fresh predictions generated automatically every day' },
          { icon: '🧮', title: 'Statistical Model', desc: 'Not intuition — time-weighted Poisson + Dixon-Coles' },
          { icon: '🌍', title: 'Multiple Leagues', desc: 'Daily coverage across many leagues' },
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
        joinCta: '🏆 Join Now',
        aiPerfCta: '🧠 AI Performance',
      },
      proHighlight: {
        badge: '🚀 PRO MEMBERSHIP BENEFITS',
        title: 'Unlimited Access, Maximum Profit',
        subtitle: 'Get unlimited access to all predictions and deep analysis with Pro',
        cta: 'Go Pro Now',
        systems: [
          {
            icon: '📊',
            name: 'Statistical Engine',
            desc: 'Dixon-Coles calibrated probabilities for 1X2, Over/Under 2.5 and BTTS — updated automatically every day.',
            highlight: 'Dixon-Coles',
          },
          {
            icon: '🔓',
            name: 'Unlimited Predictions',
            desc: 'Unlimited access to all daily engine predictions and league-by-league views.',
            highlight: 'Unlimited',
          },
          {
            icon: '🧠',
            name: 'Deep Match Analysis',
            desc: 'Detailed, AI-powered analysis and rationale for the match you pick.',
            highlight: 'AI Analysis',
          },
        ],
        bottomText: '💡 Predictions are locked without an account. Go Pro for unlimited access to all predictions and deep analysis!',
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
          features: ['Unlimited engine predictions', 'All markets (1X2 · O/U · BTTS)', 'Deep AI match analysis', 'Coupon creation', 'League-by-league views', 'Priority support'],
          cta: 'Go Pro',
          trial: '🎁 7-Day Free Trial',
          trialDesc: 'Try free for 7 days after entering your card details. Cancel instantly anytime!',
          cancelAnytime: '✓ Cancel anytime',
        },
      },
      matchIntel: {
        badge: '🧠 NEW · Match Intelligence',
        title: 'A smart preview for every match',
        subtitle: 'Statistical probabilities + AI news digest + match narrative in 3 languages — all in one card.',
        bullets: [
          { icon: '📊', title: 'Real probabilities', desc: 'Predictions come from a statistical model — the AI never invents a score.' },
          { icon: '📰', title: 'News & injury digest', desc: 'Key pre-match developments, summarised neutrally and clearly.' },
          { icon: '🌍', title: '3 languages (TR · EN · DE)', desc: 'Every preview ready in Turkish, English and German.' },
          { icon: '🌙', title: 'Updated nightly', desc: 'Upcoming matches are analysed automatically, ready by morning.' },
        ],
        sampleLabel: 'Example',
        sampleLeague: 'FIFA World Cup',
        sampleHome: 'France', sampleAway: 'Belgium',
        probHome: 'France 46%', probDraw: 'Draw 27%', probAway: 'Belgium 27%',
        over: 'Over 2.5', btts: 'BTTS', previewLabel: 'Preview',
        samplePreview: 'France are slight statistical favourites (46%). Expected goals are close; both teams are likely to score. The injury picture is balanced.',
        cta: 'Try it free',
      },
      testimonials: {
        title: 'What Our Users Say',
        items: [
          { text: 'The calibrated probabilities are genuinely useful; seeing the logic behind each prediction builds trust.', author: 'John D.', role: 'Pro Member' },
          { text: 'Fresh predictions are ready every morning. The statistical approach is far more consistent than gut feeling.', author: 'Mike R.', role: 'Football Analyst' },
          { text: 'Thanks to Tipster League I became the top predictor of the month!', author: 'Chris S.', role: 'Tipster League Champion' },
        ],
      },
      cta: {
        title: 'Try the Statistical Engine',
        subtitle: 'Create a free account and access calibrated predictions!',
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
        copyright: '© 2026 Football Analytics Pro. All rights reserved.',
        poweredBy: 'Powered by the Dixon-Coles statistical engine',
        developedBy: 'Developed by Swiss Digital',
      },
    },
  };

  const labelsDE = {
    hero: {
      badge: '📊 Statistische Vorhersage-Engine',
      title: 'Eine Fußball-Vorhersage-Engine',
      titleHighlight: 'mit echten Daten trainiert',
      subtitle: 'Ein Dixon-Coles-Statistikmodell, trainiert mit Tausenden echten Spielen; es liefert kalibrierte Wahrscheinlichkeiten für 1X2, Über/Unter 2.5 und Beide Teams treffen. Täglich automatisch aktualisiert.',
      cta: 'Kostenlos starten',
      ctaSecondary: 'Wie funktioniert es?',
      trustedBy: 'Professionelle Fußball-Analyse-Plattform',
    },
    engineHow: {
      badge: '⚙️ Wie es funktioniert',
      title: 'Wie Vorhersagen entstehen',
      subtitle: 'Keine Intuition — Statistik. Ein transparentes, reproduzierbares Modell.',
      steps: [
        { icon: '📥', title: 'Echte Daten', desc: 'Tausende abgeschlossene Spielergebnisse werden laufend gesammelt.' },
        { icon: '🧮', title: 'Dixon-Coles', desc: 'Zeitgewichtetes Poisson + Dixon-Coles lernt die Angriffs-/Abwehrstärke jedes Teams.' },
        { icon: '🎯', title: 'Kalibrierte Quote', desc: 'Kalibrierte Wahrscheinlichkeiten für 1X2, Über/Unter 2.5 und BTTS werden berechnet.' },
        { icon: '🔄', title: 'Täglich automatisch', desc: 'Die Spiele von morgen werden täglich automatisch vorhergesagt und veröffentlicht.' },
      ],
    },
    livePredictions: {
      badge: '🎯 LIVE',
      title: 'Live-Statistik-Vorhersagen',
      subtitle: 'Dixon-Coles-Engine mit echten Spieldaten trainiert — kalibrierte Wahrscheinlichkeiten, täglich automatisch aktualisiert.',
      cta: 'Alle Vorhersagen ansehen',
      lockCta: 'Anmelden · 7 Tage kostenlos',
    },
    stats: [
      { value: 'Dixon-Coles', label: 'Statistik-Engine' },
      { value: 'Täglich', label: 'Auto-Vorhersagen' },
      { value: '1X2 · Ü/U · BTTS', label: 'Wettmärkte' },
      { value: 'TR · EN · DE', label: 'Sprachen' },
    ],
    features: {
      title: 'Warum Football Analytics Pro?',
      subtitle: 'Funktionen, die Sie der Konkurrenz einen Schritt voraus halten',
      items: [
        { icon: '📈', title: 'Mehrere Märkte', desc: '1X2, Über/Unter 2.5 und Beide Teams treffen — Wahrscheinlichkeiten' },
        { icon: '🎯', title: 'Kalibrierte Wahrscheinlichkeiten', desc: 'Kalibrierte Wahrscheinlichkeiten via Dixon-Coles' },
        { icon: '🔄', title: 'Tägliche Updates', desc: 'Täglich automatisch erzeugte neue Vorhersagen' },
        { icon: '🧮', title: 'Statistisches Modell', desc: 'Keine Intuition — zeitgewichtetes Poisson + Dixon-Coles' },
        { icon: '🌍', title: 'Mehrere Ligen', desc: 'Tägliche Abdeckung über viele Ligen' },
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
      joinCta: '🏆 Jetzt mitmachen',
      aiPerfCta: '🧠 KI-Leistung',
    },
    proHighlight: {
      badge: '🚀 PRO-MITGLIEDSCHAFT VORTEILE',
      title: 'Unbegrenzter Zugang, maximaler Gewinn',
      subtitle: 'Mit Pro unbegrenzter Zugang zu allen Vorhersagen und der Tiefenanalyse',
      cta: 'Jetzt Pro werden',
      systems: [
        {
          icon: '📊',
          name: 'Statistik-Engine',
          desc: 'Dixon-Coles kalibrierte Wahrscheinlichkeiten für 1X2, Über/Unter 2.5 und BTTS — täglich automatisch aktualisiert.',
          highlight: 'Dixon-Coles',
        },
        {
          icon: '🔓',
          name: 'Unbegrenzte Vorhersagen',
          desc: 'Unbegrenzter Zugang zu allen täglichen Engine-Vorhersagen und Liga-Ansichten.',
          highlight: 'Unbegrenzt',
        },
        {
          icon: '🧠',
          name: 'Tiefen-Spielanalyse',
          desc: 'Detaillierte, KI-gestützte Analyse und Begründung für das gewählte Spiel.',
          highlight: 'KI-Analyse',
        },
      ],
      bottomText: '💡 Ohne Konto sind die Vorhersagen gesperrt. Mit Pro unbegrenzter Zugang zu allen Vorhersagen und der Tiefenanalyse!',
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
        price: '$19.99',
        period: '/Monat',
        features: ['Unbegrenzte Engine-Vorhersagen', 'Alle Märkte (1X2 · Ü/U · BTTS)', 'Tiefe KI-Spielanalyse', 'Wettschein-Erstellung', 'Liga-Ansichten', 'Prioritäts-Support'],
        cta: 'Pro werden',
        trial: '🎁 7 Tage kostenlos testen',
        trialDesc: 'Nach Eingabe Ihrer Kartendaten 7 Tage kostenlos testen. Jederzeit sofort kündigen!',
        cancelAnytime: '✓ Jederzeit kündbar',
      },
    },
    matchIntel: {
      badge: '🧠 NEU · Match Intelligence',
      title: 'Eine smarte Vorschau für jedes Spiel',
      subtitle: 'Statistische Wahrscheinlichkeiten + KI-Nachrichten + Spielvorschau in 3 Sprachen — alles in einer Karte.',
      bullets: [
        { icon: '📊', title: 'Echte Wahrscheinlichkeiten', desc: 'Prognosen stammen aus einem statistischen Modell — die KI erfindet kein Ergebnis.' },
        { icon: '📰', title: 'Nachrichten & Verletzungen', desc: 'Wichtige Entwicklungen vor dem Spiel, neutral und klar zusammengefasst.' },
        { icon: '🌍', title: '3 Sprachen (TR · EN · DE)', desc: 'Jede Vorschau auf Türkisch, Englisch und Deutsch bereit.' },
        { icon: '🌙', title: 'Jede Nacht aktuell', desc: 'Bevorstehende Spiele werden automatisch analysiert, bis zum Morgen bereit.' },
      ],
      sampleLabel: 'Beispiel',
      sampleLeague: 'FIFA-Weltmeisterschaft',
      sampleHome: 'Frankreich', sampleAway: 'Belgien',
      probHome: 'Frankreich 46%', probDraw: 'Unentschieden 27%', probAway: 'Belgien 27%',
      over: 'Über 2.5', btts: 'BTTS', previewLabel: 'Vorschau',
      samplePreview: 'Frankreich ist statistisch leicht favorisiert (46%). Die erwarteten Tore liegen nahe beieinander; beide Teams treffen wahrscheinlich. Die Verletzungslage ist ausgeglichen.',
      cta: 'Kostenlos testen',
    },
    testimonials: {
      title: 'Was unsere Nutzer sagen',
      items: [
        { text: 'Die kalibrierten Wahrscheinlichkeiten sind wirklich nützlich; die Logik hinter jeder Vorhersage zu sehen schafft Vertrauen.', author: 'Thomas M.', role: 'Pro-Mitglied' },
        { text: 'Jeden Morgen sind frische Vorhersagen bereit. Der statistische Ansatz ist viel konsistenter als das Bauchgefühl.', author: 'Stefan K.', role: 'Fußball-Analyst' },
        { text: 'Dank Tipster League wurde ich zum Top-Predictor des Monats!', author: 'Markus H.', role: 'Tipster League Champion' },
      ],
    },
    cta: {
      title: 'Testen Sie die Statistik-Engine',
      subtitle: 'Erstellen Sie ein kostenloses Konto und greifen Sie auf kalibrierte Vorhersagen zu!',
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
      copyright: '© 2026 Football Analytics Pro. Alle Rechte vorbehalten.',
      poweredBy: 'Angetrieben von der Dixon-Coles-Statistik-Engine',
      developedBy: 'Entwickelt von Swiss Digital',
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
    <div className="min-h-screen bg-black relative">
      <Navigation />
      
      {/* 3D Football Decorations */}
      <div className="fixed top-20 right-10 z-0 opacity-20 pointer-events-none">
        <FootballBall3D size={150} />
      </div>
      <div className="fixed bottom-20 left-10 z-0 opacity-20 pointer-events-none">
        <FootballBall3D size={120} />
      </div>

      {/* Hero Section */}
      <section className="pt-32 pb-20 px-4 relative z-10">
        <div className="max-w-7xl mx-auto">
          <motion.div 
            className="text-center max-w-4xl mx-auto"
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
          >
            <motion.div 
              className="inline-flex items-center gap-2 px-4 py-2 glass-futuristic border border-[#00f0ff]/30 rounded-full text-[#00f0ff] text-sm font-medium mb-8 neon-glow-cyan"
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.2 }}
            >
              {l.hero.badge}
            </motion.div>

            <motion.h1 
              className="text-5xl md:text-7xl font-bold text-white mb-6 leading-tight"
              style={{ fontFamily: 'var(--font-heading)' }}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
            >
              {l.hero.title}{' '}
              <span className="bg-gradient-to-r from-[#00f0ff] via-[#ff00f0] to-[#ffff00] bg-clip-text text-transparent neon-glow-cyan">
                {l.hero.titleHighlight}
              </span>
            </motion.h1>

            <motion.p 
              className="text-xl text-gray-400 mb-10 max-w-2xl mx-auto leading-relaxed"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.5 }}
            >
              {l.hero.subtitle}
            </motion.p>

            <motion.div 
              className="flex flex-col sm:flex-row gap-4 justify-center mb-12"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.7 }}
            >
              <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                <Link href="/login" className="px-8 py-4 glass-futuristic border border-[#00f0ff]/50 text-white font-bold text-lg rounded-2xl neon-border-cyan neon-glow-cyan transition-all flex items-center justify-center gap-2">
                  {l.hero.cta}
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                  </svg>
                </Link>
              </motion.div>
              <motion.button 
                onClick={() => setShowVideoModal(true)}
                className="px-8 py-4 glass-futuristic border border-gray-700/50 text-white font-semibold text-lg rounded-2xl transition-all flex items-center justify-center gap-2 hover:border-[#00f0ff]/50"
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd" />
                </svg>
                {l.hero.ctaSecondary}
              </motion.button>
            </motion.div>

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
          </motion.div>

          {/* Stats */}
          <motion.div 
            className="grid grid-cols-2 md:grid-cols-4 gap-6 mt-20"
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.9 }}
          >
            {(l.stats as Array<{ value: string; label: string }>).map((stat, idx) => (
              <motion.div
                key={idx}
                className="text-center p-6 glass-futuristic border border-[#00f0ff]/20 rounded-2xl neon-border-cyan"
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 1 + idx * 0.1 }}
                whileHover={{ scale: 1.05, borderColor: 'rgba(0, 240, 255, 0.5)' }}
              >
                <div className="text-2xl md:text-3xl font-bold text-white mb-1 neon-glow-cyan" style={{ fontFamily: 'var(--font-heading)' }}>{stat.value}</div>
                <div className="text-gray-400 text-sm">{stat.label}</div>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* 🎯 Canlı İstatistik Tahminleri (yeni Dixon-Coles motoru) */}
      <section id="live-predictions" className="py-12 px-4 relative z-10">
        <div className="max-w-6xl mx-auto">
          <motion.div
            className="text-center mb-8"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
          >
            <div className="inline-flex items-center gap-2 px-4 py-2 glass-futuristic border border-[#00f0ff]/30 rounded-full text-[#00f0ff] text-sm font-medium mb-4 neon-glow-cyan">
              {(l as any).livePredictions.badge}
            </div>
            <h2 className="text-3xl md:text-4xl font-bold text-white mb-3" style={{ fontFamily: 'var(--font-heading)' }}>
              {(l as any).livePredictions.title}
            </h2>
            <p className="text-gray-400 text-lg max-w-2xl mx-auto">{(l as any).livePredictions.subtitle}</p>
          </motion.div>

          {/* Kilitli teaser: bulanık örnek kartlar + giriş/deneme çağrısı (gerçek veri yok) */}
          <div className="relative">
            <div className="grid md:grid-cols-3 gap-4 blur-[6px] select-none pointer-events-none opacity-60" aria-hidden="true">
              {[0, 1, 2].map((i) => (
                <div key={i} className="rounded-2xl border border-white/10 bg-gradient-to-b from-white/[0.05] to-white/[0.01] p-4">
                  <div className="flex items-center justify-between mb-4">
                    <div className="h-3 w-20 bg-white/10 rounded" />
                    <div className="h-3 w-12 bg-white/10 rounded" />
                  </div>
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex flex-col items-center gap-2 flex-1">
                      <div className="w-10 h-10 rounded-full bg-white/10" />
                      <div className="h-2 w-14 bg-white/10 rounded" />
                    </div>
                    <div className="text-white/20 text-xs font-bold">VS</div>
                    <div className="flex flex-col items-center gap-2 flex-1">
                      <div className="w-10 h-10 rounded-full bg-white/10" />
                      <div className="h-2 w-14 bg-white/10 rounded" />
                    </div>
                  </div>
                  <div className="h-9 rounded-xl bg-white/5 mb-3" />
                  <div className="h-2 rounded-full bg-white/10 mb-2" />
                  <div className="flex gap-2">
                    <div className="h-6 w-16 bg-white/5 rounded-lg" />
                    <div className="h-6 w-16 bg-white/5 rounded-lg" />
                  </div>
                </div>
              ))}
            </div>

            {/* Kilit overlay */}
            <div className="absolute inset-0 flex flex-col items-center justify-center text-center px-4">
              <div className="w-14 h-14 rounded-full bg-[#00f0ff]/10 border border-[#00f0ff]/40 flex items-center justify-center text-[#00f0ff] mb-4 neon-glow-cyan">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
              </div>
              <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} className="inline-block">
                <Link
                  href="/login"
                  className="inline-flex items-center gap-2 px-8 py-4 glass-futuristic border border-[#00f0ff]/50 text-white font-bold rounded-2xl neon-border-cyan neon-glow-cyan transition-all"
                >
                  {(l as any).livePredictions.lockCta}
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                  </svg>
                </Link>
              </motion.div>
            </div>
          </div>
        </div>
      </section>

      {/* Nasıl Çalışır — İstatistik Motoru */}
      <section id="how-it-works" className="py-20 px-4 bg-gradient-to-br from-cyan-900/10 via-transparent to-fuchsia-900/10">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-12">
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-cyan-500/10 border border-cyan-500/30 rounded-full text-cyan-300 text-sm font-medium mb-4">
              {(l as any).engineHow.badge}
            </div>
            <h2 className="text-3xl md:text-4xl font-bold text-white mb-3">{(l as any).engineHow.title}</h2>
            <p className="text-gray-400 text-lg max-w-2xl mx-auto">{(l as any).engineHow.subtitle}</p>
          </div>
          <div className="grid md:grid-cols-4 gap-6">
            {(l as any).engineHow.steps.map((s: any, idx: number) => (
              <div key={idx} className="relative bg-gray-800/40 border border-white/10 rounded-2xl p-6 hover:border-cyan-400/30 transition-all">
                <div className="absolute -top-3 -left-3 w-8 h-8 rounded-full bg-gradient-to-br from-cyan-500 to-fuchsia-500 flex items-center justify-center text-white text-sm font-bold">{idx + 1}</div>
                <div className="text-4xl mb-3">{s.icon}</div>
                <h3 className="text-lg font-bold text-white mb-2">{s.title}</h3>
                <p className="text-gray-400 text-sm">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

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

      {/* 🧠 Match Intelligence Showcase */}
      {'matchIntel' in l && (
        <section className="py-20 px-4 bg-gradient-to-br from-cyan-900/20 via-transparent to-fuchsia-900/20 relative overflow-hidden">
          <div className="absolute inset-0 opacity-30 pointer-events-none">
            <div className="absolute top-0 right-1/4 w-96 h-96 bg-cyan-500/20 rounded-full blur-3xl animate-pulse" />
            <div className="absolute bottom-0 left-1/4 w-96 h-96 bg-fuchsia-500/20 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }} />
          </div>
          <div className="max-w-7xl mx-auto relative z-10">
            <div className="text-center mb-12">
              <div className="inline-flex items-center gap-2 px-4 py-2 bg-cyan-500/15 border border-cyan-500/30 rounded-full text-cyan-300 text-sm font-bold mb-4">
                {(l as any).matchIntel.badge}
              </div>
              <h2 className="text-3xl md:text-5xl font-bold text-white mb-4">{(l as any).matchIntel.title}</h2>
              <p className="text-lg text-gray-300 max-w-2xl mx-auto">{(l as any).matchIntel.subtitle}</p>
            </div>

            <div className="grid lg:grid-cols-2 gap-10 items-center">
              {/* Sol: özellikler */}
              <div className="space-y-4">
                {(l as any).matchIntel.bullets.map((b: any, idx: number) => (
                  <div key={idx} className="flex items-start gap-4 bg-gray-800/40 border border-white/10 rounded-2xl p-5 hover:border-cyan-400/30 transition-all">
                    <div className="text-3xl shrink-0">{b.icon}</div>
                    <div>
                      <h3 className="text-white font-bold mb-1">{b.title}</h3>
                      <p className="text-gray-400 text-sm">{b.desc}</p>
                    </div>
                  </div>
                ))}
                <div className="pt-2">
                  <Link href="/login" className="inline-flex items-center gap-2 px-8 py-4 bg-gradient-to-r from-cyan-500 to-fuchsia-500 hover:opacity-90 text-white font-bold rounded-2xl shadow-xl shadow-cyan-500/30 transition-all">
                    {(l as any).matchIntel.cta} →
                  </Link>
                </div>
              </div>

              {/* Sağ: canlı görünümlü kart mockup */}
              <div className="relative">
                <div className="bg-gradient-to-b from-white/[0.07] to-white/[0.02] border border-cyan-400/20 rounded-3xl p-6 shadow-2xl shadow-cyan-500/10 backdrop-blur">
                  <div className="flex items-center justify-between mb-4">
                    <span className="text-xs text-cyan-300/70 font-mono uppercase tracking-wide">{(l as any).matchIntel.sampleLabel}</span>
                    <div className="flex gap-1">
                      {['TR', 'EN', 'DE'].map((x) => (
                        <span key={x} className={`text-[10px] px-2 py-0.5 rounded-md font-bold ${x === String(lang).toUpperCase() ? 'bg-cyan-400/20 text-cyan-300' : 'bg-white/5 text-white/40'}`}>{x}</span>
                      ))}
                    </div>
                  </div>
                  <div className="text-xs text-white/40 mb-3">{(l as any).matchIntel.sampleLeague}</div>
                  <div className="flex items-center justify-between gap-2 mb-5">
                    <div className="flex flex-col items-center gap-1 flex-1">
                      <div className="text-3xl">🇫🇷</div>
                      <span className="text-sm text-white/80">{(l as any).matchIntel.sampleHome}</span>
                    </div>
                    <div className="text-white/30 text-xs font-bold">VS</div>
                    <div className="flex flex-col items-center gap-1 flex-1">
                      <div className="text-3xl">🇧🇪</div>
                      <span className="text-sm text-white/80">{(l as any).matchIntel.sampleAway}</span>
                    </div>
                  </div>
                  <div className="flex h-2.5 rounded-full overflow-hidden mb-1.5">
                    <div className="bg-cyan-400/70" style={{ width: '46%' }} />
                    <div className="bg-amber-400/70" style={{ width: '27%' }} />
                    <div className="bg-fuchsia-500/70" style={{ width: '27%' }} />
                  </div>
                  <div className="flex justify-between text-[11px] text-white/50 mb-4">
                    <span>{(l as any).matchIntel.probHome}</span>
                    <span>{(l as any).matchIntel.probDraw}</span>
                    <span>{(l as any).matchIntel.probAway}</span>
                  </div>
                  <div className="flex gap-2 mb-4">
                    <span className="text-[11px] px-2.5 py-1 rounded-lg bg-white/5 border border-white/10 text-white/60">{(l as any).matchIntel.over}: <b className="text-white/80">55%</b></span>
                    <span className="text-[11px] px-2.5 py-1 rounded-lg bg-white/5 border border-white/10 text-white/60">{(l as any).matchIntel.btts}: <b className="text-white/80">58%</b></span>
                  </div>
                  <div className="border-t border-white/10 pt-3">
                    <div className="flex items-center gap-1.5 text-[11px] text-cyan-300/70 mb-1.5">📰 {(l as any).matchIntel.previewLabel}</div>
                    <p className="text-xs text-white/70 leading-relaxed">{(l as any).matchIntel.samplePreview}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>
      )}

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
              {l.tipsterLeague.joinCta}
            </Link>
            <Link href="/ai-performance" className="px-8 py-4 bg-gray-800 hover:bg-gray-700 text-white font-semibold rounded-2xl border border-gray-700 transition-all">
              {l.tipsterLeague.aiPerfCta}
            </Link>
          </div>
        </div>
      </section>

      {/* Pro Highlight Section */}
      {'proHighlight' in l && (
        <section className="py-20 px-4 bg-gradient-to-br from-green-900/20 via-emerald-900/20 to-teal-900/20 relative overflow-hidden">
          {/* Animated Background */}
          <div className="absolute inset-0 opacity-30">
            <div className="absolute top-0 left-1/4 w-96 h-96 bg-green-500/20 rounded-full blur-3xl animate-pulse" />
            <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-emerald-500/20 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }} />
          </div>
          
          <div className="max-w-7xl mx-auto relative z-10">
            <div className="text-center mb-12">
              <div className="inline-flex items-center gap-2 px-4 py-2 bg-green-500/20 border border-green-500/30 rounded-full text-green-400 text-sm font-bold mb-4 animate-pulse">
                {(l as any).proHighlight.badge}
              </div>
              <h2 className="text-3xl md:text-5xl font-bold text-white mb-4">
                {(l as any).proHighlight.title}
              </h2>
              <p className="text-xl text-green-300 max-w-2xl mx-auto">
                {(l as any).proHighlight.subtitle}
              </p>
            </div>

            {/* 3 Systems Grid */}
            <div className="grid md:grid-cols-3 gap-6 mb-12">
              {(l as any).proHighlight.systems.map((system: any, idx: number) => (
                <div 
                  key={idx} 
                  className="bg-gradient-to-br from-gray-800/80 to-gray-900/80 border-2 border-green-500/30 rounded-3xl p-8 hover:border-green-500/60 hover:scale-105 transition-all duration-300 group"
                >
                  <div className="text-5xl mb-4">{system.icon}</div>
                  <div className="inline-flex px-3 py-1 bg-green-500/20 border border-green-500/30 rounded-full text-green-400 text-xs font-bold mb-3">
                    {system.highlight}
                  </div>
                  <h3 className="text-xl font-bold text-white mb-3 group-hover:text-green-400 transition-colors">
                    {system.name}
                  </h3>
                  <p className="text-gray-400 group-hover:text-gray-300 transition-colors">
                    {system.desc}
                  </p>
                </div>
              ))}
            </div>

            {/* Bottom Text & CTA */}
            <div className="text-center">
              <p className="text-lg text-yellow-400 font-medium mb-6 bg-yellow-500/10 border border-yellow-500/20 rounded-xl px-6 py-3 inline-block">
                {(l as any).proHighlight.bottomText}
              </p>
              <div>
                <Link 
                  href="/login" 
                  className="inline-flex items-center gap-2 px-8 py-4 bg-gradient-to-r from-green-600 to-emerald-500 hover:from-green-500 hover:to-emerald-400 text-white font-bold text-lg rounded-xl shadow-lg shadow-green-500/30 hover:shadow-green-500/50 transition-all transform hover:scale-105"
                >
                  <span>{(l as any).proHighlight.cta}</span>
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                  </svg>
                </Link>
              </div>
            </div>
          </div>
        </section>
      )}

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
              <div className="flex items-baseline gap-1 mb-2">
                <span className="text-4xl font-bold text-white">{l.pricing.pro.price}</span>
                <span className="text-gray-400">{l.pricing.pro.period}</span>
              </div>
              
              {/* 7-Day Trial Banner */}
              <div className="bg-gradient-to-r from-yellow-500/20 to-orange-500/20 border border-yellow-500/40 rounded-xl p-3 mb-4">
                <p className="text-yellow-400 font-bold text-sm">{l.pricing.pro.trial}</p>
                <p className="text-yellow-200/80 text-xs mt-1">{l.pricing.pro.trialDesc}</p>
              </div>
              
              <ul className="space-y-3 mb-4">
                {l.pricing.pro.features.map((f, idx) => (
                  <li key={idx} className="flex items-center gap-2 text-gray-300">
                    <span className="text-green-500">✓</span> {f}
                  </li>
                ))}
              </ul>
              
              {/* Cancel Anytime Badge */}
              <div className="text-center mb-4">
                <span className="inline-flex items-center gap-1 text-green-400 text-sm font-medium bg-green-500/10 px-3 py-1 rounded-full">
                  {l.pricing.pro.cancelAnytime}
                </span>
              </div>
              
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
              <a 
                href="https://swissdigital.life" 
                target="_blank" 
                rel="noopener noreferrer" 
                className="text-gray-400 text-sm hover:text-green-400 transition-colors flex items-center gap-1 mt-1"
              >
                🇨🇭 {l.footer.developedBy}
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                </svg>
              </a>
            </div>
            <div>
              <h4 className="text-white font-semibold mb-4">{l.footer.product}</h4>
              <ul className="space-y-2 text-gray-400">
                <li><Link href="#" className="hover:text-white transition-colors">{l.footer.features}</Link></li>
                <li><Link href="/pricing" className="hover:text-white transition-colors">{l.footer.pricing}</Link></li>
                <li><Link href="#" className="hover:text-white transition-colors">{l.footer.demo}</Link></li>
                <li><Link href="/contact" className="hover:text-white transition-colors">{lang === 'tr' ? 'İletişim' : lang === 'de' ? 'Kontakt' : 'Contact'}</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="text-white font-semibold mb-4">{l.footer.company}</h4>
              <ul className="space-y-2 text-gray-400">
                <li>
                  <a href="https://swissdigital.life" target="_blank" rel="noopener noreferrer" className="hover:text-white transition-colors flex items-center gap-1">
                    {l.footer.about}
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                    </svg>
                  </a>
                </li>
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

            {/* YouTube Shorts Embed */}
            <iframe
              src={`https://www.youtube.com/embed/${YOUTUBE_VIDEO_ID}?autoplay=1&rel=0`}
              title="How It Works"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
              className="w-full h-full"
            />
          </div>
        </div>
      )}
    </div>
  );
}