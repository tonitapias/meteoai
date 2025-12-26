import { useState, useEffect } from 'react';
import { generateAIPrediction, calculateReliability } from '../utils/weatherLogic';

export function useAIAnalysis(weatherData, aqiData, effectiveWeatherCode, lang) {
  const [analysis, setAnalysis] = useState(null);

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