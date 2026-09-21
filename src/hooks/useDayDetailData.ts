// src/hooks/useDayDetailData.ts
import { useMemo } from 'react';
import { ExtendedWeatherData } from '../types/weatherLogicTypes';
import { WEATHER_THRESHOLDS } from '../constants/weatherConfig';
import { WeatherUnit } from '../utils/formatters';
import { buildHourlyChartSeries, findNowIndex } from '../utils/hourlyChartSeries';
import { generateHourlyChartData } from '../utils/weatherMappers';
import { hoursOfDate, resolveDailyExtremes, averageDaylightClouds, type DailyExtremes } from '../utils/dailyExtremes';
import { resolveDailySpread, type DailyModelSpread } from '../utils/dailyModelSpread';
import { resolveDailyCode } from '../utils/dailyWeatherCode';
import { getHourlyWeatherCode, type HourlySeries } from '../utils/hourlyWeatherCode';
import { daylightSeconds } from '../utils/daylight';
import { neighbourDays, type NeighbourDays } from '../utils/dayNavigation';
import { extractValidArrayNum, getSafeArrayNum, getSafeLatitude } from '../utils/weatherMath';

/** El màxim dels valors que hi són, o null si no n'hi ha cap (mai un 0 fals). */
const maxOfPresent = (values: ReadonlyArray<number | null>): number | null => {
  const present = values.filter((v): v is number => v !== null);
  return present.length === 0 ? null : Math.max(...present);
};

