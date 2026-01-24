// src/hooks/useWeather.ts
import { useState, useCallback, useRef, useEffect } from 'react';
import * as Sentry from "@sentry/react"; 
import { 
    normalizeModelData, 
    isAromeSupported, 
    injectHighResModels,
    ExtendedWeatherData 
} from '../utils/weatherLogic';
import { getWeatherData, getAirQualityData, getAromeData } from '../services/weatherApi';
import { reverseGeocode } from '../services/geocodingService';
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
      // Intentar recuperar de Cache
      const cachedPacket = await cacheService.get<WeatherCachePacket>(cacheKey, CACHE_TTL);
      
      if (cachedPacket) {
          // eslint-disable-next-line no-console
          console.log("⚡ Recuperat de Cache (Offline Ready):", cacheKey);
          setWeatherData(cachedPacket.weather);
          setAqiData(cachedPacket.aqi);
          setLoading(false);
          return true;
      }

      // Fetch Xarxa
      const weatherPromise = getWeatherData(lat, lon, unit);
      const aqiPromise = getAirQualityData(lat, lon);
      
      const namePromise = (locationName === "La Meva Ubicació") 
        ? reverseGeocode(lat, lon, lang)
        : Promise.resolve({ city: locationName || "Ubicació actual", country: country || "Local" });

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const [data, geoData, airData] = await Promise.all([weatherPromise, namePromise, aqiPromise]) as [any, any, AQIData];

      let processedData = normalizeModelData(data);
      
      // Lògica AROME amb Observabilitat (Sentry)
      if (isAromeSupported(lat, lon)) {
          try {
             const aromeRaw = await getAromeData(lat, lon);
             processedData = injectHighResModels(processedData, aromeRaw);
          } catch (aromeErr) { 
              // Capturem com a warning, no com a error fatal, perquè l'app segueix funcionant amb ECMWF
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

      // Guardar a Cache
      const packet: WeatherCachePacket = {
          weather: processedData,
          aqi: airData
      };
      await cacheService.set(cacheKey, packet);
      
      setAqiData(airData);
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