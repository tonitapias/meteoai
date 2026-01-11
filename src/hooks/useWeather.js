// src/hooks/useWeather.js
import { useState, useCallback, useEffect, useRef } from 'react';
import { 
    normalizeModelData, 
    isAromeSupported,
    injectHighResModels 
} from '../utils/weatherLogic';
import { TRANSLATIONS } from '../constants/translations';
import { 
    fetchForecast, 
    fetchAirQuality, 
    fetchAromeForecast, 
    fetchLocationName 
} from '../services/weatherApi';
import { cacheService } from '../services/cacheService';

// Funció auxiliar per omplir dades
const fillMissingCurrentData = (data) => {
    if (data.current && data.hourly && data.hourly.time) {
        const currentDt = new Date(data.current.time).getTime();
        let closestIndex = 0; 
        let minDiff = Infinity;
        data.hourly.time.forEach((t, i) => {
            const diff = Math.abs(new Date(t).getTime() - currentDt);
            if (diff < minDiff) { minDiff = diff; closestIndex = i; }
        });
        ['cloud_cover_low', 'cloud_cover_mid', 'cloud_cover_high', 'cape', 'freezing_level_height'].forEach(field => {
            if ((data.current[field] === undefined || data.current[field] === null) && data.hourly[field]) {
                data.current[field] = data.hourly[field][closestIndex];
            }
        });
    }
    return data;
};

export function useWeather(lang, unit = 'C') {
  const [weatherData, setWeatherData] = useState(null);
  const [aqiData, setAqiData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [notification, setNotification] = useState(null);

  const abortControllerRef = useRef(null);
  const lastGeocodeRequest = useRef(0);

  // Intentem netejar la DB al carregar l'app un cop
  useEffect(() => { cacheService.clean(); }, []);

  const fetchWeatherByCoords = useCallback(async (lat, lon, name, country = "") => {
    if (abortControllerRef.current) abortControllerRef.current.abort();
    const controller = new AbortController();
    abortControllerRef.current = controller;
    const signal = controller.signal;

    const cacheKey = cacheService.generateWeatherKey(lat, lon);
    
    // 1. Llegim caché
    const cachedData = await cacheService.get(cacheKey); 

    if (cachedData) {
        console.log("⚡ Dades carregades des de IndexedDB");
        const { weather, aqi } = cachedData;
        setWeatherData({ ...weather, location: { name, country, latitude: lat, longitude: lon } });
        setAqiData(aqi);
        setLoading(false);
        setError(null);
        return;
    }

    setLoading(true);
    setError(null);
    
    try {
      const [weatherRes, aqiRes] = await Promise.allSettled([
          fetchForecast(lat, lon, signal),
          fetchAirQuality(lat, lon, signal)
      ]);

      if (weatherRes.status !== 'fulfilled') throw new Error("Error connectant amb el satèl·lit");
      
      let rawWeatherData = weatherRes.value;
      let newAqiData = (aqiRes.status === 'fulfilled') ? aqiRes.value : null;

      if (isAromeSupported(lat, lon)) {
          try {
              const aromeData = await fetchAromeForecast(lat, lon, signal);
              if (aromeData) rawWeatherData = injectHighResModels(rawWeatherData, aromeData);
          } catch (aromeErr) { console.warn("AROME no disponible:", aromeErr); }
      }

      rawWeatherData = fillMissingCurrentData(rawWeatherData);
      const processedWeatherData = normalizeModelData(rawWeatherData);
      const finalWeatherData = { ...processedWeatherData, location: { name, country, latitude: lat, longitude: lon } };

      // 2. Guardem a la caché
      await cacheService.set(cacheKey, { weather: finalWeatherData, aqi: newAqiData });

      setWeatherData(finalWeatherData);
      setAqiData(newAqiData);
      
    } catch (err) {
      if (err.name === 'AbortError') return;
      setError(err.message || "Error desconegut");
    } finally { 
      if (abortControllerRef.current === controller) setLoading(false); 
    }
  }, []);

  useEffect(() => { return () => { if (abortControllerRef.current) abortControllerRef.current.abort(); }; }, []);

  const handleGetCurrentLocation = useCallback(() => {
    const t = TRANSLATIONS[lang] || TRANSLATIONS['ca'];
    if (!navigator.geolocation) { setError("Geolocalització no suportada."); return; }
    
    const now = Date.now();
    if (now - lastGeocodeRequest.current < 2000) { setNotification({ type: 'info', msg: t.notifWait || "Espera..." }); return; }
    lastGeocodeRequest.current = now;
    setLoading(true);

    navigator.geolocation.getCurrentPosition(async (position) => {
        const { latitude, longitude } = position.coords;
        const locationInfo = await fetchLocationName(latitude, longitude, lang);
        fetchWeatherByCoords(latitude, longitude, locationInfo.name, locationInfo.country);
        setNotification({ type: 'success', msg: t.notifLocationSuccess || "Fet." });
    }, (error) => {
        setNotification({ type: 'error', msg: t.notifLocationError || "Error GPS" });
        setLoading(false);
    }, { enableHighAccuracy: false, timeout: 5000 });
  }, [fetchWeatherByCoords, lang]);

  return { 
      weatherData, 
      aqiData, 
      loading, 
      error, 
      notification, 
      setNotification, 
      fetchWeatherByCoords, 
      handleGetCurrentLocation 
  };
}