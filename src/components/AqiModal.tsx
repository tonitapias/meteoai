// src/components/AqiModal.tsx
// Modal de detall de la qualitat de l'aire — evolució horària (48h) de l'EAQI amb scrubbing,
// desglossament de contaminants i pol·len/pols quan n'hi ha. Totes les dades (current + hourly)
// ja arriben amb la petita d'Open-Meteo Air Quality — cap crida de xarxa addicional.
import { useState, useRef, useMemo, memo } from 'react';
import { X, Wind, AlertTriangle, CloudOff, Flower2, Sparkles } from 'lucide-react';
import { AirQualityData } from '../types/weather';
import { Language } from '../translations';
import { MATRIX_BG } from './widgets/widgetStyles';
import { StatCard } from './AstroStatCard';
import { useAstroModalShell } from '../hooks/useAstroModalShell';

interface AqiModalProps {
  aqiData: AirQualityData | null;
  onClose: () => void;
  lang?: Language;
}

// Igual que a StormModal: l'EAQI horari només té sentit a curt termini — una finestra
// contínua de 48h en lloc d'un selector de dies.
const WINDOW_HOURS = 48;

const T: Record<Language, Record<string, string>> = {
  ca: {
    title: "QUALITAT DE L'AIRE", subtitle: 'Observatori Atmosfèric', noData: 'SENSE DADES SUFICIENTS',
    aqiNow: 'Índex Actual', evolution: 'Evolució', scrubHint: 'Toca o arrossega per explorar',
    pollutants: 'Desglossament de Contaminants', pollen: 'Pol·len i Pols', now: 'ARA', hoursShort: 'h',
    maxAqi24: 'Màx. Índex 24h', maxAqi48: 'Màx. Índex 48h', unknown: 'Desconegut',
    good: 'Bona', fair: 'Raonable', moderate: 'Moderada', sensitive: 'Sensible', poor: 'Dolenta',
    veryPoor: 'Molt Dolenta', extreme: 'Extrema', hazardous: 'Perillosa', noHourly: 'Sense evolució horària disponible',
    dust: 'Pols', ammonia: 'Amoníac',
    alder_pollen: 'Vern', birch_pollen: 'Bedoll', grass_pollen: 'Gramínies',
    mugwort_pollen: 'Artemisa', olive_pollen: 'Olivera', ragweed_pollen: 'Ambrosia',
  },
  es: {
    title: 'CALIDAD DEL AIRE', subtitle: 'Observatorio Atmosférico', noData: 'DATOS INSUFICIENTES',
    aqiNow: 'Índice Actual', evolution: 'Evolución', scrubHint: 'Toca o arrastra para explorar',
    pollutants: 'Desglose de Contaminantes', pollen: 'Polen y Polvo', now: 'AHORA', hoursShort: 'h',
    maxAqi24: 'Máx. Índice 24h', maxAqi48: 'Máx. Índice 48h', unknown: 'Desconocido',
    good: 'Buena', fair: 'Razonable', moderate: 'Moderada', sensitive: 'Sensible', poor: 'Mala',
    veryPoor: 'Muy Mala', extreme: 'Extrema', hazardous: 'Peligrosa', noHourly: 'Sin evolución horaria disponible',
    dust: 'Polvo', ammonia: 'Amoníaco',
    alder_pollen: 'Aliso', birch_pollen: 'Abedul', grass_pollen: 'Gramíneas',
    mugwort_pollen: 'Artemisa', olive_pollen: 'Olivo', ragweed_pollen: 'Ambrosía',
  },
  en: {
    title: 'AIR QUALITY', subtitle: 'Atmospheric Observatory', noData: 'INSUFFICIENT DATA',
    aqiNow: 'Current Index', evolution: 'Evolution', scrubHint: 'Tap or drag to explore',
    pollutants: 'Pollutant Breakdown', pollen: 'Pollen & Dust', now: 'NOW', hoursShort: 'h',
    maxAqi24: 'Max Index 24h', maxAqi48: 'Max Index 48h', unknown: 'Unknown',
    good: 'Good', fair: 'Fair', moderate: 'Moderate', sensitive: 'Sensitive', poor: 'Poor',
    veryPoor: 'Very Poor', extreme: 'Extreme', hazardous: 'Hazardous', noHourly: 'No hourly evolution available',
    dust: 'Dust', ammonia: 'Ammonia',
    alder_pollen: 'Alder', birch_pollen: 'Birch', grass_pollen: 'Grass',
    mugwort_pollen: 'Mugwort', olive_pollen: 'Olive', ragweed_pollen: 'Ragweed',
  },
  fr: {
    title: "QUALITÉ DE L'AIR", subtitle: 'Observatoire Atmosphérique', noData: 'DONNÉES INSUFFISANTES',
    aqiNow: 'Indice Actuel', evolution: 'Évolution', scrubHint: 'Touchez ou glissez pour explorer',
    pollutants: 'Détail des Polluants', pollen: 'Pollen et Poussière', now: 'MAINTENANT', hoursShort: 'h',
    maxAqi24: 'Max Indice 24h', maxAqi48: 'Max Indice 48h', unknown: 'Inconnu',
    good: 'Bonne', fair: 'Passable', moderate: 'Modérée', sensitive: 'Sensible', poor: 'Mauvaise',
    veryPoor: 'Très Mauvaise', extreme: 'Extrême', hazardous: 'Dangereuse', noHourly: "Aucune évolution horaire disponible",
    dust: 'Poussière', ammonia: 'Ammoniac',
    alder_pollen: 'Aulne', birch_pollen: 'Bouleau', grass_pollen: 'Graminées',
    mugwort_pollen: 'Armoise', olive_pollen: 'Olivier', ragweed_pollen: 'Ambroisie',
  },
};

