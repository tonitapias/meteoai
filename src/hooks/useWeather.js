// src/hooks/useWeather.js
import { useState, useCallback, useEffect, useRef } from 'react';
import { normalizeModelData, generateAIPrediction, calculateReliability } from '../utils/weatherLogic';

// CONFIGURACIÓ CACHE: 15 minuts
const CACHE_DURATION = 15 * 60 * 1000; 

export function useWeather(lang, effectiveWeatherCode) {
  const [weatherData, setWeatherData] = useState(null);
  const [aqiData, setAqiData] = useState(null);
  const [aiAnalysis, setAiAnalysis] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const abortControllerRef = useRef(null);

  const fetchWeatherByCoords = useCallback(async (lat, lon, name, country = "") => {
    // 1. Cancel·lar peticions anteriors
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    // 2. CHECK CACHE OPTIMITZAT
    // 2 decimals = ~1.1km de precisió. Augmenta els encerts de cache en moviment.
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
      const weatherUrl = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,is_day,apparent_temperature,weather_code,wind_speed_10m,wind_direction_10m,pressure_msl,cloud_cover,wind_gusts_10m,precipitation&hourly=temperature_2m,apparent_temperature,precipitation_probability,precipitation,weather_code,wind_speed_10m,wind_direction_10m,cloud_cover,relative_humidity_2m,wind_gusts_10m,uv_index,is_day,freezing_level_height,pressure_msl,cape&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,uv_index_max,wind_speed_10m_max,precipitation_sum,snowfall_sum,sunrise,sunset&timezone=auto&models=ecmwf_ifs025,gfs_seamless,icon_seamless&minutely_15=precipitation,weather_code&forecast_days=8`;
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

      // 4. GUARDAR A CACHE (Amb neteja automàtica)
      try {
        localStorage.setItem(cacheKey, JSON.stringify({
          timestamp: Date.now(),
          weather: finalWeatherData,
          aqi: newAqiData
        }));
      } catch (e) {
        console.warn("Cache plena. Intentant fer espai...");
        // Esborrem només les dades d'aquesta app per fer lloc
        try {
            Object.keys(localStorage).forEach(key => {
                if (key.startsWith('meteoai_cache_')) {
                    localStorage.removeItem(key);
                }
            });
            // Reintentem guardar
            localStorage.setItem(cacheKey, JSON.stringify({
                timestamp: Date.now(),
                weather: finalWeatherData,
                aqi: newAqiData
            }));
        } catch (err2) {
            console.error("No s'ha pogut guardar ni fent neteja.");
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
    if (!navigator.geolocation) {
      setError("Geolocalització no suportada.");
      return;
    }
    
    setLoading(true);

    const onPositionFound = async (position) => {
      const { latitude, longitude } = position.coords;
      try {
        // AFEGIT USER-AGENT PER EVITAR BLOQUEIG
        const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&zoom=12&accept-language=${lang}`, {
            headers: {
                'User-Agent': 'MeteoToniAi/1.0'
            }
        });
        
        if(!response.ok) throw new Error("Error geocoding");
        
        const data = await response.json();
        const address = data.address || {};
        const locationName = address.city || address.town || address.village || address.municipality || address.county || "Ubicació";
        const locationCountry = address.country || "";
        
        fetchWeatherByCoords(latitude, longitude, locationName, locationCountry);
      } catch (err) {
        console.error("Error reverse geocoding:", err);
        fetchWeatherByCoords(latitude, longitude, "Ubicació Detectada");
      }
    };

    const onPositionError = (err) => {
      console.warn("Error geolocalització final:", err);
      setError("No s'ha pogut obtenir la ubicació. Verifica els permisos.");
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
         // Utilitzem Optional Chaining per seguretat extra
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
             reliability
         );
         setAiAnalysis(analysis);
     }
  }, [lang, weatherData, aqiData, effectiveWeatherCode]);

  return {
    weatherData,
    aqiData,
    aiAnalysis,
    loading,
    error,
    fetchWeatherByCoords,
    handleGetCurrentLocation
  };
}