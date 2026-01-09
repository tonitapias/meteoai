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

const CACHE_DURATION = 15 * 60 * 1000; // 15 minuts per la méteo
const AI_CACHE_DURATION = 60 * 60 * 1000; // 1 hora per la IA (per estalviar quota)

let isCacheDisabled = false;

// --- FUNCIÓ AUXILIAR PER GESTIÓ DE MEMÒRIA ---
const cleanOldCache = (forceAll = false) => {
  try {
    const now = Date.now();
    const prefixWeather = 'meteoai_v7_cache_';
    const prefixAI = 'meteoai_ai_';
    
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      // Neteja intel·ligent: Esborra si és molt vell o si forcem neteja
      if (key && (key.startsWith(prefixWeather) || key.startsWith(prefixAI))) {
         if (forceAll) {
             localStorage.removeItem(key);
         } else {
             // Intentem veure si ha caducat
             try {
                 const item = JSON.parse(localStorage.getItem(key));
                 // Si la dada té més de 24h, escombraries fora
                 if (now - item.timestamp > 24 * 60 * 60 * 1000) {
                     localStorage.removeItem(key);
                 }
             } catch(e) { localStorage.removeItem(key); }
         }
      }
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
  const lastGeminiCallSignature = useRef(null);

  const fetchWeatherByCoords = useCallback(async (lat, lon, name, country = "") => {
    if (abortControllerRef.current) abortControllerRef.current.abort();

    const cacheKey = `meteoai_v7_cache_${lat.toFixed(2)}_${lon.toFixed(2)}`;
    
    // 1. LLEGIR DE CACHE (METEO)
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
    lastGeminiCallSignature.current = null; // Reset per nova ubicació
    
    try {
      // 2. PETICIÓ OPEN-METEO
      const weatherUrl = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,is_day,apparent_temperature,weather_code,wind_speed_10m,wind_direction_10m,pressure_msl,cloud_cover,cloud_cover_low,cloud_cover_mid,cloud_cover_high,wind_gusts_10m,precipitation,visibility&hourly=temperature_2m,apparent_temperature,precipitation_probability,precipitation,weather_code,wind_speed_10m,wind_direction_10m,cloud_cover,cloud_cover_low,cloud_cover_mid,cloud_cover_high,relative_humidity_2m,wind_gusts_10m,uv_index,is_day,freezing_level_height,pressure_msl,cape,visibility&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,uv_index_max,wind_speed_10m_max,precipitation_sum,snowfall_sum,sunrise,sunset&timezone=auto&models=ecmwf_ifs025,gfs_seamless,icon_seamless&minutely_15=precipitation,weather_code&forecast_days=8`;
      const aqiUrl = `https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${lat}&longitude=${lon}&current=european_aqi,alder_pollen,birch_pollen,grass_pollen,mugwort_pollen,olive_pollen,ragweed_pollen`;

      const [weatherRes, aqiRes] = await Promise.allSettled([ fetch(weatherUrl, { signal }), fetch(aqiUrl, { signal }) ]);

      if (weatherRes.status !== 'fulfilled' || !weatherRes.value.ok) throw new Error(`Error connectant amb el satèl·lit`);
      
      let rawWeatherData = await weatherRes.value.json();
      let newAqiData = (aqiRes.status === 'fulfilled' && aqiRes.value.ok) ? await aqiRes.value.json() : null;

      // 3. INJECCIÓ AROME (Alta Resolució)
      if (isAromeSupported(lat, lon)) {
          try {
              const aromeUrl = `https://api.open-meteo.com/v1/meteofrance?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,is_day,apparent_temperature,weather_code,wind_speed_10m,wind_direction_10m,pressure_msl,wind_gusts_10m,precipitation,visibility&hourly=temperature_2m,precipitation,weather_code,wind_speed_10m,wind_gusts_10m,is_day,cape,freezing_level_height,cloud_cover,cloud_cover_low,cloud_cover_mid,cloud_cover_high&minutely_15=precipitation,weather_code&timezone=auto`;
              const aromeRes = await fetch(aromeUrl, { signal });
              if (aromeRes.ok) {
                  const aromeData = await aromeRes.json();
                  rawWeatherData = injectHighResModels(rawWeatherData, aromeData);
              }
          } catch (aromeErr) { /* Ignorem errors d'AROME */ }
      }

      // 4. NORMALITZACIÓ I OMPLIMENT DE FORATS
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

      // 5. GUARDAR A CACHE
      if (!isCacheDisabled) {
          const saveData = JSON.stringify({ timestamp: Date.now(), weather: finalWeatherData, aqi: newAqiData });
          try { localStorage.setItem(cacheKey, saveData); } catch (e) { 
               cleanOldCache(true); 
               try { localStorage.setItem(cacheKey, saveData); } catch(err) { isCacheDisabled = true; }
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
        
        // --- DETECCIÓ DE NOM MILLORADA ---
        const locationName = 
            address.city || 
            address.town || 
            address.village || 
            address.municipality || 
            address.hamlet || 
            address.suburb || 
            address.county || 
            "Ubicació"; 

        const locationCountry = address.country || "";
        
        fetchWeatherByCoords(latitude, longitude, locationName, locationCountry);
        setNotification({ type: 'success', msg: t.notifLocationSuccess || "Fet." });
      } catch (err) { fetchWeatherByCoords(latitude, longitude, "Ubicació Detectada", ""); }
    };
    navigator.geolocation.getCurrentPosition(onPositionFound, (error) => {
        setNotification({ type: 'error', msg: t.notifLocationError || "Error GPS" });
        setLoading(false);
    }, { enableHighAccuracy: false, timeout: 5000 });
  }, [fetchWeatherByCoords, lang]);

  // --- LÒGICA HÍBRIDA AI + CACHE DE IA ---
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
         const baseAnalysis = generateAIPrediction(
             { ...weatherData.current, minutely15: weatherData.minutely_15?.precipitation }, 
             weatherData.daily, weatherData.hourly, aqiData?.current?.european_aqi || 0, 
             lang, effectiveWeatherCode, reliability, unit 
         );
         
         setAiAnalysis({ ...baseAnalysis, source: 'algorithm' });

         // 2. MILLORA GEMINI (Amb Cache Local per estalviar quota)
         const context = prepareContextForAI(weatherData.current, weatherData.daily, weatherData.hourly);
         
         // CORRECCIÓ: CLAU ÚNICA PER HORA I UBICACIÓ
         // Ara afegim lat/lon (amb 2 decimals) a la clau de la cache.
         // Així evitem que mostri el text d'una altra ciutat.
         const weatherTimestamp = weatherData.current?.time; 
         const latKey = weatherData.location?.latitude?.toFixed(2) || '0';
         const lonKey = weatherData.location?.longitude?.toFixed(2) || '0';
         
         const aiCacheKey = `meteoai_ai_${weatherTimestamp}_${latKey}_${lonKey}_${lang}`;

         // A) Intentem recuperar de memòria
         const cachedAI = localStorage.getItem(aiCacheKey);
         if (cachedAI) {
             console.log("💾 MeteoToni recuperat de la memòria (Estalvi de quota!)");
             setAiAnalysis(prev => ({ ...prev, text: cachedAI, source: 'gemini' }));
             return; 
         }

         // B) Si no hi és, truquem a Gemini (amb protecció de re-render)
         const currentSignature = JSON.stringify({ c: context, l: lang });
         if (lastGeminiCallSignature.current !== currentSignature) {
            lastGeminiCallSignature.current = currentSignature;

            fetchEnhancedForecast(context, lang).then(enhancedText => {
                if (enhancedText) {
                    console.log("✨ Text nou generat per Gemini.");
                    // Guardem a la memòria per la propera vegada
                    try { localStorage.setItem(aiCacheKey, enhancedText); } catch (e) {}

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