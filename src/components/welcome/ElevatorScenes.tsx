// src/components/welcome/ElevatorScenes.tsx
// Els dibuixos de les parades de l'ascensor de la Columna del cel (vegeu SkyElevator): els teus núvols, el sostre del
// temps, la línia de Kármán, l'Estació Espacial, l'arribada al Meteosat i la reentrada. Cada escena és un llenç de
// 390 × 844 (un mòbil dret): en pantalles més amples el viewBox s'eixampla pels costats (viewBoxFor) i el que hi ha
// d'horitzontal (núvols, línies, estrelles, la Terra) s'hi allarga. Només SVG i degradats: cap filtre ni
// desenfocament, i cap animació pròpia (el que es mou ho mou SkyElevator amb transformacions).
import { CSSProperties, ReactNode, Ref, useId, useMemo } from 'react';
import type { ElevatorClouds } from '../../hooks/welcome/useElevatorClouds';
import { ART_H, ART_W, type ViewBox } from '../../utils/welcome/skyElevator';
import type { WelcomePhase } from '../../utils/welcome/welcomeSky';

const viewBoxAttr = (vb: ViewBox) => `${vb.x.toFixed(1)} 0 ${vb.w.toFixed(1)} ${ART_H}`;
/** Posició vertical d'un punt del llenç, en % de la pantalla (per a les etiquetes HTML de sobre el dibuix). */
const artTop = (y: number) => `${((y / ART_H) * 100).toFixed(2)}%`;

const svgFill: CSSProperties = { position: 'absolute', inset: 0, width: '100%', height: '100%' };

