import React, { useMemo, useEffect, useCallback, useRef } from 'react';
import { X, Calendar, Droplets, Wind, Thermometer, Sun, CloudSun, Mountain, Clock, ArrowDown, ArrowUp, ChevronLeft, ChevronRight } from 'lucide-react';
import SmartForecastCharts from './SmartForecastCharts';
import { ReliabilityDots } from './ReliabilityDots';
import { DayStatCard } from './dayDetail/DayStatCard';
import { DayPartsStrip } from './dayDetail/DayPartsStrip';
import { SunTimesCard } from './dayDetail/SunTimesCard';
import { TRANSLATIONS, Language } from '../translations';
import { ExtendedWeatherData, StrictCurrentWeather } from '../types/weatherLogicTypes';
import { WeatherUnit, formatPrecipitation, formatHoursMinutes, getWeatherLabel, getSafeLocale } from '../utils/formatters';
import { useDayDetailData } from '../hooks/useDayDetailData';
import { useDialogFocus } from '../hooks/useDialogFocus';
import { hasVisibleRange, type ModelRange } from '../utils/dailyModelSpread';
import { CONFIDENCE_TEXT } from '../utils/forecastConfidenceText';
import { isLikelyWet } from '../utils/precipSignal';
import { getUVCategory } from '../utils/uvIndexUtils';
import { summarizeDayParts } from '../utils/dayParts';
import { swipeDirection } from '../utils/dayNavigation';
import { getWeatherIcon } from './WeatherIcons';
import { getHourlyWeatherCode, getHourlyEffectiveCloudCover, resolveIsDay, type HourlySeries } from '../utils/hourlyWeatherCode';
import { getInversionCorrectedTemp } from '../utils/rules/temperatureCorrections';
import { getSafeLatitude, getSafeArrayNum as getSafeArrNum, extractValidArrayNum, getSafeMonthFromIso } from '../utils/weatherMath';
import { MATRIX_BG } from './widgets/widgetStyles';
import { isRegionalModelActive } from '../constants/regionalModels';

// DOCTRINA RISC ZERO: Interfície estricta
interface TableRowData {
    hour: string;
    temp: number | null;
    code: number | null;
    precipProb: number | null;
    precipSum: number | null;
    snowfall: number | null;
    windSpeed: number | null;
    isDay: boolean;
    cloudCover: number | null;
}

// HELPER RISC ZERO: Extreu l'hora d'un ISO string sense passar per Date/fus horari del navegador
const getSafeHourFromIso = (isoString: string | undefined): number | null => {
    if (!isoString || !isoString.includes('T')) return null;
    const timePart = isoString.split('T')[1];
    if (!timePart) return null;
    const hour = parseInt(timePart.slice(0, 2), 10);
    return isNaN(hour) ? null : hour;
};

interface DayDetailModalProps {
  weatherData: ExtendedWeatherData | null;
  selectedDayIndex: number | null;
  onClose: () => void;
  /** Si hi és, el detall es pot canviar al dia anterior/següent (fletxes, ←/→ i lliscant) sense tancar-lo. */
  onSelectDay?: (dayIndex: number) => void;
  unit: WeatherUnit;
  lang: Language;
}

