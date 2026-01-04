// src/hooks/useWeather.js
import { useState, useCallback, useEffect, useRef } from 'react';
import { normalizeModelData, generateAIPrediction, calculateReliability, getRealTimeWeatherCode, isAromeSupported } from '../utils/weatherLogic';
import { TRANSLATIONS } from '../constants/translations';

const CACHE_DURATION = 15 * 60 * 1000; 

export function useWeather(lang, unit = 'C') {
  const [weatherData, setWeatherData] = useState(null);
  const [aqiData, setAqiData] = useState(null);
  const [aiAnalysis, setAiAnalysis] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [notification, setNotification] = useState(null);

  const abortControllerRef = useRef(null);
  const lastGeocodeRequest = useRef(0);

  const fetchWeatherByCoords = useCallback(async (lat, lon, name, country = "") => {
    if (abortControllerRef.current) abortControllerRef.current.abort();

    const cacheKey = `meteoai_v7_cache_${lat.toFixed(2)}_${lon.toFixed(2)}`;
    const cachedRaw = localStorage.getItem(cacheKey);

    if (cachedRaw) {
      try {
        const { timestamp, weather, aqi } = JSON.parse(cachedRaw);
        if (Date.now() - timestamp < CACHE_DURATION) {
          console.log("⚡ Dades carregades des de Cache");
          setWeatherData({ ...weather, location: { name, country, latitude: lat, longitude: lon } });
          setAqiData(aqi);
          setLoading(false);
          setError(null);
          return;
        }
      } catch (e) {
        console.warn("Cache corrupta detectada, netejant...", e);
        localStorage.removeItem(cacheKey);
      }
    }

    const controller = new AbortController();
    abortControllerRef.current = controller;
    const signal = controller.signal;

    setLoading(true);
    setError(null);
    setAiAnalysis(null);
    
    try {
      // 1. PETICIÓ BASE (ECMWF / GLOBAL)
      const weatherUrl = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,is_day,apparent_temperature,weather_code,wind_speed_10m,wind_direction_10m,pressure_msl,cloud_cover,cloud_cover_low,cloud_cover_mid,cloud_cover_high,wind_gusts_10m,precipitation,visibility&hourly=temperature_2m,apparent_temperature,precipitation_probability,precipitation,weather_code,wind_speed_10m,wind_direction_10m,cloud_cover,cloud_cover_low,cloud_cover_mid,cloud_cover_high,relative_humidity_2m,wind_gusts_10m,uv_index,is_day,freezing_level_height,pressure_msl,cape,visibility&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,uv_index_max,wind_speed_10m_max,precipitation_sum,snowfall_sum,sunrise,sunset&timezone=auto&models=ecmwf_ifs025,gfs_seamless,icon_seamless&minutely_15=precipitation,weather_code&forecast_days=8`;
      const aqiUrl = `https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${lat}&longitude=${lon}&current=european_aqi,alder_pollen,birch_pollen,grass_pollen,mugwort_pollen,olive_pollen,ragweed_pollen`;

      const [weatherRes, aqiRes] = await Promise.allSettled([
          fetch(weatherUrl, { signal }),
          fetch(aqiUrl, { signal })
      ]);

      if (weatherRes.status !== 'fulfilled' || !weatherRes.value.ok) throw new Error(`Error connectant amb el satèl·lit`);
      
      let rawWeatherData = await weatherRes.value.json();
      let newAqiData = (aqiRes.status === 'fulfilled' && aqiRes.value.ok) ? await aqiRes.value.json() : null;

      // 2. INJECCIÓ HÍBRIDA COMPLETA (AROME HD)
      if (isAromeSupported(lat, lon)) {
          try {
              const aromeUrl = `https://api.open-meteo.com/v1/meteofrance?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,is_day,apparent_temperature,weather_code,wind_speed_10m,wind_direction_10m,pressure_msl,wind_gusts_10m,precipitation,visibility&hourly=temperature_2m,precipitation,weather_code,wind_speed_10m,wind_gusts_10m,is_day,cape,freezing_level_height,cloud_cover,cloud_cover_low,cloud_cover_mid,cloud_cover_high&minutely_15=precipitation,weather_code&timezone=auto`;
              
              const aromeRes = await fetch(aromeUrl, { signal });
              if (aromeRes.ok) {
                  const aromeData = await aromeRes.json();
                  
                  // A. Actualització de Dades "Current"
                  if (aromeData.current) {
                      Object.assign(rawWeatherData.current, {
                          temperature_2m: aromeData.current.temperature_2m,
                          wind_speed_10m: aromeData.current.wind_speed_10m,
                          wind_gusts_10m: aromeData.current.wind_gusts_10m,
                          wind_direction_10m: aromeData.current.wind_direction_10m,
                          weather_code: aromeData.current.weather_code,
                          precipitation: aromeData.current.precipitation,
                          source: 'AROME HD'
                      });
                  }
                  
                  // B. Minut a minut
                  if (aromeData.minutely_15) {
                       rawWeatherData.minutely_15 = aromeData.minutely_15;
                  }

                  // C. Fusió de dades horàries (OPTIMITZAT)
                  if (aromeData.hourly && rawWeatherData.hourly) {
                      // Creem un Mapa per cerca O(1) en lloc de O(N) dins del bucle
                      const globalTimeIndexMap = new Map();
                      rawWeatherData.hourly.time.forEach((t, i) => globalTimeIndexMap.set(t, i));

                      aromeData.hourly.time.forEach((timeValue, aromeIndex) => {
                          const globalIndex = globalTimeIndexMap.get(timeValue);
                          
                          if (globalIndex !== undefined) {
                              const source = aromeData.hourly;
                              const target = rawWeatherData.hourly;

                              if (source.temperature_2m[aromeIndex] !== undefined) target.temperature_2m[globalIndex] = source.temperature_2m[aromeIndex];
                              if (source.wind_speed_10m[aromeIndex] !== undefined) target.wind_speed_10m[globalIndex] = source.wind_speed_10m[aromeIndex];
                              if (source.wind_gusts_10m[aromeIndex] !== undefined) target.wind_gusts_10m[globalIndex] = source.wind_gusts_10m[aromeIndex];
                              if (source.precipitation[aromeIndex] !== undefined) target.precipitation[globalIndex] = source.precipitation[aromeIndex];
                              
                              if (source.cape?.[aromeIndex] !== undefined) {
                                  if (!target.cape) target.cape = [];
                                  target.cape[globalIndex] = source.cape[aromeIndex];
                              }
                              if (source.freezing_level_height?.[aromeIndex] !== undefined) {
                                  if (!target.freezing_level_height) target.freezing_level_height = [];
                                  target.freezing_level_height[globalIndex] = source.freezing_level_height[aromeIndex];
                              }

                              // Núvols (CORREGIT: Afegida comprovació d'inicialització)
                              if (source.cloud_cover?.[aromeIndex] !== undefined) {
                                  if (!target.cloud_cover) target.cloud_cover = [];
                                  target.cloud_cover[globalIndex] = source.cloud_cover[aromeIndex];
                              }
                              
                              if (source.cloud_cover_low?.[aromeIndex] !== undefined) {
                                  if(!target.cloud_cover_low) target.cloud_cover_low = [];
                                  target.cloud_cover_low[globalIndex] = source.cloud_cover_low[aromeIndex];
                              }
                              if (source.cloud_cover_mid?.[aromeIndex] !== undefined) {
                                  if(!target.cloud_cover_mid) target.cloud_cover_mid = [];
                                  target.cloud_cover_mid[globalIndex] = source.cloud_cover_mid[aromeIndex];
                              }
                              if (source.cloud_cover_high?.[aromeIndex] !== undefined) {
                                  if(!target.cloud_cover_high) target.cloud_cover_high = [];
                                  target.cloud_cover_high[globalIndex] = source.cloud_cover_high[aromeIndex];
                              }
                          }
                      });

                      // Actualització Current de núvols (Optimitzat)
                      if (rawWeatherData.current && rawWeatherData.current.time) {
                          const currentDt = new Date(rawWeatherData.current.time).getTime();
                          // Cerca amb marge de 30 minuts
                          const aromeCurrentIndex = aromeData.hourly.time.findIndex(t => 
                              Math.abs(new Date(t).getTime() - currentDt) < 30 * 60 * 1000 
                          );

                          if (aromeCurrentIndex !== -1) {
                              const ah = aromeData.hourly;
                              if (ah.cloud_cover?.[aromeCurrentIndex] !== undefined) 
                                  rawWeatherData.current.cloud_cover = ah.cloud_cover[aromeCurrentIndex];
                              if (ah.cloud_cover_low?.[aromeCurrentIndex] !== undefined) 
                                  rawWeatherData.current.cloud_cover_low = ah.cloud_cover_low[aromeCurrentIndex];
                              if (ah.cloud_cover_mid?.[aromeCurrentIndex] !== undefined) 
                                  rawWeatherData.current.cloud_cover_mid = ah.cloud_cover_mid[aromeCurrentIndex];
                              if (ah.cloud_cover_high?.[aromeCurrentIndex] !== undefined) 
                                  rawWeatherData.current.cloud_cover_high = ah.cloud_cover_high[aromeCurrentIndex];
                          }
                      }
                  }
                  console.log("🎯 Dades Híbrides TOTALS: AROME Injectat (Optimitzat)");
              }
          } catch (aromeErr) {
              console.warn("Error AROME, utilitzant fallback ECMWF", aromeErr);
          }
      }

      // 3. PONT DE DADES
      if (rawWeatherData.current && rawWeatherData.hourly && rawWeatherData.hourly.time) {
          const currentDt = new Date(rawWeatherData.current.time).getTime();
          let closestIndex = 0;
          let minDiff = Infinity;

          rawWeatherData.hourly.time.forEach((t, i) => {
              const diff = Math.abs(new Date(t).getTime() - currentDt);
              if (diff < minDiff) {
                  minDiff = diff;
                  closestIndex = i;
              }
          });

          const missingFields = ['cloud_cover_low', 'cloud_cover_mid', 'cloud_cover_high', 'cape', 'freezing_level_height'];
          missingFields.forEach(field => {
              if ((rawWeatherData.current[field] === undefined || rawWeatherData.current[field] === null) && rawWeatherData.hourly[field]) {
                  rawWeatherData.current[field] = rawWeatherData.hourly[field][closestIndex];
              }
          });
      }

      const processedWeatherData = normalizeModelData(rawWeatherData);
      const finalWeatherData = { ...processedWeatherData, location: { name, country, latitude: lat, longitude: lon } };

      const saveData = JSON.stringify({
          timestamp: Date.now(),
          weather: finalWeatherData,
          aqi: newAqiData
      });
      try { localStorage.setItem(cacheKey, saveData); } catch (e) { console.warn("Quota localStorage excedida"); }

      setWeatherData(finalWeatherData);
      setAqiData(newAqiData);
      
    } catch (err) {
      if (err.name === 'AbortError') return;
      console.error(err);
      setError(err.message || "Error desconegut");
    } finally { 
      if (abortControllerRef.current === controller) setLoading(false); 
    }
  }, []);

  useEffect(() => {
    return () => { if (abortControllerRef.current) abortControllerRef.current.abort(); };
  }, []);

  const handleGetCurrentLocation = useCallback(() => {
    const t = TRANSLATIONS[lang] || TRANSLATIONS['ca'];
    if (!navigator.geolocation) { setError("Geolocalització no suportada."); return; }

    const now = Date.now();
    if (now - lastGeocodeRequest.current < 2000) { 
        setNotification({ type: 'info', msg: t.notifWait || "Espera..." });
        return; 
    }
    lastGeocodeRequest.current = now;
    setLoading(true);

    const onPositionFound = async (position) => {
      const { latitude, longitude } = position.coords;
      try {
        const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&zoom=12&accept-language=${lang}`, { headers: { 'User-Agent': 'MeteoToniAi/1.0' } });
        if(!response.ok) throw new Error("Error geocoding");
        const data = await response.json();
        const address = data.address || {};
        const locationName = address.city || address.town || address.village || "Ubicació";
        const locationCountry = address.country || "";
        
        fetchWeatherByCoords(latitude, longitude, locationName, locationCountry);
        setNotification({ type: 'success', msg: t.notifLocationSuccess || "Fet." });

      } catch (err) {
        fetchWeatherByCoords(latitude, longitude, "Ubicació Detectada", "");
      }
    };

    navigator.geolocation.getCurrentPosition(onPositionFound, (error) => {
        setNotification({ type: 'error', msg: t.notifLocationError || "Error GPS" });
        setLoading(false);
    }, { enableHighAccuracy: false, timeout: 5000 });
  }, [fetchWeatherByCoords, lang]);

  useEffect(() => {
     if(weatherData) {
         const currentHour = new Date().getHours();
         const freezingLevel = weatherData.hourly?.freezing_level_height?.[currentHour] || 2500;
         const elevation = weatherData.elevation || 0;

         const effectiveWeatherCode = getRealTimeWeatherCode(
             weatherData.current, 
             weatherData.minutely_15?.precipitation,
             0, freezingLevel, elevation
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
             lang, effectiveWeatherCode, reliability, unit 
         );
         setAiAnalysis(analysis);
     }
  }, [lang, weatherData, aqiData, unit]);

  return {
    weatherData, aqiData, aiAnalysis, loading, error, notification,      
    setNotification, fetchWeatherByCoords, handleGetCurrentLocation
  };
}