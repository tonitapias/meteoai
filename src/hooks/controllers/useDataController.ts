import { useWeather } from '../useWeather';
import { useWeatherCalculations } from '../useWeatherCalculations';
import { useWeatherTheme } from '../useWeatherTheme';
import { useWeatherAI } from '../useWeatherAI';
import { useGeoLocation } from '../../context/GeoLocationContext';
import { isAromeSupported } from '../../utils/physics';
import { Language } from '../../translations';
import { WeatherUnit } from '../../utils/formatters';

interface DataControllerProps {
  lang: Language;
  unit: WeatherUnit;
  now: Date;
}

export function useDataController({ lang, unit, now }: DataControllerProps) {
  // 1. Obtenció de Dades Pures
  const { weatherData, aqiData, loading, error, fetchWeatherByCoords } = useWeather(lang, unit);
  const { getCoordinates } = useGeoLocation();

  // 2. Física i Matemàtiques (Calculations)
  // Necessiten 'now' per saber la posició del sol
  const calculations = useWeatherCalculations(weatherData, unit, now);

  // 3. Estètica basada en Dades (Theme)
  const theme = useWeatherTheme(weatherData, calculations.effectiveWeatherCode);

  // 4. Intel·ligència (AI)
  const { aiAnalysis } = useWeatherAI(weatherData, aqiData, lang, unit, calculations.reliability);

  // Fusionem Theme dins de Calculations (com es feia abans) per consistència
  const calculationsWithTheme = {
    ...calculations,
    currentBg: theme.currentBg
  };

  const supportsArome = weatherData?.location 
    ? isAromeSupported(weatherData.location.latitude, weatherData.location.longitude) 
    : false;

  return {
    state: {
      weatherData,
      aqiData,
      loading,
      error,
      calculations: calculationsWithTheme,
      aiAnalysis
    },
    actions: {
      fetchWeatherByCoords,
      getCoordinates
    },
    flags: {
      supportsArome
    }
  };
}