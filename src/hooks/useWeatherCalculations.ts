// src/hooks/useWeatherCalculations.ts
import { useMemo } from 'react';
import { getShiftedDate } from '../utils/physics';
import { ExtendedWeatherData } from '../types/weatherLogicTypes';
import { WeatherUnit } from '../utils/formatters';

// ELS NOUS MICRO-HOOKS
import { useChartData } from './useChartData';
import { useCurrentConditions } from './useCurrentConditions';

export function useWeatherCalculations(weatherData: ExtendedWeatherData | null, unit: WeatherUnit, now: Date) {
  
  // 1. Càlcul bàsic del temps
  const shiftedNow = useMemo(() => {
    if (!weatherData) return now;
    return getShiftedDate(now, weatherData.timezone as string || 'UTC');
  }, [weatherData, now]);

  const currentHourlyIndex = useMemo(() => {
     if (!weatherData?.hourly?.time || !weatherData?.current?.time) return 0;
     const apiCurrentTimeStr = weatherData.current.time as string; 
     const exactIdx = weatherData.hourly.time.findIndex((t: string) => t === apiCurrentTimeStr);
     if (exactIdx !== -1) return exactIdx;
     const currentHourStr = apiCurrentTimeStr.slice(0, 13);
     const partialIdx = weatherData.hourly.time.findIndex((t: string) => t.startsWith(currentHourStr));
     return partialIdx !== -1 ? partialIdx : 0;
  }, [weatherData]);

  // 2. Orquestració dels mòduls
  const { chartData24h, chartDataFull, comparisonData } = useChartData(weatherData, currentHourlyIndex, unit);

  const {
    minutelyPreciseData, currentRainProbability, currentFreezingLevel, effectiveWeatherCode,
    currentCape, weeklyExtremes, currentDewPoint, reliability, moonPhaseVal, barometricTrend
  } = useCurrentConditions(weatherData, shiftedNow, currentHourlyIndex, chartData24h);

  // 3. Retornem exactament el mateix objecte de sempre (Risc Zero a l'UI)
  return { 
    shiftedNow, minutelyPreciseData, currentRainProbability, currentFreezingLevel, effectiveWeatherCode, 
    barometricTrend, currentCape, currentDewPoint, reliability, moonPhaseVal, 
    chartData24h, 
    chartDataFull, 
    comparisonData, weeklyExtremes 
  };
}