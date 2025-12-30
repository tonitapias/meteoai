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

    // V7: Nova clau per forçar la recàrrega amb els NÚVOLS AROME reactivats
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
              // Sol·licitem dades extra a AROME (incloent núvols horaris)
              const aromeUrl = `https://api.open-meteo.com/v1/meteofrance?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,is_day,apparent_temperature,weather_code,wind_speed_10m,wind_direction_10m,pressure_msl,wind_gusts_10m,precipitation,visibility&hourly=temperature_2m,precipitation,weather_code,wind_speed_10m,wind_gusts_10m,is_day,cape,freezing_level_height,cloud_cover,cloud_cover_low,cloud_cover_mid,cloud_cover_high&minutely_15=precipitation,weather_code&timezone=auto`;
              
              const aromeRes = await fetch(aromeUrl, { signal });
              if (aromeRes.ok) {
                  const aromeData = await aromeRes.json();
                  
                  // A. Actualització de Dades "Current" (Bàsiques)
                  if (aromeData.current) {
                      rawWeatherData.current.temperature_2m = aromeData.current.temperature_2m;
                      rawWeatherData.current.wind_speed_10m = aromeData.current.wind_speed_10m;
                      rawWeatherData.current.wind_gusts_10m = aromeData.current.wind_gusts_10m;
                      rawWeatherData.current.wind_direction_10m = aromeData.current.wind_direction_10m;
                      rawWeatherData.current.weather_code = aromeData.current.weather_code;
                      rawWeatherData.current.precipitation = aromeData.current.precipitation;
                      rawWeatherData.current.source = 'AROME HD'; // Marca d'aigua per a la UI
                  }
                  
                  // B. Minut a minut
                  if (aromeData.minutely_15) {
                       rawWeatherData.minutely_15 = aromeData.minutely_15;
                  }

                  // C. Fusió de dades horàries
                  if (aromeData.hourly && rawWeatherData.hourly) {
                      aromeData.hourly.time.forEach((timeValue, aromeIndex) => {
                          const globalIndex = rawWeatherData.hourly.time.indexOf(timeValue);
                          
                          if (globalIndex !== -1) {
                              // Variables existents...
                              if (aromeData.hourly.temperature_2m[aromeIndex] !== undefined) rawWeatherData.hourly.temperature_2m[globalIndex] = aromeData.hourly.temperature_2m[aromeIndex];
                              if (aromeData.hourly.wind_speed_10m[aromeIndex] !== undefined) rawWeatherData.hourly.wind_speed_10m[globalIndex] = aromeData.hourly.wind_speed_10m[aromeIndex];
                              if (aromeData.hourly.wind_gusts_10m[aromeIndex] !== undefined) rawWeatherData.hourly.wind_gusts_10m[globalIndex] = aromeData.hourly.wind_gusts_10m[aromeIndex];
                              if (aromeData.hourly.precipitation[aromeIndex] !== undefined) rawWeatherData.hourly.precipitation[globalIndex] = aromeData.hourly.precipitation[aromeIndex];
                              
                              if (aromeData.hourly.cape?.[aromeIndex] !== undefined) {
                                  if (!rawWeatherData.hourly.cape) rawWeatherData.hourly.cape = [];
                                  rawWeatherData.hourly.cape[globalIndex] = aromeData.hourly.cape[aromeIndex];
                              }
                              if (aromeData.hourly.freezing_level_height?.[aromeIndex] !== undefined) {
                                  if (!rawWeatherData.hourly.freezing_level_height) rawWeatherData.hourly.freezing_level_height = [];
                                  rawWeatherData.hourly.freezing_level_height[globalIndex] = aromeData.hourly.freezing_level_height[aromeIndex];
                              }

                              // --- NÚVOLS AROME (Horari) ---
                              if (aromeData.hourly.cloud_cover?.[aromeIndex] !== undefined) rawWeatherData.hourly.cloud_cover[globalIndex] = aromeData.hourly.cloud_cover[aromeIndex];
                              
                              if (aromeData.hourly.cloud_cover_low?.[aromeIndex] !== undefined) {
                                  if(!rawWeatherData.hourly.cloud_cover_low) rawWeatherData.hourly.cloud_cover_low = [];
                                  rawWeatherData.hourly.cloud_cover_low[globalIndex] = aromeData.hourly.cloud_cover_low[aromeIndex];
                              }
                              if (aromeData.hourly.cloud_cover_mid?.[aromeIndex] !== undefined) {
                                  if(!rawWeatherData.hourly.cloud_cover_mid) rawWeatherData.hourly.cloud_cover_mid = [];
                                  rawWeatherData.hourly.cloud_cover_mid[globalIndex] = aromeData.hourly.cloud_cover_mid[aromeIndex];
                              }
                              if (aromeData.hourly.cloud_cover_high?.[aromeIndex] !== undefined) {
                                  if(!rawWeatherData.hourly.cloud_cover_high) rawWeatherData.hourly.cloud_cover_high = [];
                                  rawWeatherData.hourly.cloud_cover_high[globalIndex] = aromeData.hourly.cloud_cover_high[aromeIndex];
                              }
                          }
                      });

                      // --- FIX: ACTUALITZACIÓ CURRENT PER AL GINY DE NÚVOLS ---
                      // Busquem l'índex horari corresponent a l'hora actual (current.time)
                      // per injectar les dades de núvols d'alta resolució a la vista "Ara".
                      if (rawWeatherData.current && rawWeatherData.current.time) {
                          const currentDt = new Date(rawWeatherData.current.time).getTime();
                          
                          // Busquem l'índex a l'array AROME que coincideix amb l'hora actual
                          const aromeCurrentIndex = aromeData.hourly.time.findIndex(t => 
                              Math.abs(new Date(t).getTime() - currentDt) < 30 * 60 * 1000 // Marge de 30 minuts
                          );

                          if (aromeCurrentIndex !== -1) {
                              // Sobreescrivim les dades globals del "current" amb les d'AROME
                              if (aromeData.hourly.cloud_cover?.[aromeCurrentIndex] !== undefined) 
                                  rawWeatherData.current.cloud_cover = aromeData.hourly.cloud_cover[aromeCurrentIndex];
                                  
                              if (aromeData.hourly.cloud_cover_low?.[aromeCurrentIndex] !== undefined) 
                                  rawWeatherData.current.cloud_cover_low = aromeData.hourly.cloud_cover_low[aromeCurrentIndex];
                                  
                              if (aromeData.hourly.cloud_cover_mid?.[aromeCurrentIndex] !== undefined) 
                                  rawWeatherData.current.cloud_cover_mid = aromeData.hourly.cloud_cover_mid[aromeCurrentIndex];
                                  
                              if (aromeData.hourly.cloud_cover_high?.[aromeCurrentIndex] !== undefined) 
                                  rawWeatherData.current.cloud_cover_high = aromeData.hourly.cloud_cover_high[aromeCurrentIndex];
                          }
                      }
                  }
                  console.log("🎯 Dades Híbrides TOTALS: AROME (inclòs núvols a Current i Hourly)");
              }
          } catch (aromeErr) {
              console.warn("Error AROME", aromeErr);
          }
      }

      // 3. PONT DE DADES (Manté la lògica de recerca temporal per evitar 0s innecessaris en camps buits)
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

          // Camps que normalment no venen al 'current' standard de l'ECMWF o que volem reforçar
          const missingFields = ['cloud_cover_low', 'cloud_cover_mid', 'cloud_cover_high', 'cape', 'freezing_level_height'];
          
          missingFields.forEach(field => {
              // Només omplim si és undefined o null (si ja l'hem omplert amb AROME, això no farà res, correcte)
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
      try { localStorage.setItem(cacheKey, saveData); } catch (e) {}

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