/** Generador pseudoaleatori amb llavor: les estrelles i els llums surten sempre al mateix lloc. */
function seeded(seed: number) {
  let s = seed | 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const dot = (x: number, y: number, r: number) =>
  `M${(x - r).toFixed(1)} ${y.toFixed(1)}a${r} ${r} 0 1 0 ${2 * r} 0a${r} ${r} 0 1 0 ${-2 * r} 0`;

/** Punts escampats pel tros visible, en tres grups (tènues, mitjans, brillants): tres camins en lloc de centenars de cercles. */
function useDots(vb: ViewBox, top: number, bottom: number, perScreen: number, seed: number): [string, string, string] {
  return useMemo(() => {
    const rand = seeded(seed);
    const groups: [string[], string[], string[]] = [[], [], []];
    const n = Math.round((vb.w / ART_W) * perScreen);
    for (let i = 0; i < n; i++) {
      const g = rand() < 0.55 ? 0 : rand() < 0.7 ? 1 : 2;
      groups[g].push(dot(vb.x + rand() * vb.w, top + rand() * (bottom - top), [0.75, 1, 1.35][g]));
    }
    return [groups[0].join(''), groups[1].join(''), groups[2].join('')];
  }, [vb.x, vb.w, top, bottom, perScreen, seed]);
}

function Stars({ vb, top = 50, bottom = 560, perScreen = 26, seed = 7 }: { vb: ViewBox; top?: number; bottom?: number; perScreen?: number; seed?: number }) {
  const [dim, mid, bright] = useDots(vb, top, bottom, perScreen, seed);
  return (
    <g fill="#e2e8f0">
      <path d={dim} opacity={0.45} />
      <path d={mid} opacity={0.7} />
      <path d={bright} opacity={0.95} />
    </g>
  );
}

/** Rètol petit sobre el dibuix (HTML, perquè el text no s'escali amb el llenç). */
export function Tag({ children, style, className = '' }: { children: ReactNode; style?: CSSProperties; className?: string }) {
  return (
    <div className={`absolute flex items-center gap-2 whitespace-nowrap rounded-full bg-[rgba(12,15,23,0.62)] px-3 py-1.5 text-[13px] font-semibold ${className}`} style={style}>
      {children}
    </div>
  );
}

/** Enfosquit de sota perquè el text de la parada es llegeixi bé sobre qualsevol dibuix. */
function BottomScrim({ color = '8, 12, 24' }: { color?: string }) {
  return (
    <div
      aria-hidden="true"
      className="absolute inset-x-0 bottom-0 h-[36%]"
      style={{ background: `linear-gradient(180deg, rgba(${color}, 0) 0%, rgba(${color}, 0.82) 55%, rgba(${color}, 0.95) 100%)` }}
    />
  );
}

// --- 1. Els teus núvols ---

// Colors dels núvols de cada moment del dia: els mateixos de la columna de la benvinguda (SkyColumn).
const CLOUD_COLORS: Readonly<Record<WelcomePhase, { cloud: string; shade: string; alpha: number }>> = {
  alba: { cloud: '#f2c6d4', shade: '#b98aa8', alpha: 0.9 },
  dia: { cloud: '#f1f5f9', shade: '#aab8cc', alpha: 0.95 },
  posta: { cloud: '#ffd9c2', shade: '#e0926e', alpha: 0.92 },
  nit: { cloud: '#8d99bd', shade: '#56607f', alpha: 0.7 },
};

// Un tros de 390 de cada capa, que es repeteix de costat a costat. Ordenats perquè, si la cobertura és baixa, els
// que queden estiguin repartits.
const CIRRUS: ReadonlyArray<readonly [string, number]> = [
  ['M58 168q60-14 120-6q30 4 52-10', 2], ['M214 146q44-10 90-3q20 3 36-7', 1.8], ['M150 198q50-10 100-2q24 4 44-8', 1.6],
  ['M40 214q40-8 80-2q16 2 28-4', 1.4], ['M250 222q36-8 72-2q14 2 26-5', 1.4], ['M96 128q40-8 78-2', 1.2],
];
const ALTOCUMULUS: ReadonlyArray<readonly [number, number, 'top' | 'mid' | 'shade']> = [
  [68, 410, 'mid'], [240, 409, 'mid'], [154, 431, 'shade'], [314, 410, 'mid'], [98, 388, 'top'], [270, 389, 'top'],
  [184, 411, 'mid'], [40, 430, 'shade'], [344, 391, 'top'], [126, 408, 'mid'], [268, 429, 'shade'], [212, 392, 'top'],
  [372, 408, 'mid'], [40, 390, 'top'], [326, 430, 'shade'], [98, 428, 'shade'],
];
/** Cúmuls: tres bancs de 130 d'ample cadascun (cercles, base i ombra). */
const CUMULUS_BANKS: ReadonlyArray<number> = [138, 0, 268];

const coverCount = (n: number, cover: number) => Math.round((n * cover) / 100);

/** Alçada al llenç (y) d'una alçada real (m) dins l'escena dels núvols: 1,2 km a y = 625 i 9 km a y = 185. */
const cloudSceneY = (altitude: number) => 692.7 - (altitude / 1000) * 56.4;

interface CloudsSceneProps {
  vb: ViewBox;
  phase: WelcomePhase;
  sky: { top: string; mid: string; bottom: string; glow: string };
  /** Cobertura real (null: encara no ha arribat o no se sap, i es dibuixa la meitat de cada capa). */
  clouds: ElevatorClouds | null;
  tags: { high: ReactNode; mid: ReactNode; low: ReactNode };
  snow: { line: string; level: string } | null;
}

export function CloudsScene({ vb, phase, sky, clouds, tags, snow }: CloudsSceneProps) {
  const id = `ec${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`;
  const c = CLOUD_COLORS[phase];
  const high = coverCount(CIRRUS.length, clouds?.high ?? 50);
  const mid = coverCount(ALTOCUMULUS.length, clouds?.mid ?? 50);
  const low = coverCount(CUMULUS_BANKS.length, clouds?.low ?? 50);
  const snowY = clouds?.snowLevel != null ? cloudSceneY(clouds.snowLevel) : null;
  const showSnow = snow && snowY !== null && snowY > 120 && snowY < 640;
  return (
    <>
      <div className="absolute inset-0" style={{ background: `linear-gradient(180deg, ${sky.top} 0%, ${sky.mid} 46%, ${sky.bottom} 100%)` }} />
      <div className="absolute inset-0" style={{ background: `radial-gradient(circle at 92% 28%, ${sky.glow} 0%, transparent 42%)`, opacity: phase === 'nit' ? 0.25 : 0.55 }} />
      <svg aria-hidden="true" viewBox={viewBoxAttr(vb)} preserveAspectRatio="xMidYMid slice" style={svgFill}>
        <defs>
          <pattern id={`${id}-p`} patternUnits="userSpaceOnUse" x="0" y="0" width={ART_W} height={ART_H}>
            <g stroke={c.cloud} strokeLinecap="round" fill="none" opacity={0.78}>
              {CIRRUS.slice(0, high).map(([d, w]) => <path key={d} d={d} strokeWidth={w} />)}
            </g>
            {ALTOCUMULUS.slice(0, mid).map(([x, y, kind]) => (
              <ellipse
                key={`${x}-${y}`}
                cx={x} cy={y}
                rx={kind === 'mid' ? 27 : 25} ry={kind === 'mid' ? 11 : kind === 'top' ? 10 : 9}
                fill={kind === 'shade' ? c.shade : c.cloud}
                opacity={kind === 'mid' ? c.alpha : 0.82 * c.alpha}
              />
            ))}
            {CUMULUS_BANKS.slice(0, low).map(x => (
              <g key={x} transform={`translate(${x} 0)`}>
                <ellipse cx={64} cy={650} rx={58} ry={5} fill={c.shade} opacity={c.alpha} />
                <g fill={c.cloud} opacity={c.alpha}>
                  <circle cx={22} cy={626} r={22} />
                  <circle cx={52} cy={606} r={30} />
                  <circle cx={86} cy={620} r={24} />
                  <circle cx={112} cy={630} r={18} />
                  <rect x={0} y={622} width={128} height={26} rx={12} />
                </g>
              </g>
            ))}
          </pattern>
        </defs>
        <rect x={vb.x} y={0} width={vb.w} height={ART_H} fill={`url(#${id}-p)`} />
        {showSnow && (
          <path d={`M${vb.x} ${snowY}H${vb.x + vb.w}`} stroke="#e0f2fe" strokeOpacity={0.75} strokeWidth={1.5} strokeDasharray="6 6" />
        )}
      </svg>
      <BottomScrim />
      <Tag style={{ right: 20, top: artTop(118) }} className="text-sky-300">{tags.high}</Tag>
      <Tag style={{ right: 20, top: artTop(338) }} className="text-blue-300">{tags.mid}</Tag>
      <Tag style={{ right: 20, top: artTop(560) }} className="text-indigo-200">{tags.low}</Tag>
      {showSnow && (
        <div className="absolute left-[92px] flex items-center gap-2 rounded-2xl bg-[rgba(12,15,23,0.62)] px-3 py-1.5" style={{ top: `calc(${artTop(snowY)} - 22px)` }}>
          <svg aria-hidden="true" viewBox="-10 -10 20 20" className="w-4 h-4 shrink-0" fill="none" stroke="#e0f2fe" strokeWidth={1.8} strokeLinecap="round">
            <path d="M0 -9V9M-7.8 -4.5L7.8 4.5M-7.8 4.5L7.8 -4.5M-2.5 -7 0 -4.5 2.5 -7M-2.5 7 0 4.5 2.5 7" />
          </svg>
          <span className="flex flex-col leading-tight">
            <span className="text-[13px] font-semibold text-sky-50">{snow.line}</span>
            <span className="font-mono text-[11px] text-slate-300">{snow.level}</span>
          </span>
        </div>
      )}
    </>
  );
}

// --- 2. El sostre del temps ---

interface TropopauseSceneProps {
  vb: ViewBox;
  night: boolean;
  tropoTag: string;
  planeTag: string;
  /** L'avió, que SkyElevator fa creuar la pantalla. */
  planeRef: Ref<SVGGElement>;
}

export function TropopauseScene({ vb, night, tropoTag, planeTag, planeRef }: TropopauseSceneProps) {
  const id = `et${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`;
  return (
    <>
      <div className="absolute inset-0" style={{ background: night ? 'linear-gradient(180deg, #020409 0%, #050b18 44%, #0a1530 100%)' : 'linear-gradient(180deg, #050a1a 0%, #0b1a3a 44%, #17356a 100%)' }} />
      {!night && <div className="absolute inset-0" style={{ background: 'radial-gradient(circle at 98% 52%, rgba(255,246,221,0.34) 0%, rgba(255,246,221,0.1) 18%, rgba(255,246,221,0) 36%)' }} />}
      <div className="absolute inset-x-0" style={{ top: artTop(336), height: artTop(48), background: 'linear-gradient(180deg, rgba(125,211,252,0) 0%, rgba(125,211,252,0.2) 50%, rgba(125,211,252,0) 100%)' }} />
      <svg aria-hidden="true" viewBox={viewBoxAttr(vb)} preserveAspectRatio="xMidYMid slice" style={svgFill}>
        <defs>
          <linearGradient id={`${id}-trail`} x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" stopColor="#ffffff" stopOpacity={0.85} />
            <stop offset="1" stopColor="#ffffff" stopOpacity={0} />
          </linearGradient>
        </defs>
        {night && <Stars vb={vb} top={40} bottom={330} perScreen={18} seed={3} />}
        <path d={`M${vb.x} 360H${vb.x + vb.w}`} stroke="#7dd3fc" strokeWidth={1.5} />
        <g ref={planeRef}>
          <rect x={196} y={436} width={260} height={3} rx={1.5} fill={`url(#${id}-trail)`} />
          <rect x={196} y={451} width={260} height={3} rx={1.5} fill={`url(#${id}-trail)`} />
          <rect x={200} y={433} width={250} height={9} rx={4.5} fill={`url(#${id}-trail)`} opacity={0.25} />
          <rect x={200} y={448} width={250} height={9} rx={4.5} fill={`url(#${id}-trail)`} opacity={0.25} />
          <g transform="translate(166 444) scale(-1.7 1.7)" fill="#f8fafc">
            <path d="M18 0Q17 -2 12 -2H6L-2 -14H-6L-1 -2H-12L-16 -7H-19L-17 0L-19 7H-16L-12 2H-1L-6 14H-2L6 2H12Q17 2 18 0Z" />
          </g>
          {night && (
            <>
              <circle cx={159} cy={420.5} r={1.8} fill="#ef4444" />
              <circle cx={159} cy={467.5} r={1.8} fill="#22c55e" />
            </>
          )}
          <rect x={102} y={478} width={130} height={24} rx={12} fill="rgba(12,15,23,0.62)" />
          <text x={167} y={494} textAnchor="middle" fontSize={12} fontWeight={500} fill="#e2e8f0" fontFamily="system-ui, sans-serif">{planeTag}</text>
        </g>
        <g fill="#f1f5f9" opacity={night ? 0.25 : 0.45}>
          <circle cx={120} cy={592} r={8} /><circle cx={132} cy={586} r={11} /><circle cx={146} cy={592} r={8} />
          <circle cx={252} cy={600} r={7} /><circle cx={262} cy={595} r={9} /><circle cx={274} cy={600} r={7} />
        </g>
      </svg>
      <BottomScrim />
      <div className="absolute right-5 font-mono text-[11px] tracking-[0.14em] uppercase text-sky-300" style={{ top: artTop(334) }}>{tropoTag}</div>
    </>
  );
}

// --- La Terra des de l'espai (Kármán i Estació Espacial) ---

function Earth({ cx, cy, r, night, glowR, idPrefix, seed }: { cx: number; cy: number; r: number; night: boolean; glowR: number; idPrefix: string; seed: number }) {
  const top = cy - r;
  // De nit, llums de ciutats escampats a prop de l'horitzó.
  const lights = useMemo(() => {
    if (!night) return '';
    const rand = seeded(seed);
    let d = '';
    for (let i = 0; i < 70; i++) {
      const x = cx + (rand() - 0.5) * r * 1.6;
      const y = cy - Math.sqrt(Math.max(0, r * r - (x - cx) ** 2)) + 10 + rand() * 150;
      d += dot(x, y, 0.6 + rand() * 0.9);
    }
    return d;
  }, [night, cx, cy, r, seed]);
  return (
    <>
      <defs>
        <radialGradient id={`${idPrefix}-limb`} gradientUnits="userSpaceOnUse" cx={cx} cy={cy} r={glowR}>
          <stop offset={r / glowR - 0.005} stopColor="#7dd3fc" stopOpacity={night ? 0.55 : 0.95} />
          <stop offset={(r / glowR + 1) / 2} stopColor="#3b82f6" stopOpacity={night ? 0.18 : 0.38} />
          <stop offset={1} stopColor="#1e3a8a" stopOpacity={0} />
        </radialGradient>
        <radialGradient id={`${idPrefix}-earth`} gradientUnits="userSpaceOnUse" cx={cx} cy={top} r={r * 0.46 + 120}>
          <stop offset={0} stopColor={night ? '#16233f' : '#3b82c4'} />
          <stop offset={0.38} stopColor={night ? '#0c1630' : '#1d5596'} />
          <stop offset={1} stopColor={night ? '#050a16' : '#0b2a52'} />
        </radialGradient>
      </defs>
      <circle cx={cx} cy={cy} r={glowR} fill={`url(#${idPrefix}-limb)`} />
      <circle cx={cx} cy={cy} r={r} fill={`url(#${idPrefix}-earth)`} />
      <circle cx={cx} cy={cy} r={r} fill="none" stroke={night ? '#60a5fa' : '#bae6fd'} strokeOpacity={night ? 0.6 : 1} strokeWidth={2} />
      <g fill="#f1f5f9" opacity={night ? 0.18 : 1}>
        <ellipse cx={cx - 115} cy={top + 32} rx={58} ry={4} opacity={0.55} />
        <ellipse cx={cx + 41} cy={top + 28} rx={74} ry={4} opacity={0.6} />
        <ellipse cx={cx + 159} cy={top + 40} rx={44} ry={3.5} opacity={0.45} />
        <ellipse cx={cx - 45} cy={top + 64} rx={90} ry={7} opacity={0.5} />
        <ellipse cx={cx + 125} cy={top + 80} rx={70} ry={8} opacity={0.45} />
        <ellipse cx={cx - 135} cy={top + 116} rx={76} ry={10} opacity={0.4} />
        <ellipse cx={cx + 31} cy={top + 140} rx={110} ry={13} opacity={0.4} />
      </g>
      {night && <path d={lights} fill="#fbbf24" opacity={0.75} />}
    </>
  );
}

// --- 3. Línia de Kármán ---

interface SpaceSceneProps {
  vb: ViewBox;
  night: boolean;
  karmanTag: string;
  meteorsTag: string;
  meteorsRef: Ref<SVGGElement>;
}

export function SpaceScene({ vb, night, karmanTag, meteorsTag, meteorsRef }: SpaceSceneProps) {
  const id = `es${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`;
  return (
    <>
      <div className="absolute inset-0" style={{ background: 'linear-gradient(180deg, #02030a 0%, #050818 60%, #0a1230 100%)' }} />
      <svg aria-hidden="true" viewBox={viewBoxAttr(vb)} preserveAspectRatio="xMidYMid slice" style={svgFill}>
        <defs>
          <linearGradient id={`${id}-met`} x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" stopColor="#ffffff" stopOpacity={1} />
            <stop offset="1" stopColor="#ffffff" stopOpacity={0} />
          </linearGradient>
          <linearGradient id={`${id}-met2`} x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" stopColor="#d9f99d" stopOpacity={1} />
            <stop offset="1" stopColor="#d9f99d" stopOpacity={0} />
          </linearGradient>
        </defs>
        <Stars vb={vb} top={60} bottom={540} seed={11} />
        <path d={`M${vb.x} 300H${vb.x + vb.w}`} stroke="#fde68a" strokeWidth={1.5} strokeDasharray="8 6" />
        <g ref={meteorsRef}>
          <g transform="translate(108 474) rotate(-35)">
            <rect y={-1.2} width={118} height={2.4} rx={1.2} fill={`url(#${id}-met)`} />
            <circle r={6} fill="#ffffff" opacity={0.22} />
            <circle r={2.4} fill="#ffffff" />
          </g>
          <g transform="translate(244 404) rotate(-35)">
            <rect y={-1} width={84} height={2} rx={1} fill={`url(#${id}-met2)`} />
            <circle r={5} fill="#d9f99d" opacity={0.22} />
            <circle r={2} fill="#ecfccb" />
          </g>
          <g transform="translate(316 512) rotate(-35)" opacity={0.6}>
            <rect y={-0.8} width={58} height={1.6} rx={0.8} fill={`url(#${id}-met)`} />
            <circle r={1.6} fill="#ffffff" />
          </g>
        </g>
        <Earth cx={195} cy={1460} r={900} glowR={950} night={night} idPrefix={id} seed={5} />
      </svg>
      <BottomScrim color="5, 8, 20" />
      <div className="absolute right-5 font-mono text-[11px] tracking-[0.14em] uppercase text-amber-200" style={{ top: artTop(276) }}>{karmanTag}</div>
      <Tag style={{ right: 20, top: artTop(444) }} className="font-medium text-slate-200">{meteorsTag}</Tag>
    </>
  );
}

// --- 4. L'Estació Espacial ---

interface StationSceneProps {
  vb: ViewBox;
  night: boolean;
  issTag: string;
  next: [string, string];
  issRef: Ref<SVGGElement>;
  speedRef: Ref<SVGGElement>;
}

const UpArrow = () => (
  <svg aria-hidden="true" viewBox="0 0 24 24" className="w-3 h-3 shrink-0" fill="none" stroke="#fde68a" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 19V5M5 12l7-7 7 7" />
  </svg>
);

export function StationScene({ vb, night, issTag, next, issRef, speedRef }: StationSceneProps) {
  const id = `ei${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`;
  // Línies de velocitat repartides pel tros visible (es fan servir quan l'altímetre corre cap al Meteosat).
  const speed = useMemo(() => {
    const rand = seeded(23);
    const n = Math.round((vb.w / ART_W) * 9);
    return Array.from({ length: n }, () => [vb.x + rand() * vb.w, 80 + rand() * 520, 80 + rand() * 80] as const);
  }, [vb.x, vb.w]);
  return (
    <>
      <div className="absolute inset-0" style={{ background: 'linear-gradient(180deg, #010208 0%, #04060f 60%, #070b1c 100%)' }} />
      <svg aria-hidden="true" viewBox={viewBoxAttr(vb)} preserveAspectRatio="xMidYMid slice" style={svgFill}>
        <defs>
          <linearGradient id={`${id}-speed`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#e2e8f0" stopOpacity={0} />
            <stop offset="0.5" stopColor="#e2e8f0" stopOpacity={0.55} />
            <stop offset="1" stopColor="#e2e8f0" stopOpacity={0} />
          </linearGradient>
        </defs>
        <Stars vb={vb} top={120} bottom={520} perScreen={16} seed={17} />
        <g ref={speedRef} opacity={0}>
          {speed.map(([x, y, h], i) => <rect key={i} x={x} y={y} width={1.2} height={h} fill={`url(#${id}-speed)`} />)}
        </g>
        <Earth cx={195} cy={1080} r={520} glowR={552} night={night} idPrefix={id} seed={9} />
        <g ref={issRef}>
          <g transform="translate(206 392) rotate(-12)">
            <rect x={-74} y={-2} width={148} height={4} rx={1} fill="#cbd5e1" />
            <g fill="#a87b34" stroke="#e7c27a" strokeOpacity={0.7} strokeWidth={0.8}>
              {[-68, -51, 38, 55].map(x => (
                <g key={x}>
                  <rect x={x} y={-50} width={13} height={46} />
                  <rect x={x} y={4} width={13} height={46} />
                </g>
              ))}
            </g>
            <g fill="#f1f5f9" opacity={0.9}>
              <rect x={-28} y={4} width={6} height={20} />
              <rect x={-18} y={4} width={6} height={20} />
              <rect x={18} y={-24} width={6} height={20} />
            </g>
            <rect x={-6} y={-34} width={12} height={70} rx={5} fill="#e2e8f0" />
            <rect x={-18} y={-30} width={36} height={9} rx={4} fill="#e2e8f0" />
            <rect x={-14} y={16} width={28} height={8} rx={4} fill="#cbd5e1" />
            <rect x={-34} y={30} width={22} height={6} fill="#a87b34" />
            <rect x={12} y={30} width={22} height={6} fill="#a87b34" />
          </g>
          <rect x={222} y={466} width={90} height={24} rx={12} fill="rgba(12,15,23,0.62)" />
          <text x={267} y={482} textAnchor="middle" fontSize={12} fontWeight={500} fill="#e2e8f0" fontFamily="system-ui, sans-serif">{issTag}</text>
        </g>
      </svg>
      <BottomScrim color="5, 8, 20" />
      <div className="absolute left-[92px] top-[92px] flex flex-col items-start gap-2">
        {next.map(text => (
          <Tag key={text} className="relative font-medium text-slate-300 border border-slate-200/15"><UpArrow />{text}</Tag>
        ))}
      </div>
    </>
  );
}

// --- 5. L'arribada: estrelles i el satèl·lit (el disc és MeteosatDisc) ---

export function ArrivalBackdrop({ vb }: { vb: ViewBox }) {
  return (
    <>
      <div className="absolute inset-0 bg-[#010208]" />
      <svg aria-hidden="true" viewBox={viewBoxAttr(vb)} preserveAspectRatio="xMidYMid slice" style={svgFill}>
        <Stars vb={vb} top={20} bottom={820} perScreen={22} seed={29} />
      </svg>
      <BottomScrim color="1, 2, 8" />
    </>
  );
}

/** El Meteosat-12 (MTG-I1): cos daurat, una sola ala de plaques solars i l'obertura de l'imager. */
export function MeteosatSatellite({ className = '' }: { className?: string }) {
  return (
    <svg aria-hidden="true" viewBox="-102 -36 142 54" className={className}>
      <rect x={-22} y={-1.5} width={10} height={3} fill="#94a3b8" />
      <rect x={-100} y={-11} width={78} height={22} rx={1} fill="#1e3a8a" stroke="#60a5fa" strokeOpacity={0.7} />
      <path d="M-87 -11V11M-74 -11V11M-61 -11V11M-48 -11V11M-35 -11V11M-100 0H-22" stroke="#3b82f6" strokeOpacity={0.7} strokeWidth={0.8} />
      <rect x={-14} y={-16} width={36} height={32} rx={2} fill="#d4a94e" />
      <rect x={-8} y={-10} width={24} height={20} rx={1} fill="#a87b34" opacity={0.8} />
      <rect x={22} y={-8} width={14} height={16} rx={1} fill="#e2e8f0" />
      <circle cx={36} r={5} fill="#0f172a" stroke="#cbd5e1" />
      <path d="M4 -16V-27" stroke="#e2e8f0" strokeWidth={1.5} />
      <circle cx={4} cy={-30} r={4} fill="#e2e8f0" />
    </svg>
  );
}

// --- 6. Reentrada ---

export function ReentryScene({ vb, artRef }: { vb: ViewBox; artRef: Ref<SVGGElement> }) {
  const id = `er${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`;
  const speed = useMemo(() => {
    const rand = seeded(41);
    const n = Math.round((vb.w / ART_W) * 8);
    return Array.from({ length: n }, () => [vb.x + rand() * vb.w, 80 + rand() * 360, 90 + rand() * 80] as const);
  }, [vb.x, vb.w]);
  return (
    <>
      <div className="absolute inset-0" style={{ background: 'linear-gradient(180deg, #07040c 0%, #140808 55%, #2a0d07 100%)' }} />
      <div className="absolute inset-0" style={{ background: 'radial-gradient(ellipse 110% 46% at 50% 74%, rgba(255,225,161,0.85) 0%, rgba(255,155,69,0.6) 16%, rgba(224,82,31,0.38) 34%, rgba(150,30,12,0.18) 52%, rgba(40,8,6,0) 72%)' }} />
      <svg aria-hidden="true" viewBox={viewBoxAttr(vb)} preserveAspectRatio="xMidYMid slice" style={svgFill}>
        <defs>
          <linearGradient id={`${id}-trail`} gradientUnits="userSpaceOnUse" x1="0" y1="520" x2="0" y2="90">
            <stop offset="0" stopColor="#fff3c4" stopOpacity={0.95} />
            <stop offset="0.25" stopColor="#ffb347" stopOpacity={0.75} />
            <stop offset="0.6" stopColor="#ff6a2b" stopOpacity={0.35} />
            <stop offset="1" stopColor="#ff6a2b" stopOpacity={0} />
          </linearGradient>
          <linearGradient id={`${id}-outer`} gradientUnits="userSpaceOnUse" x1="0" y1="540" x2="0" y2="60">
            <stop offset="0" stopColor="#ff9b45" stopOpacity={0.55} />
            <stop offset="0.5" stopColor="#e0521f" stopOpacity={0.2} />
            <stop offset="1" stopColor="#e0521f" stopOpacity={0} />
          </linearGradient>
          <linearGradient id={`${id}-speed`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#ffd8a8" stopOpacity={0} />
            <stop offset="1" stopColor="#ffd8a8" stopOpacity={0.7} />
          </linearGradient>
          <radialGradient id={`${id}-heat`}>
            <stop offset="0" stopColor="#ffffff" stopOpacity={1} />
            <stop offset="0.3" stopColor="#fff3c4" stopOpacity={0.85} />
            <stop offset="0.65" stopColor="#ff9b45" stopOpacity={0.35} />
            <stop offset="1" stopColor="#ff6a2b" stopOpacity={0} />
          </radialGradient>
        </defs>
        {speed.map(([x, y, h], i) => <rect key={i} x={x} y={y} width={1.3} height={h} fill={`url(#${id}-speed)`} />)}
        <g ref={artRef}>
          <path d="M140 520C150 400 170 200 195 60C220 200 240 400 250 520Z" fill={`url(#${id}-outer)`} />
          <path d="M160 516C170 410 182 240 195 110C208 240 220 410 230 516Z" fill={`url(#${id}-trail)`} />
          <circle cx={195} cy={546} r={70} fill={`url(#${id}-heat)`} />
          <path d="M140 538Q195 610 250 538" stroke="#fff3c4" strokeWidth={3} strokeLinecap="round" fill="none" opacity={0.85} />
          <path d="M124 528Q195 630 266 528" stroke="#ffb347" strokeWidth={2} strokeLinecap="round" fill="none" opacity={0.5} />
          <g transform="translate(195 548) scale(3.2)">
            <path d="M0 0C-2 -6 -9 -9 -9 -16A9 9 0 0 1 9 -16C9 -9 2 -6 0 0Z" fill="#fde68a" stroke="#7c2d12" strokeWidth={0.6} />
            <circle cy={-16} r={3.4} fill="#1c1917" />
          </g>
        </g>
      </svg>
      <BottomScrim color="20, 6, 4" />
    </>
  );
}

/** El paracaigudes de l'aterratge, amb l'agulla penjada. */
export function Parachute({ className = '', style }: { className?: string; style?: CSSProperties }) {
  return (
    <svg aria-hidden="true" viewBox="-40 -28 80 118" className={className} style={style}>
      <path d="M-38 0L0 50M-19 0L0 50M0 0L0 50M19 0L0 50M38 0L0 50" stroke="#cbd5e1" strokeOpacity={0.8} strokeWidth={1} fill="none" />
      <path d="M-38 0A38 26 0 0 1 38 0Q28.5 -5 19 0Q9.5 -5 0 0Q-9.5 -5 -19 0Q-28.5 -5 -38 0Z" fill="#f1f5f9" />
      <path d="M-19 0Q-9.5 -5 0 0L0 -26A38 26 0 0 0 -19 -22.5Z" fill="#fde68a" />
      <path d="M19 0Q28.5 -5 38 0A38 26 0 0 0 19 -22.5Z" fill="#fde68a" />
      <g transform="translate(0 86) scale(1.45)">
        <path d="M0 0C-2 -6 -9 -9 -9 -16A9 9 0 0 1 9 -16C9 -9 2 -6 0 0Z" fill="#fde68a" stroke="#0c0f17" strokeWidth={1} />
        <circle cy={-16} r={3.4} fill="#0c0f17" />
      </g>
    </svg>
  );
}
