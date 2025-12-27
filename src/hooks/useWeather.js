// src/hooks/useWeather.js
import { useState, useCallback, useEffect, useRef } from 'react';
import { normalizeModelData, generateAIPrediction, calculateReliability, getRealTimeWeatherCode } from '../utils/weatherLogic';
import { TRANSLATIONS } from '../constants/translations';

// CONFIGURACIÓ CACHE: 15 minuts
const CACHE_DURATION = 15 * 60 * 1000; 

export function useWeather(lang, unit = 'C') {
  const [weatherData, setWeatherData] = useState(null);
  const [aqiData, setAqiData] = useState(null);
  const [aiAnalysis, setAiAnalysis] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  
  // Estat per a notificacions (Toasts)
  const [notification, setNotification] = useState(null);

  const abortControllerRef = useRef(null);
  const lastGeocodeRequest = useRef(0);

  const fetchWeatherByCoords = useCallback(async (lat, lon, name, country = "") => {
    // 1. Cancel·lar peticions anteriors
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    // 2. CHECK CACHE OPTIMITZAT
    const cacheKey = `meteoai_cache_${lat.toFixed(2)}_${lon.toFixed(2)}`;
    const cachedRaw = localStorage.getItem(cacheKey);

    if (cachedRaw) {
      try {
        const { timestamp, weather, aqi } = JSON.parse(cachedRaw);
        if (Date.now() - timestamp < CACHE_DURATION) {
          console.log("⚡ Dades carregades des de Cache (sense API)");
          setWeatherData({ ...weather, location: { name, country, latitude: lat, longitude: lon } });
          setAqiData(aqi);
          setLoading(false);
          setError(null);
          return;
        }
      } catch (e) {
        console.warn("Error llegint cache, procedim a descarregar.", e);
        localStorage.removeItem(cacheKey);
      }
    }

    // 3. XARXA
    const controller = new AbortController();
    abortControllerRef.current = controller;
    const signal = controller.signal;

    setLoading(true);
    setError(null);
    setAiAnalysis(null);
    
    try {
      const weatherUrl = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,is_day,apparent_temperature,weather_code,wind_speed_10m,wind_direction_10m,pressure_msl,cloud_cover,wind_gusts_10m,precipitation,visibility&hourly=temperature_2m,apparent_temperature,precipitation_probability,precipitation,weather_code,wind_speed_10m,wind_direction_10m,cloud_cover,relative_humidity_2m,wind_gusts_10m,uv_index,is_day,freezing_level_height,pressure_msl,cape,visibility&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,uv_index_max,wind_speed_10m_max,precipitation_sum,snowfall_sum,sunrise,sunset&timezone=auto&models=ecmwf_ifs025,gfs_seamless,icon_seamless&minutely_15=precipitation,weather_code&forecast_days=8`;
      const aqiUrl = `https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${lat}&longitude=${lon}&current=european_aqi,alder_pollen,birch_pollen,grass_pollen,mugwort_pollen,olive_pollen,ragweed_pollen`;

      const weatherRes = await fetch(weatherUrl, { signal });
      if (!weatherRes.ok) throw new Error(`Error satèl·lit: ${weatherRes.status}`);
      const rawWeatherData = await weatherRes.json();
      
      let newAqiData = null;
      try {
          const aqiRes = await fetch(aqiUrl, { signal });
          if(aqiRes.ok) newAqiData = await aqiRes.json();
      } catch(e) { 
          if (e.name !== 'AbortError') console.warn("AQI no disponible"); 
      }
      
      const processedWeatherData = normalizeModelData(rawWeatherData);
      const finalWeatherData = { ...processedWeatherData, location: { name, country, latitude: lat, longitude: lon } };

      // 4. GUARDAR A CACHE (SMART LRU - Least Recently Used)
      const saveData = JSON.stringify({
          timestamp: Date.now(),
          weather: finalWeatherData,
          aqi: newAqiData
      });

      try {
        localStorage.setItem(cacheKey, saveData);
      } catch (e) {
        console.warn("Cache plena. Executant neteja intel·ligent (LRU)...");
        try {
            const keys = [];
            for (let i = 0; i < localStorage.length; i++) {
                const key = localStorage.key(i);
                if (key && key.startsWith('meteoai_cache_')) {
                    keys.push(key);
                }
            }
            // Ordenem per timestamp (els més antics primer)
            const items = keys.map(key => {
                try {
                    const item = JSON.parse(localStorage.getItem(key));
                    return { key, timestamp: item?.timestamp || 0 };
                } catch (e) { return { key, timestamp: 0 }; }
            }).sort((a, b) => a.timestamp - b.timestamp);

            // Esborrem d'un en un fins que hi càpiga el nou
            while (items.length > 0) {
                const toRemove = items.shift();
                localStorage.removeItem(toRemove.key);
                try {
                    localStorage.setItem(cacheKey, saveData);
                    console.log(`Cache alliberada. Esborrat: ${toRemove.key}`);
                    break; 
                } catch (e) {}
            }
        } catch (err2) {
            console.error("Error LRU final.");
        }
      }

      setWeatherData(finalWeatherData);
      setAqiData(newAqiData);
      
    } catch (err) {
      if (err.name === 'AbortError') return;
      console.error(err);
      setError(err.message || "Error desconegut");
    } finally { 
      if (abortControllerRef.current === controller) {
        setLoading(false); 
      }
    }
  }, []);

  useEffect(() => {
    return () => {
        if (abortControllerRef.current) abortControllerRef.current.abort();
    };
  }, []);

  const handleGetCurrentLocation = useCallback(() => {
    // IMPORTACIÓ CORRECTA DE TRADUCCIONS
    const t = TRANSLATIONS[lang] || TRANSLATIONS['ca'];
    
    if (!navigator.geolocation) {
      setError("Geolocalització no suportada.");
      return;
    }

    const now = Date.now();
    // Protecció Rate Limit amb notificació visual (Clau notifWait)
    if (now - lastGeocodeRequest.current < 2000) { 
        setNotification({ type: 'info', msg: t.notifWait || "Espera..." });
        return; 
    }
    lastGeocodeRequest.current = now;
    
    setLoading(true);

    const onPositionFound = async (position) => {
      const { latitude, longitude } = position.coords;
      try {
        const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&zoom=12&accept-language=${lang}`, {
            headers: { 'User-Agent': 'MeteoToniAi/1.0' }
        });
        
        if (response.status === 429) throw new Error("Massa peticions. Prova-ho en uns segons.");
        if(!response.ok) throw new Error("Error geocoding");
        
        const data = await response.json();
        const address = data.address || {};
        const locationName = address.city || address.town || address.village || address.municipality || address.county || "Ubicació";
        const locationCountry = address.country || "";
        
        fetchWeatherByCoords(latitude, longitude, locationName, locationCountry);
        setNotification({ type: 'success', msg: t.notifLocationSuccess || "Fet." });

      } catch (err) {
        console.error("Error reverse geocoding:", err);
        fetchWeatherByCoords(latitude, longitude, "Ubicació Detectada", "");
      }
    };

    const onPositionError = (err) => {
      console.warn("Error geolocalització final:", err);
      setNotification({ type: 'error', msg: t.notifLocationError || "Error GPS" });
      setLoading(false);
    };

    navigator.geolocation.getCurrentPosition(onPositionFound, (error) => {
        console.log("Mètode ràpid fallit, activant GPS d'alta precisió...", error);
        navigator.geolocation.getCurrentPosition(onPositionFound, onPositionError, { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 });
      }, { enableHighAccuracy: false, timeout: 3000, maximumAge: 600000 }
    );
  }, [fetchWeatherByCoords, lang]);

  useEffect(() => {
     if(weatherData) {
         const currentHour = new Date().getHours();
         const freezingLevel = weatherData.hourly?.freezing_level_height?.[currentHour] || 2500;
         const elevation = weatherData.elevation || 0;

         const effectiveWeatherCode = getRealTimeWeatherCode(
             weatherData.current, 
             weatherData.minutely_15?.precipitation,
             0, 
             freezingLevel,
             elevation
         );

         const reliability = calculateReliability(
            weatherData.daily,
            weatherData.dailyComparison?.gfs,
            weatherData.dailyComparison?.icon,
            0 
         );

         const analysis = generateAIPrediction(
             { ...weatherData.current, minutely15: weatherData.minutely_15?.precipitation }, 
             weatherData.daily, 
             weatherData.hourly, 
             aqiData?.current?.european_aqi || 0, 
             lang, 
             effectiveWeatherCode,
             reliability,
             unit 
         );
         setAiAnalysis(analysis);
     }
  }, [lang, weatherData, aqiData, unit]);

  return {
    weatherData,
    aqiData,
    aiAnalysis,
    loading,
    error,
    notification,      
    setNotification,   
    fetchWeatherByCoords,
    handleGetCurrentLocation
  };
}