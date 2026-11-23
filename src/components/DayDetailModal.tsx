// src/components/DayDetailModal.tsx
// El detall d'un dia. Un sol full, com la llista de la Previsió: a dalt la barra amb la creu, el selector de dies (amb la
// mini-franja de cadascun) i el resum; després els avisos oficials del dia, les xifres i "la columna del dia" (la franja
// del cel girada, hora per hora). «Columna | Gràfic» torna als gràfics de sempre (Temp · Pluja · Vent · Neu amb els models).
//
// Totes les xifres surten de useDayDetailData: la màxima, la mínima, el vent i la pluja són les mateixes que la llista i el
// gràfic de tendència (vegeu el hook).
import { useMemo, useEffect, useCallback, useRef, useState } from 'react';
import { X } from 'lucide-react';
import SmartForecastCharts from './SmartForecastCharts';
import { ReliabilityDots } from './ReliabilityDots';
import { DaySelector, type DaySelectorDay } from './dayDetail/DaySelector';
import { DayFacts, type DayFact } from './dayDetail/DayFacts';
import { DayAlerts } from './dayDetail/DayAlerts';
import { DayColumn, type DayColumnLabels } from './dayDetail/DayColumn';
import { TRANSLATIONS, Language } from '../translations';
import { ExtendedWeatherData, StrictCurrentWeather, type LocationMeta } from '../types/weatherLogicTypes';
import { WeatherUnit, formatPrecipitation, formatHoursMinutes, getWeatherLabel, getSafeLocale, formatTemp, formatDecimal } from '../utils/formatters';
import { useDayDetailData } from '../hooks/useDayDetailData';
import { useDialogFocus } from '../hooks/useDialogFocus';
import { useOfficialAlerts } from '../hooks/useOfficialAlerts';
import { hasVisibleRange, type ModelRange } from '../utils/dailyModelSpread';
import { CONFIDENCE_TEXT } from '../utils/forecastConfidenceText';
import { isLikelyWet } from '../utils/precipSignal';
import { getUVCategory } from '../utils/uvIndexUtils';
import { swipeDirection, FIRST_DETAIL_DAY, LAST_DETAIL_DAY } from '../utils/dayNavigation';
import { buildDaySky, skyStripBackground } from '../utils/daySky';
import { buildDayColumn, findDryWindow, temperatureScale, hourFraction, rowOffsetOf } from '../utils/dayColumn';
import { alertsForDay } from '../utils/alertTime';
import { getWeatherIcon } from './WeatherIcons';
import { getHourCodesByDate, type HourlySeries } from '../utils/hourlyWeatherCode';
import { MATRIX_BG } from './widgets/widgetStyles';
import { useMinWidth } from './solar/useMinWidth';
import { isRegionalModelActive } from '../constants/regionalModels';

interface DayDetailModalProps {
  weatherData: ExtendedWeatherData | null;
  selectedDayIndex: number | null;
  onClose: () => void;
  /** Si hi és, el detall es pot canviar de dia (selector, ←/→ i lliscant) sense tancar-lo. */
  onSelectDay?: (dayIndex: number) => void;
  unit: WeatherUnit;
  lang: Language;
}

type HoursView = 'column' | 'chart';

const capitalize = (text: string, locale: string) => text.charAt(0).toLocaleUpperCase(locale) + text.slice(1);

