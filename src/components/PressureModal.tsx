// src/components/PressureModal.tsx
// Modal de detall de la pressió atmosfèrica — evolució horària (48h) amb scrubbing i
// classificació de la tendència baromètrica segons la terminologia real dels butlletins
// marítims (lenta/moderada/ràpida/molt ràpida). Reutilitza hourly.pressure_msl, ja demanat a
// Open-Meteo — cap crida de xarxa nova.
import { useState, useRef, useMemo, memo } from 'react';
import { X, Gauge, TrendingUp, TrendingDown, Minus, CloudOff } from 'lucide-react';
import { ExtendedWeatherData } from '../types/weatherLogicTypes';
import { Language } from '../translations';
import { MATRIX_BG } from './widgets/widgetStyles';
import { StatCard } from './AstroStatCard';
import { useAstroModalShell } from '../hooks/useAstroModalShell';
import { WEATHER_THRESHOLDS } from '../constants/weatherConfig';

const { PRESSURE } = WEATHER_THRESHOLDS;

interface PressureModalProps {
  weatherData: ExtendedWeatherData;
  onClose: () => void;
  lang?: Language;
}

const WINDOW_HOURS = 48;

const T: Record<Language, Record<string, string>> = {
  ca: {
    title: 'PRESSIÓ ATMOSFÈRICA', subtitle: 'Observatori Baromètric', noData: 'SENSE DADES SUFICIENTS',
    pressureNow: 'Pressió Actual', evolution: 'Evolució', scrubHint: 'Toca o arrossega per explorar',
    steepestChange: 'Canvi Més Sobtat', now: 'ARA', hoursShort: 'h',
    minPressure: 'Mínima 48h', maxPressure: 'Màxima 48h', trend3h: 'Tendència (3h)',
    stable: 'Estable', risingSlow: 'Pujant Lentament', fallingSlow: 'Baixant Lentament',
    rising: 'Pujant', falling: 'Baixant', risingRapid: 'Pujant Ràpidament', fallingRapid: 'Baixant Ràpidament',
    risingVeryRapid: 'Pujant Molt Ràpidament', fallingVeryRapid: 'Baixant Molt Ràpidament',
    at_: 'a les',
  },
  es: {
    title: 'PRESIÓN ATMOSFÉRICA', subtitle: 'Observatorio Barométrico', noData: 'DATOS INSUFICIENTES',
    pressureNow: 'Presión Actual', evolution: 'Evolución', scrubHint: 'Toca o arrastra para explorar',
    steepestChange: 'Cambio Más Brusco', now: 'AHORA', hoursShort: 'h',
    minPressure: 'Mínima 48h', maxPressure: 'Máxima 48h', trend3h: 'Tendencia (3h)',
    stable: 'Estable', risingSlow: 'Subiendo Lentamente', fallingSlow: 'Bajando Lentamente',
    rising: 'Subiendo', falling: 'Bajando', risingRapid: 'Subiendo Rápidamente', fallingRapid: 'Bajando Rápidamente',
    risingVeryRapid: 'Subiendo Muy Rápido', fallingVeryRapid: 'Bajando Muy Rápido',
    at_: 'a las',
  },
  en: {
    title: 'ATMOSPHERIC PRESSURE', subtitle: 'Barometric Observatory', noData: 'INSUFFICIENT DATA',
    pressureNow: 'Current Pressure', evolution: 'Evolution', scrubHint: 'Tap or drag to explore',
    steepestChange: 'Steepest Change', now: 'NOW', hoursShort: 'h',
    minPressure: 'Min 48h', maxPressure: 'Max 48h', trend3h: 'Trend (3h)',
    stable: 'Steady', risingSlow: 'Rising Slowly', fallingSlow: 'Falling Slowly',
    rising: 'Rising', falling: 'Falling', risingRapid: 'Rising Quickly', fallingRapid: 'Falling Quickly',
    risingVeryRapid: 'Rising Very Rapidly', fallingVeryRapid: 'Falling Very Rapidly',
    at_: 'at',
  },
  fr: {
    title: 'PRESSION ATMOSPHÉRIQUE', subtitle: 'Observatoire Barométrique', noData: 'DONNÉES INSUFFISANTES',
    pressureNow: 'Pression Actuelle', evolution: 'Évolution', scrubHint: 'Touchez ou glissez pour explorer',
    steepestChange: 'Changement Le Plus Brusque', now: 'MAINTENANT', hoursShort: 'h',
    minPressure: 'Min 48h', maxPressure: 'Max 48h', trend3h: 'Tendance (3h)',
    stable: 'Stable', risingSlow: 'Hausse Lente', fallingSlow: 'Baisse Lente',
    rising: 'En Hausse', falling: 'En Baisse', risingRapid: 'Hausse Rapide', fallingRapid: 'Baisse Rapide',
    risingVeryRapid: 'Hausse Très Rapide', fallingVeryRapid: 'Baisse Très Rapide',
    at_: 'à',
  },
};

