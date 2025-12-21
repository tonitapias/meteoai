import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { 
  Wind, CloudSun, CloudRain, CloudLightning, Snowflake, 
  AlertTriangle, Umbrella, Shirt, ThermometerSun, AlertOctagon, 
  TrendingUp, Clock, Calendar, ThermometerSnowflake, GitGraph,
  Star, BrainCircuit, MapPin, Map 
} from 'lucide-react';

import Header from './components/Header'; 
import { TRANSLATIONS } from './constants/translations';
import { HourlyForecastChart, MinutelyPreciseChart } from './components/WeatherCharts';
import { 
  SunArcWidget, MoonWidget, PollenWidget, CompassGauge, 
  CircularGauge, DewPointWidget, CapeWidget, TempRangeBar, MoonPhaseIcon,
  SnowLevelWidget 
} from './components/WeatherWidgets';
import DayDetailModal from './components/DayDetailModal';
import RadarModal from './components/RadarModal'; 
import { WeatherParticles, getWeatherIcon } from './components/WeatherIcons';
import { TypewriterText, FlagIcon } from './components/WeatherUI';
import { 
  getShiftedDate, 
  calculateDewPoint, 
  normalizeModelData, 
  generateAIPrediction, 
  getMoonPhase, 
  calculateReliability,
  getWeatherLabel
} from './utils/weatherLogic';

// Movem LivingIcon fora per evitar re-creació constant en cada render
const LivingIcon = ({ code, isDay, rainProb, windSpeed, precip, children }) => {
  const animationStyle = windSpeed > 25 ? 'wiggle 1s ease-in-out infinite' : 
                         windSpeed > 15 ? 'wiggle 3s ease-in-out infinite' : 'none';

  const style = {
    animation: animationStyle,
    transformOrigin: 'bottom center',
    filter: precip > 2 ? 'drop-shadow(0 0 10px rgba(255,255,255,0.5))' : ''
  };

  const className = `transition-all duration-1000 ${precip > 2 ? 'animate-pulse' : ''}`;

  return (
    <div style={style} className={className}>
      {children}
    </div>
  );
};

