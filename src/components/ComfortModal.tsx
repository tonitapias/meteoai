// src/components/ComfortModal.tsx
// Modal de detall del confort atmosfèric — evolució horària (48h) del punt de rosada amb
// scrubbing, classificació segons l'escala de confort del NWS i finestra de xafogor prevista.
// Reutilitza hourly.dew_point_2m/relative_humidity_2m, ja demanats a Open-Meteo — cap crida
// de xarxa nova.
import { useState, useRef, useMemo, memo } from 'react';
import { X, Droplets, AlertTriangle, CloudOff } from 'lucide-react';
import { ExtendedWeatherData } from '../types/weatherLogicTypes';
import { Language } from '../translations';
import { MATRIX_BG } from './widgets/widgetStyles';
import { StatCard } from './AstroStatCard';
import { useAstroModalShell } from '../hooks/useAstroModalShell';
import { WEATHER_THRESHOLDS } from '../constants/weatherConfig';

const { DEW_POINT } = WEATHER_THRESHOLDS;

interface ComfortModalProps {
  weatherData: ExtendedWeatherData;
  currentDewPoint: number | undefined;
  onClose: () => void;
  lang?: Language;
}

const WINDOW_HOURS = 48;

const T: Record<Language, Record<string, string>> = {
  ca: {
    title: 'ÍNDEX DE CONFORT', subtitle: 'Observatori de Xafogor', noData: 'SENSE DADES SUFICIENTS',
    dewPointNow: 'Punt de Rosada Actual', humidity: 'Humitat', evolution: 'Evolució',
    scrubHint: 'Toca o arrossega per explorar', comfortWindow: 'Finestra de Xafogor',
    activeNow: 'Activa ara mateix', noDiscomfort: 'Sense xafogor prevista en 48h', peakDewPoint: 'Pic previst',
    in_: "D'aquí a", maxDewPoint: 'Punt de Rosada Màx. 48h', currentHumidity: 'Humitat Actual',
    hoursSticky: 'Hores amb Xafogor', now: 'ARA', hoursShort: 'h',
    dry: 'Sec', comfortable: 'Còmode', sticky: 'Humit', oppressive: 'Opressiu', veryOppressive: 'Molt Opressiu', unknown: 'Desconegut',
  },
  es: {
    title: 'ÍNDICE DE CONFORT', subtitle: 'Observatorio de Bochorno', noData: 'DATOS INSUFICIENTES',
    dewPointNow: 'Punto de Rocío Actual', humidity: 'Humedad', evolution: 'Evolución',
    scrubHint: 'Toca o arrastra para explorar', comfortWindow: 'Ventana de Bochorno',
    activeNow: 'Activa ahora mismo', noDiscomfort: 'Sin bochorno previsto en 48h', peakDewPoint: 'Pico previsto',
    in_: 'Dentro de', maxDewPoint: 'Punto de Rocío Máx. 48h', currentHumidity: 'Humedad Actual',
    hoursSticky: 'Horas con Bochorno', now: 'AHORA', hoursShort: 'h',
    dry: 'Seco', comfortable: 'Cómodo', sticky: 'Húmedo', oppressive: 'Opresivo', veryOppressive: 'Muy Opresivo', unknown: 'Desconocido',
  },
  en: {
    title: 'COMFORT INDEX', subtitle: 'Mugginess Observatory', noData: 'INSUFFICIENT DATA',
    dewPointNow: 'Current Dew Point', humidity: 'Humidity', evolution: 'Evolution',
    scrubHint: 'Tap or drag to explore', comfortWindow: 'Muggy Window',
    activeNow: 'Active right now', noDiscomfort: 'No mugginess expected in 48h', peakDewPoint: 'Expected peak',
    in_: 'In', maxDewPoint: 'Max Dew Point 48h', currentHumidity: 'Current Humidity',
    hoursSticky: 'Muggy Hours', now: 'NOW', hoursShort: 'h',
    dry: 'Dry', comfortable: 'Comfortable', sticky: 'Sticky', oppressive: 'Oppressive', veryOppressive: 'Very Oppressive', unknown: 'Unknown',
  },
  fr: {
    title: 'INDICE DE CONFORT', subtitle: "Observatoire d'Humidité", noData: 'DONNÉES INSUFFISANTES',
    dewPointNow: 'Point de Rosée Actuel', humidity: 'Humidité', evolution: 'Évolution',
    scrubHint: 'Touchez ou glissez pour explorer', comfortWindow: "Fenêtre d'Humidité",
    activeNow: 'Active en ce moment', noDiscomfort: "Aucune moiteur prévue sous 48h", peakDewPoint: 'Pic prévu',
    in_: 'Dans', maxDewPoint: 'Point de Rosée Max 48h', currentHumidity: 'Humidité Actuelle',
    hoursSticky: "Heures d'Humidité", now: 'MAINTENANT', hoursShort: 'h',
    dry: 'Sec', comfortable: 'Confortable', sticky: 'Collant', oppressive: 'Oppressant', veryOppressive: 'Très Oppressant', unknown: 'Inconnu',
  },
};

