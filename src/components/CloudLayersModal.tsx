// src/components/CloudLayersModal.tsx
// Modal de detall de les capes de núvols — evolució horària (48h) amb scrubbing de les tres
// capes (Alts/Mitjans/Baixos), la mateixa cobertura efectiva que ja calcula cloudRules.ts per
// triar la icona de cel. Reutilitza hourly.cloud_cover_{low,mid,high}, ja demanats a
// Open-Meteo — cap crida de xarxa nova.
import { useState, useRef, useMemo, memo } from 'react';
import { X, Layers, CloudOff, Cloud } from 'lucide-react';
import { ExtendedWeatherData } from '../types/weatherLogicTypes';
import { Language } from '../translations';
import { MATRIX_BG } from './widgets/widgetStyles';
import { StatCard } from './AstroStatCard';
import { useAstroModalShell } from '../hooks/useAstroModalShell';
import { WEATHER_THRESHOLDS } from '../constants/weatherConfig';
import { calculateEffectiveCloudCover } from '../utils/rules/cloudRules';

const { CLOUDS } = WEATHER_THRESHOLDS;

interface CloudLayersModalProps {
  weatherData: ExtendedWeatherData;
  onClose: () => void;
  lang?: Language;
}

const WINDOW_HOURS = 48;

const T: Record<Language, Record<string, string>> = {
  ca: {
    title: 'NÚVOLS', subtitle: 'Perfil Vertical del Cel', noData: 'SENSE DADES SUFICIENTS',
    coverNow: 'Cobertura Efectiva', evolution: 'Evolució per Capes', scrubHint: 'Toca o arrossega per explorar',
    dominantLayer: 'Capa Dominant', hoursOvercast: 'Hores amb Cel Cobert', now: 'ARA', hoursShort: 'h',
    high: 'Alts', mid: 'Mitjans', low: 'Baixos',
    clear: 'Serè', partial: 'Parcialment Ennuvolat', veryCloudy: 'Molt Ennuvolat', overcast: 'Cobert', unknown: 'Desconegut',
  },
  es: {
    title: 'NUBES', subtitle: 'Perfil Vertical del Cielo', noData: 'DATOS INSUFICIENTES',
    coverNow: 'Cobertura Efectiva', evolution: 'Evolución por Capas', scrubHint: 'Toca o arrastra para explorar',
    dominantLayer: 'Capa Dominante', hoursOvercast: 'Horas con Cielo Cubierto', now: 'AHORA', hoursShort: 'h',
    high: 'Altas', mid: 'Medias', low: 'Bajas',
    clear: 'Despejado', partial: 'Parcialmente Nublado', veryCloudy: 'Muy Nublado', overcast: 'Cubierto', unknown: 'Desconocido',
  },
  en: {
    title: 'CLOUDS', subtitle: 'Vertical Sky Profile', noData: 'INSUFFICIENT DATA',
    coverNow: 'Effective Coverage', evolution: 'Layer Evolution', scrubHint: 'Tap or drag to explore',
    dominantLayer: 'Dominant Layer', hoursOvercast: 'Hours with Overcast Sky', now: 'NOW', hoursShort: 'h',
    high: 'High', mid: 'Mid', low: 'Low',
    clear: 'Clear', partial: 'Partly Cloudy', veryCloudy: 'Very Cloudy', overcast: 'Overcast', unknown: 'Unknown',
  },
  fr: {
    title: 'NUAGES', subtitle: 'Profil Vertical du Ciel', noData: 'DONNÉES INSUFFISANTES',
    coverNow: 'Couverture Effective', evolution: 'Évolution par Couches', scrubHint: 'Touchez ou glissez pour explorer',
    dominantLayer: 'Couche Dominante', hoursOvercast: 'Heures de Ciel Couvert', now: 'MAINTENANT', hoursShort: 'h',
    high: 'Hautes', mid: 'Moyennes', low: 'Basses',
    clear: 'Dégagé', partial: 'Partiellement Nuageux', veryCloudy: 'Très Nuageux', overcast: 'Couvert', unknown: 'Inconnu',
  },
};

const getSafe = (arr: (number | null)[] | undefined, idx: number): number | null => {
  const v = Array.isArray(arr) ? arr[idx] : undefined;
  return typeof v === 'number' && !isNaN(v) ? v : null;
};

interface Severity { label: string; color: string; stroke: string; borderColor: string; bgGlow: string; }