export default function MeteoIA() {
  const [weatherData, setWeatherData] = useState(null);
  const [aqiData, setAqiData] = useState(null);
  const [aiAnalysis, setAiAnalysis] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [selectedDayIndex, setSelectedDayIndex] = useState(null);
  const [favorites, setFavorites] = useState([]);
  const [showRadar, setShowRadar] = useState(false); 

  const [unit, setUnit] = useState(() => localStorage.getItem('meteoia-unit') || 'C');
  const [lang, setLang] = useState(() => localStorage.getItem('meteoia-lang') || 'ca');
  const [viewMode, setViewMode] = useState(() => localStorage.getItem('meteoia-view') || 'basic');

  const [now, setNow] = useState(new Date());
  const t = TRANSLATIONS[lang] || TRANSLATIONS['ca'];

  useEffect(() => { localStorage.setItem('meteoia-unit', unit); }, [unit]);
  useEffect(() => { localStorage.setItem('meteoia-lang', lang); }, [lang]);
  useEffect(() => { localStorage.setItem('meteoia-view', viewMode); }, [viewMode]);

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 60000); 
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const savedFavs = localStorage.getItem('meteoia-favs');
    if (savedFavs) setFavorites(JSON.parse(savedFavs));
  }, []);

  const saveFavorites = useCallback((newFavs) => {
    setFavorites(newFavs);
    localStorage.setItem('meteoia-favs', JSON.stringify(newFavs));
  }, []);

  const toggleFavorite = useCallback(() => {
    if (!weatherData) return;
    const currentLoc = weatherData.location;
    const isFav = favorites.some(f => f.name === currentLoc.name);
    const newFavs = isFav ? favorites.filter(f => f.name !== currentLoc.name) : [...favorites, currentLoc];
    saveFavorites(newFavs);
  }, [weatherData, favorites, saveFavorites]);

  const removeFavorite = useCallback((e, name) => {
    if(e) e.stopPropagation();
    const newFavs = favorites.filter(f => f.name !== name);
    saveFavorites(newFavs);
  }, [favorites, saveFavorites]);

  const isCurrentFavorite = useMemo(() => {
      return weatherData && favorites.some(f => f.name === weatherData.location.name);
  }, [weatherData, favorites]);

  const formatTemp = useCallback((tempC) => {
    if (unit === 'F') return Math.round((tempC * 9/5) + 32);
    return Math.round(tempC);
  }, [unit]);

  const getUnitLabel = () => unit === 'F' ? '°F' : '°C';
  const isSnowCode = (code) => (code >= 71 && code <= 77) || code === 85 || code === 86;
  
  const formatDate = (dateString, options) => {
      const locales = { ca: 'ca-ES', es: 'es-ES', en: 'en-US', fr: 'fr-FR' };
      const date = dateString.includes('T') ? new Date(dateString) : new Date(`${dateString}T00:00:00`);
      return new Intl.DateTimeFormat(locales[lang] || locales['ca'], options).format(date);
  };
  
  const fetchWeatherByCoords = useCallback(async (lat, lon, name, country = "") => {
    setLoading(true);
    setError(null);
    setAiAnalysis(null);
    
    try {
      const weatherUrl = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,is_day,apparent_temperature,weather_code,wind_speed_10m,wind_direction_10m,pressure_msl,cloud_cover,wind_gusts_10m,precipitation&hourly=temperature_2m,apparent_temperature,precipitation_probability,precipitation,weather_code,wind_speed_10m,wind_direction_10m,cloud_cover,relative_humidity_2m,wind_gusts_10m,uv_index,is_day,freezing_level_height,pressure_msl,cape&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,uv_index_max,wind_speed_10m_max,precipitation_sum,snowfall_sum,sunrise,sunset&timezone=auto&models=ecmwf_ifs025,gfs_seamless,icon_seamless&minutely_15=precipitation,weather_code&forecast_days=8`;
      const aqiUrl = `https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${lat}&longitude=${lon}&current=european_aqi,alder_pollen,birch_pollen,grass_pollen,mugwort_pollen,olive_pollen,ragweed_pollen`;

      const weatherRes = await fetch(weatherUrl);
      if (!weatherRes.ok) throw new Error(`Error satèl·lit: ${weatherRes.status}`);
      const rawWeatherData = await weatherRes.json();
      
      let aqiData = null;
      try {
          const aqiRes = await fetch(aqiUrl);
          if(aqiRes.ok) aqiData = await aqiRes.json();
      } catch(e) { console.warn("AQI no disponible"); }
      
      const processedWeatherData = normalizeModelData(rawWeatherData);

      setWeatherData({ ...processedWeatherData, location: { name, country, latitude: lat, longitude: lon } });
      setAqiData(aqiData);
    } catch (err) {
      console.error(err);
      setError(err.message || "Error desconegut");
    } finally { 
      setLoading(false); 
    }
  }, []);

  const handleSearch = useCallback((lat, lon, name, country) => {
      fetchWeatherByCoords(lat, lon, name, country);
  }, [fetchWeatherByCoords]);

  const handleGetCurrentLocation = useCallback(() => {
    if (navigator.geolocation) {
      setLoading(true);
      navigator.geolocation.getCurrentPosition(
        async (position) => {
          const { latitude, longitude } = position.coords;
          try {
            const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&zoom=12&accept-language=${lang}`);
            const data = await response.json();
            const locationName = data.address.city || data.address.town || data.address.village || data.address.municipality || "Ubicació";
            const locationCountry = data.address.country || "";
            
            fetchWeatherByCoords(latitude, longitude, locationName, locationCountry);
          } catch (err) {
            console.error("Error reverse geocoding:", err);
            fetchWeatherByCoords(latitude, longitude, "Ubicació Detectada");
          }
        },
        (error) => { 
          setError("No s'ha pogut obtenir la ubicació."); 
          setLoading(false); 
        }
      );
    } else { setError("Geolocalització no suportada."); }
  }, [fetchWeatherByCoords, lang]);
  
  const shiftedNow = useMemo(() => {
    if (!weatherData) return now;
    const timezone = weatherData.timezone || 'UTC';
    return getShiftedDate(now, timezone);
  }, [weatherData, now]);

  const minutelyPreciseData = useMemo(() => {
    if (!weatherData || !weatherData.minutely_15 || !weatherData.minutely_15.precipitation) return [];
    
    const currentMs = shiftedNow.getTime();
    const times = weatherData.minutely_15.time.map(t => new Date(t).getTime());
    let idx = times.findIndex(t => t > currentMs);
    let currentIdx = (idx === -1) ? times.length - 1 : Math.max(0, idx - 1);
    
    return weatherData.minutely_15.precipitation.slice(currentIdx, currentIdx + 4);
  }, [weatherData, shiftedNow]);

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
          
          if (gfsVal !== null && gfsVal !== undefined) val = gfsVal;
          else if (iconVal !== null && iconVal !== undefined) val = iconVal;
      }
      
      return (val !== null && val !== undefined) ? val : null;
  }, [weatherData, shiftedNow]);

  const effectiveWeatherCode = useMemo(() => {
    if (!weatherData) return 0;
    
    const currentCode = weatherData.current.weather_code;
    const immediateRain = minutelyPreciseData && minutelyPreciseData.length > 0 
        ? Math.max(...minutelyPreciseData.slice(0, 2)) 
        : 0;

    if (immediateRain > 0.2) {
        if (immediateRain > 2) return 65; 
        if (weatherData.current.temperature_2m < 1) return 71; 
        return 61; 
    }

    const cloudCover = weatherData.current.cloud_cover;
    const windSpeed = weatherData.current.wind_speed_10m;

    if (windSpeed > 40 && cloudCover > 50 && currentCode < 50) return 3;
    if (weatherData.current.relative_humidity_2m > 98 && cloudCover < 90 && currentCode < 40) return 45;
    
    return currentCode;
  }, [weatherData, minutelyPreciseData, shiftedNow]);

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

    const { is_day, weather_code, cloud_cover } = weatherData.current;
    const code = effectiveWeatherCode || weather_code;

    if (code === 45 || code === 48) return "from-slate-600 via-slate-500 to-stone-400";
    if (cloud_cover > 95 && is_day && code < 50) return "from-slate-500 via-slate-400 to-slate-300"; 

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
    
    return getDynamicBackground(code, is_day);
  }, [weatherData, shiftedNow, effectiveWeatherCode]);

  const barometricTrend = useMemo(() => {
      if(!weatherData || !weatherData.hourly || !weatherData.hourly.pressure_msl) return { trend: 'steady', val: 0 };
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

  const currentCape = useMemo(() => {
      if(!weatherData || !weatherData.hourly || !weatherData.hourly.cape) return 0;
      const nowMs = shiftedNow.getTime();
      const currentIdx = weatherData.hourly.time.findIndex(t => {
          const tMs = new Date(t).getTime();
          return tMs <= nowMs && (tMs + 3600000) > nowMs;
      });
      if (currentIdx === -1) return 0;
      return weatherData.hourly.cape[currentIdx] || 0;
  }, [weatherData, shiftedNow]);

  const currentDewPoint = useMemo(() => {
    if(!weatherData || !weatherData.current) return 0;
    return calculateDewPoint(weatherData.current.temperature_2m, weatherData.current.relative_humidity_2m);
  }, [weatherData]);

  const reliability = useMemo(() => {
    if (!weatherData || !weatherData.daily || !weatherData.dailyComparison) return null;
    return calculateReliability(
      weatherData.daily,
      weatherData.dailyComparison.gfs,
      weatherData.dailyComparison.icon,
      0 
    );
  }, [weatherData]);

  useEffect(() => {
     if(weatherData) {
         const currentWithMinutely = { ...weatherData.current, minutely15: weatherData.minutely_15?.precipitation };
         const analysis = generateAIPrediction(
             currentWithMinutely, 
             weatherData.daily, 
             weatherData.hourly, 
             aqiData?.current?.european_aqi || 0, 
             lang, 
             effectiveWeatherCode,
             reliability
         );
         setAiAnalysis(analysis);
     }
  }, [lang, weatherData, aqiData, effectiveWeatherCode, reliability]);


  const chartData = useMemo(() => {
    if (!weatherData || !weatherData.hourly || !weatherData.hourly.time) return [];
    
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
      if (!weatherData || !weatherData.hourlyComparison) return null;
      
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
          icon: sliceModel(weatherData.hourlyComparison.icon)
      };

  }, [weatherData, unit, shiftedNow]);

  const weeklyExtremes = useMemo(() => {
    if(!weatherData) return { min: 0, max: 100 };
    return {
      min: Math.min(...weatherData.daily.temperature_2m_min),
      max: Math.max(...weatherData.daily.temperature_2m_max)
    };
  }, [weatherData]);

  const isTodaySnow = weatherData && (isSnowCode(weatherData.current.weather_code) || (weatherData.daily.snowfall_sum && weatherData.daily.snowfall_sum[0] > 0));
  const moonPhaseVal = getMoonPhase(new Date());

  const currentPrecip15 = weatherData?.current?.minutely15 
      ? weatherData.current.minutely15.slice(0, 4).reduce((a, b) => a + (b || 0), 0) 
      : 0;

  const hourlyForecastSection = (
    <div className="bg-slate-900/40 border border-white/10 rounded-3xl p-6 backdrop-blur-sm shadow-xl mb-6">
       <h3 className="font-bold text-white flex items-center gap-2">
         <Clock className="w-4 h-4 text-indigo-400 drop-shadow-sm fill-indigo-400/20" strokeWidth={2.5}/> {t.hourlyEvolution} (24h)
       </h3>
       <div className="flex gap-4 overflow-x-auto pb-2 custom-scrollbar">
          {chartData.filter((_, i) => i % 3 === 0).map((h) => (
             <div key={h.time} className="flex flex-col items-center min-w-[3rem]">
                <span className="text-xs text-slate-400">{new Date(h.time).getHours()}h</span>
                <div className="my-1 scale-75 filter drop-shadow-sm">{getWeatherIcon(h.code, "w-8 h-8", h.isDay, h.rain, h.wind, h.humidity, h.precip)}</div>
                <span className="text-sm font-bold">{Math.round(h.temp)}°</span>
                <div className="flex flex-col items-center mt-1 h-6 justify-start">
                   {h.rain > 0 && <span className="text-[10px] text-blue-400 font-bold">{h.rain}%</span>}
                   {h.precip > 0.25 && <span className="text-[9px] text-cyan-400 font-bold">{h.precip}mm</span>}
                </div>
             </div>
          ))}
       </div>
    </div>
  );

  const sevenDayForecastSection = weatherData && (
    <div className="bg-slate-900/40 border border-white/10 rounded-3xl p-6 backdrop-blur-sm shadow-xl">
      <h3 className="font-bold text-white mb-5 flex items-center gap-2">
        <Calendar className="w-4 h-4 text-amber-400 drop-shadow-sm fill-amber-400/20" strokeWidth={2.5}/> {t.forecast7days}
      </h3>
      <div className="space-y-2">
        {weatherData.daily.time.slice(1).map((day, idx) => {
          const i = idx + 1;
          const displayCode = weatherData.daily.weather_code[i];
          const precipSum = weatherData.daily.precipitation_sum[i];
          const rainProb = weatherData.daily.precipitation_probability_max[i];
          const snowSum = weatherData.daily.snowfall_sum[i];
          const isDaySnow = isSnowCode(displayCode);
          const listMoonPhase = getMoonPhase(new Date(day));
          
          let divergence = false;
          if (weatherData.dailyComparison.gfs.temperature_2m_max?.[i] !== undefined) {
             const maxes = [
                  weatherData.daily.temperature_2m_max[i], 
                  weatherData.dailyComparison.gfs.temperature_2m_max[i], 
                  weatherData.dailyComparison.icon.temperature_2m_max[i]
             ].filter(v => v !== undefined);
             if (Math.max(...maxes) - Math.min(...maxes) > 3) divergence = true;
          }

          return (
            <button 
              key={day}
              onClick={() => setSelectedDayIndex(i)}
              className="w-full flex items-center justify-between p-3 hover:bg-white/5 rounded-xl transition-colors group touch-manipulation active:bg-white/10"
            >
              <div className="w-16 text-left flex flex-col items-start">
                  <span className="font-bold text-slate-200 capitalize">{formatDate(day, { weekday: 'short' })}</span>
                  {divergence && (
                      <span className="text-[9px] text-amber-400 flex items-center gap-0.5 mt-0.5 bg-amber-500/10 px-1 rounded" title={t.aiConfidenceMod}>
                          <GitGraph className="w-2.5 h-2.5" /> Diff
                      </span>
                  )}
              </div>

              <div className="hidden md:flex justify-center w-10 opacity-70">
                  <MoonPhaseIcon phase={listMoonPhase} lat={weatherData.location.latitude} lang={lang} className="w-6 h-6" />
              </div>

              <div className="flex items-center gap-3 w-32 md:w-36">
                  <div className="group-hover:scale-110 transition-transform filter drop-shadow-md">
                      {getWeatherIcon(displayCode, "w-8 h-8", 1, rainProb)}
                  </div>
                  <div className="flex flex-col items-start">
                    {rainProb > 10 && (
                      <span className={`text-xs flex items-center font-bold gap-0.5 ${isDaySnow ? 'text-cyan-200' : 'text-blue-300'}`}>
                        <Umbrella className="w-3 h-3" strokeWidth={2.5}/>
                        {rainProb}%
                      </span>
                    )}
                    {snowSum > 0 ? (
                      <span className="text-[10px] font-medium text-cyan-100 flex items-center gap-0.5">
                        {snowSum}cm
                      </span>
                    ) : precipSum > 0.1 ? (
                      <span className="text-[10px] font-medium text-blue-200 flex items-center gap-0.5">
                        {precipSum < 0.25 ? "IP" : `${Math.round(precipSum)}mm`}
                      </span>
                    ) : null}
                  </div>
              </div>

              <div className="flex-1 flex justify-end md:justify-center">
                  <TempRangeBar 
                    min={Math.round(weatherData.daily.temperature_2m_min[i])}
                    max={Math.round(weatherData.daily.temperature_2m_max[i])}
                    globalMin={weeklyExtremes.min}
                    globalMax={weeklyExtremes.max}
                    displayMin={formatTemp(weatherData.daily.temperature_2m_min[i])}
                    displayMax={formatTemp(weatherData.daily.temperature_2m_max[i])}
                  />
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );

  return (
    <div className={`min-h-screen bg-gradient-to-br ${currentBg} text-slate-100 font-sans p-4 md:p-6 transition-all duration-1000 selection:bg-indigo-500 selection:text-white`}>
      {weatherData && <WeatherParticles code={effectiveWeatherCode} />}

      <div className="max-w-5xl mx-auto space-y-6 pb-20 md:pb-0 relative z-10 flex flex-col min-h-[calc(100vh-3rem)]">
        
        <Header 
           onSearch={handleSearch}
           onLocate={handleGetCurrentLocation}
           loading={loading}
           favorites={favorites}
           onRemoveFavorite={removeFavorite}
           lang={lang}
           setLang={setLang}
           unit={unit}
           setUnit={setUnit}
           viewMode={viewMode}
           setViewMode={setViewMode}
        />

        <div className="flex-1">
            {loading && !weatherData && (
            <div className="animate-pulse space-y-6">
                <div className="h-64 bg-slate-800/50 rounded-[2.5rem] w-full"></div>
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6"><div className="grid grid-cols-2 gap-4 h-48"> {[1,2,3,4].map(i => <div key={i} className="bg-slate-800/50 rounded-2xl h-full"></div>)} </div><div className="lg:col-span-2 bg-slate-800/50 rounded-3xl h-48"></div></div>
            </div>
            )}

            {error && !loading && (
            <div className="bg-red-500/10 border border-red-500/20 text-red-200 p-6 rounded-2xl flex items-center justify-center gap-3 animate-in shake">
                <AlertTriangle className="w-6 h-6" strokeWidth={2.5}/> <span className="font-medium">{error}</span>
            </div>
            )}

            {!weatherData && !loading && !error && (
            <div className="text-center py-20 md:py-32 animate-in fade-in slide-in-from-bottom-4 px-4">
                <div className="inline-flex p-6 rounded-full bg-indigo-500/10 mb-6 shadow-[0_0_30px_rgba(99,102,241,0.2)]">
                    <CloudSun className="w-16 h-16 text-indigo-400 animate-pulse" strokeWidth={1.5} />
                </div>
                <h2 className="text-3xl font-bold text-white mb-3">Meteo Toni AI</h2>
                <p className="text-slate-400 max-w-md mx-auto">{t.subtitle}</p>
                <div className="flex flex-wrap gap-3 justify-center mt-8 px-2">
                    {['ca', 'es', 'en', 'fr'].map(l => (
                        <button key={l} onClick={() => setLang(l)} className={`px-3 py-2 md:px-4 md:py-2 text-sm md:text-base rounded-full border flex items-center gap-2 transition-all ${lang === l ? 'bg-indigo-600 border-indigo-500 text-white shadow-lg scale-105' : 'border-slate-700 text-slate-400 hover:text-white hover:bg-slate-800'}`}>
                            <FlagIcon lang={l} className="w-4 h-3 md:w-5 md:h-4 rounded shadow-sm" /> {l === 'ca' ? 'Català' : l === 'es' ? 'Español' : l === 'fr' ? 'Français' : 'English'}
                        </button>
                    ))}
                </div>
            </div>
            )}

            {weatherData && (
            <div className="animate-in slide-in-from-bottom-8 duration-700 space-y-6">
                
                {aiAnalysis?.alerts?.length > 0 && (
                <div className="space-y-3">
                    {aiAnalysis.alerts.map((alert, i) => (
                    <div 
                        key={i} 
                        className={`${alert.level === 'high' ? 'bg-red-500/20 border-red-500/40 text-red-100' : 'bg-amber-500/20 border-amber-500/40 text-amber-100'} p-4 rounded-2xl flex items-center gap-4 animate-in slide-in-from-top-2 duration-500 shadow-lg`}
                        style={{animationDelay: `${i*100}ms`}}
                    >
                        <div className={`p-2 rounded-full ${alert.level === 'high' ? 'bg-red-500/20' : 'bg-amber-500/20'}`}>
                        {alert.type === t.storm && <CloudLightning className="w-6 h-6" strokeWidth={2.5}/>}
                        {!['Tempesta', t.storm].includes(alert.type) && <AlertTriangle className="w-6 h-6" strokeWidth={2.5}/>}
                        </div>
                        <div className="flex flex-col">
                        <div className="flex items-center gap-2">
                            <span className={`font-bold uppercase tracking-wider text-xs ${alert.level === 'high' ? 'text-red-400' : 'text-amber-400'} border ${alert.level === 'high' ? 'border-red-500/50' : 'border-amber-500/50'} px-2 py-0.5 rounded-md`}>
                            {alert.level === 'high' ? t.alertDanger : t.alertWarning}
                            </span>
                            <span className="font-bold text-sm">{alert.type}</span>
                        </div>
                        <span className="font-medium text-sm mt-1 opacity-90">{alert.msg}</span>
                        </div>
                    </div>
                    ))}
                </div>
                )}

                <div className="bg-slate-900/40 border border-white/10 rounded-[2rem] md:rounded-[2.5rem] p-6 md:p-8 relative overflow-hidden backdrop-blur-md shadow-2xl group">
                <div className="absolute top-0 right-0 -mt-10 -mr-10 w-64 h-64 bg-indigo-500/20 rounded-full blur-3xl pointer-events-none group-hover:bg-indigo-500/30 transition-colors duration-1000 animate-pulse"></div>

                <div className="flex flex-col lg:flex-row gap-8 items-start justify-between relative z-10">
                    <div className="flex flex-col gap-4 w-full lg:w-auto">
                        <div className="flex flex-col">
                            <div className="flex items-center gap-3">
                                    <h2 className="text-3xl md:text-4xl font-bold text-white tracking-tighter">{weatherData.location.name}</h2>
                                    <button onClick={toggleFavorite} className="hover:scale-110 transition-transform p-1 active:scale-90">
                                        <Star className={`w-6 h-6 transition-colors ${isCurrentFavorite ? 'text-amber-400 fill-amber-400' : 'text-slate-600 hover:text-amber-300'}`} strokeWidth={2.5} />
                                    </button>
                                    
                                    <button 
                                        onClick={() => setShowRadar(true)}
                                        className="ml-2 p-2 rounded-full bg-indigo-500/20 hover:bg-indigo-500/40 text-indigo-300 transition-colors border border-indigo-500/30 flex items-center gap-1.5 md:gap-2 px-3 group"
                                        title={t.radarTitle}
                                    >
                                        <Map className="w-4 h-4 md:w-5 md:h-5 group-hover:scale-110 transition-transform" strokeWidth={2.5} />
                                        <span className="text-[10px] md:text-xs font-bold uppercase tracking-wider">
                                            {t.radarShort}
                                        </span>
                                    </button>
                            </div>
                            <div className="flex items-center gap-3 text-sm text-indigo-200 font-medium mt-1">
                                    <span className="flex items-center gap-1.5"><MapPin className="w-3.5 h-3.5"/> {weatherData.location.country}</span>
                                    <span className="w-1 h-1 bg-indigo-500 rounded-full"></span>
                                    <span className="flex items-center gap-1.5 text-slate-400"><Clock className="w-3.5 h-3.5"/> {t.localTime}: {shiftedNow.toLocaleTimeString([], {hour: '2-digit', minute: '2-digit'})}</span>
                            </div>
                        </div>

                        <div className="flex items-center gap-6 mt-2">
                            <div className="filter drop-shadow-2xl animate-in zoom-in duration-500">
                                <LivingIcon 
                                    code={effectiveWeatherCode} 
                                    isDay={weatherData.current.is_day}
                                    rainProb={currentRainProbability}
                                    windSpeed={weatherData.current.wind_speed_10m}
                                    precip={weatherData.current.precipitation}
                                >
                                    {getWeatherIcon(
                                        effectiveWeatherCode, 
                                        "w-24 h-24 md:w-32 md:h-32", 
                                        weatherData.current.is_day, 
                                        currentRainProbability, 
                                        weatherData.current.wind_speed_10m, 
                                        weatherData.current.relative_humidity_2m,
                                        currentPrecip15 
                                    )}
                                </LivingIcon>
                            </div>

                            <div className="flex flex-col justify-center">
                                    <span className="text-8xl md:text-9xl font-bold text-white leading-none tracking-tighter drop-shadow-2xl">
                                    {formatTemp(weatherData.current.temperature_2m)}°
                                    </span>
                                    <span className="text-xl md:text-2xl font-medium text-indigo-200 capitalize mt-2">
                                    {getWeatherLabel({ 
                                        ...weatherData.current, 
                                        weather_code: effectiveWeatherCode, 
                                        minutely15: weatherData.minutely_15?.precipitation 
                                    }, lang)}
                                    </span>
                            </div>
                        </div>

                        <div className="flex flex-wrap items-center gap-3">
                                <div className="flex items-center gap-3 text-indigo-100 font-bold bg-white/5 border border-white/5 px-4 py-2 rounded-full text-sm backdrop-blur-md shadow-lg">
                                    <span className="text-rose-300 flex items-center gap-1">↑ {formatTemp(weatherData.daily.temperature_2m_max[0])}°</span>
                                    <span className="w-px h-3 bg-white/20"></span>
                                    <span className="text-cyan-300 flex items-center gap-1">↓ {formatTemp(weatherData.daily.temperature_2m_min[0])}°</span>
                                </div>
                                <div className="text-sm text-slate-400 font-medium px-2">
                                    {t.feelsLike} <span className="text-slate-200 font-bold">{formatTemp(weatherData.current.apparent_temperature)}°</span>
                                </div>
                        </div>
                    </div>

                    <div className="flex-1 w-full lg:max-w-md bg-slate-950/30 border border-white/10 rounded-2xl p-5 backdrop-blur-md shadow-inner relative overflow-hidden self-stretch flex flex-col justify-center">
                        <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2 text-xs font-bold uppercase text-indigo-300 tracking-wider">
                            <BrainCircuit className="w-4 h-4 animate-pulse" strokeWidth={2.5}/> {t.aiAnalysis}
                        </div>
                        {aiAnalysis && (
                            <span className={`text-[10px] px-2 py-0.5 rounded-full border ${
                                aiAnalysis.confidenceLevel === 'high' ? 'text-green-400 border-green-500/30 bg-green-500/10' :
                                aiAnalysis.confidenceLevel === 'medium' ? 'text-yellow-400 border-yellow-500/30 bg-yellow-500/10' :
                                'text-red-400 border-red-500/30 bg-red-500/10'
                            }`}>
                                {aiAnalysis.confidence}
                            </span>
                        )}
                        </div>
                        
                        {aiAnalysis ? (
                        <div className="space-y-4 animate-in fade-in">
                            <TypewriterText text={aiAnalysis.text} />
                            
                            <div className="flex flex-wrap gap-2 mt-3 mb-4">
                                {aiAnalysis.tips.map((tip, i) => (
                                <span key={i} className="text-xs px-3 py-1.5 bg-indigo-500/20 text-indigo-100 rounded-lg border border-indigo-500/20 flex items-center gap-1.5 shadow-sm animate-in zoom-in duration-500" style={{animationDelay: `${i*150}ms`}}>
                                    {tip.includes('jaqueta') || tip.includes('coat') ? <Shirt className="w-3.5 h-3.5 opacity-70"/> : <AlertTriangle className="w-3.5 h-3.5 opacity-70"/>}
                                    {tip}
                                </span>
                                ))}
                            </div>
                            
                            {reliability && (
                                <div className={`p-3 rounded-xl border flex items-center gap-3 animate-in fade-in slide-in-from-bottom-2 duration-700 ${
                                reliability.level === 'high' ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-200' :
                                reliability.level === 'medium' ? 'bg-amber-500/10 border-amber-500/20 text-amber-200' :
                                'bg-rose-500/10 border-rose-500/20 text-rose-200'
                                }`}>
                                <div className="relative shrink-0">
                                    <div className={`w-3 h-3 rounded-full ${
                                    reliability.level === 'high' ? 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.6)]' :
                                    reliability.level === 'medium' ? 'bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.6)]' :
                                    'bg-rose-400 shadow-[0_0_8px_rgba(251,113,133,0.6)]'
                                    }`}></div>
                                </div>
                                <span className="text-xs font-medium leading-tight">
                                    {reliability.type === 'ok' && t.rel_high}
                                    {reliability.type === 'general' && t.rel_medium}
                                    {reliability.type === 'rain' && t.rel_low_rain.replace('{diff}', reliability.value)}
                                    {reliability.type === 'temp' && t.rel_low_temp.replace('{diff}', reliability.value)}
                                </span>
                                </div>
                            )}
                            
                            <MinutelyPreciseChart data={minutelyPreciseData} label={t.preciseRain} currentPrecip={weatherData.current.precipitation} />
                        </div>
                        ) : (
                        <div className="flex items-center gap-2 text-slate-500 text-sm animate-pulse min-h-[3em]">
                            <div className="w-2 h-2 bg-indigo-500 rounded-full animate-bounce"></div> {t.generatingTips}
                        </div>
                        )}
                    </div>
                </div>
                </div>

                {viewMode === 'expert' && (
                <div className="animate-in slide-in-from-bottom-4 duration-500">
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
                    
                    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-2 gap-3 md:gap-4 auto-rows-fr">
                        <div className="col-span-1">
                        <CompassGauge 
                            degrees={weatherData.current.wind_direction_10m} 
                            speed={weatherData.current.wind_speed_10m} 
                            label={t.wind}
                            lang={lang}
                        />
                        </div>
                        
                        {currentFreezingLevel !== null && currentFreezingLevel < 4000 && (
                            <div className="col-span-1">
                                <SnowLevelWidget freezingLevel={currentFreezingLevel} unit={unit} lang={lang} />
                            </div>
                        )}

                        <CircularGauge 
                            icon={<AlertOctagon className="w-6 h-6" strokeWidth={2.5}/>} 
                            label={t.pressure} 
                            value={Math.round(weatherData.current.pressure_msl)} 
                            max={1050} 
                            subText="hPa"
                            color="text-pink-400"
                            trend={barometricTrend.trend}
                        />
                        <DewPointWidget value={currentDewPoint} humidity={weatherData.current.relative_humidity_2m} lang={lang} unit={unit} />
                        <div className="col-span-1"><CapeWidget cape={currentCape} lang={lang} /></div>
                        <div className="col-span-2 md:col-span-2"><SunArcWidget sunrise={weatherData.daily.sunrise[0]} sunset={weatherData.daily.sunset[0]} lang={lang} shiftedNow={shiftedNow}/></div>
                        <div className="col-span-2 md:col-span-2"><MoonWidget phase={moonPhaseVal} lat={weatherData.location.latitude} lang={lang}/></div>
                        <div className="col-span-2 md:col-span-2"><PollenWidget data={aqiData?.current} lang={lang} /></div>
                    </div>

                    <div className="lg:col-span-2 flex flex-col gap-6">
                        {hourlyForecastSection}
                        {sevenDayForecastSection}
                        <div className="bg-slate-900/40 border border-white/10 rounded-3xl p-4 md:p-6 relative overflow-hidden backdrop-blur-sm flex flex-col shadow-xl">
                            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 z-10 gap-4">
                            <h3 className="font-bold text-white flex items-center gap-2"><TrendingUp className="w-4 h-4 text-indigo-400 drop-shadow-sm fill-indigo-400/20" strokeWidth={2.5}/> {t.trend24h}</h3>
                            </div>
                            <HourlyForecastChart data={chartData} comparisonData={comparisonData} unit={getUnitLabel()} lang={lang} shiftedNow={shiftedNow} />
                        </div>
                    </div>
                    </div>
                </div>
                )}
                
                {viewMode === 'basic' && (
                <>
                {hourlyForecastSection}
                {sevenDayForecastSection}
                </>
                )}
            </div>
            )}
        </div>

        {/* --- FOOTER GLOBAL (ARA FORA DEL CONDICIONAL) --- */}
        <div className="w-full py-8 mt-8 text-center border-t border-white/5">
            <p className="text-xs text-slate-500 font-medium tracking-wider uppercase opacity-70">
            © {new Date().getFullYear()} Meteo Toni AI
            </p>
        </div>

        <DayDetailModal 
          weatherData={weatherData}
          selectedDayIndex={selectedDayIndex}
          onClose={() => setSelectedDayIndex(null)}
          unit={unit}
          lang={lang}
          viewMode={viewMode}
          shiftedNow={shiftedNow}
          getWeatherIcon={getWeatherIcon}
        />

        {showRadar && weatherData && (
            <RadarModal 
                lat={weatherData.location.latitude} 
                lon={weatherData.location.longitude} 
                onClose={() => setShowRadar(false)} 
                lang={lang} 
            />
        )}

      </div>
    </div>
  );
}