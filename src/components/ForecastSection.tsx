// src/components/ForecastSection.tsx
// La llista de la setmana de la pestanya Previsió: avui i els 7 dies següents. Cada dia porta la seva "franja del cel"
// (utils/daySky.ts): el cel de cada hora, de 00 a 24 h, perquè es vegi QUAN plou o fa sol, no només si en farà.
// Al mòbil cada dia fa dues línies (dades a dalt, franja a sota); a partir de 768 px, una sola línia amb la franja
// en una columna, i les franges apilades es llegeixen com un mosaic de dies i nits.
import { memo, useCallback, useMemo } from 'react';
import { LineChart } from 'lucide-react';
import { getWeatherIcon } from './WeatherIcons';
import { TRANSLATIONS, Language } from '../translations';
import { formatPrecipitation, getSafeLocale } from '../utils/formatters';
import { getSafeArrayNum, extractValidArrayNum } from '../utils/weatherMath';
import { StrictDailyWeather, ExtendedWeatherData } from '../types/weatherLogicTypes';
import { hoursOfDate, resolveDailyExtremes, averageDaylightClouds, type HourlyPoint } from '../utils/dailyExtremes';
import { resolveDailyCode } from '../utils/dailyWeatherCode';
import { mainPrecipCenter, skyKindsPresent, skyStripBackground, SKY_COLORS, type SkyHour, type SkyKind } from '../utils/daySky';
import { MATRIX_BG } from './widgets/widgetStyles';

import { useTacticalModal } from '../hooks/useTacticalModal';
import TrendChartModal from './TrendChartModal';

export interface ChartDataPoint {
  time: string;
  temp: number | null;
  precip: number | null;
  [key: string]: unknown;
}

// [NETEJA] Es manté exportada per si algun altre fitxer l'usa per tipar
// calculations.comparisonData; ForecastSection ja no en fa ús intern des que
// s'ha eliminat el bloc mort de SmartForecastCharts (punt 6 de l'auditoria).
export interface ComparisonData {
  ecmwf?: ChartDataPoint[];
  gfs: ChartDataPoint[];
  icon: ChartDataPoint[];
  [key: string]: unknown;
}

interface ForecastSectionProps {
  /** Hores de la previsió (calculations.chartDataFull): comencen a l'hora actual. */
  chartData: ChartDataPoint[];
  dailyData: StrictDailyWeather;
  /** Codis del motor de les hores de cada dia ("YYYY-MM-DD" → codis): la icona del dia es tria amb ells. */
  dayHourCodes?: Record<string, Array<number | null>>;
  /** Franja del cel de cada dia ("YYYY-MM-DD" → hores), amb aquests mateixos codis (calculations.daySky). */
  daySky?: Record<string, SkyHour[]>;
  /**
   * Totes les hores d'avui, des de les 00 h (chartData comença ara): la màxima, la mínima i la icona d'avui han de ser
   * les de tot el dia, com a la targeta principal i al detall del dia.
   */
  todayHours?: ReadonlyArray<HourlyPoint>;
  /** L'hora del lloc (calculations.shiftedNow): marca d'"ara" a la franja d'avui i hores passades apagades. */
  localNow?: Date | null;
  /** Previsió diària dels models globals (ECMWF/GFS/ICON): el gràfic de tendència en dibuixa el desacord. */
  dailyComparison?: ExtendedWeatherData['dailyComparison'];
  /** Etiqueta del model regional actiu (p. ex. "AROME HD"), o null si les dades són del model global. */
  regionalModelLabel?: string | null;
  lang: Language;
  onDayClick: (index: number) => void;
  // [FIX PRECISIÓ] Latitud opcional per a getInversionCorrectedTemp: sense ella,
  // la correcció d'inversió tèrmica assumeix Hemisferi Nord (vegeu inversionRules.ts).
  latitude?: number;
}

