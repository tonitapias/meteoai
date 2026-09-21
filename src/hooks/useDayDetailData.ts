// src/hooks/useDayDetailData.ts
import { useMemo } from 'react';
import { ExtendedWeatherData } from '../types/weatherLogicTypes';
import { WEATHER_THRESHOLDS } from '../constants/weatherConfig';
import { WeatherUnit } from '../utils/formatters';
import { buildHourlyChartSeries, findNowIndex } from '../utils/hourlyChartSeries';

export const useDayDetailData = (
  weatherData: ExtendedWeatherData | null,
  selectedDayIndex: number | null,
  unit: WeatherUnit = 'C'
) => {

  const dayData = useMemo(() => {
    if (!weatherData || selectedDayIndex === null) return null;
    const i = selectedDayIndex;
    const daily = weatherData.daily;
    if (!daily || !daily.time || !daily.time[i]) return null;

    return {
      date: daily.time[i],
      maxTemp: daily.temperature_2m_max[i],
      minTemp: daily.temperature_2m_min[i],
      precipSum: daily.precipitation_sum?.[i],
      windMax: daily.wind_speed_10m_max?.[i],
      sunrise: daily.sunrise?.[i],
      sunset: daily.sunset?.[i],
      uvMax: daily.uv_index_max?.[i]
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

  // Línia principal + models d'aquest dia, amb la MATEIXA sèrie que el tauler d'Expert (temperatura
  // corregida per inversió, forats com a null i models alineats hora a hora). Vegeu hourlyChartSeries.ts.
  const chartSeries = useMemo(
    () => (weatherData && dayIndices.length > 0 ? buildHourlyChartSeries(weatherData, dayIndices, unit) : null),
    [weatherData, dayIndices, unit]
  );

  const hourlyData = useMemo(() => chartSeries?.primary ?? [], [chartSeries]);
  const comparisonData = chartSeries?.comparison ?? null;

  // Posició d'"ara" dins les hores d'aquest dia: només si el dia és avui (si no, no hi ha cap marca).
  const nowIndex = useMemo(() => findNowIndex(hourlyData, weatherData?.current?.time), [hourlyData, weatherData]);

  const snowLevelText = useMemo(() => {
     const levels = hourlyData
        .map(d => d.snowLevel)
        .filter((l: number | null): l is number => l != null);

     if (levels.length === 0) return "---";

     const min = Math.round(Math.min(...levels));
     const max = Math.round(Math.max(...levels));

     const cap = WEATHER_THRESHOLDS.DEFAULTS.MAX_DISPLAY_SNOW_LEVEL;
     if (min > cap) return `> ${cap}m`;
     if (Math.abs(max - min) < 50) return `${min}m`;
     return `${min} - ${max}m`;
  }, [hourlyData]);

  // [NETEJA] Exposem dayIndices perquè DayDetailModal.tsx el pugui reutilitzar a
  // tableRows en lloc de recalcular "les 24 hores del dia" amb una lògica pròpia
  // que assumia un bloc contigu de 24 posicions.
  return { dayData, hourlyData, comparisonData, snowLevelText, dayIndices, nowIndex };
};
