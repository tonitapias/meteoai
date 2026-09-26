// src/components/StormModal.tsx
// Modal de detall del risc de tempesta — evolució horària del CAPE (48h) amb scrubbing,
// bandes de llindar de severitat i avís de pròxima finestra de risc convectiu. Totes les
// dades (cape, freezing_level_height, precipitation_probability) ja arriben amb la petita
// horària habitual — cap crida de xarxa addicional.
import { useState, useRef, useMemo, memo } from 'react';
import { X, Zap, Thermometer, Droplets, Clock3, AlertTriangle, CloudOff } from 'lucide-react';
import { ExtendedWeatherData } from '../types/weatherLogicTypes';
import { Language } from '../translations';
import { MATRIX_BG } from './widgets/widgetStyles';
import { StatCard } from './AstroStatCard';
import { useAstroModalShell } from '../hooks/useAstroModalShell';
import { WEATHER_THRESHOLDS } from '../constants/weatherConfig';

const { CAPE, ALERTS } = WEATHER_THRESHOLDS;

interface StormModalProps {
  weatherData: ExtendedWeatherData;
  onClose: () => void;
  lang?: Language;
}

// El CAPE horari només és fiable a curt termini — a diferència de l'astronomia (Sol/Lluna),
// no té sentit oferir-hi un selector de dies: una única finestra contínua de 48h n'hi ha prou.
const WINDOW_HOURS = 48;

const T: Record<Language, Record<string, string>> = {
  ca: {
    title: 'RISC DE TEMPESTA', subtitle: 'Observatori de Convecció', noData: 'SENSE DADES SUFICIENTS',
    capeNow: 'CAPE Actual', freezingLevel: 'Nivell de Congelació', evolution: 'Evolució',
    scrubHint: 'Toca o arrossega per explorar', nextWindow: 'Pròxima Finestra de Tempesta',
    activeNow: 'Actiu ara mateix', noRiskWindow: 'Sense risc previst en 48h', peakCape: 'Pic previst',
    in_: "D'aquí a", maxCape24: 'Màx. CAPE 24h', maxCape48: 'Màx. CAPE 48h', hoursAtRisk: 'Hores en Risc',
    unknown: 'Desconegut', stable: 'Estable', weak: 'Feble', moderate: 'Moderada', high: 'Alta', severe: 'Severa',
    rainChance: 'Prob. Pluja', now: 'ARA', hoursShort: 'h',
  },
  es: {
    title: 'RIESGO DE TORMENTA', subtitle: 'Observatorio de Convección', noData: 'DATOS INSUFICIENTES',
    capeNow: 'CAPE Actual', freezingLevel: 'Nivel de Congelación', evolution: 'Evolución',
    scrubHint: 'Toca o arrastra para explorar', nextWindow: 'Próxima Ventana de Tormenta',
    activeNow: 'Activo ahora mismo', noRiskWindow: 'Sin riesgo previsto en 48h', peakCape: 'Pico previsto',
    in_: 'Dentro de', maxCape24: 'Máx. CAPE 24h', maxCape48: 'Máx. CAPE 48h', hoursAtRisk: 'Horas en Riesgo',
    unknown: 'Desconocido', stable: 'Estable', weak: 'Débil', moderate: 'Moderada', high: 'Alta', severe: 'Severa',
    rainChance: 'Prob. Lluvia', now: 'AHORA', hoursShort: 'h',
  },
  en: {
    title: 'STORM RISK', subtitle: 'Convection Observatory', noData: 'INSUFFICIENT DATA',
    capeNow: 'Current CAPE', freezingLevel: 'Freezing Level', evolution: 'Evolution',
    scrubHint: 'Tap or drag to explore', nextWindow: 'Next Storm Window',
    activeNow: 'Active right now', noRiskWindow: 'No risk expected in 48h', peakCape: 'Expected peak',
    in_: 'In', maxCape24: 'Max CAPE 24h', maxCape48: 'Max CAPE 48h', hoursAtRisk: 'Hours at Risk',
    unknown: 'Unknown', stable: 'Stable', weak: 'Weak', moderate: 'Moderate', high: 'High', severe: 'Severe',
    rainChance: 'Rain Chance', now: 'NOW', hoursShort: 'h',
  },
  fr: {
    title: 'RISQUE D\'ORAGE', subtitle: 'Observatoire de Convection', noData: 'DONNÉES INSUFFISANTES',
    capeNow: 'CAPE Actuel', freezingLevel: 'Niveau de Congélation', evolution: 'Évolution',
    scrubHint: 'Touchez ou glissez pour explorer', nextWindow: 'Prochaine Fenêtre Orageuse',
    activeNow: "Actif en ce moment", noRiskWindow: 'Aucun risque prévu sous 48h', peakCape: 'Pic prévu',
    in_: 'Dans', maxCape24: 'Max CAPE 24h', maxCape48: 'Max CAPE 48h', hoursAtRisk: 'Heures à Risque',
    unknown: 'Inconnu', stable: 'Stable', weak: 'Faible', moderate: 'Modérée', high: 'Élevée', severe: 'Sévère',
    rainChance: 'Prob. Pluie', now: 'MAINTENANT', hoursShort: 'h',
  },
};

