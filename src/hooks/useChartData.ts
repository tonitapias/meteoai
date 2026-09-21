// src/hooks/useChartData.ts
import { useMemo } from 'react';
import { ExtendedWeatherData } from '../types/weatherLogicTypes';
import { WeatherUnit } from '../utils/formatters';
import { generateHourlyChartData } from '../utils/weatherMappers';
import { buildHourlyChartSeries } from '../utils/hourlyChartSeries';

/** Hores que dibuixen els gràfics d'Expert a partir de l'hora actual. */
const CHART_WINDOW_HOURS = 24;

export function useChartData(weatherData: ExtendedWeatherData | null, currentHourlyIndex: number, unit: WeatherUnit) {

  const allHourlyData = useMemo(() => {
    if (!weatherData) return [];
    return generateHourlyChartData(weatherData, currentHourlyIndex, unit);
  }, [weatherData, currentHourlyIndex, unit]);

  const chartData24h = useMemo(() => allHourlyData.slice(0, 24), [allHourlyData]);
  const chartDataFull = useMemo(() => allHourlyData, [allHourlyData]);

  // Sèrie que DIBUIXEN els gràfics d'Expert: línia principal + models, amb la temperatura corregida per
  // inversió (com Forecast24h i el detall de dia) i forats com a null. chartData24h/chartDataFull
  // continuen sent la temperatura crua, que és el que esperen els seus altres consumidors.
  const chartSeries = useMemo(() => {
    const times = weatherData?.hourly?.time;
    if (!weatherData || !Array.isArray(times)) return null;
    const start = Math.max(0, currentHourlyIndex);
    const length = Math.max(0, Math.min(CHART_WINDOW_HOURS, times.length - start));
    const indices = Array.from({ length }, (_, i) => start + i);
    return buildHourlyChartSeries(weatherData, indices, unit);
  }, [weatherData, unit, currentHourlyIndex]);

  return { allHourlyData, chartData24h, chartDataFull, chartSeries };
}
