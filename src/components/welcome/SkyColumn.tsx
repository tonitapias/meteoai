// src/components/welcome/SkyColumn.tsx
// "La columna del cel" de la benvinguda: un esquema de l'aire que tenim a sobre. Disc amb corbes de nivell,
// columna de 0 a 12 km amb les tres capes de núvols (mateixes alçades i colors que el giny Capes de núvols),
// i l'òrbita diària del sol, que hi és a la posició de l'hora actual; de nit, la lluna amb la fase real. Si el sol o
// la lluna passen per damunt d'una etiqueta, l'etiqueta s'amaga mentre hi són: l'astre no queda mai tapat.
// Cap dada de xarxa: tot surt de useWelcomeSky. Un sol SVG sense filtres (les resplendors són degradats); l'única
// animació és l'entrada, una sola vegada: la columna s'aixeca, l'arc del dia es dibuixa i el sol (o la lluna) hi
// avança des de l'horitzó de l'est fins a l'hora d'ara. Respecta "reduir el moviment".
import { CSSProperties, useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react';
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
  /** Mòbil: etiquetes més petites, peu curt i lluna més grossa (proporcionalment). */
  compact?: boolean;
}

interface Theme {
  orbit: string; disc: string; side: string; rim: string; contour: string; contourIndex: string;
  shadow: [number, number, number]; bands: [number, number, number];
  cloud: string; cloudShade: string; cloudAlpha: number; litEdge: string;
  sun: { core: string; mid: string; glow: string };
}