const getSafe = (arr: (number | null)[] | undefined, idx: number): number | null => {
  const v = Array.isArray(arr) ? arr[idx] : undefined;
  return typeof v === 'number' && !isNaN(v) ? v : null;
};

interface TrendInfo { label: string; direction: 'up' | 'down' | 'flat'; color: string; stroke: string; }

// Classificació real de tendència baromètrica a 3h (terminologia de butlletins marítims) —
// vegeu WEATHER_THRESHOLDS.PRESSURE (weatherConfig.ts) per als llindars.
function classifyTrend(delta3h: number | null, t: Record<string, string>): TrendInfo {
  if (delta3h === null) return { label: t.stable, direction: 'flat', color: 'text-slate-400', stroke: '#94a3b8' };
  const abs = Math.abs(delta3h);
  const direction: 'up' | 'down' | 'flat' = abs < PRESSURE.STABLE ? 'flat' : delta3h > 0 ? 'up' : 'down';
  if (direction === 'flat') return { label: t.stable, direction, color: 'text-slate-400', stroke: '#94a3b8' };
  const isUp = direction === 'up';
  if (abs <= PRESSURE.SLOW) return { label: isUp ? t.risingSlow : t.fallingSlow, direction, color: isUp ? 'text-emerald-400' : 'text-amber-400', stroke: isUp ? '#34d399' : '#fbbf24' };
  if (abs <= PRESSURE.MODERATE) return { label: isUp ? t.rising : t.falling, direction, color: isUp ? 'text-emerald-400' : 'text-amber-400', stroke: isUp ? '#34d399' : '#fbbf24' };
  if (abs <= PRESSURE.RAPID) return { label: isUp ? t.risingRapid : t.fallingRapid, direction, color: isUp ? 'text-orange-400' : 'text-orange-500', stroke: '#f97316' };
  return { label: isUp ? t.risingVeryRapid : t.fallingVeryRapid, direction, color: 'text-rose-500', stroke: '#f43f5e' };
}

const CHART_W = 400, CHART_H = 160, TOP_Y = 12, BOTTOM_Y = 140;

