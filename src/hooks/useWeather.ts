// src/hooks/useWeather.ts
import { useState, useCallback, useRef } from 'react';
import { 
    normalizeModelData, 
    isAromeSupported, 
    injectHighResModels,
    ExtendedWeatherData 
} from '../utils/weatherLogic';
import { getWeatherData, getAirQualityData, getAromeData } from '../services/weatherApi';
import { WeatherUnit } from '../utils/formatters';
import { Language } from '../constants/translations';

// MODIFICACIÓ: Ara la caché guarda tant el temps com l'AQI per evitar desincronitzacions
interface CacheEntry {
    weather: ExtendedWeatherData;
    aqi: any;
}

const weatherCache = new Map<string, CacheEntry>();

export function useWeather(lang: Language, unit: WeatherUnit) {
  const [weatherData, setWeatherData] = useState<ExtendedWeatherData | null>(null);
  const [aqiData, setAqiData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notification, setNotification] = useState<{ type: 'success' | 'error' | 'info', msg: string } | null>(null);

  const lastFetchRef = useRef<{lat: number, lon: number, unit: string, time: number} | null>(null);

  const fetchWeatherByCoords = useCallback(async (lat: number, lon: number, locationName?: string, country?: string) => {
    const now = Date.now();
    const cacheKey = `${lat.toFixed(3)}-${lon.toFixed(3)}-${unit}`;

    // 1. SI ÉS UN DUPLICAT RECENT (Anti-rebots)
    if (lastFetchRef.current && 
        lastFetchRef.current.lat === lat && 
        lastFetchRef.current.lon === lon &&
        (now - lastFetchRef.current.time) < 3000) {
        return true; 
    }

    // 2. SI ESTÀ A LA CACHE (Recuperem TOTES les dades)
    if (weatherCache.has(cacheKey)) {
        const cached = weatherCache.get(cacheKey)!;
        setWeatherData(cached.weather);
        setAqiData(cached.aqi); // Important: Restaurem també l'AQI
        setLoading(false);
        return true; 
    }

    setLoading(true);
    setError(null);
    lastFetchRef.current = { lat, lon, unit, time: now };

    try {
      // 3. LLANCEM TOTES LES PETICIONS EN PARAL·LEL
      // Afegim aqiPromise aquí perquè 'loading' no es posi a false fins que tinguem l'AQI
      const weatherPromise = getWeatherData(lat, lon, unit);
      const aqiPromise = getAirQualityData(lat, lon);
      
      const namePromise = (locationName === "La Meva Ubicació") 
        ? Promise.race([
            // CANVI: Usem BigDataCloud en lloc de Nominatim per evitar errors CORS/403
            fetch(`https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lon}&localityLanguage=ca`)
                .then(res => res.json())
                .then(data => ({
                    // Adaptem la resposta al format que esperava l'app (simulant l'estructura de Nominatim)
                    address: { 
                        city: data.city || data.locality || data.principalSubdivision || "Ubicació desconeguda", 
                        country: data.countryName 
                    }
                })),
            new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 2000))
          ]).catch(() => ({ address: { city: "La Meva Ubicació", country: "Local" } }))
        : Promise.resolve({ address: { city: locationName, country: country } });

      // Esperem a tenir-ho TOT abans de processar
      const [data, geoData, airData] = await Promise.all([weatherPromise, namePromise, aqiPromise]);

      // 4. PROCESSEM LES DADES
      let processedData = normalizeModelData(data);
      
      const finalName = (geoData as any).address?.city || (geoData as any).address?.town || (geoData as any).address?.village || locationName || "Ubicació actual";
      const finalCountry = (geoData as any).address?.country || country || "Local";

      // 5. INJECCIÓ AROME (Si s'escau)
      if (isAromeSupported(lat, lon)) {
          try {
             const aromeRaw = await getAromeData(lat, lon);
             processedData = injectHighResModels(processedData, aromeRaw);
          } catch (e) { console.warn("Arome no disponible"); }
      }

      processedData.location = { 
          ...processedData.location, 
          name: finalName,
          country: finalCountry,
          latitude: lat,
          longitude: lon 
      };

      // 6. GUARDEM A L'ESTAT I A LA CACHÉ
      const entry: CacheEntry = { weather: processedData, aqi: airData };
      weatherCache.set(cacheKey, entry);
      
      setAqiData(airData);
      setWeatherData(processedData);
      
      return true;

    } catch (err: any) {
      console.error("❌ Error en fetchWeather:", err);
      setError('No s\'ha pogut carregar el temps.');
      return false;
    } finally {
      // Ara segur que tenim Weather + AQI abans de treure el spinner
      setLoading(false);
    }
  }, [unit]);

  const handleGetCurrentLocation = useCallback(() => {
    if (!navigator.geolocation) {
      setNotification({ type: 'error', msg: 'Geolocalització no suportada.' });
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
          setNotification({ type: 'success', msg: 'Ubicació actualitzada amb èxit' });
          setTimeout(() => setNotification(null), 3000);
        }
      },
      (err) => {
        console.warn("Error GPS:", err.message);
        setNotification({ type: 'error', msg: 'GPS no trobat. Revisa els permisos.' });
        setLoading(false);
      },
      geoOptions
    );
  }, [fetchWeatherByCoords]);

  return { 
    weatherData, aqiData, loading, error, notification, 
    setNotification, fetchWeatherByCoords, handleGetCurrentLocation 
  };
}