export default function DayDetailModal({ 
  weatherData, 
  selectedDayIndex, 
  onClose, 
  onSelectDay,
  unit, 
  lang
}: DayDetailModalProps) {
  const tRecord = (TRANSLATIONS[lang] || TRANSLATIONS['ca']) as Record<string, unknown>;
  const tDayDetail = (typeof tRecord.dayDetail === 'object' && tRecord.dayDetail !== null) ? (tRecord.dayDetail as Record<string, string>) : {};
  
  const TACTICAL_I18N = useMemo(() => ({
    detailHeader: lang === 'en' ? 'DAY DETAIL' : lang === 'fr' ? 'DÉTAIL DU JOUR' : lang === 'es' ? 'DETALLE DEL DÍA' : 'DETALL DEL DIA',
    hourlyHeader: lang === 'en' ? 'HOURLY FORECAST' : lang === 'fr' ? 'PRÉVISIONS HORAIRES' : lang === 'es' ? 'PREVISIÓN POR HORAS' : 'PREVISIÓ PER HORES',
    colHour: lang === 'en' ? 'HOUR' : lang === 'fr' ? 'HEURE' : 'HORA',
    colSky: lang === 'en' ? 'SKY' : lang === 'fr' ? 'CIEL' : lang === 'es' ? 'CIELO' : 'CEL',
    colTemp: 'TEMP',
    colRain: lang === 'en' ? 'RAIN' : lang === 'fr' ? 'PLUIE' : lang === 'es' ? 'LLUVIA' : 'PLUJA',
    colWind: lang === 'en' ? 'WIND' : lang === 'es' ? 'VIENTO' : 'VENT',
    rainChance: lang === 'en' ? 'MAX CHANCE' : lang === 'fr' ? 'PROB. MAX' : lang === 'es' ? 'PROB. MÁX' : 'PROB. MÀX'
  }), [lang]);

  const confidenceText = CONFIDENCE_TEXT[lang] || CONFIDENCE_TEXT.ca;

  const {
    dayData, extremes, dayCode, avgDaylightClouds, windMax, gustsMax, precipProbMax, spread, isRegionalDay,
    hourlyData, comparisonData, snowLevelText, snowLevelRelevant, daylightSec, neighbours, dayIndices, nowIndex
  } = useDayDetailData(weatherData, selectedDayIndex, unit);

  // Model regional actiu a la ubicació (p. ex. "AROME HD"), o null si tota la previsió és del model global.
  const regionalModelLabel = isRegionalModelActive(weatherData?.current?.source) ? (weatherData?.current?.source as string) : null;

  const dialogRef = useRef<HTMLDivElement>(null);
  // Focus dins el diàleg en obrir-lo, Tab que hi dóna la volta i retorn del focus en tancar-lo (com el gràfic de tendència).
  useDialogFocus(dayData !== null, dialogRef);

  // Bloqueig del scroll de la pàgina de darrere mentre el detall és obert (com la resta de modals).
  useEffect(() => {
      const original = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => { document.body.style.overflow = original; };
  }, []);

  const handleBackdropClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
      if (e.target === e.currentTarget) {
          onClose();
      }
  }, [onClose]);

  // L'historial del navegador (botó "enrere") ja el gestiona useModalHistory,
  // registrat des de useViewState.ts — aquí només cal l'atall de teclat Escape.
  useEffect(() => {
      const handleKeyDown = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  // Canvi de dia sense tancar el detall: només dins els dies que la llista ja mostra i només si qui obre el
  // modal ens dóna com canviar-lo (onSelectDay).
  const prevDay = onSelectDay ? neighbours.prev : null;
  const nextDay = onSelectDay ? neighbours.next : null;
  const goToDay = useCallback((target: number | null) => {
      if (target !== null && onSelectDay) onSelectDay(target);
  }, [onSelectDay]);

  // Fletxes ← / → del teclat (no si s'està escrivint ni amb cap modificador).
  useEffect(() => {
      const handleArrows = (e: KeyboardEvent) => {
          if (e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return;
          const target = e.target;
          if (target instanceof HTMLElement && (target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName))) return;
          const destination = e.key === 'ArrowLeft' ? prevDay : e.key === 'ArrowRight' ? nextDay : null;
          if (destination === null) return;
          e.preventDefault();
          goToDay(destination);
      };
      window.addEventListener('keydown', handleArrows);
      return () => window.removeEventListener('keydown', handleArrows);
  }, [prevDay, nextDay, goToDay]);

  // El dia nou s'obre des de dalt, no a l'alçada de scroll on era l'anterior.
  const scrollRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
      if (scrollRef.current) scrollRef.current.scrollTop = 0;
  }, [selectedDayIndex]);

  // Gest de lliscar amb un dit. Els gràfics es reserven els seus propis gestos horitzontals (data-no-swipe).
  const swipeStart = useRef<{ x: number; y: number } | null>(null);
  const handleTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
      const touch = e.touches[0];
      const reserved = e.target instanceof Element && e.target.closest('[data-no-swipe]') !== null;
      swipeStart.current = touch && !reserved ? { x: touch.clientX, y: touch.clientY } : null;
  };
  const handleTouchEnd = (e: React.TouchEvent<HTMLDivElement>) => {
      const start = swipeStart.current;
      swipeStart.current = null;
      const touch = e.changedTouches[0];
      if (!start || !touch) return;
      const direction = swipeDirection(touch.clientX - start.x, touch.clientY - start.y);
      if (direction === 1) goToDay(nextDay);
      else if (direction === -1) goToDay(prevDay);
  };

  const formattedPrecipitation = useMemo(() => {
    if (!dayData || !weatherData || selectedDayIndex === null) return { val: "--", unit: "" };
    
    const dailyRaw = weatherData.daily as unknown as Record<string, unknown>;
    const snowSumArr = dailyRaw.snowfall_sum;
    const snowSum = Array.isArray(snowSumArr) && typeof snowSumArr[selectedDayIndex] === 'number' 
        ? (snowSumArr[selectedDayIndex] as number) 
        : 0;
    
    if (typeof dayData.precipSum !== 'number' || isNaN(dayData.precipSum)) {
        return { val: "--", unit: "" };
    }

    const rawString = formatPrecipitation(dayData.precipSum, snowSum);
    const [val, u] = rawString.split(' '); 
    return { val, unit: u };
  }, [dayData, weatherData, selectedDayIndex]);

  const tableRows = useMemo<TableRowData[]>(() => {
    if (!weatherData || !weatherData.hourly || !Array.isArray(weatherData.hourly.time) || dayIndices.length === 0) return [];

    let sunriseHour = 7;
    let sunsetHour = 20;
    
    if (selectedDayIndex !== null && Array.isArray(weatherData.daily.sunrise) && Array.isArray(weatherData.daily.sunset)) {
        const sr = weatherData.daily.sunrise[selectedDayIndex];
        const ss = weatherData.daily.sunset[selectedDayIndex];
        const parsedSunrise = typeof sr === 'string' ? getSafeHourFromIso(sr) : null;
        const parsedSunset = typeof ss === 'string' ? getSafeHourFromIso(ss) : null;
        if (parsedSunrise !== null) sunriseHour = parsedSunrise;
        if (parsedSunset !== null) sunsetHour = parsedSunset;
    }

    const rows: TableRowData[] = [];
    const hRaw = weatherData.hourly as unknown as Record<string, unknown>;
    const elevation = typeof weatherData.elevation === 'number' ? weatherData.elevation : 0;

    // [NETEJA] Abans: for (let i=0; i<24; i++) amb idx = startIndex + i, calculat amb
    // un findIndex propi — assumia un bloc contigu de 24 hores. Ara reutilitzem
    // dayIndices del hook (useDayDetailData), que filtra per data real i és robust
    // encara que hi hagi menys/més de 24 hores o algun forat.
    for (const idx of dayIndices) {
        const time = weatherData.hourly.time[idx];
        if (typeof time !== 'string') continue;

        // DOCTRINA RISC ZERO: temp/pluja/vent es mostren directament a la taula —
        // si falten, null (i "--" a la UI, ja implementat més avall), mai un 0
        // fals. windForCalc alimenta només getInversionCorrectedTemp, que encara
        // necessita un número.
        const rawTemp = extractValidArrayNum(hRaw.temperature_2m, idx);
        const precipProb = extractValidArrayNum(hRaw.precipitation_probability, idx);
        const precipSum = extractValidArrayNum(hRaw.precipitation, idx);
        const snowfall = extractValidArrayNum(hRaw.snowfall, idx);
        const windSpeed = extractValidArrayNum(hRaw.wind_speed_10m, idx);

        const windForCalc = windSpeed ?? 0;

        // Capes de núvols: només per a la correcció d'inversió de la temperatura
        // mostrada (el codi de la icona el calcula getHourlyWeatherCode).
        const cloudLow = getSafeArrNum(hRaw.cloud_cover_low, idx, 0);
        const cloudMid = getSafeArrNum(hRaw.cloud_cover_mid, idx, 0);
        const cloudHigh = getSafeArrNum(hRaw.cloud_cover_high, idx, 0);

        // Dia/nit: l'`is_day` de l'API (exacte al minut) mana. L'aproximació per hora
        // sencera de sortida/posta només és l'última reserva: sempre falla a les hores
        // frontera (sortida 07:35 → donava "dia" a les 07:00, encara de nit; posta 19:53
        // → donava "nit" a les 19:00, encara de dia) i deixava aquesta taula amb una
        // icona diferent de la de l'evolució horària per a la mateixa hora.
        const currentHour = parseInt(time.split('T')[1]?.slice(0, 2) || "0", 10);
        const isDay = resolveIsDay(hRaw, idx, () => currentHour >= sunriseHour && currentHour < sunsetHour);
        const isDayNum = isDay ? 1 : 0;

        // Codi de la icona: font única (utils/hourlyWeatherCode.ts), la mateixa que fan
        // servir Forecast24h i el modal del model regional.
        const finalCode = getHourlyWeatherCode(hRaw as HourlySeries, idx, elevation, weatherData.hourlyComparison);

        // Sense temperatura real d'aquesta hora, no té sentit "corregir-la" —
        // es manté null i la UI ja sap mostrar "--°" (vegeu hasTemp més avall).
        const displayTemp = rawTemp !== null
            ? getInversionCorrectedTemp(
                {
                    temperature_2m: rawTemp,
                    cloud_cover_low: cloudLow,
                    cloud_cover_mid: cloudMid,
                    cloud_cover_high: cloudHigh,
                    wind_speed_10m: windForCalc,
                    is_day: isDayNum
                } as unknown as StrictCurrentWeather,
                getSafeMonthFromIso(time),
                getSafeLatitude(weatherData?.location)
            )
            : null;

        rows.push({
            hour: time.split('T')[1]?.slice(0, 5) || "--:--",
            temp: displayTemp,
            code: finalCode, // [Codi processat per motor]
            precipProb,
            precipSum,
            snowfall,
            windSpeed,
            isDay,
            cloudCover: getHourlyEffectiveCloudCover(hRaw as HourlySeries, idx)
        });
    }

    return rows;
  }, [weatherData, selectedDayIndex, dayIndices]);

  // Resum per franges (matinada, matí, tarda, nit) de les MATEIXES files que mostra la taula.
  const dayParts = useMemo(() => summarizeDayParts(tableRows), [tableRows]);

  if (!dayData) return null;

  const formatTime = (isoString?: string) => {
      if (!isoString || !isoString.includes('T')) return "--:--";
      const timePart = isoString.split('T')[1];
      return timePart ? timePart.slice(0, 5) : "--:--";
  };

  const formatDate = (isoString: string) => {
      try {
          // [FIX PRECISIÓ] Forcem hora local (T12:00:00) perquè una data bare
          // "YYYY-MM-DD" no es llegeixi com a mitjanit UTC i mostri el dia anterior
          // en fusos horaris darrere d'UTC. Mateix fix que ForecastSection.tsx.
          const datePart = isoString.includes('T') ? isoString.split('T')[0] : isoString;
          return new Date(datePart + 'T12:00:00').toLocaleDateString(getSafeLocale(lang), {
              weekday: 'long', day: 'numeric', month: 'long'
          });
      } catch { return isoString; }
  };

  // Màxima, mínima i vent màxim vénen de les HORES del dia (vegeu useDayDetailData): són les mateixes
  // xifres que la llista de 7 dies i que el gràfic i la taula d'aquest mateix detall.
  const safeMaxTemp = typeof extremes?.max === 'number' && !isNaN(extremes.max) ? Math.round(extremes.max) : '--';
  const safeMinTemp = typeof extremes?.min === 'number' && !isNaN(extremes.min) ? Math.round(extremes.min) : '--';
  const safeWindMax = typeof windMax === 'number' && !isNaN(windMax) ? Math.round(windMax) : '--';
  const safeUvMax = typeof dayData.uvMax === 'number' && !isNaN(dayData.uvMax) ? dayData.uvMax.toFixed(1) : '--';

  const safeSnowLevel = snowLevelText;
  const snowLevelUnit = '';

  // Etiquetes de les targetes: el bloc `dayDetail` de les traduccions (p. ex. "VENT MÀX"), no les paraules
  // soltes de l'app ("Vent"), que hi feien semblar un vent mitjà quan és el màxim del dia.
  const labelPrecip = tDayDetail.precip || TACTICAL_I18N.colRain;
  const labelWind = tDayDetail.wind || (lang === 'en' ? 'MAX WIND' : lang === 'fr' ? 'VENT MAX' : lang === 'es' ? 'VIENTO MÁX' : 'VENT MÀX');
  const labelUv = tDayDetail.uv || 'UV';
  const labelSnow = tDayDetail.snowLevel || (typeof tRecord.snowLevel === 'string' ? tRecord.snowLevel : 'COTA NEU');
  const labelSunrise = tDayDetail.sunrise || (typeof tRecord.sunrise === 'string' ? tRecord.sunrise : 'SORTIDA');
  const labelSunset = tDayDetail.sunset || (typeof tRecord.sunset === 'string' ? tRecord.sunset : 'POSTA');
  const labelClose = typeof tRecord.closeWindow === 'string' ? tRecord.closeWindow : 'Tancar finestra';
  const labelMax = typeof tRecord.max === 'string' ? tRecord.max : 'Màx';
  const labelMin = typeof tRecord.min === 'string' ? tRecord.min : 'Mín';

  // Fiabilitat, rang entre models i origen de les temperatures del dia: la mateixa informació que ja dóna
  // el gràfic de tendència, perquè una xifra sense aquest context sembla més segura del que és.
  const formatRange = (r: ModelRange) => `${Math.round(r.low)}–${Math.round(r.high)}°`;
  const maxRange = spread?.maxRange ?? null;
  const minRange = spread?.minRange ?? null;
  const rangeParts = [
      hasVisibleRange(maxRange) ? `${labelMax} ${formatRange(maxRange)}` : null,
      hasVisibleRange(minRange) ? `${labelMin} ${formatRange(minRange)}` : null
  ].filter((p): p is string => p !== null);
  const reliabilityLevel = spread?.reliability ?? null;
  // Només hi ha origen que dir quan la ubicació té model regional: un dia de model global entre dies
  // regionals és justament el salt que l'usuari ha de poder explicar-se.
  const sourceLabel = regionalModelLabel ? (isRegionalDay ? regionalModelLabel : confidenceText.globalModel) : null;

  const precipNote = precipProbMax !== null ? `${TACTICAL_I18N.rainChance} ${Math.round(precipProbMax)}%` : undefined;

  const labelGusts = tDayDetail.gusts || 'RÀFEGUES';
  const gustsNote = gustsMax !== null ? `${labelGusts} ${Math.round(gustsMax)} km/h` : undefined;

  // Categoria de risc de l'índex UV amb la mateixa taula (i colors) que el widget d'UV i el modal solar.
  const uvCategory = typeof dayData.uvMax === 'number' && !isNaN(dayData.uvMax) ? getUVCategory(dayData.uvMax) : null;

  // Quarta targeta contextual: la cota de neu quan hi pot haver neu; si no, les hores de sol (sobre les de llum).
  const labelSunshine = tDayDetail.sunshine || 'HORES DE SOL';
  const sunshineValue = formatHoursMinutes(dayData.sunshineSec);
  const sunshineNote = sunshineValue !== '--' && daylightSec !== null
      ? `${tDayDetail.outOf || 'de'} ${formatHoursMinutes(daylightSec)}`
      : undefined;

  const labelNow = tDayDetail.now || 'ARA';
  const labelPrevDay = tDayDetail.prevDay || 'Dia anterior';
  const labelNextDay = tDayDetail.nextDay || 'Dia següent';
  const partLabels = {
      night: tDayDetail.partNight || 'Matinada',
      morning: tDayDetail.partMorning || 'Matí',
      afternoon: tDayDetail.partAfternoon || 'Tarda',
      evening: tDayDetail.partEvening || 'Nit'
  };

  // Estat del cel del dia amb la mateixa etiqueta que la resta de l'app (p. ex. "Majorment serè").
  const skyLabel = dayCode !== null
      ? getWeatherLabel({ weather_code: dayCode } as unknown as StrictCurrentWeather, lang, avgDaylightClouds)
      : '';

  // Hora local d'"ara" si el dia mostrat és avui (marca la franja i la fila en curs i atenua el que ja ha passat).
  const nowRowHour = nowIndex !== null ? parseInt(tableRows[nowIndex]?.hour?.slice(0, 2) ?? '', 10) : NaN;
  const nowHour = isNaN(nowRowHour) ? null : nowRowHour;


  return (
    <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="day-detail-modal-title"
        className="fixed inset-0 z-[100] flex items-center justify-center p-0 sm:p-4 bg-[#020617]/95 backdrop-blur-xl animate-in fade-in duration-200"
        onClick={handleBackdropClick}
    >
      <div
          ref={scrollRef}
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
          className="bg-[#050608] sm:border border-white/10 w-full h-full sm:h-auto sm:max-w-4xl sm:max-h-[95vh] overflow-y-auto custom-scrollbar sm:rounded-[2rem] shadow-2xl relative sm:ring-1 sm:ring-white/5"
      >
          
          <button 
            onClick={onClose}
            className="fixed sm:absolute top-4 right-4 md:top-5 md:right-5 p-3 sm:p-2 bg-black/50 sm:bg-slate-900 rounded-full text-slate-400 hover:text-cyan-400 border border-white/10 sm:border-slate-700 hover:border-cyan-500/50 backdrop-blur-md transition-all z-50 hover:rotate-90 duration-300 shadow-md active:scale-95"
            aria-label={labelClose}
          >
            <X className="w-5 h-5" />
          </button>

          <div className="p-6 pb-8 bg-gradient-to-b from-[#0f111a] to-[#050608] border-b border-white/5 relative overflow-hidden">
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-cyan-500 to-transparent opacity-60 shadow-[0_0_15px_rgba(34,211,238,0.5)] z-20"></div>
              <div className={MATRIX_BG}></div>
              <div className="absolute top-10 left-1/2 -translate-x-1/2 w-[300px] h-[100px] bg-cyan-500/10 rounded-[100%] blur-[40px] pointer-events-none"></div>

              <div className="flex flex-col items-center justify-center text-center relative z-10 pt-6 sm:pt-2">
                  <div className="flex items-center gap-2 text-cyan-400 font-black uppercase tracking-[0.3em] text-[10px] mb-3 bg-cyan-950/40 px-3 py-1.5 rounded-md border border-cyan-500/30 backdrop-blur-md shadow-[0_0_10px_rgba(6,182,212,0.15)]">
                      <Calendar className="w-3.5 h-3.5" /> {tDayDetail.forecast || TACTICAL_I18N.detailHeader}
                  </div>
                  
                  <div className="flex items-center justify-center gap-2 md:gap-4 w-full">
                      {onSelectDay && (
                          <button
                              type="button"
                              data-testid="day-prev"
                              onClick={() => goToDay(prevDay)}
                              disabled={prevDay === null}
                              aria-label={labelPrevDay}
                              className="shrink-0 p-2 md:p-2.5 rounded-full border border-white/10 bg-black/40 text-slate-400 hover:text-cyan-300 hover:border-cyan-500/40 transition-colors disabled:opacity-25 disabled:pointer-events-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-400"
                          >
                              <ChevronLeft className="w-5 h-5" />
                          </button>
                      )}
                      <h2 id="day-detail-modal-title" className="text-3xl md:text-5xl font-black text-white capitalize tracking-tight mb-2 drop-shadow-lg min-w-0">
                          {formatDate(dayData.date)}
                      </h2>
                      {onSelectDay && (
                          <button
                              type="button"
                              data-testid="day-next"
                              onClick={() => goToDay(nextDay)}
                              disabled={nextDay === null}
                              aria-label={labelNextDay}
                              className="shrink-0 p-2 md:p-2.5 rounded-full border border-white/10 bg-black/40 text-slate-400 hover:text-cyan-300 hover:border-cyan-500/40 transition-colors disabled:opacity-25 disabled:pointer-events-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-400"
                          >
                              <ChevronRight className="w-5 h-5" />
                          </button>
                      )}
                  </div>

                  <div className="flex flex-col sm:flex-row items-center justify-center gap-4 sm:gap-6 mt-4">
                  {dayCode !== null && (
                      <div data-testid="day-sky" className="flex items-center gap-3">
                          {getWeatherIcon(dayCode, "w-12 h-12 md:w-14 md:h-14", true, 0, windMax ?? 0, null, 0, avgDaylightClouds)}
                          {skyLabel && skyLabel !== '---' && (
                              <span data-testid="day-sky-label" className="max-w-[9rem] text-left text-sm md:text-base font-black uppercase tracking-widest leading-tight text-slate-200">
                                  {skyLabel}
                              </span>
                          )}
                      </div>
                  )}

                  <div className="flex items-center justify-center gap-6 bg-black/40 px-6 py-2 rounded-2xl border border-white/5 shadow-inner backdrop-blur-md">
                      <div className="flex items-center gap-2">
                          <ArrowUp className={`w-4 h-4 ${safeMaxTemp !== '--' ? 'text-red-400 drop-shadow-[0_0_5px_rgba(248,113,113,0.8)]' : 'text-slate-600'}`} />
                          <span data-testid="day-max" className={`text-3xl font-mono font-bold tracking-tighter tabular-nums transition-colors duration-500 ${safeMaxTemp !== '--' ? 'text-slate-100' : 'text-slate-600'}`}>
                              {safeMaxTemp}°
                          </span>
                      </div>
                      <div className="w-px h-6 bg-white/10"></div>
                      <div className="flex items-center gap-2">
                          <ArrowDown className={`w-4 h-4 ${safeMinTemp !== '--' ? 'text-cyan-400 drop-shadow-[0_0_5px_rgba(34,211,238,0.8)]' : 'text-slate-600'}`} />
                          <span data-testid="day-min" className={`text-3xl font-mono font-bold tracking-tighter tabular-nums transition-colors duration-500 ${safeMinTemp !== '--' ? 'text-slate-300' : 'text-slate-600'}`}>
                              {safeMinTemp}°
                          </span>
                      </div>
                  </div>
                  </div>

                  {(reliabilityLevel || rangeParts.length > 0 || sourceLabel) && (
                      <div className="flex flex-wrap items-center justify-center gap-2 mt-3">
                          {reliabilityLevel && (
                              <span
                                  data-testid="day-reliability"
                                  data-level={reliabilityLevel}
                                  className="inline-flex items-center gap-2 px-2.5 py-1.5 rounded-full border border-white/10 bg-black/40 text-[10px] font-black uppercase tracking-widest text-slate-300 backdrop-blur-md"
                              >
                                  <ReliabilityDots level={reliabilityLevel} />
                                  {confidenceText.reliability[reliabilityLevel]}
                              </span>
                          )}
                          {rangeParts.length > 0 && (
                              <span
                                  data-testid="day-model-range"
                                  className="inline-block px-2.5 py-1.5 rounded-full border border-white/10 bg-black/40 text-center text-[10px] font-black uppercase tracking-widest text-slate-400 tabular-nums backdrop-blur-md"
                              >
                                  {confidenceText.rangeLegend}:{' '}
                                  {/* Si a mòbil no hi cap tot en una línia, el salt cau entre la màxima i la mínima, mai dins d'un rang. */}
                                  {rangeParts.map((part, i) => (
                                      <React.Fragment key={part}>
                                          {i > 0 ? ' ' : ''}
                                          <span className="whitespace-nowrap">{i > 0 ? '· ' : ''}{part}</span>
                                      </React.Fragment>
                                  ))}
                              </span>
                          )}
                          {sourceLabel && (
                              <span
                                  data-testid="day-source"
                                  data-regional={isRegionalDay}
                                  className={`inline-flex items-center px-2.5 py-1.5 rounded-full border text-[10px] font-black uppercase tracking-widest backdrop-blur-md ${isRegionalDay ? 'bg-cyan-500/10 border-cyan-500/20 text-cyan-300' : 'bg-white/5 border-white/10 text-slate-400'}`}
                              >
                                  {sourceLabel}
                              </span>
                          )}
                      </div>
                  )}
              </div>
          </div>

          <div className="p-4 md:p-8 space-y-6 relative z-10">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
                <DayStatCard
                    icon={Droplets}
                    label={labelPrecip}
                    value={formattedPrecipitation.val}
                    sub={formattedPrecipitation.unit}
                    note={precipNote}
                    noteTestId="note-precip"
                    noteClass={isLikelyWet(precipProbMax) ? 'text-blue-300' : 'text-slate-600'}
                    reserveNote
                    color="text-blue-400"
                    glowClasses="shadow-[0_0_12px_rgba(96,165,250,0.25)] group-hover:shadow-[0_0_20px_rgba(96,165,250,0.5)]"
                />
                <DayStatCard
                    icon={Wind}
                    label={labelWind}
                    value={safeWindMax}
                    sub={safeWindMax !== '--' ? "km/h" : ""}
                    note={gustsNote}
                    noteTestId="note-gusts"
                    noteClass="text-emerald-300/80"
                    reserveNote
                    color="text-emerald-400"
                    glowClasses="shadow-[0_0_12px_rgba(52,211,153,0.25)] group-hover:shadow-[0_0_20px_rgba(52,211,153,0.5)]"
                />
                <DayStatCard
                    icon={Sun}
                    label={labelUv}
                    value={safeUvMax}
                    sub=""
                    note={uvCategory ? uvCategory.label[lang] : undefined}
                    noteTestId="note-uv"
                    noteClass={uvCategory?.color}
                    reserveNote
                    color="text-amber-400"
                    glowClasses="shadow-[0_0_12px_rgba(251,191,36,0.25)] group-hover:shadow-[0_0_20px_rgba(251,191,36,0.5)]"
                />
                {snowLevelRelevant ? (
                    <DayStatCard
                        testId="stat-snow"
                        icon={Mountain}
                        label={labelSnow}
                        value={safeSnowLevel}
                        sub={snowLevelUnit}
                        reserveNote
                        color="text-indigo-400"
                        glowClasses="shadow-[0_0_12px_rgba(129,140,248,0.25)] group-hover:shadow-[0_0_20px_rgba(129,140,248,0.5)]"
                    />
                ) : (
                    <DayStatCard
                        testId="stat-sunshine"
                        icon={CloudSun}
                        label={labelSunshine}
                        value={sunshineValue}
                        sub=""
                        note={sunshineNote}
                        noteTestId="note-sunshine"
                        noteClass="text-amber-300/80"
                        reserveNote
                        color="text-amber-300"
                        glowClasses="shadow-[0_0_12px_rgba(252,211,77,0.25)] group-hover:shadow-[0_0_20px_rgba(252,211,77,0.5)]"
                    />
                )}
            </div>

            <SunTimesCard
                sunriseLabel={labelSunrise}
                sunsetLabel={labelSunset}
                sunrise={formatTime(dayData.sunrise)}
                sunset={formatTime(dayData.sunset)}
                duration={daylightSec !== null ? formatHoursMinutes(daylightSec) : null}
                durationLabel={tDayDetail.daylight || 'de llum'}
            />

            <DayPartsStrip
                parts={dayParts}
                title={tDayDetail.partsTitle || 'MOMENTS DEL DIA'}
                labels={partLabels}
                nowLabel={labelNow}
                nowHour={nowHour}
            />

            <div data-no-swipe className="relative overflow-hidden bg-[#0a0b10] border border-white/5 rounded-3xl p-5 md:p-8 shadow-inner">
               <div className={MATRIX_BG}></div>
               <div className="relative z-10">
                   <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.25em] mb-6 flex items-center gap-2">
                      <Thermometer className="w-4 h-4 text-rose-400" /> 
                      {typeof tRecord.hourlyEvolution === 'string' ? tRecord.hourlyEvolution : "EVOLUCIÓ TÈRMICA"}
                   </h3>
                   <SmartForecastCharts 
                      data={hourlyData} 
                      comparisonData={comparisonData} 
                      unit={unit === 'F' ? '°F' : '°C'} 
                      lang={lang} 
                      regionalModelLabel={regionalModelLabel}
                      nowIndex={nowIndex}
                   />
               </div>
            </div>

            {tableRows && tableRows.length > 0 && (
                <div className="bg-[#0a0b10] border border-white/5 rounded-3xl overflow-clip shadow-[inset_0_2px_10px_rgba(0,0,0,0.5)]">
                    <div className="px-6 md:px-8 py-5 border-b border-white/5 bg-[#0f111a]/90 backdrop-blur-md">
                         <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.25em] flex items-center gap-2">
                            <Clock className="w-4 h-4 text-cyan-400" /> 
                            {TACTICAL_I18N.hourlyHeader}
                        </h3>
                    </div>
                    
                    <div className="divide-y divide-white/5">
                        <div className="grid grid-cols-12 px-4 md:px-6 py-3 text-[9px] font-black uppercase tracking-widest text-slate-500 bg-[#0a0b10] shadow-inner sm:sticky sm:top-0 sm:z-20">
                            <div className="col-span-2">{TACTICAL_I18N.colHour}</div>
                            <div className="col-span-2 text-center">{TACTICAL_I18N.colSky}</div>
                            <div className="col-span-3 text-center">{TACTICAL_I18N.colTemp}</div>
                            <div className="col-span-3 text-right">{TACTICAL_I18N.colRain}</div>
                            <div className="col-span-2 text-right">{TACTICAL_I18N.colWind}</div>
                        </div>
                        
                        {tableRows.map((row: TableRowData, idx: number) => {
                            const showPrecip = (row.precipProb !== null && row.precipProb > 0) || (row.precipSum !== null && row.precipSum > 0);
                            const hasTemp = row.temp !== null;
                            const hasWind = row.windSpeed !== null;
                            const isNowRow = nowIndex !== null && idx === nowIndex;
                            const isPastRow = nowIndex !== null && idx < nowIndex;
                            
                            return (
                            <div
                                key={`row-${idx}`}
                                data-testid="hour-row"
                                data-now={isNowRow}
                                aria-current={isNowRow ? 'time' : undefined}
                                className={`grid grid-cols-12 px-4 md:px-6 py-4 items-center hover:bg-white/[0.02] transition-colors group ${isNowRow ? 'bg-cyan-500/[0.07]' : ''} ${isPastRow ? 'opacity-50' : ''}`}
                            >
                                <div className="col-span-2 flex flex-col items-start gap-0.5 text-xs md:text-sm font-mono font-bold text-slate-400 group-hover:text-cyan-300 transition-colors">
                                    {row.hour}
                                    {isNowRow && (
                                        <span className="px-1 py-0.5 rounded bg-cyan-500/20 border border-cyan-500/30 text-[8px] font-black uppercase tracking-widest text-cyan-300">{labelNow}</span>
                                    )}
                                </div>
                                
                                <div className="col-span-2 flex justify-center">
                                    <div className="scale-[0.6] md:scale-75 origin-center filter drop-shadow-md group-hover:scale-90 transition-transform duration-300">
                                        {getWeatherIcon(row.code, "w-10 h-10", row.isDay, row.precipProb ?? 0, row.windSpeed || 0, row.temp, row.precipSum ?? 0, row.cloudCover)}
                                    </div>
                                </div>
                                
                                <div className="col-span-3 text-center text-sm md:text-base font-mono font-bold tabular-nums">
                                    {hasTemp ? (
                                        <span className="text-white">{Math.round(row.temp!)}°</span>
                                    ) : (
                                        <span className="text-slate-600">--°</span>
                                    )}
                                </div>
                                
                                <div className="col-span-3 flex flex-col md:flex-row justify-end items-end md:items-center gap-0.5 md:gap-1.5">
                                    {showPrecip ? (
                                        <>
                                            {row.precipProb !== null && (
                                                <span className="text-[10px] md:text-[11px] font-black text-blue-400 tabular-nums">
                                                    {row.precipProb}%
                                                </span>
                                            )}
                                            {row.precipSum !== null && row.precipSum > 0 && (
                                                <span className="text-[9px] text-slate-400 font-mono font-bold bg-blue-900/20 px-1.5 py-0.5 rounded border border-blue-500/20 shadow-inner">
                                                    {formatPrecipitation(row.precipSum, row.snowfall)}
                                                </span>
                                            )}
                                        </>
                                    ) : (
                                        <span className="text-slate-700 font-bold">-</span>
                                    )}
                                </div>
                                
                                <div className="col-span-2 flex flex-col items-end text-xs font-mono font-bold tabular-nums transition-colors">
                                    {hasWind ? (
                                        <>
                                            <span className="text-slate-400 group-hover:text-emerald-400">{Math.round(row.windSpeed!)}</span>
                                            <span className="text-[8px] uppercase tracking-widest text-slate-600">km/h</span>
                                        </>
                                    ) : (
                                        <span className="text-slate-600 text-lg leading-none">--</span>
                                    )}
                                </div>
                            </div>
                            );
                        })}
                    </div>
                </div>
            )}
            
            <div className="h-6"></div>
          </div>
      </div>
    </div>
  );
}