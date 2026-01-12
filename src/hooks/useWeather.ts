// src/hooks/useWeather.ts
import { useState, useCallback, useEffect, useRef } from 'react';
import { 
    normalizeModelData, 
    isAromeSupported,
    injectHighResModels,
    ExtendedWeatherData
} from '../utils/weatherLogic';
import { TRANSLATIONS, Language } from '../constants/translations';
import { 
    fetchForecast, 
    fetchAirQuality, 
    fetchAromeForecast, 
    fetchLocationName,
    AirQualityData
} from '../services/weatherApi';
import { cacheService } from '../services/cacheService';
import { WeatherUnit } from '../utils/formatters';

interface NotificationState {
  type: 'info' | 'success' | 'error';
  msg: string;
}

interface CachedWeatherPayload {
    weather: ExtendedWeatherData;
    aqi: AirQualityData | null;
}

const fillMissingCurrentData = (data: any): any => {
    if (data.current && data.hourly && data.hourly.time) {
        const currentDt = new Date(data.current.time).getTime();
        // Cerca simple del índex més proper
        let closestIndex = 0; 
        let minDiff = Infinity;
        
        // Tipem 't' com string (ISO date)
        data.hourly.time.forEach((t: string, i: number) => {
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

export function useWeather(lang: Language, unit: WeatherUnit = 'C') {
  const [weatherData, setWeatherData] = useState<ExtendedWeatherData | null>(null);
  const [aqiData, setAqiData] = useState<AirQualityData | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [notification, setNotification] = useState<NotificationState | null>(null);

  const abortControllerRef = useRef<AbortController | null>(null);
  const lastGeocodeRequest = useRef<number>(0);

  useEffect(() => { cacheService.clean(); }, []);

  const fetchWeatherByCoords = useCallback(async (lat: number, lon: number, name: string, country: string = "") => {
    if (abortControllerRef.current) abortControllerRef.current.abort();
    const controller = new AbortController();
    abortControllerRef.current = controller;
    const signal = controller.signal;

    const cacheKey = cacheService.generateWeatherKey(lat, lon);
    
    // Recuperem especificant el tipus genèric que esperem
    const cachedData = await cacheService.get<CachedWeatherPayload>(cacheKey); 

    if (cachedData) {
        console.log("⚡ Dades carregades des de IndexedDB");
        const { weather, aqi } = cachedData;
        // Assegurem que location existeix i està actualitzada amb el nom sol·licitat
        setWeatherData({ ...weather, location: { name, country, latitude: lat, longitude: lon } } as ExtendedWeatherData);
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
      
      let rawWeatherData: any = weatherRes.value;
      let newAqiData = (aqiRes.status === 'fulfilled') ? aqiRes.value : null;

      if (isAromeSupported(lat, lon)) {
          try {
              const aromeData = await fetchAromeForecast(lat, lon, signal);
              if (aromeData) rawWeatherData = injectHighResModels(rawWeatherData, aromeData);
          } catch (aromeErr) { console.warn("AROME no disponible:", aromeErr); }
      }

      rawWeatherData = fillMissingCurrentData(rawWeatherData);
      const processedWeatherData = normalizeModelData(rawWeatherData);
      
      // Injectem la location explícitament
      const finalWeatherData: ExtendedWeatherData = { 
          ...processedWeatherData, 
          location: { name, country, latitude: lat, longitude: lon },
          latitude: lat,
          longitude: lon
      };

      await cacheService.set<CachedWeatherPayload>(cacheKey, { weather: finalWeatherData, aqi: newAqiData });

      setWeatherData(finalWeatherData);
      setAqiData(newAqiData);
      
    } catch (err: any) {
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
        // fetchLocationName torna { name, country }
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