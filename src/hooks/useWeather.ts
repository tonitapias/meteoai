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

const weatherCache = new Map<string, ExtendedWeatherData>();

export function useWeather(lang: Language, unit: WeatherUnit) {
  const [weatherData, setWeatherData] = useState<ExtendedWeatherData | null>(null);
  const [aqiData, setAqiData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notification, setNotification] = useState<{ type: 'success' | 'error' | 'info', msg: string } | null>(null);

  const lastFetchRef = useRef<{lat: number, lon: number, unit: string, time: number} | null>(null);

  // MODIFICACIÓ: Afegim 'country' com a paràmetre opcional
  const fetchWeatherByCoords = useCallback(async (lat: number, lon: number, locationName?: string, country?: string) => {
    const now = Date.now();
    const cacheKey = `${lat.toFixed(3)}-${lon.toFixed(3)}-${unit}`;

    // 1. SI ÉS UN DUPLICAT RECENT
    if (lastFetchRef.current && 
        lastFetchRef.current.lat === lat && 
        lastFetchRef.current.lon === lon &&
        (now - lastFetchRef.current.time) < 3000) {
        setLoading(false);
        return true; 
    }

    // 2. SI ESTÀ A LA CACHE
    if (weatherCache.has(cacheKey)) {
        setWeatherData(weatherCache.get(cacheKey)!);
        setLoading(false);
        return true; 
    }

    setLoading(true);
    setError(null);
    lastFetchRef.current = { lat, lon, unit, time: now };

    try {
      const weatherPromise = getWeatherData(lat, lon, unit);
      
      // GESTIÓ DEL NOM I PAÍS
      // Si és "La Meva Ubicació" (GPS), fem servir Nominatim per obtenir ciutat I PAÍS
      const namePromise = (locationName === "La Meva Ubicació") 
        ? Promise.race([
            fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}`).then(res => res.json()),
            new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 2000))
          ]).catch(() => ({ address: { city: "La Meva Ubicació", country: "Local" } }))
        : Promise.resolve({ address: { city: locationName, country: country } }); // Si ve del cercador, passem el país

      const [data, geoData] = await Promise.all([weatherPromise, namePromise]);

      let processedData = normalizeModelData(data);
      
      // Extreiem el nom i el país de la millor font possible
      const finalName = (geoData as any).address?.city || (geoData as any).address?.town || (geoData as any).address?.village || locationName || "Ubicació actual";
      const finalCountry = (geoData as any).address?.country || country || "Local"; // <--- AQUÍ GUARDEM EL PAÍS

      getAirQualityData(lat, lon).then(setAqiData).catch(() => null);

      if (isAromeSupported(lat, lon)) {
          try {
             const aromeRaw = await getAromeData(lat, lon);
             processedData = injectHighResModels(processedData, aromeRaw);
          } catch (e) { console.warn("Arome no disponible"); }
      }

      processedData.location = { 
          ...processedData.location, 
          name: finalName,
          country: finalCountry, // <--- I L'ASSIGNEM A L'OBJECTE FINAL
          latitude: lat,
          longitude: lon 
      };

      weatherCache.set(cacheKey, processedData);
      setWeatherData(processedData);
      return true;

    } catch (err: any) {
      console.error("❌ Error en fetchWeather:", err);
      setError('No s\'ha pogut carregar el temps.');
      return false;
    } finally {
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