const getSafe = (arr: (number | null)[] | undefined, idx: number): number | null => {
  const v = Array.isArray(arr) ? arr[idx] : undefined;
  return typeof v === 'number' && !isNaN(v) ? v : null;
};

interface Severity { label: string; color: string; stroke: string; borderColor: string; bgGlow: string; }

function getComfortSeverity(dewPoint: number | null, t: Record<string, string>): Severity {
  if (dewPoint === null) return { label: t.unknown, color: 'text-slate-500', stroke: '#64748b', borderColor: 'border-slate-500/20', bgGlow: 'from-slate-950/20 to-black/90' };
  if (dewPoint > DEW_POINT.OPPRESSIVE) return { label: t.veryOppressive, color: 'text-rose-500', stroke: '#f43f5e', borderColor: 'border-rose-500/30', bgGlow: 'from-rose-950/30 to-black/90' };
  if (dewPoint > DEW_POINT.STICKY) return { label: t.oppressive, color: 'text-orange-500', stroke: '#f97316', borderColor: 'border-orange-500/30', bgGlow: 'from-orange-950/30 to-black/90' };
  if (dewPoint > DEW_POINT.COMFORTABLE) return { label: t.sticky, color: 'text-yellow-300', stroke: '#fde047', borderColor: 'border-yellow-400/20', bgGlow: 'from-yellow-950/20 to-black/90' };
  if (dewPoint > DEW_POINT.DRY) return { label: t.comfortable, color: 'text-emerald-400', stroke: '#34d399', borderColor: 'border-emerald-500/20', bgGlow: 'from-emerald-950/20 to-black/90' };
  return { label: t.dry, color: 'text-cyan-400', stroke: '#22d3ee', borderColor: 'border-cyan-500/20', bgGlow: 'from-cyan-950/20 to-black/90' };
}

const CHART_W = 400, CHART_H = 160, TOP_Y = 12, BOTTOM_Y = 140;

