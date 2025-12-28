// src/hooks/useWeatherCalculations.js
import { useMemo } from 'react';
import { 
  getShiftedDate, 
  calculateDewPoint, 
  getMoonPhase, 
  calculateReliability,
  getRealTimeWeatherCode 
} from '../utils/weatherLogic';

const isSnowCode = (code) => (code >= 71 && code <= 77) || code === 85 || code === 86;

export function useWeatherCalculations(weatherData, unit, now) {
  
  // 1. Ajustar l'hora
  const shiftedNow = useMemo(() => {
    if (!weatherData) return now;
    const timezone = weatherData.timezone || 'UTC';
    return getShiftedDate(now, timezone);
  }, [weatherData, now]);

  // 2. Dades minut a minut
  const minutelyPreciseData = useMemo(() => {
    if (!weatherData || !weatherData.minutely_15 || !weatherData.minutely_15.precipitation) return [];
    
    const currentMs = shiftedNow.getTime();
    const times = weatherData.minutely_15.time.map(t => new Date(t).getTime());
    let idx = times.findIndex(t => t > currentMs);
    let currentIdx = (idx === -1) ? times.length - 1 : Math.max(0, idx - 1);
    
    return weatherData.minutely_15.precipitation.slice(currentIdx, currentIdx + 4);
  }, [weatherData, shiftedNow]);

  // 3. Probabilitat de pluja actual
  const currentRainProbability = useMemo(() => {
     if (!weatherData || !weatherData.hourly) return 0;
     const nowMs = shiftedNow.getTime();
     const hourIdx = weatherData.hourly.time.findIndex(t => {
        const tMs = new Date(t).getTime();
        return tMs <= nowMs && (tMs + 3600000) > nowMs;
     });
     return (hourIdx !== -1 && weatherData.hourly.precipitation_probability) 
         ? weatherData.hourly.precipitation_probability[hourIdx] 
         : 0;
  }, [weatherData, shiftedNow]);

  // 4. Freezing Level
  const currentFreezingLevel = useMemo(() => {
      if(!weatherData || !weatherData.hourly) return null;
      const key = Object.keys(weatherData.hourly).find(k => k.includes('freezing_level_height'));
      if (!key) return null;
      
      const nowMs = shiftedNow.getTime();
      const currentIdx = weatherData.hourly.time.findIndex(t => {
          const tMs = new Date(t).getTime();
          return tMs <= nowMs && (tMs + 3600000) > nowMs;
      });
      
      if (currentIdx === -1) return null;
      
      let val = weatherData.hourly[key] ? weatherData.hourly[key][currentIdx] : null;
      const currentTemp = weatherData.current.temperature_2m;
      const isSuspicious = val === null || val === undefined || (val < 100 && currentTemp > 4);

      if (isSuspicious) {
          const gfsVal = weatherData.hourlyComparison?.gfs?.[currentIdx]?.freezing_level_height;
          const iconVal = weatherData.hourlyComparison?.icon?.[currentIdx]?.freezing_level_height;
          if (gfsVal != null) val = gfsVal;
          else if (iconVal != null) val = iconVal;
      }
      return (val != null) ? val : null;
  }, [weatherData, shiftedNow]);

  // 5. CODI EFECTIU
  const effectiveWeatherCode = useMemo(() => {
    if (!weatherData || !weatherData.current) return 0;
    
    return getRealTimeWeatherCode(
        weatherData.current, 
        minutelyPreciseData,
        currentRainProbability 
    );
  }, [weatherData, minutelyPreciseData, currentRainProbability]);

  // 6. Fons Dinàmic
  const currentBg = useMemo(() => {
    if(!weatherData) return "from-slate-900 via-slate-900 to-indigo-950";

    const getDynamicBackground = (code, isDay = 1) => {
        if (code >= 95) return "from-slate-900 via-slate-950 to-purple-950"; 
        if (isSnowCode(code)) return "from-slate-800 via-slate-700 to-cyan-950"; 
        if (code >= 51) return "from-slate-800 via-slate-900 to-blue-950"; 
        
        if (code === 0 && isDay) return "from-blue-500 via-blue-400 to-orange-300"; 
        if (code === 0 && !isDay) return "from-slate-950 via-indigo-950 to-purple-950"; 
        if (code <= 3 && isDay) return "from-slate-700 via-slate-600 to-blue-800"; 
        return "from-slate-900 to-indigo-950";
    };

    const { is_day } = weatherData.current;
    
    if (weatherData.daily && weatherData.daily.sunrise && weatherData.daily.sunset) {
        const sunrise = new Date(weatherData.daily.sunrise[0]).getTime();
        const sunset = new Date(weatherData.daily.sunset[0]).getTime();
        const nowMs = shiftedNow.getTime(); 
        
        const hourMs = 60 * 60 * 1000;
        const twilightMs = 30 * 60 * 1000;

        if (Math.abs(nowMs - sunrise) < twilightMs) return "from-indigo-900 via-rose-800 to-amber-400"; 
        if (Math.abs(nowMs - sunrise) < hourMs) return "from-blue-600 via-indigo-400 to-sky-200"; 

        if (Math.abs(nowMs - sunset) < twilightMs) return "from-indigo-950 via-purple-900 to-orange-500"; 
        if (Math.abs(nowMs - sunset) < hourMs) return "from-blue-800 via-orange-700 to-yellow-500"; 
    }
    
    return getDynamicBackground(effectiveWeatherCode, is_day);
  }, [weatherData, shiftedNow, effectiveWeatherCode]);

  // 7. Tendència baromètrica
  const barometricTrend = useMemo(() => {
      if(!weatherData?.hourly?.pressure_msl) return { trend: 'steady', val: 0 };
      const nowMs = shiftedNow.getTime();
      const currentIdx = weatherData.hourly.time.findIndex(t => {
          const tMs = new Date(t).getTime();
          return tMs <= nowMs && (tMs + 3600000) > nowMs;
      });
      if (currentIdx < 3) return { trend: 'steady', val: 0 }; 
      const currentP = weatherData.hourly.pressure_msl[currentIdx];
      const pastP = weatherData.hourly.pressure_msl[currentIdx - 3];
      const diff = currentP - pastP;
      if (diff >= 1) return { trend: 'rising', val: diff };
      if (diff <= -1) return { trend: 'falling', val: diff };
      return { trend: 'steady', val: diff };
  }, [weatherData, shiftedNow]);

  // 8. Altres mètriques
  const currentCape = useMemo(() => {
      if(!weatherData?.hourly?.cape) return 0;
      const nowMs = shiftedNow.getTime();
      const currentIdx = weatherData.hourly.time.findIndex(t => {
          const tMs = new Date(t).getTime();
          return tMs <= nowMs && (tMs + 3600000) > nowMs;
      });
      return (currentIdx !== -1 && weatherData.hourly.cape[currentIdx]) || 0;
  }, [weatherData, shiftedNow]);

  const currentDewPoint = useMemo(() => {
    if(!weatherData?.current) return 0;
    return calculateDewPoint(weatherData.current.temperature_2m, weatherData.current.relative_humidity_2m);
  }, [weatherData]);

  const reliability = useMemo(() => {
    if (!weatherData?.daily || !weatherData?.dailyComparison) return null;
    return calculateReliability(
      weatherData.daily,
      weatherData.dailyComparison.gfs,
      weatherData.dailyComparison.icon,
      0 
    );
  }, [weatherData]);
  
  const moonPhaseVal = useMemo(() => getMoonPhase(new Date()), []); 

  // 9. Dades per Gràfics
  const chartData = useMemo(() => {
    if (!weatherData?.hourly?.time) return [];
    
    const nowTime = shiftedNow.getTime();
    const idx = weatherData.hourly.time.findIndex(t => new Date(t).getTime() >= nowTime);
    let startIndex = 0;
    if (idx !== -1) startIndex = Math.max(0, idx);
    const endIndex = startIndex + 24;

    const availableKeys = Object.keys(weatherData.hourly);
    const snowKey = availableKeys.find(k => k === 'freezing_level_height') || 
                    availableKeys.find(k => k.includes('freezing_level_height'));
    
    const getSafeVal = (key, i, def = 0) => {
        return (weatherData.hourly[key] && weatherData.hourly[key][i] !== undefined) 
               ? weatherData.hourly[key][i] 
               : def;
    };

    return weatherData.hourly.time.slice(startIndex, endIndex).map((tRaw, i) => {
      const realIndex = startIndex + i;
      const temp = getSafeVal('temperature_2m', realIndex, 0);
      let fl = snowKey ? getSafeVal(snowKey, realIndex, null) : null;

      const isSuspicious = (fl === null || fl === undefined || (fl < 100 && temp > 4));
      if (isSuspicious) {
         fl = weatherData.hourlyComparison?.gfs?.[realIndex]?.freezing_level_height ?? 
              weatherData.hourlyComparison?.icon?.[realIndex]?.freezing_level_height ?? fl;
      }
      const snowLevelVal = (fl !== null && fl !== undefined) ? Math.max(0, fl - 300) : null;

      return {
        temp: unit === 'F' ? Math.round((temp * 9/5) + 32) : temp,
        apparent: unit === 'F' 
            ? Math.round((getSafeVal('apparent_temperature', realIndex) * 9/5) + 32) 
            : getSafeVal('apparent_temperature', realIndex),
        rain: getSafeVal('precipitation_probability', realIndex),
        precip: getSafeVal('precipitation', realIndex),
        wind: getSafeVal('wind_speed_10m', realIndex),
        gusts: getSafeVal('wind_gusts_10m', realIndex),
        windDir: getSafeVal('wind_direction_10m', realIndex),
        cloud: getSafeVal('cloud_cover', realIndex),
        humidity: getSafeVal('relative_humidity_2m', realIndex),
        uv: getSafeVal('uv_index', realIndex),
        snowLevel: snowLevelVal,
        isDay: getSafeVal('is_day', realIndex, 1),
        time: tRaw,
        code: getSafeVal('weather_code', realIndex, 0)
      };
    });
  }, [weatherData, unit, shiftedNow]);

  const comparisonData = useMemo(() => {
      if (!weatherData?.hourlyComparison) return null;
      
      const nowTime = shiftedNow.getTime();
      const idx = weatherData.hourly.time.findIndex(t => new Date(t).getTime() >= nowTime);
      let startIndex = 0;
      if (idx !== -1) startIndex = Math.max(0, idx);
      const endIndex = startIndex + 24;

      const sliceModel = (modelData) => {
         if(!modelData || !modelData.length) return [];
         return modelData.slice(startIndex, endIndex).map((d, i) => {
             if (!d) return null;
             return {
                 temp: unit === 'F' ? Math.round((d.temperature_2m * 9/5) + 32) : d.temperature_2m,
                 rain: d.precipitation_probability,
                 wind: d.wind_speed_10m,
                 cloud: d.cloud_cover,
                 humidity: d.relative_humidity_2m,
                 time: weatherData.hourly.time[startIndex + i]
             };
         }).filter(Boolean);
      };

      return {
          gfs: sliceModel(weatherData.hourlyComparison.gfs),
          icon: sliceModel(weatherData.hourlyComparison.icon),
          // --- FIX CLAU: Afegim les dades diàries per a ForecastSection ---
          daily: weatherData.dailyComparison 
      };

  }, [weatherData, unit, shiftedNow]);

  const weeklyExtremes = useMemo(() => {
    if(!weatherData) return { min: 0, max: 100 };
    return {
      min: Math.min(...weatherData.daily.temperature_2m_min),
      max: Math.max(...weatherData.daily.temperature_2m_max)
    };
  }, [weatherData]);

  return {
    shiftedNow,
    minutelyPreciseData,
    currentRainProbability,
    currentFreezingLevel,
    effectiveWeatherCode,
    currentBg,
    barometricTrend,
    currentCape,
    currentDewPoint,
    reliability,
    moonPhaseVal,
    chartData,
    comparisonData,
    weeklyExtremes
  };
}