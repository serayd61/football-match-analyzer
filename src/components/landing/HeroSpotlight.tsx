'use client';

// ============================================================================
// HeroSpotlight — tam ekran fotoğraf + imleci izleyen spotlight (ikinci görseli
// yumuşak dairesel CSS maskesiyle açar). Brutalist editorial düzen: manşet
// sol alta yaslı dev dar grotesk; sağ altta mürekkep bloğu içinde ölçülmüş
// oran + CTA. Giriş animasyonu yok — metin anında yerinde.
// ============================================================================

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';

const SPOTLIGHT_R = 260;
const BG_IMAGE_BASE = '/hero-base.jpg';
const BG_IMAGE_REVEAL = '/hero-reveal.jpg';

export interface HeroSpotlightLabels {
  line1: string;
  line2: string;
  paraLeft: string;
  paraRight: string;
  ctaButton: string;
}

/**
 * Hero tam ekran olduğu için ziyaretçi scroll etmeden tek bir sayı
 * görmüyordu — reklam trafiğinin %96'sı mobil, ilk ekranda kanıt şart.
 * `proofLine` verildiğinde CTA'nın üstünde ölçülmüş oran satırı çıkar ve
 * kanıt bloğuna çapa atar. Veri yoksa satır hiç render edilmez.
 */

function RevealLayer({ image, cursorX, cursorY }: { image: string; cursorX: number; cursorY: number }) {
  // Canvas + toDataURL her karede PNG kodlamak zorunda kaldığından ana
  // thread'i kilitliyordu; aynı gradyan duraklarıyla CSS mask birebir aynı
  // görüntüyü sıfıra yakın maliyetle verir.
  const mask =
    `radial-gradient(circle ${SPOTLIGHT_R}px at ${cursorX}px ${cursorY}px, ` +
    'rgba(255,255,255,1) 0%, rgba(255,255,255,1) 40%, rgba(255,255,255,0.75) 60%, ' +
    'rgba(255,255,255,0.4) 75%, rgba(255,255,255,0.12) 88%, rgba(255,255,255,0) 100%)';

  return (
    <div
      className="absolute inset-0 bg-center bg-cover bg-no-repeat z-30 pointer-events-none"
      style={{
        backgroundImage: `url(${image})`,
        maskImage: mask,
        WebkitMaskImage: mask,
      }}
    />
  );
}

export default function HeroSpotlight({ l, proofLine }: { l: HeroSpotlightLabels; proofLine?: string | null }) {
  const mouse = useRef({ x: -999, y: -999 });
  const smooth = useRef({ x: -999, y: -999 });
  const rafRef = useRef<number>(0);
  const sectionRef = useRef<HTMLElement>(null);
  const [cursorPos, setCursorPos] = useState({ x: -999, y: -999 });

  useEffect(() => {
    // Nav artık akışta (sticky) olduğundan bölüm viewport'un tepesinden
    // başlamıyor; imleç koordinatını bölümün kendi kutusuna çeviriyoruz.
    const toLocal = (cx: number, cy: number) => {
      const r = sectionRef.current?.getBoundingClientRect();
      return r ? { x: cx - r.left, y: cy - r.top } : { x: cx, y: cy };
    };
    const onMouse = (e: MouseEvent) => {
      mouse.current = toLocal(e.clientX, e.clientY);
    };
    const onTouch = (e: TouchEvent) => {
      const t = e.touches[0];
      if (t) mouse.current = toLocal(t.clientX, t.clientY);
    };
    window.addEventListener('mousemove', onMouse);
    window.addEventListener('touchmove', onTouch, { passive: true });

    const loop = () => {
      smooth.current.x += (mouse.current.x - smooth.current.x) * 0.1;
      smooth.current.y += (mouse.current.y - smooth.current.y) * 0.1;
      // Tam sayıya yuvarla ve değişmediyse state'e dokunma — aksi halde lerp
      // hiçbir zaman tam yakınsamadığından her karede re-render tetiklenir
      // (React "maximum update depth" uyarısının kaynağı).
      const nx = Math.round(smooth.current.x);
      const ny = Math.round(smooth.current.y);
      setCursorPos((prev) => (prev.x === nx && prev.y === ny ? prev : { x: nx, y: ny }));
      rafRef.current = requestAnimationFrame(loop);
    };
    rafRef.current = requestAnimationFrame(loop);

    return () => {
      window.removeEventListener('mousemove', onMouse);
      window.removeEventListener('touchmove', onTouch);
      cancelAnimationFrame(rafRef.current);
    };
  }, []);

  return (
    <section
      ref={sectionRef}
      className="relative w-full overflow-hidden bg-[#141414] text-[#f2efe6] border-b"
      style={{ height: 'calc(100dvh - 3.5rem)', minHeight: '560px' }}
    >
      {/* Base image */}
      <div
        className="absolute inset-0 bg-center bg-cover bg-no-repeat z-10"
        style={{ backgroundImage: `url(${BG_IMAGE_BASE})` }}
      />

      {/* Spotlight reveal layer */}
      <RevealLayer image={BG_IMAGE_REVEAL} cursorX={cursorPos.x} cursorY={cursorPos.y} />

      {/* Okunurluk için alt kenara sert bir mürekkep geçişi (blur değil, gradyan) */}
      <div
        className="absolute inset-x-0 bottom-0 h-[62%] z-40 pointer-events-none"
        style={{ background: 'linear-gradient(to top, rgba(20,20,20,0.92) 0%, rgba(20,20,20,0.55) 45%, rgba(20,20,20,0) 100%)' }}
      />

      {/* Sol üst: mono künye */}
      <div className="absolute top-0 left-0 z-50 fm-label px-4 sm:px-6 py-3 flex items-center gap-3">
        <span className="dot dot-live" aria-hidden />
        <span>xG · ELO · Dixon-Coles</span>
      </div>

      {/* Alt blok: manşet solda, paragraflar + kanıt + CTA sağda */}
      <div className="absolute inset-x-0 bottom-0 z-50 grid grid-cols-1 lg:grid-cols-[1fr_minmax(20rem,26rem)] items-end gap-6 px-4 sm:px-6 pb-5 sm:pb-8">
        <h1 className="fd leading-[0.86] pointer-events-none" style={{ fontSize: 'clamp(3.6rem, 12.5vw, 12rem)' }}>
          <span className="block">{l.line1}</span>
          <span className="block text-[#e63b1f]">{l.line2}</span>
        </h1>

        <div className="flex flex-col items-start gap-4 lg:gap-5 lg:pb-2">
          <p className="hidden sm:block text-[0.95rem] leading-snug max-w-[34ch] text-[#f2efe6]/85">{l.paraLeft}</p>
          <p className="hidden lg:block text-[0.95rem] leading-snug max-w-[34ch] text-[#f2efe6]/85">{l.paraRight}</p>

          {/* Ölçülmüş oran — ilk ekrandaki tek somut sayı, bu yüzden CTA'nın
              ÜSTÜNDE: ziyaretçi önce kanıtı görür, sonra butonu. */}
          {proofLine && (
            <a
              href="#live-proof"
              className="fm text-[0.8rem] leading-tight flex items-start gap-3 border-2 border-[#f2efe6] bg-[#141414] px-3.5 py-2.5 hover:bg-[#f2efe6] hover:text-[#141414]"
            >
              <span className="dot dot-live mt-1 shrink-0" aria-hidden />
              <span>{proofLine}</span>
            </a>
          )}

          <Link href="/login" className="bb bb-sig bb-lg">
            {l.ctaButton}
          </Link>
        </div>
      </div>
    </section>
  );
}
