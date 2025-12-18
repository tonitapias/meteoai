import React, { useState, useEffect, useRef, useMemo } from 'react';
import { 
  Search, Wind, Droplets, MapPin, Sun, Cloud, CloudRain, 
  CloudLightning, Snowflake, CloudFog, CloudSun, CloudMoon, BrainCircuit, 
  Activity, AlertTriangle, X, Sunrise, Sunset, Umbrella, Eye,
  LocateFixed, Shirt, Leaf, Star, RefreshCw, Trash2, Navigation,
  ThermometerSun, Gauge, ArrowRight, AlertOctagon, TrendingUp, TrendingDown, Minus, Calendar, Clock,
  Layers, ThermometerSnowflake, AlertCircle, CloudSnow, Moon, Compass, Globe, Flower2,
  LayoutTemplate, LayoutDashboard, GitGraph, Mountain, Zap, Thermometer,
  ArrowDownUp, CheckCircle2, Split
} from 'lucide-react';

// --- IMPORTS DELS NOUS MÒDULS ---
import { TRANSLATIONS } from './constants/translations';
import { HourlyForecastChart, MinutelyPreciseChart } from './components/WeatherCharts';
import { 
  SunArcWidget, MoonWidget, PollenWidget, CompassGauge, 
  CircularGauge, DewPointWidget, CapeWidget, TempRangeBar, MoonPhaseIcon 
} from './components/WeatherWidgets';
import DayDetailModal from './components/DayDetailModal';
import { WeatherParticles, getWeatherIcon } from './components/WeatherIcons';
import { TypewriterText, FlagIcon } from './components/WeatherUI';
import { 
  getShiftedDate, 
  calculateDewPoint, 
  normalizeModelData, 
  generateAIPrediction, 
  getMoonPhase, 
  calculateReliability 
} from './utils/weatherLogic';

// --- COMPONENT PER ANIMAR ICONES (LIVING ICONS) ---
const LivingIcon = ({ code, isDay, rainProb, windSpeed, precip, children }) => {
  // Definim estils d'animació locals per no dependre de tailwind.config
  const style = {
    animation: windSpeed > 25 ? 'wiggle 1s ease-in-out infinite' : 
               windSpeed > 15 ? 'wiggle 3s ease-in-out infinite' : 'none',
    transformOrigin: 'bottom center',
    filter: precip > 2 ? 'drop-shadow(0 0 10px rgba(255,255,255,0.5))' : ''
  };

  const precipStyle = precip > 2 ? { animation: 'pulse 0.8s cubic-bezier(0.4, 0, 0.6, 1) infinite' } : {};

  return (
    <>
      <style>{`
        @keyframes wiggle {
          0%, 100% { transform: rotate(-3deg); }
          50% { transform: rotate(3deg); }
        }
      `}</style>
      <div style={{...style, ...precipStyle}} className="transition-all duration-1000">
        {children}
      </div>
    </>
  );
};

