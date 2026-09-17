// src/components/VisibilityModal.tsx
// Modal de detall de la visibilitat — evolució horària (48h) amb scrubbing, les mateixes 4
// bandes que ja pinta VisibilityWidget.tsx (ara centralitzades a WEATHER_THRESHOLDS.VISIBILITY)
// i avís de la pròxima finestra de boira prevista. Reutilitza hourly.visibility, ja demanat a
// Open-Meteo — cap crida de xarxa nova.
import { useState, useRef, useMemo, memo } from 'react';
import { X, Eye, AlertTriangle, CloudOff } from 'lucide-react';
import { ExtendedWeatherData } from '../types/weatherLogicTypes';
import { Language } from '../translations';
import { MATRIX_BG } from './widgets/widgetStyles';
import { StatCard } from './AstroStatCard';
import { useAstroModalShell } from '../hooks/useAstroModalShell';
import { WEATHER_THRESHOLDS } from '../constants/weatherConfig';

const { VISIBILITY } = WEATHER_THRESHOLDS;

interface VisibilityModalProps {
  weatherData: ExtendedWeatherData;
  onClose: () => void;
  lang?: Language;
}

const WINDOW_HOURS = 48;

const T: Record<Language, Record<string, string>> = {
  ca: {
    title: 'VISIBILITAT', subtitle: 'Observatori de Boira', noData: 'SENSE DADES SUFICIENTS',
    visNow: 'Visibilitat Actual', evolution: 'Evolució', scrubHint: 'Toca o arrossega per explorar',
    fogWindow: 'Avís de Boira', activeNow: 'Activa ara mateix', noFog: 'Sense boira prevista en 48h',
    minVisPeak: 'Mínim previst', in_: "D'aquí a", minVis: 'Visibilitat Mín. 48h',
    hoursReduced: 'Hores amb Visibilitat Reduïda', now: 'ARA', hoursShort: 'h',
    excellent: "Excel·lent", good: 'Bona', haze: 'Calitja', fog: 'Boira', unknown: 'Desconegut',
  },
  es: {
    title: 'VISIBILIDAD', subtitle: 'Observatorio de Niebla', noData: 'DATOS INSUFICIENTES',
    visNow: 'Visibilidad Actual', evolution: 'Evolución', scrubHint: 'Toca o arrastra para explorar',
    fogWindow: 'Aviso de Niebla', activeNow: 'Activa ahora mismo', noFog: 'Sin niebla prevista en 48h',
    minVisPeak: 'Mínimo previsto', in_: 'Dentro de', minVis: 'Visibilidad Mín. 48h',
    hoursReduced: 'Horas con Visibilidad Reducida', now: 'AHORA', hoursShort: 'h',
    excellent: 'Excelente', good: 'Buena', haze: 'Calima', fog: 'Niebla', unknown: 'Desconocido',
  },
  en: {
    title: 'VISIBILITY', subtitle: 'Fog Observatory', noData: 'INSUFFICIENT DATA',
    visNow: 'Current Visibility', evolution: 'Evolution', scrubHint: 'Tap or drag to explore',
    fogWindow: 'Fog Warning', activeNow: 'Active right now', noFog: 'No fog expected in 48h',
    minVisPeak: 'Expected minimum', in_: 'In', minVis: 'Min Visibility 48h',
    hoursReduced: 'Hours with Reduced Visibility', now: 'NOW', hoursShort: 'h',
    excellent: 'Excellent', good: 'Good', haze: 'Haze', fog: 'Fog', unknown: 'Unknown',
  },
  fr: {
    title: 'VISIBILITÉ', subtitle: 'Observatoire de Brouillard', noData: 'DONNÉES INSUFFISANTES',
    visNow: 'Visibilité Actuelle', evolution: 'Évolution', scrubHint: 'Touchez ou glissez pour explorer',
    fogWindow: 'Alerte Brouillard', activeNow: 'Active en ce moment', noFog: "Aucun brouillard prévu sous 48h",
    minVisPeak: 'Minimum prévu', in_: 'Dans', minVis: 'Visibilité Min 48h',
    hoursReduced: 'Heures à Visibilité Réduite', now: 'MAINTENANT', hoursShort: 'h',
    excellent: 'Excellente', good: 'Bonne', haze: 'Brume', fog: 'Brouillard', unknown: 'Inconnu',
  },
};

const getSafe = (arr: (number | null)[] | undefined, idx: number): number | null => {
  const v = Array.isArray(arr) ? arr[idx] : undefined;
  return typeof v === 'number' && !isNaN(v) ? v : null;
};