const getSafe = (arr: (number | null)[] | undefined, idx: number): number | null => {
  const v = Array.isArray(arr) ? arr[idx] : undefined;
  return typeof v === 'number' && !isNaN(v) ? v : null;
};

interface Severity { label: string; color: string; stroke: string; bgGlow: string; borderColor: string; }

function getSeverity(cape: number | null, t: Record<string, string>): Severity {
  if (cape === null) return { label: t.unknown, color: 'text-slate-500', stroke: '#64748b', bgGlow: 'from-slate-950/20 to-black/90', borderColor: 'border-slate-500/20' };
  if (cape >= CAPE.HIGH_STORM) return { label: t.severe, color: 'text-rose-500', stroke: '#f43f5e', bgGlow: 'from-rose-950/40 to-black/90', borderColor: 'border-rose-500/30' };
  if (cape >= ALERTS.CAPE_STORM) return { label: t.high, color: 'text-amber-400', stroke: '#fbbf24', bgGlow: 'from-amber-950/30 to-black/90', borderColor: 'border-amber-400/30' };
  if (cape >= CAPE.MIN_STORM) return { label: t.moderate, color: 'text-yellow-300', stroke: '#fde047', bgGlow: 'from-yellow-950/20 to-black/90', borderColor: 'border-yellow-400/20' };
  // Entre CAPE.WEAK i MIN_STORM l'aire és feblement inestable, no estable (vegeu weatherConfig.ts).
  if (cape >= CAPE.WEAK) return { label: t.weak, color: 'text-lime-300', stroke: '#bef264', bgGlow: 'from-lime-950/20 to-black/90', borderColor: 'border-lime-400/20' };
  return { label: t.stable, color: 'text-emerald-400', stroke: '#34d399', bgGlow: 'from-emerald-950/20 to-black/90', borderColor: 'border-emerald-500/20' };
}

// Geometria del gràfic (mateix viewBox que la trajectòria solar, per coherència visual)
const CHART_W = 400, CHART_H = 160, TOP_Y = 12, BOTTOM_Y = 140, PRECIP_STRIP_H = 18;