export default function ComfortModal({ weatherData, currentDewPoint: currentDewPointProp, onClose, lang = 'ca' }: ComfortModalProps) {
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

  const hasData = currentHourIndex !== -1 && Array.isArray(hourly?.dew_point_2m);

  const windowEntries = useMemo(() => {
    if (!hasData || !hourly) return [];
    const total = Array.isArray(hourly.time) ? hourly.time.length : 0;
    const n = Math.min(WINDOW_HOURS, total - currentHourIndex);
    return Array.from({ length: Math.max(0, n) }, (_, i) => {
      const idx = currentHourIndex + i;
      return {
        idx,
        timeStr: String(hourly.time?.[idx] ?? ''),
        dewPoint: getSafe(hourly.dew_point_2m, idx),
        humidity: getSafe(hourly.relative_humidity_2m, idx),
      };
    });
  }, [hasData, hourly, currentHourIndex]);

  const N = windowEntries.length;

  // Prioritzem el valor "ara" calculat des del bloc current (lectura viva, mateix que
  // DewPointWidget al dashboard) — hourly[hora actual] és una mostra a hora en punt i pot
  // diferir lleugerament, cosa que faria que el giny i el modal mostressin números diferents.
  const currentDewPoint = typeof currentDewPointProp === 'number' ? currentDewPointProp : (N > 0 ? windowEntries[0].dewPoint : null);
  const currentHumidity = typeof current?.relative_humidity_2m === 'number' ? current.relative_humidity_2m : (N > 0 ? windowEntries[0].humidity : null);
  const severity = getComfortSeverity(currentDewPoint, t);

  const maxDewPoint = useMemo(() => {
    const vals = windowEntries.map(e => e.dewPoint).filter((v): v is number => v !== null);
    return vals.length > 0 ? Math.max(...vals) : null;
  }, [windowEntries]);

  const hoursSticky = useMemo(
    () => windowEntries.filter(e => e.dewPoint !== null && e.dewPoint >= DEW_POINT.COMFORTABLE).length,
    [windowEntries]
  );

  // --- Pròxima finestra de xafogor: primer tram contigu amb punt de rosada >= COMFORTABLE ---
  const nextComfortWindow = useMemo(() => {
    for (let i = 0; i < N; i++) {
      const e = windowEntries[i];
      if (e.dewPoint !== null && e.dewPoint >= DEW_POINT.COMFORTABLE) {
        let peak = e.dewPoint, peakIdx = i, j = i;
        while (j < N && windowEntries[j].dewPoint !== null && (windowEntries[j].dewPoint as number) >= DEW_POINT.COMFORTABLE) {
          const v = windowEntries[j].dewPoint as number;
          if (v > peak) { peak = v; peakIdx = j; }
          j++;
        }
        return { startIdx: i, peak, peakIdx };
      }
    }
    return null;
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

  // --- Geometria del gràfic ---
  const yMax = useMemo(() => Math.max(DEW_POINT.OPPRESSIVE + 4, (maxDewPoint ?? 0) + 3), [maxDewPoint]);
  const yMin = -5;
  const dewToY = (v: number) => BOTTOM_Y - ((Math.max(yMin, Math.min(yMax, v)) - yMin) / (yMax - yMin)) * (BOTTOM_Y - TOP_Y);
  const idxToX = (i: number) => N > 1 ? (i / (N - 1)) * CHART_W : 0;

  const areaPath = useMemo(() => {
    if (N === 0) return '';
    const pts = windowEntries.map((e, i) => `${idxToX(i)},${dewToY(e.dewPoint ?? yMin)}`);
    return `M 0,${BOTTOM_Y} L ${pts.join(' L ')} L ${CHART_W},${BOTTOM_Y} Z`;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [windowEntries, yMax, N]);

  const linePath = useMemo(() => {
    if (N === 0) return '';
    return windowEntries
      .map((e, i) => (e.dewPoint !== null ? `${i === 0 ? 'M' : 'L'} ${idxToX(i)} ${dewToY(e.dewPoint)}` : null))
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
    <div role="dialog" aria-modal="true" aria-labelledby="comfort-modal-title" className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-0 sm:p-4 md:p-6 landscape:p-0 landscape:sm:p-4 bg-black/95 backdrop-blur-3xl backdrop-saturate-150 animate-in fade-in duration-200">
      <style>{`
        .comfort-scrollbar { -webkit-overflow-scrolling: touch; }
        .comfort-scrollbar::-webkit-scrollbar { width: 5px; }
        .comfort-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .comfort-scrollbar::-webkit-scrollbar-thumb { background: rgba(34,211,238,0.2); border-radius: 8px; }
        .comfort-scrollbar::-webkit-scrollbar-thumb:hover { background: rgba(34,211,238,0.4); }
      `}</style>

      <div className={`w-full h-[96dvh] sm:h-auto sm:max-h-[90dvh] landscape:h-[100dvh] landscape:sm:h-auto max-w-sm md:max-w-3xl lg:max-w-5xl flex flex-col min-h-0 bg-gradient-to-b ${bgGradient} rounded-t-[24px] sm:rounded-[32px] border-t sm:border ${severity.borderColor} shadow-[0_0_100px_rgba(0,0,0,0.9)] overflow-hidden relative animate-in slide-in-from-bottom-8 sm:zoom-in-95 duration-300`}>
        <div className={MATRIX_BG}></div>
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[130%] h-56 bg-gradient-to-b from-cyan-500/10 via-emerald-900/5 to-transparent blur-[80px] pointer-events-none z-0"></div>

        {/* Capçalera */}
        <div className="flex justify-between items-center shrink-0 relative z-20 p-4 md:p-6 border-b border-white/[0.04]">
          <div className="flex items-center gap-3">
            <div className={`relative flex items-center justify-center w-10 h-10 rounded-full border bg-black/40 ${severity.borderColor} ${severity.color}`}>
              <Droplets className="w-5 h-5" />
            </div>
            <div className="flex flex-col">
              <h2 id="comfort-modal-title" className="text-lg md:text-2xl font-black text-white tracking-tighter drop-shadow-md leading-none">{t.title}</h2>
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
          <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain comfort-scrollbar relative z-10 p-4 md:p-6 space-y-6">

            {/* HEROI: punt de rosada actual + humitat */}
            <div className="relative rounded-2xl border border-white/5 bg-black/30 backdrop-blur-md p-5 flex flex-col sm:flex-row items-center gap-6">
              <div className="flex flex-col items-center sm:items-start gap-1">
                <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">{t.dewPointNow}</span>
                <span className={`text-5xl sm:text-6xl font-black tracking-tighter tabular-nums leading-none drop-shadow-xl ${severity.color}`}>
                  {currentDewPoint !== null ? Math.round(currentDewPoint) : '--'}°
                </span>
              </div>
              <div className="flex flex-col items-center sm:items-start gap-2 flex-1">
                <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md border backdrop-blur-md bg-black/40 w-fit ${severity.borderColor}`}>
                  {currentDewPoint !== null && currentDewPoint >= DEW_POINT.COMFORTABLE && <AlertTriangle className={`w-3.5 h-3.5 ${severity.color}`} />}
                  <span className={`text-xs font-black uppercase tracking-wider ${severity.color}`}>{severity.label}</span>
                </div>
                <div className="flex items-center gap-2 mt-1 px-3 py-1.5 rounded-lg bg-black/40 border border-white/5">
                  <Droplets className="w-3.5 h-3.5 text-cyan-300" />
                  <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">{t.humidity}</span>
                  <span className="text-xs font-mono font-bold text-cyan-200">{currentHumidity !== null ? `${Math.round(currentHumidity)}%` : '--'}</span>
                </div>
              </div>
            </div>

            {/* AVÍS: pròxima finestra de xafogor */}
            <div className={`rounded-2xl border p-4 flex items-center gap-4 ${nextComfortWindow ? severity.borderColor + ' bg-black/30' : 'border-white/5 bg-black/20'}`}>
              <div className={`shrink-0 w-10 h-10 rounded-full flex items-center justify-center border ${nextComfortWindow ? `${severity.borderColor} ${severity.color} bg-black/40` : 'border-white/5 text-slate-500 bg-black/30'}`}>
                <Droplets className="w-5 h-5" />
              </div>
              <div className="flex flex-col">
                <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">{t.comfortWindow}</span>
                {nextComfortWindow ? (
                  <span className={`text-sm font-bold ${severity.color}`}>
                    {nextComfortWindow.startIdx === 0 ? t.activeNow : `${t.in_} ${nextComfortWindow.startIdx}${t.hoursShort}`}
                    {' · '}{t.peakDewPoint} {Math.round(nextComfortWindow.peak)}°
                  </span>
                ) : (
                  <span className="text-sm font-bold text-emerald-400">{t.noDiscomfort}</span>
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
                    {' · '}<span className={getComfortSeverity(isScrubbing ? activeEntry.dewPoint : currentDewPoint, t).color}>{(isScrubbing ? activeEntry.dewPoint : currentDewPoint) !== null ? Math.round((isScrubbing ? activeEntry.dewPoint : currentDewPoint) as number) : '--'}°</span>
                    {(isScrubbing ? activeEntry.humidity : currentHumidity) !== null && <> {' · '}{t.humidity} {Math.round((isScrubbing ? activeEntry.humidity : currentHumidity) as number)}%</>}
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
                aria-valuetext={activeEntry ? `${activeEntry.timeStr.slice(11, 16)} · ${activeEntry.dewPoint ?? '--'}°` : undefined}
                onKeyDown={handleKeyDown}
              >
                <line x1="0" y1={dewToY(DEW_POINT.COMFORTABLE)} x2={CHART_W} y2={dewToY(DEW_POINT.COMFORTABLE)} stroke="#fde047" strokeOpacity="0.25" strokeWidth="1" strokeDasharray="3 3" />
                <line x1="0" y1={dewToY(DEW_POINT.STICKY)} x2={CHART_W} y2={dewToY(DEW_POINT.STICKY)} stroke="#f97316" strokeOpacity="0.25" strokeWidth="1" strokeDasharray="3 3" />
                <line x1="0" y1={dewToY(DEW_POINT.OPPRESSIVE)} x2={CHART_W} y2={dewToY(DEW_POINT.OPPRESSIVE)} stroke="#f43f5e" strokeOpacity="0.3" strokeWidth="1" strokeDasharray="3 3" />

                {dayMarkers.map(m => (
                  <line key={m.i} x1={idxToX(m.i)} y1={TOP_Y} x2={idxToX(m.i)} y2={BOTTOM_Y} stroke="#475569" strokeOpacity="0.4" strokeWidth="1" strokeDasharray="1 3" />
                ))}

                {areaPath && <path d={areaPath} fill={severity.stroke} fillOpacity="0.12" />}
                {linePath && <path d={linePath} fill="none" stroke={severity.stroke} strokeWidth="2" strokeLinecap="round" opacity="0.95" />}

                {activeEntry && activeEntry.dewPoint !== null && (
                  <g style={{ transform: `translate(${idxToX(activeIndex)}px, ${dewToY(activeEntry.dewPoint)}px)` }}>
                    {isScrubbing && <line y1={TOP_Y - dewToY(activeEntry.dewPoint)} y2={BOTTOM_Y - dewToY(activeEntry.dewPoint)} stroke={severity.stroke} strokeWidth="1" strokeDasharray="2 2" opacity="0.4" />}
                    <circle r="6" fill={severity.stroke} opacity="0.25" />
                    <circle r="3.5" fill="#fff" opacity="0.95" />
                  </g>
                )}
              </svg>
            </div>

            {/* TARGETES D'ESTADÍSTIQUES */}
            <StatsSection t={t} maxDewPoint={maxDewPoint} currentHumidity={currentHumidity} hoursSticky={hoursSticky} />
          </div>
        )}
      </div>
    </div>
  );
}

interface StatsSectionProps {
  t: Record<string, string>;
  maxDewPoint: number | null;
  currentHumidity: number | null;
  hoursSticky: number;
}

const StatsSection = memo(function StatsSection({ t, maxDewPoint, currentHumidity, hoursSticky }: StatsSectionProps) {
  return (
    <div className="grid grid-cols-3 gap-3">
      <StatCard label={t.maxDewPoint} value={maxDewPoint !== null ? `${Math.round(maxDewPoint)}°` : '--'} icon={<Droplets className="w-3.5 h-3.5" />} />
      <StatCard label={t.currentHumidity} value={currentHumidity !== null ? `${Math.round(currentHumidity)}%` : '--'} icon={<Droplets className="w-3.5 h-3.5" />} />
      <StatCard label={t.hoursSticky} value={`${hoursSticky}${t.hoursShort}`} icon={<AlertTriangle className="w-3.5 h-3.5" />} />
    </div>
  );
});
