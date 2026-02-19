// src/hooks/controllers/useDataController.ts
import { useWeather } from '../useWeather';
import { useWeatherCalculations } from '../useWeatherCalculations';
import { useWeatherTheme } from '../useWeatherTheme';
import { useWeatherAI } from '../useWeatherAI';
import { useGeoLocation } from '../../context/GeoLocationContext';
import { isAromeSupported } from '../../utils/physics';
import type { Language } from '../../translations';
import type { WeatherUnit } from '../../utils/formatters';

interface DataControllerProps {
  lang: Language;
  unit: WeatherUnit;
  now: Date;
}

// Definim el tipus exacte de location per evitar el fallback a {} de TS (Risc Zero)
interface LocationMeta {
    latitude: number;
    longitude: number;
    [key: string]: unknown;
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

  // Forcem el tipatge de location per corregir la pèrdua d'inferència del compilador
  const loc = weatherData?.location as LocationMeta | undefined;

  const supportsArome = loc 
    ? isAromeSupported(loc.latitude, loc.longitude) 
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