/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        // ── Legacy (kept so existing neon pages keep working) ──
        'pitch': '#1a472a',
        'pitch-light': '#2d5a3d',

        // ── New design system (modern clean SaaS) ──
        // Neutral surface scale — near-black, cool, layered elevations.
        surface: {
          0: '#08090c',   // app background (deepest)
          1: '#0d0f14',   // base panel
          2: '#12151c',   // card
          3: '#181c25',   // raised / hover
          4: '#1f2430',   // popover / active
        },
        line: {
          DEFAULT: 'rgba(255,255,255,0.08)',
          strong: 'rgba(255,255,255,0.14)',
          subtle: 'rgba(255,255,255,0.05)',
        },
        content: {
          DEFAULT: '#e7eaf0',  // primary text
          muted: '#9aa3b2',    // secondary text
          subtle: '#646c7d',   // tertiary / captions
        },
        // Brand accent — emerald (aligns with existing #10b981 theme color)
        brand: {
          50: '#ecfdf5', 100: '#d1fae5', 200: '#a7f3d0', 300: '#6ee7b7',
          400: '#34d399', 500: '#10b981', 600: '#059669', 700: '#047857',
          800: '#065f46', 900: '#064e3b', DEFAULT: '#10b981',
        },
        // Secondary data-viz accent — cool sky (for charts/probabilities)
        sky: {
          400: '#38bdf8', 500: '#0ea5e9', 600: '#0284c7',
        },
        // Semantic
        positive: '#22c55e',
        caution: '#f59e0b',
        negative: '#ef4444',
        info: '#3b82f6',
      },
      borderRadius: {
        'xl2': '1rem',
        '2xl': '1.25rem',
        '3xl': '1.75rem',
      },
      fontFamily: {
        sans: ['var(--font-sans)', 'Inter', 'system-ui', 'sans-serif'],
        mono: ['var(--font-mono)', 'ui-monospace', 'SFMono-Regular', 'monospace'],
      },
      boxShadow: {
        'elev-1': '0 1px 2px rgba(0,0,0,0.4), 0 1px 1px rgba(0,0,0,0.2)',
        'elev-2': '0 4px 16px -2px rgba(0,0,0,0.5), 0 2px 6px -1px rgba(0,0,0,0.3)',
        'elev-3': '0 12px 40px -8px rgba(0,0,0,0.6), 0 4px 12px -2px rgba(0,0,0,0.4)',
        'glow-brand': '0 0 0 1px rgba(16,185,129,0.4), 0 4px 24px -4px rgba(16,185,129,0.35)',
      },
      backgroundImage: {
        'grid-faint':
          'linear-gradient(rgba(255,255,255,0.025) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.025) 1px, transparent 1px)',
      },
      keyframes: {
        'fade-in-up': {
          '0%': { opacity: '0', transform: 'translateY(8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        shimmer: {
          '100%': { transform: 'translateX(100%)' },
        },
      },
      animation: {
        'fade-in-up': 'fade-in-up 0.4s ease-out both',
        shimmer: 'shimmer 1.5s infinite',
      },
    },
  },
  plugins: [],
}
