// src/hooks/useWeatherCalculations.ts
import { useMemo } from 'react';
import { getShiftedDate } from '../utils/physics';
import { ExtendedWeatherData } from '../types/weatherLogicTypes';
import { WeatherUnit } from '../utils/formatters';

// ELS NOUS MICRO-HOOKS
import { useChartData } from './useChartData';
import { useCurrentConditions } from './useCurrentConditions';

export function useWeatherCalculations(weatherData: ExtendedWeatherData | null, unit: WeatherUnit, now: Date) {
  
  // 1. Càlcul bàsic del temps (Protecció Tàctica contra fusos horaris nuls o invàlids)
  const shiftedNow = useMemo(() => {
    if (!weatherData || typeof weatherData.timezone !== 'string') return now;
    try {
        return getShiftedDate(now, weatherData.timezone);
    } catch (e) {
        console.warn("Timezone resolution failed, falling back to local time:", e);
        return now; // Fallback d'emergència
    }
  }, [weatherData, now]);

  // Càlcul Segur de l'Índex Horari (Zero Type Assertions, prevenció de crash per Strings)
  const currentHourlyIndex = useMemo(() => {
     if (!weatherData?.hourly || !Array.isArray(weatherData.hourly.time) || !weatherData?.current?.time) {
         return 0;
     }

     const apiCurrentTimeStr = weatherData.current.time;
     
     // Evitem fallades si l'API decideix enviar un timestamp en lloc d'un string ISO
     if (typeof apiCurrentTimeStr !== 'string') return 0;

     // 1a Passada: Cerca exacta
     const exactIdx = weatherData.hourly.time.findIndex(
         (t: unknown) => typeof t === 'string' && t === apiCurrentTimeStr
     );
     if (exactIdx !== -1) return exactIdx;

     // 2a Passada: Cerca parcial (comprovant la longitud per no rebentar el slice)
     const currentHourStr = apiCurrentTimeStr.length >= 13 ? apiCurrentTimeStr.slice(0, 13) : '';
     if (!currentHourStr) return 0;

     const partialIdx = weatherData.hourly.time.findIndex(
         (t: unknown) => typeof t === 'string' && t.startsWith(currentHourStr)
     );
     
     return partialIdx !== -1 ? partialIdx : 0;
  }, [weatherData]);

  // 2. Orquestració dels mòduls
  const { chartData24h, chartDataFull, comparisonData } = useChartData(weatherData, currentHourlyIndex, unit);

  const {
    minutelyPreciseData, currentRainProbability, currentFreezingLevel, effectiveWeatherCode,
    currentCape, weeklyExtremes, currentDewPoint, reliability, moonPhaseVal, barometricTrend
  } = useCurrentConditions(weatherData, shiftedNow, currentHourlyIndex, chartData24h);

  // 3. Retornem exactament el mateix objecte de sempre (Contracte intacte cap a la UI)
  return { 
    shiftedNow, 
    minutelyPreciseData, 
    currentRainProbability, 
    currentFreezingLevel, 
    effectiveWeatherCode, 
    barometricTrend, 
    currentCape, 
    currentDewPoint, 
    reliability, 
    moonPhaseVal, 
    chartData24h, 
    chartDataFull, 
    comparisonData, 
    weeklyExtremes 
  };
}