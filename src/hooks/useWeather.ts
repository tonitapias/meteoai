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

import { WeatherUnit } from '../utils/formatters';
import { Language, TRANSLATIONS } from '../translations';
import { cacheService } from '../services/cacheService'; 

type AQIData = Record<string, unknown>;

interface WeatherCachePacket {
    weather: ExtendedWeatherData;
    aqi: AQIData | null;
}

const CACHE_TTL = 15 * 60 * 1000; 
const AROME_TIMEOUT_MS = 4000; // 4 segons màxim per al càlcul físic

export function useWeather(lang: Language, unit: WeatherUnit) {
  const [weatherData, setWeatherData] = useState<ExtendedWeatherData | null>(null);
  const [aqiData, setAqiData] = useState<AQIData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const t = useMemo(() => {
      return { ...TRANSLATIONS['ca'], ...(TRANSLATIONS[lang] || {}) };
  }, [lang]);

  const lastFetchRef = useRef<{lat: number, lon: number, unit: string, time: number} | null>(null);

  useEffect(() => {
      cacheService.clean().catch(console.error);
  }, []);

  // --- WORKER WRAPPER AMB TIMEOUT I MONITORATGE ---
  const runAromeWorker = useCallback((base: ExtendedWeatherData, highRes: ExtendedWeatherData) => {
      return new Promise<ExtendedWeatherData>((resolve, reject) => {
          const startTime = performance.now();
          
          // 1. Monitoratge: Inici del Worker
          Sentry.addBreadcrumb({
              category: 'arome-worker',
              message: 'Starting AROME High-Res Calculation',
              level: 'info'
          });

          const worker = new Worker(new URL('../workers/arome.worker.ts', import.meta.url), { type: 'module' });
          
          // 2. Kill Switch: Timeout de seguretat
          const timeoutId = setTimeout(() => {
              worker.terminate();
              const msg = `AROME Worker Timeout (${AROME_TIMEOUT_MS}ms) - Aborting`;
              console.warn(`⚠️ ${msg}`);
              
              Sentry.addBreadcrumb({
                  category: 'arome-worker',
                  message: 'Worker Timed Out - Fallback to Standard Model',
                  level: 'warning'
              });
              
              // No fem reject, sinó que resolem amb les dades base per no mostrar error a l'usuari
              // Simplement perdem l'alta resolució, però l'app funciona.
              resolve(base); 
          }, AROME_TIMEOUT_MS);

          worker.onmessage = (e) => {
              clearTimeout(timeoutId); // Cancelem el timeout si ha acabat a temps
              
              if (e.data.success) {
                  const duration = Math.round(performance.now() - startTime);
                  // Monitoratge: Èxit i rendiment
                  Sentry.addBreadcrumb({
                      category: 'arome-worker',
                      message: `Calculation Success in ${duration}ms`,
                      level: 'info'
                  });
                  resolve(e.data.data);
              } else {
                  reject(new Error(e.data.error));
              }
              worker.terminate(); 
          };
          
          worker.onerror = (err) => {
              clearTimeout(timeoutId);
              reject(err);
              worker.terminate();
          };
          
          worker.postMessage({ baseData: base, highResData: highRes });
      });
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
      
      // 3. Integració Model AROME (Via Worker 🧵 amb Timeout)
      if (isAromeSupported(lat, lon)) {
          try {
             // Descarreguem dades AROME
             const aromeRaw = await getAromeData(lat, lon);
             
             // Processem al fil secundari (protegit per timeout)
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