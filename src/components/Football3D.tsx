'use client';

// ============================================================================
// 3D FOOTBALL FIGURES COMPONENT (CSS 3D)
// Futbol topu ve saha figürleri ile sayfayı zenginleştirir
// ============================================================================

import { useEffect, useRef } from 'react';
import { motion } from 'framer-motion';

// ============================================================================
// 3D FOOTBALL BALL (CSS 3D Transform)
// ============================================================================

export function FootballBall3D({ 
  size = 100,
  className = '',
  autoRotate = true
}: { 
  size?: number;
  className?: string;
  autoRotate?: boolean;
}) {
  const ballRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!autoRotate || !ballRef.current) return;

    let rotation = 0;
    const animate = () => {
      rotation += 0.5;
      if (ballRef.current) {
        ballRef.current.style.transform = `rotateY(${rotation}deg) rotateX(${Math.sin(rotation * 0.01) * 15}deg)`;
      }
      requestAnimationFrame(animate);
    };
    animate();
  }, [autoRotate]);

  return (
    <div 
      ref={ballRef}
      className={`relative ${className}`}
      style={{
        width: `${size}px`,
        height: `${size}px`,
        transformStyle: 'preserve-3d',
        perspective: '1000px',
      }}
    >
      {/* Futbol topu - 3D sphere effect */}
      <div
        className="absolute inset-0 rounded-full"
        style={{
          background: `
            radial-gradient(circle at 30% 30%, rgba(255, 255, 255, 0.9), rgba(255, 255, 255, 0.7)),
            radial-gradient(circle at 70% 70%, rgba(0, 240, 255, 0.3), transparent),
            #ffffff
          `,
          boxShadow: `
            0 0 ${size * 0.3}px rgba(0, 240, 255, 0.5),
            inset -${size * 0.1}px -${size * 0.1}px ${size * 0.2}px rgba(0, 0, 0, 0.2),
            inset ${size * 0.1}px ${size * 0.1}px ${size * 0.2}px rgba(255, 255, 255, 0.8)
          `,
          border: '2px solid rgba(0, 240, 255, 0.3)',
        }}
      >
        {/* Futbol topu desenleri */}
        <svg
          viewBox="0 0 100 100"
          className="absolute inset-0 w-full h-full"
          style={{ opacity: 0.4 }}
        >
          {/* Pentagon pattern */}
          <path
            d="M 50 10 L 30 30 L 50 50 L 70 30 Z"
            fill="none"
            stroke="#000000"
            strokeWidth="1.5"
          />
          <path
            d="M 50 90 L 30 70 L 50 50 L 70 70 Z"
            fill="none"
            stroke="#000000"
            strokeWidth="1.5"
          />
          <path
            d="M 10 50 L 30 30 L 50 50 L 30 70 Z"
            fill="none"
            stroke="#000000"
            strokeWidth="1.5"
          />
          <path
            d="M 90 50 L 70 30 L 50 50 L 70 70 Z"
            fill="none"
            stroke="#000000"
            strokeWidth="1.5"
          />
          <path
            d="M 25 25 L 50 10 L 75 25 L 50 50 Z"
            fill="none"
            stroke="#000000"
            strokeWidth="1.5"
          />
          <path
            d="M 25 75 L 50 90 L 75 75 L 50 50 Z"
            fill="none"
            stroke="#000000"
            strokeWidth="1.5"
          />
        </svg>
      </div>
      
      {/* Neon glow effect */}
      <motion.div
        className="absolute inset-0 rounded-full blur-xl"
        style={{
          background: 'radial-gradient(circle, rgba(0, 240, 255, 0.4), transparent)',
        }}
        animate={{
          scale: [1, 1.2, 1],
          opacity: [0.3, 0.6, 0.3],
        }}
        transition={{
          duration: 2,
          repeat: Infinity,
          ease: 'easeInOut',
        }}
      />
    </div>
  );
}

// ============================================================================
// 3D FOOTBALL FIELD
// ============================================================================