// Nom accessible de cada dia en una frase: abans era el text enganxat de la fila, «17dimarts3%16°22°CAP» (auditoria
// d'UX del 16/11/2026, B10).
const I18N_DAY_ARIA = {
  ca: (day: string, min: string, max: string, prob: string) => `${day}: de ${min} a ${max}, ${prob} de probabilitat de pluja`,
  es: (day: string, min: string, max: string, prob: string) => `${day}: de ${min} a ${max}, ${prob} de probabilidad de lluvia`,
  fr: (day: string, min: string, max: string, prob: string) => `${day} : de ${min} à ${max}, ${prob} de probabilité de pluie`,
  en: (day: string, min: string, max: string, prob: string) => `${day}: ${min} to ${max}, ${prob} chance of rain`
};

// Avui + els 7 dies següents (la sèrie diària en porta 8).
const WEEK_DAYS = 8;
// Per sota d'aquesta probabilitat la xifra s'apaga: hi és, però no ha de cridar.
const STRONG_RAIN_PROB = 20;
// Ordre de la llegenda (només hi surt el que es veu a la setmana).
const LEGEND_ORDER: SkyKind[] = ['clear', 'partly', 'cloudy', 'fog', 'rain', 'snow', 'storm'];

const pad2 = (n: number) => String(n).padStart(2, '0');
const dateKeyOf = (d: Date) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;

// Columnes de cada fila. Mòbil: dia, icona, pluja, mín, màx (i la franja a sota, a tota l'amplada).
// A partir de 768 px: dia, icona, pluja, franja, mín, màx. Literals perquè Tailwind les detecti.
const ROW_GRID = 'grid grid-cols-[minmax(0,1fr)_24px_44px_28px_30px] gap-x-2.5 md:grid-cols-[116px_26px_52px_minmax(0,1fr)_30px_34px] md:gap-x-3';
const ROW_PAD = 'px-4 sm:px-5 md:px-6';

const Ruler = () => (
  <span aria-hidden="true" className="relative block h-3.5 font-mono text-[10px] leading-none text-[#7a879b] tabular-nums">
    <span className="absolute left-0">00</span>
    <span className="absolute left-1/4 -translate-x-1/2">06</span>
    <span className="absolute left-1/2 -translate-x-1/2">12</span>
    <span className="absolute left-3/4 -translate-x-1/2">18</span>
    <span className="absolute right-0">24 h</span>
  </span>
);

