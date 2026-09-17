// src/components/WindModal.tsx
// Modal de detall del vent — dades pures (velocitat, direcció, ratxes) per complementar
// WindMap.tsx (l'embed de Windy, ja molt visual): brúixola gran amb lectura exacta en graus,
// classificació Beaufort oficial (Meteocat/OMM), evolució de 48h amb scrubbing (velocitat +
// ratxes superposades) i una franja de fletxes de direcció per veure com gira el vent en el
// temps. Reutilitza hourly.wind_speed_10m/wind_direction_10m/wind_gusts_10m, ja demanats a
// Open-Meteo — cap crida de xarxa nova.
import { useState, useRef, useMemo, memo } from 'react';
import { X, Wind, Navigation2, Zap, CloudOff } from 'lucide-react';
import { ExtendedWeatherData } from '../types/weatherLogicTypes';
import { Language } from '../translations';
import { MATRIX_BG } from './widgets/widgetStyles';
import { StatCard } from './AstroStatCard';
import { useAstroModalShell } from '../hooks/useAstroModalShell';
import { WEATHER_THRESHOLDS } from '../constants/weatherConfig';
import { getWindDirectionText } from './widgets/widgetHelpers';

const { WIND } = WEATHER_THRESHOLDS;

interface WindModalProps {
  weatherData: ExtendedWeatherData;
  onClose: () => void;
  lang?: Language;
}

const WINDOW_HOURS = 48;
const DIR_SAMPLES = 12;

const T: Record<Language, Record<string, string>> = {
  ca: {
    title: 'VENT', subtitle: 'Velocitat, Direcció i Ratxes', noData: 'SENSE DADES SUFICIENTS',
    gusts: 'Ratxes', evolution: 'Evolució', scrubHint: 'Toca o arrossega per explorar',
    strongGustWindow: 'Pròxima Ratxa Forta', activeNow: 'Activa ara mateix',
    noWindow: 'Sense ratxes fortes previstes en 48h', in_: "D'aquí a", now: 'ARA', hoursShort: 'h',
    maxGust: 'Ratxa Màx. 48h', avgSpeed: 'Vel. Mitjana 48h', dominantDir: 'Direcció Dominant',
    at_: 'a les', legendSpeed: 'Velocitat', legendGusts: 'Ratxes', kmh: 'km/h',
  },
  es: {
    title: 'VIENTO', subtitle: 'Velocidad, Dirección y Rachas', noData: 'DATOS INSUFICIENTES',
    gusts: 'Rachas', evolution: 'Evolución', scrubHint: 'Toca o arrastra para explorar',
    strongGustWindow: 'Próxima Racha Fuerte', activeNow: 'Activa ahora mismo',
    noWindow: 'Sin rachas fuertes previstas en 48h', in_: 'Dentro de', now: 'AHORA', hoursShort: 'h',
    maxGust: 'Racha Máx. 48h', avgSpeed: 'Vel. Media 48h', dominantDir: 'Dirección Dominante',
    at_: 'a las', legendSpeed: 'Velocidad', legendGusts: 'Rachas', kmh: 'km/h',
  },
  en: {
    title: 'WIND', subtitle: 'Speed, Direction and Gusts', noData: 'INSUFFICIENT DATA',
    gusts: 'Gusts', evolution: 'Evolution', scrubHint: 'Tap or drag to explore',
    strongGustWindow: 'Next Strong Gust', activeNow: 'Active right now',
    noWindow: 'No strong gusts expected in 48h', in_: 'In', now: 'NOW', hoursShort: 'h',
    maxGust: 'Max Gust 48h', avgSpeed: 'Avg Speed 48h', dominantDir: 'Dominant Direction',
    at_: 'at', legendSpeed: 'Speed', legendGusts: 'Gusts', kmh: 'km/h',
  },
  fr: {
    title: 'VENT', subtitle: 'Vitesse, Direction et Rafales', noData: 'DONNÉES INSUFFISANTES',
    gusts: 'Rafales', evolution: 'Évolution', scrubHint: 'Touchez ou glissez pour explorer',
    strongGustWindow: 'Prochaine Rafale Forte', activeNow: 'Active en ce moment',
    noWindow: 'Aucune rafale forte prévue sous 48h', in_: 'Dans', now: 'MAINTENANT', hoursShort: 'h',
    maxGust: 'Rafale Max. 48h', avgSpeed: 'Vit. Moyenne 48h', dominantDir: 'Direction Dominante',
    at_: 'à', legendSpeed: 'Vitesse', legendGusts: 'Rafales', kmh: 'km/h',
  },
};

