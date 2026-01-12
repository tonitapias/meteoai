// src/hooks/useAIAnalysis.ts
import { useState, useEffect } from 'react';
import { generateAIPrediction, calculateReliability, ExtendedWeatherData } from '../utils/weatherLogic';
import { Language } from '../constants/translations';
import { AirQualityData } from '../services/weatherApi';

export function useAIAnalysis(
  weatherData: ExtendedWeatherData | null, 
  aqiData: AirQualityData | null, 
  effectiveWeatherCode: number | null, 
  lang: Language
) {
  const [analysis, setAnalysis] = useState<any>(null);

  useEffect(() => {
    if (weatherData) {
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

      const result = generateAIPrediction(
        currentWithMinutely, 
        weatherData.daily, 
        weatherData.hourly, 
        aqiData?.current?.european_aqi || 0, 
        lang, 
        effectiveWeatherCode,
        reliability
      );
      setAnalysis(result);
    }
  }, [weatherData, aqiData, effectiveWeatherCode, lang]);

  return analysis;
}