const ForecastSection = memo(function ForecastSection({
  chartData, dailyData, dayHourCodes, daySky, todayHours, localNow, dailyComparison, regionalModelLabel, lang, onDayClick, latitude
}: ForecastSectionProps) {

  const t = TRANSLATIONS[lang] || TRANSLATIONS['ca'];
  const week = t.forecastWeek;
  const locale = getSafeLocale(lang);

  const {
    isOpen: isTrendModalOpen,
    openModal: openTrendModal,
    closeModal: closeTrendModal,
    closeModalThen: closeTrendModalThen
  } = useTacticalModal('trendChart');

  // Un dia del gràfic obre el seu detall. El detall NO es pot obrir a la vegada que es tanca el gràfic:
  // vegeu useTacticalModal.closeModalThen (el popstate del tancament el tancaria a ell).
  const handleTrendDayClick = useCallback(
    (dayIndex: number) => closeTrendModalThen(() => onDayClick(dayIndex)),
    [closeTrendModalThen, onDayClick]
  );

  // Només es recalcula quan canvien les dades (no amb el rellotge de cada minut): l'"ara" de la franja va a part.
  const days = useMemo(() => {
    if (!dailyData || !Array.isArray(dailyData.time) || dailyData.time.length === 0) return [];

    return dailyData.time.slice(0, WEEK_DAYS).map((rawDate: unknown, i: number) => {
      if (typeof rawDate !== 'string') return null;
      // [FIX PRECISIÓ] "YYYY-MM-DD" sol es parseja com mitjanit UTC; amb T12:00:00 (sense 'Z') és hora local del
      // navegador i getDate()/toLocaleDateString() no mostren el dia anterior en fusos horaris darrere d'UTC.
      const date = new Date(rawDate + 'T12:00:00');
      if (isNaN(date.getTime())) return null;

      const weekday = date.toLocaleDateString(locale, { weekday: 'long' });
      const dayName = weekday.charAt(0).toLocaleUpperCase(locale) + weekday.slice(1);
      const dateNum = date.getDate();

      // DOCTRINA RISC ZERO: temperatura i pluja es mostren a l'usuari com a xifres explícites — si falten, null
      // (i "--" a la UI), mai un 0 fals.
      const rawMaxTemp = extractValidArrayNum(dailyData.temperature_2m_max, i);
      const rawMinTemp = extractValidArrayNum(dailyData.temperature_2m_min, i);
      const rawCode = getSafeArrayNum(dailyData.weather_code, i);
      const precipProb = extractValidArrayNum(dailyData.precipitation_probability_max, i);
      const precipSum = extractValidArrayNum(dailyData.precipitation_sum, i);
      const snowSum = getSafeArrayNum(dailyData.snowfall_sum, i);
      const maxWind = getSafeArrayNum(dailyData.wind_speed_10m_max, i);

      // Hores d'aquest dia. Per a avui, totes (chartData comença a l'hora actual i seria un dia a mitges).
      const dateOnly = rawDate.slice(0, 10);
      const dayHours = i === 0 && todayHours && todayHours.length > 0 ? [...todayHours] : hoursOfDate(chartData, dateOnly);

      // Màxima/mínima amb correcció d'inversió — la mateixa font que el gràfic de tendència i el detall del dia
      // (utils/dailyExtremes.ts), perquè llista, gràfic i detall mai no discrepin.
      const { max: maxTemp, min: minTemp } = resolveDailyExtremes(rawMaxTemp, rawMinTemp, dayHours, latitude);

      // Mateixa regla oficial que la resta de l'app (utils/dailyWeatherCode.ts: cel diürn real; un codi diari de
      // boira no compta com a condició de tot el dia).
      const avgClouds = averageDaylightClouds(dayHours);
      const code = resolveDailyCode(rawCode, avgClouds, dayHourCodes?.[dateOnly]);

      const sky = daySky?.[dateOnly] ?? [];

      return {
        rawDate, dateOnly, i, dayName, dateNum, code, avgClouds, maxWind, precipProb, precipSum, snowSum,
        maxTempLabel: maxTemp !== null ? `${Math.round(maxTemp)}°` : '--°',
        minTempLabel: minTemp !== null ? `${Math.round(minTemp)}°` : '--°',
        sky,
        skyImage: skyStripBackground(sky),
        precipCenter: mainPrecipCenter(sky),
      };
    }).filter((d): d is NonNullable<typeof d> => d !== null);
  }, [dailyData, chartData, dayHourCodes, daySky, todayHours, locale, latitude]);

  const legend = useMemo(() => {
    const present = skyKindsPresent(days.map(d => d.sky));
    const hasNight = days.some(d => d.sky.some(h => h.kind !== null && !h.isDay));
    return { kinds: LEGEND_ORDER.filter(k => present.has(k)), hasNight };
  }, [days]);

  if (!dailyData || !Array.isArray(dailyData.time) || dailyData.time.length === 0) return null;

  // L'"ara" d'avui: només si la primera data de la sèrie és el dia d'avui al lloc (una previsió d'ahir no en té).
  const todayKey = localNow instanceof Date && !isNaN(localNow.getTime()) ? dateKeyOf(localNow) : null;
  const nowFraction = todayKey && localNow && days[0]?.dateOnly === todayKey
    ? (localNow.getHours() + localNow.getMinutes() / 60) / 24
    : null;
  const hasSky = days.some(d => d.sky.length > 0);
  const dayAria = I18N_DAY_ARIA[lang as keyof typeof I18N_DAY_ARIA] ?? I18N_DAY_ARIA.ca;

  return (
    <div className="flex flex-col gap-6 w-full max-w-7xl mx-auto z-10 relative">

      <section className="relative flex flex-col overflow-hidden rounded-[2rem] border border-white/[0.07] bg-gradient-to-b from-[#0e1018] to-[#0a0b11]">
        <div className={MATRIX_BG}></div>

        <div className={`relative z-10 flex items-center justify-between gap-3 ${ROW_PAD} pt-4 md:pt-5 pb-3`}>
          <h3 className="font-mono text-[11px] font-medium uppercase tracking-[0.16em] text-slate-400">
            {t.forecast7days}
          </h3>
          <button
            type="button"
            data-testid="open-trend"
            onClick={openTrendModal}
            aria-label={week.chartAria}
            className="flex items-center gap-2 h-9 px-3 rounded-xl border border-white/10 bg-black/30 text-[13px] font-semibold text-slate-200 hover:bg-white/[0.06] hover:border-white/20 transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-400"
          >
            <LineChart className="w-4 h-4 text-cyan-300" aria-hidden="true" />
            {week.chart}
          </button>
        </div>

        {/* Capçaleres de columna (a partir de 768 px) i, al mòbil, només el regle de les hores sobre les franges */}
        {hasSky && (
          <div className={`relative z-10 md:hidden ${ROW_PAD} pb-2`}><Ruler /></div>
        )}
        <div aria-hidden="true" className={`relative z-10 hidden md:grid ${ROW_GRID} items-end ${ROW_PAD} pb-2 font-mono text-[10px] uppercase tracking-[0.12em] text-[#7a879b]`}>
          <span>{week.day}</span>
          <span></span>
          <span className="text-right">{week.rain}</span>
          <span className="normal-case tracking-normal">{hasSky && <Ruler />}</span>
          <span className="text-right">{week.min}</span>
          <span className="text-right">{week.max}</span>
        </div>

        <div className="relative z-10 flex flex-col">
          {days.map((day) => {
            const isFirst = day.i === 0;
            const isToday = isFirst && (todayKey === null || todayKey === day.dateOnly);
            const showNow = isFirst && nowFraction !== null;
            const label = isToday ? t.today : day.dayName;
            const prob = day.precipProb;
            // Sense espai, com al gràfic de tendència i al detall del dia.
            const probText = prob === null ? '--' : prob <= 0 ? '—' : `${Math.round(prob)}%`;
            const precipLabel = day.precipSum !== null && day.precipSum > 0 ? formatPrecipitation(day.precipSum, day.snowSum, lang) : null;
            // La quantitat va on cau la pluja; a tocar dels extrems s'hi alinea perquè no surti de la franja.
            const precipPos = day.precipCenter === null || day.precipCenter > 0.9
              ? 'right-0'
              : day.precipCenter < 0.1 ? 'left-0' : '-translate-x-1/2';
            const precipStyle = day.precipCenter !== null && day.precipCenter >= 0.1 && day.precipCenter <= 0.9
              ? { left: `${(day.precipCenter * 100).toFixed(1)}%` }
              : undefined;

            return (
              <button
                key={`daily-row-${day.rawDate}`}
                type="button"
                onClick={() => onDayClick(day.i)}
                aria-label={dayAria(`${label} ${day.dateNum}`, day.minTempLabel, day.maxTempLabel, prob !== null ? `${Math.round(prob)} %` : '--')}
                className={`${ROW_GRID} gap-y-2.5 items-center w-full text-left ${ROW_PAD} py-3 md:py-0 md:h-[62px] border-t border-white/[0.06] transition-colors hover:bg-white/[0.04] focus-visible:outline-none focus-visible:bg-white/[0.05] focus-visible:shadow-[inset_0_0_0_2px_rgba(34,211,238,0.5)] ${isToday ? 'bg-white/[0.03]' : ''}`}
              >
                <span className="flex items-baseline gap-2 min-w-0 whitespace-nowrap">
                  <span className="truncate text-[15px] font-semibold text-slate-100">{label}</span>
                  <span className="font-mono text-[11px] text-slate-400 tabular-nums">{day.dateNum}</span>
                </span>

                <span className="flex items-center justify-center">
                  {getWeatherIcon(day.code, "w-6 h-6", true, 0, day.maxWind, null, 0, day.avgClouds)}
                </span>

                <span className={`text-right font-mono text-xs tabular-nums whitespace-nowrap ${prob !== null && prob >= STRONG_RAIN_PROB ? 'text-cyan-300' : 'text-[#7a879b]'}`}>
                  {probText}
                </span>

                {/* La franja del cel: al mòbil, segona línia a tota l'amplada; a partir de 768 px, la seva columna */}
                <span className={`relative block col-span-full order-last md:order-none md:col-span-1 ${precipLabel ? 'pb-4 md:pb-0' : ''}`} aria-hidden="true">
                  <span
                    data-testid="sky-strip"
                    className="relative block h-2.5 md:h-3 rounded-full overflow-hidden bg-white/[0.05]"
                    style={day.skyImage !== 'none' ? { backgroundImage: day.skyImage } : undefined}
                  >
                    <span className="hidden md:block absolute inset-y-0 left-1/4 w-px bg-[#07080d]/50"></span>
                    <span className="hidden md:block absolute inset-y-0 left-1/2 w-px bg-[#07080d]/50"></span>
                    <span className="hidden md:block absolute inset-y-0 left-3/4 w-px bg-[#07080d]/50"></span>
                    {showNow && (
                      <span className="absolute inset-y-0 left-0 bg-[#0a0b11]/60" style={{ width: `${(nowFraction * 100).toFixed(1)}%` }}></span>
                    )}
                    <span className="absolute inset-0 rounded-full shadow-[inset_0_0_0_1px_rgba(255,255,255,0.06)]"></span>
                  </span>
                  {showNow && (
                    <span
                      data-testid="sky-now"
                      className="absolute -top-1 h-[18px] md:h-5 w-0.5 -ml-px rounded-full bg-slate-50"
                      style={{ left: `${(nowFraction * 100).toFixed(1)}%` }}
                    ></span>
                  )}
                  {precipLabel && (
                    <span
                      className={`absolute top-3.5 md:top-[15px] font-mono text-[10.5px] leading-none text-blue-300 whitespace-nowrap ${precipPos}`}
                      style={precipStyle}
                    >
                      {precipLabel}
                    </span>
                  )}
                </span>

                <span className="text-right text-sm text-slate-400 tabular-nums">{day.minTempLabel}</span>
                <span className="text-right text-[15px] font-semibold text-slate-100 tabular-nums">{day.maxTempLabel}</span>
              </button>
            );
          })}
        </div>

        {hasSky && (
          <div data-testid="sky-legend" className={`relative z-10 mt-auto flex flex-wrap items-center gap-x-4 gap-y-2 ${ROW_PAD} pt-3 pb-4 border-t border-white/[0.06] font-mono text-[10.5px] text-slate-400`}>
            {legend.kinds.map(kind => (
              <span key={kind} className="flex items-center gap-1.5">
                <span className="w-3.5 h-2 rounded-sm" style={{ backgroundColor: SKY_COLORS[kind].day }} aria-hidden="true"></span>
                {week.sky[kind]}
              </span>
            ))}
            {legend.hasNight && (
              <span className="flex items-center gap-1.5">
                <span className="w-3.5 h-2 rounded-sm shadow-[inset_0_0_0_1px_rgba(255,255,255,0.12)]" style={{ backgroundColor: SKY_COLORS.clear.night }} aria-hidden="true"></span>
                {week.sky.night}
              </span>
            )}
            {nowFraction !== null && (
              <span className="flex items-center gap-1.5 ml-auto">
                <span className="w-0.5 h-2.5 rounded-full bg-slate-50" aria-hidden="true"></span>
                {week.sky.now}
              </span>
            )}
          </div>
        )}
      </section>

      <TrendChartModal
        isOpen={isTrendModalOpen}
        onClose={closeTrendModal}
        dailyData={dailyData}
        chartData={chartData}
        dayHourCodes={dayHourCodes}
        dailyComparison={dailyComparison}
        regionalModelLabel={regionalModelLabel}
        lang={lang}
        latitude={latitude}
        onDayClick={handleTrendDayClick}
      />

    </div>
  );
});

export default ForecastSection;
