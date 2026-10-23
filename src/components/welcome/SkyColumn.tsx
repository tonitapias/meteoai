// src/components/welcome/SkyColumn.tsx
// "La columna del cel" de la benvinguda: un esquema de l'aire que tenim a sobre. Disc amb corbes de nivell,
// columna de 0 a 12 km amb les tres capes de núvols (mateixes alçades i colors que el giny Capes de núvols),
// i l'òrbita diària del sol, que hi és a la posició de l'hora actual; de nit, la lluna amb la fase real.
// Cap dada de xarxa: tot surt de useWelcomeSky. Un sol SVG sense filtres; l'única animació és l'entrada
// (una vegada), que respecta "reduir el moviment".
import { useEffect, useId, useMemo, useState } from 'react';
import { MoonDisc } from '../MoonDisc';
import { contourPaths, DISC } from '../../utils/welcome/contourTexture';
import { ORBIT, orbitPoint, WelcomePhase, WelcomeSky } from '../../utils/welcome/welcomeSky';

export interface SkyColumnLabels {
  high: string;
  mid: string;
  low: string;
  /** Lletres dels punts cardinals en l'idioma actiu. */
  east: string;
  west: string;
  north: string;
  south: string;
  caption?: string;
  alt: string;
}

interface SkyColumnProps {
  sky: WelcomeSky;
  labels: SkyColumnLabels;
  /** Mòbil: etiquetes més petites i sense peu. */
  compact?: boolean;
}

interface Theme {
  orbit: string; disc: string; side: string; rim: string; contour: string; contourIndex: string;
  shadow: [number, number, number]; bands: [number, number, number];
  cloud: string; cloudShade: string; cloudAlpha: number; litEdge: string;
  sun: { core: string; mid: string; glow: string };
}

// Paleta de cada moment del dia: núvols rosats a l'alba, blancs de dia, taronja a la posta i platejats de nit.
const THEME: Readonly<Record<WelcomePhase, Theme>> = {
  alba: {
    orbit: '#fbcfe8', disc: '#0d1124', side: '#080a16', rim: 'rgba(255,190,170,0.25)',
    contour: 'rgba(216,180,254,0.32)', contourIndex: 'rgba(233,213,255,0.6)',
    shadow: [70, 4, 0.18], bands: [0.10, 0.08, 0.07],
    cloud: '#f2c6d4', cloudShade: '#b98aa8', cloudAlpha: 0.88, litEdge: 'rgba(255,205,190,0.9)',
    sun: { core: '#ffe9d6', mid: '#ffb38a', glow: '#ff8a5c' },
  },
  dia: {
    orbit: '#e2e8f0', disc: '#0f1828', side: '#0a101c', rim: 'rgba(226,232,240,0.22)',
    contour: 'rgba(148,163,184,0.4)', contourIndex: 'rgba(203,213,225,0.7)',
    shadow: [34, 18, 0.16], bands: [0.10, 0.08, 0.07],
    cloud: '#f1f5f9', cloudShade: '#aab8cc', cloudAlpha: 0.92, litEdge: 'rgba(255,255,255,0.85)',
    sun: { core: '#ffffff', mid: '#fff6dd', glow: '#fff1c4' },
  },
  posta: {
    orbit: '#fed7aa', disc: '#140f1c', side: '#0b0910', rim: 'rgba(255,200,150,0.28)',
    contour: 'rgba(251,191,140,0.38)', contourIndex: 'rgba(254,215,170,0.65)',
    shadow: [70, 4, 0.2], bands: [0.10, 0.08, 0.07],
    cloud: '#ffd9c2', cloudShade: '#e0926e', cloudAlpha: 0.9, litEdge: 'rgba(255,200,150,0.9)',
    sun: { core: '#fff1d6', mid: '#ffc37a', glow: '#ff9a52' },
  },
  nit: {
    orbit: '#a5b4fc', disc: '#080b16', side: '#05070e', rim: 'rgba(165,180,252,0.2)',
    contour: 'rgba(129,140,178,0.3)', contourIndex: 'rgba(165,180,220,0.5)',
    shadow: [30, 6, 0.14], bands: [0.09, 0.07, 0.06],
    cloud: '#8d99bd', cloudShade: '#56607f', cloudAlpha: 0.62, litEdge: 'rgba(200,215,255,0.7)',
    sun: { core: '#ffffff', mid: '#ffffff', glow: '#ffffff' },
  },
};

