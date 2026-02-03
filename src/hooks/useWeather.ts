// src/hooks/useWeather.ts
import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import * as Sentry from "@sentry/react"; 
import { ExtendedWeatherData } from '../utils/weatherLogic';
import { AirQualityData } from '../types/weather';
import { useAromeWorker } from './useAromeWorker'; 
import { WeatherUnit } from '../utils/formatters';
import { Language, TRANSLATIONS } from '../translations';
import { cacheService } from '../services/cacheService'; 
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

  const t = useMemo(() => {
      return { ...TRANSLATIONS['ca'], ...(TRANSLATIONS[lang] || {}) };
  }, [lang]);

  const lastFetchRef = useRef<{lat: number, lon: number, unit: string, time: number} | null>(null);

  // Neteja de cache inicial
  useEffect(() => {
      cacheService.clean().catch(console.error);
  }, []);

  const fetchWeatherByCoords = useCallback(async (
      lat: number, 
      lon: number, 
      locationName?: string, 
      country?: string
  ): Promise<WeatherFetchResult> => {
    
    const now = Date.now();

    // Evitem re-fetching si la petició és idèntica i molt recent (< 3s)
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
      // Deleguem tota la feina al Repositori
      // Passem 'runAromeWorker' perquè el Repositori pugui usar el worker sense tenir-lo hardcoded
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
      
      // Log d'error centralitzat
      Sentry.captureException(err, { 
          tags: { service: SENTRY_TAGS.SERVICE_WEATHER_API },
          extra: { lat, lon, unit }
      });

      setError(t.fetchError); 
      
      return { 
          success: false, 
          error: errorMessage, 
          type: FETCH_ERROR_TYPES.UNKNOWN 
      };
    } finally {
      setLoading(false);
    }
  }, [unit, lang, t, runAromeWorker]); 

  return { 
    weatherData, aqiData, loading, error, 
    fetchWeatherByCoords
  };
}