export const useDayDetailData = (
  weatherData: ExtendedWeatherData | null,
  selectedDayIndex: number | null,
  unit: WeatherUnit = 'C'
) => {

  // Només el que el dia diu per si sol. La màxima, la mínima, el vent màxim i la probabilitat de pluja NO
  // hi són a propòsit: el valor diari cru és del model GLOBAL i el model regional (AROME HD...) només entra
  // a les hores, així que el detall n'ensenyava dues versions (la capçalera i el seu propi gràfic).
  // Vegeu `extremes`, `windMax` i `precipProbMax` més avall.
  const dayData = useMemo(() => {
    if (!weatherData || selectedDayIndex === null) return null;
    const i = selectedDayIndex;
    const daily = weatherData.daily;
    if (!daily || !daily.time || !daily.time[i]) return null;

    return {
      date: daily.time[i],
      precipSum: daily.precipitation_sum?.[i],
      sunrise: daily.sunrise?.[i],
      sunset: daily.sunset?.[i],
      uvMax: daily.uv_index_max?.[i],
      // Només el model global publica les hores de sol: no hi ha equivalent horari amb el model regional.
      sunshineSec: extractValidArrayNum(daily.sunshine_duration, i)
    };
  }, [weatherData, selectedDayIndex]);

  const dayIndices = useMemo(() => {
    if (!weatherData || !dayData?.date) return [];
    const targetDate = dayData.date.includes('T') ? dayData.date.split('T')[0] : dayData.date;

    return weatherData.hourly.time
      .map((t: string, idx: number) => ({
        datePart: t.includes('T') ? t.split('T')[0] : t,
        idx
      }))
      .filter((item: { datePart: string, idx: number }) => item.datePart === targetDate)
      .map((item: { datePart: string, idx: number }) => item.idx);
  }, [weatherData, dayData]);

  // Hores de TOT el dia amb la mateixa font que la llista de 7 dies (chartDataFull). Aquella comença a
  // l'hora actual, així que per a "avui" seria un dia a mitges: aquí es generen des de la primera hora.
  // Temperatura CRUA i en °C a propòsit: resolveDailyExtremes hi aplica la correcció (vegeu weatherMappers).
  const allHours = useMemo(
    () => (weatherData ? generateHourlyChartData(weatherData, 0, 'C') : []),
    [weatherData]
  );

  const dayHours = useMemo(
    () => (dayData ? hoursOfDate(allHours, dayData.date.slice(0, 10)) : []),
    [allHours, dayData]
  );

  // Màxima i mínima del dia, calculades igual que a la llista i al gràfic de tendència
  // (utils/dailyExtremes.ts): amb la correcció d'inversió i amb el model regional a les hores on n'hi ha.
  const extremes = useMemo<DailyExtremes | null>(() => {
    if (!weatherData || selectedDayIndex === null || !dayData) return null;
    const daily = weatherData.daily;
    return resolveDailyExtremes(
      extractValidArrayNum(daily.temperature_2m_max, selectedDayIndex),
      extractValidArrayNum(daily.temperature_2m_min, selectedDayIndex),
      dayHours,
      getSafeLatitude(weatherData.location)
    );
  }, [weatherData, selectedDayIndex, dayData, dayHours]);

  // Cel del dia i estat que se'n diu: les mateixes entrades que la fila d'aquest dia a la llista de 7 dies
  // (ForecastSection) —el codi diari del model, els núvols diürns i els codis del motor de les hores—,
  // perquè la icona de la capçalera no pugui ser diferent de la de la fila on s'ha fet clic.
  const avgDaylightClouds = useMemo(() => averageDaylightClouds(dayHours), [dayHours]);

  const dayCode = useMemo<number | null>(() => {
    if (!weatherData || selectedDayIndex === null || !dayData) return null;
    const elevation = typeof weatherData.elevation === 'number' ? weatherData.elevation : 0;
    const hourly = weatherData.hourly as unknown as HourlySeries;
    const hourCodes = dayIndices.map(idx => getHourlyWeatherCode(hourly, idx, elevation, weatherData.hourlyComparison));
    return resolveDailyCode(getSafeArrayNum(weatherData.daily.weather_code, selectedDayIndex), avgDaylightClouds, hourCodes);
  }, [weatherData, selectedDayIndex, dayData, dayIndices, avgDaylightClouds]);

  // Vent màxim: el de les hores que el detall mostra a la taula. Sense cap hora amb vent, el valor diari.
  const windMax = useMemo<number | null>(() => {
    if (!weatherData || selectedDayIndex === null) return null;
    const hourlyWind = (weatherData.hourly as unknown as Record<string, unknown>).wind_speed_10m;
    return (
      maxOfPresent(dayIndices.map(idx => extractValidArrayNum(hourlyWind, idx))) ??
      extractValidArrayNum(weatherData.daily.wind_speed_10m_max, selectedDayIndex)
    );
  }, [weatherData, selectedDayIndex, dayIndices]);

  // Probabilitat màxima de pluja: la diària o la de la taula si aquesta és més alta (el reforç del model
  // regional només arriba a les hores). Així la targeta no pot dir "0 %" sobre una taula amb hores al 70 %.
  const precipProbMax = useMemo<number | null>(() => {
    if (!weatherData || selectedDayIndex === null) return null;
    const hourlyProb = (weatherData.hourly as unknown as Record<string, unknown>).precipitation_probability;
    return maxOfPresent([
      extractValidArrayNum(weatherData.daily.precipitation_probability_max, selectedDayIndex),
      ...dayIndices.map(idx => extractValidArrayNum(hourlyProb, idx))
    ]);
  }, [weatherData, selectedDayIndex, dayIndices]);

  // Acord entre models sobre les temperatures d'aquest dia (fiabilitat i rangs), com al gràfic de tendència.
  const spread = useMemo<DailyModelSpread | null>(() => {
    if (!weatherData || selectedDayIndex === null || !extremes) return null;
    return resolveDailySpread(selectedDayIndex, extremes.max, extremes.min, weatherData.daily, weatherData.dailyComparison);
  }, [weatherData, selectedDayIndex, extremes]);

  // Alguna de les temperatures extremes del dia surt del model regional (i no del global).
  const isRegionalDay = extremes ? extremes.maxRegional || extremes.minRegional : false;

  // Línia principal + models d'aquest dia, amb la MATEIXA sèrie que el tauler d'Expert (temperatura
  // corregida per inversió, forats com a null i models alineats hora a hora). Vegeu hourlyChartSeries.ts.
  const chartSeries = useMemo(
    () => (weatherData && dayIndices.length > 0 ? buildHourlyChartSeries(weatherData, dayIndices, unit) : null),
    [weatherData, dayIndices, unit]
  );

  const hourlyData = useMemo(() => chartSeries?.primary ?? [], [chartSeries]);
  const comparisonData = chartSeries?.comparison ?? null;

  // Ràfega màxima: la de la mateixa sèrie que dibuixa el gràfic (model regional inclòs); sense cap, la diària.
  const gustsMax = useMemo<number | null>(() => {
    if (!weatherData || selectedDayIndex === null) return null;
    return (
      maxOfPresent(hourlyData.map(p => p.gusts)) ??
      extractValidArrayNum(weatherData.daily.wind_gusts_10m_max, selectedDayIndex)
    );
  }, [weatherData, selectedDayIndex, hourlyData]);

  // Posició d'"ara" dins les hores d'aquest dia: només si el dia és avui (si no, no hi ha cap marca).
  const nowIndex = useMemo(() => findNowIndex(hourlyData, weatherData?.current?.time), [hourlyData, weatherData]);

  const snowLevels = useMemo(
    () => hourlyData.map(d => d.snowLevel).filter((l: number | null): l is number => l != null),
    [hourlyData]
  );

  const snowLevelText = useMemo(() => {
     if (snowLevels.length === 0) return "---";

     const min = Math.round(Math.min(...snowLevels));
     const max = Math.round(Math.max(...snowLevels));

     const cap = WEATHER_THRESHOLDS.DEFAULTS.MAX_DISPLAY_SNOW_LEVEL;
     if (min > cap) return `> ${cap}m`;
     if (Math.abs(max - min) < 50) return `${min}m`;
     return `${min} - ${max}m`;
  }, [snowLevels]);

  // La cota de neu només diu alguna cosa quan hi pot haver neu: el dia en porta, o la cota baixa per sota
  // del límit que l'app ja fa servir per mostrar-la. Un "> 3500m" a l'estiu és soroll que ocupa una targeta.
  const snowLevelRelevant = useMemo(() => {
    if (!weatherData || selectedDayIndex === null) return false;
    const snowfall = extractValidArrayNum(weatherData.daily.snowfall_sum, selectedDayIndex);
    if (snowfall !== null && snowfall > 0) return true;
    return snowLevels.length > 0 && Math.min(...snowLevels) <= WEATHER_THRESHOLDS.DEFAULTS.MAX_DISPLAY_SNOW_LEVEL;
  }, [weatherData, selectedDayIndex, snowLevels]);

  // Segons de llum del dia (sortida → posta), o null si falta alguna de les dues hores.
  const daylightSec = useMemo(() => daylightSeconds(dayData?.sunrise, dayData?.sunset), [dayData]);

  // Dies veïns dins els que la previsió setmanal ja llista (per a les fletxes, el teclat i el gest de lliscar).
  const neighbours = useMemo<NeighbourDays>(
    () => (weatherData && selectedDayIndex !== null
      ? neighbourDays(selectedDayIndex, weatherData.daily.time.length)
      : { prev: null, next: null }),
    [weatherData, selectedDayIndex]
  );

  // [NETEJA] Exposem dayIndices perquè DayDetailModal.tsx el pugui reutilitzar a
  // tableRows en lloc de recalcular "les 24 hores del dia" amb una lògica pròpia
  // que assumia un bloc contigu de 24 posicions.
  return {
    dayData, extremes, dayCode, avgDaylightClouds, windMax, gustsMax, precipProbMax, spread, isRegionalDay,
    hourlyData, comparisonData, snowLevelText, snowLevelRelevant, daylightSec, neighbours, dayIndices, nowIndex
  };
};
