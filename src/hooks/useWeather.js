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
  const [aiAnalysis, setAiAnalysis] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [notification, setNotification] = useState(null);

  const abortControllerRef = useRef(null);
  const lastGeocodeRequest = useRef(0);
  const lastGeminiCallSignature = useRef(null);

  // Intentem netejar la DB al carregar l'app un cop
  useEffect(() => { cacheService.clean(); }, []);

  const fetchWeatherByCoords = useCallback(async (lat, lon, name, country = "") => {
    if (abortControllerRef.current) abortControllerRef.current.abort();
    const controller = new AbortController();
    abortControllerRef.current = controller;
    const signal = controller.signal;

    const cacheKey = cacheService.generateWeatherKey(lat, lon);
    
    // --- CANVI CRÍTIC: AWAIT PER INDEXEDDB ---
    // Ara la caché és asíncrona, hem d'esperar que llegeixi el disc
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
    setAiAnalysis(null);
    lastGeminiCallSignature.current = null;
    
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

      // --- CANVI CRÍTIC: AWAIT PER GUARDAR ---
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

  useEffect(() => {
     if(weatherData) {
         const currentHour = new Date().getHours();
         const freezingLevel = weatherData.hourly?.freezing_level_height?.[currentHour] || 2500;
         const elevation = weatherData.elevation || 0;
         const effectiveWeatherCode = getRealTimeWeatherCode(weatherData.current, weatherData.minutely_15?.precipitation, 0, freezingLevel, elevation);
         const reliability = calculateReliability(weatherData.daily, weatherData.dailyComparison?.gfs, weatherData.dailyComparison?.icon, 0);

         const baseAnalysis = generateAIPrediction({ ...weatherData.current, minutely15: weatherData.minutely_15?.precipitation }, weatherData.daily, weatherData.hourly, aqiData?.current?.european_aqi || 0, lang, effectiveWeatherCode, reliability, unit);
         setAiAnalysis({ ...baseAnalysis, source: 'algorithm' });

         let context = prepareContextForAI(weatherData.current, weatherData.daily, weatherData.hourly);
         if (typeof context === 'object') { context = { ...context, userRequestedLanguage: lang }; }
         
         const weatherTimestamp = weatherData.current?.time; 
         const lat = weatherData.location?.latitude || 0;
         const lon = weatherData.location?.longitude || 0;
         const aiCacheKey = cacheService.generateAiKey(weatherTimestamp, lat, lon, lang);

         // --- LÒGICA ASÍNCRONA PER IA ---
         const checkCacheAndFetch = async () => {
             // 1. AWAIT per llegir caché IA
             const cachedAI = await cacheService.get(aiCacheKey, 24 * 60 * 60 * 1000); 
             if (cachedAI) {
                 console.log(`💾 IA recuperada de IndexedDB (${lang})`);
                 setAiAnalysis(prev => ({ ...prev, text: cachedAI, source: 'gemini' }));
                 return; 
             }

             const currentSignature = JSON.stringify({ c: context, l: lang });
             lastGeminiCallSignature.current = currentSignature;

             fetchEnhancedForecast(context, lang).then(async (enhancedText) => {
                if (lastGeminiCallSignature.current !== currentSignature) return;
                if (enhancedText) {
                    console.log(`✨ Nova IA generada (${lang})`);
                    // 2. AWAIT per guardar caché IA
                    await cacheService.set(aiCacheKey, enhancedText); 
                    setAiAnalysis(prev => ({ ...prev, text: enhancedText, source: 'gemini' }));
                }
             }).catch(err => console.error("Error silenciós Gemini:", err));
         };

         checkCacheAndFetch();
     }
  }, [lang, weatherData, aqiData, unit]);

  return { weatherData, aqiData, aiAnalysis, loading, error, notification, setNotification, fetchWeatherByCoords, handleGetCurrentLocation };
}