export default function PressureModal({ weatherData, onClose, lang = 'ca' }: PressureModalProps) {
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

  const hasData = currentHourIndex !== -1 && Array.isArray(hourly?.pressure_msl);

  const windowEntries = useMemo(() => {
    if (!hasData || !hourly) return [];
    const total = Array.isArray(hourly.time) ? hourly.time.length : 0;
    const n = Math.min(WINDOW_HOURS, total - currentHourIndex);
    return Array.from({ length: Math.max(0, n) }, (_, i) => {
      const idx = currentHourIndex + i;
      return { idx, timeStr: String(hourly.time?.[idx] ?? ''), pressure: getSafe(hourly.pressure_msl, idx) };
    });
  }, [hasData, hourly, currentHourIndex]);

  const N = windowEntries.length;

  const currentPressure = N > 0 ? windowEntries[0].pressure : (typeof current?.pressure_msl === 'number' ? current.pressure_msl : null);

  const currentDelta3h = useMemo(() => {
    if (!hourly || currentHourIndex < 3) return null;
    const nowP = getSafe(hourly.pressure_msl, currentHourIndex);
    const pastP = getSafe(hourly.pressure_msl, currentHourIndex - 3);
    return nowP !== null && pastP !== null ? Number((nowP - pastP).toFixed(1)) : null;
  }, [hourly, currentHourIndex]);

  const trend = classifyTrend(currentDelta3h, t);

  const minPressure = useMemo(() => {
    const vals = windowEntries.map(e => e.pressure).filter((v): v is number => v !== null);
    return vals.length > 0 ? Math.min(...vals) : null;
  }, [windowEntries]);
  const maxPressure = useMemo(() => {
    const vals = windowEntries.map(e => e.pressure).filter((v): v is number => v !== null);
    return vals.length > 0 ? Math.max(...vals) : null;
  }, [windowEntries]);

  // --- Canvi més sobtat: escaneja tota la finestra amb un ΔP mòbil de 3h ---
  const steepestChange = useMemo(() => {
    let best: { idx: number; delta: number } | null = null;
    for (let i = 3; i < N; i++) {
      const now = windowEntries[i].pressure;
      const past = windowEntries[i - 3].pressure;
      if (now === null || past === null) continue;
      const delta = Number((now - past).toFixed(1));
      if (!best || Math.abs(delta) > Math.abs(best.delta)) best = { idx: i, delta };
    }
    return best;
  }, [windowEntries, N]);

  // --- Scrub horitzontal (mateix patró RAF que Storm/AQI/UV) ---
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

  // --- Geometria del gràfic: sense "zero" absolut, escalem al rang real de dades ---
  const yBounds = useMemo(() => {
    if (minPressure === null || maxPressure === null) return { min: 990, max: 1030 };
    const pad = Math.max(2, (maxPressure - minPressure) * 0.2);
    return { min: minPressure - pad, max: maxPressure + pad };
  }, [minPressure, maxPressure]);

  const pressureToY = (v: number) => {
    const range = yBounds.max - yBounds.min || 1;
    return BOTTOM_Y - ((Math.max(yBounds.min, Math.min(yBounds.max, v)) - yBounds.min) / range) * (BOTTOM_Y - TOP_Y);
  };
  const idxToX = (i: number) => N > 1 ? (i / (N - 1)) * CHART_W : 0;

  const linePath = useMemo(() => {
    if (N === 0) return '';
    return windowEntries
      .map((e, i) => (e.pressure !== null ? `${i === 0 ? 'M' : 'L'} ${idxToX(i)} ${pressureToY(e.pressure)}` : null))
      .filter((s): s is string => s !== null)
      .join(' ');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [windowEntries, yBounds, N]);

  const areaPath = useMemo(() => {
    if (N === 0) return '';
    const pts = windowEntries.map((e, i) => `${idxToX(i)},${pressureToY(e.pressure ?? yBounds.min)}`);
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
    <div role="dialog" aria-modal="true" aria-labelledby="pressure-modal-title" className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-0 sm:p-4 md:p-6 landscape:p-0 landscape:sm:p-4 bg-black/95 backdrop-blur-3xl backdrop-saturate-150 animate-in fade-in duration-200">
      <style>{`
        .pressure-scrollbar { -webkit-overflow-scrolling: touch; }
        .pressure-scrollbar::-webkit-scrollbar { width: 5px; }
        .pressure-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .pressure-scrollbar::-webkit-scrollbar-thumb { background: rgba(129,140,248,0.2); border-radius: 8px; }
        .pressure-scrollbar::-webkit-scrollbar-thumb:hover { background: rgba(129,140,248,0.4); }
      `}</style>

      <div className="w-full h-[96dvh] sm:h-auto sm:max-h-[90dvh] landscape:h-[100dvh] landscape:sm:h-auto max-w-sm md:max-w-3xl lg:max-w-5xl flex flex-col min-h-0 bg-gradient-to-b from-indigo-950/30 to-black/90 rounded-t-[24px] sm:rounded-[32px] border-t sm:border border-indigo-500/20 shadow-[0_0_100px_rgba(0,0,0,0.9)] overflow-hidden relative animate-in slide-in-from-bottom-8 sm:zoom-in-95 duration-300">
        <div className={MATRIX_BG}></div>
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[130%] h-56 bg-gradient-to-b from-indigo-500/10 via-slate-900/5 to-transparent blur-[80px] pointer-events-none z-0"></div>

        {/* Capçalera */}
        <div className="flex justify-between items-center shrink-0 relative z-20 p-4 md:p-6 border-b border-white/[0.04]">
          <div className="flex items-center gap-3">
            <div className="relative flex items-center justify-center w-10 h-10 rounded-full border bg-black/40 border-indigo-500/30 text-indigo-400">
              <Gauge className="w-5 h-5" />
            </div>
            <div className="flex flex-col">
              <h2 id="pressure-modal-title" className="text-lg md:text-2xl font-black text-white tracking-tighter drop-shadow-md leading-none">{t.title}</h2>
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
          <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain pressure-scrollbar relative z-10 p-4 md:p-6 space-y-6">

            {/* HEROI: pressió actual + tendència */}
            <div className="relative rounded-2xl border border-white/5 bg-black/30 backdrop-blur-md p-5 flex flex-col sm:flex-row items-center gap-6">
              <div className="flex flex-col items-center sm:items-start gap-1">
                <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">{t.pressureNow}</span>
                <span className="text-5xl sm:text-6xl font-black tracking-tighter tabular-nums leading-none drop-shadow-xl text-white">
                  {currentPressure !== null ? Math.round(currentPressure) : '--'}
                </span>
                <span className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">hPa</span>
              </div>
              <div className="flex flex-col items-center sm:items-start gap-2 flex-1">
                <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md border backdrop-blur-md bg-black/40 w-fit ${trend.color.replace('text-', 'border-')}/40`}>
                  {trend.direction === 'up' ? <TrendingUp className={`w-3.5 h-3.5 ${trend.color}`} /> : trend.direction === 'down' ? <TrendingDown className={`w-3.5 h-3.5 ${trend.color}`} /> : <Minus className="w-3.5 h-3.5 text-slate-400" />}
                  <span className={`text-xs font-black uppercase tracking-wider ${trend.color}`}>{trend.label}</span>
                </div>
                {currentDelta3h !== null && (
                  <div className="flex items-center gap-2 mt-1 px-3 py-1.5 rounded-lg bg-black/40 border border-white/5">
                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">{t.trend3h}</span>
                    <span className={`text-xs font-mono font-bold ${trend.color}`}>{currentDelta3h > 0 ? '+' : ''}{currentDelta3h} hPa</span>
                  </div>
                )}
              </div>
            </div>

            {/* AVÍS: canvi més sobtat de la finestra */}
            {steepestChange && Math.abs(steepestChange.delta) >= PRESSURE.SLOW && (() => {
              const steepTrend = classifyTrend(steepestChange.delta, t);
              const entry = windowEntries[steepestChange.idx];
              return (
                <div className={`rounded-2xl border p-4 flex items-center gap-4 bg-black/30 ${steepTrend.color.replace('text-', 'border-')}/30`}>
                  <div className={`shrink-0 w-10 h-10 rounded-full flex items-center justify-center border bg-black/40 ${steepTrend.color.replace('text-', 'border-')}/30 ${steepTrend.color}`}>
                    {steepTrend.direction === 'up' ? <TrendingUp className="w-5 h-5" /> : <TrendingDown className="w-5 h-5" />}
                  </div>
                  <div className="flex flex-col">
                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">{t.steepestChange}</span>
                    <span className={`text-sm font-bold ${steepTrend.color}`}>
                      {steepTrend.label} ({steepestChange.delta > 0 ? '+' : ''}{steepestChange.delta} hPa) {t.at_} {entry.timeStr.slice(11, 16)}
                    </span>
                  </div>
                </div>
              );
            })()}

            {/* GRÀFIC D'EVOLUCIÓ (scrubbable) */}
            <div className="relative rounded-2xl border border-white/5 bg-black/30 backdrop-blur-md p-4 overflow-hidden">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-2 sm:mb-1 relative z-10 gap-0.5 sm:gap-2">
                <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 shrink-0">
                  {t.evolution} · {WINDOW_HOURS}h
                </span>
                {activeEntry ? (
                  <span className="text-[11px] font-mono font-bold text-slate-200">
                    {isScrubbing ? activeEntry.timeStr.slice(11, 16) : t.now}
                    {' · '}{activeEntry.pressure !== null ? `${Math.round(activeEntry.pressure)} hPa` : '--'}
                  </span>
                ) : (
                  <span className="text-[9px] text-slate-600 italic">{t.scrubHint}</span>
                )}
              </div>

              <svg
                viewBox={`0 0 ${CHART_W} ${CHART_H}`}
                className="w-full h-40 overflow-visible cursor-crosshair rounded-xl focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400/60"
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
                aria-valuetext={activeEntry ? `${activeEntry.timeStr.slice(11, 16)} · ${activeEntry.pressure ?? '--'} hPa` : undefined}
                onKeyDown={handleKeyDown}
              >
                {dayMarkers.map(m => (
                  <line key={m.i} x1={idxToX(m.i)} y1={TOP_Y} x2={idxToX(m.i)} y2={BOTTOM_Y} stroke="#475569" strokeOpacity="0.4" strokeWidth="1" strokeDasharray="1 3" />
                ))}

                {areaPath && <path d={areaPath} fill="#818cf8" fillOpacity="0.12" />}
                {linePath && <path d={linePath} fill="none" stroke="#818cf8" strokeWidth="2" strokeLinecap="round" opacity="0.95" />}

                {steepestChange && (
                  <circle cx={idxToX(steepestChange.idx)} cy={pressureToY(windowEntries[steepestChange.idx].pressure ?? 0)} r="4" fill="#f43f5e" opacity="0.9" />
                )}

                {activeEntry && activeEntry.pressure !== null && (
                  <g style={{ transform: `translate(${idxToX(activeIndex)}px, ${pressureToY(activeEntry.pressure)}px)` }}>
                    {isScrubbing && <line y1={TOP_Y - pressureToY(activeEntry.pressure)} y2={BOTTOM_Y - pressureToY(activeEntry.pressure)} stroke="#818cf8" strokeWidth="1" strokeDasharray="2 2" opacity="0.4" />}
                    <circle r="6" fill="#818cf8" opacity="0.25" />
                    <circle r="3.5" fill="#fff" opacity="0.95" />
                  </g>
                )}
              </svg>
            </div>

            {/* TARGETES D'ESTADÍSTIQUES */}
            <StatsSection t={t} minPressure={minPressure} maxPressure={maxPressure} />
          </div>
        )}
      </div>
    </div>
  );
}

interface StatsSectionProps {
  t: Record<string, string>;
  minPressure: number | null;
  maxPressure: number | null;
}

const StatsSection = memo(function StatsSection({ t, minPressure, maxPressure }: StatsSectionProps) {
  return (
    <div className="grid grid-cols-2 gap-3">
      <StatCard label={t.minPressure} value={minPressure !== null ? `${Math.round(minPressure)}` : '--'} sub="hPa" icon={<Gauge className="w-3.5 h-3.5" />} />
      <StatCard label={t.maxPressure} value={maxPressure !== null ? `${Math.round(maxPressure)}` : '--'} sub="hPa" icon={<Gauge className="w-3.5 h-3.5" />} />
    </div>
  );
});
