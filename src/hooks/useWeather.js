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

    // CACHE CHECK
    const cacheKey = `meteoai_cache_${lat.toFixed(2)}_${lon.toFixed(2)}`;
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
      // 1. PETICIÓ BASE (ECMWF / GLOBAL - 7 Dies)
      const weatherUrl = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,is_day,apparent_temperature,weather_code,wind_speed_10m,wind_direction_10m,pressure_msl,cloud_cover,wind_gusts_10m,precipitation,visibility&hourly=temperature_2m,apparent_temperature,precipitation_probability,precipitation,weather_code,wind_speed_10m,wind_direction_10m,cloud_cover,relative_humidity_2m,wind_gusts_10m,uv_index,is_day,freezing_level_height,pressure_msl,cape,visibility&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,uv_index_max,wind_speed_10m_max,precipitation_sum,snowfall_sum,sunrise,sunset&timezone=auto&models=ecmwf_ifs025,gfs_seamless,icon_seamless&minutely_15=precipitation,weather_code&forecast_days=8`;
      const aqiUrl = `https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${lat}&longitude=${lon}&current=european_aqi,alder_pollen,birch_pollen,grass_pollen,mugwort_pollen,olive_pollen,ragweed_pollen`;

      const [weatherRes, aqiRes] = await Promise.allSettled([
          fetch(weatherUrl, { signal }),
          fetch(aqiUrl, { signal })
      ]);

      if (weatherRes.status !== 'fulfilled' || !weatherRes.value.ok) throw new Error(`Error connectant amb el satèl·lit`);
      
      let rawWeatherData = await weatherRes.value.json();
      let newAqiData = (aqiRes.status === 'fulfilled' && aqiRes.value.ok) ? await aqiRes.value.json() : null;

      // 2. INJECCIÓ HÍBRIDA AVANÇADA (AROME HD)
      // Ara injectem current I TAMBÉ hourly per als gràfics
      if (isAromeSupported(lat, lon)) {
          try {
              // Demanem també 'hourly' a l'AROME
              const aromeUrl = `https://api.open-meteo.com/v1/meteofrance?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,is_day,apparent_temperature,weather_code,wind_speed_10m,wind_direction_10m,pressure_msl,cloud_cover,wind_gusts_10m,precipitation,visibility&hourly=temperature_2m,precipitation,weather_code,wind_speed_10m,wind_gusts_10m,is_day&minutely_15=precipitation,weather_code&timezone=auto`;
              
              const aromeRes = await fetch(aromeUrl, { signal });
              if (aromeRes.ok) {
                  const aromeData = await aromeRes.json();
                  
                  // A. Injectem dades actuals (Ja ho teníem)
                  if (aromeData.current) {
                      rawWeatherData.current = {
                          ...rawWeatherData.current,
                          ...aromeData.current,
                          source: 'AROME HD'
                      };
                  }
                  
                  // B. Injectem minut a minut (Ja ho teníem)
                  if (aromeData.minutely_15) {
                       rawWeatherData.minutely_15 = aromeData.minutely_15;
                  }

                  // C. NOVETAT: Injectem dades HORÀRIES als gràfics (48h)
                  if (aromeData.hourly && rawWeatherData.hourly) {
                      const limit = Math.min(aromeData.hourly.time.length, rawWeatherData.hourly.time.length);
                      
                      // Bucle quirúrgic: Només substituïm els valors on AROME és millor
                      for(let i=0; i < limit; i++) {
                          // Temperatura: Arome és més precís en muntanya/costa
                          if (aromeData.hourly.temperature_2m[i] !== undefined)
                             rawWeatherData.hourly.temperature_2m[i] = aromeData.hourly.temperature_2m[i];
                          
                          // Vent: Arome detecta millor ràfegues locals
                          if (aromeData.hourly.wind_speed_10m[i] !== undefined)
                             rawWeatherData.hourly.wind_speed_10m[i] = aromeData.hourly.wind_speed_10m[i];
                             
                          if (aromeData.hourly.wind_gusts_10m[i] !== undefined)
                             rawWeatherData.hourly.wind_gusts_10m[i] = aromeData.hourly.wind_gusts_10m[i];

                          // Pluja (mm): Usem la quantitat exacta d'Arome
                          if (aromeData.hourly.precipitation[i] !== undefined)
                             rawWeatherData.hourly.precipitation[i] = aromeData.hourly.precipitation[i];
                          
                          // NOTA: No toquem precipitation_probability d'ECMWF.
                          // Així el gràfic tindrà: % Probabilitat (ECMWF) + mm Reals (AROME).
                      }
                  }

                  console.log("🎯 Gràfics i dades actualitzats amb AROME HD");
              }
          } catch (aromeErr) {
              console.warn("Error carregant capa AROME, mantenint dades globals", aromeErr);
          }
      }

      // 3. NORMALITZACIÓ I FINALITZACIÓ
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