const getSafe = (arr: (number | null)[] | undefined, idx: number): number | null => {
  const v = Array.isArray(arr) ? arr[idx] : undefined;
  return typeof v === 'number' && !isNaN(v) ? v : null;
};

interface Severity { label: string; color: string; stroke: string; borderColor: string; bgGlow: string; }

// Bandes oficials EAQI (Agència Europea de Medi Ambient) i USAQI (EPA) — mateixos llindars
// que ja pinta AqiWidget.tsx::getAqiState, reutilitzats tal qual per coherència visual.
function getAqiSeverity(value: number | null, type: 'EAQI' | 'USAQI' | null, t: Record<string, string>): Severity {
  if (value === null || type === null) return { label: t.unknown, color: 'text-slate-500', stroke: '#64748b', borderColor: 'border-slate-500/20', bgGlow: 'from-slate-950/20 to-black/90' };
  if (type === 'EAQI') {
    if (value > 150) return { label: t.extreme, color: 'text-purple-500', stroke: '#a855f7', borderColor: 'border-purple-500/30', bgGlow: 'from-purple-950/40 to-black/90' };
    if (value > 100) return { label: t.veryPoor, color: 'text-fuchsia-500', stroke: '#d946ef', borderColor: 'border-fuchsia-500/30', bgGlow: 'from-fuchsia-950/30 to-black/90' };
    if (value > 50) return { label: t.poor, color: 'text-rose-500', stroke: '#f43f5e', borderColor: 'border-rose-500/30', bgGlow: 'from-rose-950/30 to-black/90' };
    if (value > 40) return { label: t.moderate, color: 'text-yellow-300', stroke: '#fde047', borderColor: 'border-yellow-400/20', bgGlow: 'from-yellow-950/20 to-black/90' };
    if (value > 20) return { label: t.fair, color: 'text-emerald-400', stroke: '#34d399', borderColor: 'border-emerald-500/20', bgGlow: 'from-emerald-950/20 to-black/90' };
    return { label: t.good, color: 'text-cyan-400', stroke: '#22d3ee', borderColor: 'border-cyan-500/20', bgGlow: 'from-cyan-950/20 to-black/90' };
  }
  // USAQI
  if (value > 300) return { label: t.hazardous, color: 'text-red-800', stroke: '#991b1b', borderColor: 'border-red-800/30', bgGlow: 'from-red-950/40 to-black/90' };
  if (value > 200) return { label: t.veryPoor, color: 'text-fuchsia-500', stroke: '#d946ef', borderColor: 'border-fuchsia-500/30', bgGlow: 'from-fuchsia-950/30 to-black/90' };
  if (value > 150) return { label: t.poor, color: 'text-rose-500', stroke: '#f43f5e', borderColor: 'border-rose-500/30', bgGlow: 'from-rose-950/30 to-black/90' };
  if (value > 100) return { label: t.sensitive, color: 'text-amber-400', stroke: '#fbbf24', borderColor: 'border-amber-400/30', bgGlow: 'from-amber-950/30 to-black/90' };
  if (value > 50) return { label: t.moderate, color: 'text-yellow-300', stroke: '#fde047', borderColor: 'border-yellow-400/20', bgGlow: 'from-yellow-950/20 to-black/90' };
  return { label: t.good, color: 'text-emerald-400', stroke: '#34d399', borderColor: 'border-emerald-500/20', bgGlow: 'from-emerald-950/20 to-black/90' };
}

