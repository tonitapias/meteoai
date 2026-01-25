// src/hooks/useWeather.ts
import { useState, useCallback, useRef, useEffect } from 'react';
import * as Sentry from "@sentry/react"; 
import { 
    normalizeModelData, 
    isAromeSupported, 
    injectHighResModels,
    ExtendedWeatherData 
} from '../utils/weatherLogic';

import { getAromeData } from '../services/weatherApi'; 
import { fetchAllWeatherData } from './useWeatherQuery'; 

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

  // CANVI: Eliminem 'notification' i 'handleGetCurrentLocation' d'aquí.
  // Aquest hook ara és purament de DADES.

  const t = TRANSLATIONS[lang] || TRANSLATIONS['ca'];
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
      const cachedPacket = await cacheService.get<WeatherCachePacket>(cacheKey, CACHE_TTL);
      if (cachedPacket) {
          // eslint-disable-next-line no-console
          console.log("⚡ Recuperat de Cache (Offline Ready):", cacheKey);
          setWeatherData(cachedPacket.weather);
          setAqiData(cachedPacket.aqi);
          setLoading(false);
          return true;
      }

      const { weatherRaw, geoData, aqiData } = await fetchAllWeatherData(
        lat, 
        lon, 
        unit, 
        lang, 
        locationName, 
        country
      );

      let processedData = normalizeModelData(weatherRaw);
      
      if (isAromeSupported(lat, lon)) {
          try {
             const aromeRaw = await getAromeData(lat, lon);
             processedData = injectHighResModels(processedData, aromeRaw);
          } catch (aromeErr) { 
              console.warn("Arome no disponible (Degradació elegant):", aromeErr); 
              Sentry.captureException(aromeErr, { 
                  tags: { service: 'AromeModel', type: 'SilentFail' },
                  level: 'warning' 
              });
          }
      }

      processedData.location = { 
          ...processedData.location, 
          name: geoData.city,
          country: geoData.country,
          latitude: lat,
          longitude: lon 
      };

      const packet: WeatherCachePacket = {
          weather: processedData,
          aqi: aqiData
      };
      await cacheService.set(cacheKey, packet);
      
      setAqiData(aqiData);
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
  }, [unit, lang, t]); 

  return { 
    weatherData, aqiData, loading, error, 
    fetchWeatherByCoords
  };
}