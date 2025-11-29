import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'Football Match Analyzer | AI Powered Match Predictions',
  description: 'Avrupa liglerindeki futbol maçlarını AI ile analiz edin. Premier League, La Liga, Serie A, Bundesliga ve Ligue 1 tahminleri.',
  keywords: 'futbol, analiz, tahmin, premier league, la liga, serie a, AI, yapay zeka',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="tr">
      <body className={inter.className}>
        <div className="min-h-screen">
          {/* Header */}
          <header className="border-b border-gray-700 bg-gray-900/50 backdrop-blur-sm sticky top-0 z-50">
            <div className="max-w-7xl mx-auto px-4 py-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="text-3xl">⚽</span>
                  <div>
                    <h1 className="text-xl font-bold text-white">Football Match Analyzer</h1>
                    <p className="text-xs text-gray-400">AI Powered Match Predictions</p>
                  </div>
                </div>
                <div className="flex items-center gap-4 text-sm text-gray-400">
                  <span>🏴󠁧󠁢󠁥󠁮󠁧󠁿 PL</span>
                  <span>🇪🇸 La Liga</span>
                  <span>🇮🇹 Serie A</span>
                  <span>🇩🇪 Bundesliga</span>
                  <span>🇫🇷 Ligue 1</span>
                </div>
              </div>
            </div>
          </header>

          {/* Main Content */}
          <main>{children}</main>

          {/* Footer */}
          <footer className="border-t border-gray-700 mt-12 py-6">
            <div className="max-w-7xl mx-auto px-4 text-center text-gray-500 text-sm">
              <p>⚽ Football Match Analyzer - AI Destekli Maç Analizi</p>
              <p className="mt-1">Veriler: football-data.org | AI: OpenAI / Claude</p>
              <p className="mt-2 text-xs">⚠️ Bu uygulama eğitim amaçlıdır. Bahis kararlarınız için profesyonel tavsiye alın.</p>
            </div>
          </footer>
        </div>
      </body>
    </html>
  );
}
