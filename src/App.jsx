import React, { useState, useEffect, useRef, useMemo } from 'react';
import { 
  Search, Wind, Droplets, MapPin, Sun, Cloud, CloudRain, 
  CloudLightning, Snowflake, CloudFog, CloudSun, BrainCircuit, 
  Activity, AlertTriangle, X, Sunrise, Sunset, Umbrella, Eye,
  LocateFixed, Shirt, Leaf, Star, RefreshCw, Trash2, Navigation,
  ThermometerSun, Gauge, ArrowRight, AlertOctagon, TrendingUp, Calendar, Clock,
  Layers, ThermometerSnowflake, AlertCircle
} from 'lucide-react';

// --- Subcomponent Efecte Escriptura ---
const TypewriterText = ({ text }) => {
  const [displayedText, setDisplayedText] = useState('');
  
  useEffect(() => {
    setDisplayedText('');
    let i = 0;
    const timer = setInterval(() => {
      if (i < text.length) {
        setDisplayedText((prev) => prev + text.charAt(i));
        i++;
      } else {
        clearInterval(timer);
      }
    }, 20); 
    return () => clearInterval(timer);
  }, [text]);

  return <p className="text-slate-200 font-medium leading-relaxed text-sm md:text-base min-h-[3em]">{displayedText}</p>;
};

// --- COMPONENT: BARRA DE RANG TÈRMIC ---
const TempRangeBar = ({ min, max, globalMin, globalMax, displayMin, displayMax }) => {
  const totalRange = globalMax - globalMin || 1;
  const safeMin = Math.max(min, globalMin);
  const safeMax = Math.min(max, globalMax);
  
  const leftPct = ((safeMin - globalMin) / totalRange) * 100;
  const widthPct = ((safeMax - safeMin) / totalRange) * 100;

  return (
    <div className="flex items-center gap-3 w-full max-w-[12rem] md:max-w-[16rem]">
      <span className="text-xs text-slate-400 w-8 text-right font-medium tabular-nums">{displayMin}°</span>
      <div className="flex-1 h-1.5 bg-slate-700/50 rounded-full relative overflow-hidden">
        <div 
          className="absolute h-full rounded-full bg-gradient-to-r from-cyan-400 via-indigo-400 to-amber-400 opacity-90"
          style={{ left: `${leftPct}%`, width: `${widthPct}%`, minWidth: '6px' }}
        />
      </div>
      <span className="text-xs text-white w-8 text-left font-bold tabular-nums">{displayMax}°</span>
    </div>
  )
};