export default function DayDetailModal({
  weatherData,
  selectedDayIndex,
  onClose,
  onSelectDay,
  unit,
  lang
}: DayDetailModalProps) {
  const t = TRANSLATIONS[lang] || TRANSLATIONS.ca;
  const td = t.dayDetail;
  const locale = getSafeLocale(lang);
  const confidenceText = CONFIDENCE_TEXT[lang] || CONFIDENCE_TEXT.ca;

  const {
    dayData, extremes, dayCode, avgDaylightClouds, windMax, gustsMax, precipProbMax, spread, isRegionalDay,
    hourlyData, comparisonData, snowLevelText, snowLevelRelevant, daylightSec, neighbours, dayIndices, nowIndex
  } = useDayDetailData(weatherData, selectedDayIndex, unit);

  const [view, setView] = useState<HoursView>('column');
  // A partir de 1024 px, el detall fa dues columnes i la columna i els gràfics es veuen alhora (sense «Columna | Gràfic»).
  const wide = useMinWidth('(min-width: 1024px)');

  // Model regional actiu a la ubicació (p. ex. "AROME HD"), o null si tota la previsió és del model global.
  const regionalModelLabel = isRegionalModelActive(weatherData?.current?.source) ? (weatherData?.current?.source as string) : null;

  // Avisos oficials: la mateixa consulta que la franja de la pestanya Ara (es comparteix uns minuts, vegeu el hook).
  const loc = weatherData?.location as LocationMeta | undefined;
  const { alerts } = useOfficialAlerts(loc?.latitude, loc?.longitude, lang);
  const timeZone = typeof weatherData?.timezone === 'string' ? weatherData.timezone : undefined;
  const [openedAt] = useState(() => Date.now());

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
      if (e.target === e.currentTarget) onClose();
  }, [onClose]);

  // L'historial del navegador (botó "enrere") ja el gestiona useModalHistory, registrat des de useViewState.ts — aquí
  // només cal l'atall de teclat Escape.
  useEffect(() => {
      const handleKeyDown = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  // Canvi de dia sense tancar el detall: només dins els dies que la previsió ensenya i només si qui obre el modal ens dóna
  // com canviar-lo (onSelectDay).
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

  // Franja del cel de cada dia (la de la llista de la Previsió) per al selector.
  const daySky = useMemo(() => {
      if (!weatherData?.hourly) return {};
      const hourly = weatherData.hourly as unknown as HourlySeries;
      const elevation = typeof weatherData.elevation === 'number' ? weatherData.elevation : 0;
      return buildDaySky(hourly, getHourCodesByDate(hourly, elevation, weatherData.hourlyComparison));
  }, [weatherData]);

  // Avisos de cada dia del selector (i del dia obert).
  const dayKeys = useMemo(() => {
      const times = weatherData?.daily?.time ?? [];
      const last = Math.min(LAST_DETAIL_DAY, times.length - 1);
      const keys: Array<{ index: number; key: string }> = [];
      for (let i = FIRST_DETAIL_DAY; i <= last; i++) {
          const raw = times[i];
          if (typeof raw === 'string' && raw.length >= 10) keys.push({ index: i, key: raw.slice(0, 10) });
      }
      return keys;
  }, [weatherData]);

  const alertsByDay = useMemo(() => {
      const out = new Map<string, ReturnType<typeof alertsForDay>>();
      for (const { key } of dayKeys) out.set(key, alertsForDay(alerts, key, timeZone, openedAt));
      return out;
  }, [alerts, dayKeys, timeZone, openedAt]);

  const todayKey = typeof weatherData?.current?.time === 'string' ? weatherData.current.time.slice(0, 10) : null;

  const weekDays = useMemo<DaySelectorDay[]>(() => dayKeys.map(({ index, key }) => {
      const date = new Date(`${key}T12:00:00`);
      const isToday = key === todayKey;
      const weekdayShort = date.toLocaleDateString(locale, { weekday: 'short' }).replace(/\.$/, '');
      const name = isToday ? `${t.today} ${date.getDate()}` : capitalize(date.toLocaleDateString(locale, { weekday: 'long', day: 'numeric' }), locale);
      const hasAlert = (alertsByDay.get(key)?.length ?? 0) > 0;
      return {
          index,
          abbr: isToday && t.today.length <= 5 ? t.today : weekdayShort,
          date: date.getDate(),
          aria: hasAlert ? `${name}, ${td.dayHasAlert}` : name,
          strip: skyStripBackground(daySky[key] ?? []),
          hasAlert
      };
  }), [dayKeys, todayKey, locale, t.today, td.dayHasAlert, alertsByDay, daySky]);

  // La columna del dia: les mateixes hores que el gràfic (hourlyData) amb el cel del motor i els models globals.
  const columnRows = useMemo(() => {
      if (!weatherData?.hourly) return [];
      return buildDayColumn({
          hourly: weatherData.hourly as unknown as HourlySeries,
          dayIndices,
          primary: hourlyData,
          comparison: comparisonData,
          elevation: typeof weatherData.elevation === 'number' ? weatherData.elevation : 0,
          hourlyComparison: weatherData.hourlyComparison,
          unit
      });
  }, [weatherData, dayIndices, hourlyData, comparisonData, unit]);
  const tempScale = useMemo(() => temperatureScale(columnRows), [columnRows]);
  const dryWindow = useMemo(() => findDryWindow(columnRows), [columnRows]);

  if (!dayData) return null;

  const formatTime = (isoString?: string) => {
      if (!isoString || !isoString.includes('T')) return null;
      return isoString.split('T')[1]?.slice(0, 5) || null;
  };

  const formatDate = (isoString: string) => {
      try {
          // [FIX PRECISIÓ] Hora local (T12:00:00) perquè una data "YYYY-MM-DD" no es llegeixi com a mitjanit UTC i mostri
          // el dia anterior en fusos horaris darrere d'UTC. Majúscula només a la primera lletra (auditoria d'UX, B1).
          const datePart = isoString.includes('T') ? isoString.split('T')[0] : isoString;
          const text = new Date(datePart + 'T12:00:00').toLocaleDateString(locale, { weekday: 'long', day: 'numeric', month: 'long' });
          return capitalize(text, locale);
      } catch { return isoString; }
  };

  // Màxima, mínima i vent màxim vénen de les HORES del dia (vegeu useDayDetailData): les mateixes xifres que la llista de
  // 7 dies i que la columna i el gràfic d'aquest mateix detall.
  const safeMaxTemp = typeof extremes?.max === 'number' && !isNaN(extremes.max) ? Math.round(extremes.max) : '--';
  const safeMinTemp = typeof extremes?.min === 'number' && !isNaN(extremes.min) ? Math.round(extremes.min) : '--';
  const safeWindMax = typeof windMax === 'number' && !isNaN(windMax) ? Math.round(windMax) : '--';
  const safeUvMax = typeof dayData.uvMax === 'number' && !isNaN(dayData.uvMax) ? formatDecimal(dayData.uvMax, lang) : '--';

  // Fiabilitat, rang probable i origen de les temperatures del dia (com al gràfic de tendència): una xifra sense aquest
  // context sembla més segura del que és. El rang és en °C i es passa a la unitat de l'usuari en mostrar-lo.
  const labelMax = typeof t.max === 'string' ? t.max : 'Màx';
  const labelMin = typeof t.min === 'string' ? t.min : 'Mín';
  const formatRange = (r: ModelRange) => `${formatTemp(r.low, unit)}–${formatTemp(r.high, unit)}°`;
  const maxRange = spread?.maxProbable ?? null;
  const minRange = spread?.minProbable ?? null;
  const rangeParts = [
      hasVisibleRange(maxRange) ? `${labelMax} ${formatRange(maxRange)}` : null,
      hasVisibleRange(minRange) ? `${labelMin} ${formatRange(minRange)}` : null
  ].filter((p): p is string => p !== null);
  const reliabilityLevel = spread?.reliability ?? null;
  // Només hi ha origen que dir quan la ubicació té model regional: un dia de model global entre dies regionals és
  // justament el salt que l'usuari ha de poder explicar-se.
  const sourceLabel = regionalModelLabel ? (isRegionalDay ? regionalModelLabel : confidenceText.globalModel) : null;

  // Estat del cel del dia amb la mateixa etiqueta que la resta de l'app (p. ex. "Majorment serè").
  const skyLabel = dayCode !== null
      ? getWeatherLabel({ weather_code: dayCode } as unknown as StrictCurrentWeather, lang, avgDaylightClouds)
      : '';

  // Xifres del dia. La quarta és contextual: la cota de neu quan hi pot haver neu; si no, les hores de sol.
  const dailyRaw = weatherData?.daily as unknown as Record<string, unknown> | undefined;
  const snowSumArr = dailyRaw?.snowfall_sum;
  const snowSum = Array.isArray(snowSumArr) && selectedDayIndex !== null && typeof snowSumArr[selectedDayIndex] === 'number'
      ? (snowSumArr[selectedDayIndex] as number)
      : 0;
  const [precipValue, precipUnit] = typeof dayData.precipSum === 'number' && !isNaN(dayData.precipSum)
      ? formatPrecipitation(dayData.precipSum, snowSum, lang).split(' ')
      : ['--', ''];
  const uvCategory = typeof dayData.uvMax === 'number' && !isNaN(dayData.uvMax) ? getUVCategory(dayData.uvMax) : null;
  const sunshineValue = formatHoursMinutes(dayData.sunshineSec);

  // Si la xifra és de neu (cm), l'etiqueta també: «Pluja 4 cm» no té sentit.
  const precipLabel = precipUnit === 'cm' ? capitalize(t.forecastWeek.sky.snow, locale) : td.rainShort;

  const facts: DayFact[] = [
      {
          label: precipLabel, value: precipValue, unit: precipUnit,
          note: precipProbMax !== null ? `${td.maxChance} ${Math.round(precipProbMax)}%` : undefined,
          noteClass: isLikelyWet(precipProbMax) ? 'text-cyan-300' : 'text-slate-400', noteTestId: 'note-precip', testId: 'stat-precip'
      },
      {
          label: td.wind, value: safeWindMax, unit: 'km/h',
          note: gustsMax !== null ? `${td.gustsShort} ${Math.round(gustsMax)} km/h` : undefined,
          noteTestId: 'note-gusts', testId: 'stat-wind'
      },
      {
          label: td.uv, value: safeUvMax,
          note: uvCategory ? uvCategory.label[lang].toLocaleLowerCase(locale) : undefined,
          noteClass: uvCategory?.color, noteTestId: 'note-uv', testId: 'stat-uv'
      },
      snowLevelRelevant
          ? { label: td.snowLevel, value: snowLevelText, testId: 'stat-snow' }
          : {
              label: td.sunShort, value: sunshineValue, testId: 'stat-sunshine', noteTestId: 'note-sunshine',
              note: sunshineValue !== '--' && daylightSec !== null ? `${td.outOf} ${formatHoursMinutes(daylightSec)}` : undefined
          }
  ];

  // Sol i "ara" dins la columna.
  const sunrise = formatTime(dayData.sunrise);
  const sunset = formatTime(dayData.sunset);
  const sunriseOffset = rowOffsetOf(columnRows, hourFraction(dayData.sunrise));
  const sunsetOffset = rowOffsetOf(columnRows, hourFraction(dayData.sunset));
  const nowPoint = nowIndex !== null ? hourlyData[nowIndex] : undefined;
  const nowRow = nowPoint ? columnRows.findIndex(r => r.time === nowPoint.time) : -1;
  const nowFraction = hourFraction(typeof weatherData?.current?.time === 'string' ? weatherData.current.time : null);
  const nowOffset = nowRow !== -1 && nowFraction !== null ? nowRow + (nowFraction - Math.floor(nowFraction)) : null;

  const dayAlerts = alertsByDay.get(dayData.date.slice(0, 10)) ?? [];

  const columnLabels: DayColumnLabels = {
      parts: [td.partNight, td.partMorning, td.partAfternoon, td.partEvening],
      rain: td.rainShort,
      wind: td.windShort,
      daylight: td.daylight,
      dryWindow: td.dryWindow,
      legendForecast: td.legendForecast,
      legendBand: td.legendBand,
      legendRain: td.legendRain,
      legendRainSnow: td.legendRainSnow,
      legendRainMixed: td.legendRainMixed,
      legendFeels: td.legendFeels,
      legendGust: td.legendGust,
      legendSun: td.legendSun,
      legendWind: td.legendWind,
      now: td.now,
      feelsWord: td.feelsWord,
      gustsWord: td.gustsShort,
      rainChanceWord: td.rainChanceWord,
      snowChanceWord: td.snowChanceWord,
      sky: t.forecastWeek.sky
  };

  const columnView = (
      <DayColumn
          rows={columnRows}
          scale={tempScale}
          dryWindow={dryWindow}
          sunriseOffset={sunriseOffset}
          sunsetOffset={sunsetOffset}
          nowOffset={nowOffset}
          sunrise={sunrise}
          sunset={sunset}
          daylight={daylightSec !== null ? formatHoursMinutes(daylightSec) : null}
          labels={columnLabels}
          lang={lang}
      />
  );
  const chartView = (
      <div data-no-swipe className="px-3 sm:px-4 pb-4">
          <SmartForecastCharts
              data={hourlyData}
              comparisonData={comparisonData}
              lang={lang}
              regionalModelLabel={regionalModelLabel}
              nowIndex={nowIndex}
              framed={false}
          />
      </div>
  );

  const viewButton = (value: HoursView, label: string) => (
      <button
          type="button"
          data-testid={`view-${value}`}
          aria-pressed={view === value}
          onClick={() => setView(value)}
          className={`h-[30px] px-3 rounded-[9px] text-[13px] transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-400 ${view === value ? 'bg-white/[0.08] font-semibold text-slate-100' : 'text-slate-400 hover:text-slate-200'}`}
      >
          {label}
      </button>
  );

  return (
    <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="day-detail-modal-title"
        className="fixed inset-0 z-[100] flex items-center justify-center p-0 sm:p-4 bg-[#03050a]/90 animate-in fade-in duration-200"
        onClick={handleBackdropClick}
    >
      <div
          ref={scrollRef}
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
          className="relative w-full h-full sm:h-auto sm:max-w-2xl lg:max-w-5xl sm:max-h-[94vh] overflow-y-auto custom-scrollbar bg-[#0a0b11] sm:rounded-[2rem] sm:border sm:border-white/[0.07] shadow-2xl"
      >
        <div className="relative min-h-full bg-gradient-to-b from-[#0e1018] to-[#0a0b11]">
          <div className={MATRIX_BG}></div>

          {/* Barra de dalt: la creu dins del flux, mai sobre el contingut */}
          <div className="sticky top-0 z-20 h-14 flex items-center justify-between gap-3 pl-5 pr-2 sm:pl-6 sm:pr-3 bg-[#0e1018] border-b border-white/[0.05]">
              <span className="min-w-0 truncate font-mono text-[11px] font-medium uppercase tracking-[0.16em] text-slate-400">
                  {td.forecast}
                  {sourceLabel && (
                      <>
                          <span aria-hidden="true"> · </span>
                          <span
                              data-testid="day-source"
                              data-regional={isRegionalDay}
                              className={isRegionalDay ? 'text-cyan-300' : 'text-slate-400'}
                          >
                              {sourceLabel}
                          </span>
                      </>
                  )}
              </span>
              <button
                  type="button"
                  onClick={onClose}
                  aria-label={t.closeWindow}
                  className="shrink-0 w-11 h-11 flex items-center justify-center rounded-[14px] border border-white/10 bg-black/30 text-slate-300 hover:text-white hover:border-white/20 transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-400"
              >
                  <X className="w-5 h-5" />
              </button>
          </div>

          <div className="relative">
            {onSelectDay && selectedDayIndex !== null && (
                <div className="pt-2">
                    <DaySelector days={weekDays} selected={selectedDayIndex} onSelect={goToDay} label={td.daysNav} />
                </div>
            )}

            {/* A l'ordinador (≥ 1024 px), dues columnes: a l'esquerra el resum, les xifres i els gràfics; a la dreta, la
                columna del dia. Al mòbil i a la tauleta, una sola columna amb «Columna | Gràfic». */}
            <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)] lg:items-start">
            <div data-testid="day-detail-side" className="min-w-0 lg:border-r lg:border-white/[0.06] lg:pb-2">
            {/* Resum: cel, data, mínima i màxima, i la fiabilitat dita en una frase */}
            <section className="px-5 sm:px-6 pt-3.5 pb-4 border-t border-white/[0.06]">
                <div className="flex items-center gap-3.5">
                    {dayCode !== null && (
                        <div data-testid="day-sky" className="shrink-0">
                            {getWeatherIcon(dayCode, 'w-11 h-11', true, 0, windMax ?? 0, null, 0, avgDaylightClouds)}
                        </div>
                    )}
                    <div className="flex-1 min-w-0 flex flex-col gap-1">
                        {skyLabel && skyLabel !== '---' && (
                            <p data-testid="day-sky-label" className="text-[19px] font-semibold leading-tight tracking-[-0.01em] text-slate-100">{skyLabel}</p>
                        )}
                        <h2 id="day-detail-modal-title" className="text-[13px] font-normal text-slate-400">{formatDate(dayData.date)}</h2>
                    </div>
                    <div className="shrink-0 flex items-baseline gap-2.5 tabular-nums">
                        <span data-testid="day-min" className={`text-xl ${safeMinTemp !== '--' ? 'text-[#7a879b]' : 'text-slate-600'}`}>{safeMinTemp}°</span>
                        <span data-testid="day-max" className={`text-[42px] leading-none font-light tracking-[-0.02em] ${safeMaxTemp !== '--' ? 'text-slate-50' : 'text-slate-600'}`}>{safeMaxTemp}°</span>
                    </div>
                </div>
                {(reliabilityLevel || rangeParts.length > 0) && (
                    <p className="mt-3 text-[13px] leading-relaxed text-slate-400">
                        {reliabilityLevel && (
                            <span data-testid="day-reliability" data-level={reliabilityLevel} className="inline-flex items-center gap-2 mr-1.5 align-baseline">
                                <ReliabilityDots level={reliabilityLevel} />
                                <span className="font-medium text-slate-200">{confidenceText.reliability[reliabilityLevel]}.</span>
                            </span>
                        )}
                        {rangeParts.length > 0 && (
                            <span data-testid="day-probable-range" className="tabular-nums">
                                {confidenceText.probableRange}:{' '}
                                {/* Si no hi cap tot en una línia, el salt cau entre la màxima i la mínima, mai dins d'un rang. */}
                                {rangeParts.map((part, i) => (
                                    <span key={part} className="whitespace-nowrap">{i > 0 ? ' · ' : ''}{part}</span>
                                ))}
                            </span>
                        )}
                    </p>
                )}
            </section>

            <DayAlerts alerts={dayAlerts} lang={lang} timeZone={timeZone} label={td.officialAlert} />

            <DayFacts facts={facts} />

            {/* A l'ordinador, els gràfics de sempre hi són sempre, al costat de la columna */}
            {wide && (
                <section data-testid="day-detail-charts" className="border-t border-white/[0.06] pt-3.5">
                    <h3 className="px-5 sm:px-6 pb-3 font-mono text-[11px] font-medium uppercase tracking-[0.16em] text-slate-400">{t.hourlyEvolution}</h3>
                    {chartView}
                </section>
            )}
            </div>

            {/* Les hores: la columna del dia o, al mòbil, els gràfics de sempre */}
            <section className="min-w-0 border-t border-white/[0.06] pt-3.5">
                <div className="flex items-center justify-between gap-3 px-5 sm:px-6 pb-3 min-h-[39px]">
                    <h3 className="font-mono text-[11px] font-medium uppercase tracking-[0.16em] text-slate-400">{td.columnTitle}</h3>
                    {!wide && (
                        <div role="group" aria-label={td.viewAria} className="flex p-[3px] gap-0.5 rounded-xl bg-black/35 border border-white/[0.06]">
                            {viewButton('column', td.viewColumn)}
                            {viewButton('chart', td.viewChart)}
                        </div>
                    )}
                </div>

                {wide || view === 'column' ? columnView : chartView}
            </section>
            </div>

            <div className="h-6"></div>
          </div>
        </div>
      </div>
    </div>
  );
}