export default function StormModal({ weatherData, onClose, lang = 'ca' }: StormModalProps) {
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

  const hasData = currentHourIndex !== -1 && Array.isArray(hourly?.cape);

  // --- Finestra de 48h a partir de l'hora actual ---
  const windowEntries = useMemo(() => {
    if (!hasData) return [];
    const total = Array.isArray(hourly?.time) ? hourly.time.length : 0;
    const n = Math.min(WINDOW_HOURS, total - currentHourIndex);
    return Array.from({ length: Math.max(0, n) }, (_, i) => {
      const idx = currentHourIndex + i;
      return {
        idx,
        timeStr: String(hourly?.time?.[idx] ?? ''),
        cape: getSafe(hourly?.cape, idx),
        precipProb: getSafe(hourly?.precipitation_probability, idx),
        freezingLevel: getSafe(hourly?.freezing_level_height, idx),
      };
    });
  }, [hasData, hourly, currentHourIndex]);

  const N = windowEntries.length;

  const currentCape = N > 0 ? windowEntries[0].cape : null;
  const currentFreezingLevel = N > 0 ? windowEntries[0].freezingLevel : null;
  const severity = getSeverity(currentCape, t);

  // --- Estadístiques de la finestra ---
  const maxCape24 = useMemo(() => {
    const vals = windowEntries.slice(0, 24).map(e => e.cape).filter((v): v is number => v !== null);
    return vals.length > 0 ? Math.max(...vals) : null;
  }, [windowEntries]);

  const maxCape48 = useMemo(() => {
    const vals = windowEntries.map(e => e.cape).filter((v): v is number => v !== null);
    return vals.length > 0 ? Math.max(...vals) : null;
  }, [windowEntries]);

  const hoursAtRisk = useMemo(
    () => windowEntries.filter(e => e.cape !== null && e.cape >= CAPE.MIN_STORM).length,
    [windowEntries]
  );

  // --- Pròxima finestra de tempesta: primer tram contigu amb CAPE >= MIN_STORM ---
  const nextStormWindow = useMemo(() => {
    const startIdx = windowEntries.findIndex(e => e.cape !== null && e.cape >= CAPE.MIN_STORM);
    if (startIdx === -1) return null;
    const remaining = windowEntries.slice(startIdx);
    const runLength = remaining.findIndex(e => e.cape === null || e.cape < CAPE.MIN_STORM);
    const segment = runLength === -1 ? remaining : remaining.slice(0, runLength);
    const peak = Math.max(...segment.map(e => e.cape as number));
    const peakIdx = startIdx + segment.findIndex(e => e.cape === peak);
    return { startIdx, peak, peakIdx };
  }, [windowEntries]);

  // --- Scrub horitzontal sobre el gràfic (mateix patró RAF que l'arc solar) ---
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

  // --- Geometria del gràfic ---
  const yMax = useMemo(() => Math.max(CAPE.EXTREME, (maxCape48 ?? 0) * 1.05), [maxCape48]);
  const capeToY = (v: number) => BOTTOM_Y - (Math.max(0, Math.min(yMax, v)) / yMax) * (BOTTOM_Y - TOP_Y);
  const idxToX = (i: number) => N > 1 ? (i / (N - 1)) * CHART_W : 0;

  const areaPath = useMemo(() => {
    if (N === 0) return '';
    const pts = windowEntries.map((e, i) => `${idxToX(i)},${capeToY(e.cape ?? 0)}`);
    return `M 0,${BOTTOM_Y} L ${pts.join(' L ')} L ${CHART_W},${BOTTOM_Y} Z`;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [windowEntries, yMax, N]);

  const linePath = useMemo(() => {
    if (N === 0) return '';
    return windowEntries.map((e, i) => `${i === 0 ? 'M' : 'L'} ${idxToX(i)} ${capeToY(e.cape ?? 0)}`).join(' ');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [windowEntries, yMax, N]);

  // Marcadors de canvi de dia (mitjanit) dins la finestra, per orientar "avui/demà"
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
    <div role="dialog" aria-modal="true" aria-labelledby="storm-modal-title" className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-0 sm:p-4 md:p-6 landscape:p-0 landscape:sm:p-4 bg-black/95 backdrop-blur-3xl backdrop-saturate-150 animate-in fade-in duration-200">
      <style>{`
        .storm-scrollbar { -webkit-overflow-scrolling: touch; }
        .storm-scrollbar::-webkit-scrollbar { width: 5px; }
        .storm-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .storm-scrollbar::-webkit-scrollbar-thumb { background: rgba(244,63,94,0.2); border-radius: 8px; }
        .storm-scrollbar::-webkit-scrollbar-thumb:hover { background: rgba(244,63,94,0.4); }
      `}</style>

      <div className={`w-full h-[96dvh] sm:h-auto sm:max-h-[90dvh] landscape:h-[100dvh] landscape:sm:h-auto max-w-sm md:max-w-3xl lg:max-w-5xl flex flex-col min-h-0 bg-gradient-to-b ${bgGradient} rounded-t-[24px] sm:rounded-[32px] border-t sm:border ${severity.borderColor} shadow-[0_0_100px_rgba(0,0,0,0.9)] overflow-hidden relative animate-in slide-in-from-bottom-8 sm:zoom-in-95 duration-300`}>
        <div className={MATRIX_BG}></div>
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[130%] h-56 bg-gradient-to-b from-rose-500/10 via-orange-900/5 to-transparent blur-[80px] pointer-events-none z-0"></div>

        {/* Capçalera */}
        <div className="flex justify-between items-center shrink-0 relative z-20 p-4 md:p-6 border-b border-white/[0.04]">
          <div className="flex items-center gap-3">
            <div className={`relative flex items-center justify-center w-10 h-10 rounded-full border bg-black/40 ${severity.borderColor} ${severity.color}`}>
              <Zap className="w-5 h-5" />
              {hasData && currentCape !== null && currentCape >= CAPE.MIN_STORM && (
                <span className="absolute -top-1 -right-1 flex h-2.5 w-2.5">
                  <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${severity.color.replace('text-', 'bg-')}`}></span>
                  <span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${severity.color.replace('text-', 'bg-')}`}></span>
                </span>
              )}
            </div>
            <div className="flex flex-col">
              <h2 id="storm-modal-title" className="text-lg md:text-2xl font-black text-white tracking-tighter drop-shadow-md leading-none">{t.title}</h2>
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
          <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain storm-scrollbar relative z-10 p-4 md:p-6 space-y-6">

            {/* HEROI: CAPE actual + nivell de congelació */}
            <div className="relative rounded-2xl border border-white/5 bg-black/30 backdrop-blur-md p-5 flex flex-col sm:flex-row items-center gap-6">
              <div className="flex flex-col items-center sm:items-start gap-1">
                <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">{t.capeNow}</span>
                <span className={`text-5xl sm:text-6xl font-black tracking-tighter tabular-nums leading-none drop-shadow-xl ${severity.color}`}>
                  {currentCape !== null ? Math.round(currentCape) : '--'}
                </span>
                <span className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">J/kg</span>
              </div>
              <div className="flex flex-col items-center sm:items-start gap-2 flex-1">
                <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md border backdrop-blur-md bg-black/40 w-fit ${severity.borderColor}`}>
                  {currentCape !== null && currentCape >= CAPE.MIN_STORM && <AlertTriangle className={`w-3.5 h-3.5 ${severity.color}`} />}
                  <span className={`text-xs font-black uppercase tracking-wider ${severity.color}`}>{severity.label}</span>
                </div>
                <div className="flex items-center gap-2 mt-1 px-3 py-1.5 rounded-lg bg-black/40 border border-white/5">
                  <Thermometer className="w-3.5 h-3.5 text-sky-300" />
                  <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">{t.freezingLevel}</span>
                  <span className="text-xs font-mono font-bold text-sky-200">{currentFreezingLevel !== null ? `${Math.round(currentFreezingLevel)} m` : '--'}</span>
                </div>
              </div>
            </div>

            {/* AVÍS: pròxima finestra de tempesta */}
            <div className={`rounded-2xl border p-4 flex items-center gap-4 ${nextStormWindow ? severity.borderColor + ' bg-black/30' : 'border-white/5 bg-black/20'}`}>
              <div className={`shrink-0 w-10 h-10 rounded-full flex items-center justify-center border ${nextStormWindow ? `${severity.borderColor} ${severity.color} bg-black/40` : 'border-white/5 text-slate-500 bg-black/30'}`}>
                <Clock3 className="w-5 h-5" />
              </div>
              <div className="flex flex-col">
                <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">{t.nextWindow}</span>
                {nextStormWindow ? (
                  <span className={`text-sm font-bold ${severity.color}`}>
                    {nextStormWindow.startIdx === 0 ? t.activeNow : `${t.in_} ${nextStormWindow.startIdx}${t.hoursShort}`}
                    {' · '}{t.peakCape} {Math.round(nextStormWindow.peak)} J/kg
                  </span>
                ) : (
                  <span className="text-sm font-bold text-emerald-400">{t.noRiskWindow}</span>
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
                    {' · CAPE '}<span className={getSeverity(activeEntry.cape, t).color}>{activeEntry.cape !== null ? Math.round(activeEntry.cape) : '--'}</span>
                    {activeEntry.precipProb !== null && <> {' · '}{t.rainChance} {Math.round(activeEntry.precipProb)}%</>}
                  </span>
                ) : (
                  <span className="text-[9px] text-slate-600 italic">{t.scrubHint}</span>
                )}
              </div>

              <svg
                viewBox={`0 0 ${CHART_W} ${CHART_H}`}
                className="w-full h-40 overflow-visible cursor-crosshair rounded-xl focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-400/60"
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
                aria-valuetext={activeEntry ? `${activeEntry.timeStr.slice(11, 16)} · CAPE ${activeEntry.cape ?? '--'}` : undefined}
                onKeyDown={handleKeyDown}
              >
                {/* Bandes de llindar (fons) */}
                <line x1="0" y1={capeToY(CAPE.MIN_STORM)} x2={CHART_W} y2={capeToY(CAPE.MIN_STORM)} stroke="#fde047" strokeOpacity="0.25" strokeWidth="1" strokeDasharray="3 3" />
                <line x1="0" y1={capeToY(ALERTS.CAPE_STORM)} x2={CHART_W} y2={capeToY(ALERTS.CAPE_STORM)} stroke="#fbbf24" strokeOpacity="0.25" strokeWidth="1" strokeDasharray="3 3" />
                <line x1="0" y1={capeToY(CAPE.HIGH_STORM)} x2={CHART_W} y2={capeToY(CAPE.HIGH_STORM)} stroke="#f43f5e" strokeOpacity="0.3" strokeWidth="1" strokeDasharray="3 3" />

                {/* Marcadors de mitjanit */}
                {dayMarkers.map(m => (
                  <line key={m.i} x1={idxToX(m.i)} y1={TOP_Y} x2={idxToX(m.i)} y2={BOTTOM_Y} stroke="#475569" strokeOpacity="0.4" strokeWidth="1" strokeDasharray="1 3" />
                ))}

                {/* Àrea + línia de CAPE */}
                {areaPath && <path d={areaPath} fill={severity.stroke} fillOpacity="0.12" />}
                {linePath && <path d={linePath} fill="none" stroke={severity.stroke} strokeWidth="2" strokeLinecap="round" opacity="0.95" />}

                {/* Franja de probabilitat de pluja (base del gràfic) */}
                {windowEntries.map((e, i) => e.precipProb !== null && e.precipProb > 5 ? (
                  <rect
                    key={`precip-${i}`}
                    x={idxToX(i) - (CHART_W / N) / 2}
                    y={BOTTOM_Y - (e.precipProb / 100) * PRECIP_STRIP_H}
                    width={Math.max(1, CHART_W / N)}
                    height={(e.precipProb / 100) * PRECIP_STRIP_H}
                    fill="#38bdf8"
                    fillOpacity="0.25"
                  />
                ) : null)}

                {/* Marcador actiu (scrub o ara) */}
                {activeEntry && (
                  <g style={{ transform: `translate(${idxToX(activeIndex)}px, ${capeToY(activeEntry.cape ?? 0)}px)` }}>
                    {isScrubbing && <line y1={TOP_Y - capeToY(activeEntry.cape ?? 0)} y2={BOTTOM_Y - capeToY(activeEntry.cape ?? 0)} stroke={severity.stroke} strokeWidth="1" strokeDasharray="2 2" opacity="0.4" />}
                    <circle r="6" fill={severity.stroke} opacity="0.25" />
                    <circle r="3.5" fill="#fff" opacity="0.95" />
                  </g>
                )}
              </svg>
            </div>

            {/* TARGETES D'ESTADÍSTIQUES */}
            <StatsSection
              t={t}
              maxCape24={maxCape24}
              maxCape48={maxCape48}
              hoursAtRisk={hoursAtRisk}
              currentFreezingLevel={currentFreezingLevel}
            />
          </div>
        )}
      </div>
    </div>
  );
}

interface StatsSectionProps {
  t: Record<string, string>;
  maxCape24: number | null;
  maxCape48: number | null;
  hoursAtRisk: number;
  currentFreezingLevel: number | null;
}

const StatsSection = memo(function StatsSection({ t, maxCape24, maxCape48, hoursAtRisk, currentFreezingLevel }: StatsSectionProps) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      <StatCard label={t.maxCape24} value={maxCape24 !== null ? `${Math.round(maxCape24)}` : '--'} sub="J/kg" icon={<Zap className="w-3.5 h-3.5" />} />
      <StatCard label={t.maxCape48} value={maxCape48 !== null ? `${Math.round(maxCape48)}` : '--'} sub="J/kg" icon={<Zap className="w-3.5 h-3.5" />} />
      <StatCard label={t.hoursAtRisk} value={`${hoursAtRisk}${t.hoursShort}`} icon={<AlertTriangle className="w-3.5 h-3.5" />} />
      <StatCard label={t.freezingLevel} value={currentFreezingLevel !== null ? `${Math.round(currentFreezingLevel)} m` : '--'} icon={<Droplets className="w-3.5 h-3.5" />} />
    </div>
  );
});