interface Severity { label: string; color: string; stroke: string; borderColor: string; bgGlow: string; }

function getVisibilitySeverity(visM: number | null, t: Record<string, string>): Severity {
  if (visM === null) return { label: t.unknown, color: 'text-slate-500', stroke: '#64748b', borderColor: 'border-slate-500/20', bgGlow: 'from-slate-950/20 to-black/90' };
  if (visM < VISIBILITY.FOG) return { label: t.fog, color: 'text-rose-500', stroke: '#f43f5e', borderColor: 'border-rose-500/30', bgGlow: 'from-rose-950/30 to-black/90' };
  if (visM < VISIBILITY.HAZE) return { label: t.haze, color: 'text-amber-400', stroke: '#fbbf24', borderColor: 'border-amber-400/30', bgGlow: 'from-amber-950/30 to-black/90' };
  if (visM < VISIBILITY.GOOD) return { label: t.good, color: 'text-sky-400', stroke: '#38bdf8', borderColor: 'border-sky-500/20', bgGlow: 'from-sky-950/20 to-black/90' };
  return { label: t.excellent, color: 'text-emerald-400', stroke: '#34d399', borderColor: 'border-emerald-500/20', bgGlow: 'from-emerald-950/20 to-black/90' };
}

const CHART_W = 400, CHART_H = 160, TOP_Y = 12, BOTTOM_Y = 140;