// --- APP PRINCIPAL ---
export default function MeteoIA() {
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [activeSuggestionIndex, setActiveSuggestionIndex] = useState(-1);
  const [weatherData, setWeatherData] = useState(null);
  const [aqiData, setAqiData] = useState(null);
  const [aiAnalysis, setAiAnalysis] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [selectedDayIndex, setSelectedDayIndex] = useState(null);
  const [favorites, setFavorites] = useState([]);
  
  const [unit, setUnit] = useState(() => localStorage.getItem('meteoia-unit') || 'C');
  const [lang, setLang] = useState(() => localStorage.getItem('meteoia-lang') || 'ca');
  const [viewMode, setViewMode] = useState(() => localStorage.getItem('meteoia-view') || 'basic');
  const [isSearching, setIsSearching] = useState(false);

  const [now, setNow] = useState(new Date());

  const searchRefPC = useRef(null);
  const searchRefMobile = useRef(null);
  const inputRef = useRef(null);
  const suggestionsListRef = useRef(null);
  const t = TRANSLATIONS[lang];

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

  useEffect(() => {
      if (showSuggestions && activeSuggestionIndex !== -1 && suggestionsListRef.current) {
          const list = suggestionsListRef.current;
          const buttons = list.querySelectorAll('button.group'); 
          if (buttons[activeSuggestionIndex]) {
              buttons[activeSuggestionIndex].scrollIntoView({ block: 'nearest' });
          }
      }
  }, [activeSuggestionIndex, showSuggestions, query, favorites]);

  const saveFavorites = (newFavs) => {
    setFavorites(newFavs);
    localStorage.setItem('meteoia-favs', JSON.stringify(newFavs));
  };

  const toggleFavorite = () => {
    if (!weatherData) return;
    const currentLoc = weatherData.location;
    const isFav = favorites.some(f => f.name === currentLoc.name);
    const newFavs = isFav ? favorites.filter(f => f.name !== currentLoc.name) : [...favorites, currentLoc];
    saveFavorites(newFavs);
  };

  const removeFavorite = (e, name) => {
    e.stopPropagation();
    const newFavs = favorites.filter(f => f.name !== name);
    saveFavorites(newFavs);
  };

  const isCurrentFavorite = weatherData && favorites.some(f => f.name === weatherData.location.name);

  const formatTemp = (tempC) => {
    if (unit === 'F') return Math.round((tempC * 9/5) + 32);
    return Math.round(tempC);
  };

  const getUnitLabel = () => unit === 'F' ? '°F' : '°C';
  const isSnowCode = (code) => (code >= 71 && code <= 77) || code === 85 || code === 86;
 
  const getLangCodeForAPI = (l) => l; 
  
  const formatDate = (dateString, options) => {
      const locales = { ca: 'ca-ES', es: 'es-ES', en: 'en-US', fr: 'fr-FR' };
      const date = dateString.includes('T') ? new Date(dateString) : new Date(`${dateString}T00:00:00`);
      return new Intl.DateTimeFormat(locales[lang], options).format(date);
  };
  
  const formatTime = (dateString) => {
      const locales = { ca: 'ca-ES', es: 'es-ES', en: 'en-US', fr: 'fr-FR' };
      return new Date(dateString).toLocaleTimeString(locales[lang], {hour:'2-digit', minute:'2-digit'});
  };

  const getDynamicBackground = (code, isDay = 1) => {
    if (!weatherData) return "from-slate-900 via-slate-900 to-indigo-950";
    if (code >= 95) return "from-slate-900 via-slate-950 to-purple-950"; 
    if (isSnowCode(code)) return "from-slate-800 via-slate-700 to-cyan-950"; 
    if (code >= 51) return "from-slate-800 via-slate-900 to-blue-950"; 
    
    if (code === 0 && isDay) return "from-blue-500 via-blue-400 to-orange-300"; 
    if (code === 0 && !isDay) return "from-slate-950 via-indigo-950 to-purple-950"; 
    if (code <= 3 && isDay) return "from-slate-700 via-slate-600 to-blue-800"; 
    return "from-slate-900 to-indigo-950";
  };
  
  // --- MILLORA 3: FONS ATMOSFÈRICS MÉS REALS ---
  const getRefinedBackground = () => {
    if(!weatherData) return "from-slate-900 via-slate-900 to-indigo-950";
    const { is_day, weather_code, cloud_cover } = weatherData.current;
    
    // Dies molt grisos o boira
    if (weather_code === 45 || weather_code === 48) return "from-slate-600 via-slate-500 to-stone-400";
    if (cloud_cover > 95 && is_day && weather_code < 50) return "from-slate-500 via-slate-400 to-slate-300"; 

    if (weatherData.daily && weatherData.daily.sunrise && weatherData.daily.sunset) {
        const sunrise = new Date(weatherData.daily.sunrise[0]).getTime();
        const sunset = new Date(weatherData.daily.sunset[0]).getTime();
        const nowMs = shiftedNow.getTime(); 
        
        const hourMs = 60 * 60 * 1000;
        const twilightMs = 30 * 60 * 1000;

        // SORTIDA SOL
        if (Math.abs(nowMs - sunrise) < twilightMs) return "from-indigo-900 via-rose-800 to-amber-400"; 
        if (Math.abs(nowMs - sunrise) < hourMs) return "from-blue-600 via-indigo-400 to-sky-200"; 

        // POSTA SOL
        if (Math.abs(nowMs - sunset) < twilightMs) return "from-indigo-950 via-purple-900 to-orange-500"; 
        if (Math.abs(nowMs - sunset) < hourMs) return "from-blue-800 via-orange-700 to-yellow-500"; 
    }
    
    return getDynamicBackground(weather_code, is_day);
  };

  useEffect(() => {
    const timer = setTimeout(async () => {
      if (query.length > 2 && showSuggestions) {
        try {
          const res = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${query}&count=5&language=${getLangCodeForAPI(lang)}&format=json`);
          const data = await res.json();
          setSuggestions(data.results || []);
          setActiveSuggestionIndex(-1); 
        } catch (e) { console.error(e); }
      } 
    }, 300);
    return () => clearTimeout(timer);
  }, [query, showSuggestions, lang]);
  
  useEffect(() => {
    if (!showSuggestions) return;
    if (query.length === 0) {
        setSuggestions(favorites);
        setActiveSuggestionIndex(-1);
    }
  }, [query, showSuggestions, favorites]);


  const cleanupSearch = (lat, lon, name, country) => {
    setTimeout(() => {
        fetchWeatherByCoords(lat, lon, name, country);
        setShowSuggestions(false);
        setQuery(""); 
        
        if (document.activeElement && document.activeElement.blur) {
           document.activeElement.blur();
        }
    }, 50);
  }

  const executeSearch = () => {
    if (isSearching) return;
    
    const list = query.length === 0 ? favorites : suggestions;
    if (list.length > 0) {
        const index = (activeSuggestionIndex >= 0 && activeSuggestionIndex < list.length) 
            ? activeSuggestionIndex 
            : 0;
        
        const item = list[index];
        if (item) {
            setIsSearching(true);
            cleanupSearch(item.latitude, item.longitude, item.name, item.country);
        }
    }
  };

  const handleKeyDown = (e) => {
    if (!showSuggestions) return;
    const list = query.length === 0 ? favorites : suggestions;
    if (list.length === 0) return;
    
    if (e.key === 'ArrowDown') { e.preventDefault(); setActiveSuggestionIndex(prev => (prev < list.length - 1 ? prev + 1 : 0)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActiveSuggestionIndex(prev => (prev > 0 ? prev - 1 : list.length - 1)); }
    else if (e.key === 'Enter') {
      e.preventDefault();
      executeSearch();
    } else if (e.key === 'Escape') { setShowSuggestions(false); }
  };

  const handleGetCurrentLocation = () => {
    if (isSearching) return;
    
    if (navigator.geolocation) {
      setLoading(true);
      setIsSearching(true);
      navigator.geolocation.getCurrentPosition(
        async (position) => {
          const { latitude, longitude } = position.coords;
          try {
            const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&zoom=12&accept-language=${lang}`);
            const data = await response.json();
            const locationName = data.address.city || data.address.town || data.address.village || data.address.municipality || "Ubicació";
            const locationCountry = data.address.country || "";
            
            cleanupSearch(latitude, longitude, locationName, locationCountry); 
          } catch (err) {
            console.error("Error reverse geocoding:", err);
            cleanupSearch(latitude, longitude, "Ubicació Detectada");
          }
        },
        (error) => { 
          setError("No s'ha pogut obtenir la ubicació."); 
          setLoading(false); 
          setIsSearching(false);
        }
      );
    } else { setError("Geolocalització no suportada."); }
  };

  const fetchWeatherByCoords = async (lat, lon, name, country = "") => {
    setLoading(true);
    setIsSearching(true);
    setError(null);
    setAiAnalysis(null);
    setSuggestions([]);
    setShowSuggestions(false);
    
    try {
      const weatherUrl = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,is_day,apparent_temperature,weather_code,wind_speed_10m,wind_direction_10m,pressure_msl,cloud_cover,wind_gusts_10m,precipitation&hourly=temperature_2m,apparent_temperature,precipitation_probability,precipitation,weather_code,wind_speed_10m,wind_direction_10m,cloud_cover,relative_humidity_2m,wind_gusts_10m,uv_index,is_day,freezing_level_height,pressure_msl,cape&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,uv_index_max,wind_speed_10m_max,precipitation_sum,snowfall_sum,sunrise,sunset&timezone=auto&models=best_match,gfs_seamless,icon_seamless&minutely_15=precipitation,weather_code`;
      
      const [weatherRes, aqiRes] = await Promise.all([
        fetch(weatherUrl),
        fetch(`https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${lat}&longitude=${lon}&current=european_aqi,alder_pollen,birch_pollen,grass_pollen,mugwort_pollen,olive_pollen,ragweed_pollen`)
      ]);
      
      if (!weatherRes.ok) throw new Error(`Error satèl·lit: ${weatherRes.status}`);
      const rawWeatherData = await weatherRes.json();
      const aqiData = await aqiRes.json();
      
      const processedWeatherData = normalizeModelData(rawWeatherData);

      setWeatherData({ ...processedWeatherData, location: { name, country, latitude: lat, longitude: lon } });
      setAqiData(aqiData);
    } catch (err) {
      console.error(err);
      setError(err.message || "Error desconegut");
    } finally { 
      setLoading(false); 
      setIsSearching(false);
    }
  };
  
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

  // --- MILLORA 2: CÀLCUL DEL CODI METEO MÉS AGRESSIU (Real-Time) ---
  const effectiveWeatherCode = useMemo(() => {
    if (!weatherData) return 0;
    
    const currentCode = weatherData.current.weather_code;
    const immediateRain = minutelyPreciseData && minutelyPreciseData.length > 0 ? Math.max(...minutelyPreciseData.slice(0, 2)) : 0;
    const currentPrecip = weatherData.current.precipitation;
    const cloudCover = weatherData.current.cloud_cover;
    const windSpeed = weatherData.current.wind_speed_10m;
    
    // Prioritat Pluja Real
    if (currentPrecip > 0.1 || immediateRain > 0.2) {
        if (currentPrecip > 2 || immediateRain > 2) return 65; // Pluja forta
        if (weatherData.current.temperature_2m < 1) return 71; // Neu probable
        return 61; // Pluja
    }

    // Vent molt fort amb núvols -> Amenaçador (Code 3)
    if (windSpeed > 40 && cloudCover > 50 && currentCode < 50) return 3;

    // Boira espessa (Humitat alta + sense sol)
    if (weatherData.current.relative_humidity_2m > 98 && cloudCover < 90 && currentCode < 40) return 45;
    
    return currentCode;
  }, [weatherData, minutelyPreciseData, shiftedNow]);

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

  useEffect(() => {
     if(weatherData && aqiData) {
         const currentWithMinutely = { ...weatherData.current, minutely15: weatherData.minutely_15?.precipitation };
         const analysis = generateAIPrediction(currentWithMinutely, weatherData.daily, weatherData.hourly, aqiData?.current?.european_aqi || 0, lang, effectiveWeatherCode);
         setAiAnalysis(analysis);
     }
  }, [lang, weatherData, aqiData, effectiveWeatherCode]);


  const chartData = useMemo(() => {
    if (!weatherData || !weatherData.hourly || !weatherData.hourly.temperature_2m || !weatherData.hourly.time) return [];
    
    const nowTime = shiftedNow.getTime();
    
    const idx = weatherData.hourly.time.findIndex(t => new Date(t).getTime() >= nowTime);
    let startIndex = 0;
    if (idx !== -1) startIndex = Math.max(0, idx);
    const endIndex = startIndex + 24;

    const mainData = weatherData.hourly.temperature_2m.slice(startIndex, endIndex).map((temp, i) => ({
      temp: unit === 'F' ? Math.round((temp * 9/5) + 32) : temp,
      apparent: unit === 'F' ? Math.round((weatherData.hourly.apparent_temperature[startIndex + i] * 9/5) + 32) : weatherData.hourly.apparent_temperature[startIndex + i],
      rain: weatherData.hourly.precipitation_probability[startIndex + i],
      precip: weatherData.hourly.precipitation[startIndex + i], 
      wind: weatherData.hourly.wind_speed_10m[startIndex + i],
      gusts: weatherData.hourly.wind_gusts_10m[startIndex + i],
      windDir: weatherData.hourly.wind_direction_10m[startIndex + i], 
      cloud: weatherData.hourly.cloud_cover[startIndex + i],
      humidity: weatherData.hourly.relative_humidity_2m[startIndex + i], 
      uv: weatherData.hourly.uv_index[startIndex + i],
      snowLevel: weatherData.hourly.freezing_level_height ? Math.max(0, weatherData.hourly.freezing_level_height[startIndex + i] - 300) : 0,
      isDay: weatherData.hourly.is_day[startIndex + i],
      time: weatherData.hourly.time[startIndex + i],
      code: weatherData.hourly.weather_code[startIndex + i]
    }));

    return mainData;
  }, [weatherData, unit, shiftedNow]);

  const comparisonData = useMemo(() => {
      if (!weatherData || !weatherData.hourlyComparison) return null;
      
      const nowTime = shiftedNow.getTime();
      const idx = weatherData.hourly.time.findIndex(t => new Date(t).getTime() >= nowTime);
      let startIndex = 0;
      if (idx !== -1) startIndex = Math.max(0, idx);
      const endIndex = startIndex + 24;

      const sliceModel = (modelData) => {
         if(!modelData) return [];
         return modelData.slice(startIndex, endIndex).map((d, i) => ({
             temp: unit === 'F' ? Math.round((d.temperature_2m * 9/5) + 32) : d.temperature_2m,
             rain: d.precipitation_probability,
             wind: d.wind_speed_10m,
             cloud: d.cloud_cover,
             humidity: d.relative_humidity_2m,
             time: weatherData.hourly.time[startIndex + i]
         }));
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
  
  const currentRainProbability = useMemo(() => {
     if (!weatherData || !weatherData.hourly) return 0;
     const nowMs = shiftedNow.getTime();
     const hourIdx = weatherData.hourly.time.findIndex(t => {
        const tMs = new Date(t).getTime();
        return tMs <= nowMs && (tMs + 3600000) > nowMs;
     });
     return hourIdx !== -1 ? weatherData.hourly.precipitation_probability[hourIdx] : 0;
  }, [weatherData, shiftedNow]);

  useEffect(() => {
    function handleClickOutside(event) { 
        const isInsidePC = searchRefPC.current && searchRefPC.current.contains(event.target);
        const isInsideMobile = searchRefMobile.current && searchRefMobile.current.contains(event.target);
        
        if (!isInsidePC && !isInsideMobile) {
            setShowSuggestions(false);
        }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);
  
  const cycleLang = () => {
      const langs = ['ca', 'es', 'en', 'fr'];
      const currentIdx = langs.indexOf(lang);
      setLang(langs[(currentIdx + 1) % langs.length]);
  };
  
  const toggleViewMode = () => {
    setViewMode(prev => prev === 'basic' ? 'expert' : 'basic');
  };

   const currentBg = getRefinedBackground();
  const isTodaySnow = weatherData && (isSnowCode(weatherData.current.weather_code) || (weatherData.daily.snowfall_sum && weatherData.daily.snowfall_sum[0] > 0));
  
  const moonPhaseVal = getMoonPhase(new Date());

  const sevenDayForecastSection = weatherData && (
    <div className="bg-slate-900/40 border border-white/10 rounded-3xl p-6 backdrop-blur-sm shadow-xl">
      <h3 className="font-bold text-white mb-5 flex items-center gap-2">
        <Calendar className="w-4 h-4 text-amber-400 drop-shadow-sm fill-amber-400/20" strokeWidth={2.5}/> {t.forecast7days}
      </h3>
      <div className="space-y-2">
        {weatherData.daily.time.map((day, i) => {
          const isDaySnow = isSnowCode(weatherData.daily.weather_code[i]);
          const precipSum = weatherData.daily.precipitation_sum[i];
          const snowSum = weatherData.daily.snowfall_sum[i];
          const listMoonPhase = getMoonPhase(new Date(day));
          
          let divergence = false;
          if (weatherData.dailyComparison.gfs.temperature_2m_max && weatherData.dailyComparison.icon.temperature_2m_max) {
              const maxes = [
                  weatherData.daily.temperature_2m_max[i], 
                  weatherData.dailyComparison.gfs.temperature_2m_max[i], 
                  weatherData.dailyComparison.icon.temperature_2m_max[i]
              ];
              const maxDiff = Math.max(...maxes) - Math.min(...maxes);
              if (maxDiff > 3) divergence = true;
          }

          return (
            <button 
              key={i}
              onClick={() => setSelectedDayIndex(i)}
              className="w-full flex items-center justify-between p-3 hover:bg-white/5 rounded-xl transition-colors group touch-manipulation active:bg-white/10"
            >
              <div className="w-16 text-left flex flex-col items-start">
                  <span className="font-bold text-slate-200 capitalize">{i === 0 ? t.today : formatDate(day, { weekday: 'short' })}</span>
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
                      {getWeatherIcon(weatherData.daily.weather_code[i], "w-8 h-8", 1, weatherData.daily.precipitation_probability_max[i])}
                  </div>
                  <div className="flex flex-col items-start">
                    {weatherData.daily.precipitation_probability_max[i] > 10 && (
                      <span className={`text-xs flex items-center font-bold gap-0.5 ${isDaySnow ? 'text-cyan-200' : 'text-blue-300'}`}>
                        <Umbrella className="w-3 h-3" strokeWidth={2.5}/>
                        {weatherData.daily.precipitation_probability_max[i]}%
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

  const reliability = useMemo(() => {
    if (!weatherData || !weatherData.daily || !weatherData.dailyComparison) return null;
    return calculateReliability(
      weatherData.daily,
      weatherData.dailyComparison.gfs,
      weatherData.dailyComparison.icon,
      0 
    );
  }, [weatherData]);  

  return (
    <div className={`min-h-screen bg-gradient-to-br ${currentBg} text-slate-100 font-sans p-4 md:p-6 transition-all duration-1000 selection:bg-indigo-500 selection:text-white`}>
      {weatherData && <WeatherParticles code={effectiveWeatherCode} />}

      <div className="max-w-5xl mx-auto space-y-6 pb-20 md:pb-0 relative z-10">
        
        <div className="bg-slate-900/60 p-4 rounded-2xl border border-white/10 backdrop-blur-md flex flex-col md:flex-row gap-4 items-center justify-between sticky top-2 z-50 shadow-xl">
          
          <div className="flex items-center gap-3 select-none w-full md:w-auto justify-between md:justify-start md:order-1">
             <div className="flex items-center gap-3">
               <div className="bg-gradient-to-tr from-indigo-600 to-purple-600 p-2.5 rounded-xl shadow-lg shadow-indigo-500/20 animate-[pulse_4s_ease-in-out_infinite]">
                 <BrainCircuit className="w-6 h-6 text-white" strokeWidth={2}/>
               </div>
               <span className="font-bold text-xl tracking-tight">Meteo Toni <span className="text-indigo-400">Ai</span></span>
             </div>
             
             <div className="md:hidden flex gap-2">
                 <button 
                      onClick={() => setUnit(unit === 'C' ? 'F' : 'C')}
                      className="bg-slate-800/50 border border-slate-700/50 text-indigo-300 font-bold p-2 rounded-lg w-10 h-10 flex items-center justify-center active:bg-slate-700 touch-manipulation"
                   >
                     {unit === 'C' ? '°C' : '°F'}
                 </button>
                 <button 
                      onClick={cycleLang}
                      className="bg-slate-800/50 border border-slate-700/50 text-indigo-300 font-bold p-2 rounded-lg w-10 h-10 flex items-center justify-center uppercase text-xs active:bg-slate-700 touch-manipulation"
                      title="Canviar idioma"
                   >
                     <FlagIcon lang={lang} className="w-5 h-4 rounded shadow-sm" />
                 </button>
             </div>
          </div>

          <div className="relative flex-1 md:w-80 hidden md:flex items-center gap-3 md:order-2" ref={searchRefPC}> 
             <div className="relative flex-1">
               <button 
                  className={`absolute left-3 top-3.5 transition-colors ${isSearching ? 'text-indigo-400' : 'text-slate-400 hover:text-white'}`}
                  onClick={executeSearch} 
                  disabled={isSearching}
               >
                 {isSearching ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
               </button>
               
               <input 
                 ref={inputRef}
                 type="text" 
                 placeholder={t.searchPlaceholder} 
                 value={query}
                 onFocus={() => {
                   setShowSuggestions(true);
                   if (query.length === 0) setSuggestions(favorites); 
                 }}
                 onChange={(e) => {setQuery(e.target.value); setShowSuggestions(true);}}
                 onKeyDown={handleKeyDown}
                 className="w-full bg-slate-950/50 border border-slate-700/50 rounded-xl py-3 pl-10 pr-4 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none placeholder-slate-500 transition-all shadow-inner touch-manipulation"
               />
               
               {showSuggestions && (
                 <div ref={suggestionsListRef} className="absolute top-full left-0 right-0 mt-2 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl overflow-hidden z-50 max-h-[60vh] overflow-y-auto custom-scrollbar animate-in slide-in-from-top-2">
                   {query.length === 0 && favorites.length > 0 && (
                     <div className="px-4 py-2 text-xs font-bold text-indigo-400 uppercase tracking-wider bg-slate-950/80 sticky top-0 backdrop-blur-sm">{t.favorites}</div>
                   )}
                   
                   {(query.length === 0 ? favorites : suggestions).map((item, i) => (
                     <button 
                       key={i}
                       type="button" 
                       onMouseDown={(e) => e.preventDefault()} 
                       className={`group w-full px-4 py-4 md:py-3 flex items-center justify-between border-b border-white/5 last:border-0 cursor-pointer transition-colors text-left ${i === activeSuggestionIndex ? 'bg-indigo-600/20 border-l-4 border-l-indigo-500' : 'hover:bg-white/5'}`}
                       onClick={() => cleanupSearch(item.latitude, item.longitude, item.name, item.country)} 
                     >
                       <div className="flex items-center gap-3 pointer-events-none"> 
                         {query.length === 0 ? <Star className="w-5 h-5 text-amber-400 fill-amber-400"/> : <MapPin className="w-5 h-5 text-slate-500"/>}
                         <div className="flex flex-col text-left">
                            <span className="text-base md:text-sm font-medium text-slate-200 group-hover:text-white transition-colors">{item.name}</span>
                            <span className="text-xs text-slate-500">{item.country || item.admin1}</span>
                         </div>
                       </div>
                       
                       {query.length === 0 ? (
                         <div 
                            role="button"
                            onClick={(e) => removeFavorite(e, item.name)}
                            className="p-3 md:p-2 text-slate-600 hover:text-red-400 hover:bg-red-400/10 rounded-full transition-all md:opacity-0 group-hover:opacity-100 focus:opacity-100 touch-manipulation z-20 pointer-events-auto"
                            aria-label="Eliminar favorit"
                         >
                           <Trash2 className="w-5 h-5"/>
                         </div>
                       ) : (
                         i === activeSuggestionIndex && <ArrowRight className="w-4 h-4 text-indigo-400 animate-pulse"/>
                       )}
                     </button>
                   ))}
                 </div>
               )}
             </div>
             <button 
                onClick={handleGetCurrentLocation} 
                className="bg-indigo-600 hover:bg-indigo-500 text-white p-3 rounded-xl transition-colors shadow-lg shadow-indigo-900/20 active:scale-95 touch-manipulation disabled:bg-indigo-800 disabled:cursor-not-allowed shrink-0" 
                title="Utilitza la meva ubicació"
                disabled={isSearching}
             >
                {isSearching ? <RefreshCw className="w-5 h-5 animate-spin" /> : <LocateFixed className="w-5 h-5" />}
             </button>
          </div>

          <div className="flex gap-3 w-full md:w-auto items-center md:order-3 justify-center md:justify-end">
             <div className="flex bg-slate-950/60 p-1 rounded-xl border border-slate-700/50 backdrop-blur-md shadow-inner w-full md:w-auto justify-center md:justify-start">
               <button
                 onClick={() => setViewMode('basic')}
                 className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs md:text-sm font-bold transition-all duration-300 flex-1 md:flex-none justify-center ${
                   viewMode === 'basic' 
                     ? 'bg-indigo-600 text-white shadow-md shadow-indigo-500/20' 
                     : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
                 }`}
               >
                 <LayoutTemplate className="w-4 h-4" />
                 <span className="hidden md:inline">{t.modeBasic}</span>
               </button>
               
               <button
                 onClick={() => setViewMode('expert')}
                 className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs md:text-sm font-bold transition-all duration-300 flex-1 md:flex-none justify-center ${
                   viewMode === 'expert' 
                     ? 'bg-indigo-600 text-white shadow-md shadow-indigo-500/20' 
                     : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
                 }`}
               >
                 <LayoutDashboard className="w-4 h-4" />
                 <span className="hidden md:inline">{t.modeExpert}</span>
               </button>
             </div>

             <button 
                onClick={cycleLang}
                className="hidden md:flex bg-slate-950/50 border border-slate-700/50 text-indigo-300 font-bold p-3 rounded-xl hover:bg-indigo-500 hover:text-white hover:border-indigo-400 transition-all w-12 h-12 items-center justify-center shrink-0 shadow-lg uppercase"
                title="Canviar idioma"
             >
               <FlagIcon lang={lang} className="w-6 h-4 rounded shadow-sm" />
             </button>

             <button 
                onClick={() => setUnit(unit === 'C' ? 'F' : 'C')}
                className="hidden md:flex bg-slate-950/50 border border-slate-700/50 text-indigo-300 font-bold p-3 rounded-xl hover:bg-indigo-500 hover:text-white hover:border-indigo-400 transition-all w-12 h-12 items-center justify-center shrink-0 shadow-lg"
                title="Canviar unitats"
             >
               {unit === 'C' ? '°C' : '°F'}
             </button>
          </div>
          
           <div className="w-full md:hidden flex gap-2 md:order-4">
             <div className="relative flex-1" ref={searchRefMobile}> 
               <button 
                 className={`absolute left-3 top-3.5 transition-colors z-10 p-1 -m-1 ${isSearching ? 'text-indigo-400' : 'text-slate-400 hover:text-white'}`}
                 onClick={executeSearch}
                 disabled={isSearching}
               >
                 {isSearching ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
               </button>
               
               <input 
                 ref={inputRef} 
                 type="text" 
                 placeholder={t.searchPlaceholder} 
                 value={query}
                 onFocus={() => {
                   setShowSuggestions(true);
                   if (query.length === 0) setSuggestions(favorites); 
                 }}
                 onChange={(e) => {setQuery(e.target.value); setShowSuggestions(true);}}
                 onKeyDown={handleKeyDown} 
                 className="w-full bg-slate-950/50 border border-slate-700/50 rounded-xl py-3 pl-10 pr-4 text-sm focus:ring-2 focus:ring-indigo-500 outline-none touch-manipulation"
               />
               {showSuggestions && (
                 <div ref={suggestionsListRef} className="absolute top-full left-0 right-0 mt-2 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl overflow-hidden z-50 max-h-[40vh] overflow-y-auto">
                   
                   {query.length === 0 && favorites.length > 0 && (
                     <div className="px-4 py-2 text-xs font-bold text-indigo-400 uppercase tracking-wider bg-slate-950/80 sticky top-0 backdrop-blur-sm">{t.favorites}</div>
                   )}
                   
                   {(query.length === 0 ? favorites : suggestions).map((item, i) => (
                      <button 
                         key={i} 
                         type="button" 
                         onClick={() => cleanupSearch(item.latitude, item.longitude, item.name, item.country)} 
                         onMouseDown={(e) => e.preventDefault()} 
                         className="group w-full px-4 py-4 flex items-center justify-between border-b border-white/5 last:border-0 cursor-pointer transition-colors active:bg-white/10 hover:bg-white/5 text-left" 
                      >
                         <div className="flex items-center gap-3 pointer-events-none"> 
                           {query.length === 0 ? <Star className="w-5 h-5 text-amber-400 fill-amber-400"/> : <MapPin className="w-5 h-5 text-slate-500"/>}
                           <div className="flex flex-col text-left">
                              <span className="text-base font-medium text-slate-200 group-hover:text-white transition-colors">{item.name}</span>
                              <span className="text-xs text-slate-500">{item.country || item.admin1}</span>
                           </div>
                         </div>
                         {query.length === 0 && ( 
                           <div 
                              role="button"
                              onClick={(e) => removeFavorite(e, item.name)}
                              className="p-2 text-slate-600 hover:text-red-400 hover:bg-red-400/10 rounded-full transition-all focus:opacity-100 touch-manipulation z-20 pointer-events-auto"
                              aria-label="Eliminar favorit"
                           >
                             <Trash2 className="w-5 h-5"/>
                           </div>
                         )}
                      </button>
                   ))}
                 </div>
               )}
             </div>
             <button 
                onClick={handleGetCurrentLocation} 
                className="bg-indigo-600 text-white p-3 rounded-xl active:scale-95 touch-manipulation disabled:bg-indigo-800 disabled:cursor-not-allowed shrink-0"
                disabled={isSearching}
             >
                {isSearching ? <RefreshCw className="w-5 h-5 animate-spin" /> : <LocateFixed className="w-5 h-5" />}
             </button>
           </div>
        </div>

        {loading && !weatherData && (
           <div className="animate-pulse space-y-6">
             <div className="h-64 bg-slate-800/50 rounded-[2.5rem] w-full"></div>
             <div className="grid grid-cols-1 lg:grid-cols-3 gap-6"><div className="grid grid-cols-2 gap-4 h-48"> {[1,2,3,4].map(i => <div key={i} className="bg-slate-800/50 rounded-2xl h-full"></div>)} </div><div className="lg:col-span-2 bg-slate-800/50 rounded-3xl h-48"></div></div>
           </div>
        )}

        {error && !loading && (
           <div className="bg-red-500/10 border border-red-500/20 text-red-200 p-6 rounded-2xl flex items-center justify-center gap-3 animate-in shake">
             <AlertTriangle className="w-6 h-6"/> <span className="font-medium">{error}</span>
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
                 <button onClick={() => setLang('ca')} className={`px-3 py-2 md:px-4 md:py-2 text-sm md:text-base rounded-full border flex items-center gap-2 transition-all ${lang === 'ca' ? 'bg-indigo-600 border-indigo-500 text-white shadow-lg scale-105' : 'border-slate-700 text-slate-400 hover:text-white hover:bg-slate-800'}`}>
                    <FlagIcon lang="ca" className="w-4 h-3 md:w-5 md:h-4 rounded shadow-sm" /> Català
                 </button>
                 <button onClick={() => setLang('es')} className={`px-3 py-2 md:px-4 md:py-2 text-sm md:text-base rounded-full border flex items-center gap-2 transition-all ${lang === 'es' ? 'bg-indigo-600 border-indigo-500 text-white shadow-lg scale-105' : 'border-slate-700 text-slate-400 hover:text-white hover:bg-slate-800'}`}>
                    <FlagIcon lang="es" className="w-4 h-3 md:w-5 md:h-4 rounded shadow-sm" /> Español
                 </button>
                 <button onClick={() => setLang('en')} className={`px-3 py-2 md:px-4 md:py-2 text-sm md:text-base rounded-full border flex items-center gap-2 transition-all ${lang === 'en' ? 'bg-indigo-600 border-indigo-500 text-white shadow-lg scale-105' : 'border-slate-700 text-slate-400 hover:text-white hover:bg-slate-800'}`}>
                    <FlagIcon lang="en" className="w-4 h-3 md:w-5 md:h-4 rounded shadow-sm" /> English
                 </button>
                 <button onClick={() => setLang('fr')} className={`px-3 py-2 md:px-4 md:py-2 text-sm md:text-base rounded-full border flex items-center gap-2 transition-all ${lang === 'fr' ? 'bg-indigo-600 border-indigo-500 text-white shadow-lg scale-105' : 'border-slate-700 text-slate-400 hover:text-white hover:bg-slate-800'}`}>
                    <FlagIcon lang="fr" className="w-4 h-3 md:w-5 md:h-4 rounded shadow-sm" /> Français
                 </button>
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
                      {alert.type === t.snow && <Snowflake className="w-6 h-6" strokeWidth={2.5}/>}
                      {alert.type === t.wind && <Wind className="w-6 h-6" strokeWidth={2.5}/>}
                      {alert.type === t.sun && <ThermometerSun className="w-6 h-6" strokeWidth={2.5}/>}
                      {alert.type === 'Fred' && <ThermometerSnowflake className="w-6 h-6" strokeWidth={2.5}/>}
                      {alert.type === t.rain && <CloudRain className="w-6 h-6" strokeWidth={2.5}/>}
                      {alert.type === t.aqi && <AlertOctagon className="w-6 h-6" strokeWidth={2.5}/>}
                      {!['Tempesta','Neu','Vent','Calor','Fred','Pluja','Qualitat Aire', t.storm, t.snow, t.wind, t.sun, t.rain, t.aqi].includes(alert.type) && <AlertTriangle className="w-6 h-6"/>}
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
                                    <Star className={`w-6 h-6 transition-colors ${isCurrentFavorite ? 'text-amber-400 fill-amber-400' : 'text-slate-600 hover:text-amber-300'}`} />
                                </button>
                           </div>
                           <div className="flex items-center gap-3 text-sm text-indigo-200 font-medium mt-1">
                                <span className="flex items-center gap-1.5"><MapPin className="w-3.5 h-3.5"/> {weatherData.location.country}</span>
                                <span className="w-1 h-1 bg-indigo-500 rounded-full"></span>
                                <span className="flex items-center gap-1.5 text-slate-400"><Clock className="w-3.5 h-3.5"/> {t.localTime}: {shiftedNow.toLocaleTimeString([], {hour: '2-digit', minute: '2-digit'})}</span>
                           </div>
                       </div>

                       {/* --- BLOC SENCER DE LA CAPÇALERA (Icona + Temperatura) --- */}
                       <div className="flex items-center gap-6 mt-2">
                           {/* Icona Animada */}
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
                                     weatherData.current.relative_humidity_2m
                                  )}
                               </LivingIcon>
                           </div>

                           {/* Temperatura i Text */}
                           <div className="flex flex-col justify-center">
                                <span className="text-8xl md:text-9xl font-bold text-white leading-none tracking-tighter drop-shadow-2xl">
                                   {formatTemp(weatherData.current.temperature_2m)}°
                                </span>
                                <span className="text-xl md:text-2xl font-medium text-indigo-200 capitalize mt-2">
   {
      effectiveWeatherCode === 0 ? t.clear : 
      isSnowCode(effectiveWeatherCode) ? t.snow : 
      (effectiveWeatherCode < 4) ? t.cloudy : 
      (effectiveWeatherCode === 45 || effectiveWeatherCode === 48) ? "Boira" : 
      (weatherData.current.relative_humidity_2m >= 95) ? "Boira / Plugim" : 
      t.rainy
   }
</span>
                           </div>
                       </div>
                       {/* --- FI DEL BLOC --- */}

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
                         <BrainCircuit className="w-4 h-4 animate-pulse" strokeWidth={2}/> {t.aiAnalysis}
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
                                {tip.includes(t.tipThermal) || tip.includes('Jaqueta') ? <Shirt className="w-3.5 h-3.5 opacity-70" strokeWidth={2.5}/> : <AlertTriangle className="w-3.5 h-3.5 opacity-70"/>}
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
                                {reliability.level !== 'high' && <div className="absolute inset-0 rounded-full animate-ping opacity-75 bg-current"></div>}
                              </div>
                              
                              <div className="flex flex-col">
                                <span className="text-[10px] font-bold uppercase tracking-widest opacity-70">
                                  {t.rel_title}
                                </span>
                                <span className="text-xs font-medium leading-tight">
                                  {reliability.type === 'ok' && t.rel_high}
                                  {reliability.type === 'general' && t.rel_medium}
                                  {reliability.type === 'rain' && t.rel_low_rain.replace('{diff}', reliability.value)}
                                  {reliability.type === 'temp' && t.rel_low_temp.replace('{diff}', reliability.value)}
                                </span>
                              </div>
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
                     
                     <CircularGauge 
                        icon={<Gauge className="w-6 h-6" strokeWidth={2.5}/>} 
                        label={t.pressure} 
                        value={Math.round(weatherData.current.pressure_msl)} 
                        max={1050} 
                        subText="hPa"
                        color="text-pink-400"
                        trend={barometricTrend.trend}
                        trendLabel={
                            barometricTrend.trend === 'rising' ? t.pressureRising :
                            barometricTrend.trend === 'falling' ? t.pressureFalling : t.pressureSteady
                        }
                     />
                     
                     <DewPointWidget 
                        value={currentDewPoint} 
                        humidity={weatherData.current.relative_humidity_2m}
                        lang={lang} 
                        unit={unit} 
                     />
                     
                     <div className="col-span-1">
                        <CapeWidget cape={currentCape} lang={lang} />
                     </div>

                     <div className="col-span-2 md:col-span-2">
                        <SunArcWidget 
                          sunrise={weatherData.daily.sunrise[0]} 
                          sunset={weatherData.daily.sunset[0]} 
                          lang={lang}
                          shiftedNow={shiftedNow}
                        />
                     </div>

                     <div className="col-span-2 md:col-span-2">
                        <MoonWidget 
                          phase={moonPhaseVal} 
                          lat={weatherData.location.latitude} 
                          lang={lang}
                        />
                     </div>
                     
                     <div className="col-span-2 md:col-span-2">
                        <PollenWidget data={aqiData?.current} lang={lang} />
                     </div>
                  </div>

                  <div className="lg:col-span-2 flex flex-col gap-6">
                      
                      {sevenDayForecastSection}

                      <div className="bg-slate-900/40 border border-white/10 rounded-3xl p-4 md:p-6 relative overflow-hidden backdrop-blur-sm flex flex-col shadow-xl">
                        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 z-10 gap-4">
                          <h3 className="font-bold text-white flex items-center gap-2"><TrendingUp className="w-4 h-4 text-indigo-400 drop-shadow-sm fill-indigo-400/20" strokeWidth={2.5}/> {t.trend24h}</h3>
                        </div>
                        
                        <HourlyForecastChart data={chartData} comparisonData={comparisonData} unit={getUnitLabel()} lang={lang} shiftedNow={shiftedNow} />

                        <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-10 pointer-events-none"></div>
                      </div>
                  </div>

                </div>
              </div>
            )}
            
            {viewMode === 'basic' && (
              <>
               <div className="bg-slate-900/40 border border-white/10 rounded-3xl p-6 backdrop-blur-sm shadow-xl mb-6">
                 <h3 className="font-bold text-white flex items-center gap-2"><Clock className="w-4 h-4 text-indigo-400 drop-shadow-sm fill-indigo-400/20" strokeWidth={2.5}/> {t.hourlyEvolution} (24h)</h3>
                 <div className="flex gap-4 overflow-x-auto pb-2 custom-scrollbar">
                    {chartData.filter((_, i) => i % 3 === 0).map((h, i) => (
                       <div key={i} className="flex flex-col items-center min-w-[3rem]">
                          <span className="text-xs text-slate-400">{new Date(h.time).getHours()}h</span>
                          <div className="my-1 scale-75 filter drop-shadow-sm">{getWeatherIcon(h.code, "w-8 h-8", h.isDay, h.rain, h.wind, h.humidity)}</div>
                          <span className="text-sm font-bold">{Math.round(h.temp)}°</span>
                          <div className="flex flex-col items-center mt-1 h-6 justify-start">
                             {h.rain > 0 && <span className="text-[10px] text-blue-400 font-bold">{h.rain}%</span>}
                             {h.precip > 0.25 && <span className="text-[9px] text-cyan-400 font-bold">{h.precip}mm</span>}
                          </div>
                       </div>
                    ))}
                 </div>
               </div>

               {sevenDayForecastSection}
              </>
            )}

<div className="w-full py-8 mt-8 text-center border-t border-white/5">
              <p className="text-xs text-slate-500 font-medium tracking-wider uppercase opacity-70 hover:opacity-100 transition-opacity">
                © {new Date().getFullYear()} Meteo Toni Ai
              </p>
            </div>
          </div>
        )}

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

      </div>
    </div>
  );
}