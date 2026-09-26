// src/components/UvModal.tsx
// Modal de detall de l'exposició solar — corba horària d'avui de l'índex UV (real vs. cel
// clar) amb scrubbing, finestra de protecció recomanada i estadístiques del dia. Reutilitza
// hourly.uv_index/uv_index_clear_sky, ja demanats a Open-Meteo — cap crida de xarxa nova.
import { useState, useRef, useMemo, memo } from 'react';
import { X, Sun, ShieldAlert, ShieldCheck, CloudOff } from 'lucide-react';
import { ExtendedWeatherData } from '../types/weatherLogicTypes';
import { Language } from '../translations';
import { MATRIX_BG } from './widgets/widgetStyles';
import { StatCard } from './AstroStatCard';
import { useAstroModalShell } from '../hooks/useAstroModalShell';
import { getUVCategory, needsUVProtection } from '../utils/uvIndexUtils';

interface UvModalProps {
  weatherData: ExtendedWeatherData;
  currentUV: number | undefined;
  onClose: () => void;
  lang?: Language;
}

const T: Record<Language, Record<string, string>> = {
  ca: {
    title: 'EXPOSICIÓ SOLAR', subtitle: 'Observatori UV', noData: 'SENSE DADES SUFICIENTS',
    uvNow: 'Índex Actual', todayCurve: "Corba d'Avui", clearSky: 'Cel Clar',
    scrubHint: 'Toca o arrossega per explorar', protectionWindow: 'Finestra de Protecció',
    noProtection: 'Sense protecció necessària avui', activeNow: 'Ara mateix', now: 'ARA', hoursShort: 'h',
    maxUvToday: 'UV Màx. Avui', maxUvClear: 'UV Màx. Cel Clar', hoursProtection: 'Hores amb Protecció',
    from_: 'de', to_: 'a',
  },
  es: {
    title: 'EXPOSICIÓN SOLAR', subtitle: 'Observatorio UV', noData: 'DATOS INSUFICIENTES',
    uvNow: 'Índice Actual', todayCurve: 'Curva de Hoy', clearSky: 'Cielo Despejado',
    scrubHint: 'Toca o arrastra para explorar', protectionWindow: 'Ventana de Protección',
    noProtection: 'Sin protección necesaria hoy', activeNow: 'Ahora mismo', now: 'AHORA', hoursShort: 'h',
    maxUvToday: 'UV Máx. Hoy', maxUvClear: 'UV Máx. Cielo Despejado', hoursProtection: 'Horas con Protección',
    from_: 'de', to_: 'a',
  },
  en: {
    title: 'SUN EXPOSURE', subtitle: 'UV Observatory', noData: 'INSUFFICIENT DATA',
    uvNow: 'Current Index', todayCurve: "Today's Curve", clearSky: 'Clear Sky',
    scrubHint: 'Tap or drag to explore', protectionWindow: 'Protection Window',
    noProtection: 'No protection needed today', activeNow: 'Right now', now: 'NOW', hoursShort: 'h',
    maxUvToday: 'Max UV Today', maxUvClear: 'Max Clear-Sky UV', hoursProtection: 'Hours Needing Protection',
    from_: 'from', to_: 'to',
  },
  fr: {
    title: 'EXPOSITION SOLAIRE', subtitle: 'Observatoire UV', noData: 'DONNÉES INSUFFISANTES',
    uvNow: 'Indice Actuel', todayCurve: "Courbe du Jour", clearSky: 'Ciel Dégagé',
    scrubHint: 'Touchez ou glissez pour explorer', protectionWindow: 'Fenêtre de Protection',
    noProtection: "Aucune protection nécessaire aujourd'hui", activeNow: 'En ce moment', now: 'MAINTENANT', hoursShort: 'h',
    maxUvToday: 'UV Max Aujourd\'hui', maxUvClear: 'UV Max Ciel Dégagé', hoursProtection: 'Heures avec Protection',
    from_: 'de', to_: 'à',
  },
};

const getSafe = (arr: (number | null)[] | undefined, idx: number): number | null => {
  const v = Array.isArray(arr) ? arr[idx] : undefined;
  return typeof v === 'number' && !isNaN(v) ? v : null;
};

