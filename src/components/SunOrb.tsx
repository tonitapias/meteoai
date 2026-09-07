// src/components/SunOrb.tsx
// Giny visual del Sol per al SolarModal — equivalent en protagonisme a MoonPhaseIcon.
// El color i la lluminositat varien amb l'altitud real; de nit mostra un disc apagat.
import { useMemo } from 'react';

interface SunOrbProps {
  elevationDeg: number; // -90..90, altitud real (SunCalc)
  className?: string;
}

export const SunOrb = ({ elevationDeg, className = 'w-16 h-16' }: SunOrbProps) => {
  const safeElev = typeof elevationDeg === 'number' && !isNaN(elevationDeg) ? elevationDeg : -90;
  const isDaytime = safeElev > 0;

  // Escalfor cromàtica segons l'altitud: horitzó = taronja intens, alt al cel = groc pàl·lid brillant
  const warmth = Math.max(0, Math.min(1, safeElev / 55));
  const hue = 25 + warmth * 23;
  const saturation = 90 - warmth * 20;
  const lightness = 55 + warmth * 30;
  const coreColor = isDaytime ? `hsl(${hue}, ${saturation}%, ${lightness}%)` : '#334155';
  const midColor = isDaytime ? `hsl(${hue - 5}, ${saturation}%, ${Math.max(30, lightness - 25)}%)` : '#1e293b';

  const rays = useMemo(() => Array.from({ length: 12 }, (_, i) => i * 30), []);

  return (
    <div className={`relative ${className} flex items-center justify-center transition-transform duration-700 ease-out`}>
      <svg viewBox="0 0 100 100" className="w-full h-full overflow-visible">
        <defs>
          <radialGradient id="sunOrbCore" cx="38%" cy="34%" r="70%">
            <stop offset="0%" stopColor={coreColor} style={{ transition: 'stop-color 0.25s ease-out' }} />
            <stop offset="75%" stopColor={midColor} style={{ transition: 'stop-color 0.25s ease-out' }} />
            <stop offset="100%" stopColor={isDaytime ? midColor : '#0f172a'} style={{ transition: 'stop-color 0.25s ease-out' }} />
          </radialGradient>
          <filter id="sunOrbGlow" x="-120%" y="-120%" width="340%" height="340%">
            <feGaussianBlur stdDeviation="5" result="b" />
            <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
        </defs>

        {isDaytime && rays.map(angle => (
          <line
            key={angle}
            x1="50" y1="6" x2="50" y2="18"
            stroke={coreColor}
            strokeWidth="3.5"
            strokeLinecap="round"
            opacity={0.55 + warmth * 0.35}
            transform={`rotate(${angle} 50 50)`}
            style={{ transition: 'stroke 0.25s ease-out, opacity 0.25s ease-out' }}
          />
        ))}

        <circle
          cx="50" cy="50" r="30"
          fill="url(#sunOrbCore)"
          filter="url(#sunOrbGlow)"
          className={isDaytime ? 'animate-pulse' : ''}
          style={{ animationDuration: '4s', transition: 'stroke 0.25s ease-out' }}
          stroke={isDaytime ? 'none' : '#475569'}
          strokeWidth={isDaytime ? 0 : 1}
        />
      </svg>
    </div>
  );
};
