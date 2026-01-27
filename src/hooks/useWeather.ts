// src/hooks/useWeather.ts
import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
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

  // MILLORA DE SEGURETAT (Corregida amb useMemo):
  // Utilitzem useMemo per evitar que l'objecte 't' es recreï en cada render,
  // el que causaria que el useCallback de sota s'executés innecessàriament.
  const t = useMemo(() => {
      return { ...TRANSLATIONS['ca'], ...(TRANSLATIONS[lang] || {}) };
  }, [lang]);

  const lastFetchRef = useRef<{lat: number, lon: number, unit: string, time: number} | null>(null);

  useEffect(() => {
      // Neteja de cache en segon pla (sense afectar el rendiment inicial)
      cacheService.clean().catch(console.error);
  }, []);

  const fetchWeatherByCoords = useCallback(async (lat: number, lon: number, locationName?: string, country?: string) => {
    const now = Date.now();
    const cacheKey = cacheService.generateWeatherKey(lat, lon, unit);

    // Evitem crides duplicades si l'usuari prem molts cops seguits (Debounce manual de 3s)
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
      // 1. Intentem recuperar de la Cache local (Offline First)
      const cachedPacket = await cacheService.get<WeatherCachePacket>(cacheKey, CACHE_TTL);
      if (cachedPacket) {
          // eslint-disable-next-line no-console
          console.log("⚡ Recuperat de Cache (Offline Ready):", cacheKey);
          setWeatherData(cachedPacket.weather);
          setAqiData(cachedPacket.aqi);
          setLoading(false);
          return true;
      }

      // 2. Si no hi ha cache, fem la petició a la xarxa
      const { weatherRaw, geoData, aqiData: fetchedAqi } = await fetchAllWeatherData(
        lat, 
        lon, 
        unit, 
        lang, 
        locationName, 
        country
      );

      let processedData = normalizeModelData(weatherRaw);
      
      // 3. Integració Model AROME (Alta resolució) si estem a zona suportada
      if (isAromeSupported(lat, lon)) {
          try {
             const aromeRaw = await getAromeData(lat, lon);
             // Injectem les dades d'alta resolució sobre les dades base
             processedData = injectHighResModels(processedData, aromeRaw);
          } catch (aromeErr) { 
              // Si falla AROME, no bloquegem l'app. Degradem l'experiència elegantment (només model base).
              console.warn("Arome no disponible (Degradació elegant):", aromeErr); 
              Sentry.captureException(aromeErr, { 
                  tags: { service: 'AromeModel', type: 'SilentFail' },
                  level: 'warning' 
              });
          }
      }

      // 4. Finalitzem l'estructura de dades amb la localització
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
      
      // Guardem a cache per la pròxima vegada
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

      setError(t.fetchError); // Usem la traducció segura
      return false;
    } finally {
      setLoading(false);
    }
  }, [unit, lang, t]); // Afegim 't' a les dependències tot i que és estable

  return { 
    weatherData, aqiData, loading, error, 
    fetchWeatherByCoords
  };
}