const CHART_W = 400, CHART_H = 160, TOP_Y = 12, BOTTOM_Y = 140;

export default function UvModal({ weatherData, currentUV, onClose, lang = 'ca' }: UvModalProps) {
  const safeLang: Language = T[lang] ? lang : 'ca';
  const t = T[safeLang];

  const { handleClose } = useAstroModalShell(onClose);

  const hourly = weatherData.hourly;
  const current = weatherData.current;

  // --- Corba d'avui: l'array horari ja comença a mitjanit d'avui, tallem quan canvia el dia ---
  const todayEntries = useMemo(() => {
    if (!hourly || !Array.isArray(hourly.time) || hourly.time.length === 0) return [];
    const todayDate = hourly.time[0]?.slice(0, 10);
    const entries: { idx: number; timeStr: string; uv: number | null; uvClear: number | null }[] = [];
    for (let i = 0; i < hourly.time.length; i++) {
      const ts = hourly.time[i];
      if (typeof ts !== 'string' || !todayDate || !ts.startsWith(todayDate)) break;
      entries.push({ idx: i, timeStr: ts, uv: getSafe(hourly.uv_index, i), uvClear: getSafe(hourly.uv_index_clear_sky, i) });
    }
    return entries;
  }, [hourly]);

  const N = todayEntries.length;
  const hasHourlyUv = todayEntries.some(e => e.uv !== null);
  const hasData = hasHourlyUv || typeof currentUV === 'number';

  const currentIndexInToday = useMemo(() => {
    if (typeof current?.time !== 'string') return -1;
    const hourPrefix = current.time.substring(0, 13);
    return todayEntries.findIndex(e => e.timeStr.startsWith(hourPrefix));
  }, [todayEntries, current]);

  const maxUvToday = useMemo(() => {
    const vals = todayEntries.map(e => e.uv).filter((v): v is number => v !== null);
    return vals.length > 0 ? Math.max(...vals) : null;
  }, [todayEntries]);

  const maxUvClearToday = useMemo(() => {
    const vals = todayEntries.map(e => e.uvClear).filter((v): v is number => v !== null);
    return vals.length > 0 ? Math.max(...vals) : null;
  }, [todayEntries]);

  const protectionEntries = useMemo(() => todayEntries.filter(e => e.uv !== null && needsUVProtection(e.uv)), [todayEntries]);
  const protectionWindow = protectionEntries.length > 0
    ? { start: protectionEntries[0], end: protectionEntries[protectionEntries.length - 1] }
    : null;
  const isProtectionActiveNow = !!protectionWindow && currentIndexInToday >= protectionWindow.start.idx && currentIndexInToday <= protectionWindow.end.idx;

  const severity = getUVCategory(maxUvToday ?? currentUV ?? 0);

  // --- Scrub horitzontal (mateix patró RAF que Storm/AqiModal) ---
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
    const current0 = scrubIndex ?? Math.max(0, currentIndexInToday);
    let next: number | null = null;
    switch (e.key) {
      case 'ArrowRight': case 'ArrowUp': next = Math.min(N - 1, current0 + 1); break;
      case 'ArrowLeft': case 'ArrowDown': next = Math.max(0, current0 - 1); break;
      case 'PageUp': next = Math.min(N - 1, current0 + 3); break;
      case 'PageDown': next = Math.max(0, current0 - 3); break;
      case 'Home': next = 0; break;
      case 'End': next = N - 1; break;
      default: return;
    }
    e.preventDefault();
    setScrubIndex(next);
  };

  // A diferència de Storm/AqiModal (índex 0 = ara), aquí índex 0 = mitjanit — per defecte cal
  // apuntar a l'hora actual dins la corba d'avui, no al principi del dia.
  const isScrubbing = scrubIndex !== null;
  const activeIndex = scrubIndex ?? Math.max(0, currentIndexInToday);
  const activeEntry = N > 0 ? todayEntries[Math.min(activeIndex, N - 1)] : null;

  // --- Geometria del gràfic ---
  const yMax = useMemo(() => Math.max(12, (maxUvClearToday ?? maxUvToday ?? 0) * 1.1), [maxUvToday, maxUvClearToday]);
  const uvToY = (v: number) => BOTTOM_Y - (Math.max(0, Math.min(yMax, v)) / yMax) * (BOTTOM_Y - TOP_Y);
  const idxToX = (i: number) => N > 1 ? (i / (N - 1)) * CHART_W : 0;

  const buildPath = (key: 'uv' | 'uvClear') => todayEntries
    .map((e, i) => (e[key] !== null ? `${i === 0 ? 'M' : 'L'} ${idxToX(i)} ${uvToY(e[key] as number)}` : null))
    .filter((s): s is string => s !== null)
    .join(' ');

  const linePath = useMemo(() => (hasHourlyUv ? buildPath('uv') : ''), [todayEntries, yMax, hasHourlyUv]); // eslint-disable-line react-hooks/exhaustive-deps
  const clearPath = useMemo(() => (hasHourlyUv ? buildPath('uvClear') : ''), [todayEntries, yMax, hasHourlyUv]); // eslint-disable-line react-hooks/exhaustive-deps
  const areaPath = useMemo(() => {
    if (!hasHourlyUv || N === 0) return '';
    const pts = todayEntries.map((e, i) => `${idxToX(i)},${uvToY(e.uv ?? 0)}`);
    return `M 0,${BOTTOM_Y} L ${pts.join(' L ')} L ${CHART_W},${BOTTOM_Y} Z`;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [todayEntries, yMax, N, hasHourlyUv]);

  const bgGradient = severity.color.includes('emerald') ? 'from-emerald-950/20 to-black/90'
    : severity.color.includes('amber') ? 'from-amber-950/30 to-black/90'
    : severity.color.includes('orange') ? 'from-orange-950/30 to-black/90'
    : severity.color.includes('red') ? 'from-red-950/40 to-black/90'
    : 'from-purple-950/40 to-black/90';
  const borderColor = severity.color.replace('text-', 'border-') + '/30';
  const strokeHex = severity.color.includes('emerald') ? '#34d399'
    : severity.color.includes('amber') ? '#fbbf24'
    : severity.color.includes('orange') ? '#f97316'
    : severity.color.includes('red') ? '#ef4444'
    : '#a855f7';

  return (
    <div role="dialog" aria-modal="true" aria-labelledby="uv-modal-title" className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-0 sm:p-4 md:p-6 landscape:p-0 landscape:sm:p-4 bg-black/95 backdrop-blur-3xl backdrop-saturate-150 animate-in fade-in duration-200">
      <style>{`
        .uv-scrollbar { -webkit-overflow-scrolling: touch; }
        .uv-scrollbar::-webkit-scrollbar { width: 5px; }
        .uv-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .uv-scrollbar::-webkit-scrollbar-thumb { background: rgba(251,191,36,0.2); border-radius: 8px; }
        .uv-scrollbar::-webkit-scrollbar-thumb:hover { background: rgba(251,191,36,0.4); }
      `}</style>

      <div className={`w-full h-[96dvh] sm:h-auto sm:max-h-[90dvh] landscape:h-[100dvh] landscape:sm:h-auto max-w-sm md:max-w-3xl lg:max-w-5xl flex flex-col min-h-0 bg-gradient-to-b ${bgGradient} rounded-t-[24px] sm:rounded-[32px] border-t sm:border ${borderColor} shadow-[0_0_100px_rgba(0,0,0,0.9)] overflow-hidden relative animate-in slide-in-from-bottom-8 sm:zoom-in-95 duration-300`}>
        <div className={MATRIX_BG}></div>
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[130%] h-56 bg-gradient-to-b from-amber-500/10 via-orange-900/5 to-transparent blur-[80px] pointer-events-none z-0"></div>

        {/* Capçalera */}
        <div className="flex justify-between items-center shrink-0 relative z-20 p-4 md:p-6 border-b border-white/[0.04]">
          <div className="flex items-center gap-3">
            <div className={`relative flex items-center justify-center w-10 h-10 rounded-full border bg-black/40 ${borderColor} ${severity.color}`}>
              <Sun className="w-5 h-5" />
            </div>
            <div className="flex flex-col">
              <h2 id="uv-modal-title" className="text-lg md:text-2xl font-black text-white tracking-tighter drop-shadow-md leading-none">{t.title}</h2>
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
          <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain uv-scrollbar relative z-10 p-4 md:p-6 space-y-6">

            {/* HEROI: índex actual */}
            <div className="relative rounded-2xl border border-white/5 bg-black/30 backdrop-blur-md p-5 flex flex-col sm:flex-row items-center gap-6">
              <div className="flex flex-col items-center sm:items-start gap-1">
                <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">{t.uvNow}</span>
                <span className={`text-5xl sm:text-6xl font-black tracking-tighter tabular-nums leading-none drop-shadow-xl ${severity.color}`}>
                  {typeof currentUV === 'number' ? currentUV.toFixed(1) : '--'}
                </span>
              </div>
              <div className="flex flex-col items-center sm:items-start gap-2 flex-1">
                {typeof currentUV === 'number' && (() => {
                  const nowCategory = getUVCategory(currentUV);
                  const needsProtection = needsUVProtection(currentUV);
                  return (
                    <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md border backdrop-blur-md bg-black/40 w-fit ${nowCategory.color.replace('text-', 'border-')}/40`}>
                      {needsProtection ? <ShieldAlert className={`w-3.5 h-3.5 ${nowCategory.color}`} /> : <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />}
                      <span className={`text-xs font-black uppercase tracking-wider ${nowCategory.color}`}>{nowCategory.label[safeLang]}</span>
                    </div>
                  );
                })()}
                {protectionWindow ? (
                  <div className="flex items-center gap-2 mt-1 px-3 py-1.5 rounded-lg bg-black/40 border border-white/5">
                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">{t.protectionWindow}</span>
                    <span className={`text-xs font-mono font-bold ${severity.color}`}>
                      {isProtectionActiveNow ? t.activeNow : `${t.from_} ${protectionWindow.start.timeStr.slice(11, 16)} ${t.to_} ${protectionWindow.end.timeStr.slice(11, 16)}`}
                    </span>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 mt-1 px-3 py-1.5 rounded-lg bg-black/40 border border-white/5">
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
                    <span className="text-xs font-bold text-emerald-400">{t.noProtection}</span>
                  </div>
                )}
              </div>
            </div>

            {/* CORBA D'AVUI (scrubbable) */}
            <div className="relative rounded-2xl border border-white/5 bg-black/30 backdrop-blur-md p-4 overflow-hidden">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-2 sm:mb-1 relative z-10 gap-0.5 sm:gap-2">
                <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 shrink-0">
                  {t.todayCurve}
                </span>
                {hasHourlyUv && activeEntry ? (
                  <span className="text-[11px] font-mono font-bold text-slate-200">
                    {isScrubbing ? activeEntry.timeStr.slice(11, 16) : t.now}
                    {' · UV '}<span className={getUVCategory((isScrubbing ? activeEntry.uv : currentUV) ?? 0).color}>{(isScrubbing ? activeEntry.uv : currentUV ?? null) !== null ? (isScrubbing ? activeEntry.uv as number : currentUV as number).toFixed(1) : '--'}</span>
                    {activeEntry.uvClear !== null && <span className="text-slate-500"> · {t.clearSky} {activeEntry.uvClear.toFixed(1)}</span>}
                  </span>
                ) : (
                  <span className="text-[9px] text-slate-600 italic">{t.scrubHint}</span>
                )}
              </div>

              {hasHourlyUv ? (
                <svg
                  viewBox={`0 0 ${CHART_W} ${CHART_H}`}
                  className="w-full h-40 overflow-visible cursor-crosshair rounded-xl focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/60"
                  style={{ touchAction: 'none' }}
                  onPointerMove={handlePointerMove}
                  onPointerDown={handlePointerMove}
                  onPointerUp={clearScrub}
                  onPointerLeave={clearScrub}
                  onPointerCancel={clearScrub}
                  tabIndex={0}
                  role="slider"
                  aria-label={t.todayCurve}
                  aria-valuemin={0}
                  aria-valuemax={N - 1}
                  aria-valuenow={activeIndex}
                  aria-valuetext={activeEntry ? `${activeEntry.timeStr.slice(11, 16)} · UV ${activeEntry.uv ?? '--'}` : undefined}
                  onKeyDown={handleKeyDown}
                >
                  <line x1="0" y1={uvToY(3)} x2={CHART_W} y2={uvToY(3)} stroke="#fbbf24" strokeOpacity="0.25" strokeWidth="1" strokeDasharray="3 3" />
                  <line x1="0" y1={uvToY(6)} x2={CHART_W} y2={uvToY(6)} stroke="#f97316" strokeOpacity="0.25" strokeWidth="1" strokeDasharray="3 3" />
                  <line x1="0" y1={uvToY(8)} x2={CHART_W} y2={uvToY(8)} stroke="#ef4444" strokeOpacity="0.25" strokeWidth="1" strokeDasharray="3 3" />
                  <line x1="0" y1={uvToY(11)} x2={CHART_W} y2={uvToY(11)} stroke="#a855f7" strokeOpacity="0.3" strokeWidth="1" strokeDasharray="3 3" />

                  {areaPath && <path d={areaPath} fill={strokeHex} fillOpacity="0.12" />}
                  {clearPath && <path d={clearPath} fill="none" stroke="#94a3b8" strokeWidth="1.5" strokeDasharray="4 3" strokeLinecap="round" opacity="0.6" />}
                  {linePath && <path d={linePath} fill="none" stroke={strokeHex} strokeWidth="2" strokeLinecap="round" opacity="0.95" />}

                  {currentIndexInToday >= 0 && !isScrubbing && (
                    <line x1={idxToX(currentIndexInToday)} y1={TOP_Y} x2={idxToX(currentIndexInToday)} y2={BOTTOM_Y} stroke="#fff" strokeOpacity="0.3" strokeWidth="1" strokeDasharray="2 2" />
                  )}

                  {activeEntry && activeEntry.uv !== null && (
                    <g style={{ transform: `translate(${idxToX(activeIndex)}px, ${uvToY(activeEntry.uv)}px)` }}>
                      {isScrubbing && <line y1={TOP_Y - uvToY(activeEntry.uv)} y2={BOTTOM_Y - uvToY(activeEntry.uv)} stroke={strokeHex} strokeWidth="1" strokeDasharray="2 2" opacity="0.4" />}
                      <circle r="6" fill={strokeHex} opacity="0.25" />
                      <circle r="3.5" fill="#fff" opacity="0.95" />
                    </g>
                  )}
                </svg>
              ) : (
                <div className="h-40 flex items-center justify-center text-slate-600 text-xs font-bold uppercase tracking-widest">{t.noData}</div>
              )}
            </div>

            {/* TARGETES D'ESTADÍSTIQUES */}
            <StatsSection t={t} maxUvToday={maxUvToday} maxUvClearToday={maxUvClearToday} hoursProtection={protectionEntries.length} />
          </div>
        )}
      </div>
    </div>
  );
}

interface StatsSectionProps {
  t: Record<string, string>;
  maxUvToday: number | null;
  maxUvClearToday: number | null;
  hoursProtection: number;
}

const StatsSection = memo(function StatsSection({ t, maxUvToday, maxUvClearToday, hoursProtection }: StatsSectionProps) {
  return (
    <div className="grid grid-cols-3 gap-3">
      <StatCard label={t.maxUvToday} value={maxUvToday !== null ? maxUvToday.toFixed(1) : '--'} icon={<Sun className="w-3.5 h-3.5" />} />
      <StatCard label={t.maxUvClear} value={maxUvClearToday !== null ? maxUvClearToday.toFixed(1) : '--'} icon={<Sun className="w-3.5 h-3.5" />} />
      <StatCard label={t.hoursProtection} value={`${hoursProtection}${t.hoursShort}`} icon={<ShieldAlert className="w-3.5 h-3.5" />} />
    </div>
  );
});
