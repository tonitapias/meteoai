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
    // DOCTRINA RISC ZERO 1: Bloqueig estricte si falta l'objecte current
    if (!weatherData || !weatherData.current) return null;

    const minutely = weatherData.minutely_15 as Record<string, unknown> | undefined;
    const precipData = minutely?.['precipitation'];
    
    // DOCTRINA RISC ZERO 2: Protecció de matrius. No podem fer un simple "as number[]". 
    // Si l'API retorna { precipitation: null }, l'aplicació caurà en els map/reduce posteriors.
    const currentWithMinutely = { 
      ...weatherData.current, 
      minutely15: Array.isArray(precipData) ? precipData as number[] : undefined
    };
    
    const reliability = calculateReliability(
      weatherData.daily,
      weatherData.dailyComparison?.gfs,
      weatherData.dailyComparison?.icon,
      0 
    );

    return generateAIPrediction(
      currentWithMinutely as ExtendedWeatherData['current'], 
      weatherData.daily, 
      weatherData.hourly, 
      // DOCTRINA RISC ZERO 3: Ús de ?? (Nullish Coalescing) en comptes de || 
      // Si la qualitat de l'aire és literalment 0 (perfecte), || ho tractaria com a falsy i l'ignoraria.
      aqiData?.current?.european_aqi ?? 0, 
      lang, 
      effectiveWeatherCode,
      reliability
    );
  }, [weatherData, aqiData, effectiveWeatherCode, lang]);

  return { aiAnalysis: analysis };
}