// Paleta de cada moment del dia: núvols rosats a l'alba, blancs de dia, taronja a la posta i platejats de nit.
// bands: opacitat del color de les tres franges (baixa, mitjana, alta), prou alta perquè la columna tingui color.
const THEME: Readonly<Record<WelcomePhase, Theme>> = {
  alba: {
    orbit: '#fbcfe8', disc: '#0d1124', side: '#080a16', rim: 'rgba(255,190,170,0.25)',
    contour: 'rgba(216,180,254,0.32)', contourIndex: 'rgba(233,213,255,0.6)',
    shadow: [70, 4, 0.18], bands: [0.26, 0.21, 0.19],
    cloud: '#f2c6d4', cloudShade: '#b98aa8', cloudAlpha: 0.88, litEdge: 'rgba(255,205,190,0.9)',
    sun: { core: '#ffe9d6', mid: '#ffb38a', glow: '#ff8a5c' },
  },
  dia: {
    orbit: '#e2e8f0', disc: '#0f1828', side: '#0a101c', rim: 'rgba(226,232,240,0.22)',
    contour: 'rgba(148,163,184,0.4)', contourIndex: 'rgba(203,213,225,0.7)',
    shadow: [34, 18, 0.16], bands: [0.26, 0.23, 0.22],
    cloud: '#f1f5f9', cloudShade: '#aab8cc', cloudAlpha: 0.92, litEdge: 'rgba(255,255,255,0.85)',
    sun: { core: '#ffffff', mid: '#fff6dd', glow: '#fff1c4' },
  },
  posta: {
    orbit: '#fed7aa', disc: '#140f1c', side: '#0b0910', rim: 'rgba(255,200,150,0.28)',
    contour: 'rgba(251,191,140,0.38)', contourIndex: 'rgba(254,215,170,0.65)',
    shadow: [70, 4, 0.2], bands: [0.26, 0.21, 0.19],
    cloud: '#ffd9c2', cloudShade: '#e0926e', cloudAlpha: 0.9, litEdge: 'rgba(255,200,150,0.9)',
    sun: { core: '#fff1d6', mid: '#ffc37a', glow: '#ff9a52' },
  },
  nit: {
    orbit: '#a5b4fc', disc: '#080b16', side: '#05070e', rim: 'rgba(165,180,252,0.2)',
    contour: 'rgba(129,140,178,0.3)', contourIndex: 'rgba(165,180,220,0.5)',
    shadow: [30, 6, 0.14], bands: [0.22, 0.17, 0.15],
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

// Els secrets de la benvinguda (hooks/welcome/useColumnStretch): quan s'estira o s'aixafa la columna, el contenidor
// canvia la variable --sky-stretch i la columna s'allarga o s'escurça des de terra sense que React la torni a pintar.
// L'astronauta de dalt (la pista de l'ascensor) no s'estira: es mou amb el capdamunt, (s − 1) × 380 unitats. Quan
// s'aixafa, --sky-press (0–1) fa aparèixer les esquerdes del disc; el casc de miner de sota és la pista del viatge avall.
const STRETCH: CSSProperties = { transform: 'scaleY(var(--sky-stretch, 1))', transformOrigin: '320px 500px' };
const ASTRONAUT_LIFT: CSSProperties = { transform: 'translateY(calc((1 - var(--sky-stretch, 1)) * 380px))' };
const PRESS: CSSProperties = { opacity: 'var(--sky-press, 0)' };

const pct = (v: number) => `${(v / 640) * 100}%`;
/** Diàmetre de la lluna, en unitats del viewBox: al mòbil la columna és petita i ha de fer uns 26 px, no 15. */
const MOON_SIZE = { compact: 52, wide: 34 } as const;
// rgba() i no #rrggbbaa: els WebView antics no entenen el color hexadecimal de 8 xifres.
const withAlpha = (hex: string, a: number) => {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${a})`;
};
const prefersReducedMotion = () =>
  typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// Entrada: l'arc del dia es dibuixa en 0,9 s; l'astre surt 0,15 s després de l'horitzó de l'est i arriba a l'hora
// d'ara en 1,1 s, cada cop més a poc a poc.
const HORIZON_ANGLE = (Math.acos((ORBIT.cy - ORBIT.horizonY) / ORBIT.ry) * 180) / Math.PI;
const ENTRY = { arcMs: 900, astreDelay: 150, astreMs: 1100 } as const;
const easeOutCubic = (t: number) => 1 - (1 - t) ** 3;
const easeInOutCubic = (t: number) => (t < 0.5 ? 4 * t ** 3 : 1 - (-2 * t + 2) ** 3 / 2);
/** Angle de l'astre `t` ms després que comenci l'entrada: de l'horitzó de l'est fins a `target`. */
const entryAngle = (t: number, target: number) =>
  -HORIZON_ANGLE + (target + HORIZON_ANGLE) * easeOutCubic(Math.min(1, Math.max(0, (t - ENTRY.astreDelay) / ENTRY.astreMs)));
/** L'astre que es dibuixa: el sol si és sobre l'horitzó, si no la lluna (de dia no se'n calcula). */
const astreAngle = (sky: WelcomeSky) => sky.sunAngle ?? sky.moon.angle;

/**
 * Mou el sol o la lluna a un angle de l'òrbita sense passar per React (a cada fotograma de l'entrada no es torna a
 * pintar la columna sencera). El render deixa sempre la posició final, que és la que queda en acabar.
 */
function placeAstre(sun: SVGGElement | null, moonHalo: SVGGElement | null, moon: HTMLDivElement | null, south: boolean, angle: number) {
  const [x, y] = orbitPoint(angle);
  const px = south ? 640 - x : x;
  const transform = `translate(${px.toFixed(1)} ${y.toFixed(1)})`;
  sun?.setAttribute('transform', transform);
  moonHalo?.setAttribute('transform', transform);
  if (moon) {
    moon.style.left = pct(px);
    moon.style.top = pct(y);
  }
}

export default function SkyColumn({ sky, labels, compact = false }: SkyColumnProps) {
  const theme = THEME[sky.phase];
  const contours = useMemo(() => contourPaths(), []);
  const clipId = `orbit${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`;
  const [shown, setShown] = useState(prefersReducedMotion);
  const rootRef = useRef<HTMLDivElement>(null);
  const astreRef = useRef<Element | null>(null);
  const labelRefs = useRef<(HTMLSpanElement | null)[]>([]);
  // Bit i = l'etiqueta i queda sota el sol o la lluna i s'amaga.
  const [covered, setCovered] = useState(0);

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

  // --- Entrada ---
  const arcRef = useRef<SVGPathElement>(null);
  const sunGroupRef = useRef<SVGGElement>(null);
  const moonHaloRef = useRef<SVGGElement>(null);
  const moonDivRef = useRef<HTMLDivElement | null>(null);
  // L'entrada ha acabat (o no n'hi ha): fins llavors, l'arc porta el traç discontinu que el dibuixa.
  const [settled, setSettled] = useState(prefersReducedMotion);
  // El cel pot canviar mentre dura l'entrada (arriba la posició real del dispositiu): s'hi llegeix sempre el darrer.
  const skyRef = useRef(sky);
  useLayoutEffect(() => { skyRef.current = sky; }, [sky]);

  // Abans del primer pintat, l'astre a l'horitzó de l'est, on comença.
  useLayoutEffect(() => {
    if (settled || astreAngle(skyRef.current) === null) return;
    placeAstre(sunGroupRef.current, moonHaloRef.current, moonDivRef.current, skyRef.current.south, -HORIZON_ANGLE);
  }, [settled]);

  useEffect(() => {
    if (!shown || settled) return;
    const total = astreAngle(skyRef.current) !== null ? ENTRY.astreDelay + ENTRY.astreMs : ENTRY.arcMs;
    // L'arc es dibuixa cap a on va el sol: des de l'esquerra a l'hemisferi nord i des de la dreta al sud.
    const arcFrom = skyRef.current.south ? -1 : 1;
    let raf = 0;
    const finish = () => {
      cancelAnimationFrame(raf);
      const target = astreAngle(skyRef.current);
      if (target !== null) placeAstre(sunGroupRef.current, moonHaloRef.current, moonDivRef.current, skyRef.current.south, target);
      setSettled(true);
    };
    // Un sol rellotge per a l'arc i l'astre, que comença al primer fotograma: si el mòbil va ocupat en acabar de
    // carregar, no es descompassen (amb una transició CSS per a l'arc, l'arc ja era a mig dibuixar quan el sol sortia).
    let t0 = -1;
    const step = (now: number) => {
      if (t0 < 0) t0 = now;
      const t = now - t0;
      if (t >= total) { finish(); return; }
      if (arcRef.current) arcRef.current.style.strokeDashoffset = String(arcFrom * (1 - easeInOutCubic(Math.min(1, t / ENTRY.arcMs))));
      const target = astreAngle(skyRef.current);
      if (target !== null) placeAstre(sunGroupRef.current, moonHaloRef.current, moonDivRef.current, skyRef.current.south, entryAngle(t, target));
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    // Reserva: sense fotogrames (pestanya en segon pla), tot va directe al seu lloc.
    const timer = window.setTimeout(finish, total + 1000);
    return () => {
      cancelAnimationFrame(raf);
      window.clearTimeout(timer);
    };
  }, [shown, settled]);

  // Posicions reals a la pantalla (les etiquetes tenen mida de lletra fixa i la columna s'escala): es mesura
  // després de pintar i quan la columna canvia de mida.
  useLayoutEffect(() => {
    const measure = () => {
      const a = astreRef.current?.getBoundingClientRect();
      let mask = 0;
      if (a && a.width > 0) {
        const pad = a.width * 0.12;
        labelRefs.current.forEach((el, i) => {
          const r = el?.getBoundingClientRect();
          if (r && r.width > 0 && r.left < a.right + pad && r.right > a.left - pad && r.top < a.bottom + pad && r.bottom > a.top - pad) mask |= 1 << i;
        });
      }
      setCovered(prev => (prev === mask ? prev : mask));
    };
    measure();
    const root = rootRef.current;
    if (!root || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(measure);
    ro.observe(root);
    return () => ro.disconnect();
  }, [sky, labels, compact, settled]);

  let labelIndex = 0;
  const labelProps = () => {
    const i = labelIndex++;
    return {
      ref: (el: HTMLSpanElement | null) => { labelRefs.current[i] = el; },
      style: { opacity: covered & (1 << i) ? 0 : 1, transition: 'opacity 300ms ease-out' },
    };
  };
  const moonSize = compact ? MOON_SIZE.compact : MOON_SIZE.wide;

  const fade = (delay: number) => ({
    opacity: shown ? 1 : 0,
    transition: `opacity 700ms ease-out ${delay}ms`,
  });
  const textSize = compact ? 'text-[9.5px]' : 'text-[11px]';
  const bandSize = compact ? 'text-[10px]' : 'text-[12px]';

  return (
    <div ref={rootRef} className="relative w-full h-full">
      <div
        aria-hidden="true"
        className="absolute top-[78%] w-[150%] h-[80%] -translate-x-1/2 -translate-y-1/2 pointer-events-none"
        style={{ left: glowLeft, background: `radial-gradient(closest-side, ${withAlpha(sky.colors.glow, twilight ? 0.7 : 0.55)}, transparent)` }}
      />

      <svg role="img" aria-label={labels.alt} viewBox="0 0 640 640" fill="none" className="absolute inset-0 w-full h-full overflow-visible">
        <defs>
          {/* La part de l'òrbita sota l'horitzó s'acaba poc després del disc: si no, baixava fins al text. */}
          <clipPath id={clipId}><rect x="-200" y="-200" width="1040" height="800" /></clipPath>
          {/* Resplendors amb un sol degradat radial (cap filtre): abans eren cercles de vora dura, com una diana. */}
          <radialGradient id={`${clipId}-sun`}>
            <stop offset="0" stopColor={theme.sun.core} />
            <stop offset="0.17" stopColor={theme.sun.core} />
            <stop offset="0.22" stopColor={theme.sun.mid} stopOpacity={0.6} />
            <stop offset="0.38" stopColor={theme.sun.glow} stopOpacity={0.26} />
            <stop offset="0.62" stopColor={theme.sun.glow} stopOpacity={0.08} />
            <stop offset="1" stopColor={theme.sun.glow} stopOpacity={0} />
          </radialGradient>
          <radialGradient id={`${clipId}-moon`}>
            <stop offset="0.3" stopColor="#c8d4ff" stopOpacity={0.2} />
            <stop offset="0.6" stopColor="#c8d4ff" stopOpacity={0.07} />
            <stop offset="1" stopColor="#c8d4ff" stopOpacity={0} />
          </radialGradient>
          {/* Volum de la columna: més clara pel costat d'on ve la llum i més fosca per l'altre. */}
          <linearGradient id={`${clipId}-lit`} gradientUnits="userSpaceOnUse" x1={litLeft ? 250 : 390} y1="0" x2={litLeft ? 390 : 250} y2="0">
            <stop offset="0" stopColor="#ffffff" stopOpacity={sky.phase === 'nit' ? 0.08 : 0.14} />
            <stop offset="0.45" stopColor="#ffffff" stopOpacity={0.02} />
            <stop offset="1" stopColor="#000000" stopOpacity={0.2} />
          </linearGradient>
        </defs>
        <g style={fade(0)}>
          <ellipse cx={ORBIT.cx} cy={ORBIT.cy} rx={ORBIT.rx} ry={ORBIT.ry} stroke="#e2e8f0" strokeOpacity={0.14} strokeDasharray="2 6" vectorEffect="non-scaling-stroke" clipPath={`url(#${clipId})`} />
          {/* A l'entrada l'arc es dibuixa des de l'horitzó per on surt el sol (a l'hemisferi sud, des de la dreta);
              en acabar, traç continu sense trucs. */}
          <path
            ref={arcRef}
            d={DAY_ARC}
            stroke={theme.orbit}
            strokeOpacity={0.55}
            strokeWidth={1.25}
            vectorEffect="non-scaling-stroke"
            pathLength={settled ? undefined : 1}
            strokeDasharray={settled ? undefined : '1 1'}
            style={settled ? undefined : { strokeDashoffset: sky.south ? -1 : 1 }}
          />
          {ORBIT_TICKS.map(([x, y], i) => <circle key={i} cx={mirror(x)} cy={y} r={2.4} fill={theme.orbit} opacity={0.7} />)}
          {sunPoint && (
            <g ref={sunGroupRef} transform={`translate(${mirror(sunPoint[0]).toFixed(1)} ${sunPoint[1].toFixed(1)})`}>
              <circle r={84} fill={`url(#${clipId}-sun)`} />
              <circle ref={el => { astreRef.current = el; }} r={28} fill="transparent" />
              <circle r={15} fill={theme.sun.core} />
            </g>
          )}
          {moonPoint && !sunPoint && (
            <g ref={moonHaloRef} transform={`translate(${mirror(moonPoint[0]).toFixed(1)} ${moonPoint[1].toFixed(1)})`}>
              <circle r={moonSize * 1.6} fill={`url(#${clipId}-moon)`} />
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
          {/* Un casc de miner minúscul que treu el cap per sota del disc: la pista que també s'hi pot baixar. */}
          <g transform="translate(398 597) scale(0.8)">
            <path d="M-3 4L-22 30H14Z" fill="#fef3c7" opacity={0.18} />
            <path d="M-16 0A16 13 0 0 1 16 0Z" fill="#f59e0b" />
            <path d="M-2 -12.6V0M-9 -10V0M5 -12V0" stroke="#b45309" strokeOpacity={0.5} strokeWidth={1.2} />
            <rect x={-20} y={-1} width={40} height={5} rx={2.5} fill="#d97706" />
            <circle cx={-3} cy={-5} r={4.2} fill="#fef3c7" stroke="#b45309" strokeWidth={1} />
          </g>
        </g>

        {/* El disc cedeix quan s'aixafa la columna: s'enfosqueix al voltant de la base i s'hi obren esquerdes. */}
        <g style={PRESS}>
          <ellipse cx={320} cy={508} rx={118} ry={34} fill="#000" opacity={0.28} />
          <ellipse cx={320} cy={510} rx={88} ry={25} fill="#000" opacity={0.22} />
          <path d="M196 520q-14 6-30 6M444 520q14 6 30 6M226 538q-8 8-22 12M414 538q8 8 22 12" stroke="#fdba74" strokeOpacity={0.6} strokeWidth={1.6} strokeLinecap="round" vectorEffect="non-scaling-stroke" />
        </g>

        <g
          style={{
            opacity: shown ? 1 : 0,
            transform: shown ? 'scaleY(1)' : 'scaleY(0.55)',
            transformOrigin: '320px 500px',
            transition: 'transform 900ms cubic-bezier(.2,.7,.2,1) 160ms, opacity 600ms ease-out 160ms',
          }}
        >
          <g style={STRETCH}>
          <path d="M250 405A70 21 0 0 0 390 405V500A70 21 0 0 1 250 500Z" fill="#4f46e5" opacity={theme.bands[0]} />
          <path d="M250 247A70 21 0 0 0 390 247V405A70 21 0 0 1 250 405Z" fill="#3b82f6" opacity={theme.bands[1]} />
          <path d="M250 120A70 21 0 0 0 390 120V247A70 21 0 0 1 250 247Z" fill="#7dd3fc" opacity={theme.bands[2]} />
          <ellipse cx="320" cy="120" rx="70" ry="21" fill="#7dd3fc" opacity={theme.bands[2]} stroke="#e2e8f0" strokeOpacity={0.4} vectorEffect="non-scaling-stroke" />
          <path d="M250 120V500A70 21 0 0 0 390 500V120A70 21 0 0 0 250 120Z" fill={`url(#${clipId}-lit)`} />
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

          {/* Un astronauta minúscul dret al capdamunt de la columna: la pista que la columna amaga alguna cosa. */}
          <g style={ASTRONAUT_LIFT}>
            <g transform="translate(320 100) scale(0.8)">
              <path d="M6 11L13 2" stroke="#e2e8f0" strokeWidth={3.2} strokeLinecap="round" />
              <rect x={-9} y={9} width={5} height={10} rx={2} fill="#94a3b8" />
              <rect x={-6} y={8} width={12} height={12} rx={3.5} fill="#e2e8f0" />
              <rect x={-6} y={18} width={5} height={8} rx={2} fill="#e2e8f0" />
              <rect x={1} y={18} width={5} height={8} rx={2} fill="#e2e8f0" />
              <circle cy={3} r={7} fill="#f8fafc" />
              <ellipse cx={1.6} cy={3} rx={4.4} ry={3.2} fill="#1e293b" />
              <ellipse cx={3} cy={1.8} rx={1.3} ry={0.9} fill={theme.sun.mid} />
            </g>
          </g>
        </g>
      </svg>

      {moonPoint && !sunPoint && (
        <div
          ref={el => { astreRef.current = el; moonDivRef.current = el; }}
          aria-hidden="true"
          className="absolute -translate-x-1/2 -translate-y-1/2"
          style={{ left: pct(mirror(moonPoint[0])), top: pct(moonPoint[1]), width: pct(moonSize), height: pct(moonSize), ...fade(0) }}
        >
          <MoonDisc phase={sky.moon.phase} south={sky.south} />
        </div>
      )}

      <div aria-hidden="true" className={`absolute inset-0 pointer-events-none text-slate-300 ${textSize}`} style={fade(300)}>
        {(['12 km', '8 km', '3 km'] as const).map((label, i) => {
          const { ref, style } = labelProps();
          return <span key={label} ref={ref} className="absolute -translate-x-full -translate-y-1/2 font-mono whitespace-nowrap" style={{ left: '37%', top: ['18.75%', '38.55%', '63.28%'][i], ...style }}>{label}</span>;
        })}
        {([[labels.high, 'text-sky-300', '28.6%'], [labels.mid, 'text-blue-300', '50.9%'], [labels.low, 'text-indigo-200', '65%']] as const).map(([text, color, top]) => {
          const { ref, style } = labelProps();
          return <span key={top} ref={ref} className={`absolute -translate-y-1/2 font-semibold whitespace-nowrap ${color} ${bandSize}`} style={{ left: '63%', top, ...style }}>{text}</span>;
        })}
        {([[sky.south ? labels.west : labels.east, '12.5%', '82%'], [sky.south ? labels.east : labels.west, '87.5%', '82%'], [sky.south ? labels.south : labels.north, '50%', '92.8%']] as const).map(([text, left, top]) => {
          const { ref, style } = labelProps();
          return <span key={left} ref={ref} className="absolute -translate-x-1/2 -translate-y-1/2 font-bold text-slate-400" style={{ left, top, ...style }}>{text}</span>;
        })}
        {labels.caption && (
          <span className="absolute left-1/2 top-[98%] -translate-x-1/2 -translate-y-1/2 whitespace-nowrap text-slate-400">{labels.caption}</span>
        )}
      </div>
    </div>
  );
}
