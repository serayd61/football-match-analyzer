'use client';
import { useState, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { useLanguage } from '@/components/LanguageProvider';

// 2026-09-08: metinler eski kabuğun diliyle (önceden yalnız Türkçeydi; Almanca
// giriş sayfasının altında Türkçe 'Uygulamayı Yükle' kutusu çıkıyordu).
const L = {
  tr: { title: 'Uygulamayı Yükle', ios: 'Safari\'de paylaş butonuna dokunun ve "Ana Ekrana Ekle" seçin', lead: 'Hızlı erişim için ana ekranınıza ekleyin', install: 'Şimdi Yükle', iosHint: 'Paylaş → Ana Ekrana Ekle' },
  en: { title: 'Install the app', ios: 'Tap the share button in Safari and choose "Add to Home Screen"', lead: 'Add it to your home screen for quick access', install: 'Install now', iosHint: 'Share → Add to Home Screen' },
  de: { title: 'App installieren', ios: 'Tippe in Safari auf Teilen und wähle "Zum Home-Bildschirm"', lead: 'Für schnellen Zugriff zum Home-Bildschirm hinzufügen', install: 'Jetzt installieren', iosHint: 'Teilen → Zum Home-Bildschirm' },
} as const;

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export default function PWAInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showPrompt, setShowPrompt] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);
  // Public site (/en, /de/…) is a reading surface, not the app — no install nag there.
  const pathname = usePathname();
  const { lang } = useLanguage();
  const l = L[lang] || L.en;
  const isPublicSite = /^\/(en|de|it|tr)(\/|$)/.test(pathname || '');

  useEffect(() => {
    // Check if already installed
    const isStandaloneMode = window.matchMedia('(display-mode: standalone)').matches 
      || (window.navigator as any).standalone === true;
    setIsStandalone(isStandaloneMode);

    // Check if iOS
    const iOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
    setIsIOS(iOS);

    // Check if dismissed before
    const dismissed = localStorage.getItem('pwa-prompt-dismissed');
    if (dismissed && Date.now() - parseInt(dismissed) < 7 * 24 * 60 * 60 * 1000) {
      return; // Don't show for 7 days after dismissal
    }

    // Listen for install prompt
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setShowPrompt(true);
    };

    window.addEventListener('beforeinstallprompt', handler);

    // Show iOS prompt after delay
    if (iOS && !isStandaloneMode) {
      setTimeout(() => setShowPrompt(true), 3000);
    }

    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstall = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') {
        setShowPrompt(false);
      }
      setDeferredPrompt(null);
    }
  };

  const handleDismiss = () => {
    setShowPrompt(false);
    localStorage.setItem('pwa-prompt-dismissed', Date.now().toString());
  };

  if (isPublicSite || isStandalone || !showPrompt) return null;

  return (
    <div className="fixed bottom-20 md:bottom-4 left-4 right-4 md:left-auto md:right-4 md:w-80 z-50 animate-slide-up">
      <div className="bg-gray-800 border border-gray-700 rounded-2xl p-4 shadow-2xl">
        <div className="flex items-start gap-3">
          <div className="w-12 h-12 bg-gradient-to-br from-green-500 to-emerald-600 rounded-xl flex items-center justify-center flex-shrink-0">
            <span className="text-2xl">⚽</span>
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-white font-semibold text-sm">
              {l.title}
            </h3>
            <p className="text-gray-400 text-xs mt-1">
              {isIOS ? l.ios : l.lead}
            </p>
          </div>
          <button
            onClick={handleDismiss}
            className="text-gray-500 hover:text-gray-300 p-1"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        
        {!isIOS && (
          <button
            onClick={handleInstall}
            className="w-full mt-3 py-2.5 bg-gradient-to-r from-green-500 to-emerald-600 text-white font-semibold rounded-xl text-sm hover:shadow-lg hover:shadow-green-500/30 transition-all active:scale-[0.98]"
          >
            {l.install}
          </button>
        )}
        
        {isIOS && (
          <div className="mt-3 flex items-center justify-center gap-2 text-gray-400 text-xs">
            <span>📤</span>
            <span>{l.iosHint}</span>
          </div>
        )}
      </div>
      
      <style jsx>{`
        @keyframes slide-up {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        .animate-slide-up {
          animation: slide-up 0.3s ease-out;
        }
      `}</style>
    </div>
  );
}

