// src/components/StarfieldBackdrop.tsx
// Fons estelat compartit pels modals Solar i Lunar (direcció visual "planetari/astronòmic").
// SVG pur, sense dependències noves (sense WebGL/canvas), llavor fixa per no rebarrejar-se
// a cada render.
import { useMemo } from 'react';

interface Star {
  cx: number;
  cy: number;
  r: number;
  baseOpacity: number;
  twinkleDelay: number;
  twinkleDuration: number;
}

interface StarfieldBackdropProps {
  density?: number;   // nombre de punts, per defecte 70, tope ~100 per rendiment
  tint?: string;       // color dels punts, p.ex. '#fbbf24' (Solar) o '#818cf8' (Lluna)
  className?: string;
}

// PRNG determinista (mulberry32) — mateixa disposició d'estrelles a cada render/muntatge.
function mulberry32(seed: number) {
  let a = seed;
  return () => {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function generateStars(density: number): Star[] {
  const rand = mulberry32(20260906);
  const count = Math.max(0, Math.min(100, density));
  return Array.from({ length: count }, () => ({
    cx: rand() * 100,
    cy: rand() * 100,
    r: 0.15 + rand() * 0.45,
    baseOpacity: 0.25 + rand() * 0.6,
    twinkleDelay: rand() * 6,
    twinkleDuration: 3 + rand() * 4,
  }));
}

export const StarfieldBackdrop = ({ density = 70, tint = '#e2e8f0', className = '' }: StarfieldBackdropProps) => {
  const stars = useMemo(() => generateStars(density), [density]);

  return (
    <div className={`absolute inset-0 overflow-hidden pointer-events-none select-none ${className}`} aria-hidden="true">
      <style>{`
        @keyframes astro-star-twinkle {
          0%, 100% { opacity: var(--star-base-opacity, 0.5); }
          50% { opacity: calc(var(--star-base-opacity, 0.5) * 0.25); }
        }
      `}</style>
      <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="w-full h-full">
        {stars.map((s, i) => (
          <circle
            key={i}
            cx={s.cx}
            cy={s.cy}
            r={s.r}
            fill={tint}
            style={{
              // @ts-expect-error custom CSS property per l'animació de twinkle
              '--star-base-opacity': s.baseOpacity,
              opacity: s.baseOpacity,
              animation: `astro-star-twinkle ${s.twinkleDuration}s ease-in-out ${s.twinkleDelay}s infinite`,
            }}
          />
        ))}
      </svg>
    </div>
  );
};
