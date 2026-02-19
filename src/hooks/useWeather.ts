// src/hooks/useWeather.ts
import { useState, useRef } from 'react'; // <-- FIX: Eliminat useEffect
import * as Sentry from "@sentry/react"; 
import type { ExtendedWeatherData } from '../types/weatherLogicTypes'; // [FIX] Import correcte
import type { AirQualityData } from '../types/weather';
import { useAromeWorker } from './useAromeWorker'; 
import { WeatherUnit } from '../utils/formatters';
import { Language, TRANSLATIONS } from '../translations';
import { WeatherRepository } from '../repositories/WeatherRepository';
import { SENTRY_TAGS, FETCH_ERROR_TYPES } from '../constants/errorConstants';

export type WeatherFetchResult = 
    | { success: true }
    | { 
        success: false; 
        error: string; 
        type: typeof FETCH_ERROR_TYPES[keyof typeof FETCH_ERROR_TYPES] 
      };

export function useWeather(lang: Language, unit: WeatherUnit) {
  const [weatherData, setWeatherData] = useState<ExtendedWeatherData | null>(null);
  const [aqiData, setAqiData] = useState<AirQualityData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Mantenim el hook del worker aquí per respectar el cicle de vida de React
  const { runAromeWorker } = useAromeWorker();

  const t = TRANSLATIONS[lang] || TRANSLATIONS['ca'];

  // Ref per evitar duplicitat de crides (Debounce/Throttle manual)
  const lastFetchRef = useRef<{ lat: number; lon: number; unit: WeatherUnit; time: number } | null>(null);

  const fetchWeatherByCoords = async (lat: number, lon: number, locationName: string, country?: string): Promise<WeatherFetchResult> => {
    const now = Date.now();

    // Evitem crides repetides en menys de 3 segons
    if (lastFetchRef.current && 
        lastFetchRef.current.lat === lat && 
        lastFetchRef.current.lon === lon &&
        lastFetchRef.current.unit === unit &&
        (now - lastFetchRef.current.time) < 3000) {
        return { success: true }; 
    }

    setLoading(true);
    setError(null);
    lastFetchRef.current = { lat, lon, unit, time: now };

    try {
      const response = await WeatherRepository.get(
          lat, 
          lon, 
          unit, 
          lang, 
          locationName, 
          country,
          runAromeWorker
      );

      setWeatherData(response.data);
      setAqiData(response.aqi);
      
      return { success: true };

    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      
      Sentry.captureException(err, { 
          tags: { service: SENTRY_TAGS.SERVICE_WEATHER_API },
          extra: { lat, lon, unit }
      });

      setError(t.fetchError || "Error obtenint dades"); 
      
      return { 
          success: false, 
          error: errorMessage, 
          type: FETCH_ERROR_TYPES.NETWORK 
      };
    } finally {
      setLoading(false);
    }
  };

  return {
    weatherData,
    aqiData,
    loading,
    error,
    fetchWeatherByCoords
  };
}