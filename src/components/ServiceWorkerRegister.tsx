'use client';
import { useEffect, useState } from 'react';

export default function ServiceWorkerRegister() {
  const [updateAvailable, setUpdateAvailable] = useState(false);

  useEffect(() => {
    if ('serviceWorker' in navigator) {
      // @serwist/next otomatik olarak service worker'ı register eder
      // Burada sadece update kontrolü yapıyoruz
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        window.location.reload();
      });

      // Check for updates periodically
      const checkForUpdates = () => {
        if (navigator.serviceWorker.controller) {
          navigator.serviceWorker.controller.postMessage({ type: 'SKIP_WAITING' });
        }
      };

      // Check every 5 minutes
      const interval = setInterval(checkForUpdates, 5 * 60 * 1000);

      return () => clearInterval(interval);
    }
  }, []);

  if (updateAvailable) {
    return (
      <div className="fixed bottom-4 left-4 right-4 md:left-auto md:right-4 md:w-80 bg-blue-600 text-white p-4 rounded-lg shadow-lg z-50">
        <p className="font-semibold mb-2">Yeni güncelleme mevcut!</p>
        <button
          onClick={() => window.location.reload()}
          className="w-full py-2 bg-white text-blue-600 rounded font-semibold hover:bg-gray-100 transition"
        >
          Yenile
        </button>
      </div>
    );
  }

  return null;
}