const DIM_EDGE = 'rgba(226,232,240,0.32)';
// Marques de les hores a l'òrbita (8, 10, 12, 14 i 16 h solars).
const ORBIT_TICKS = [-60, -30, 0, 30, 60].map(orbitPoint);
// Tros de l'òrbita per sobre de l'horitzó (el dia), d'un tall amb el disc a l'altre.
const HORIZON_X = ORBIT.rx * Math.sqrt(1 - ((ORBIT.cy - ORBIT.horizonY) / ORBIT.ry) ** 2);
const DAY_ARC = `M${(ORBIT.cx - HORIZON_X).toFixed(1)} ${ORBIT.horizonY}A${ORBIT.rx} ${ORBIT.ry} 0 0 1 ${(ORBIT.cx + HORIZON_X).toFixed(1)} ${ORBIT.horizonY}`;
// Altocúmuls: tres fileres de cel·les, la de sota a l'ombra.
const ALTOCUMULUS: ReadonlyArray<readonly [number, number, 'top' | 'mid' | 'shade']> = [
  ...[284, 300, 316, 332, 348].map(x => [x, 340, 'top'] as const),
  ...[264, 280, 296, 312, 328, 344, 360, 376].map(x => [x, 348, 'mid'] as const),
  ...[284, 300, 316, 332, 348].map(x => [x, 356, 'shade'] as const),
];

