// src/hooks/useWeather.ts
import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import * as Sentry from "@sentry/react"; 
import { 
    normalizeModelData, 
    isAromeSupported, 
    ExtendedWeatherData 
} from '../utils/weatherLogic';

import { AirQualityData } from '../types/weather';
import { getAromeData } from '../services/weatherApi'; 
import { fetchAllWeatherData } from './useWeatherQuery'; 
import { useAromeWorker } from './useAromeWorker'; 

import { WeatherUnit } from '../utils/formatters';
import { Language, TRANSLATIONS } from '../translations';
import { cacheService } from '../services/cacheService'; 

interface WeatherCachePacket {
    weather: ExtendedWeatherData;
    aqi: AirQualityData | null;
}

export type WeatherFetchResult = 
    | { success: true }
    | { success: false; error: string; type: 'network' | 'validation' | 'unknown' };

const CACHE_TTL = 15 * 60 * 1000; 

export function useWeather(lang: Language, unit: WeatherUnit) {
  const [weatherData, setWeatherData] = useState<ExtendedWeatherData | null>(null);
  const [aqiData, setAqiData] = useState<AirQualityData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { runAromeWorker } = useAromeWorker();

  const t = useMemo(() => {
      return { ...TRANSLATIONS['ca'], ...(TRANSLATIONS[lang] || {}) };
  }, [lang]);

  const lastFetchRef = useRef<{lat: number, lon: number, unit: string, time: number} | null>(null);

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
    const cacheKey = cacheService.generateWeatherKey(lat, lon, unit);

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
      // 1. Cache Local
      const cachedPacket = await cacheService.get<WeatherCachePacket>(cacheKey, CACHE_TTL);
      if (cachedPacket) {
          setWeatherData(cachedPacket.weather);
          setAqiData(cachedPacket.aqi);
          setLoading(false);
          return { success: true };
      }

      // 2. Petició de Xarxa
      const { weatherRaw, geoData, aqiData: fetchedAqi } = await fetchAllWeatherData(
        lat, lon, unit, lang, locationName, country
      );

      let processedData = normalizeModelData(weatherRaw);
      
      // 3. Integració AROME
      if (isAromeSupported(lat, lon)) {
          try {
             const aromeRaw = await getAromeData(lat, lon);
             processedData = await runAromeWorker(processedData, aromeRaw);
          } catch (aromeErr) { 
              // Només Sentry, sense warn a consola
              Sentry.captureException(aromeErr, { 
                  tags: { service: 'AromeWorker', type: 'FallbackToBase' },
                  level: 'warning' 
              });
          }
      }

      // 4. Finalització
      processedData.location = { 
          ...processedData.location, 
          name: geoData.city,
          country: geoData.country,
          latitude: lat,
          longitude: lon 
      };

      const packet: WeatherCachePacket = {
          weather: processedData,
          aqi: fetchedAqi
      };
      
      await cacheService.set(cacheKey, packet);
      
      setAqiData(fetchedAqi);
      setWeatherData(processedData);
      
      return { success: true };

    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      
      Sentry.captureException(err, { 
          tags: { service: 'WeatherAPI' },
          extra: { lat, lon, unit }
      });

      setError(t.fetchError); 
      
      return { 
          success: false, 
          error: errorMessage, 
          type: 'unknown' 
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