const CHART_W = 400, CHART_H = 160, TOP_Y = 12, BOTTOM_Y = 140;

export default function AqiModal({ aqiData, onClose, lang = 'ca' }: AqiModalProps) {
  const safeLang: Language = T[lang] ? lang : 'ca';
  const t = T[safeLang];

  const { handleClose } = useAstroModalShell(onClose);

  const current = aqiData?.current;
  const hourly = aqiData?.hourly;

  const currentHourIndex = useMemo(() => {
    if (!hourly || !current || !Array.isArray(hourly.time) || typeof current.time !== 'string') return -1;
    const hourPrefix = current.time.substring(0, 13);
    return hourly.time.findIndex(ts => typeof ts === 'string' && ts.startsWith(hourPrefix));
  }, [hourly, current]);

  const hasData = !!current && (typeof current.european_aqi === 'number' || typeof current.us_aqi === 'number');

  const currentType: 'EAQI' | 'USAQI' | null = typeof current?.european_aqi === 'number' ? 'EAQI' : typeof current?.us_aqi === 'number' ? 'USAQI' : null;
  const currentValue = currentType === 'EAQI' ? current?.european_aqi ?? null : currentType === 'USAQI' ? current?.us_aqi ?? null : null;
  const severity = getAqiSeverity(currentValue, currentType, t);

  // --- Finestra de 48h (només EAQI és horari a PARAMS_AQI_HOURLY) ---
  const windowEntries = useMemo(() => {
    if (currentHourIndex === -1 || !hourly) return [];
    const total = Array.isArray(hourly.time) ? hourly.time.length : 0;
    const n = Math.min(WINDOW_HOURS, total - currentHourIndex);
    return Array.from({ length: Math.max(0, n) }, (_, i) => {
      const idx = currentHourIndex + i;
      return {
        idx,
        timeStr: String(hourly.time?.[idx] ?? ''),
        eaqi: getSafe(hourly.european_aqi, idx),
        pm25: getSafe(hourly.pm2_5, idx),
        pm10: getSafe(hourly.pm10, idx),
      };
    });
  }, [currentHourIndex, hourly]);

  const N = windowEntries.length;
  const hasHourlyEaqi = windowEntries.some(e => e.eaqi !== null);

  const maxAqi24 = useMemo(() => {
    const vals = windowEntries.slice(0, 24).map(e => e.eaqi).filter((v): v is number => v !== null);
    return vals.length > 0 ? Math.max(...vals) : null;
  }, [windowEntries]);
  const maxAqi48 = useMemo(() => {
    const vals = windowEntries.map(e => e.eaqi).filter((v): v is number => v !== null);
    return vals.length > 0 ? Math.max(...vals) : null;
  }, [windowEntries]);

  // --- Scrub horitzontal (mateix patró RAF que StormModal/l'arc solar) ---
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
  const yMax = useMemo(() => Math.max(100, (maxAqi48 ?? 0) * 1.1), [maxAqi48]);
  const aqiToY = (v: number) => BOTTOM_Y - (Math.max(0, Math.min(yMax, v)) / yMax) * (BOTTOM_Y - TOP_Y);
  const idxToX = (i: number) => N > 1 ? (i / (N - 1)) * CHART_W : 0;

  const areaPath = useMemo(() => {
    if (N === 0 || !hasHourlyEaqi) return '';
    const pts = windowEntries.map((e, i) => `${idxToX(i)},${aqiToY(e.eaqi ?? 0)}`);
    return `M 0,${BOTTOM_Y} L ${pts.join(' L ')} L ${CHART_W},${BOTTOM_Y} Z`;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [windowEntries, yMax, N, hasHourlyEaqi]);

  const linePath = useMemo(() => {
    if (N === 0 || !hasHourlyEaqi) return '';
    return windowEntries.map((e, i) => `${i === 0 ? 'M' : 'L'} ${idxToX(i)} ${aqiToY(e.eaqi ?? 0)}`).join(' ');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [windowEntries, yMax, N, hasHourlyEaqi]);

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

  // --- Desglossament de contaminants (valors bruts, sense color inventat — vegeu pla) ---
  const pollutants = useMemo(() => [
    { key: 'PM2.5', value: current?.pm2_5 ?? null },
    { key: 'PM10', value: current?.pm10 ?? null },
    { key: 'NO2', value: current?.nitrogen_dioxide ?? null },
    { key: 'O3', value: current?.ozone ?? null },
    { key: 'SO2', value: current?.sulphur_dioxide ?? null },
  ].filter(p => p.value !== null), [current]);

  // --- Pol·len i pols: només els que realment es detecten (evita una paret de zeros) ---
  const pollenEntries = useMemo(() => {
    if (!current) return [];
    const raw: { key: string; value: number | null | undefined; unit: string }[] = [
      { key: 'dust', value: current.dust, unit: 'µg/m³' },
      { key: 'alder_pollen', value: current.alder_pollen, unit: 'grains/m³' },
      { key: 'birch_pollen', value: current.birch_pollen, unit: 'grains/m³' },
      { key: 'grass_pollen', value: current.grass_pollen, unit: 'grains/m³' },
      { key: 'mugwort_pollen', value: current.mugwort_pollen, unit: 'grains/m³' },
      { key: 'olive_pollen', value: current.olive_pollen, unit: 'grains/m³' },
      { key: 'ragweed_pollen', value: current.ragweed_pollen, unit: 'grains/m³' },
    ];
    return raw.filter((p): p is { key: string; value: number; unit: string } => typeof p.value === 'number' && p.value > 0);
  }, [current]);

  const bgGradient = severity.bgGlow;

  return (
    <div role="dialog" aria-modal="true" aria-labelledby="aqi-modal-title" className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-0 sm:p-4 md:p-6 landscape:p-0 landscape:sm:p-4 bg-black/95 backdrop-blur-3xl backdrop-saturate-150 animate-in fade-in duration-200">
      <style>{`
        .aqi-scrollbar { -webkit-overflow-scrolling: touch; }
        .aqi-scrollbar::-webkit-scrollbar { width: 5px; }
        .aqi-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .aqi-scrollbar::-webkit-scrollbar-thumb { background: rgba(34,211,238,0.2); border-radius: 8px; }
        .aqi-scrollbar::-webkit-scrollbar-thumb:hover { background: rgba(34,211,238,0.4); }
      `}</style>

      <div className={`w-full h-[96dvh] sm:h-auto sm:max-h-[90dvh] landscape:h-[100dvh] landscape:sm:h-auto max-w-sm md:max-w-3xl lg:max-w-5xl flex flex-col min-h-0 bg-gradient-to-b ${bgGradient} rounded-t-[24px] sm:rounded-[32px] border-t sm:border ${severity.borderColor} shadow-[0_0_100px_rgba(0,0,0,0.9)] overflow-hidden relative animate-in slide-in-from-bottom-8 sm:zoom-in-95 duration-300`}>
        <div className={MATRIX_BG}></div>
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[130%] h-56 bg-gradient-to-b from-cyan-500/10 via-emerald-900/5 to-transparent blur-[80px] pointer-events-none z-0"></div>

        {/* Capçalera */}
        <div className="flex justify-between items-center shrink-0 relative z-20 p-4 md:p-6 border-b border-white/[0.04]">
          <div className="flex items-center gap-3">
            <div className={`relative flex items-center justify-center w-10 h-10 rounded-full border bg-black/40 ${severity.borderColor} ${severity.color}`}>
              <Wind className="w-5 h-5" />
            </div>
            <div className="flex flex-col">
              <h2 id="aqi-modal-title" className="text-lg md:text-2xl font-black text-white tracking-tighter drop-shadow-md leading-none">{t.title}</h2>
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
          <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain aqi-scrollbar relative z-10 p-4 md:p-6 space-y-6">

            {/* HEROI: índex actual */}
            <div className="relative rounded-2xl border border-white/5 bg-black/30 backdrop-blur-md p-5 flex flex-col sm:flex-row items-center gap-6">
              <div className="flex flex-col items-center sm:items-start gap-1">
                <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">{t.aqiNow} {currentType ? `(${currentType})` : ''}</span>
                <span className={`text-5xl sm:text-6xl font-black tracking-tighter tabular-nums leading-none drop-shadow-xl ${severity.color}`}>
                  {currentValue !== null ? Math.round(currentValue) : '--'}
                </span>
              </div>
              <div className="flex flex-col items-center sm:items-start gap-2 flex-1">
                <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md border backdrop-blur-md bg-black/40 w-fit ${severity.borderColor}`}>
                  <AlertTriangle className={`w-3.5 h-3.5 ${severity.color}`} />
                  <span className={`text-xs font-black uppercase tracking-wider ${severity.color}`}>{severity.label}</span>
                </div>
                {(current?.pm2_5 !== undefined || current?.pm10 !== undefined) && (
                  <div className="flex items-center gap-3 mt-1 px-3 py-1.5 rounded-lg bg-black/40 border border-white/5 text-[11px] font-mono font-bold text-slate-300">
                    {typeof current?.pm2_5 === 'number' && <span>PM2.5 <span className="text-white">{current.pm2_5.toFixed(1)}</span></span>}
                    {typeof current?.pm10 === 'number' && <span>PM10 <span className="text-white">{current.pm10.toFixed(1)}</span></span>}
                  </div>
                )}
              </div>
            </div>

            {/* GRÀFIC D'EVOLUCIÓ (scrubbable) */}
            <div className="relative rounded-2xl border border-white/5 bg-black/30 backdrop-blur-md p-4 overflow-hidden">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-2 sm:mb-1 relative z-10 gap-0.5 sm:gap-2">
                <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 shrink-0">
                  {t.evolution} · {WINDOW_HOURS}h
                </span>
                {hasHourlyEaqi && activeEntry ? (
                  <span className="text-[11px] font-mono font-bold text-slate-200">
                    {isScrubbing ? activeEntry.timeStr.slice(11, 16) : t.now}
                    {' · EAQI '}<span className={getAqiSeverity(activeEntry.eaqi, activeEntry.eaqi !== null ? 'EAQI' : null, t).color}>{activeEntry.eaqi !== null ? Math.round(activeEntry.eaqi) : '--'}</span>
                  </span>
                ) : (
                  <span className="text-[9px] text-slate-600 italic">{hasHourlyEaqi ? t.scrubHint : t.noHourly}</span>
                )}
              </div>

              {hasHourlyEaqi ? (
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
                  aria-valuetext={activeEntry ? `${activeEntry.timeStr.slice(11, 16)} · EAQI ${activeEntry.eaqi ?? '--'}` : undefined}
                  onKeyDown={handleKeyDown}
                >
                  <line x1="0" y1={aqiToY(20)} x2={CHART_W} y2={aqiToY(20)} stroke="#34d399" strokeOpacity="0.25" strokeWidth="1" strokeDasharray="3 3" />
                  <line x1="0" y1={aqiToY(50)} x2={CHART_W} y2={aqiToY(50)} stroke="#f43f5e" strokeOpacity="0.25" strokeWidth="1" strokeDasharray="3 3" />
                  <line x1="0" y1={aqiToY(100)} x2={CHART_W} y2={aqiToY(100)} stroke="#d946ef" strokeOpacity="0.3" strokeWidth="1" strokeDasharray="3 3" />

                  {dayMarkers.map(m => (
                    <line key={m.i} x1={idxToX(m.i)} y1={TOP_Y} x2={idxToX(m.i)} y2={BOTTOM_Y} stroke="#475569" strokeOpacity="0.4" strokeWidth="1" strokeDasharray="1 3" />
                  ))}

                  {areaPath && <path d={areaPath} fill={severity.stroke} fillOpacity="0.12" />}
                  {linePath && <path d={linePath} fill="none" stroke={severity.stroke} strokeWidth="2" strokeLinecap="round" opacity="0.95" />}

                  {activeEntry && (
                    <g style={{ transform: `translate(${idxToX(activeIndex)}px, ${aqiToY(activeEntry.eaqi ?? 0)}px)` }}>
                      {isScrubbing && <line y1={TOP_Y - aqiToY(activeEntry.eaqi ?? 0)} y2={BOTTOM_Y - aqiToY(activeEntry.eaqi ?? 0)} stroke={severity.stroke} strokeWidth="1" strokeDasharray="2 2" opacity="0.4" />}
                      <circle r="6" fill={severity.stroke} opacity="0.25" />
                      <circle r="3.5" fill="#fff" opacity="0.95" />
                    </g>
                  )}
                </svg>
              ) : (
                <div className="h-40 flex items-center justify-center text-slate-600 text-xs font-bold uppercase tracking-widest">{t.noHourly}</div>
              )}
            </div>

            {/* DESGLOSSAMENT DE CONTAMINANTS */}
            {pollutants.length > 0 && (
              <div>
                <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2 block">{t.pollutants}</span>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
                  {pollutants.map(p => (
                    <div key={p.key} className="rounded-xl border border-white/5 bg-black/30 backdrop-blur-md p-3 flex flex-col gap-1">
                      <span className="text-[9px] font-black uppercase tracking-widest text-slate-500">{p.key}</span>
                      <span className="text-lg font-black tabular-nums leading-none text-white">{p.value?.toFixed(1)}</span>
                      <span className="text-[9px] font-bold text-slate-500 tracking-wide">µg/m³</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* POL·LEN I POLS (només si es detecta alguna cosa) */}
            {pollenEntries.length > 0 && (
              <div>
                <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2 flex items-center gap-1.5"><Flower2 className="w-3 h-3" />{t.pollen}</span>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                  {pollenEntries.map(p => (
                    <StatCard key={p.key} label={t[p.key] || p.key} value={`${p.value.toFixed(1)} ${p.unit}`} icon={p.key === 'dust' ? <Sparkles className="w-3.5 h-3.5" /> : <Flower2 className="w-3.5 h-3.5" />} />
                  ))}
                </div>
              </div>
            )}

            {/* TARGETES D'ESTADÍSTIQUES */}
            <StatsSection t={t} maxAqi24={maxAqi24} maxAqi48={maxAqi48} />
          </div>
        )}
      </div>
    </div>
  );
}

interface StatsSectionProps {
  t: Record<string, string>;
  maxAqi24: number | null;
  maxAqi48: number | null;
}

const StatsSection = memo(function StatsSection({ t, maxAqi24, maxAqi48 }: StatsSectionProps) {
  if (maxAqi24 === null && maxAqi48 === null) return null;
  return (
    <div className="grid grid-cols-2 gap-3">
      <StatCard label={t.maxAqi24} value={maxAqi24 !== null ? `${Math.round(maxAqi24)}` : '--'} icon={<AlertTriangle className="w-3.5 h-3.5" />} />
      <StatCard label={t.maxAqi48} value={maxAqi48 !== null ? `${Math.round(maxAqi48)}` : '--'} icon={<AlertTriangle className="w-3.5 h-3.5" />} />
    </div>
  );
});
