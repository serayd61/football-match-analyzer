import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import AuthProvider from '@/components/AuthProvider';
import { LanguageProvider } from '@/components/LanguageProvider';
import FloatingBackButton from '@/components/FloatingBackButton';
import { Analytics } from '@vercel/analytics/react';
import Navigation from '@/components/Navigation';

export default function RootLayout({ children }) {
  return (
    <html>
      <body>
        <Navigation />
        {children}
      </body>
    </html>
  );
}

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'Football Analytics Pro - AI-Powered Match Predictions',
  description: 'AI-powered football match prediction and analysis system',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <AuthProvider>
          <LanguageProvider>
            {children}
            <FloatingBackButton />
          </LanguageProvider>
        </AuthProvider>
        <Analytics />
      </body>
    </html>
  );
}
