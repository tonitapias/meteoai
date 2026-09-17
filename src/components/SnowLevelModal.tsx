// src/components/SnowLevelModal.tsx
// Modal de detall de la cota de neu — evolució horària (48h) amb scrubbing. A diferència
// dels altres modals experts, NO llegeix weatherData.hourly directament: la cota de neu no és
// un camp cru d'Open-Meteo, sinó un càlcul derivat (nivell de congelació − 300m, calculateSnowLevel
// a winterRules.ts) amb una cadena de fallback ecmwf→gfs→icon quan AROME-HD no cobreix l'hora.
// Aquesta cadena ja viu a calculations.chartDataFull (useChartData.ts) — reutilitzar-la, en
// lloc de rellegir hourly.freezing_level_height cru (com fa StormModal per al seu propi
// "nivell de congelació" SENSE buffer), és l'única manera de no desincronitzar-se del giny.
import { useState, useRef, useMemo, memo } from 'react';
import { X, Mountain, Snowflake, Thermometer, CloudOff } from 'lucide-react';
import { Language } from '../translations';
import { WeatherUnit } from '../utils/formatters';
import { MATRIX_BG } from './widgets/widgetStyles';
import { StatCard } from './AstroStatCard';
import { useAstroModalShell } from '../hooks/useAstroModalShell';
import type { ChartDataPoint } from './ForecastSection';

interface SnowLevelModalProps {
  // Mateixa font que SnowLevelWidget al dashboard (calculations.currentFreezingLevel) —
  // no recalculem a partir de weatherData perquè no hi ha una segona font "en viu" real
  // (freezing_level_height mai arriba al bloc `current` d'Open-Meteo).
  freezingLevel: number | null;
  chartDataFull: ChartDataPoint[];
  unit: WeatherUnit;
  onClose: () => void;
  lang?: Language;
}

const WINDOW_HOURS = 48;
const SNOW_BUFFER_M = 300;

const T: Record<Language, Record<string, string>> = {
  ca: {
    title: 'COTA DE NEU', subtitle: 'Límit Altitudinal Pluja/Neu', noData: 'SENSE DADES SUFICIENTS',
    levelNow: 'Cota Actual', freezingSub: 'Nivell de congelació (0°C)', evolution: 'Evolució',
    scrubHint: 'Toca o arrossega per explorar', minWindow: 'Cota Mínima Prevista',
    activeNow: 'Ara mateix', in_: "D'aquí a", now: 'ARA', hoursShort: 'h',
    minLevel: 'Cota Mín. 48h', maxLevel: 'Cota Màx. 48h', metres: 'METRES', feet: 'PEUS',
  },
  es: {
    title: 'COTA DE NIEVE', subtitle: 'Límite Altitudinal Lluvia/Nieve', noData: 'DATOS INSUFICIENTES',
    levelNow: 'Cota Actual', freezingSub: 'Nivel de congelación (0°C)', evolution: 'Evolución',
    scrubHint: 'Toca o arrastra para explorar', minWindow: 'Cota Mínima Prevista',
    activeNow: 'Ahora mismo', in_: 'Dentro de', now: 'AHORA', hoursShort: 'h',
    minLevel: 'Cota Mín. 48h', maxLevel: 'Cota Máx. 48h', metres: 'METROS', feet: 'PIES',
  },
  en: {
    title: 'SNOW LEVEL', subtitle: 'Rain/Snow Altitude Line', noData: 'INSUFFICIENT DATA',
    levelNow: 'Current Level', freezingSub: 'Freezing level (0°C)', evolution: 'Evolution',
    scrubHint: 'Tap or drag to explore', minWindow: 'Expected Minimum Level',
    activeNow: 'Right now', in_: 'In', now: 'NOW', hoursShort: 'h',
    minLevel: 'Min Level 48h', maxLevel: 'Max Level 48h', metres: 'METERS', feet: 'FEET',
  },
  fr: {
    title: 'LIMITE NEIGE', subtitle: 'Altitude Limite Pluie/Neige', noData: 'DONNÉES INSUFFISANTES',
    levelNow: 'Niveau Actuel', freezingSub: 'Isotherme 0°C', evolution: 'Évolution',
    scrubHint: 'Touchez ou glissez pour explorer', minWindow: 'Niveau Minimum Prévu',
    activeNow: "À l'instant", in_: 'Dans', now: 'MAINTENANT', hoursShort: 'h',
    minLevel: 'Niveau Min. 48h', maxLevel: 'Niveau Max. 48h', metres: 'MÈTRES', feet: 'PIEDS',
  },
};