function getCloudSeverity(effectiveCover: number | null, t: Record<string, string>): Severity {
  if (effectiveCover === null) return { label: t.unknown, color: 'text-slate-500', stroke: '#64748b', borderColor: 'border-slate-500/20', bgGlow: 'from-slate-950/20 to-black/90' };
  if (effectiveCover < CLOUDS.FEW) return { label: t.clear, color: 'text-emerald-400', stroke: '#34d399', borderColor: 'border-emerald-500/20', bgGlow: 'from-emerald-950/20 to-black/90' };
  if (effectiveCover < CLOUDS.SCATTERED) return { label: t.partial, color: 'text-sky-400', stroke: '#38bdf8', borderColor: 'border-sky-500/20', bgGlow: 'from-sky-950/20 to-black/90' };
  if (effectiveCover < CLOUDS.OVERCAST) return { label: t.veryCloudy, color: 'text-indigo-400', stroke: '#818cf8', borderColor: 'border-indigo-500/20', bgGlow: 'from-indigo-950/25 to-black/90' };
  return { label: t.overcast, color: 'text-slate-300', stroke: '#cbd5e1', borderColor: 'border-slate-400/20', bgGlow: 'from-slate-800/30 to-black/90' };
}

type LayerKey = 'low' | 'mid' | 'high';
const LAYER_STROKE: Record<LayerKey, string> = { high: '#7dd3fc', mid: '#3b82f6', low: '#4f46e5' };

const CHART_W = 400, CHART_H = 160, TOP_Y = 12, BOTTOM_Y = 140;