const pct = (v: number) => `${(v / 640) * 100}%`;
// rgba() i no #rrggbbaa: els WebView antics no entenen el color hexadecimal de 8 xifres.
const withAlpha = (hex: string, a: number) => {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${a})`;
};
const prefersReducedMotion = () =>
  typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

export default function SkyColumn({ sky, labels, compact = false }: SkyColumnProps) {
  const theme = THEME[sky.phase];
  const contours = useMemo(() => contourPaths(), []);
  const clipId = `orbit${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`;
  const [shown, setShown] = useState(prefersReducedMotion);

  useEffect(() => {
    if (shown) return;
    // El fotograma següent engega l'entrada; el temporitzador és la reserva per si no n'arriba cap
    // (pestanya en segon pla o WebView que no en dona): la columna no pot quedar invisible.
    const show = () => setShown(true);
    const raf = requestAnimationFrame(show);
    const fallback = window.setTimeout(show, 250);
    return () => { cancelAnimationFrame(raf); window.clearTimeout(fallback); };
  }, [shown]);

  // A l'hemisferi sud mirem cap al nord: el sol surt per la dreta i es pon per l'esquerra.
  const mirror = (x: number) => (sky.south ? 640 - x : x);
  const sunPoint = sky.sunAngle === null ? null : orbitPoint(sky.sunAngle);
  const moonPoint = sky.moon.angle === null ? null : orbitPoint(sky.moon.angle);
  const lightAngle = sky.sunAngle ?? sky.moon.angle;
  // L'astre que il·lumina és a l'esquerra si és a l'est (hemisferi nord) o a l'oest (hemisferi sud).
  const litLeft = lightAngle === null ? true : (lightAngle < 0) !== sky.south;
  const shadowX = DISC.cx + theme.shadow[0] * (litLeft ? 1 : -1);
  // A l'alba i a la posta la lluïssor de l'horitzó és cap al costat del sol, com al cel de debò.
  const twilight = sky.phase === 'alba' || sky.phase === 'posta';
  const glowLeft = twilight ? (litLeft ? '28%' : '72%') : '50%';
  const shadowY = DISC.cy + theme.shadow[1];

  const fade = (delay: number) => ({
    opacity: shown ? 1 : 0,
    transition: `opacity 700ms ease-out ${delay}ms`,
  });
  const textSize = compact ? 'text-[9.5px]' : 'text-[11px]';
  const bandSize = compact ? 'text-[10px]' : 'text-[12px]';

  return (
    <div className="relative w-full h-full">
      <div
        aria-hidden="true"
        className="absolute top-[78%] w-[150%] h-[80%] -translate-x-1/2 -translate-y-1/2 pointer-events-none"
        style={{ left: glowLeft, background: `radial-gradient(closest-side, ${withAlpha(sky.colors.glow, twilight ? 0.7 : 0.55)}, transparent)` }}
      />

      <svg role="img" aria-label={labels.alt} viewBox="0 0 640 640" fill="none" className="absolute inset-0 w-full h-full overflow-visible">
        <defs>
          {/* La part de l'òrbita sota l'horitzó s'acaba poc després del disc: si no, baixava fins al text. */}
          <clipPath id={clipId}><rect x="-200" y="-200" width="1040" height="800" /></clipPath>
        </defs>
        <g style={fade(0)}>
          <ellipse cx={ORBIT.cx} cy={ORBIT.cy} rx={ORBIT.rx} ry={ORBIT.ry} stroke="#e2e8f0" strokeOpacity={0.14} strokeDasharray="2 6" vectorEffect="non-scaling-stroke" clipPath={`url(#${clipId})`} />
          <path d={DAY_ARC} stroke={theme.orbit} strokeOpacity={0.55} strokeWidth={1.25} vectorEffect="non-scaling-stroke" />
          {ORBIT_TICKS.map(([x, y], i) => <circle key={i} cx={mirror(x)} cy={y} r={2.4} fill={theme.orbit} opacity={0.7} />)}
          {sunPoint && (
            <g>
              <circle cx={mirror(sunPoint[0])} cy={sunPoint[1]} r={76} fill={theme.sun.glow} opacity={0.07} />
              <circle cx={mirror(sunPoint[0])} cy={sunPoint[1]} r={48} fill={theme.sun.glow} opacity={0.13} />
              <circle cx={mirror(sunPoint[0])} cy={sunPoint[1]} r={28} fill={theme.sun.mid} opacity={0.32} />
              <circle cx={mirror(sunPoint[0])} cy={sunPoint[1]} r={15} fill={theme.sun.core} />
            </g>
          )}
          {moonPoint && !sunPoint && (
            <g>
              <circle cx={mirror(moonPoint[0])} cy={moonPoint[1]} r={34} fill="#c8d4ff" opacity={0.06} />
              <circle cx={mirror(moonPoint[0])} cy={moonPoint[1]} r={22} fill="#c8d4ff" opacity={0.07} />
            </g>
          )}
        </g>

        <g style={fade(80)}>
          <path d="M90 500A230 70 0 0 0 550 500V518A230 70 0 0 1 90 518Z" fill={theme.side} />
          <ellipse cx={DISC.cx} cy={DISC.cy} rx={DISC.rx} ry={DISC.ry} fill={theme.disc} stroke={theme.rim} vectorEffect="non-scaling-stroke" />
          <path d={contours.normal} stroke={theme.contour} strokeWidth={1} strokeLinecap="round" vectorEffect="non-scaling-stroke" />
          <path d={contours.index} stroke={theme.contourIndex} strokeWidth={1.3} strokeLinecap="round" vectorEffect="non-scaling-stroke" />
          <ellipse cx={shadowX} cy={shadowY} rx={96} ry={23} fill="#000" opacity={theme.shadow[2]} />
          <ellipse cx={shadowX} cy={shadowY} rx={70} ry={16} fill="#000" opacity={theme.shadow[2]} />
        </g>

        <g
          style={{
            opacity: shown ? 1 : 0,
            transform: shown ? 'scaleY(1)' : 'scaleY(0.55)',
            transformOrigin: '320px 500px',
            transition: 'transform 900ms cubic-bezier(.2,.7,.2,1) 160ms, opacity 600ms ease-out 160ms',
          }}
        >
          <path d="M250 405A70 21 0 0 0 390 405V500A70 21 0 0 1 250 500Z" fill="#4f46e5" opacity={theme.bands[0]} />
          <path d="M250 247A70 21 0 0 0 390 247V405A70 21 0 0 1 250 405Z" fill="#3b82f6" opacity={theme.bands[1]} />
          <path d="M250 120A70 21 0 0 0 390 120V247A70 21 0 0 1 250 247Z" fill="#7dd3fc" opacity={theme.bands[2]} />
          <ellipse cx="320" cy="120" rx="70" ry="21" fill="#7dd3fc" opacity={theme.bands[2]} stroke="#e2e8f0" strokeOpacity={0.4} vectorEffect="non-scaling-stroke" />
          <path d="M250 500A70 21 0 0 1 390 500" stroke="#e2e8f0" strokeOpacity={0.3} strokeDasharray="3 4" vectorEffect="non-scaling-stroke" />
          <path d="M250 405A70 21 0 0 1 390 405" stroke="#818cf8" strokeOpacity={0.45} strokeDasharray="3 4" vectorEffect="non-scaling-stroke" />
          <path d="M250 247A70 21 0 0 1 390 247" stroke="#60a5fa" strokeOpacity={0.45} strokeDasharray="3 4" vectorEffect="non-scaling-stroke" />

          <g opacity={theme.cloudAlpha}>
            <path d="M262 192q30-10 60-4q14 3 24-6M276 176q26-8 52-2q10 2 18-5M298 206q24-6 48 0q10 2 20-4" stroke={theme.cloud} strokeWidth={1.6} strokeLinecap="round" vectorEffect="non-scaling-stroke" />
            {ALTOCUMULUS.map(([x, y, kind]) => (
              <ellipse key={`${x}-${y}`} cx={x} cy={y} rx={7.5} ry={4} fill={kind === 'shade' ? theme.cloudShade : theme.cloud} opacity={kind === 'mid' ? 1 : kind === 'top' ? 0.85 : 0.8} />
            ))}
            <circle cx="278" cy="446" r="11" fill={theme.cloud} />
            <circle cx="292" cy="437" r="15" fill={theme.cloud} />
            <circle cx="307" cy="445" r="11" fill={theme.cloud} />
            <rect x="267" y="444" width="51" height="9" rx="4" fill={theme.cloud} />
            <ellipse cx="292" cy="452" rx="25" ry="2.6" fill={theme.cloudShade} />
            <circle cx="345" cy="452" r="7" fill={theme.cloud} />
            <circle cx="355" cy="446" r="10" fill={theme.cloud} />
            <circle cx="366" cy="452" r="7" fill={theme.cloud} />
            <rect x="338" y="450" width="35" height="7" rx="3" fill={theme.cloud} />
            <ellipse cx="355" cy="456" rx="17" ry="2" fill={theme.cloudShade} />
          </g>

          <path d="M250 120V500" stroke={litLeft ? theme.litEdge : DIM_EDGE} strokeWidth={1.25} vectorEffect="non-scaling-stroke" />
          <path d="M390 120V500" stroke={litLeft ? DIM_EDGE : theme.litEdge} strokeWidth={1.25} vectorEffect="non-scaling-stroke" />
          <path d="M250 500A70 21 0 0 0 390 500" stroke="#e2e8f0" strokeOpacity={0.55} vectorEffect="non-scaling-stroke" />
          <path d="M250 405A70 21 0 0 0 390 405" stroke="#818cf8" strokeOpacity={0.85} vectorEffect="non-scaling-stroke" />
          <path d="M250 247A70 21 0 0 0 390 247" stroke="#60a5fa" strokeOpacity={0.85} vectorEffect="non-scaling-stroke" />
          <path d="M242 500H250M245 436.7H250M245 373.3H250M245 310H250M242 246.7H250M245 183.3H250M242 120H250" stroke="#cbd5e1" strokeOpacity={0.6} vectorEffect="non-scaling-stroke" />
        </g>
      </svg>

      {moonPoint && !sunPoint && (
        <div
          aria-hidden="true"
          className="absolute w-[4.7%] h-[4.7%] -translate-x-1/2 -translate-y-1/2"
          style={{ left: pct(mirror(moonPoint[0])), top: pct(moonPoint[1]), ...fade(0) }}
        >
          <MoonDisc phase={sky.moon.phase} south={sky.south} detail={!compact} />
        </div>
      )}

      <div aria-hidden="true" className={`absolute inset-0 pointer-events-none text-slate-300 ${textSize}`} style={fade(300)}>
        {(['12 km', '8 km', '3 km'] as const).map((label, i) => (
          <span key={label} className="absolute -translate-x-full -translate-y-1/2 font-mono whitespace-nowrap" style={{ left: '37%', top: ['18.75%', '38.55%', '63.28%'][i] }}>{label}</span>
        ))}
        <span className={`absolute -translate-y-1/2 font-semibold whitespace-nowrap text-sky-300 ${bandSize}`} style={{ left: '63%', top: '28.6%' }}>{labels.high}</span>
        <span className={`absolute -translate-y-1/2 font-semibold whitespace-nowrap text-blue-300 ${bandSize}`} style={{ left: '63%', top: '50.9%' }}>{labels.mid}</span>
        <span className={`absolute -translate-y-1/2 font-semibold whitespace-nowrap text-indigo-200 ${bandSize}`} style={{ left: '63%', top: '65%' }}>{labels.low}</span>
        <span className="absolute -translate-x-1/2 -translate-y-1/2 font-bold text-slate-400" style={{ left: '12.5%', top: '82%' }}>{sky.south ? labels.west : labels.east}</span>
        <span className="absolute -translate-x-1/2 -translate-y-1/2 font-bold text-slate-400" style={{ left: '87.5%', top: '82%' }}>{sky.south ? labels.east : labels.west}</span>
        <span className="absolute -translate-x-1/2 -translate-y-1/2 font-bold text-slate-400" style={{ left: '50%', top: '92.8%' }}>{sky.south ? labels.south : labels.north}</span>
        {!compact && labels.caption && (
          <span className="absolute left-1/2 top-[98%] -translate-x-1/2 -translate-y-1/2 whitespace-nowrap text-slate-400">{labels.caption}</span>
        )}
      </div>
    </div>
  );
}
