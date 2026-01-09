// src/hooks/useWeather.js
import { useState, useCallback, useEffect, useRef } from 'react';
import { 
    normalizeModelData, 
    generateAIPrediction, 
    calculateReliability, 
    getRealTimeWeatherCode, 
    isAromeSupported,
    injectHighResModels,
    prepareContextForAI 
} from '../utils/weatherLogic';
import { fetchEnhancedForecast } from '../services/gemini'; 
import { TRANSLATIONS } from '../constants/translations';

const CACHE_DURATION = 15 * 60 * 1000; 

let isCacheDisabled = false;

// --- FUNCIÓ AUXILIAR PER GESTIÓ DE MEMÒRIA ---
const cleanOldCache = (forceAll = false) => {
  try {
    const items = [];
    const prefix = 'meteoai_v7_cache_';
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith(prefix)) {
        try {
          const item = JSON.parse(localStorage.getItem(key));
          if (item && item.timestamp) items.push({ key, timestamp: item.timestamp });
          else localStorage.removeItem(key);
        } catch (e) { localStorage.removeItem(key); }
      }
    }
    if (forceAll) {
        items.forEach(item => localStorage.removeItem(item.key));
        return;
    }
    items.sort((a, b) => a.timestamp - b.timestamp);
    if (items.length > 0) {
        const toDelete = items.slice(0, Math.ceil(items.length / 2));
        toDelete.forEach(item => localStorage.removeItem(item.key));
    }
  } catch (err) { }
};