const getSnowLevel = (entry: ChartDataPoint | undefined): number | null => {
  const v = entry?.snowLevel;
  return typeof v === 'number' && !isNaN(v) ? v : null;
};

const CHART_W = 400, CHART_H = 160, TOP_Y = 12, BOTTOM_Y = 140;
const STROKE = '#38bdf8';

export default function SnowLevelModal({ freezingLevel, chartDataFull, unit, onClose, lang = 'ca' }: SnowLevelModalProps) {
  const safeLang: Language = T[lang] ? lang : 'ca';
  const t = T[safeLang];

  const { handleClose } = useAstroModalShell(onClose);

  const isFt = unit === 'F';
  const toDisplay = (m: number) => Math.round(isFt ? m * 3.28084 : m);
  const unitLabel = isFt ? t.feet : t.metres;

  const hasData = Array.isArray(chartDataFull) && chartDataFull.length > 0;

  const windowEntries = useMemo(() => {
    if (!hasData) return [];
    return chartDataFull.slice(0, WINDOW_HOURS).map(e => ({
      timeStr: typeof e.time === 'string' ? e.time : '',
      snowLevel: getSnowLevel(e),
    }));
  }, [hasData, chartDataFull]);

  const N = windowEntries.length;

  // Prioritzem freezingLevel (mateixa font que el giny) per al valor "ara" — coincideix amb
  // windowEntries[0].snowLevel en el cas normal, però és l'única font realment garantida
  // idèntica al giny en tots els casos (vegeu la capçalera del fitxer).
  const currentSnowLevel = typeof freezingLevel === 'number'
    ? Math.max(0, freezingLevel - SNOW_BUFFER_M)
    : (N > 0 ? windowEntries[0].snowLevel : null);

  const minSnowLevel = useMemo(() => {
    const vals = windowEntries.map(e => e.snowLevel).filter((v): v is number => v !== null);
    return vals.length > 0 ? Math.min(...vals) : null;
  }, [windowEntries]);
  const maxSnowLevel = useMemo(() => {
    const vals = windowEntries.map(e => e.snowLevel).filter((v): v is number => v !== null);
    return vals.length > 0 ? Math.max(...vals) : null;
  }, [windowEntries]);

  // --- Moment en què la cota serà més baixa (més rellevant: quan la neu arriba més avall) ---
  const minWindow = useMemo(() => {
    let best: { idx: number; value: number } | null = null;
    for (let i = 0; i < N; i++) {
      const value = windowEntries[i].snowLevel;
      if (value === null) continue;
      if (!best || value < best.value) best = { idx: i, value };
    }
    return best;
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
  const displaySnowLevel = isScrubbing ? activeEntry?.snowLevel ?? null : currentSnowLevel;

  // --- Geometria del gràfic: sense "zero" absolut, escalem al rang real de dades ---
  const yBounds = useMemo(() => {
    if (minSnowLevel === null || maxSnowLevel === null) return { min: 0, max: 3000 };
    const pad = Math.max(100, (maxSnowLevel - minSnowLevel) * 0.2);
    return { min: Math.max(0, minSnowLevel - pad), max: maxSnowLevel + pad };
  }, [minSnowLevel, maxSnowLevel]);

  const levelToY = (v: number) => {
    const range = yBounds.max - yBounds.min || 1;
    return BOTTOM_Y - ((Math.max(yBounds.min, Math.min(yBounds.max, v)) - yBounds.min) / range) * (BOTTOM_Y - TOP_Y);
  };
  const idxToX = (i: number) => N > 1 ? (i / (N - 1)) * CHART_W : 0;

  const linePath = useMemo(() => {
    if (N === 0) return '';
    return windowEntries
      .map((e, i) => (e.snowLevel !== null ? `${i === 0 ? 'M' : 'L'} ${idxToX(i)} ${levelToY(e.snowLevel)}` : null))
      .filter((s): s is string => s !== null)
      .join(' ');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [windowEntries, yBounds, N]);

  const areaPath = useMemo(() => {
    if (N === 0) return '';
    const pts = windowEntries.map((e, i) => `${idxToX(i)},${levelToY(e.snowLevel ?? yBounds.min)}`);
    return `M 0,${BOTTOM_Y} L ${pts.join(' L ')} L ${CHART_W},${BOTTOM_Y} Z`;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [windowEntries, yBounds, N]);

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

  return (
    <div role="dialog" aria-modal="true" aria-labelledby="snowlevel-modal-title" className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-0 sm:p-4 md:p-6 landscape:p-0 landscape:sm:p-4 bg-black/95 backdrop-blur-3xl backdrop-saturate-150 animate-in fade-in duration-200">
      <style>{`
        .snowlevel-scrollbar { -webkit-overflow-scrolling: touch; }
        .snowlevel-scrollbar::-webkit-scrollbar { width: 5px; }
        .snowlevel-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .snowlevel-scrollbar::-webkit-scrollbar-thumb { background: rgba(56,189,248,0.2); border-radius: 8px; }
        .snowlevel-scrollbar::-webkit-scrollbar-thumb:hover { background: rgba(56,189,248,0.4); }
      `}</style>

      <div className="w-full h-[96dvh] sm:h-auto sm:max-h-[90dvh] landscape:h-[100dvh] landscape:sm:h-auto max-w-sm md:max-w-3xl lg:max-w-5xl flex flex-col min-h-0 bg-gradient-to-b from-sky-950/20 to-black/90 rounded-t-[24px] sm:rounded-[32px] border-t sm:border border-sky-500/20 shadow-[0_0_100px_rgba(0,0,0,0.9)] overflow-hidden relative animate-in slide-in-from-bottom-8 sm:zoom-in-95 duration-300">
        <div className={MATRIX_BG}></div>
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[130%] h-56 bg-gradient-to-b from-sky-500/10 via-slate-900/5 to-transparent blur-[80px] pointer-events-none z-0"></div>

        {/* Capçalera */}
        <div className="flex justify-between items-center shrink-0 relative z-20 p-4 md:p-6 border-b border-white/[0.04]">
          <div className="flex items-center gap-3">
            <div className="relative flex items-center justify-center w-10 h-10 rounded-full border bg-black/40 border-sky-500/30 text-sky-300">
              <Mountain className="w-5 h-5" />
            </div>
            <div className="flex flex-col">
              <h2 id="snowlevel-modal-title" className="text-lg md:text-2xl font-black text-white tracking-tighter drop-shadow-md leading-none">{t.title}</h2>
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
          <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain snowlevel-scrollbar relative z-10 p-4 md:p-6 space-y-6">

            {/* HEROI: cota de neu actual */}
            <div className="relative rounded-2xl border border-white/5 bg-black/30 backdrop-blur-md p-5 flex flex-col sm:flex-row items-center gap-6">
              <div className="flex flex-col items-center sm:items-start gap-1">
                <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">{t.levelNow}</span>
                <span className="text-5xl sm:text-6xl font-black tracking-tighter tabular-nums leading-none drop-shadow-xl text-white">
                  {currentSnowLevel !== null ? toDisplay(currentSnowLevel) : '--'}
                </span>
                <span className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">{unitLabel}</span>
              </div>
              {typeof freezingLevel === 'number' && (
                <div className="flex flex-col items-center sm:items-start gap-2 flex-1">
                  <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-sky-500/20 backdrop-blur-md bg-black/40 w-fit">
                    <Thermometer className="w-3.5 h-3.5 text-sky-300" />
                    <span className="text-xs font-bold text-sky-100">{t.freezingSub}: {toDisplay(freezingLevel)} {unitLabel.toLowerCase()}</span>
                  </div>
                </div>
              )}
            </div>

            {/* AVÍS: moment de cota mínima prevista */}
            {minWindow && (
              <div className="rounded-2xl border border-sky-500/20 bg-black/30 p-4 flex items-center gap-4">
                <div className="shrink-0 w-10 h-10 rounded-full flex items-center justify-center border border-sky-500/30 text-sky-300 bg-black/40">
                  <Snowflake className="w-5 h-5" />
                </div>
                <div className="flex flex-col">
                  <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">{t.minWindow}</span>
                  <span className="text-sm font-bold text-sky-300">
                    {minWindow.idx === 0 ? t.activeNow : `${t.in_} ${minWindow.idx}${t.hoursShort}`}
                    {' · '}{toDisplay(minWindow.value)} {unitLabel.toLowerCase()}
                  </span>
                </div>
              </div>
            )}

            {/* GRÀFIC D'EVOLUCIÓ (scrubbable) */}
            <div className="relative rounded-2xl border border-white/5 bg-black/30 backdrop-blur-md p-4 overflow-hidden">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-2 sm:mb-1 relative z-10 gap-0.5 sm:gap-2">
                <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 shrink-0">
                  {t.evolution} · {WINDOW_HOURS}h
                </span>
                {activeEntry ? (
                  <span className="text-[11px] font-mono font-bold text-slate-200">
                    {isScrubbing ? activeEntry.timeStr.slice(11, 16) : t.now}
                    {' · '}{displaySnowLevel !== null ? `${toDisplay(displaySnowLevel)} ${unitLabel.toLowerCase()}` : '--'}
                  </span>
                ) : (
                  <span className="text-[9px] text-slate-600 italic">{t.scrubHint}</span>
                )}
              </div>

              <svg
                viewBox={`0 0 ${CHART_W} ${CHART_H}`}
                className="w-full h-40 overflow-visible cursor-crosshair rounded-xl focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-400/60"
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
                aria-valuetext={activeEntry ? `${activeEntry.timeStr.slice(11, 16)} · ${activeEntry.snowLevel ?? '--'} m` : undefined}
                onKeyDown={handleKeyDown}
              >
                {dayMarkers.map(m => (
                  <line key={m.i} x1={idxToX(m.i)} y1={TOP_Y} x2={idxToX(m.i)} y2={BOTTOM_Y} stroke="#475569" strokeOpacity="0.4" strokeWidth="1" strokeDasharray="1 3" />
                ))}

                {areaPath && <path d={areaPath} fill={STROKE} fillOpacity="0.12" />}
                {linePath && <path d={linePath} fill="none" stroke={STROKE} strokeWidth="2" strokeLinecap="round" opacity="0.95" />}

                {minWindow && (
                  <circle cx={idxToX(minWindow.idx)} cy={levelToY(minWindow.value)} r="4" fill="#f43f5e" opacity="0.9" />
                )}

                {activeEntry && activeEntry.snowLevel !== null && (
                  <g style={{ transform: `translate(${idxToX(activeIndex)}px, ${levelToY(activeEntry.snowLevel)}px)` }}>
                    {isScrubbing && <line y1={TOP_Y - levelToY(activeEntry.snowLevel)} y2={BOTTOM_Y - levelToY(activeEntry.snowLevel)} stroke={STROKE} strokeWidth="1" strokeDasharray="2 2" opacity="0.4" />}
                    <circle r="6" fill={STROKE} opacity="0.25" />
                    <circle r="3.5" fill="#fff" opacity="0.95" />
                  </g>
                )}
              </svg>
            </div>

            {/* TARGETES D'ESTADÍSTIQUES */}
            <StatsSection t={t} minSnowLevel={minSnowLevel} maxSnowLevel={maxSnowLevel} toDisplay={toDisplay} unitLabel={unitLabel} />
          </div>
        )}
      </div>
    </div>
  );
}

interface StatsSectionProps {
  t: Record<string, string>;
  minSnowLevel: number | null;
  maxSnowLevel: number | null;
  toDisplay: (m: number) => number;
  unitLabel: string;
}

const StatsSection = memo(function StatsSection({ t, minSnowLevel, maxSnowLevel, toDisplay, unitLabel }: StatsSectionProps) {
  return (
    <div className="grid grid-cols-2 gap-3">
      <StatCard label={t.minLevel} value={minSnowLevel !== null ? `${toDisplay(minSnowLevel)}` : '--'} sub={unitLabel} icon={<Mountain className="w-3.5 h-3.5" />} />
      <StatCard label={t.maxLevel} value={maxSnowLevel !== null ? `${toDisplay(maxSnowLevel)}` : '--'} sub={unitLabel} icon={<Mountain className="w-3.5 h-3.5" />} />
    </div>
  );
});
