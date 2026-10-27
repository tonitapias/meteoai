// src/components/welcome/EarthScenes.tsx
// Els dibuixos de les parades de l'ascensor cap avall (vegeu EarthElevator): el pou de Kola, el mantell, el nucli de
// ferro, el centre de la Terra i la tornada per dins. Com les de l'ascensor (ElevatorScenes), cada escena és un llenç
// de 390 × 844 que en pantalles més amples s'eixampla pels costats; només SVG i degradats, cap filtre ni
// desenfocament, i cap animació pròpia (el que es mou ho mou EarthElevator amb transformacions).
import { CSSProperties, ReactNode, Ref, useId, useMemo } from 'react';
import { ART_H, ART_W, type ViewBox } from '../../utils/welcome/skyElevator';

const viewBoxAttr = (vb: ViewBox) => `${vb.x.toFixed(1)} 0 ${vb.w.toFixed(1)} ${ART_H}`;
/** Posició vertical d'un punt del llenç, en % de la pantalla (per a les etiquetes HTML de sobre el dibuix). */
const artTop = (y: number) => `${((y / ART_H) * 100).toFixed(2)}%`;
const svgFill: CSSProperties = { position: 'absolute', inset: 0, width: '100%', height: '100%' };

/** Generador pseudoaleatori amb llavor: les pedres i les línies surten sempre al mateix lloc. */
function seeded(seed: number) {
  let s = seed | 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Una línia ondulada de costat a costat del tros visible, a l'alçada `y` (ones de 195 d'amplada, alternes). */
function wave(vb: ViewBox, y: number, amp: number): string {
  const period = 195;
  const start = Math.floor(vb.x / period) * period;
  let d = `M${start} ${y}`;
  for (let x = start, i = 0; x < vb.x + vb.w; x += period, i++) d += `q${period / 2} ${i % 2 ? -amp : amp} ${period} 0`;
  return d;
}
/** La mateixa ona, tancada cap avall fins al peu del llenç: una capa de roca. */
const band = (vb: ViewBox, y: number, amp: number) => `${wave(vb, y, amp)}V${ART_H}H${Math.floor(vb.x / 195) * 195}Z`;

/** Rètol petit sobre el dibuix (HTML, perquè el text no s'escali amb el llenç). */
function Pill({ children, style, className = '' }: { children: ReactNode; style?: CSSProperties; className?: string }) {
  return (
    <div className={`absolute flex items-center gap-1.5 whitespace-nowrap rounded-full px-3 py-1.5 text-[12px] font-medium ${className}`} style={style}>
      {children}
    </div>
  );
}

/** Enfosquit de sota perquè el text de la parada es llegeixi bé sobre qualsevol dibuix. */
function BottomScrim({ color }: { color: string }) {
  return (
    <div
      aria-hidden="true"
      className="absolute inset-x-0 bottom-0 h-[36%]"
      style={{ background: `linear-gradient(180deg, rgba(${color}, 0) 0%, rgba(${color}, 0.86) 50%, rgba(${color}, 0.97) 100%)` }}
    />
  );
}

/** El casc de miner (la pista de la benvinguda), centrat al punt (0, 0) i de 40 unitats d'ample. */
export function Helmet({ beam = false }: { beam?: boolean }) {
  return (
    <>
      {beam && <path d="M-3 4L-34 52H26Z" fill="#fef3c7" opacity={0.3} />}
      <path d="M-16 0A16 13 0 0 1 16 0Z" fill="#f59e0b" />
      <path d="M-2 -12.6V0M-9 -10V0M5 -12V0" stroke="#b45309" strokeOpacity={0.5} strokeWidth={1.2} />
      <rect x={-20} y={-1} width={40} height={5} rx={2.5} fill="#d97706" />
      <circle cx={-3} cy={-5} r={4.2} fill="#fef3c7" stroke="#b45309" strokeWidth={1} />
    </>
  );
}

// --- 1. El forat més profund (el pou de Kola, 12 km) ---

const STRATA: ReadonlyArray<readonly [number, string]> = [
  [0, '#241a14'], [88, '#33261d'], [160, '#2a1f18'], [212, '#3d2d22'], [296, '#2c2119'],
  [350, '#45332a'], [446, '#30231b'], [510, '#4a362a'], [598, '#2a1e17'],
];

