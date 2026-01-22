// src/hooks/useWeather.ts
import { useState, useCallback, useRef } from 'react';
import { 
    normalizeModelData, 
    isAromeSupported, 
    injectHighResModels,
    ExtendedWeatherData 
} from '../utils/weatherLogic';
import { getWeatherData, getAirQualityData, getAromeData } from '../services/weatherApi';
import { reverseGeocode } from '../services/geocodingService';
import { WeatherUnit } from '../utils/formatters';
import { Language, TRANSLATIONS } from '../constants/translations'; // IMPORTAT TRANSLATIONS

// Definim un tipus genèric per a les dades de qualitat de l'aire
type AQIData = Record<string, unknown>;

// Interfície actualitzada amb timestamp per controlar la caducitat
interface CacheEntry {
    weather: ExtendedWeatherData;
    aqi: AQIData | null;
    timestamp: number;
}

const weatherCache = new Map<string, CacheEntry>();
const CACHE_TTL = 15 * 60 * 1000; // 15 minuts de vida útil

export function useWeather(lang: Language, unit: WeatherUnit) {
  const [weatherData, setWeatherData] = useState<ExtendedWeatherData | null>(null);
  const [aqiData, setAqiData] = useState<AQIData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notification, setNotification] = useState<{ type: 'success' | 'error' | 'info', msg: string } | null>(null);

  // ACCÉS A LES TRADUCCIONS DEL HOOK
  const t = TRANSLATIONS[lang] || TRANSLATIONS['ca'];

  const lastFetchRef = useRef<{lat: number, lon: number, unit: string, time: number} | null>(null);

  const fetchWeatherByCoords = useCallback(async (lat: number, lon: number, locationName?: string, country?: string) => {
    const now = Date.now();
    const cacheKey = `${lat.toFixed(3)}-${lon.toFixed(3)}-${unit}`;

    // 1. ANTI-REBOTS (Protecció immediata)
    if (lastFetchRef.current && 
        lastFetchRef.current.lat === lat && 
        lastFetchRef.current.lon === lon &&
        (now - lastFetchRef.current.time) < 3000) {
        return true; 
    }

    // 2. CACHÉ AMB TTL (Si les dades són recents (<15 min), les usem)
    const cached = weatherCache.get(cacheKey);
    if (cached && (now - cached.timestamp) < CACHE_TTL) {
        setWeatherData(cached.weather);
        setAqiData(cached.aqi);
        setLoading(false);
        return true; 
    }

    setLoading(true);
    setError(null);
    lastFetchRef.current = { lat, lon, unit, time: now };

    try {
      // 3. PETICIONS EN PARAL·LEL
      const weatherPromise = getWeatherData(lat, lon, unit);
      const aqiPromise = getAirQualityData(lat, lon);
      
      // Deleguem la lògica al nou servei segur
      const namePromise = (locationName === "La Meva Ubicació") 
        ? reverseGeocode(lat, lon, lang)
        : Promise.resolve({ city: locationName || "Ubicació actual", country: country || "Local" });

      // Esperem totes les promeses
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const [data, geoData, airData] = await Promise.all([weatherPromise, namePromise, aqiPromise]) as [any, any, AQIData];

      // 4. PROCESSAMENT DE DADES
      let processedData = normalizeModelData(data);
      
      // 5. INJECCIÓ AROME (Es manté intacta)
      if (isAromeSupported(lat, lon)) {
          try {
             const aromeRaw = await getAromeData(lat, lon);
             processedData = injectHighResModels(processedData, aromeRaw);
          } catch { 
              console.warn("Arome no disponible"); 
          }
      }

      // Actualitzem la ubicació amb les dades normalitzades
      processedData.location = { 
          ...processedData.location, 
          name: geoData.city,
          country: geoData.country,
          latitude: lat,
          longitude: lon 
      };

      // 6. GUARDEM A LA CACHÉ AMB TIMESTAMP
      const entry: CacheEntry = { 
          weather: processedData, 
          aqi: airData, 
          timestamp: now 
      };
      weatherCache.set(cacheKey, entry);
      
      setAqiData(airData);
      setWeatherData(processedData);
      
      return true;

    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      console.error("❌ Error en fetchWeather:", errorMessage);
      setError(t.fetchError); // MODIFICAT: Ús de traducció
      return false;
    } finally {
      setLoading(false);
    }
  }, [unit, lang, t]); // Afegit 't' a dependències per si de cas, tot i que ve de 'lang'

  const handleGetCurrentLocation = useCallback(() => {
    if (!navigator.geolocation) {
      setNotification({ type: 'error', msg: t.geoNotSupported }); // MODIFICAT: Ús de traducció
      return;
    }
    
    setLoading(true);
    
    const geoOptions = {
      enableHighAccuracy: false, 
      timeout: 8000,             
      maximumAge: 0 
    };

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const success = await fetchWeatherByCoords(pos.coords.latitude, pos.coords.longitude, "La Meva Ubicació");
        if (success) {
          setNotification({ type: 'success', msg: t.notifLocationSuccess }); // MODIFICAT: Consistència
          setTimeout(() => setNotification(null), 3000);
        }
      },
      (err) => {
        console.warn("Error GPS:", err.message);
        setNotification({ type: 'error', msg: t.notifLocationError }); // MODIFICAT: Consistència
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