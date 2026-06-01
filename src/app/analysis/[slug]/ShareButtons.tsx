'use client';

import { useState } from 'react';

export default function ShareButtons({ url, title }: { url: string; title: string }) {
  const [copied, setCopied] = useState(false);
  const enc = encodeURIComponent;
  const shareText = `${title}`;

  const links = [
    { name: 'WhatsApp', href: `https://wa.me/?text=${enc(shareText + ' ' + url)}`, color: 'bg-green-600 hover:bg-green-500' },
    { name: 'X', href: `https://twitter.com/intent/tweet?text=${enc(shareText)}&url=${enc(url)}`, color: 'bg-black hover:bg-gray-800' },
    { name: 'Telegram', href: `https://t.me/share/url?url=${enc(url)}&text=${enc(shareText)}`, color: 'bg-sky-600 hover:bg-sky-500' },
    { name: 'Facebook', href: `https://www.facebook.com/sharer/sharer.php?u=${enc(url)}`, color: 'bg-blue-700 hover:bg-blue-600' },
  ];

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard unavailable */
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-sm text-gray-400 mr-1">Paylaş:</span>
      {links.map((l) => (
        <a
          key={l.name}
          href={l.href}
          target="_blank"
          rel="noopener noreferrer"
          className={`${l.color} text-white text-sm font-medium px-3 py-1.5 rounded-lg transition-colors`}
        >
          {l.name}
        </a>
      ))}
      <button
        onClick={copy}
        className="bg-gray-700 hover:bg-gray-600 text-white text-sm font-medium px-3 py-1.5 rounded-lg transition-colors"
      >
        {copied ? '✓ Kopyalandı' : 'Linki Kopyala'}
      </button>
    </div>
  );
}
