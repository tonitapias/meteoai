// src/hooks/useWeather.ts
import { useState, useCallback, useRef, useEffect } from 'react';
import * as Sentry from "@sentry/react"; 
import { 
    normalizeModelData, 
    isAromeSupported, 
    injectHighResModels,
    ExtendedWeatherData 
} from '../utils/weatherLogic';

// CANVI 1: Netegem imports (ja no necessitem getWeatherData ni reverseGeocode aquí directament)
import { getAromeData } from '../services/weatherApi'; 
// import { reverseGeocode ... } -> ELIMINAT
import { fetchAllWeatherData } from './useWeatherQuery'; // -> NOU IMPORT

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
  const [notification, setNotification] = useState<{ type: 'success' | 'error' | 'info', msg: string } | null>(null);

  const t = TRANSLATIONS[lang] || TRANSLATIONS['ca'];
  const lastFetchRef = useRef<{lat: number, lon: number, unit: string, time: number} | null>(null);

  useEffect(() => {
      cacheService.clean().catch(console.error);
  }, []);

  const fetchWeatherByCoords = useCallback(async (lat: number, lon: number, locationName?: string, country?: string) => {
    const now = Date.now();
    const cacheKey = cacheService.generateWeatherKey(lat, lon, unit);

    // Evitar re-fetching ràpid (Debounce manual)
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
      // 1. CACHE (Es manté igual)
      const cachedPacket = await cacheService.get<WeatherCachePacket>(cacheKey, CACHE_TTL);
      if (cachedPacket) {
          // eslint-disable-next-line no-console
          console.log("⚡ Recuperat de Cache (Offline Ready):", cacheKey);
          setWeatherData(cachedPacket.weather);
          setAqiData(cachedPacket.aqi);
          setLoading(false);
          return true;
      }

      // 2. XARXA (CANVI PRINCIPAL: Ús del nou orquestrador)
      // Tota la complexitat de Promises i geocoding està ara encapsulada aquí
      const { weatherRaw, geoData, aqiData } = await fetchAllWeatherData(
        lat, 
        lon, 
        unit, 
        lang, 
        locationName, 
        country
      );

      // 3. PROCESSAMENT (Es manté la lògica de UI/Normalització)
      let processedData = normalizeModelData(weatherRaw);
      
      // Lògica AROME (Es manté aquí perquè depèn de la lògica de negoci específica de 'injectHighResModels')
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

      // Assignem les dades geogràfiques netes que ens ha retornat fetchAllWeatherData
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

  const handleGetCurrentLocation = useCallback(() => {
    if (!navigator.geolocation) {
      setNotification({ type: 'error', msg: t.geoNotSupported });
      return;
    }
    
    setLoading(true);
    const geoOptions = { enableHighAccuracy: false, timeout: 8000, maximumAge: 0 };

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const success = await fetchWeatherByCoords(pos.coords.latitude, pos.coords.longitude, "La Meva Ubicació");
        if (success) {
          setNotification({ type: 'success', msg: t.notifLocationSuccess });
          setTimeout(() => setNotification(null), 3000);
        }
      },
      (err) => {
        console.warn("Error GPS:", err.message);
        Sentry.captureException(err, { tags: { service: 'Geolocation' } });
        setNotification({ type: 'error', msg: t.notifLocationError });
        setLoading(false);
      },
      geoOptions
    );
  }, [fetchWeatherByCoords, t]);

  return { 
    weatherData, aqiData, loading, error, notification, 
    setNotification, fetchWeatherByCoords, handleGetCurrentLocation 
  };
}