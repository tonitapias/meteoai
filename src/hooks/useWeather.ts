// src/hooks/useWeather.ts
import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import * as Sentry from "@sentry/react"; 
import { 
    normalizeModelData, 
    isAromeSupported, 
    // injectHighResModels, // ELIMINAT: Ara ho fem via Worker
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

  // MILLORA DE SEGURETAT (Mantinguda): Evita re-renders innecessaris
  const t = useMemo(() => {
      return { ...TRANSLATIONS['ca'], ...(TRANSLATIONS[lang] || {}) };
  }, [lang]);

  const lastFetchRef = useRef<{lat: number, lon: number, unit: string, time: number} | null>(null);

  useEffect(() => {
      cacheService.clean().catch(console.error);
  }, []);

  // --- NOVA UTILITAT: Wrapper per al Worker (Promesa) ---
  const runAromeWorker = useCallback((base: ExtendedWeatherData, highRes: ExtendedWeatherData) => {
      return new Promise<ExtendedWeatherData>((resolve, reject) => {
          // Creem el worker al vol (Vite ho optimitza automàticament)
          const worker = new Worker(new URL('../workers/arome.worker.ts', import.meta.url), { type: 'module' });
          
          worker.onmessage = (e) => {
              if (e.data.success) {
                  resolve(e.data.data);
              } else {
                  reject(new Error(e.data.error));
              }
              worker.terminate(); // Important: Tanquem el fil per alliberar memòria
          };
          
          worker.onerror = (err) => {
              reject(err);
              worker.terminate();
          };
          
          // Enviem les dades pesades al fil secundari
          worker.postMessage({ baseData: base, highResData: highRes });
      });
  }, []);

  const fetchWeatherByCoords = useCallback(async (lat: number, lon: number, locationName?: string, country?: string) => {
    const now = Date.now();
    const cacheKey = cacheService.generateWeatherKey(lat, lon, unit);

    // Debounce de 3 segons per evitar spam de crides
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
      // 1. Cache Local
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
      
      // 3. Integració Model AROME (Via Worker 🧵)
      if (isAromeSupported(lat, lon)) {
          try {
             const aromeRaw = await getAromeData(lat, lon);
             
             // AQUÍ ESTÀ LA MÀGIA: No bloquegem la UI, esperem el Worker
             processedData = await runAromeWorker(processedData, aromeRaw);

          } catch (aromeErr) { 
              console.warn("⚠️ Arome Worker/Fetch Error (Degradació elegant):", aromeErr); 
              Sentry.captureException(aromeErr, { 
                  tags: { service: 'AromeWorker', type: 'FallbackToBase' },
                  level: 'warning' 
              });
              // Si falla, continuem amb 'processedData' (OpenMeteo base) sense AROME.
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
  }, [unit, lang, t, runAromeWorker]); // Afegim runAromeWorker a dependències

  return { 
    weatherData, aqiData, loading, error, 
    fetchWeatherByCoords
  };
}