// --- COMPONENT: GRÀFICA SVG SUAVITZADA MULTICAPA ---
const HourlyForecastChart = ({ data, layer, unit }) => {
  if (!data || data.length === 0) return null;

  // Configuració per cada capa
  const layersConfig = {
    temp: { key: 'temp', color: '#818cf8', gradientStart: '#818cf8', unit: unit }, // Indigo
    rain: { key: 'rain', color: '#3b82f6', gradientStart: '#3b82f6', unit: '%' }, // Blue
    wind: { key: 'wind', color: '#2dd4bf', gradientStart: '#2dd4bf', unit: ' km/h' } // Teal
  };

  const currentConfig = layersConfig[layer] || layersConfig.temp;
  const dataKey = currentConfig.key;

  const height = 180;
  const width = 800;
  const paddingX = 20;
  const paddingY = 40;

  const values = data.map(d => d[dataKey]);
  let minVal = Math.min(...values);
  let maxVal = Math.max(...values);

  if (layer === 'rain') {
    minVal = 0;
    maxVal = 100;
  } else if (layer === 'wind') {
    minVal = 0; 
    maxVal = Math.max(maxVal, 20);
  } else {
    minVal -= 2;
    maxVal += 2;
  }
  
  const range = maxVal - minVal || 1;

  const points = data.map((d, i) => {
    const x = paddingX + (i / (data.length - 1)) * (width - 2 * paddingX);
    const val = d[dataKey];
    const y = height - paddingY - ((val - minVal) / range) * (height - 2 * paddingY);
    return { x, y, value: val, ...d };
  });

  const buildSmoothPath = (pts) => {
    if (pts.length === 0) return "";
    let d = `M ${pts[0].x},${pts[0].y}`;
    for (let i = 0; i < pts.length - 1; i++) {
      const p0 = pts[i];
      const p1 = pts[i + 1];
      const cx = (p0.x + p1.x) / 2;
      d += ` C ${cx},${p0.y} ${cx},${p1.y} ${p1.x},${p1.y}`;
    }
    return d;
  };

  const linePath = buildSmoothPath(points);
  const areaPath = `${linePath} L ${width - paddingX},${height} L ${paddingX},${height} Z`;

  const [hoverData, setHoverData] = useState(null);

  return (
    <div className="w-full overflow-x-auto custom-scrollbar relative group">
      <div className="min-w-[600px] md:min-w-full relative">
        <svg 
          viewBox={`0 0 ${width} ${height}`} 
          className="w-full h-auto drop-shadow-xl transition-all duration-500"
          preserveAspectRatio="none"
          onMouseLeave={() => setHoverData(null)}
        >
          <defs>
            <linearGradient id={`gradient-${layer}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={currentConfig.gradientStart} stopOpacity="0.5" />
              <stop offset="100%" stopColor={currentConfig.gradientStart} stopOpacity="0" />
            </linearGradient>
          </defs>
          
          <line x1={paddingX} y1={height - paddingY} x2={width - paddingX} y2={height - paddingY} stroke="rgba(255,255,255,0.1)" strokeWidth="1" />
          <path d={areaPath} fill={`url(#gradient-${layer})`} className="transition-all duration-500" />
          <path d={linePath} fill="none" stroke={currentConfig.color} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="transition-all duration-500" />

          {points.map((p, i) => (
            <g key={i} onMouseEnter={() => setHoverData(p)}>
              <rect x={p.x - (width / points.length / 2)} y={0} width={width / points.length} height={height} fill="transparent" className="cursor-crosshair"/>
              <circle 
                 cx={p.x} cy={p.y} r="4" 
                 fill={currentConfig.color} 
                 className={`opacity-0 group-hover:opacity-100 transition-opacity duration-200 ${hoverData === p ? 'opacity-100 scale-125' : ''}`} 
                 stroke="white" strokeWidth="2"
              />
              {(i % (points.length > 12 ? 3 : 1) === 0) && (
                <text x={p.x} y={height - 10} textAnchor="middle" fill="#94a3b8" fontSize="12">{new Date(p.time).getHours()}h</text>
              )}
            </g>
          ))}

          {hoverData && (
            <g>
              <line x1={hoverData.x} y1={0} x2={hoverData.x} y2={height - paddingY} stroke="white" strokeWidth="1" strokeDasharray="4 4" opacity="0.3" />
              <rect x={hoverData.x - 35} y={hoverData.y - 50} width="70" height="40" rx="8" fill="#0f172a" stroke={currentConfig.color} strokeWidth="1.5" />
              <text x={hoverData.x} y={hoverData.y - 25} textAnchor="middle" fill="white" fontSize="14" fontWeight="bold">
                {Math.round(hoverData.value)}{currentConfig.unit}
              </text>
            </g>
          )}
        </svg>
      </div>
    </div>
  );
};

// --- COMPONENT: CIRCULAR GAUGE ---
const CircularGauge = ({ value, max = 100, label, icon, color = "text-indigo-500", subText }) => {
  const radius = 30;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (Math.min(value, max) / max) * circumference;

  return (
    <div className="bg-slate-900/60 border border-slate-800/50 p-4 rounded-2xl flex flex-col items-center justify-center backdrop-blur-sm relative group h-full">
      <div className="relative w-24 h-24 flex items-center justify-center">
         <svg className="w-full h-full transform -rotate-90">
            <circle cx="50%" cy="50%" r={radius} stroke="currentColor" strokeWidth="6" fill="transparent" className="text-slate-800" />
            <circle 
              cx="50%" cy="50%" r={radius} 
              stroke="currentColor" strokeWidth="6" fill="transparent" 
              strokeDasharray={circumference} 
              strokeDashoffset={strokeDashoffset} 
              strokeLinecap="round"
              className={`${color} transition-all duration-1000 ease-out`}
            />
         </svg>
         <div className="absolute inset-0 flex flex-col items-center justify-center">
            <div className={`mb-1 ${color}`}>{icon}</div>
            <span className="text-sm font-bold text-white">{value}</span>
         </div>
      </div>
      <div className="text-xs text-slate-400 font-medium uppercase tracking-wider mt-2">{label}</div>
      {subText && <div className="text-[10px] text-slate-500 mt-1">{subText}</div>}
    </div>
  );
};

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
  const [unit, setUnit] = useState('C');
  const [activeChartLayer, setActiveChartLayer] = useState('temp');
  const searchRef = useRef(null);
  const inputRef = useRef(null);

  // --- Inicialització Favorits ---
  useEffect(() => {
    const savedFavs = localStorage.getItem('meteoia-favs');
    if (savedFavs) {
      setFavorites(JSON.parse(savedFavs));
    }
  }, []);

  const saveFavorites = (newFavs) => {
    setFavorites(newFavs);
    localStorage.setItem('meteoia-favs', JSON.stringify(newFavs));
  };

  const toggleFavorite = () => {
    if (!weatherData) return;
    const currentLoc = weatherData.location;
    const isFav = favorites.some(f => f.name === currentLoc.name);
    
    let newFavs;
    if (isFav) {
      newFavs = favorites.filter(f => f.name !== currentLoc.name);
    } else {
      newFavs = [...favorites, currentLoc];
    }
    saveFavorites(newFavs);
  };

  const removeFavorite = (e, name) => {
    e.stopPropagation();
    const newFavs = favorites.filter(f => f.name !== name);
    saveFavorites(newFavs);
  };

  const isCurrentFavorite = weatherData && favorites.some(f => f.name === weatherData.location.name);

  // --- Helpers ---
  const formatTemp = (tempC) => {
    if (unit === 'F') return Math.round((tempC * 9/5) + 32);
    return Math.round(tempC);
  };

  const getUnitLabel = () => unit === 'F' ? '°F' : '°C';

  // --- Logic for Snow vs Rain ---
  const isSnowCode = (code) => {
    // 71-77: Neu, 85-86: Ruixats neu, 56-57/66-67: Gelades
    return (code >= 71 && code <= 77) || code === 85 || code === 86;
  };

  // --- Visuals ---
  const getWeatherIcon = (code, className = "w-6 h-6") => {
    if (code === 0) return <Sun className={`${className} text-yellow-400 animate-[spin_12s_linear_infinite]`} />;
    if (code >= 1 && code <= 3) return <CloudSun className={`${className} text-orange-300 animate-pulse`} />;
    if (code >= 45 && code <= 48) return <CloudFog className={`${className} text-gray-400 animate-pulse`} />;
    if (code >= 51 && code <= 67) return <CloudRain className={`${className} text-blue-400 animate-bounce`} />;
    if (code >= 71 && code <= 77) return <Snowflake className={`${className} text-cyan-200 animate-[spin_3s_linear_infinite]`} />; // Snow
    if (code >= 85 && code <= 86) return <Snowflake className={`${className} text-cyan-200 animate-pulse`} />; // Snow Showers
    if (code >= 95) return <CloudLightning className={`${className} text-purple-400 animate-pulse`} />;
    return <Cloud className={`${className} text-gray-300 animate-[pulse_4s_ease-in-out_infinite]`} />;
  };

  const getDynamicBackground = (code, isDay = 1) => {
    if (!weatherData) return "from-slate-900 via-slate-900 to-indigo-950";
    if (code >= 95) return "from-slate-900 via-slate-950 to-purple-950"; // Tempesta
    if (isSnowCode(code)) return "from-slate-800 via-slate-700 to-cyan-950"; // Neu
    if (code >= 51) return "from-slate-800 via-slate-900 to-blue-950"; // Pluja
    if (code === 0 && isDay) return "from-blue-500 via-blue-400 to-orange-300"; // Sol dia
    if (code === 0 && !isDay) return "from-slate-950 via-indigo-950 to-purple-950"; // Nit clara
    if (code <= 3 && isDay) return "from-slate-700 via-slate-600 to-blue-800"; // Ennuvolat
    return "from-slate-900 to-indigo-950";
  };

  // --- Lògica "IA" millorada amb AVISOS ---
  const generateAIPrediction = (current, daily, hourly, aqiValue) => {
    const feelsLike = current.apparent_temperature;
    const rainProb = daily.precipitation_probability_max[0];
    const windSpeed = current.wind_speed_10m;
    const code = current.weather_code;
    const maxTemp = daily.temperature_2m_max[0];
    const minTemp = daily.temperature_2m_min[0];
    
    let summary = "";
    let tips = [];
    let confidence = "Alta";
    let alerts = []; // Llista d'avisos meteorològics

    // Text generatiu base
    if (code === 0) summary = "Cel serè i condicions òptimes. Aprofita per sortir! ";
    else if (code < 4) summary = "Intervals de núvols passatgers sense complicacions. ";
    else if (code >= 95) { summary = "Tempesta elèctrica. Busca refugi. "; }
    else if (isSnowCode(code)) { summary = "Previsió de neu. "; }
    else if (code >= 51) summary = "Possibilitat de precipitacions. ";
    else summary = "Temps inestable. ";

    // Generació d'Avisos Específics
    if (code >= 95) alerts.push({ type: 'Tempesta', msg: 'Risc elèctric elevat i pluges intenses.', level: 'high' });
    if (isSnowCode(code)) alerts.push({ type: 'Neu', msg: 'Precaució: Neu i gel a la calçada.', level: 'high', tips: "Cadenes" });
    
    if (windSpeed > 80) alerts.push({ type: 'Vent', msg: `Vent molt fort (${Math.round(windSpeed)} km/h). Perill.`, level: 'high' });
    else if (windSpeed > 50) alerts.push({ type: 'Vent', msg: `Ràfegues fortes (${Math.round(windSpeed)} km/h).`, level: 'warning' });

    if (maxTemp > 38) alerts.push({ type: 'Calor', msg: 'Calor extrema. Perill de cop de calor.', level: 'high' });
    else if (maxTemp > 32) alerts.push({ type: 'Calor', msg: 'Temperatures altes. Hidrata\'t.', level: 'warning' });

    if (minTemp < -5) alerts.push({ type: 'Fred', msg: 'Fred extrem. Risc d\'hipotèrmia.', level: 'high' });
    else if (minTemp < 0) alerts.push({ type: 'Fred', msg: 'Glaçades. Compte al conduir.', level: 'warning' });

    if (rainProb > 80 && code >= 61) alerts.push({ type: 'Pluja', msg: 'Precipitacions abundants.', level: 'warning' });
    if (aqiValue > 150) alerts.push({ type: 'Qualitat Aire', msg: 'Aire molt perjudicial. Evita exterior.', level: 'high' });

    // Tips generats
    if (feelsLike > 32) tips.push("Hidratació");
    if (feelsLike < 5) tips.push("Roba tèrmica");
    if (rainProb > 50 && !isSnowCode(code)) tips.push("Paraigua");
    if (alerts.length === 0) tips.push("Dia tranquil");

    // Deduplicate tips
    tips = [...new Set(tips)].slice(0, 4);

    return { text: summary, tips, confidence, alerts };
  };

  // --- API ---
  useEffect(() => {
    const timer = setTimeout(async () => {
      if (query.length > 2 && showSuggestions) {
        try {
          const res = await fetch(
            `https://geocoding-api.open-meteo.com/v1/search?name=${query}&count=5&language=ca&format=json`
          );
          const data = await res.json();
          setSuggestions(data.results || []);
          setActiveSuggestionIndex(-1); 
        } catch (e) { console.error(e); }
      } else if (query.length === 0) {
         setSuggestions(favorites);
         setActiveSuggestionIndex(-1);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [query, showSuggestions, favorites]);

  const handleKeyDown = (e) => {
    if (!showSuggestions) return;
    const list = query.length === 0 ? favorites : suggestions;
    if (list.length === 0) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveSuggestionIndex(prev => (prev < list.length - 1 ? prev + 1 : 0));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveSuggestionIndex(prev => (prev > 0 ? prev - 1 : list.length - 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (activeSuggestionIndex >= 0 && activeSuggestionIndex < list.length) {
        const item = list[activeSuggestionIndex];
        fetchWeatherByCoords(item.latitude, item.longitude, item.name, item.country);
        inputRef.current?.blur();
      }
    } else if (e.key === 'Escape') {
      setShowSuggestions(false);
    }
  };

  const handleGetCurrentLocation = () => {
    if (navigator.geolocation) {
      setLoading(true);
      navigator.geolocation.getCurrentPosition(
        (position) => {
          fetchWeatherByCoords(position.coords.latitude, position.coords.longitude, "La teva ubicació");
        },
        (error) => {
          setError("No s'ha pogut obtenir la ubicació.");
          setLoading(false);
        }
      );
    } else {
      setError("Geolocalització no suportada.");
    }
  };

  const fetchWeatherByCoords = async (lat, lon, name, country = "") => {
    setLoading(true);
    setError(null);
    setAiAnalysis(null);
    setSuggestions([]);
    setShowSuggestions(false);
    setQuery(""); 
    
    try {
      const weatherRes = await fetch(
        `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,is_day,apparent_temperature,weather_code,wind_speed_10m,wind_direction_10m,pressure_msl&hourly=temperature_2m,precipitation_probability,weather_code,wind_speed_10m&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,sunrise,sunset,uv_index_max,wind_speed_10m_max&timezone=auto&models=best_match`
      );
      
      const aqiRes = await fetch(
        `https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${lat}&longitude=${lon}&current=european_aqi`
      );

      if (!weatherRes.ok) throw new Error("Error connectant amb el satèl·lit");
      
      const data = await weatherRes.json();
      const aqiData = await aqiRes.json();
      
      const analysis = generateAIPrediction(data.current, data.daily, data.hourly, aqiData?.current?.european_aqi || 0);
      
      setTimeout(() => setAiAnalysis(analysis), 800); 
      setWeatherData({ ...data, location: { name, country, latitude: lat, longitude: lon } });
      setAqiData(aqiData);

    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const chartData = useMemo(() => {
    if (!weatherData) return [];
    
    const currentHour = new Date().getHours();
    const now = new Date();
    const foundIndex = weatherData.hourly.time.findIndex(t => new Date(t) > now);
    let startIndex = 0;
    if (foundIndex !== -1) startIndex = Math.max(0, foundIndex - 1);

    return weatherData.hourly.temperature_2m.slice(startIndex, startIndex + 24).map((temp, i) => ({
      temp: unit === 'F' ? Math.round((temp * 9/5) + 32) : temp,
      rain: weatherData.hourly.precipitation_probability[startIndex + i],
      wind: weatherData.hourly.wind_speed_10m[startIndex + i],
      time: weatherData.hourly.time[startIndex + i],
      code: weatherData.hourly.weather_code[startIndex + i]
    }));
  }, [weatherData, unit]);

  const weeklyExtremes = useMemo(() => {
    if(!weatherData) return { min: 0, max: 100 };
    return {
      min: Math.min(...weatherData.daily.temperature_2m_min),
      max: Math.max(...weatherData.daily.temperature_2m_max)
    };
  }, [weatherData]);

  useEffect(() => {
    function handleClickOutside(event) {
      if (searchRef.current && !searchRef.current.contains(event.target)) {
        setShowSuggestions(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // --- MODAL DETALL DIA ---
  const DayDetailModal = () => {
    if (selectedDayIndex === null || !weatherData) return null;
    const dayIdx = selectedDayIndex;
    const dateStr = weatherData.daily.time[dayIdx];

    const startHour = dayIdx * 24;
    const endHour = startHour + 24;
    
    const dayHourlyData = weatherData.hourly.temperature_2m.slice(startHour, endHour).map((temp, i) => ({
      temp: unit === 'F' ? Math.round((temp * 9/5) + 32) : temp,
      rain: weatherData.hourly.precipitation_probability[startHour + i],
      wind: weatherData.hourly.wind_speed_10m[startHour + i],
      time: weatherData.hourly.time[startHour + i],
      code: weatherData.hourly.weather_code[startHour + i]
    }));

    const [modalLayer, setModalLayer] = useState('temp');
    
    // Check if this day is a snow day
    const isTodaySnow = isSnowCode(weatherData.daily.weather_code[dayIdx]);

    return (
      <div className="fixed inset-0 z-[100] flex items-end md:items-center justify-center p-0 md:p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200" onClick={() => setSelectedDayIndex(null)}>
        <div 
          className="bg-slate-900 border-t md:border border-slate-700 w-full max-w-2xl rounded-t-3xl md:rounded-3xl shadow-2xl overflow-hidden animate-in slide-in-from-bottom duration-300 max-h-[90vh] overflow-y-auto"
          onClick={e => e.stopPropagation()}
        >
          <div className="md:hidden w-full flex justify-center pt-3 pb-1">
             <div className="w-12 h-1.5 bg-slate-700 rounded-full"></div>
          </div>

          <div className="bg-slate-800/50 p-6 flex justify-between items-center border-b border-slate-700 sticky top-0 backdrop-blur-md z-20">
            <div>
              <h3 className="text-xl font-bold text-white capitalize">
                {new Intl.DateTimeFormat('ca-ES', { weekday: 'long', day: 'numeric', month: 'long' }).format(new Date(dateStr))}
              </h3>
              <p className="text-xs text-slate-400">Previsió detallada</p>
            </div>
            <button onClick={() => setSelectedDayIndex(null)} className="p-2 hover:bg-slate-700 rounded-full text-white transition-colors">
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="p-6 space-y-6">
            <div className="bg-slate-950/30 rounded-2xl p-4 border border-white/5">
              <div className="flex items-center justify-between mb-4">
                 <div className="flex items-center gap-2 text-sm font-bold text-slate-300">
                   <Clock className="w-4 h-4 text-indigo-400"/> Evolució Horària
                 </div>
                 <div className="flex bg-slate-800/50 rounded-lg p-0.5">
                   <button onClick={() => setModalLayer('temp')} className={`px-2 py-1 rounded text-xs font-bold transition-all ${modalLayer === 'temp' ? 'bg-indigo-500 text-white shadow-sm' : 'text-slate-400 hover:text-white'}`}>Temp</button>
                   <button onClick={() => setModalLayer('rain')} className={`px-2 py-1 rounded text-xs font-bold transition-all ${modalLayer === 'rain' ? 'bg-blue-500 text-white shadow-sm' : 'text-slate-400 hover:text-white'}`}>Pluja</button>
                   <button onClick={() => setModalLayer('wind')} className={`px-2 py-1 rounded text-xs font-bold transition-all ${modalLayer === 'wind' ? 'bg-teal-500 text-white shadow-sm' : 'text-slate-400 hover:text-white'}`}>Vent</button>
                 </div>
              </div>
              <HourlyForecastChart data={dayHourlyData} layer={modalLayer} unit={getUnitLabel()} />
            </div>

            <div className="grid grid-cols-2 gap-4">
              {isTodaySnow ? (
                <DetailStat label="Risc de Neu" value={`${weatherData.daily.precipitation_probability_max[dayIdx]}%`} icon={<Snowflake className="w-4 h-4 text-cyan-300"/>} />
              ) : (
                <DetailStat label="Pluja Màx" value={`${weatherData.daily.precipitation_probability_max[dayIdx]}%`} icon={<Umbrella className="w-4 h-4 text-blue-400"/>} />
              )}
              <DetailStat label="Vent Màx" value={`${weatherData.daily.wind_speed_10m_max[dayIdx]} km/h`} icon={<Wind className="w-4 h-4 text-teal-400"/>} />
              <DetailStat label="Índex UV" value={weatherData.daily.uv_index_max[dayIdx]} icon={<Sun className="w-4 h-4 text-amber-400"/>} />
              <DetailStat label="Temp Mín" value={`${formatTemp(weatherData.daily.temperature_2m_min[dayIdx])}${getUnitLabel()}`} icon={<Activity className="w-4 h-4 text-indigo-400"/>} />
              <DetailStat label="Sortida Sol" value={new Date(weatherData.daily.sunrise[dayIdx]).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})} icon={<Sunrise className="w-4 h-4 text-orange-400"/>} />
              <DetailStat label="Posta Sol" value={new Date(weatherData.daily.sunset[dayIdx]).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})} icon={<Sunset className="w-4 h-4 text-purple-400"/>} />
            </div>
          </div>
        </div>
      </div>
    );
  };

  const currentBg = weatherData 
    ? getDynamicBackground(weatherData.current.weather_code, weatherData.current.is_day)
    : "from-slate-900 to-indigo-950";

  // Check if today is snow for the main dashboard metrics
  const isTodaySnow = weatherData && isSnowCode(weatherData.current.weather_code);

  return (
    <div className={`min-h-screen bg-gradient-to-br ${currentBg} text-slate-100 font-sans p-4 md:p-6 transition-all duration-1000 selection:bg-indigo-500 selection:text-white`}>
      <div className="max-w-5xl mx-auto space-y-6 pb-20 md:pb-0">
        
        {/* HEADER & SEARCH */}
        <div className="bg-slate-900/60 p-4 rounded-2xl border border-white/10 backdrop-blur-md flex flex-col md:flex-row gap-4 items-center justify-between sticky top-2 z-50 shadow-xl">
          <div className="flex items-center gap-3 select-none w-full md:w-auto justify-between md:justify-start">
             <div className="flex items-center gap-3">
               <div className="bg-gradient-to-tr from-indigo-600 to-purple-600 p-2.5 rounded-xl shadow-lg shadow-indigo-500/20 animate-[pulse_4s_ease-in-out_infinite]">
                 <BrainCircuit className="w-6 h-6 text-white"/>
               </div>
               <span className="font-bold text-xl tracking-tight">Meteo<span className="text-indigo-400">AI</span> Pro</span>
             </div>
             <button 
                  onClick={() => setUnit(unit === 'C' ? 'F' : 'C')}
                  className="md:hidden bg-slate-800/50 border border-slate-700/50 text-indigo-300 font-bold p-2 rounded-lg w-10 h-10 flex items-center justify-center"
               >
                 {unit === 'C' ? '°C' : '°F'}
             </button>
          </div>

          <div className="flex gap-3 w-full md:w-auto items-center" ref={searchRef}>
             <button 
                onClick={() => setUnit(unit === 'C' ? 'F' : 'C')}
                className="hidden md:flex bg-slate-950/50 border border-slate-700/50 text-indigo-300 font-bold p-3 rounded-xl hover:bg-indigo-500 hover:text-white hover:border-indigo-400 transition-all w-12 h-12 items-center justify-center shrink-0 shadow-lg"
                title="Canviar unitats"
             >
               {unit === 'C' ? '°C' : '°F'}
             </button>

             <div className="relative flex-1 md:w-80">
               <Search className="absolute left-3 top-3.5 w-4 h-4 text-slate-400" />
               <input 
                 ref={inputRef}
                 type="text" 
                 placeholder="Cerca ciutat..." 
                 value={query}
                 onFocus={() => setShowSuggestions(true)}
                 onChange={(e) => {setQuery(e.target.value); setShowSuggestions(true);}}
                 onKeyDown={handleKeyDown}
                 className="w-full bg-slate-950/50 border border-slate-700/50 rounded-xl py-3 pl-10 pr-4 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none placeholder-slate-500 transition-all shadow-inner touch-manipulation"
               />
               
               {showSuggestions && (
                 <div className="absolute top-full left-0 right-0 mt-2 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl overflow-hidden z-50 max-h-[60vh] overflow-y-auto custom-scrollbar animate-in slide-in-from-top-2">
                   {suggestions.length === 0 && query.length === 0 && favorites.length > 0 && (
                     <div className="px-4 py-2 text-xs font-bold text-indigo-400 uppercase tracking-wider bg-slate-950/80 sticky top-0 backdrop-blur-sm">Llocs Preferits</div>
                   )}
                   {(query.length === 0 ? favorites : suggestions).map((item, i) => (
                     <div
                       key={i}
                       className={`group w-full px-4 py-4 md:py-3 flex items-center justify-between border-b border-white/5 last:border-0 cursor-pointer transition-colors active:bg-white/10 ${i === activeSuggestionIndex ? 'bg-indigo-600/20 border-l-4 border-l-indigo-500' : 'hover:bg-white/5'}`}
                       onClick={() => fetchWeatherByCoords(item.latitude, item.longitude, item.name, item.country)}
                     >
                       <div className="flex items-center gap-3">
                         {query.length === 0 ? <Star className="w-5 h-5 text-amber-400 fill-amber-400"/> : <MapPin className="w-5 h-5 text-slate-500"/>}
                         <div className="flex flex-col text-left">
                            <span className="text-base md:text-sm font-medium text-slate-200 group-hover:text-white transition-colors">{item.name}</span>
                            <span className="text-xs text-slate-500">{item.country || item.admin1}</span>
                         </div>
                       </div>
                       
                       {query.length === 0 ? (
                         <button 
                            onClick={(e) => removeFavorite(e, item.name)}
                            className="p-3 md:p-2 text-slate-600 hover:text-red-400 hover:bg-red-400/10 rounded-full transition-all md:opacity-0 group-hover:opacity-100 focus:opacity-100 touch-manipulation"
                            aria-label="Eliminar favorit"
                         >
                           <Trash2 className="w-5 h-5"/>
                         </button>
                       ) : (
                         i === activeSuggestionIndex && <ArrowRight className="w-4 h-4 text-indigo-400 animate-pulse"/>
                       )}
                     </div>
                   ))}
                 </div>
               )}
             </div>
             <button onClick={handleGetCurrentLocation} className="bg-indigo-600 hover:bg-indigo-500 text-white p-3 rounded-xl transition-colors shadow-lg shadow-indigo-900/20 active:scale-95 touch-manipulation" title="Utilitza la meva ubicació">
                <LocateFixed className="w-5 h-5" />
             </button>
          </div>
        </div>

        {/* LOADING */}
        {loading && (
           <div className="animate-pulse space-y-6">
             <div className="h-64 bg-slate-800/50 rounded-[2.5rem] w-full"></div>
             <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="grid grid-cols-2 gap-4 h-48"> {[1,2,3,4].map(i => <div key={i} className="bg-slate-800/50 rounded-2xl h-full"></div>)} </div>
                <div className="lg:col-span-2 bg-slate-800/50 rounded-3xl h-48"></div>
             </div>
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
                <CloudSun className="w-16 h-16 text-indigo-400 animate-pulse" />
              </div>
              <h2 className="text-3xl font-bold text-white mb-3">Meteo Toni AI Pro</h2>
              <p className="text-slate-400 max-w-md mx-auto">La previsió meteorològica reinventada amb Intel·ligència Artificial.</p>
           </div>
        )}

        {/* MAIN DASHBOARD */}
        {!loading && weatherData && (
          <div className="animate-in slide-in-from-bottom-8 duration-700 space-y-6">
            
            {/* ALERT BANNERS SYSTEM */}
            {aiAnalysis?.alerts?.length > 0 && (
              <div className="space-y-3">
                {aiAnalysis.alerts.map((alert, i) => (
                  <div 
                    key={i} 
                    className={`${alert.level === 'high' ? 'bg-red-500/20 border-red-500/40 text-red-100' : 'bg-amber-500/20 border-amber-500/40 text-amber-100'} p-4 rounded-2xl flex items-center gap-4 animate-in slide-in-from-top-2 duration-500 shadow-lg`}
                    style={{animationDelay: `${i*100}ms`}}
                  >
                    <div className={`p-2 rounded-full ${alert.level === 'high' ? 'bg-red-500/20' : 'bg-amber-500/20'}`}>
                      {alert.type === 'Tempesta' && <CloudLightning className="w-6 h-6"/>}
                      {alert.type === 'Neu' && <Snowflake className="w-6 h-6"/>}
                      {alert.type === 'Vent' && <Wind className="w-6 h-6"/>}
                      {alert.type === 'Calor' && <ThermometerSun className="w-6 h-6"/>}
                      {alert.type === 'Fred' && <ThermometerSnowflake className="w-6 h-6"/>}
                      {alert.type === 'Pluja' && <CloudRain className="w-6 h-6"/>}
                      {alert.type === 'Qualitat Aire' && <AlertOctagon className="w-6 h-6"/>}
                      {!['Tempesta','Neu','Vent','Calor','Fred','Pluja','Qualitat Aire'].includes(alert.type) && <AlertTriangle className="w-6 h-6"/>}
                    </div>
                    
                    <div className="flex flex-col">
                      <div className="flex items-center gap-2">
                        <span className={`font-bold uppercase tracking-wider text-xs ${alert.level === 'high' ? 'text-red-400' : 'text-amber-400'} border ${alert.level === 'high' ? 'border-red-500/50' : 'border-amber-500/50'} px-2 py-0.5 rounded-md`}>
                           {alert.level === 'high' ? 'ALERTA PERILL' : 'AVÍS PRECAUCIÓ'}
                        </span>
                        <span className="font-bold text-sm">{alert.type}</span>
                      </div>
                      <span className="font-medium text-sm mt-1 opacity-90">{alert.msg}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* TOP CARD */}
            <div className="bg-slate-900/40 border border-white/10 rounded-[2rem] md:rounded-[2.5rem] p-6 md:p-8 relative overflow-hidden backdrop-blur-md shadow-2xl group">
               <div className="absolute top-0 right-0 -mt-10 -mr-10 w-64 h-64 bg-indigo-500/20 rounded-full blur-3xl pointer-events-none group-hover:bg-indigo-500/30 transition-colors duration-1000 animate-pulse"></div>

               <div className="relative z-10">
                 <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
                   <div>
                     <div className="flex items-center gap-3">
                       <h2 className="text-3xl md:text-5xl font-bold text-white tracking-tighter">{weatherData.location.name}</h2>
                       <button onClick={toggleFavorite} className="hover:scale-110 transition-transform p-1 active:scale-90">
                         <Star className={`w-7 h-7 transition-colors ${isCurrentFavorite ? 'text-amber-400 fill-amber-400' : 'text-slate-600 hover:text-amber-300'}`} />
                       </button>
                     </div>
                     <div className="flex items-center gap-4 mt-2 text-sm text-indigo-200 font-medium">
                        <span className="flex items-center gap-1.5"><MapPin className="w-3.5 h-3.5"/> {weatherData.location.country}</span>
                        <span className="w-1 h-1 bg-indigo-500 rounded-full"></span>
                        <button onClick={() => fetchWeatherByCoords(weatherData.location.latitude, weatherData.location.longitude, weatherData.location.name, weatherData.location.country)} className="flex items-center gap-1.5 hover:text-white transition-colors active:opacity-70">
                          <RefreshCw className="w-3.5 h-3.5"/> <span className="hidden md:inline">Actualitzat ara</span><span className="md:hidden">Ara</span>
                        </button>
                     </div>
                   </div>
                   <div className="flex flex-col items-end self-end md:self-auto">
                      <div className="filter drop-shadow-2xl md:hover:scale-110 transition-transform duration-500">
                        {getWeatherIcon(weatherData.current.weather_code, "w-16 h-16 md:w-24 md:h-24")}
                      </div>
                      <span className="text-lg md:text-xl font-medium text-slate-200 mt-2">
                         {weatherData.current.weather_code === 0 ? 'Serè' : isSnowCode(weatherData.current.weather_code) ? 'Nevada' : weatherData.current.weather_code < 4 ? 'Ennuvolat' : 'Pluja'}
                      </span>
                   </div>
                 </div>

                 <div className="flex flex-col lg:flex-row items-end gap-8 lg:gap-12">
                   <div className="flex items-start gap-2 w-full md:w-auto justify-between md:justify-start">
                      <span className="text-7xl md:text-9xl font-bold text-white leading-none tracking-tighter drop-shadow-2xl">
                        {formatTemp(weatherData.current.temperature_2m)}°
                      </span>
                      <div className="space-y-2 mt-2 md:mt-4">
                         <div className="flex items-center gap-3 text-indigo-100 font-bold bg-white/5 border border-white/5 px-3 py-1.5 md:px-4 md:py-2 rounded-full text-xs md:text-sm backdrop-blur-md shadow-lg">
                           <span className="text-rose-300 flex items-center gap-1">↑ {formatTemp(weatherData.daily.temperature_2m_max[0])}°</span>
                           <span className="w-px h-3 bg-white/20"></span>
                           <span className="text-cyan-300 flex items-center gap-1">↓ {formatTemp(weatherData.daily.temperature_2m_min[0])}°</span>
                         </div>
                         <div className="text-xs text-center text-slate-400 font-medium">
                           Sensació de {formatTemp(weatherData.current.apparent_temperature)}°
                         </div>
                      </div>
                   </div>

                   {/* AI INSIGHTS CARD */}
                   <div className="flex-1 w-full bg-slate-950/30 border border-white/10 rounded-2xl p-5 backdrop-blur-md shadow-inner relative overflow-hidden">
                     <div className="flex items-center justify-between mb-3">
                       <div className="flex items-center gap-2 text-xs font-bold uppercase text-indigo-300 tracking-wider">
                         <BrainCircuit className="w-4 h-4 animate-pulse" /> Anàlisi Intel·ligent
                       </div>
                       {aiAnalysis && <span className="text-[10px] text-slate-500 bg-slate-900 px-2 py-0.5 rounded-full border border-slate-800">IA {aiAnalysis.confidence}</span>}
                     </div>
                     
                     {aiAnalysis ? (
                       <div className="space-y-4 animate-in fade-in">
                         <TypewriterText text={aiAnalysis.text} />
                         <div className="flex flex-wrap gap-2">
                           {aiAnalysis.tips.map((t, i) => (
                             <span key={i} className="text-xs px-3 py-1.5 bg-indigo-500/20 text-indigo-100 rounded-lg border border-indigo-500/20 flex items-center gap-1.5 shadow-sm animate-in zoom-in duration-500" style={{animationDelay: `${i*150}ms`}}>
                               {t.includes('Roba') || t.includes('Jaqueta') || t.includes('abrigat') ? <Shirt className="w-3.5 h-3.5 opacity-70"/> : <AlertTriangle className="w-3.5 h-3.5 opacity-70"/>}
                               {t}
                             </span>
                           ))}
                         </div>
                       </div>
                     ) : (
                       <div className="flex items-center gap-2 text-slate-500 text-sm animate-pulse min-h-[3em]">
                         <div className="w-2 h-2 bg-indigo-500 rounded-full animate-bounce"></div> Generant consells...
                       </div>
                     )}
                   </div>
                 </div>
               </div>
            </div>

            {/* METRICS & HOURLY GRAPH ROW */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              
              <div className="grid grid-cols-2 gap-3 md:gap-4">
                 <CircularGauge 
                    icon={<Wind className="w-6 h-6"/>} 
                    label="Vent" 
                    value={`${weatherData.current.wind_speed_10m}`} 
                    max={100}
                    subText="km/h"
                    color="text-teal-400"
                 />
                 <CircularGauge 
                    icon={<Gauge className="w-6 h-6"/>} 
                    label="Pressió" 
                    value={Math.round(weatherData.current.pressure_msl)} 
                    max={1100} 
                    subText="hPa"
                    color="text-pink-400"
                 />
                 
                 {/* Adaptative Gauge for Rain/Snow */}
                 <CircularGauge 
                    icon={isTodaySnow ? <Snowflake className="w-6 h-6"/> : <Umbrella className="w-6 h-6"/>} 
                    label={isTodaySnow ? "Neu" : "Pluja"} 
                    value={weatherData.daily.precipitation_probability_max[0]} 
                    max={100}
                    subText="%"
                    color={isTodaySnow ? "text-cyan-300" : "text-indigo-400"}
                 />
                 
                 {aqiData && 
                   <CircularGauge 
                      icon={<Leaf className="w-6 h-6"/>} 
                      label="AQI" 
                      value={aqiData.current.european_aqi} 
                      max={100}
                      subText="Index"
                      color={aqiData.current.european_aqi > 50 ? "text-amber-400" : "text-green-400"}
                   />
                 }
              </div>

              {/* HOURLY VISUAL CHART WITH TABS */}
              <div className="lg:col-span-2 bg-slate-900/40 border border-white/10 rounded-3xl p-6 relative overflow-hidden backdrop-blur-sm flex flex-col shadow-xl">
                 <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 z-10 gap-4">
                   <h3 className="font-bold text-white flex items-center gap-2"><TrendingUp className="w-4 h-4 text-indigo-400"/> Tendència 24h</h3>
                   
                   <div className="flex bg-slate-950/50 rounded-xl p-1 border border-white/5">
                      <button 
                        onClick={() => setActiveChartLayer('temp')}
                        className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-2 ${activeChartLayer === 'temp' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-400 hover:text-white'}`}
                      >
                         <ThermometerSun className="w-3 h-3"/> Temperatura
                      </button>
                      <button 
                        onClick={() => setActiveChartLayer('rain')}
                        className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-2 ${activeChartLayer === 'rain' ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-400 hover:text-white'}`}
                      >
                         <Umbrella className="w-3 h-3"/> Pluja
                      </button>
                      <button 
                        onClick={() => setActiveChartLayer('wind')}
                        className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-2 ${activeChartLayer === 'wind' ? 'bg-teal-600 text-white shadow-lg' : 'text-slate-400 hover:text-white'}`}
                      >
                         <Wind className="w-3 h-3"/> Vent
                      </button>
                   </div>
                 </div>
                 
                 <HourlyForecastChart data={chartData} layer={activeChartLayer} unit={getUnitLabel()} />

                 <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-10 pointer-events-none"></div>
              </div>

            </div>

            {/* 7 DAY FORECAST - LIST STYLE */}
            <div className="bg-slate-900/40 border border-white/10 rounded-3xl p-6 backdrop-blur-sm shadow-xl">
               <h3 className="font-bold text-white mb-5 flex items-center gap-2"><Calendar className="w-4 h-4 text-amber-400"/> Previsió 7 Dies</h3>
               <div className="space-y-2">
                 {weatherData.daily.time.map((day, i) => {
                   const isDaySnow = isSnowCode(weatherData.daily.weather_code[i]);
                   return (
                     <button 
                       key={i}
                       onClick={() => setSelectedDayIndex(i)}
                       className="w-full flex items-center justify-between p-3 hover:bg-white/5 rounded-xl transition-colors group touch-manipulation active:bg-white/10"
                     >
                        {/* Day Name */}
                        <div className="w-16 text-left font-bold text-slate-200 capitalize">
                           {i === 0 ? 'Avui' : new Intl.DateTimeFormat('ca-ES', { weekday: 'short' }).format(new Date(day))}
                        </div>

                        {/* Icon & Precipitation */}
                        <div className="flex items-center gap-2 w-20 md:w-28">
                           <div className="group-hover:scale-110 transition-transform">
                               {getWeatherIcon(weatherData.daily.weather_code[i], "w-6 h-6")}
                           </div>
                           {weatherData.daily.precipitation_probability_max[i] > 15 && (
                              <span className={`text-xs flex items-center font-medium gap-0.5 ${isDaySnow ? 'text-cyan-200' : 'text-blue-300'}`}>
                                {isDaySnow ? <Snowflake className="w-3 h-3"/> : <Droplets className="w-3 h-3 fill-blue-300"/>} 
                                {weatherData.daily.precipitation_probability_max[i]}%
                              </span>
                           )}
                        </div>

                        {/* Temp Range Bar */}
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
          </div>
        )}
        
        <DayDetailModal />
      </div>
    </div>
  );
}

function DetailStat({ label, value, icon }) {
  return (
    <div className="bg-slate-950/80 p-4 rounded-2xl border border-slate-800 flex flex-col items-center hover:border-slate-600 transition-colors">
       <div className="text-slate-400 text-xs mb-2 flex items-center gap-1.5 font-medium uppercase tracking-wide">{icon} {label}</div>
       <div className="font-bold text-white text-lg">{value}</div>
    </div>
  )
}