export function useWeather(lang, unit = 'C') {
  const [weatherData, setWeatherData] = useState(null);
  const [aqiData, setAqiData] = useState(null);
  const [aiAnalysis, setAiAnalysis] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [notification, setNotification] = useState(null);

  const abortControllerRef = useRef(null);
  const lastGeocodeRequest = useRef(0);
  
  // NOU: Ref per evitar crides duplicades a la IA
  const lastGeminiCallSignature = useRef(null);

  const fetchWeatherByCoords = useCallback(async (lat, lon, name, country = "") => {
    if (abortControllerRef.current) abortControllerRef.current.abort();

    const cacheKey = `meteoai_v7_cache_${lat.toFixed(2)}_${lon.toFixed(2)}`;
    
    if (!isCacheDisabled) {
        try {
            const cachedRaw = localStorage.getItem(cacheKey);
            if (cachedRaw) {
                const { timestamp, weather, aqi } = JSON.parse(cachedRaw);
                if (Date.now() - timestamp < CACHE_DURATION) {
                    console.log("⚡ Dades carregades des de Cache");
                    setWeatherData({ ...weather, location: { name, country, latitude: lat, longitude: lon } });
                    setAqiData(aqi);
                    setLoading(false);
                    setError(null);
                    return;
                }
            }
        } catch (e) { try { localStorage.removeItem(cacheKey); } catch(err) {} }
    }

    const controller = new AbortController();
    abortControllerRef.current = controller;
    const signal = controller.signal;

    setLoading(true);
    setError(null);
    setAiAnalysis(null);
    lastGeminiCallSignature.current = null; // Resetegem la signatura en nova cerca
    
    try {
      const weatherUrl = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,is_day,apparent_temperature,weather_code,wind_speed_10m,wind_direction_10m,pressure_msl,cloud_cover,cloud_cover_low,cloud_cover_mid,cloud_cover_high,wind_gusts_10m,precipitation,visibility&hourly=temperature_2m,apparent_temperature,precipitation_probability,precipitation,weather_code,wind_speed_10m,wind_direction_10m,cloud_cover,cloud_cover_low,cloud_cover_mid,cloud_cover_high,relative_humidity_2m,wind_gusts_10m,uv_index,is_day,freezing_level_height,pressure_msl,cape,visibility&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,uv_index_max,wind_speed_10m_max,precipitation_sum,snowfall_sum,sunrise,sunset&timezone=auto&models=ecmwf_ifs025,gfs_seamless,icon_seamless&minutely_15=precipitation,weather_code&forecast_days=8`;
      const aqiUrl = `https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${lat}&longitude=${lon}&current=european_aqi,alder_pollen,birch_pollen,grass_pollen,mugwort_pollen,olive_pollen,ragweed_pollen`;

      const [weatherRes, aqiRes] = await Promise.allSettled([ fetch(weatherUrl, { signal }), fetch(aqiUrl, { signal }) ]);

      if (weatherRes.status !== 'fulfilled' || !weatherRes.value.ok) throw new Error(`Error connectant amb el satèl·lit`);
      
      let rawWeatherData = await weatherRes.value.json();
      let newAqiData = (aqiRes.status === 'fulfilled' && aqiRes.value.ok) ? await aqiRes.value.json() : null;

      if (isAromeSupported(lat, lon)) {
          try {
              const aromeUrl = `https://api.open-meteo.com/v1/meteofrance?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,is_day,apparent_temperature,weather_code,wind_speed_10m,wind_direction_10m,pressure_msl,wind_gusts_10m,precipitation,visibility&hourly=temperature_2m,precipitation,weather_code,wind_speed_10m,wind_gusts_10m,is_day,cape,freezing_level_height,cloud_cover,cloud_cover_low,cloud_cover_mid,cloud_cover_high&minutely_15=precipitation,weather_code&timezone=auto`;
              const aromeRes = await fetch(aromeUrl, { signal });
              if (aromeRes.ok) {
                  const aromeData = await aromeRes.json();
                  rawWeatherData = injectHighResModels(rawWeatherData, aromeData);
              }
          } catch (aromeErr) {}
      }

      if (rawWeatherData.current && rawWeatherData.hourly && rawWeatherData.hourly.time) {
          const currentDt = new Date(rawWeatherData.current.time).getTime();
          let closestIndex = 0; let minDiff = Infinity;
          rawWeatherData.hourly.time.forEach((t, i) => {
              const diff = Math.abs(new Date(t).getTime() - currentDt);
              if (diff < minDiff) { minDiff = diff; closestIndex = i; }
          });
          ['cloud_cover_low', 'cloud_cover_mid', 'cloud_cover_high', 'cape', 'freezing_level_height'].forEach(field => {
              if ((rawWeatherData.current[field] === undefined || rawWeatherData.current[field] === null) && rawWeatherData.hourly[field]) {
                  rawWeatherData.current[field] = rawWeatherData.hourly[field][closestIndex];
              }
          });
      }

      const processedWeatherData = normalizeModelData(rawWeatherData);
      const finalWeatherData = { ...processedWeatherData, location: { name, country, latitude: lat, longitude: lon } };

      if (!isCacheDisabled) {
          const saveData = JSON.stringify({ timestamp: Date.now(), weather: finalWeatherData, aqi: newAqiData });
          try { localStorage.setItem(cacheKey, saveData); } catch (e) { 
              try { cleanOldCache(false); localStorage.setItem(cacheKey, saveData); } catch (retryErr) {
                  try { cleanOldCache(true); localStorage.setItem(cacheKey, saveData); } catch (finalErr) {
                      isCacheDisabled = true;
                  }
              }
          }
      }

      setWeatherData(finalWeatherData);
      setAqiData(newAqiData);
      
    } catch (err) {
      if (err.name === 'AbortError') return;
      setError(err.message || "Error desconegut");
    } finally { if (abortControllerRef.current === controller) setLoading(false); }
  }, []);

  useEffect(() => { return () => { if (abortControllerRef.current) abortControllerRef.current.abort(); }; }, []);

  const handleGetCurrentLocation = useCallback(() => {
    const t = TRANSLATIONS[lang] || TRANSLATIONS['ca'];
    if (!navigator.geolocation) { setError("Geolocalització no suportada."); return; }
    const now = Date.now();
    if (now - lastGeocodeRequest.current < 2000) { setNotification({ type: 'info', msg: t.notifWait || "Espera..." }); return; }
    lastGeocodeRequest.current = now;
    setLoading(true);

    const onPositionFound = async (position) => {
      const { latitude, longitude } = position.coords;
      try {
        const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&zoom=12&accept-language=${lang}`, { headers: { 'User-Agent': 'MeteoToniAi/1.0' } });
        if(!response.ok) throw new Error("Error geocoding");
        const data = await response.json();
        const address = data.address || {};
        fetchWeatherByCoords(latitude, longitude, address.city || address.town || "Ubicació", address.country || "");
        setNotification({ type: 'success', msg: t.notifLocationSuccess || "Fet." });
      } catch (err) { fetchWeatherByCoords(latitude, longitude, "Ubicació Detectada", ""); }
    };
    navigator.geolocation.getCurrentPosition(onPositionFound, (error) => {
        setNotification({ type: 'error', msg: t.notifLocationError || "Error GPS" });
        setLoading(false);
    }, { enableHighAccuracy: false, timeout: 5000 });
  }, [fetchWeatherByCoords, lang]);

  // --- LÒGICA HÍBRIDA AI (OPTIMITZADA) ---
  useEffect(() => {
     if(weatherData) {
         const currentHour = new Date().getHours();
         const freezingLevel = weatherData.hourly?.freezing_level_height?.[currentHour] || 2500;
         const elevation = weatherData.elevation || 0;
         const effectiveWeatherCode = getRealTimeWeatherCode(
             weatherData.current, weatherData.minutely_15?.precipitation, 0, freezingLevel, elevation
         );
         const reliability = calculateReliability(
            weatherData.daily, weatherData.dailyComparison?.gfs, weatherData.dailyComparison?.icon, 0 
         );

         // 1. GENERACIÓ INSTANTÀNIA (Algorisme)
         // Sempre l'executem primer per tenir resposta ràpida
         const baseAnalysis = generateAIPrediction(
             { ...weatherData.current, minutely15: weatherData.minutely_15?.precipitation }, 
             weatherData.daily, weatherData.hourly, aqiData?.current?.european_aqi || 0, 
             lang, effectiveWeatherCode, reliability, unit 
         );
         
         setAiAnalysis({ ...baseAnalysis, source: 'algorithm' });

         // 2. MILLORA GEMINI (Amb control de duplicats)
         const context = prepareContextForAI(weatherData.current, weatherData.daily, weatherData.hourly);
         
         // Creem una signatura única: Dades + Idioma. Si això no canvia, no tornem a cridar Gemini.
         const currentSignature = JSON.stringify({ c: context, l: lang });

         if (lastGeminiCallSignature.current !== currentSignature) {
            // Marquem que estem processant aquesta petició per no repetir-la
            lastGeminiCallSignature.current = currentSignature;

            fetchEnhancedForecast(context, lang).then(enhancedText => {
                if (enhancedText) {
                    console.log("✨ Text millorat per Gemini rebut (Única crida).");
                    setAiAnalysis(prev => ({
                        ...prev,
                        text: enhancedText,
                        source: 'gemini' 
                    }));
                }
            }).catch(err => console.error("Error silenciós Gemini:", err));
         }
     }
  }, [lang, weatherData, aqiData, unit]);

  return {
    weatherData, aqiData, aiAnalysis, loading, error, notification,      
    setNotification, fetchWeatherByCoords, handleGetCurrentLocation
  };
}