export function KolaScene({ vb, bottomTag, fact, share }: { vb: ViewBox; bottomTag: string; fact: string; share: string }) {
  const id = `ek${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`;
  const pebbles = useMemo(() => {
    const rand = seeded(13);
    const n = Math.round((vb.w / ART_W) * 14);
    return Array.from({ length: n }, () => [vb.x + rand() * vb.w, 100 + rand() * 480, 3 + rand() * 5] as const);
  }, [vb.x, vb.w]);
  return (
    <>
      <div className="absolute inset-0 bg-[#120d0a]" />
      <svg aria-hidden="true" viewBox={viewBoxAttr(vb)} preserveAspectRatio="xMidYMid slice" style={svgFill}>
        <defs>
          <linearGradient id={`${id}-beam`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#fff7ed" stopOpacity={0.2} />
            <stop offset="0.7" stopColor="#fff7ed" stopOpacity={0.05} />
            <stop offset="1" stopColor="#fff7ed" stopOpacity={0} />
          </linearGradient>
        </defs>
        {STRATA.map(([y, fill], i) => <path key={y} d={band(vb, y, i % 2 ? -6 : 6)} fill={fill} />)}
        <path d={[88, 212, 350, 510].map((y, i) => wave(vb, y, i % 2 ? -6 : 6)).join('')} stroke="#5c4535" strokeOpacity={0.6} fill="none" />
        <g fill="#5e4a3a" opacity={0.6}>
          {pebbles.map(([x, y, r], i) => <ellipse key={i} cx={x} cy={y} rx={r} ry={r * 0.6} />)}
        </g>
        <path d="M150 0L4 844H386L240 0Z" fill={`url(#${id}-beam)`} />
        <path d="M268 0V520" stroke="#0a0705" strokeWidth={5} />
        <path d="M270.5 0V520" stroke="#6b5240" strokeOpacity={0.6} />
        <circle cx={268} cy={520} r={5} fill="#0a0705" stroke="#fdba74" strokeWidth={1.5} />
        <path d={`M${vb.x} 520H${vb.x + vb.w}`} stroke="#fdba74" strokeWidth={1.5} strokeDasharray="8 6" />
      </svg>
      <BottomScrim color="18, 13, 10" />
      <div className="absolute right-5 font-mono text-[11px] tracking-[0.14em] uppercase text-orange-300" style={{ top: artTop(494) }}>{bottomTag}</div>
      <Pill className="right-5 bg-[rgba(18,13,10,0.78)] border border-orange-300/30 text-stone-200" style={{ top: artTop(534) }}>{fact}</Pill>
      <Pill className="left-[86px] top-[132px] bg-[rgba(18,13,10,0.78)] text-stone-200">{share}</Pill>
    </>
  );
}

// --- 2. El mantell (100 km) ---

const Arrow = ({ d }: { d: string }) => <path d={d} stroke="#fdba74" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" fill="none" />;

export function MantleScene({ vb, plates, karman, plume }: { vb: ViewBox; plates: string; karman: string; plume: string }) {
  const id = `em${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`;
  const crust = wave(vb, 118, 4);
  return (
    <>
      <div className="absolute inset-0" style={{ background: 'linear-gradient(180deg, #2a0c05 0%, #4a1407 45%, #5c1a08 70%, #2a0c05 100%)' }} />
      <svg aria-hidden="true" viewBox={viewBoxAttr(vb)} preserveAspectRatio="xMidYMid slice" style={svgFill}>
        <defs>
          <radialGradient id={`${id}-plume`} gradientUnits="userSpaceOnUse" cx={195} cy={560} r={400} gradientTransform="translate(195 560) scale(0.32 1) translate(-195 -560)">
            <stop offset="0" stopColor="#fb923c" stopOpacity={0.7} />
            <stop offset="0.45" stopColor="#ea580c" stopOpacity={0.32} />
            <stop offset="1" stopColor="#ea580c" stopOpacity={0} />
          </radialGradient>
        </defs>
        <rect x={vb.x} y={0} width={vb.w} height={ART_H} fill={`url(#${id}-plume)`} />
        <g stroke="#fb923c" strokeOpacity={0.22} strokeWidth={1.4} strokeLinecap="round" fill="none">
          <path d="M20 250q30 20 20 60t24 70M360 230q-24 30-10 70t-20 80M70 560q24-20 50 4t50-6M250 610q26 14 54-4t40 10M300 470q14-30 40-24" />
        </g>
        <g stroke="#fdba74" strokeOpacity={0.5} strokeWidth={2} strokeDasharray="10 8" fill="none">
          <ellipse cx={118} cy={400} rx={78} ry={200} />
          <ellipse cx={272} cy={400} rx={78} ry={200} />
        </g>
        <Arrow d="M128 193L116 200L128 207M108 593L120 600L108 607M189 410L196 398L203 410M33 390L40 402L47 390M262 193L274 200L262 207M282 593L270 600L282 607M343 390L350 402L357 390" />
        <path d={`${crust}V0H${Math.floor(vb.x / 195) * 195}Z`} fill="#1f1714" />
        <path d="M182 117L198 152L214 117Z" fill="#1f1714" />
        <path d={crust} stroke="#78350f" strokeWidth={1.5} fill="none" />
        <path d="M198 152V128" stroke="#fb923c" strokeOpacity={0.8} strokeWidth={2} />
        <path d={`M${vb.x} 300H${vb.x + vb.w}`} stroke="#fdba74" strokeWidth={1.5} strokeDasharray="8 6" />
      </svg>
      <BottomScrim color="36, 10, 4" />
      <div className="absolute left-1/2 -translate-x-1/2 flex items-center gap-1.5 whitespace-nowrap text-[12px] font-medium text-orange-200" style={{ top: artTop(160) }}>
        <svg aria-hidden="true" viewBox="0 0 18 12" className="w-[18px] h-3" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><path d="M17 6H2M6 2 2 6l4 4" /></svg>
        {plates}
        <svg aria-hidden="true" viewBox="0 0 18 12" className="w-[18px] h-3" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><path d="M1 6h15M12 2l4 4-4 4" /></svg>
      </div>
      <div className="absolute right-5 font-mono text-[11px] tracking-[0.14em] uppercase text-orange-300" style={{ top: artTop(276) }}>{karman}</div>
      <Pill className="left-1/2 -translate-x-1/2 bg-[rgba(42,12,5,0.8)] border border-orange-300/30 text-orange-50" style={{ top: artTop(460) }}>{plume}</Pill>
    </>
  );
}

// --- 3. El nucli extern (2.890 km) ---

export function CoreScene({ vb, edge, field, iron }: { vb: ViewBox; edge: string; field: string; iron: string }) {
  const flows: ReadonlyArray<readonly [number, number, string, number, number]> = [
    [250, -20, '#fed7aa', 0.35, 10], [330, 17, '#fdba74', 0.32, 16], [420, -18, '#fed7aa', 0.3, 12], [500, 15, '#fde68a', 0.28, 20], [590, -17, '#fdba74', 0.25, 12],
  ];
  return (
    <>
      <div className="absolute inset-0" style={{ background: 'linear-gradient(180deg, #4a1407 0%, #7c2d12 18%, #c2410c 42%, #ea580c 62%, #9a3412 86%, #431407 100%)' }} />
      <svg aria-hidden="true" viewBox={viewBoxAttr(vb)} preserveAspectRatio="xMidYMid slice" style={svgFill}>
        <path d={`${wave(vb, 140, 5)}V0H${Math.floor(vb.x / 195) * 195}Z`} fill="#3b1206" />
        <path d={wave(vb, 140, 5)} stroke="#fdba74" strokeWidth={1.5} strokeDasharray="8 6" fill="none" />
        <g strokeLinecap="round" fill="none">
          {flows.map(([y, amp, color, opacity, width]) => <path key={y} d={wave(vb, y, amp)} stroke={color} strokeOpacity={opacity} strokeWidth={width} />)}
          <path d="M60 282q24-18 48 0q24 18 0 34q-24 14-40-4M268 452q26-16 50 4q20 18-4 32q-24 12-38-8" stroke="#fff7ed" strokeOpacity={0.35} strokeWidth={2.5} />
        </g>
        <g stroke="#bae6fd" strokeOpacity={0.75} strokeWidth={1.4} strokeDasharray="3 5" fill="none">
          <path d="M195 216C80 216 40 300 40 380C40 460 80 544 195 544M195 216C310 216 350 300 350 380C350 460 310 544 195 544" />
          <path d="M195 260C120 260 96 320 96 380C96 440 120 500 195 500M195 260C270 260 294 320 294 380C294 440 270 500 195 500" />
        </g>
        <path d="M195 196V564" stroke="#bae6fd" strokeOpacity={0.85} strokeWidth={1.6} />
        <path d="M188 208L195 196L202 208" stroke="#bae6fd" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" fill="none" />
        <g transform="translate(195 380)">
          <circle r={17} fill="#0c1a2b" stroke="#bae6fd" strokeWidth={1.5} />
          <path d="M0 -12L4 0H-4Z" fill="#f87171" />
          <path d="M0 12L4 0H-4Z" fill="#e2e8f0" />
        </g>
      </svg>
      <BottomScrim color="46, 14, 5" />
      <div className="absolute right-5 font-mono text-[11px] tracking-[0.14em] uppercase text-orange-200" style={{ top: artTop(112) }}>{edge}</div>
      <Pill className="right-5 bg-[rgba(59,18,6,0.82)] border border-sky-200/40 text-sky-50" style={{ top: artTop(228) }}>{field}</Pill>
      <Pill className="left-1/2 -translate-x-[70%] bg-[rgba(59,18,6,0.82)] border border-orange-300/35 text-orange-50" style={{ top: artTop(560) }}>{iron}</Pill>
    </>
  );
}

// --- 4. El centre de la Terra (6.371 km) ---

export function CentreScene({ vb, solid, weightless, halfway, helmetRef }: { vb: ViewBox; solid: string; weightless: string; halfway: string; helmetRef: Ref<SVGGElement> }) {
  return (
    <>
      <div className="absolute inset-0" style={{ background: 'radial-gradient(circle at 50% 45%, #fffbeb 0%, #fef3c7 6%, #fde68a 13%, #fbbf24 20%, #f97316 30%, #9a3412 41%, #431407 58%)' }} />
      <div className="absolute inset-x-0 top-0 h-[18%]" style={{ background: 'linear-gradient(180deg, rgba(67,20,7,0.75) 0%, rgba(67,20,7,0) 100%)' }} />
      <svg aria-hidden="true" viewBox={viewBoxAttr(vb)} preserveAspectRatio="xMidYMid slice" style={svgFill}>
        <g stroke="#ffffff" strokeOpacity={0.5} strokeWidth={1.2} fill="none">
          <path d="M195 250L307 315V445L195 510L83 445V315Z" />
          <path d="M195 250V380M307 315L195 380M307 445L195 380M195 510V380M83 445L195 380M83 315L195 380" />
        </g>
        <path d="M195 170L380 277V483L195 590L10 483V277Z" stroke="#ffffff" strokeOpacity={0.22} fill="none" />
        <g stroke="#7c2d12" strokeOpacity={0.7} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" fill="none">
          <path d="M195 300V322M195 438V460M115 380H137M253 380H275" />
          <path d="M190 317L195 322L200 317M190 443L195 438L200 443M132 375L137 380L132 385M258 375L253 380L258 385" />
        </g>
        <circle cx={195} cy={380} r={4} fill="#7c2d12" />
        <ellipse cx={262} cy={320} rx={38} ry={12} transform="rotate(-28 262 320)" stroke="#7c2d12" strokeOpacity={0.55} strokeWidth={1.2} strokeDasharray="3 5" fill="none" />
        <g ref={helmetRef}>
          <g transform="translate(262 318) rotate(-28)"><Helmet /></g>
        </g>
      </svg>
      <BottomScrim color="40, 11, 3" />
      <Pill className="left-[86px] bg-[rgba(67,20,7,0.86)] text-orange-50" style={{ top: artTop(190) }}>{solid}</Pill>
      <Pill className="left-[62%] font-semibold bg-[rgba(67,20,7,0.86)] text-amber-200" style={{ top: artTop(262) }}>{weightless}</Pill>
      <Pill className="left-1/2 -translate-x-1/2 font-semibold bg-[rgba(67,20,7,0.86)] border border-orange-300/50 text-orange-300" style={{ top: artTop(600) }}>{halfway}</Pill>
    </>
  );
}

// --- 5. La tornada per dins ---

export function ReturnScene({ vb, streaksRef }: { vb: ViewBox; streaksRef: Ref<SVGGElement> }) {
  const id = `ed${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`;
  const streaks = useMemo(() => {
    const rand = seeded(53);
    const n = Math.round((vb.w / ART_W) * 14);
    return Array.from({ length: n }, () => [vb.x + rand() * vb.w, rand() * 700, 80 + rand() * 120] as const);
  }, [vb.x, vb.w]);
  return (
    <>
      <div className="absolute inset-0" style={{ background: 'linear-gradient(180deg, #1c0a05 0%, #7c2d12 30%, #fbbf24 50%, #7c2d12 70%, #1c0a05 100%)' }} />
      <svg aria-hidden="true" viewBox={viewBoxAttr(vb)} preserveAspectRatio="xMidYMid slice" style={svgFill}>
        <defs>
          <linearGradient id={`${id}-s`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#fff7ed" stopOpacity={0} />
            <stop offset="1" stopColor="#fff7ed" stopOpacity={0.7} />
          </linearGradient>
        </defs>
        <g ref={streaksRef}>
          {streaks.map(([x, y, h], i) => <rect key={i} x={x} y={y} width={1.4} height={h} fill={`url(#${id}-s)`} />)}
          {streaks.map(([x, y, h], i) => <rect key={`b${i}`} x={x} y={y + 844} width={1.4} height={h} fill={`url(#${id}-s)`} />)}
        </g>
        <g transform="translate(195 380) scale(2.2)"><Helmet beam /></g>
      </svg>
      <BottomScrim color="28, 10, 5" />
    </>
  );
}
