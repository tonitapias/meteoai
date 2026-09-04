// src/hooks/useCurrentConditions.ts
import { useMemo } from 'react';
import { getRealTimeWeatherCode } from '../utils/weatherLogic';
import { calculateDewPoint, getMoonPhase } from '../utils/weatherMath';
import { calculateReliability } from '../utils/rules/reliabilityRules';
import { ExtendedWeatherData, StrictCurrentWeather, StrictDailyWeather } from '../types/weatherLogicTypes';
import { getComparisonVal } from '../utils/weatherMappers';

// Definim un tipus bàsic per a les dades del gràfic que necessitem aquí
type ChartDataSubset = { rain: number; snowLevel: number | null }[];

// HELPER RISC ZERO
const getSafeArrNum = (arr: unknown, index: number, fallback: number = 0): number => {
    if (!Array.isArray(arr)) return fallback;
    const val = arr[index];
    return (typeof val === 'number' && !isNaN(val)) ? val : fallback;
};

export function useCurrentConditions(
    weatherData: ExtendedWeatherData | null, 
    shiftedNow: Date, 
    currentHourlyIndex: number, 
    chartData24h: ChartDataSubset
) {
  
  const minutelyPreciseData = useMemo<number[]>(() => {
    let preciseData: number[] = [];
    const minutely = weatherData?.minutely_15 as Record<string, unknown> | undefined;

    if (minutely && Array.isArray(minutely.precipitation) && Array.isArray(minutely.time)) {
        const currentMs = shiftedNow.getTime(); 
        const timesRaw = minutely.time as string[];
        let idx = -1;
        for(let i = 0; i < timesRaw.length; i++) {
            if (new Date(timesRaw[i]).getTime() > currentMs) { idx = i; break; }
        }
        const currentIdx = (idx === -1) ? timesRaw.length - 1 : Math.max(0, idx - 1);
        const precipArr = minutely.precipitation as number[];
        preciseData = precipArr.slice(currentIdx, currentIdx + 4);
    }
    const hasMinutelyRain = preciseData.some(v => v > 0);
    if (hasMinutelyRain) return preciseData;

    const hourlyPrec = weatherData?.hourly?.precipitation as number[] | undefined;
    const currentHourPrecip = hourlyPrec?.[currentHourlyIndex] || 0;
    if (currentHourPrecip > 0) {
        const estimatedQuarter = Number((currentHourPrecip / 4).toFixed(2));
        return [estimatedQuarter, estimatedQuarter, estimatedQuarter, estimatedQuarter];
    }
    return preciseData.length > 0 ? preciseData : [0,0,0,0];
  }, [weatherData, currentHourlyIndex, shiftedNow]);

  const currentRainProbability = useMemo(() => chartData24h[0]?.rain || 0, [chartData24h]);
  const currentFreezingLevel = useMemo(() => (chartData24h.length > 0 && chartData24h[0].snowLevel !== null) ? chartData24h[0].snowLevel + 300 : 2500, [chartData24h]);
  
  const currentCape = useMemo(() => getComparisonVal(weatherData?.hourly, 'cape', currentHourlyIndex) || 0, [weatherData, currentHourlyIndex]);

  const effectiveWeatherCode = useMemo(() => {
      if (!weatherData?.current || !weatherData?.hourly) return null;
      const elevation = typeof weatherData.elevation === 'number' ? weatherData.elevation : 0;
      
      // DOCTRINA RISC ZERO: Enriquiment de la telemetria
      // El node 'current' d'OpenMeteo sol venir sense CAPE, sense capes de núvols detallades i sense visibilitat.
      // Injectem les dades de l'array horari per donar-li a l'Orquestrador tot el context termodinàmic.
      const hRaw = weatherData.hourly as Record<string, unknown>;
      const idx = currentHourlyIndex;
      const currentRaw = weatherData.current as Record<string, unknown>;

      const enrichedCurrent = {
          ...currentRaw,
          cape: currentRaw.cape ?? currentCape,
          visibility: currentRaw.visibility ?? getSafeArrNum(hRaw.visibility, idx, 10000),
          cloud_cover_low: currentRaw.cloud_cover_low ?? getSafeArrNum(hRaw.cloud_cover_low, idx, 0),
          cloud_cover_mid: currentRaw.cloud_cover_mid ?? getSafeArrNum(hRaw.cloud_cover_mid, idx, 0),
          cloud_cover_high: currentRaw.cloud_cover_high ?? getSafeArrNum(hRaw.cloud_cover_high, idx, 0),
          precipitation: currentRaw.precipitation ?? getSafeArrNum(hRaw.precipitation, idx, 0),
          relative_humidity_2m: currentRaw.relative_humidity_2m ?? getSafeArrNum(hRaw.relative_humidity_2m, idx, 50),
      } as unknown as StrictCurrentWeather;

      return getRealTimeWeatherCode(enrichedCurrent, minutelyPreciseData, currentRainProbability, currentFreezingLevel, elevation);
  }, [weatherData, minutelyPreciseData, currentRainProbability, currentFreezingLevel, currentHourlyIndex, currentCape]);

  const weeklyExtremes = useMemo(() => {
    const minTemps = weatherData?.daily?.temperature_2m_min;
    const maxTemps = weatherData?.daily?.temperature_2m_max;
    if (!Array.isArray(minTemps) || !Array.isArray(maxTemps) || minTemps.length === 0) {
        return { min: 0, max: 40 }; 
    }
    return { 
        min: Math.min(...(minTemps as number[])), 
        max: Math.max(...(maxTemps as number[]))
    };
  }, [weatherData]);

  const currentDewPoint = useMemo(() => calculateDewPoint(weatherData?.current?.temperature_2m || 0, weatherData?.current?.relative_humidity_2m || 0), [weatherData]);
  
  const reliability = useMemo(() => {
      if (!weatherData?.daily) return { level: 'high', type: 'ok', value: 0 } as const;
      // [FIX PRECISIÓ] ECMWF ja es baixa (dailyComparison.ecmwf) però abans no
      // s'incloïa en aquesta comparació — vegeu la nota a reliabilityRules.ts.
      return calculateReliability(weatherData.daily as StrictDailyWeather, weatherData.dailyComparison?.gfs, weatherData.dailyComparison?.icon, 0, weatherData.dailyComparison?.ecmwf);
  }, [weatherData]);
  
  const moonPhaseVal = useMemo(() => getMoonPhase(new Date()), []); 
  const barometricTrend = useMemo(() => ({ trend: 'steady', val: 0 }), []); 

  return {
      minutelyPreciseData, currentRainProbability, currentFreezingLevel, 
      effectiveWeatherCode, currentCape, weeklyExtremes, 
      currentDewPoint, reliability, moonPhaseVal, barometricTrend
  };
}