// Escala Beaufort oficial (OMM), km/h verificats contra Meteocat (Servei Meteorològic de
// Catalunya) — https://www.meteo.cat/wpweb/divulgacio/la-prediccio-meteorologica/escales-de-vent-i-mar/escala-beaufort/
// Noms per idioma verificats contra Meteocat (ca), Viquipèdia es/en/fr (es/en/fr).
const BEAUFORT: { max: number; label: Record<Language, string> }[] = [
  { max: 2, label: { ca: 'Calma', es: 'Calma', en: 'Calm', fr: 'Calme' } },
  { max: 6, label: { ca: 'Ventolina', es: 'Ventolina', en: 'Light air', fr: 'Très légère brise' } },
  { max: 11, label: { ca: 'Vent fluixet', es: 'Flojito', en: 'Light breeze', fr: 'Légère brise' } },
  { max: 19, label: { ca: 'Vent fluix', es: 'Flojo', en: 'Gentle breeze', fr: 'Petite brise' } },
  { max: 29, label: { ca: 'Vent moderat', es: 'Bonancible', en: 'Moderate breeze', fr: 'Jolie brise' } },
  { max: 39, label: { ca: 'Vent fresquet', es: 'Fresquito', en: 'Fresh breeze', fr: 'Bonne brise' } },
  { max: 50, label: { ca: 'Vent fresc', es: 'Fresco', en: 'Strong breeze', fr: 'Vent frais' } },
  { max: 61, label: { ca: 'Vent fort', es: 'Frescachón', en: 'Near gale', fr: 'Grand frais' } },
  { max: 74, label: { ca: 'Temporal', es: 'Temporal', en: 'Gale', fr: 'Coup de vent' } },
  { max: 87, label: { ca: 'Temporal fort', es: 'Temporal fuerte', en: 'Strong gale', fr: 'Fort coup de vent' } },
  { max: 101, label: { ca: 'Temporal molt fort', es: 'Temporal duro', en: 'Storm', fr: 'Tempête' } },
  { max: 117, label: { ca: 'Temporal violent', es: 'Temporal muy duro', en: 'Violent storm', fr: 'Violente tempête' } },
  { max: Infinity, label: { ca: 'Huracà', es: 'Temporal huracanado', en: 'Hurricane', fr: "Vent d'ouragan" } },
];

function getBeaufort(speedKmh: number, lang: Language): { force: number; label: string } {
  const force = BEAUFORT.findIndex(b => speedKmh <= b.max);
  const safeForce = force === -1 ? 12 : force;
  return { force: safeForce, label: BEAUFORT[safeForce].label[lang] };
}

interface Severity { color: string; stroke: string; borderColor: string; bgGlow: string; }

// Color d'accent segons la ratxa actual — mateixos llindars WEATHER_THRESHOLDS.WIND que ja
// classifica RegionalModelModal.tsx (STRONG/EXTREME), per no inventar una segona escala de
// colors dins l'app.
function getWindSeverity(gustKmh: number | null): Severity {
  if (gustKmh === null) return { color: 'text-slate-500', stroke: '#64748b', borderColor: 'border-slate-500/20', bgGlow: 'from-slate-950/20 to-black/90' };
  if (gustKmh >= WIND.EXTREME) return { color: 'text-rose-400', stroke: '#fb7185', borderColor: 'border-rose-500/30', bgGlow: 'from-rose-950/30 to-black/90' };
  if (gustKmh >= WIND.STRONG) return { color: 'text-amber-400', stroke: '#fbbf24', borderColor: 'border-amber-400/30', bgGlow: 'from-amber-950/25 to-black/90' };
  return { color: 'text-cyan-400', stroke: '#22d3ee', borderColor: 'border-cyan-500/20', bgGlow: 'from-cyan-950/20 to-black/90' };
}