export default function CloudLayersModal({ weatherData, onClose, lang = 'ca' }: CloudLayersModalProps) {
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

  const hasData = currentHourIndex !== -1 && (
    Array.isArray(hourly?.cloud_cover_low) || Array.isArray(hourly?.cloud_cover_mid) || Array.isArray(hourly?.cloud_cover_high)
  );

  const windowEntries = useMemo(() => {
    if (!hasData || !hourly) return [];
    const total = Array.isArray(hourly.time) ? hourly.time.length : 0;
    const n = Math.min(WINDOW_HOURS, total - currentHourIndex);
    return Array.from({ length: Math.max(0, n) }, (_, i) => {
      const idx = currentHourIndex + i;
      return {
        idx,
        timeStr: String(hourly.time?.[idx] ?? ''),
        low: getSafe(hourly.cloud_cover_low, idx),
        mid: getSafe(hourly.cloud_cover_mid, idx),
        high: getSafe(hourly.cloud_cover_high, idx),
      };
    });
  }, [hasData, hourly, currentHourIndex]);

  const N = windowEntries.length;

  // Prioritzem el valor "ara" del bloc current (mateixa font que CloudLayersWidget al
  // dashboard) — hourly[hora actual] pot diferir lleugerament, vegeu la lliçó de Pressió/Confort.
  const currentLow = typeof current?.cloud_cover_low === 'number' ? current.cloud_cover_low : (N > 0 ? windowEntries[0].low : null);
  const currentMid = typeof current?.cloud_cover_mid === 'number' ? current.cloud_cover_mid : (N > 0 ? windowEntries[0].mid : null);
  const currentHigh = typeof current?.cloud_cover_high === 'number' ? current.cloud_cover_high : (N > 0 ? windowEntries[0].high : null);

  const hasAnyCurrent = currentLow !== null || currentMid !== null || currentHigh !== null;
  const effectiveNow = hasAnyCurrent ? calculateEffectiveCloudCover(currentLow ?? 0, currentMid ?? 0, currentHigh ?? 0) : null;
  const severity = getCloudSeverity(effectiveNow, t);

  // --- Capa dominant: la de major cobertura mitjana durant la finestra ---
  const dominantLayer = useMemo(() => {
    if (N === 0) return null;
    const avgOf = (key: LayerKey) => {
      const vals = windowEntries.map(e => e[key]).filter((v): v is number => v !== null);
      return vals.length > 0 ? vals.reduce((a, b) => a + b, 0) / vals.length : -1;
    };
    const avgs: Record<LayerKey, number> = { low: avgOf('low'), mid: avgOf('mid'), high: avgOf('high') };
    const best = (['low', 'mid', 'high'] as LayerKey[]).reduce((a, b) => (avgs[b] > avgs[a] ? b : a));
    return avgs[best] < 0 ? null : best;
  }, [windowEntries, N]);

  const hoursOvercast = useMemo(() => windowEntries.filter(e => {
    if (e.low === null && e.mid === null && e.high === null) return false;
    return calculateEffectiveCloudCover(e.low ?? 0, e.mid ?? 0, e.high ?? 0) >= CLOUDS.OVERCAST;
  }).length, [windowEntries]);

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
  const displayLow = isScrubbing ? activeEntry?.low ?? null : currentLow;
  const displayMid = isScrubbing ? activeEntry?.mid ?? null : currentMid;
  const displayHigh = isScrubbing ? activeEntry?.high ?? null : currentHigh;

  // --- Geometria del gràfic: percentatge 0-100 directe ---
  const valToY = (v: number) => BOTTOM_Y - (Math.max(0, Math.min(100, v)) / 100) * (BOTTOM_Y - TOP_Y);
  const idxToX = (i: number) => N > 1 ? (i / (N - 1)) * CHART_W : 0;

  const buildLinePath = (key: LayerKey) => windowEntries
    .map((e, i) => (e[key] !== null ? `${i === 0 ? 'M' : 'L'} ${idxToX(i)} ${valToY(e[key] as number)}` : null))
    .filter((s): s is string => s !== null)
    .join(' ');

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const lineHigh = useMemo(() => (N === 0 ? '' : buildLinePath('high')), [windowEntries, N]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const lineMid = useMemo(() => (N === 0 ? '' : buildLinePath('mid')), [windowEntries, N]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const lineLow = useMemo(() => (N === 0 ? '' : buildLinePath('low')), [windowEntries, N]);

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
  const dominantLabel = dominantLayer ? t[dominantLayer] : t.unknown;

  return (
    <div role="dialog" aria-modal="true" aria-labelledby="cloudlayers-modal-title" className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-0 sm:p-4 md:p-6 landscape:p-0 landscape:sm:p-4 bg-black/95 backdrop-blur-3xl backdrop-saturate-150 animate-in fade-in duration-200">
      <style>{`
        .cloudlayers-scrollbar { -webkit-overflow-scrolling: touch; }
        .cloudlayers-scrollbar::-webkit-scrollbar { width: 5px; }
        .cloudlayers-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .cloudlayers-scrollbar::-webkit-scrollbar-thumb { background: rgba(56,189,248,0.2); border-radius: 8px; }
        .cloudlayers-scrollbar::-webkit-scrollbar-thumb:hover { background: rgba(56,189,248,0.4); }
      `}</style>

      <div className={`w-full h-[96dvh] sm:h-auto sm:max-h-[90dvh] landscape:h-[100dvh] landscape:sm:h-auto max-w-sm md:max-w-3xl lg:max-w-5xl flex flex-col min-h-0 bg-gradient-to-b ${bgGradient} rounded-t-[24px] sm:rounded-[32px] border-t sm:border ${severity.borderColor} shadow-[0_0_100px_rgba(0,0,0,0.9)] overflow-hidden relative animate-in slide-in-from-bottom-8 sm:zoom-in-95 duration-300`}>
        <div className={MATRIX_BG}></div>
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[130%] h-56 bg-gradient-to-b from-sky-500/10 via-slate-900/5 to-transparent blur-[80px] pointer-events-none z-0"></div>

        {/* Capçalera */}
        <div className="flex justify-between items-center shrink-0 relative z-20 p-4 md:p-6 border-b border-white/[0.04]">
          <div className="flex items-center gap-3">
            <div className={`relative flex items-center justify-center w-10 h-10 rounded-full border bg-black/40 ${severity.borderColor} ${severity.color}`}>
              <Layers className="w-5 h-5" />
            </div>
            <div className="flex flex-col">
              <h2 id="cloudlayers-modal-title" className="text-lg md:text-2xl font-black text-white tracking-tighter drop-shadow-md leading-none">{t.title}</h2>
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
          <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain cloudlayers-scrollbar relative z-10 p-4 md:p-6 space-y-6">

            {/* HEROI: cobertura efectiva actual */}
            <div className="relative rounded-2xl border border-white/5 bg-black/30 backdrop-blur-md p-5 flex flex-col sm:flex-row items-center gap-6">
              <div className="flex flex-col items-center sm:items-start gap-1">
                <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">{t.coverNow}</span>
                <span className={`text-5xl sm:text-6xl font-black tracking-tighter tabular-nums leading-none drop-shadow-xl ${severity.color}`}>
                  {effectiveNow !== null ? Math.round(effectiveNow) : '--'}
                </span>
                <span className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">%</span>
              </div>
              <div className="flex flex-col items-center sm:items-start gap-2 flex-1">
                <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md border backdrop-blur-md bg-black/40 w-fit ${severity.borderColor}`}>
                  <Cloud className={`w-3.5 h-3.5 ${severity.color}`} />
                  <span className={`text-xs font-black uppercase tracking-wider ${severity.color}`}>{severity.label}</span>
                </div>
              </div>
            </div>

            {/* CAPES: valors actuals per capa */}
            <div className="grid grid-cols-3 gap-3">
              <LayerCard label={t.high} value={displayHigh} color={LAYER_STROKE.high} />
              <LayerCard label={t.mid} value={displayMid} color={LAYER_STROKE.mid} />
              <LayerCard label={t.low} value={displayLow} color={LAYER_STROKE.low} />
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
                aria-valuetext={activeEntry ? `${activeEntry.timeStr.slice(11, 16)} · ${t.high} ${activeEntry.high ?? '--'}% · ${t.mid} ${activeEntry.mid ?? '--'}% · ${t.low} ${activeEntry.low ?? '--'}%` : undefined}
                onKeyDown={handleKeyDown}
              >
                <line x1="0" y1={valToY(CLOUDS.FEW)} x2={CHART_W} y2={valToY(CLOUDS.FEW)} stroke="#34d399" strokeOpacity="0.2" strokeWidth="1" strokeDasharray="3 3" />
                <line x1="0" y1={valToY(CLOUDS.SCATTERED)} x2={CHART_W} y2={valToY(CLOUDS.SCATTERED)} stroke="#38bdf8" strokeOpacity="0.2" strokeWidth="1" strokeDasharray="3 3" />
                <line x1="0" y1={valToY(CLOUDS.OVERCAST)} x2={CHART_W} y2={valToY(CLOUDS.OVERCAST)} stroke="#818cf8" strokeOpacity="0.25" strokeWidth="1" strokeDasharray="3 3" />

                {dayMarkers.map(m => (
                  <line key={m.i} x1={idxToX(m.i)} y1={TOP_Y} x2={idxToX(m.i)} y2={BOTTOM_Y} stroke="#475569" strokeOpacity="0.4" strokeWidth="1" strokeDasharray="1 3" />
                ))}

                {lineHigh && <path d={lineHigh} fill="none" stroke={LAYER_STROKE.high} strokeWidth="2" strokeLinecap="round" opacity="0.9" />}
                {lineMid && <path d={lineMid} fill="none" stroke={LAYER_STROKE.mid} strokeWidth="2" strokeLinecap="round" opacity="0.9" />}
                {lineLow && <path d={lineLow} fill="none" stroke={LAYER_STROKE.low} strokeWidth="2" strokeLinecap="round" opacity="0.9" />}

                {activeEntry && (
                  <g>
                    {isScrubbing && <line x1={idxToX(activeIndex)} x2={idxToX(activeIndex)} y1={TOP_Y} y2={BOTTOM_Y} stroke="#94a3b8" strokeWidth="1" strokeDasharray="2 2" opacity="0.3" />}
                    {activeEntry.high !== null && <circle cx={idxToX(activeIndex)} cy={valToY(activeEntry.high)} r="3.5" fill={LAYER_STROKE.high} opacity="0.95" />}
                    {activeEntry.mid !== null && <circle cx={idxToX(activeIndex)} cy={valToY(activeEntry.mid)} r="3.5" fill={LAYER_STROKE.mid} opacity="0.95" />}
                    {activeEntry.low !== null && <circle cx={idxToX(activeIndex)} cy={valToY(activeEntry.low)} r="3.5" fill={LAYER_STROKE.low} opacity="0.95" />}
                  </g>
                )}
              </svg>

              {/* Llegenda de colors */}
              <div className="flex items-center justify-center gap-4 mt-2 relative z-10">
                <LegendDot color={LAYER_STROKE.high} label={t.high} />
                <LegendDot color={LAYER_STROKE.mid} label={t.mid} />
                <LegendDot color={LAYER_STROKE.low} label={t.low} />
              </div>
            </div>

            {/* TARGETES D'ESTADÍSTIQUES */}
            <StatsSection t={t} dominantLabel={dominantLabel} hoursOvercast={hoursOvercast} />
          </div>
        )}
      </div>
    </div>
  );
}

interface LayerCardProps { label: string; value: number | null; color: string; }

const LayerCard = memo(function LayerCard({ label, value, color }: LayerCardProps) {
  return (
    <div className="rounded-xl border border-white/5 bg-black/30 backdrop-blur-md p-3 flex flex-col items-center gap-1">
      <span className="w-2 h-2 rounded-full" style={{ backgroundColor: color, boxShadow: `0 0 8px ${color}` }}></span>
      <span className="text-xl font-black tabular-nums leading-none text-white">
        {value !== null ? Math.round(value) : '--'}<span className="text-[10px] align-top text-slate-400 ml-0.5">%</span>
      </span>
      <span className="text-[9px] font-black uppercase tracking-widest text-slate-500">{label}</span>
    </div>
  );
});

const LegendDot = memo(function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="w-2 h-2 rounded-full" style={{ backgroundColor: color }}></span>
      <span className="text-[9px] font-bold uppercase tracking-widest text-slate-400">{label}</span>
    </div>
  );
});

interface StatsSectionProps {
  t: Record<string, string>;
  dominantLabel: string;
  hoursOvercast: number;
}

const StatsSection = memo(function StatsSection({ t, dominantLabel, hoursOvercast }: StatsSectionProps) {
  return (
    <div className="grid grid-cols-2 gap-3">
      <StatCard label={t.dominantLayer} value={dominantLabel} icon={<Layers className="w-3.5 h-3.5" />} />
      <StatCard label={t.hoursOvercast} value={`${hoursOvercast}${t.hoursShort}`} icon={<Cloud className="w-3.5 h-3.5" />} />
    </div>
  );
});
