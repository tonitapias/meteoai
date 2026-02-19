// src/hooks/useAIAnalysis.ts
/* eslint-disable react-hooks/preserve-manual-memoization */
import { useMemo } from 'react';
import { Language } from '../translations';
import { generateAIPrediction } from '../utils/aiContext';
import { calculateReliability } from '../utils/rules/reliabilityRules';
import { ExtendedWeatherData } from '../types/weatherLogicTypes';
import { AirQualityData } from '../types/weather';

export function useAIAnalysis(
  weatherData: ExtendedWeatherData | null, 
  aqiData: AirQualityData | null, 
  effectiveWeatherCode: number | null, 
  lang: Language
) {
  const analysis = useMemo(() => {
    if (!weatherData) return null;

    // SOLUCIÓ PURA TS: Tractem minutely_15 com a Record per extreure 'precipitation' evitant el {}
    const minutely = weatherData.minutely_15 as Record<string, unknown> | undefined;
    
    const currentWithMinutely = { 
      ...weatherData.current, 
      minutely15: minutely?.['precipitation'] as number[] | undefined
    };
    
    const reliability = calculateReliability(
      weatherData.daily,
      weatherData.dailyComparison?.gfs,
      weatherData.dailyComparison?.icon,
      0 
    );

    return generateAIPrediction(
      // Fem el cast de tornada a StrictCurrentWeather per acontentar la funció destí
      currentWithMinutely as ExtendedWeatherData['current'], 
      weatherData.daily, 
      weatherData.hourly, 
      aqiData?.current?.european_aqi || 0, 
      lang, 
      effectiveWeatherCode,
      reliability
    );
  }, [weatherData, aqiData, effectiveWeatherCode, lang]);

  return { aiAnalysis: analysis };
}