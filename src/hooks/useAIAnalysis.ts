// src/hooks/useAIAnalysis.ts
/* eslint-disable react-hooks/preserve-manual-memoization */
import { useMemo } from 'react';
import { generateAIPrediction, calculateReliability, ExtendedWeatherData } from '../utils/weatherLogic';
import { Language } from '../constants/translations';
import { AirQualityData } from '../services/weatherApi';

export function useAIAnalysis(
  weatherData: ExtendedWeatherData | null, 
  aqiData: AirQualityData | null, 
  effectiveWeatherCode: number | null, 
  lang: Language
) {
  const analysis = useMemo(() => {
    if (!weatherData) return null;

    const currentWithMinutely = { 
      ...weatherData.current, 
      minutely15: weatherData.minutely_15?.precipitation 
    };
    
    const reliability = calculateReliability(
      weatherData.daily,
      weatherData.dailyComparison?.gfs,
      weatherData.dailyComparison?.icon,
      0 
    );

    return generateAIPrediction(
      currentWithMinutely, 
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