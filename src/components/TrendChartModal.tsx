import { memo, useEffect, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import { LineChart, X, Droplets } from 'lucide-react';
import { getWeatherIcon } from './WeatherIcons';
import { resolveDailyCode } from '../utils/dailyWeatherCode';
import { hoursOfDate, resolveDailyExtremes, averageDaylightClouds } from '../utils/dailyExtremes';
import { resolveDailySpread, hasVisibleRange, type DailyModelSpread } from '../utils/dailyModelSpread';
import { CONFIDENCE_TEXT } from '../utils/forecastConfidenceText';
import { isLikelyWet } from '../utils/precipSignal';
import { ReliabilityDots } from './ReliabilityDots';
import { buildCapsuleGradient } from '../utils/temperatureColors';
import { summarizeTrend } from '../utils/trendSummary';
import { getSafeArrayNum, extractValidArrayNum } from '../utils/weatherMath';
import { getSafeLocale, formatPrecipitation } from '../utils/formatters';
import { useDialogFocus } from '../hooks/useDialogFocus';
import { Language } from '../translations';
import { StrictDailyWeather, ExtendedWeatherData } from '../types/weatherLogicTypes';
import { MATRIX_BG } from './widgets/widgetStyles';

export interface ChartDataPoint {
  time: string;
  temp: number | null;
  precip: number | null;
  [key: string]: unknown;
}

export interface TrendChartModalProps {
  isOpen: boolean;
  onClose: () => void;
  dailyData: StrictDailyWeather;
  chartData: ChartDataPoint[];
  /** Codis del motor de les hores de cada dia ("YYYY-MM-DD" → codis): la icona del dia es tria amb ells. */
  dayHourCodes?: Record<string, Array<number | null>>;
  lang: Language;
  /** Latitud, per a la correcció d'inversió tèrmica (mateixa que la llista de 7 dies). */
  latitude?: number;
  /** Previsió diària dels models globals (ECMWF/GFS/ICON): d'aquí surt el desacord entre models de cada dia. */
  dailyComparison?: ExtendedWeatherData['dailyComparison'];
  /** Etiqueta del model regional actiu (p. ex. "AROME HD"), o null/absent si les dades són del model global. */
  regionalModelLabel?: string | null;
  /**
   * Si hi és, cada dia de la fila inferior és un botó que hi obre el detall (índex dins `dailyData`, 0 = avui).
   * El TANCAMENT del gràfic el fa qui la passa (vegeu useTacticalModal.closeModalThen): aquí no es crida `onClose`.
   */
  onDayClick?: (dayIndex: number) => void;
}

// DOCTRINA RISC ZERO: una xifra que falta és null i es pinta com a "--", mai com un 0 fals
// (un 0° o un "0%" inventats deformarien l'escala i afirmarien un dia sec que ningú ha confirmat).
interface TrendDay {
  /** Índex del dia dins `dailyData` (0 = avui; el gràfic mostra 1..7). */
  dayIndex: number;
  max: number | null;
  min: number | null;
  code: number;
  avgClouds: number | null;
  wind: number;
  precipProb: number | null;
  precipSum: number | null;
  snowSum: number;
  dayInitial: string;
  /** Nom complet del dia ("dilluns"), per a l'etiqueta accessible. */
  dayName: string;
  /** Desacord entre models sobre les temperatures d'aquest dia (bigotis i fiabilitat). */
  spread: DailyModelSpread;
  /** Alguna de les seves temperatures extremes surt del model regional (i no del global). */
  regional: boolean;
}

// Només els dies amb màxima I mínima tenen càpsula, entren a l'escala i a la línia de tendència.
const isComplete = (d: TrendDay): d is TrendDay & { max: number; min: number } =>
  d.max !== null && d.min !== null;

const formatDegrees = (val: number | null): string => (val !== null ? `${Math.round(val)}°` : '--°');

// Colors de les dues línies de tendència (màximes càlides, mínimes fresques): la legenda usa els mateixos.
const MAX_LINE_COLOR = '#fb923c';
const MIN_LINE_COLOR = '#38bdf8';

/** Trams consecutius de dies amb la mateixa font (model regional o global), per a la tira d'origen. */
const sourceRuns = (days: ReadonlyArray<{ regional: boolean }>): Array<{ regional: boolean; span: number }> => {
  const runs: Array<{ regional: boolean; span: number }> = [];
  for (const d of days) {
    const last = runs[runs.length - 1];
    if (last && last.regional === d.regional) last.span += 1;
    else runs.push({ regional: d.regional, span: 1 });
  }
  return runs;
};

/** Path SVG (coordenades 0-100) que uneix `points`; un `null` trenca el fil (mai no es dibuixa per sobre d'un forat). */
const buildLinePath = (points: ReadonlyArray<{ x: number; y: number } | null>): string => {
  let path = '';
  let penDown = false;
  for (const p of points) {
    if (!p) { penDown = false; continue; }
    path += `${penDown ? 'L' : 'M'}${p.x},${p.y} `;
    penDown = true;
  }
  return path;
};

const fillTemplate = (template: string, vars: Record<string, number>): string =>
  template.replace(/\{(\w+)\}/g, (_, key: string) => (key in vars ? String(Math.round(vars[key])) : ''));

/** Bigoti vertical (amb topalls) que marca el rang entre models d'una temperatura, a la dreta de la càpsula. */
const ModelRangeWhisker = ({ x, top, height, title }: { x: number; top: number; height: number; title: string }) => (
  <div
    data-testid="model-range"
    title={title}
    className="absolute w-1.5 ml-3.5 md:ml-[18px] border-y border-slate-300/60"
    style={{ left: `${x}%`, top: `${top}%`, height: `${height}%` }}
  >
    <div className="absolute left-1/2 top-0 bottom-0 w-px -translate-x-1/2 bg-slate-300/60"></div>
  </div>
);

const I18N_MODAL = {
  ca: {
    title: "Gràfic Temperatures", trend: "Tendència 7 Dies",
    ...CONFIDENCE_TEXT.ca, reliabilityLegend: "Fiabilitat (acord entre models)",
    maxLine: "Màximes", minLine: "Mínimes",
    sourceHint: "Les màximes i mínimes dels primers dies vénen del model regional; a partir d'aquí, del model global. Entre tots dos pot haver-hi un salt que no és un canvi de temps.",
    aria: { max: "màxima", min: "mínima", rain: "pluja", openDay: "veure el detall del dia" },
    summary: {
      cooling: "Refredament: la màxima baixa de {from}° a {to}° al llarg de la setmana.",
      warming: "Escalfament: la màxima puja de {from}° a {to}° al llarg de la setmana.",
      variable: "Setmana variable: les màximes oscil·len entre {low}° i {high}°.",
      stable: "Temperatures estables: màximes entre {low}° i {high}°.",
      uncertain: "Poc segur: els models discrepen gairebé tant com el canvi."
    }
  },
  es: {
    title: "Gráfico Temperaturas", trend: "Tendencia 7 Días",
    ...CONFIDENCE_TEXT.es, reliabilityLegend: "Fiabilidad (acuerdo entre modelos)",
    maxLine: "Máximas", minLine: "Mínimas",
    sourceHint: "Las máximas y mínimas de los primeros días vienen del modelo regional; a partir de ahí, del modelo global. Entre ambos puede haber un salto que no es un cambio de tiempo.",
    aria: { max: "máxima", min: "mínima", rain: "lluvia", openDay: "ver el detalle del día" },
    summary: {
      cooling: "Enfriamiento: la máxima baja de {from}° a {to}° a lo largo de la semana.",
      warming: "Calentamiento: la máxima sube de {from}° a {to}° a lo largo de la semana.",
      variable: "Semana variable: las máximas oscilan entre {low}° y {high}°.",
      stable: "Temperaturas estables: máximas entre {low}° y {high}°.",
      uncertain: "Poco seguro: los modelos discrepan casi tanto como el cambio."
    }
  },
  fr: {
    title: "Graphe Températures", trend: "Tendance 7 Jours",
    ...CONFIDENCE_TEXT.fr, reliabilityLegend: "Fiabilité (accord entre modèles)",
    maxLine: "Maximales", minLine: "Minimales",
    sourceHint: "Les maximales et minimales des premiers jours viennent du modèle régional ; ensuite, du modèle global. Entre les deux, un saut peut apparaître sans que le temps ait changé.",
    aria: { max: "maximale", min: "minimale", rain: "pluie", openDay: "voir le détail du jour" },
    summary: {
      cooling: "Refroidissement : la maximale passe de {from}° à {to}° sur la semaine.",
      warming: "Réchauffement : la maximale passe de {from}° à {to}° sur la semaine.",
      variable: "Semaine variable : les maximales oscillent entre {low}° et {high}°.",
      stable: "Températures stables : maximales entre {low}° et {high}°.",
      uncertain: "Peu sûr : les modèles divergent presque autant que le changement."
    }
  },
  en: {
    title: "Temperature Chart", trend: "7-Day Trend",
    ...CONFIDENCE_TEXT.en, reliabilityLegend: "Reliability (model agreement)",
    maxLine: "Highs", minLine: "Lows",
    sourceHint: "Highs and lows for the first days come from the regional model; after that, from the global model. There can be a jump between the two that is not a change in the weather.",
    aria: { max: "high", min: "low", rain: "rain", openDay: "open day details" },
    summary: {
      cooling: "Cooling: the high drops from {from}° to {to}° over the week.",
      warming: "Warming: the high rises from {from}° to {to}° over the week.",
      variable: "Variable week: highs swing between {low}° and {high}°.",
      stable: "Stable temperatures: highs between {low}° and {high}°.",
      uncertain: "Uncertain: the models disagree almost as much as the change."
    }
  }
};

// [FIX PRECISIÓ] Mateixa correcció que a ForecastSection.tsx: l'aria-label
// estava fix en català independentment de `lang`.
const I18N_ARIA_CLOSE = {
  ca: "Tancar modal",
  es: "Cerrar modal",
  fr: "Fermer la fenêtre",
  en: "Close modal"
};


const TrendChartModal = memo(function TrendChartModal({
  isOpen, onClose, dailyData, chartData, dayHourCodes, lang, latitude, dailyComparison, regionalModelLabel, onDayClick
}: TrendChartModalProps) {

  const dialogRef = useRef<HTMLDivElement>(null);
  // Focus dins el diàleg en obrir-lo, Tab que hi dóna la volta i retorn del focus en tancar-lo.
  useDialogFocus(isOpen, dialogRef);

  // EFECTE UX PREMIUM: Bloqueig scroll
  useEffect(() => {
    if (isOpen && typeof document !== 'undefined') {
      const originalOverflow = window.getComputedStyle(document.body).overflow;
      document.body.style.overflow = 'hidden';

      return () => {
        document.body.style.overflow = originalOverflow;
      };
    }
  }, [isOpen]);

  // EFECTE UX ESCRIPTORI: Tancar amb Escape
  useEffect(() => {
    if (!isOpen || typeof document === 'undefined') return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  // [FIX] Aquest càlcul (map + filtre de chartData per dia + ajust de núvols)
  // corria directament al cos del render, sense useMemo. Encara que ja estava
  // protegit per `isOpen` (no corre si el modal és tancat), un cop obert
  // qualsevol re-render el tornava a recalcular sencer encara que dailyData/
  // chartData/lang no haguessin canviat. Cal situar-lo ABANS dels `return null`
  // condicionals de sota (regles dels Hooks).
  const trendData = useMemo((): TrendDay[] => {
    if (!dailyData || !Array.isArray(dailyData.time) || dailyData.time.length < 8) return [];

    return dailyData.time.slice(1, 8).map((rawDate: unknown, index: number): TrendDay => {
      const i = index + 1;
      const rawMax = extractValidArrayNum(dailyData.temperature_2m_max, i);
      const rawMin = extractValidArrayNum(dailyData.temperature_2m_min, i);
      const rawCode = getSafeArrayNum(dailyData.weather_code, i);
      const wind = getSafeArrayNum(dailyData.wind_speed_10m_max, i);
      const precipProb = extractValidArrayNum(dailyData.precipitation_probability_max, i);
      const precipSum = extractValidArrayNum(dailyData.precipitation_sum, i);
      const snowSum = getSafeArrayNum(dailyData.snowfall_sum, i);

      let dayInitial = '';
      let dayName = '';
      let code = rawCode;
      let max = rawMax;
      let min = rawMin;
      let regional = false;
      let avgClouds: number | null = null;

      if (typeof rawDate === 'string') {
        // [FIX PRECISIÓ] Vegeu el mateix fix a ForecastSection.tsx: forcem hora local
        // perquè "YYYY-MM-DD" no es llegeixi com a mitjanit UTC.
        const date = new Date(rawDate + 'T12:00:00');
        if (!isNaN(date.getTime())) {
          dayInitial = date.toLocaleDateString(getSafeLocale(lang), { weekday: 'short' })
            .replace(/\./g, '')
            .toUpperCase();
          dayName = date.toLocaleDateString(getSafeLocale(lang), { weekday: 'long' });
        }

        const dateOnly = rawDate.slice(0, 10);
        const dayHours = hoursOfDate(chartData, dateOnly);

        // Màxima/mínima amb la mateixa font que la llista de 7 dies (utils/dailyExtremes.ts):
        // amb la correcció d'inversió tèrmica, perquè gràfic i llista mai no discrepin.
        const extremes = resolveDailyExtremes(rawMax, rawMin, dayHours, latitude);
        ({ max, min } = extremes);
        regional = extremes.maxRegional || extremes.minRegional;

        // Cel diürn real — mateixa regla oficial que la resta de l'app
        // (utils/dailyWeatherCode.ts; un codi diari de boira no compta com a condició de tot el dia).
        avgClouds = averageDaylightClouds(dayHours);
        // Sense núvols ni hores del motor, resolveDailyCode torna el codi cru: es pot cridar sempre.
        code = resolveDailyCode(rawCode, avgClouds, dayHourCodes?.[dateOnly]);
      }

      const spread = resolveDailySpread(i, max, min, dailyData, dailyComparison);

      return { dayIndex: i, max, min, code, avgClouds, wind, precipProb, precipSum, snowSum, dayInitial, dayName, spread, regional };
    });
  }, [dailyData, chartData, dayHourCodes, lang, latitude, dailyComparison]);

  if (!isOpen) return null;
  if (!dailyData || !Array.isArray(dailyData.time) || dailyData.time.length < 8) return null;
  if (typeof document === 'undefined') return null;
  if (trendData.length === 0) return null;

  const mDict = I18N_MODAL[lang] || I18N_MODAL['ca'];
  const closeAriaLabel = I18N_ARIA_CLOSE[lang] || I18N_ARIA_CLOSE['ca'];

  // 2. MOTOR MATEMÀTIC DE COLUMNES DE RANG (Candlestick)
  // L'escala només compta els dies complets: un dia sense dada no pot arrossegar-la cap a 0°.
  const completeDays = trendData.filter(isComplete);
  const hasScale = completeDays.length > 0;
  // Els rangs entre models també hi entren: així cap bigoti no queda tallat pel marge del gràfic.
  const chartMax = hasScale ? Math.max(...completeDays.map(d => Math.max(d.max, d.spread.maxRange?.high ?? d.max))) : 1;
  const chartMin = hasScale ? Math.min(...completeDays.map(d => Math.min(d.min, d.spread.minRange?.low ?? d.min))) : 0;

  const padding = chartMax === chartMin ? 2 : (chartMax - chartMin) * 0.25;
  const yMax = chartMax + padding;
  const yMin = chartMin - padding;
  const range = yMax - yMin;

  const N = trendData.length;
  const getX = (index: number) => ((index + 0.5) / N) * 100;
  const getY = (val: number) => ((yMax - val) / range) * 100;

  // Fils de tendència: màximes (càlid) i mínimes (fresc) dels dies complets; un dia sense dada els trenca
  // (no s'inventa cap punt ni es dibuixa una recta per sobre del forat).
  const maxPath = buildLinePath(trendData.map((d, i) => (isComplete(d) ? { x: getX(i), y: getY(d.max) } : null)));
  const minPath = buildLinePath(trendData.map((d, i) => (isComplete(d) ? { x: getX(i), y: getY(d.min) } : null)));

  const showRangeLegend = completeDays.some(d => hasVisibleRange(d.spread.maxRange) || hasVisibleRange(d.spread.minRange));
  const showReliabilityLegend = trendData.some(d => d.spread.reliability !== null);
  const showSourceStrip = trendData.some(d => d.regional);
  const formatRange = (r: { low: number; high: number }) => `${Math.round(r.low)}–${Math.round(r.high)}°`;

  const summary = summarizeTrend(trendData.map(d => ({ max: d.max, maxRange: d.spread.maxRange })));
  const summaryText = summary
    ? fillTemplate(mDict.summary[summary.kind], { from: summary.from, to: summary.to, low: summary.low, high: summary.high })
    : null;

  // Etiqueta accessible d'un dia: tot el que el gràfic diu visualment, en una frase.
  const dayLabel = (d: TrendDay): string => {
    const parts = [
      d.dayName || d.dayInitial,
      `${mDict.aria.max} ${formatDegrees(d.max)}`,
      `${mDict.aria.min} ${formatDegrees(d.min)}`,
      `${mDict.aria.rain} ${d.precipProb !== null ? `${d.precipProb}%` : '--'}`,
      d.precipSum !== null && d.precipSum > 0 ? formatPrecipitation(d.precipSum, d.snowSum) : null,
      d.spread.reliability ? mDict.reliability[d.spread.reliability] : null,
      showSourceStrip ? (d.regional ? (regionalModelLabel || 'HD') : mDict.globalModel) : null
    ].filter((p): p is string => !!p);
    const text = parts.join(', ');
    return onDayClick ? `${text}. ${mDict.aria.openDay}` : text;
  };

  const dayCellClass = 'flex flex-col items-center justify-end gap-1 md:gap-2 flex-1 group rounded-xl';
  const dayCellContent = (d: TrendDay) => (
    <>
      <span className="text-[10px] md:text-sm font-black text-slate-400 uppercase tracking-widest">
        {d.dayInitial}
      </span>

      <div className="scale-[0.85] md:scale-[1.3] transform-gpu transition-transform duration-300 group-hover:scale-100 md:group-hover:scale-[1.4] my-1 md:my-2">
        {getWeatherIcon(d.code, "w-8 h-8 md:w-12 md:h-12", true, 0, d.wind, null, 0, d.avgClouds)}
      </div>

      <div className={`flex items-center gap-0.5 md:gap-1.5 mt-1 px-1 py-0.5 md:px-3 md:py-1.5 rounded border ${isLikelyWet(d.precipProb) ? 'bg-blue-500/10 border-blue-500/20' : 'bg-transparent border-transparent opacity-40'}`}>
        <Droplets className={`hidden md:block md:w-4 md:h-4 ${isLikelyWet(d.precipProb) ? 'text-blue-400' : 'text-slate-600'}`} />
        <span className={`text-[10px] md:text-[11px] font-black tabular-nums ${isLikelyWet(d.precipProb) ? 'text-blue-300' : 'text-slate-500'}`}>
          {d.precipProb !== null ? `${d.precipProb}%` : '--'}
        </span>
      </div>

      {/* Quantitat prevista (només si n'hi ha); l'espai es reserva perquè les columnes quedin alineades */}
      <span data-testid="precip-amount" className="min-h-[12px] md:min-h-[14px] text-[10px] font-black tabular-nums text-cyan-300/90">
        {d.precipSum !== null && d.precipSum > 0 ? formatPrecipitation(d.precipSum, d.snowSum) : ''}
      </span>

      {d.spread.reliability
        ? <ReliabilityDots level={d.spread.reliability} label={mDict.reliability[d.spread.reliability]} />
        : <span className="h-1.5" />}
    </>
  );

  // 3. RENDERITZAT SPATIAL UI PORTAL
  const modalContent = (
    <div
      ref={dialogRef}
      role="dialog"
      aria-modal="true"
      aria-labelledby="trend-chart-modal-title"
      aria-describedby={summaryText ? 'trend-chart-summary' : undefined}
      className="fixed inset-0 z-[9999] flex items-center justify-center p-2 sm:p-6 bg-black/80 backdrop-blur-xl transition-opacity overflow-y-auto"
    >
      <div className="absolute inset-0 cursor-pointer" onClick={onClose} aria-hidden="true"></div>

      <div className="w-full max-w-5xl bg-gradient-to-br from-[#0f111a] to-black border border-white/10 rounded-[2rem] shadow-[0_20px_50px_rgba(0,0,0,0.7)] relative overflow-hidden transform-gpu flex flex-col my-auto max-h-[95vh] pointer-events-auto">
        <div className={MATRIX_BG}></div>
        <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/10 rounded-full blur-[80px] pointer-events-none mix-blend-screen z-0"></div>

        {/* HEADER MODAL */}
        <div className="flex items-center justify-between p-4 md:p-6 border-b border-white/5 relative z-10 shrink-0">
          <div className="flex items-center gap-3 md:gap-4">
            <div className="p-2 md:p-3 rounded-xl bg-indigo-500/20 border border-indigo-500/30">
              <LineChart className="w-5 h-5 md:w-7 md:h-7 text-indigo-400" />
            </div>
            <div>
              <h2 id="trend-chart-modal-title" className="text-sm md:text-xl font-black uppercase tracking-widest text-white leading-none mb-1 md:mb-2">
                {mDict.title}
              </h2>
              <p className="text-[10px] md:text-xs font-bold text-slate-400 uppercase tracking-widest">
                {mDict.trend}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label={closeAriaLabel}
            className="p-2 md:p-3 rounded-full bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white transition-colors border border-white/5 cursor-pointer focus-visible:outline focus-visible:outline-2 focus-visible:outline-indigo-400"
          >
            <X className="w-5 h-5 md:w-6 md:h-6" />
          </button>
        </div>

        {/* CONTINGUT GRÀFIC I DADES: columna flexible que s'ajusta a l'alçada de la finestra
            (el gràfic encongeix abans que res no quedi tallat; si ni així hi cap, hi ha scroll) */}
        <div className="p-4 md:p-6 relative z-10 flex-1 min-h-0 overflow-y-auto overflow-x-hidden flex flex-col">

          <style>{`
            @keyframes fadeUpAnim {
              from { opacity: 0; transform: translateY(15px) translateX(-50%); }
              to { opacity: 1; transform: translateY(0) translateX(-50%); }
            }
            @keyframes drawLine {
              to { stroke-dashoffset: 0; }
            }
            .anim-draw-line {
              stroke-dasharray: 2000;
              stroke-dashoffset: 2000;
              animation: drawLine 1.5s ease-out forwards;
            }
            .anim-column {
              opacity: 0;
              animation: fadeUpAnim 0.8s cubic-bezier(0.2, 0.8, 0.2, 1) forwards;
            }
            @media (prefers-reduced-motion: reduce) {
              .anim-draw-line { animation: none; stroke-dashoffset: 0; }
              .anim-column { animation: none; opacity: 1; }
            }
          `}</style>

          {summaryText && (
            <p id="trend-chart-summary" data-testid="trend-summary" className="shrink-0 text-[11px] md:text-sm font-bold text-slate-300 leading-snug">
              {summaryText}
              {summary?.uncertain && (
                <span data-testid="trend-uncertain" className="text-amber-300">{' '}{mDict.summary.uncertain}</span>
              )}
            </p>
          )}

          {/* CONTENIDOR DEL GRÀFIC (Dona espai dalt i baix pels textos). Decoratiu per a lectors de pantalla:
              la mateixa informació surt, dia per dia, a l'etiqueta de la fila inferior. */}
          <div aria-hidden="true" className="relative w-full flex-[1_1_260px] md:flex-[1_1_400px] min-h-[180px] mt-4 mb-4">

              {/* FILS DE TENDÈNCIA (Fons): màximes (càlid) i mínimes (fresc) */}
              <svg className="absolute inset-0 w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none">
                <path
                  data-testid="trend-line-max"
                  d={maxPath}
                  fill="none"
                  stroke={MAX_LINE_COLOR}
                  strokeWidth="1.5"
                  strokeLinejoin="round"
                  vectorEffect="non-scaling-stroke"
                  className="anim-draw-line opacity-50"
                />
                <path
                  data-testid="trend-line-min"
                  d={minPath}
                  fill="none"
                  stroke={MIN_LINE_COLOR}
                  strokeWidth="1.5"
                  strokeLinejoin="round"
                  vectorEffect="non-scaling-stroke"
                  className="anim-draw-line opacity-40"
                />
              </svg>

              {/* BIGOTIS: rang de la màxima i de la mínima entre models, a la dreta de la càpsula */}
              {completeDays.length > 0 && trendData.map((d, i) => {
                if (!isComplete(d)) return null;
                const whiskers = [
                  { key: 'max', range: d.spread.maxRange },
                  { key: 'min', range: d.spread.minRange }
                ];
                return whiskers.map(({ key, range }) =>
                  hasVisibleRange(range) ? (
                    <ModelRangeWhisker
                      key={`range-${key}-${i}`}
                      x={getX(i)}
                      top={getY(range.high)}
                      height={getY(range.low) - getY(range.high)}
                      title={`${mDict.rangeLegend}: ${formatRange(range)}`}
                    />
                  ) : null
                );
              })}

              {/* COLUMNES DE RANG (Candlesticks HTML) */}
              {trendData.map((d, i) => {
                const complete = isComplete(d);
                // Sense dada, el marcador buit ocupa una franja fixa al mig del gràfic.
                const yMaxPos = complete ? getY(d.max) : 44;
                const yMinPos = complete ? getY(d.min) : 56;
                // El color de cada alçada de la càpsula és el de la temperatura que hi ha a aquella alçada.
                const capsuleStyle = complete ? { background: buildCapsuleGradient(d.max, d.min) } : undefined;

                return (
                  <div
                    key={`candlestick-${i}`}
                    data-testid="trend-column"
                    className="absolute flex flex-col items-center anim-column"
                    style={{
                      left: `${getX(i)}%`,
                      top: `${yMaxPos}%`,
                      bottom: `${100 - yMinPos}%`,
                      transform: 'translateX(-50%)',
                      animationDelay: `${i * 0.08}s` // Efecte cascada fluid
                    }}
                  >
                    {/* Màxima (Dalt) */}
                    <span className={`absolute bottom-full mb-1.5 md:mb-2 text-[11px] md:text-sm font-black drop-shadow-md ${d.max !== null ? 'text-white' : 'text-slate-500'}`}>
                      {formatDegrees(d.max)}
                    </span>

                    {/* Càpsula Tèrmica (buida i discontínua si el dia no té màxima i mínima) */}
                    <div
                      className={`w-2.5 md:w-4 h-full rounded-full border ${complete ? 'shadow-[0_0_15px_rgba(0,0,0,0.5)] border-white/20' : 'border-dashed border-slate-600'}`}
                      style={{
                        ...capsuleStyle,
                        minHeight: '12px' // Assegura que mai col·lapsa a 0px si min == max
                      }}
                    ></div>

                    {/* Mínima (Baix) */}
                    <span className={`absolute top-full mt-1.5 md:mt-2 text-[10px] md:text-sm font-bold drop-shadow-md ${d.min !== null ? 'text-slate-400' : 'text-slate-500'}`}>
                      {formatDegrees(d.min)}
                    </span>
                  </div>
                );
              })}
          </div>

          {/* ORIGEN DE LES DADES: on la sèrie passa del model regional al global (un salt aquí no és canvi de temps) */}
          {showSourceStrip && (
            <div aria-hidden="true" className="shrink-0 grid grid-cols-7 gap-px w-full" title={mDict.sourceHint}>
              {sourceRuns(trendData).map((run, k) => (
                <div
                  key={`source-${k}`}
                  data-testid="source-run"
                  data-regional={run.regional}
                  className={`text-center truncate rounded border py-0.5 text-[9px] md:text-[10px] font-black uppercase tracking-widest ${run.regional ? 'bg-cyan-500/10 border-cyan-500/20 text-cyan-300' : 'bg-white/5 border-white/5 text-slate-500'}`}
                  style={{ gridColumn: `span ${run.span}` }}
                >
                  {run.regional ? (regionalModelLabel || 'HD') : mDict.globalModel}
                </div>
              ))}
            </div>
          )}

          {/* BARRA INFERIOR: Dia, Icona, Pluja (probabilitat i quantitat) i fiabilitat.
              Amb `onDayClick`, cada dia és un botó que n'obre el detall. */}
          <div className="shrink-0 grid grid-cols-7 w-full mt-4 md:mt-6 border-t border-white/5 pt-4">
            {trendData.map((d, i) => onDayClick ? (
              <button
                key={`col-${i}`}
                type="button"
                data-testid="trend-day"
                onClick={() => onDayClick(d.dayIndex)}
                aria-label={dayLabel(d)}
                className={`${dayCellClass} cursor-pointer hover:bg-white/[0.04] transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-indigo-400`}
              >
                {dayCellContent(d)}
              </button>
            ) : (
              <div key={`col-${i}`} data-testid="trend-day" role="group" aria-label={dayLabel(d)} className={dayCellClass}>
                {dayCellContent(d)}
              </div>
            ))}
          </div>

          {/* LLEGENDA */}
          {hasScale && (
            <div className="shrink-0 flex flex-wrap items-center justify-center gap-x-5 gap-y-1 mt-3 md:mt-4 text-[10px] md:text-[11px] font-bold uppercase tracking-widest text-slate-500">
              <span className="flex items-center gap-2">
                <span aria-hidden="true" className="inline-block w-4 h-0.5 rounded-full" style={{ backgroundColor: MAX_LINE_COLOR, opacity: 0.7 }}></span>
                {mDict.maxLine}
              </span>
              <span className="flex items-center gap-2">
                <span aria-hidden="true" className="inline-block w-4 h-0.5 rounded-full" style={{ backgroundColor: MIN_LINE_COLOR, opacity: 0.7 }}></span>
                {mDict.minLine}
              </span>
              {showRangeLegend && (
                <span className="flex items-center gap-2">
                  <span aria-hidden="true" className="relative inline-block w-1.5 h-3.5 border-y border-slate-300/60">
                    <span className="absolute left-1/2 top-0 bottom-0 w-px -translate-x-1/2 bg-slate-300/60"></span>
                  </span>
                  {mDict.rangeLegend}
                </span>
              )}
              {showReliabilityLegend && (
                <span className="flex items-center gap-2">
                  <ReliabilityDots level="medium" />
                  {mDict.reliabilityLegend}
                </span>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
});

export default TrendChartModal;