export default function VisibilityModal({ weatherData, onClose, lang = 'ca' }: VisibilityModalProps) {
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

  const hasData = currentHourIndex !== -1 && Array.isArray(hourly?.visibility);

  const windowEntries = useMemo(() => {
    if (!hasData || !hourly) return [];
    const total = Array.isArray(hourly.time) ? hourly.time.length : 0;
    const n = Math.min(WINDOW_HOURS, total - currentHourIndex);
    return Array.from({ length: Math.max(0, n) }, (_, i) => {
      const idx = currentHourIndex + i;
      return { idx, timeStr: String(hourly.time?.[idx] ?? ''), visibility: getSafe(hourly.visibility, idx) };
    });
  }, [hasData, hourly, currentHourIndex]);

  const N = windowEntries.length;

  // Prioritzem el valor "ara" del bloc current (mateixa font que VisibilityWidget al
  // dashboard) — hourly[hora actual] pot diferir lleugerament, vegeu la lliçó de Pressió/Confort.
  const currentVisibility = typeof current?.visibility === 'number' ? current.visibility : (N > 0 ? windowEntries[0].visibility : null);
  const severity = getVisibilitySeverity(currentVisibility, t);

  const minVisibility = useMemo(() => {
    const vals = windowEntries.map(e => e.visibility).filter((v): v is number => v !== null);
    return vals.length > 0 ? Math.min(...vals) : null;
  }, [windowEntries]);

  const hoursReduced = useMemo(
    () => windowEntries.filter(e => e.visibility !== null && e.visibility < VISIBILITY.HAZE).length,
    [windowEntries]
  );

  // --- Pròxima finestra de boira: primer tram contigu amb visibilitat < FOG ---
  const nextFogWindow = useMemo(() => {
    const startIdx = windowEntries.findIndex(e => e.visibility !== null && e.visibility < VISIBILITY.FOG);
    if (startIdx === -1) return null;
    const remaining = windowEntries.slice(startIdx);
    const runLength = remaining.findIndex(e => e.visibility === null || e.visibility >= VISIBILITY.FOG);
    const segment = runLength === -1 ? remaining : remaining.slice(0, runLength);
    const min = Math.min(...segment.map(e => e.visibility as number));
    const minIdx = startIdx + segment.findIndex(e => e.visibility === min);
    return { startIdx, min, minIdx };
  }, [windowEntries]);

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
  const displayVisibility = isScrubbing ? activeEntry?.visibility ?? null : currentVisibility;

  // --- Geometria del gràfic: km en un eix log-friendly simple, tallat a 15km (per sobre de
  // GOOD ja és "excel·lent" indistintament) ---
  const CHART_MAX_M = 15000;
  const visToY = (v: number) => BOTTOM_Y - (Math.max(0, Math.min(CHART_MAX_M, v)) / CHART_MAX_M) * (BOTTOM_Y - TOP_Y);
  const idxToX = (i: number) => N > 1 ? (i / (N - 1)) * CHART_W : 0;

  const areaPath = useMemo(() => {
    if (N === 0) return '';
    const pts = windowEntries.map((e, i) => `${idxToX(i)},${visToY(e.visibility ?? 0)}`);
    return `M 0,${BOTTOM_Y} L ${pts.join(' L ')} L ${CHART_W},${BOTTOM_Y} Z`;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [windowEntries, N]);

  const linePath = useMemo(() => {
    if (N === 0) return '';
    return windowEntries
      .map((e, i) => (e.visibility !== null ? `${i === 0 ? 'M' : 'L'} ${idxToX(i)} ${visToY(e.visibility)}` : null))
      .filter((s): s is string => s !== null)
      .join(' ');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [windowEntries, N]);

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
    <div role="dialog" aria-modal="true" aria-labelledby="visibility-modal-title" className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-0 sm:p-4 md:p-6 landscape:p-0 landscape:sm:p-4 bg-black/95 backdrop-blur-3xl backdrop-saturate-150 animate-in fade-in duration-200">
      <style>{`
        .visibility-scrollbar { -webkit-overflow-scrolling: touch; }
        .visibility-scrollbar::-webkit-scrollbar { width: 5px; }
        .visibility-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .visibility-scrollbar::-webkit-scrollbar-thumb { background: rgba(56,189,248,0.2); border-radius: 8px; }
        .visibility-scrollbar::-webkit-scrollbar-thumb:hover { background: rgba(56,189,248,0.4); }
      `}</style>

      <div className={`w-full h-[96dvh] sm:h-auto sm:max-h-[90dvh] landscape:h-[100dvh] landscape:sm:h-auto max-w-sm md:max-w-3xl lg:max-w-5xl flex flex-col min-h-0 bg-gradient-to-b ${bgGradient} rounded-t-[24px] sm:rounded-[32px] border-t sm:border ${severity.borderColor} shadow-[0_0_100px_rgba(0,0,0,0.9)] overflow-hidden relative animate-in slide-in-from-bottom-8 sm:zoom-in-95 duration-300`}>
        <div className={MATRIX_BG}></div>
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[130%] h-56 bg-gradient-to-b from-sky-500/10 via-slate-900/5 to-transparent blur-[80px] pointer-events-none z-0"></div>

        {/* Capçalera */}
        <div className="flex justify-between items-center shrink-0 relative z-20 p-4 md:p-6 border-b border-white/[0.04]">
          <div className="flex items-center gap-3">
            <div className={`relative flex items-center justify-center w-10 h-10 rounded-full border bg-black/40 ${severity.borderColor} ${severity.color}`}>
              <Eye className="w-5 h-5" />
            </div>
            <div className="flex flex-col">
              <h2 id="visibility-modal-title" className="text-lg md:text-2xl font-black text-white tracking-tighter drop-shadow-md leading-none">{t.title}</h2>
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
          <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain visibility-scrollbar relative z-10 p-4 md:p-6 space-y-6">

            {/* HEROI: visibilitat actual */}
            <div className="relative rounded-2xl border border-white/5 bg-black/30 backdrop-blur-md p-5 flex flex-col sm:flex-row items-center gap-6">
              <div className="flex flex-col items-center sm:items-start gap-1">
                <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">{t.visNow}</span>
                <span className={`text-5xl sm:text-6xl font-black tracking-tighter tabular-nums leading-none drop-shadow-xl ${severity.color}`}>
                  {currentVisibility !== null ? (currentVisibility / 1000).toFixed(1).replace('.0', '') : '--'}
                </span>
                <span className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">km</span>
              </div>
              <div className="flex flex-col items-center sm:items-start gap-2 flex-1">
                <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md border backdrop-blur-md bg-black/40 w-fit ${severity.borderColor}`}>
                  {currentVisibility !== null && currentVisibility < VISIBILITY.FOG && <AlertTriangle className={`w-3.5 h-3.5 ${severity.color}`} />}
                  <span className={`text-xs font-black uppercase tracking-wider ${severity.color}`}>{severity.label}</span>
                </div>
              </div>
            </div>

            {/* AVÍS: pròxima finestra de boira */}
            <div className={`rounded-2xl border p-4 flex items-center gap-4 ${nextFogWindow ? severity.borderColor + ' bg-black/30' : 'border-white/5 bg-black/20'}`}>
              <div className={`shrink-0 w-10 h-10 rounded-full flex items-center justify-center border ${nextFogWindow ? `${severity.borderColor} ${severity.color} bg-black/40` : 'border-white/5 text-slate-500 bg-black/30'}`}>
                <Eye className="w-5 h-5" />
              </div>
              <div className="flex flex-col">
                <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">{t.fogWindow}</span>
                {nextFogWindow ? (
                  <span className={`text-sm font-bold ${severity.color}`}>
                    {nextFogWindow.startIdx === 0 ? t.activeNow : `${t.in_} ${nextFogWindow.startIdx}${t.hoursShort}`}
                    {' · '}{t.minVisPeak} {(nextFogWindow.min / 1000).toFixed(1).replace('.0', '')} km
                  </span>
                ) : (
                  <span className="text-sm font-bold text-emerald-400">{t.noFog}</span>
                )}
              </div>
            </div>

            {/* GRÀFIC D'EVOLUCIÓ (scrubbable) */}
            <div className="relative rounded-2xl border border-white/5 bg-black/30 backdrop-blur-md p-4 overflow-hidden">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-2 sm:mb-1 relative z-10 gap-0.5 sm:gap-2">
                <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 shrink-0">
                  {t.evolution} · {WINDOW_HOURS}h
                </span>
                {activeEntry ? (
                  <span className="text-[11px] font-mono font-bold text-slate-200">
                    {isScrubbing ? activeEntry.timeStr.slice(11, 16) : t.now}
                    {' · '}<span className={getVisibilitySeverity(displayVisibility, t).color}>{displayVisibility !== null ? (displayVisibility / 1000).toFixed(1).replace('.0', '') : '--'} km</span>
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
                aria-valuetext={activeEntry ? `${activeEntry.timeStr.slice(11, 16)} · ${activeEntry.visibility ?? '--'} m` : undefined}
                onKeyDown={handleKeyDown}
              >
                <line x1="0" y1={visToY(VISIBILITY.FOG)} x2={CHART_W} y2={visToY(VISIBILITY.FOG)} stroke="#f43f5e" strokeOpacity="0.3" strokeWidth="1" strokeDasharray="3 3" />
                <line x1="0" y1={visToY(VISIBILITY.HAZE)} x2={CHART_W} y2={visToY(VISIBILITY.HAZE)} stroke="#fbbf24" strokeOpacity="0.25" strokeWidth="1" strokeDasharray="3 3" />
                <line x1="0" y1={visToY(VISIBILITY.GOOD)} x2={CHART_W} y2={visToY(VISIBILITY.GOOD)} stroke="#38bdf8" strokeOpacity="0.25" strokeWidth="1" strokeDasharray="3 3" />

                {dayMarkers.map(m => (
                  <line key={m.i} x1={idxToX(m.i)} y1={TOP_Y} x2={idxToX(m.i)} y2={BOTTOM_Y} stroke="#475569" strokeOpacity="0.4" strokeWidth="1" strokeDasharray="1 3" />
                ))}

                {areaPath && <path d={areaPath} fill={severity.stroke} fillOpacity="0.12" />}
                {linePath && <path d={linePath} fill="none" stroke={severity.stroke} strokeWidth="2" strokeLinecap="round" opacity="0.95" />}

                {activeEntry && activeEntry.visibility !== null && (
                  <g style={{ transform: `translate(${idxToX(activeIndex)}px, ${visToY(activeEntry.visibility)}px)` }}>
                    {isScrubbing && <line y1={TOP_Y - visToY(activeEntry.visibility)} y2={BOTTOM_Y - visToY(activeEntry.visibility)} stroke={severity.stroke} strokeWidth="1" strokeDasharray="2 2" opacity="0.4" />}
                    <circle r="6" fill={severity.stroke} opacity="0.25" />
                    <circle r="3.5" fill="#fff" opacity="0.95" />
                  </g>
                )}
              </svg>
            </div>

            {/* TARGETES D'ESTADÍSTIQUES */}
            <StatsSection t={t} minVisibility={minVisibility} hoursReduced={hoursReduced} />
          </div>
        )}
      </div>
    </div>
  );
}

interface StatsSectionProps {
  t: Record<string, string>;
  minVisibility: number | null;
  hoursReduced: number;
}

const StatsSection = memo(function StatsSection({ t, minVisibility, hoursReduced }: StatsSectionProps) {
  return (
    <div className="grid grid-cols-2 gap-3">
      <StatCard label={t.minVis} value={minVisibility !== null ? `${(minVisibility / 1000).toFixed(1).replace('.0', '')} km` : '--'} icon={<Eye className="w-3.5 h-3.5" />} />
      <StatCard label={t.hoursReduced} value={`${hoursReduced}${t.hoursShort}`} icon={<AlertTriangle className="w-3.5 h-3.5" />} />
    </div>
  );
});