const getSafe = (arr: (number | null)[] | undefined, idx: number): number | null => {
  const v = Array.isArray(arr) ? arr[idx] : undefined;
  return typeof v === 'number' && !isNaN(v) ? v : null;
};

const CHART_W = 400, CHART_H = 160, TOP_Y = 12, BOTTOM_Y = 140;

export default function WindModal({ weatherData, onClose, lang = 'ca' }: WindModalProps) {
  const safeLang: Language = T[lang] ? lang : 'ca';
  const t = T[safeLang];

  const { handleClose } = useAstroModalShell(onClose);

  const hourly = weatherData.hourly;
  const current = weatherData.current;

  const currentHourIndex = useMemo(() => {
    if (!hourly || !current || !Array.isArray(hourly.time) || typeof current.time !== 'string') return -1;
    const hourPrefix = current.time.substring(0, 13);
    return hourly.time.findIndex(ts => typeof ts === 'string' && ts.startsWith(hourPrefix));
  }, [hourly, current]);

  const hasData = currentHourIndex !== -1 && Array.isArray(hourly?.wind_speed_10m);

  const windowEntries = useMemo(() => {
    if (!hasData || !hourly) return [];
    const total = Array.isArray(hourly.time) ? hourly.time.length : 0;
    const n = Math.min(WINDOW_HOURS, total - currentHourIndex);
    return Array.from({ length: Math.max(0, n) }, (_, i) => {
      const idx = currentHourIndex + i;
      return {
        idx,
        timeStr: String(hourly.time?.[idx] ?? ''),
        speed: getSafe(hourly.wind_speed_10m, idx),
        gusts: getSafe(hourly.wind_gusts_10m, idx),
        dir: getSafe(hourly.wind_direction_10m, idx),
      };
    });
  }, [hasData, hourly, currentHourIndex]);

  const N = windowEntries.length;

  // Prioritzem el bloc current (mateixa font que CompassGauge al dashboard) per al valor
  // "ara" — hourly[hora actual] pot diferir lleugerament, vegeu la lliçó de Pressió/Confort.
  const currentSpeed = typeof current?.wind_speed_10m === 'number' ? current.wind_speed_10m : (N > 0 ? windowEntries[0].speed : null);
  const currentGusts = typeof current?.wind_gusts_10m === 'number' ? current.wind_gusts_10m : (N > 0 ? windowEntries[0].gusts : null);
  const currentDir = typeof current?.wind_direction_10m === 'number' ? current.wind_direction_10m : (N > 0 ? windowEntries[0].dir : null);

  const severity = getWindSeverity(currentGusts ?? currentSpeed);
  const beaufort = currentSpeed !== null ? getBeaufort(currentSpeed, safeLang) : null;
  const directionText = currentDir !== null ? getWindDirectionText(currentDir) : null;

  const maxGustWindow = useMemo(() => {
    let best: { idx: number; value: number } | null = null;
    for (let i = 0; i < N; i++) {
      const v = windowEntries[i].gusts;
      if (v === null) continue;
      if (!best || v > best.value) best = { idx: i, value: v };
    }
    return best;
  }, [windowEntries, N]);

  const avgSpeed = useMemo(() => {
    const vals = windowEntries.map(e => e.speed).filter((v): v is number => v !== null);
    return vals.length > 0 ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
  }, [windowEntries]);

  // --- Direcció dominant de la finestra: moda dels 8 punts cardinals ---
  const dominantDirection = useMemo(() => {
    const counts: Record<string, number> = {};
    windowEntries.forEach(e => {
      if (e.dir === null) return;
      const key = getWindDirectionText(e.dir);
      counts[key] = (counts[key] ?? 0) + 1;
    });
    const entries = Object.entries(counts);
    if (entries.length === 0) return null;
    return entries.reduce((a, b) => (b[1] > a[1] ? b : a))[0];
  }, [windowEntries]);

  // --- Pròxima ratxa forta: primer tram contigu amb ratxa >= WIND.STRONG ---
  const nextGustWindow = useMemo(() => {
    const startIdx = windowEntries.findIndex(e => e.gusts !== null && e.gusts >= WIND.STRONG);
    if (startIdx === -1) return null;
    const remaining = windowEntries.slice(startIdx);
    const runLength = remaining.findIndex(e => e.gusts === null || e.gusts < WIND.STRONG);
    const segment = runLength === -1 ? remaining : remaining.slice(0, runLength);
    const peak = Math.max(...segment.map(e => e.gusts as number));
    const peakIdx = startIdx + segment.findIndex(e => e.gusts === peak);
    return { startIdx, peak, peakIdx };
  }, [windowEntries]);

  // --- Franja de direcció: mostres uniformement espaiades sobre la finestra ---
  const dirSamples = useMemo(() => {
    if (N === 0) return [];
    const step = Math.max(1, Math.floor(N / DIR_SAMPLES));
    const samples: { idx: number; dir: number | null }[] = [];
    for (let i = 0; i < N; i += step) samples.push({ idx: i, dir: windowEntries[i].dir });
    return samples;
  }, [windowEntries, N]);

  // --- Scrub horitzontal (mateix patró RAF que la resta de modals experts) ---
  const [scrubIndex, setScrubIndex] = useState<number | null>(null);
  const scrubRafRef = useRef<number | null>(null);
  const latestPointerRef = useRef<{ clientX: number; rect: DOMRect } | null>(null);

  const handlePointerMove = (e: React.PointerEvent<SVGSVGElement>) => {
    if (N === 0) return;
    latestPointerRef.current = { clientX: e.clientX, rect: e.currentTarget.getBoundingClientRect() };
    if (scrubRafRef.current !== null) return;
    scrubRafRef.current = requestAnimationFrame(() => {
      scrubRafRef.current = null;
      const latest = latestPointerRef.current;
      if (!latest) return;
      const fraction = Math.max(0, Math.min(1, (latest.clientX - latest.rect.left) / latest.rect.width));
      setScrubIndex(Math.round(fraction * (N - 1)));
    });
  };
  const clearScrub = () => {
    if (scrubRafRef.current !== null) { cancelAnimationFrame(scrubRafRef.current); scrubRafRef.current = null; }
    setScrubIndex(null);
  };
  const handleKeyDown = (e: React.KeyboardEvent<SVGSVGElement>) => {
    if (N === 0) return;
    const current0 = scrubIndex ?? 0;
    let next: number | null = null;
    switch (e.key) {
      case 'ArrowRight': case 'ArrowUp': next = Math.min(N - 1, current0 + 1); break;
      case 'ArrowLeft': case 'ArrowDown': next = Math.max(0, current0 - 1); break;
      case 'PageUp': next = Math.min(N - 1, current0 + 6); break;
      case 'PageDown': next = Math.max(0, current0 - 6); break;
      case 'Home': next = 0; break;
      case 'End': next = N - 1; break;
      default: return;
    }
    e.preventDefault();
    setScrubIndex(next);
  };

  const activeIndex = scrubIndex ?? 0;
  const activeEntry = N > 0 ? windowEntries[activeIndex] : null;
  const isScrubbing = scrubIndex !== null && scrubIndex !== 0;
  const displaySpeed = isScrubbing ? activeEntry?.speed ?? null : currentSpeed;
  const displayGusts = isScrubbing ? activeEntry?.gusts ?? null : currentGusts;

  // --- Geometria del gràfic: zero natural, sostre = màxim real de la finestra ---
  const yMax = useMemo(() => {
    const vals = [...windowEntries.map(e => e.speed), ...windowEntries.map(e => e.gusts)].filter((v): v is number => v !== null);
    return vals.length > 0 ? Math.max(20, Math.max(...vals) * 1.15) : 60;
  }, [windowEntries]);

  const valToY = (v: number) => BOTTOM_Y - (Math.max(0, Math.min(yMax, v)) / yMax) * (BOTTOM_Y - TOP_Y);
  const idxToX = (i: number) => N > 1 ? (i / (N - 1)) * CHART_W : 0;

  const speedArea = useMemo(() => {
    if (N === 0) return '';
    const pts = windowEntries.map((e, i) => `${idxToX(i)},${valToY(e.speed ?? 0)}`);
    return `M 0,${BOTTOM_Y} L ${pts.join(' L ')} L ${CHART_W},${BOTTOM_Y} Z`;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [windowEntries, yMax, N]);

  const speedLine = useMemo(() => {
    if (N === 0) return '';
    return windowEntries
      .map((e, i) => (e.speed !== null ? `${i === 0 ? 'M' : 'L'} ${idxToX(i)} ${valToY(e.speed)}` : null))
      .filter((s): s is string => s !== null)
      .join(' ');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [windowEntries, yMax, N]);

  const gustLine = useMemo(() => {
    if (N === 0) return '';
    return windowEntries
      .map((e, i) => (e.gusts !== null ? `${i === 0 ? 'M' : 'L'} ${idxToX(i)} ${valToY(e.gusts)}` : null))
      .filter((s): s is string => s !== null)
      .join(' ');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [windowEntries, yMax, N]);

  const dayMarkers = useMemo(() => {
    const marks: { i: number; label: string }[] = [];
    let prevDay = '';
    windowEntries.forEach((e, i) => {
      const day = e.timeStr.slice(8, 10);
      if (day && day !== prevDay && i > 0) marks.push({ i, label: `${e.timeStr.slice(8, 10)}/${e.timeStr.slice(5, 7)}` });
      prevDay = day;
    });
    return marks;
  }, [windowEntries]);

  const bgGradient = severity.bgGlow;

  return (
    <div role="dialog" aria-modal="true" aria-labelledby="wind-modal-title" className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-0 sm:p-4 md:p-6 landscape:p-0 landscape:sm:p-4 bg-black/95 backdrop-blur-3xl backdrop-saturate-150 animate-in fade-in duration-200">
      <style>{`
        .wind-scrollbar { -webkit-overflow-scrolling: touch; }
        .wind-scrollbar::-webkit-scrollbar { width: 5px; }
        .wind-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .wind-scrollbar::-webkit-scrollbar-thumb { background: rgba(34,211,238,0.2); border-radius: 8px; }
        .wind-scrollbar::-webkit-scrollbar-thumb:hover { background: rgba(34,211,238,0.4); }
      `}</style>

      <div className={`w-full h-[96dvh] sm:h-auto sm:max-h-[90dvh] landscape:h-[100dvh] landscape:sm:h-auto max-w-sm md:max-w-3xl lg:max-w-5xl flex flex-col min-h-0 bg-gradient-to-b ${bgGradient} rounded-t-[24px] sm:rounded-[32px] border-t sm:border ${severity.borderColor} shadow-[0_0_100px_rgba(0,0,0,0.9)] overflow-hidden relative animate-in slide-in-from-bottom-8 sm:zoom-in-95 duration-300`}>
        <div className={MATRIX_BG}></div>
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[130%] h-56 bg-gradient-to-b from-cyan-500/10 via-slate-900/5 to-transparent blur-[80px] pointer-events-none z-0"></div>

        {/* Capçalera */}
        <div className="flex justify-between items-center shrink-0 relative z-20 p-4 md:p-6 border-b border-white/[0.04]">
          <div className="flex items-center gap-3">
            <div className={`relative flex items-center justify-center w-10 h-10 rounded-full border bg-black/40 ${severity.borderColor} ${severity.color}`}>
              <Wind className="w-5 h-5" />
            </div>
            <div className="flex flex-col">
              <h2 id="wind-modal-title" className="text-lg md:text-2xl font-black text-white tracking-tighter drop-shadow-md leading-none">{t.title}</h2>
              <span className="text-[10px] md:text-xs text-slate-400 font-bold tracking-widest uppercase mt-0.5">{t.subtitle}</span>
            </div>
          </div>
          <button onClick={handleClose} className="p-2.5 bg-black/40 border border-white/5 rounded-full text-slate-400 hover:bg-white/10 hover:text-white active:scale-90 transition-all duration-200 group relative backdrop-blur-md">
            <X className="w-5 h-5 group-hover:rotate-90 transition-transform duration-300" />
            <span className="absolute -bottom-8 left-1/2 -translate-x-1/2 text-[10px] font-mono font-bold text-slate-500 opacity-0 group-hover:opacity-100 hidden md:block transition-opacity">ESC</span>
          </button>
        </div>

        {!hasData ? (
          <div className="flex-1 flex flex-col items-center justify-center text-slate-500 font-bold uppercase tracking-widest text-sm p-8 text-center gap-3">
            <CloudOff className="w-10 h-10 text-slate-600" />
            {t.noData}
          </div>
        ) : (
          <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain wind-scrollbar relative z-10 p-4 md:p-6 space-y-6">

            {/* HEROI: brúixola gran + Beaufort */}
            <div className="relative rounded-2xl border border-white/5 bg-black/30 backdrop-blur-md p-5 flex flex-col items-center gap-3">
              <div className="relative w-60 h-60 sm:w-64 sm:h-64 flex items-center justify-center">
                <svg width="100%" height="100%" viewBox="0 0 200 200" className="absolute inset-0 drop-shadow-xl">
                  <circle cx="100" cy="100" r="82" fill="none" stroke="#131722" strokeWidth="14" />
                  {[...Array(36)].map((_, i) => {
                    const angle = i * 10;
                    const isCardinal = i % 9 === 0;
                    const innerR = isCardinal ? 68 : 73;
                    const outerR = 90;
                    const x1 = 100 + innerR * Math.cos((angle - 90) * Math.PI / 180);
                    const y1 = 100 + innerR * Math.sin((angle - 90) * Math.PI / 180);
                    const x2 = 100 + outerR * Math.cos((angle - 90) * Math.PI / 180);
                    const y2 = 100 + outerR * Math.sin((angle - 90) * Math.PI / 180);
                    return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke={isCardinal ? '#475569' : '#1e293b'} strokeWidth={isCardinal ? '2' : '1'} opacity="0.7" />;
                  })}
                  {currentGusts !== null && currentSpeed !== null && currentGusts > currentSpeed + 5 && (
                    <path d={`M 100 18 A 82 82 0 ${Math.min(359.9, (currentGusts / 120) * 360) > 180 ? 1 : 0} 1 ${100 + 82 * Math.sin(Math.min(359.9, (currentGusts / 120) * 360) * Math.PI / 180)} ${100 - 82 * Math.cos(Math.min(359.9, (currentGusts / 120) * 360) * Math.PI / 180)}`} fill="none" stroke={severity.stroke} strokeWidth="14" strokeLinecap="round" opacity="0.25" />
                  )}
                  {currentSpeed !== null && currentSpeed > 0 && (
                    <path d={`M 100 18 A 82 82 0 ${Math.min(359.9, (currentSpeed / 120) * 360) > 180 ? 1 : 0} 1 ${100 + 82 * Math.sin(Math.min(359.9, (currentSpeed / 120) * 360) * Math.PI / 180)} ${100 - 82 * Math.cos(Math.min(359.9, (currentSpeed / 120) * 360) * Math.PI / 180)}`} fill="none" stroke={severity.stroke} strokeWidth="14" strokeLinecap="round" className="drop-shadow-[0_0_8px_rgba(34,211,238,0.4)]" />
                  )}
                </svg>

                {currentDir !== null && (
                  <div className="absolute w-full h-full flex items-start justify-center pointer-events-none z-20" style={{ transform: `rotate(${currentDir}deg)` }}>
                    <div className="mt-[-6px] rounded-full p-1.5 border shadow-[0_4px_12px_rgba(0,0,0,0.8)] bg-[#0c0e15] border-slate-700">
                      <Navigation2 className={`w-5 h-5 ${severity.color} drop-shadow-[0_0_8px_currentColor]`} style={{ transform: 'rotate(180deg)', fill: 'currentColor', fillOpacity: 0.2 }} />
                    </div>
                  </div>
                )}

                <span className="absolute top-6 left-1/2 -translate-x-1/2 text-[11px] font-black text-slate-400 bg-[#0c0e15] px-1 rounded">N</span>
                <span className="absolute bottom-6 left-1/2 -translate-x-1/2 text-[11px] font-black text-slate-400 bg-[#0c0e15] px-1 rounded">S</span>
                <span className="absolute left-6 top-1/2 -translate-y-1/2 text-[11px] font-black text-slate-400 bg-[#0c0e15] py-1 rounded">W</span>
                <span className="absolute right-6 top-1/2 -translate-y-1/2 text-[11px] font-black text-slate-400 bg-[#0c0e15] py-1 rounded">E</span>

                <div className="absolute flex flex-col items-center justify-center z-30 w-36 h-36 rounded-full">
                  <span className="text-[10px] font-mono font-bold text-slate-400 mb-1">
                    {currentDir !== null ? `${Math.round(currentDir)}° ${directionText}` : '--'}
                  </span>
                  <span className={`text-5xl font-mono font-black tabular-nums leading-none drop-shadow-2xl ${severity.color}`}>
                    {currentSpeed !== null ? Math.round(currentSpeed) : '--'}
                  </span>
                  <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mt-1">{t.kmh}</span>
                  {currentGusts !== null && currentSpeed !== null && currentGusts > currentSpeed + 5 && (
                    <div className={`mt-2.5 flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-black/50 border border-white/10 ${severity.color}`}>
                      <Zap className="w-3 h-3 fill-current" />
                      <span className="text-[9px] font-black uppercase tracking-widest">{t.gusts}</span>
                      <span className="text-xs font-mono font-black tabular-nums">{Math.round(currentGusts)}</span>
                    </div>
                  )}
                </div>
              </div>

              {beaufort && (
                <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md border backdrop-blur-md bg-black/40 w-fit ${severity.borderColor}`}>
                  <span className={`text-xs font-black uppercase tracking-wider ${severity.color}`}>
                    {safeLang === 'ca' ? 'Força' : safeLang === 'es' ? 'Fuerza' : safeLang === 'fr' ? 'Force' : 'Force'} {beaufort.force} · {beaufort.label}
                  </span>
                </div>
              )}
            </div>

            {/* AVÍS: pròxima ratxa forta */}
            <div className={`rounded-2xl border p-4 flex items-center gap-4 ${nextGustWindow ? severity.borderColor + ' bg-black/30' : 'border-white/5 bg-black/20'}`}>
              <div className={`shrink-0 w-10 h-10 rounded-full flex items-center justify-center border ${nextGustWindow ? `${severity.borderColor} ${severity.color} bg-black/40` : 'border-white/5 text-slate-500 bg-black/30'}`}>
                <Zap className="w-5 h-5" />
              </div>
              <div className="flex flex-col">
                <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">{t.strongGustWindow}</span>
                {nextGustWindow ? (
                  <span className={`text-sm font-bold ${severity.color}`}>
                    {nextGustWindow.startIdx === 0 ? t.activeNow : `${t.in_} ${nextGustWindow.startIdx}${t.hoursShort}`}
                    {' · '}{Math.round(nextGustWindow.peak)} {t.kmh}
                  </span>
                ) : (
                  <span className="text-sm font-bold text-emerald-400">{t.noWindow}</span>
                )}
              </div>
            </div>

            {/* GRÀFIC D'EVOLUCIÓ (scrubbable) + franja de direcció */}
            <div className="relative rounded-2xl border border-white/5 bg-black/30 backdrop-blur-md p-4 overflow-hidden">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-2 sm:mb-1 relative z-10 gap-0.5 sm:gap-2">
                <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 shrink-0">
                  {t.evolution} · {WINDOW_HOURS}h
                </span>
                {activeEntry ? (
                  <span className="text-[11px] font-mono font-bold text-slate-200">
                    {isScrubbing ? activeEntry.timeStr.slice(11, 16) : t.now}
                    {' · '}{displaySpeed !== null ? `${Math.round(displaySpeed)}` : '--'}
                    {displayGusts !== null && <> {' ('}<span className="text-slate-400">{Math.round(displayGusts)}</span>{')'}</>}
                    {' '}{t.kmh}
                  </span>
                ) : (
                  <span className="text-[9px] text-slate-600 italic">{t.scrubHint}</span>
                )}
              </div>

              <svg
                viewBox={`0 0 ${CHART_W} ${CHART_H}`}
                className="w-full h-40 overflow-visible cursor-crosshair rounded-xl focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/60"
                style={{ touchAction: 'none' }}
                onPointerMove={handlePointerMove}
                onPointerDown={handlePointerMove}
                onPointerUp={clearScrub}
                onPointerLeave={clearScrub}
                onPointerCancel={clearScrub}
                tabIndex={0}
                role="slider"
                aria-label={`${t.evolution} · ${WINDOW_HOURS}h`}
                aria-valuemin={0}
                aria-valuemax={N - 1}
                aria-valuenow={activeIndex}
                aria-valuetext={activeEntry ? `${activeEntry.timeStr.slice(11, 16)} · ${activeEntry.speed ?? '--'} km/h` : undefined}
                onKeyDown={handleKeyDown}
              >
                {dayMarkers.map(m => (
                  <line key={m.i} x1={idxToX(m.i)} y1={TOP_Y} x2={idxToX(m.i)} y2={BOTTOM_Y} stroke="#475569" strokeOpacity="0.4" strokeWidth="1" strokeDasharray="1 3" />
                ))}

                {speedArea && <path d={speedArea} fill={severity.stroke} fillOpacity="0.12" />}
                {gustLine && <path d={gustLine} fill="none" stroke="#94a3b8" strokeWidth="1.5" strokeDasharray="4 3" strokeLinecap="round" opacity="0.7" />}
                {speedLine && <path d={speedLine} fill="none" stroke={severity.stroke} strokeWidth="2" strokeLinecap="round" opacity="0.95" />}

                {maxGustWindow && (
                  <circle cx={idxToX(maxGustWindow.idx)} cy={valToY(maxGustWindow.value)} r="4" fill="#f43f5e" opacity="0.9" />
                )}

                {activeEntry && activeEntry.speed !== null && (
                  <g style={{ transform: `translate(${idxToX(activeIndex)}px, ${valToY(activeEntry.speed)}px)` }}>
                    {isScrubbing && <line y1={TOP_Y - valToY(activeEntry.speed)} y2={BOTTOM_Y - valToY(activeEntry.speed)} stroke={severity.stroke} strokeWidth="1" strokeDasharray="2 2" opacity="0.4" />}
                    <circle r="6" fill={severity.stroke} opacity="0.25" />
                    <circle r="3.5" fill="#fff" opacity="0.95" />
                  </g>
                )}
              </svg>

              {/* Franja de direcció */}
              <div className="flex items-center justify-between mt-2 px-1">
                {dirSamples.map(s => (
                  <div key={s.idx} className="flex flex-col items-center gap-0.5">
                    {s.dir !== null ? (
                      <Navigation2 className="w-3 h-3 text-slate-400" style={{ transform: `rotate(${s.dir + 180}deg)` }} />
                    ) : (
                      <span className="w-3 h-3" />
                    )}
                  </div>
                ))}
              </div>

              <div className="flex items-center justify-center gap-4 mt-2 relative z-10">
                <LegendItem color={severity.stroke} dashed={false} label={t.legendSpeed} />
                <LegendItem color="#94a3b8" dashed label={t.legendGusts} />
              </div>
            </div>

            {/* TARGETES D'ESTADÍSTIQUES */}
            <StatsSection t={t} maxGustWindow={maxGustWindow} avgSpeed={avgSpeed} dominantDirection={dominantDirection} />
          </div>
        )}
      </div>
    </div>
  );
}

const LegendItem = memo(function LegendItem({ color, dashed, label }: { color: string; dashed: boolean; label: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="w-3 h-0.5 rounded-full" style={{ backgroundColor: dashed ? 'transparent' : color, borderTop: dashed ? `1.5px dashed ${color}` : undefined }}></span>
      <span className="text-[9px] font-bold uppercase tracking-widest text-slate-400">{label}</span>
    </div>
  );
});

interface StatsSectionProps {
  t: Record<string, string>;
  maxGustWindow: { idx: number; value: number } | null;
  avgSpeed: number | null;
  dominantDirection: string | null;
}

const StatsSection = memo(function StatsSection({ t, maxGustWindow, avgSpeed, dominantDirection }: StatsSectionProps) {
  return (
    <div className="grid grid-cols-3 gap-3">
      <StatCard label={t.maxGust} value={maxGustWindow ? `${Math.round(maxGustWindow.value)}` : '--'} sub={t.kmh} icon={<Zap className="w-3.5 h-3.5" />} />
      <StatCard label={t.avgSpeed} value={avgSpeed !== null ? `${Math.round(avgSpeed)}` : '--'} sub={t.kmh} icon={<Wind className="w-3.5 h-3.5" />} />
      <StatCard label={t.dominantDir} value={dominantDirection ?? '--'} icon={<Navigation2 className="w-3.5 h-3.5" />} />
    </div>
  );
});