export function FootballField3D({ 
  width = 400,
  height = 600,
  className = ''
}: { 
  width?: number;
  height?: number;
  className?: string;
}) {
  return (
    <div
      className={`relative ${className}`}
      style={{
        width: `${width}px`,
        height: `${height}px`,
        transformStyle: 'preserve-3d',
        perspective: '1000px',
      }}
    >
      {/* Saha zemin */}
      <div
        className="absolute inset-0 rounded-lg"
        style={{
          background: `
            linear-gradient(90deg, 
              transparent 0%, 
              rgba(0, 168, 107, 0.1) 20%, 
              rgba(0, 168, 107, 0.9) 50%, 
              rgba(0, 168, 107, 0.1) 80%, 
              transparent 100%
            ),
            linear-gradient(0deg, 
              transparent 0%, 
              rgba(0, 168, 107, 0.1) 20%, 
              rgba(0, 168, 107, 0.9) 50%, 
              rgba(0, 168, 107, 0.1) 80%, 
              transparent 100%
            ),
            #00a86b
          `,
          boxShadow: `
            inset 0 0 ${width * 0.1}px rgba(0, 0, 0, 0.2),
            0 0 ${width * 0.2}px rgba(0, 240, 255, 0.3)
          `,
          transform: 'rotateX(60deg) translateZ(-50px)',
        }}
      >
        {/* Orta çizgi */}
        <div
          className="absolute top-1/2 left-0 right-0 h-0.5"
          style={{
            background: 'linear-gradient(90deg, transparent, #ffffff, transparent)',
            boxShadow: '0 0 10px rgba(255, 255, 255, 0.5)',
          }}
        />
        
        {/* Orta daire */}
        <div
          className="absolute top-1/2 left-1/2 rounded-full border-2 border-white"
          style={{
            width: `${width * 0.3}px`,
            height: `${width * 0.3}px`,
            transform: 'translate(-50%, -50%)',
            boxShadow: '0 0 20px rgba(255, 255, 255, 0.3)',
          }}
        />
        
        {/* Kale alanları */}
        <div
          className="absolute top-0 left-1/2 border-2 border-white"
          style={{
            width: `${width * 0.4}px`,
            height: `${height * 0.15}px`,
            transform: 'translateX(-50%)',
            boxShadow: '0 0 15px rgba(255, 255, 255, 0.3)',
          }}
        />
        <div
          className="absolute bottom-0 left-1/2 border-2 border-white"
          style={{
            width: `${width * 0.4}px`,
            height: `${height * 0.15}px`,
            transform: 'translateX(-50%)',
            boxShadow: '0 0 15px rgba(255, 255, 255, 0.3)',
          }}
        />
        
        {/* Köşe bayrakları */}
        {[
          { top: '5%', left: '5%' },
          { top: '5%', right: '5%' },
          { bottom: '5%', left: '5%' },
          { bottom: '5%', right: '5%' },
        ].map((pos, i) => (
          <div
            key={i}
            className="absolute"
            style={{
              ...pos,
              width: '8px',
              height: '30px',
              background: 'linear-gradient(180deg, #ffffff, #cccccc)',
              boxShadow: '0 0 10px rgba(255, 255, 255, 0.5)',
            }}
          >
            <div
              className="absolute -top-2 left-1/2 w-4 h-4 bg-red-500 rounded-sm"
              style={{
                transform: 'translateX(-50%)',
                boxShadow: '0 0 10px rgba(255, 0, 0, 0.5)',
              }}
            />
          </div>
        ))}
      </div>
      
      {/* 3D depth effect */}
      <div
        className="absolute inset-0 rounded-lg"
        style={{
          background: 'linear-gradient(135deg, rgba(0, 240, 255, 0.1), transparent)',
          transform: 'translateZ(20px)',
          pointerEvents: 'none',
        }}
      />
    </div>
  );
}

// ============================================================================
// FLOATING FOOTBALL STATS
// ============================================================================

export function FloatingFootballStats({ 
  stats 
}: { 
  stats: Array<{ label: string; value: string; color?: string }>
}) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {stats.map((stat, i) => (
        <motion.div
          key={i}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: i * 0.1 }}
          className="relative"
        >
          <div
            className="glass-futuristic rounded-xl p-4 border border-[#00f0ff]/20 relative overflow-hidden"
            style={{
              transform: 'perspective(1000px) rotateX(5deg)',
            }}
          >
            {/* 3D depth effect */}
            <div
              className="absolute inset-0 bg-gradient-to-br from-transparent via-white/5 to-transparent"
              style={{
                transform: 'translateZ(10px)',
              }}
            />
            
            <div className="relative z-10">
              <p className="text-gray-400 text-xs mb-1">{stat.label}</p>
              <p
                className="text-2xl font-bold"
                style={{
                  color: stat.color || '#00f0ff',
                  fontFamily: 'var(--font-heading)',
                  textShadow: `0 0 20px ${stat.color || '#00f0ff'}40`,
                }}
              >
                {stat.value}
              </p>
            </div>
            
            {/* Neon glow */}
            <motion.div
              className="absolute inset-0 rounded-xl blur-xl"
              style={{
                background: `radial-gradient(circle, ${stat.color || '#00f0ff'}40, transparent)`,
              }}
              animate={{
                opacity: [0.3, 0.6, 0.3],
              }}
              transition={{
                duration: 2,
                repeat: Infinity,
                ease: 'easeInOut',
              }}
            />
          </div>
        </motion.div>
      ))}
    </div>
  );
}

// ============================================================================
// SIMPLE FOOTBALL ICON (Fallback)
// ============================================================================

export function SimpleFootballIcon({ className = '' }: { className?: string }) {
  return (
    <motion.div
      className={`relative ${className}`}
      animate={{
        rotateY: [0, 360],
      }}
      transition={{
        duration: 3,
        repeat: Infinity,
        ease: 'linear',
      }}
      style={{
        transformStyle: 'preserve-3d',
      }}
    >
      <div className="w-full h-full relative">
        <svg
          viewBox="0 0 100 100"
          className="w-full h-full"
          style={{ filter: 'drop-shadow(0 0 10px rgba(0, 240, 255, 0.5))' }}
        >
          <circle cx="50" cy="50" r="45" fill="#ffffff" stroke="#00f0ff" strokeWidth="2" />
          <path
            d="M 50 10 L 30 30 L 50 50 L 70 30 Z"
            fill="none"
            stroke="#000000"
            strokeWidth="1.5"
            opacity="0.6"
          />
          <path
            d="M 50 90 L 30 70 L 50 50 L 70 70 Z"
            fill="none"
            stroke="#000000"
            strokeWidth="1.5"
            opacity="0.6"
          />
          <path
            d="M 10 50 L 30 30 L 50 50 L 30 70 Z"
            fill="none"
            stroke="#000000"
            strokeWidth="1.5"
            opacity="0.6"
          />
          <path
            d="M 90 50 L 70 30 L 50 50 L 70 70 Z"
            fill="none"
            stroke="#000000"
            strokeWidth="1.5"
            opacity="0.6"
          />
        </svg>
        <div className="absolute inset-0 rounded-full bg-[#00f0ff] opacity-20 animate-pulse blur-xl" />
      </div>
    </motion.div>
  );
}
