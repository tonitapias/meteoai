// src/hooks/useWeather.ts
import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import * as Sentry from "@sentry/react"; 
import { 
    normalizeModelData, 
    isAromeSupported, 
    ExtendedWeatherData 
} from '../utils/weatherLogic';

import { getAromeData } from '../services/weatherApi'; 
import { fetchAllWeatherData } from './useWeatherQuery'; 
import { useAromeWorker } from './useAromeWorker'; // <--- NOU IMPORT

import { WeatherUnit } from '../utils/formatters';
import { Language, TRANSLATIONS } from '../translations';
import { cacheService } from '../services/cacheService'; 

type AQIData = Record<string, unknown>;

interface WeatherCachePacket {
    weather: ExtendedWeatherData;
    aqi: AQIData | null;
}

const CACHE_TTL = 15 * 60 * 1000; 

export function useWeather(lang: Language, unit: WeatherUnit) {
  const [weatherData, setWeatherData] = useState<ExtendedWeatherData | null>(null);
  const [aqiData, setAqiData] = useState<AQIData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Hook personalitzat per gestionar el worker (Separation of Concerns)
  const { runAromeWorker } = useAromeWorker();

  const t = useMemo(() => {
      return { ...TRANSLATIONS['ca'], ...(TRANSLATIONS[lang] || {}) };
  }, [lang]);

  const lastFetchRef = useRef<{lat: number, lon: number, unit: string, time: number} | null>(null);

  useEffect(() => {
      cacheService.clean().catch(console.error);
  }, []);

  const fetchWeatherByCoords = useCallback(async (lat: number, lon: number, locationName?: string, country?: string) => {
    const now = Date.now();
    const cacheKey = cacheService.generateWeatherKey(lat, lon, unit);

    if (lastFetchRef.current && 
        lastFetchRef.current.lat === lat && 
        lastFetchRef.current.lon === lon &&
        lastFetchRef.current.unit === unit &&
        (now - lastFetchRef.current.time) < 3000) {
        return true; 
    }

    setLoading(true);
    setError(null);
    lastFetchRef.current = { lat, lon, unit, time: now };

    try {
      // 1. Cache Local (IndexedDB)
      const cachedPacket = await cacheService.get<WeatherCachePacket>(cacheKey, CACHE_TTL);
      if (cachedPacket) {
          // eslint-disable-next-line no-console
          console.log("⚡ Recuperat de Cache (Offline Ready):", cacheKey);
          setWeatherData(cachedPacket.weather);
          setAqiData(cachedPacket.aqi);
          setLoading(false);
          return true;
      }

      // 2. Petició de Xarxa (Main Thread)
      const { weatherRaw, geoData, aqiData: fetchedAqi } = await fetchAllWeatherData(
        lat, lon, unit, lang, locationName, country
      );

      let processedData = normalizeModelData(weatherRaw);
      
      // 3. Integració Model AROME (Via Worker 🧵 Extret al Hook useAromeWorker)
      if (isAromeSupported(lat, lon)) {
          try {
             // Descarreguem dades AROME
             const aromeRaw = await getAromeData(lat, lon);
             
             // Processem al fil secundari usant el hook net
             processedData = await runAromeWorker(processedData, aromeRaw);

          } catch (aromeErr) { 
              console.warn("⚠️ Arome Worker/Fetch Error (Degradació elegant):", aromeErr); 
              Sentry.captureException(aromeErr, { 
                  tags: { service: 'AromeWorker', type: 'FallbackToBase' },
                  level: 'warning' 
              });
              // Si falla (o timeout), continuem amb 'processedData' (OpenMeteo base)
          }
      }

      // 4. Finalització de dades
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
      
      return true;

    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      console.error("❌ Error en fetchWeather:", errorMessage);

      Sentry.captureException(err, { 
          tags: { service: 'WeatherAPI' },
          extra: { lat, lon, unit }
      });

      setError(t.fetchError); 
      return false;
    } finally {
      setLoading(false);
    }
  }, [unit, lang, t, runAromeWorker]); 

  return { 
    weatherData, aqiData, loading, error, 
    fetchWeatherByCoords
  };
}