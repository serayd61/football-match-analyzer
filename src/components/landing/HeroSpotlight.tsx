'use client';

// ============================================================================
// HeroSpotlight — full-screen landing hero with a cursor-following spotlight
// that reveals a second image (sunset) over the base (illustrated) artwork
// through a soft circular canvas mask. Scoped under `.fa-shell`.
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

export default function HeroSpotlight({ l }: { l: HeroSpotlightLabels }) {
  const mouse = useRef({ x: -999, y: -999 });
  const smooth = useRef({ x: -999, y: -999 });
  const rafRef = useRef<number>(0);
  const [cursorPos, setCursorPos] = useState({ x: -999, y: -999 });

  useEffect(() => {
    const onMouse = (e: MouseEvent) => {
      mouse.current = { x: e.clientX, y: e.clientY };
    };
    const onTouch = (e: TouchEvent) => {
      const t = e.touches[0];
      if (t) mouse.current = { x: t.clientX, y: t.clientY };
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
    <section className="relative w-full overflow-hidden h-screen bg-black" style={{ height: '100dvh' }}>
      {/* Base image */}
      <div
        className="absolute inset-0 bg-center bg-cover bg-no-repeat z-10 hero-zoom"
        style={{ backgroundImage: `url(${BG_IMAGE_BASE})` }}
      />

      {/* Spotlight reveal layer */}
      <RevealLayer image={BG_IMAGE_REVEAL} cursorX={cursorPos.x} cursorY={cursorPos.y} />

      {/* Heading */}
      <div className="absolute top-[14%] left-0 right-0 z-50 flex flex-col items-center text-center px-5 pointer-events-none">
        <h1 className="text-white leading-[0.95]">
          <span
            className="block font-playfair italic font-normal text-5xl sm:text-7xl md:text-8xl hero-anim hero-reveal"
            style={{ letterSpacing: '-0.05em', animationDelay: '0.25s' }}
          >
            {l.line1}
          </span>
          <span
            className="block font-normal text-5xl sm:text-7xl md:text-8xl -mt-1 hero-anim hero-reveal"
            style={{ letterSpacing: '-0.08em', animationDelay: '0.42s' }}
          >
            {l.line2}
          </span>
        </h1>
      </div>

      {/* Bottom-left paragraph */}
      <div className="hidden sm:block absolute bottom-14 left-10 md:left-14 max-w-[260px] z-50 hero-anim hero-fade" style={{ animationDelay: '0.7s' }}>
        <p className="text-sm text-white/80 leading-relaxed">{l.paraLeft}</p>
      </div>

      {/* Bottom-right block */}
      <div
        className="absolute bottom-10 sm:bottom-24 left-5 right-5 sm:left-auto sm:right-10 md:right-14 max-w-full sm:max-w-[260px] flex flex-col items-start gap-4 sm:gap-5 z-50 hero-anim hero-fade"
        style={{ animationDelay: '0.85s' }}
      >
        <p className="text-xs sm:text-sm text-white/80 leading-relaxed">{l.paraRight}</p>
        <Link
          href="/login"
          className="bg-[#e8702a] hover:bg-[#d2611f] text-white text-sm font-medium px-7 py-3 rounded-full transition-all hover:scale-[1.03] active:scale-95 hover:shadow-lg hover:shadow-[#e8702a]/30"
        >
          {l.ctaButton}
        </Link>
      </div>
    </section>
  );
}
