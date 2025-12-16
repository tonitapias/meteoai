import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { 
  Search, Wind, Droplets, MapPin, Sun, Cloud, CloudRain, 
  CloudLightning, Snowflake, CloudFog, CloudSun, CloudMoon, BrainCircuit, 
  Activity, AlertTriangle, X, Sunrise, Sunset, Umbrella,
  LocateFixed, Shirt, Star, RefreshCw, Trash2,
  ThermometerSun, Gauge, ArrowRight, AlertOctagon, TrendingUp, TrendingDown, Minus, Clock,
  ThermometerSnowflake, AlertCircle, CloudSnow, Moon, GitGraph, Mountain, Zap, Thermometer,
  LayoutTemplate, LayoutDashboard, Flower2
} from 'lucide-react';

// --- 1. CONSTANTS I CONFIGURACIÓ (Fora del component per rendiment) ---

const API_CONFIG = {
  WEATHER: "https://api.open-meteo.com/v1/forecast",
  GEOCODING: "https://geocoding-api.open-meteo.com/v1/search",
  AQI: "https://air-quality-api.open-meteo.com/v1/air-quality",
  REVERSE_GEO: "https://nominatim.openstreetmap.org/reverse"
};

// Map de codis WMO a descripcions/icones
const WMO_CODES = {
  0: { label: "clear", severity: 0 },
  1: { label: "mostlyClear", severity: 0 },
  2: { label: "partlyCloudy", severity: 0 },
  3: { label: "overcast", severity: 1 },
  45: { label: "fog", severity: 2 },
  48: { label: "rimingFog", severity: 2 },
  51: { label: "drizzleLight", severity: 3 },
  53: { label: "drizzleMod", severity: 3 },
  55: { label: "drizzleDense", severity: 3 },
  56: { label: "freezingDrizzle", severity: 4 },
  57: { label: "freezingDrizzleDense", severity: 4 },
  61: { label: "rainSlight", severity: 3 },
  63: { label: "rainMod", severity: 4 },
  65: { label: "rainHeavy", severity: 5 },
  66: { label: "freezingRain", severity: 5 },
  67: { label: "freezingRainHeavy", severity: 5 },
  71: { label: "snowSlight", severity: 4 },
  73: { label: "snowMod", severity: 5 },
  75: { label: "snowHeavy", severity: 6 },
  77: { label: "snowGrains", severity: 4 },
  80: { label: "rainShowers", severity: 3 },
  81: { label: "rainShowersMod", severity: 4 },
  82: { label: "rainShowersViolent", severity: 5 },
  85: { label: "snowShowers", severity: 4 },
  86: { label: "snowShowersHeavy", severity: 5 },
  95: { label: "thunderstorm", severity: 6 },
  96: { label: "thunderstormHail", severity: 7 },
  99: { label: "thunderstormHeavyHail", severity: 8 },
};

const TRANSLATIONS = {
  ca: {
    searchPlaceholder: "Cerca ciutat...",
    favorites: "Llocs Preferits",
    feelsLike: "Sensació",
    aiAnalysis: "Anàlisi Meteo IA",
    aiConfidence: "Consens Models",
    aiConfidenceMod: "Divergència",
    aiConfidenceLow: "Incertesa",
    generatingTips: "Analitzant CAPE, Pressió i Models...",
    trend24h: "Tendència 24h",
    temp: "Temperatura",
    rain: "Pluja",
    wind: "Vent",
    cloud: "Cobertura",
    humidity: "Humitat",
    dewPoint: "Punt de Rosada",
    dewPointDesc: "Llindar de xafogor",
    snowLevel: "Cota de neu",
    forecast7days: "Previsió 7 Dies",
    today: "Avui",
    detailedForecast: "Previsió detallada",
    hourlyEvolution: "Evolució Horària",
    snowAccumulated: "Neu Acumulada",
    totalPrecipitation: "Precipitació Total",
    rainProb: "Prob. Pluja",
    windMax: "Vent Màx",
    uvIndex: "Índex UV",
    tempMin: "Temp Mín",
    sunrise: "Sortida Sol",
    sunset: "Posta Sol",
    moon: "Lluna",
    pressure: "Pressió",
    pressureRising: "Pujant",
    pressureFalling: "Baixant",
    pressureSteady: "Estable",
    stormPotential: "Potencial Tempesta",
    capeStable: "Estable",
    capeModerate: "Inest. Moderada",
    capeHigh: "Inest. Alta",
    capeExtreme: "RISC SEVER",
    aqi: "Qualitat Aire",
    moonPhase: "Fase Lunar",
    illumination: "Il·luminada",
    sunRiseIn: "Surt en",
    sunSetIn: "Posta en",
    sunSetDone: "Ja s'ha post",
    localTime: "Hora local",
    day: "Dia",
    night: "Nit",
    sun: "Sol",
    alertDanger: "ALERTA PERILL",
    alertWarning: "AVÍS PRECAUCIÓ",
    subtitle: "Previsió professional multi-model amb anàlisi d'inestabilitat.",
    pollen: "Nivells de Pol·len",
    pollenTypes: { alder: "Vern", birch: "Bedoll", grass: "Gramínies", mugwort: "Artemísia", olive: "Olivera", ragweed: "Ambròsia" },
    modeBasic: "Essencial",
    modeExpert: "Avançat",
    preciseRain: "Previsió Immediata (1h)",
    modelsLegend: "Comparativa Models",
    modelBest: "Consensus",
    modelGfs: "GFS",
    modelIcon: "ICON",
    dpDry: "Sec", dpComfortable: "Confortable", dpHumid: "Xafogós", dpOppressive: "Opressiu", dpExtreme: "Insuportable",
    aiSummaryClear: "Estabilitat dominant. Cel serè.",
    aiSummaryCloudy: "Pas de nuvolositat variable.",
    aiSummaryRain: "Pertorbació activa. Precipitacions.",
    aiSummaryStorm: "Situació explosiva. Risc de tempestes.",
    aiSummarySnow: "Configuració hivernal amb nevades.",
    alertStorm: "Tempestes previstes", alertSnow: "Neu prevista", alertWind: "Vent fort", alertHeat: "Calor intensa", alertCold: "Fred sever",
    tips: { umbrella: "Agafa paraigua", coat: "Abric gruixut", layers: "Vesteix per capes", sunscreen: "Crema solar", water: "Hidrata't", wind: "Tallavents" }
  },
  // Es poden afegir més idiomes aquí (es, en, fr) seguint la mateixa estructura
};

// --- 2. FUNCIONS AUXILIARS PURES (Lògica de negoci) ---

// *FIX CRÍTIC*: Càlcul de data basat en la timezone remota, no la local del navegador
const getShiftedDate = (baseDate, timezone) => {
  try {
    const targetTimeStr = baseDate.toLocaleString("en-US", { timeZone: timezone });
    return new Date(targetTimeStr);
  } catch (e) {
    return baseDate; // Fallback
  }
};

// *FIX CRÍTIC*: Trobar l'índex de l'array horari basat en timestamps, no en getHours()
const getCurrentHourlyIndex = (hourlyTimes, currentTimestamp) => {
  if (!hourlyTimes) return 0;
  // Busquem l'hora que comença ara o just abans
  const idx = hourlyTimes.findIndex(t => {
    const tMs = new Date(t).getTime();
    return tMs <= currentTimestamp && (tMs + 3600000) > currentTimestamp;
  });
  return idx === -1 ? 0 : idx;
};

const calculateDewPoint = (T, RH) => {
  const a = 17.27, b = 237.7;
  const alpha = ((a * T) / (b + T)) + Math.log(RH / 100.0);
  return (b * alpha) / (a - alpha);
};

const getMoonPhase = (date) => {
  let year = date.getFullYear(), month = date.getMonth() + 1, day = date.getDate();
  if (month < 3) { year--; month += 12; }
  const c = 365.25 * year, e = 30.6 * month;
  const jd = c + e + day - 694039.09;
  let phase = jd / 29.5305882;
  phase -= Math.floor(phase);
  return phase;
};

const isSnowCode = (code) => (code >= 71 && code <= 77) || code === 85 || code === 86;

// Generador de text IA simple
const generateAIPrediction = (current, daily, hourly, aqi, lang, effectiveCode, currentTimestamp) => {
  const t = TRANSLATIONS[lang] || TRANSLATIONS.ca;
  const tips = [];
  const alerts = [];
  let summary = "";

  // Determinem dades rellevants
  const feelsLike = current.apparent_temperature;
  const wind = current.wind_speed_10m;
  const rainProb = daily.precipitation_probability_max?.[0] || 0;
  const uv = daily.uv_index_max?.[0] || 0;
  
  // Index actual per CAPE
  const idx = getCurrentHourlyIndex(hourly.time, currentTimestamp);
  const cape = hourly.cape?.[idx] || 0;

  // Lògica de resum
  if (effectiveCode >= 95) summary = t.aiSummaryStorm;
  else if (isSnowCode(effectiveCode)) summary = t.aiSummarySnow;
  else if (effectiveCode >= 51) summary = t.aiSummaryRain;
  else if (effectiveCode <= 2) summary = t.aiSummaryClear;
  else summary = t.aiSummaryCloudy;

  // Lògica d'Alertes i Tips
  if (effectiveCode >= 95 || cape > 1500) alerts.push({ type: 'storm', msg: t.alertStorm, level: 'high' });
  if (wind > 50) { alerts.push({ type: 'wind', msg: t.alertWind, level: 'warning' }); tips.push(t.tips.wind); }
  if (rainProb > 40) tips.push(t.tips.umbrella);
  if (feelsLike < 5) { alerts.push({ type: 'cold', msg: t.alertCold, level: 'warning' }); tips.push(t.tips.coat); }
  else if (feelsLike > 30) { alerts.push({ type: 'heat', msg: t.alertHeat, level: 'warning' }); tips.push(t.tips.water); }
  if (uv > 6) tips.push(t.tips.sunscreen);

  return { 
    text: `${summary} ${feelsLike < 10 ? "Ambient fred." : feelsLike > 25 ? "Ambient càlid." : "Ambient suau."}`,
    tips: [...new Set(tips)].slice(0, 3),
    alerts,
    confidence: t.aiConfidence 
  };
};

// --- 3. SUB-COMPONENTS UI (Optimitzats) ---

const WeatherIcon = ({ code, isDay, className }) => {
  const props = { className: `${className} drop-shadow-md transition-all`, strokeWidth: 2 };
  
  // Casos especials
  if (code === 0) return isDay ? <Sun {...props} className={`${className} text-yellow-400 animate-pulse`} /> : <Moon {...props} className={`${className} text-slate-300`} />;
  if (code <= 2) return isDay ? <CloudSun {...props} className={`${className} text-orange-300`} /> : <CloudMoon {...props} className={`${className} text-slate-400`} />;
  if (code === 3) return <Cloud {...props} className={`${className} text-slate-400`} />;
  if (code >= 45 && code <= 48) return <CloudFog {...props} className={`${className} text-gray-400`} />;
  if (code >= 51 && code <= 67) return <CloudRain {...props} className={`${className} text-blue-400`} />;
  if (isSnowCode(code)) return <Snowflake {...props} className={`${className} text-white animate-spin-slow`} />;
  if (code >= 95) return <CloudLightning {...props} className={`${className} text-purple-400 animate-pulse`} />;
  
  return <Cloud {...props} />; // Fallback
};

// Gràfic simple amb SVG
const HourlyChart = ({ data, type, height = 100, color }) => {
  if (!data || data.length === 0) return null;
  const vals = data.map(d => d.val);
  const min = Math.min(...vals), max = Math.max(...vals);
  const range = max - min || 1;
  const points = data.map((d, i) => {
    const x = (i / (data.length - 1)) * 100;
    const y = 100 - ((d.val - min) / range) * 80 - 10; // Marge 10%
    return `${x},${y}`;
  }).join(' ');

  return (
    <div className="w-full h-full relative">
      <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="w-full h-full overflow-visible">
        <defs>
          <linearGradient id={`grad-${type}`} x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.4" />
            <stop offset="100%" stopColor={color} stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d={`M0,100 L0,${100 - ((data[0].val - min)/range)*80 - 10} ${points.replace(/,/g, ' ')} L100,${100 - ((data[data.length-1].val - min)/range)*80 - 10} L100,100 Z`} fill={`url(#grad-${type})`} />
        <polyline points={points} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke"/>
      </svg>
      {/* Etiquetes horàries simplificades */}
      <div className="absolute bottom-0 w-full flex justify-between text-[10px] text-slate-400 px-1">
        <span>{new Date(data[0].time).getHours()}h</span>
        <span>{new Date(data[Math.floor(data.length/2)].time).getHours()}h</span>
        <span>{new Date(data[data.length-1].time).getHours()}h</span>
      </div>
    </div>
  );
};

// Widget de Detall (Pressió, Vent, etc.)
const StatWidget = ({ icon: Icon, label, value, sub, color = "text-indigo-400" }) => (
  <div className="bg-slate-900/60 border border-white/5 p-4 rounded-2xl backdrop-blur-sm flex flex-col items-center justify-center h-full min-h-[120px]">
    <div className={`mb-2 ${color}`}><Icon size={24} /></div>
    <span className="text-xl font-bold text-slate-100">{value}</span>
    {sub && <span className="text-[10px] text-slate-400 uppercase tracking-wider">{sub}</span>}
    <span className="text-xs text-slate-500 mt-1">{label}</span>
  </div>
);

// --- 4. COMPONENT PRINCIPAL ---

export default function MeteoApp() {
  // Estats
  const [query, setQuery] = useState('');
  const [weatherData, setWeatherData] = useState(null);
  const [aqiData, setAqiData] = useState(null);
  const [suggestions, setSuggestions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [favorites, setFavorites] = useState(() => JSON.parse(localStorage.getItem('meteo_favs') || '[]'));
  const [viewMode, setViewMode] = useState('basic'); // 'basic' | 'expert'
  const [unit, setUnit] = useState('C');
  const [showSearch, setShowSearch] = useState(false);
  const [now, setNow] = useState(new Date());

  // Referències i Controladors
  const searchAbortController = useRef(null);

  // Efecte: Rellotge
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(timer);
  }, []);

  // Efecte: Desar favorits
  useEffect(() => localStorage.setItem('meteo_favs', JSON.stringify(favorites)), [favorites]);

  // Cerca de ciutats (amb Debounce i AbortController)
  useEffect(() => {
    if (query.length < 3) { setSuggestions([]); return; }
    
    // Cancel·lar petició anterior
    if (searchAbortController.current) searchAbortController.current.abort();
    searchAbortController.current = new AbortController();

    const fetchCities = async () => {
      try {
        const res = await fetch(`${API_CONFIG.GEOCODING}?name=${query}&count=5&language=ca&format=json`, {
          signal: searchAbortController.current.signal
        });
        const data = await res.json();
        setSuggestions(data.results || []);
      } catch (e) {
        if (e.name !== 'AbortError') console.error(e);
      }
    };
    
    // Petit debounce
    const timeoutId = setTimeout(fetchCities, 300);
    return () => clearTimeout(timeoutId);
  }, [query]);

  // Funció principal de càrrega de dades
  const fetchWeather = async (lat, lon, name, country) => {
    setLoading(true);
    setError(null);
    setShowSearch(false);
    setQuery("");

    try {
      const [wRes, aRes] = await Promise.all([
        fetch(`${API_CONFIG.WEATHER}?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,is_day,apparent_temperature,weather_code,wind_speed_10m,wind_direction_10m,pressure_msl,precipitation&hourly=temperature_2m,apparent_temperature,precipitation_probability,weather_code,wind_speed_10m,relative_humidity_2m,uv_index,is_day,pressure_msl,cape&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,uv_index_max,sunrise,sunset,precipitation_sum&timezone=auto&models=best_match`),
        fetch(`${API_CONFIG.AQI}?latitude=${lat}&longitude=${lon}&current=european_aqi,olive_pollen,grass_pollen`)
      ]);

      if (!wRes.ok) throw new Error("Error connectant al satèl·lit.");
      
      const wData = await wRes.json();
      const aData = await aRes.json();

      setWeatherData({ ...wData, location: { name, country, lat, lon } });
      setAqiData(aData);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleLocationClick = () => {
    if (!navigator.geolocation) return setError("Geolocalització no suportada");
    setLoading(true);
    navigator.geolocation.getCurrentPosition(async (pos) => {
      try {
        const res = await fetch(`${API_CONFIG.REVERSE_GEO}?format=json&lat=${pos.coords.latitude}&lon=${pos.coords.longitude}`);
        const data = await res.json();
        const name = data.address.city || data.address.town || "La meva ubicació";
        fetchWeather(pos.coords.latitude, pos.coords.longitude, name, data.address.country);
      } catch (e) {
        fetchWeather(pos.coords.latitude, pos.coords.longitude, "Ubicació detectada", "");
      }
    }, () => { setLoading(false); setError("Permís denegat"); });
  };

  const toggleFavorite = () => {
    if (!weatherData) return;
    const exists = favorites.find(f => f.name === weatherData.location.name);
    if (exists) setFavorites(prev => prev.filter(f => f.name !== weatherData.location.name));
    else setFavorites(prev => [...prev, weatherData.location]);
  };

  // Dades derivades (MEMOIZED)
  const currentData = useMemo(() => {
    if (!weatherData) return null;
    
    // Data ajustada a la timezone de la ciutat
    const shiftedNow = getShiftedDate(now, weatherData.timezone);
    const hourlyIdx = getCurrentHourlyIndex(weatherData.hourly.time, shiftedNow.getTime());

    // Extracció segura de dades
    const current = weatherData.current;
    const daily = weatherData.daily;
    const hourly = weatherData.hourly;
    
    const cape = hourly.cape?.[hourlyIdx] || 0;
    const dewPoint = calculateDewPoint(current.temperature_2m, current.relative_humidity_2m);
    
    // AI Analysis
    const analysis = generateAIPrediction(current, daily, hourly, aqiData, 'ca', current.weather_code, shiftedNow.getTime());

    // Chart Data (Next 24h)
    const chartData = hourly.time.slice(hourlyIdx, hourlyIdx + 24).map((t, i) => ({
      time: t,
      val: hourly.temperature_2m[hourlyIdx + i],
      rain: hourly.precipitation_probability[hourlyIdx + i]
    }));

    return {
      temp: Math.round(current.temperature_2m),
      feelsLike: Math.round(current.apparent_temperature),
      code: current.weather_code,
      isDay: current.is_day,
      min: Math.round(daily.temperature_2m_min[0]),
      max: Math.round(daily.temperature_2m_max[0]),
      wind: Math.round(current.wind_speed_10m),
      humidity: current.relative_humidity_2m,
      pressure: Math.round(current.pressure_msl),
      cape: Math.round(cape),
      dewPoint: Math.round(dewPoint),
      pollen: aqiData?.current?.olive_pollen,
      aqi: aqiData?.current?.european_aqi,
      analysis,
      chartData,
      shiftedNow,
      sunrise: daily.sunrise[0],
      sunset: daily.sunset[0]
    };
  }, [weatherData, aqiData, now]);

  // Fons dinàmic
  const getBgClass = () => {
    if (!currentData) return "bg-slate-900";
    const { code, isDay } = currentData;
    if (code >= 95) return "bg-gradient-to-br from-slate-900 via-indigo-950 to-purple-900";
    if (isSnowCode(code)) return "bg-gradient-to-br from-slate-800 via-slate-700 to-cyan-900";
    if (code >= 51) return "bg-gradient-to-br from-slate-800 via-blue-900 to-slate-900";
    if (isDay) return "bg-gradient-to-br from-blue-500 via-blue-600 to-indigo-700";
    return "bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900";
  };

  return (
    <div className={`min-h-screen text-white font-sans transition-colors duration-1000 ${getBgClass()} p-4 md:p-8 flex flex-col items-center`}>
      
      {/* --- CAPÇALERA --- */}
      <header className="w-full max-w-5xl flex justify-between items-center mb-8 relative z-50">
        <div className="flex items-center gap-2">
          <div className="bg-white/10 p-2 rounded-xl backdrop-blur-md">
            <BrainCircuit className="text-indigo-300" />
          </div>
          <h1 className="text-xl font-bold tracking-tight hidden md:block">Meteo Toni <span className="text-indigo-300">AI</span></h1>
        </div>

        <div className="relative flex-1 max-w-md mx-4">
          <div className="relative">
            <input 
              type="text" 
              value={query}
              onChange={(e) => { setQuery(e.target.value); setShowSearch(true); }}
              onFocus={() => setShowSearch(true)}
              placeholder="Cerca ciutat..."
              className="w-full bg-black/20 border border-white/10 rounded-xl py-2.5 pl-10 pr-4 focus:outline-none focus:bg-black/40 transition-all backdrop-blur-sm"
            />
            <Search className="absolute left-3 top-3 w-4 h-4 text-slate-400" />
            {query && <button onClick={() => setQuery('')} className="absolute right-3 top-3"><X className="w-4 h-4 text-slate-400" /></button>}
          </div>

          {/* SUGGERIMENTS */}
          {showSearch && (query.length > 0 || favorites.length > 0) && (
            <div className="absolute top-full left-0 right-0 mt-2 bg-slate-900/95 border border-white/10 rounded-xl shadow-2xl overflow-hidden backdrop-blur-xl animate-in fade-in zoom-in-95 duration-200">
              {query.length === 0 && favorites.length > 0 && (
                <div className="px-4 py-2 text-xs font-bold text-indigo-400 bg-black/20">FAVORITS</div>
              )}
              {(query.length === 0 ? favorites : suggestions).map((item, i) => (
                <button
                  key={`${item.lat}-${i}`}
                  onClick={() => fetchWeather(item.latitude || item.lat, item.longitude || item.lon, item.name, item.country)}
                  className="w-full px-4 py-3 flex items-center justify-between hover:bg-white/10 text-left transition-colors border-b border-white/5 last:border-0"
                >
                  <div className="flex items-center gap-3">
                    <MapPin className="w-4 h-4 text-slate-500" />
                    <div>
                      <div className="font-medium text-slate-200">{item.name}</div>
                      <div className="text-xs text-slate-500">{item.country || item.admin1}</div>
                    </div>
                  </div>
                  {query.length === 0 && <button onClick={(e) => { e.stopPropagation(); setFavorites(f => f.filter(x => x.name !== item.name)) }} className="p-2 hover:text-red-400"><Trash2 size={14}/></button>}
                </button>
              ))}
            </div>
          )}
        </div>

        <button onClick={handleLocationClick} className="bg-indigo-600 p-2.5 rounded-xl hover:bg-indigo-500 transition-colors shadow-lg shadow-indigo-500/20">
          <LocateFixed size={20} />
        </button>
      </header>

      {/* --- ESTATS DE CÀRREGA I ERROR --- */}
      {loading && (
        <div className="flex-1 flex flex-col items-center justify-center animate-pulse">
          <RefreshCw className="w-12 h-12 animate-spin text-indigo-300 mb-4" />
          <p className="text-slate-300">Connectant amb el satèl·lit...</p>
        </div>
      )}

      {error && !loading && (
        <div className="bg-red-500/20 border border-red-500/50 p-6 rounded-2xl flex items-center gap-4 text-red-100 max-w-md">
          <AlertTriangle />
          <p>{error}</p>
        </div>
      )}

      {!weatherData && !loading && !error && (
        <div className="flex-1 flex flex-col items-center justify-center text-center opacity-60">
          <CloudSun size={80} strokeWidth={1} className="mb-6" />
          <h2 className="text-3xl font-bold mb-2">Benvingut a Meteo Toni AI</h2>
          <p>Cerca una ciutat o utilitza la teva ubicació.</p>
        </div>
      )}

      {/* --- CONTINGUT PRINCIPAL --- */}
      {currentData && !loading && (
        <div className="w-full max-w-5xl grid grid-cols-1 lg:grid-cols-3 gap-6 animate-in slide-in-from-bottom-8 duration-700 pb-20">
          
          {/* 1. TARGETA PRINCIPAL */}
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-black/20 border border-white/10 rounded-3xl p-6 md:p-10 backdrop-blur-md relative overflow-hidden group">
              <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/20 rounded-full blur-3xl -mr-16 -mt-16 pointer-events-none"></div>
              
              <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 relative z-10">
                <div>
                  <div className="flex items-center gap-3 mb-2">
                    <h2 className="text-3xl md:text-5xl font-bold tracking-tight">{weatherData.location.name}</h2>
                    <button onClick={toggleFavorite} className="text-slate-400 hover:text-yellow-400 transition-colors">
                      <Star fill={favorites.some(f => f.name === weatherData.location.name) ? "currentColor" : "none"} className={favorites.some(f => f.name === weatherData.location.name) ? "text-yellow-400" : ""} />
                    </button>
                  </div>
                  <div className="flex items-center gap-2 text-indigo-200 mb-6">
                    <MapPin size={14} /> {weatherData.location.country}
                    <span className="mx-2 opacity-50">|</span>
                    <Clock size={14} /> {currentData.shiftedNow.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </div>
                  
                  <div className="flex items-start gap-4">
                    <span className="text-8xl font-bold leading-none tracking-tighter">{currentData.temp}°</span>
                    <div className="flex flex-col gap-1 mt-2">
                      <span className="px-3 py-1 rounded-full bg-white/10 text-sm font-medium backdrop-blur-md border border-white/5">
                        Sensació {currentData.feelsLike}°
                      </span>
                      <div className="text-sm text-slate-300 flex justify-between px-1">
                        <span>Min {currentData.min}°</span>
                        <span>Max {currentData.max}°</span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex flex-col items-end">
                  <WeatherIcon code={currentData.code} isDay={currentData.isDay} className="w-24 h-24 md:w-32 md:h-32 mb-2" />
                  <span className="text-xl font-medium text-slate-200 capitalize">
                    {TRANSLATIONS.ca.weather?.[currentData.code] || "Temps actual"}
                  </span>
                </div>
              </div>

              {/* AI ANALYSIS BOX */}
              <div className="mt-8 bg-indigo-900/30 border border-indigo-500/30 rounded-2xl p-5 backdrop-blur-md">
                <div className="flex items-center gap-2 text-indigo-300 text-xs font-bold uppercase tracking-wider mb-2">
                  <BrainCircuit size={14} /> Anàlisi AI
                </div>
                <p className="text-slate-200 leading-relaxed text-sm md:text-base mb-3">
                  {currentData.analysis.text}
                </p>
                <div className="flex flex-wrap gap-2">
                  {currentData.analysis.alerts.map((alert, i) => (
                    <span key={i} className={`text-xs px-2 py-1 rounded border flex items-center gap-1 ${alert.level === 'high' ? 'bg-red-500/20 border-red-500 text-red-100' : 'bg-amber-500/20 border-amber-500 text-amber-100'}`}>
                      <AlertTriangle size={12} /> {alert.msg}
                    </span>
                  ))}
                  {currentData.analysis.tips.map((tip, i) => (
                    <span key={`tip-${i}`} className="text-xs px-2 py-1 rounded bg-slate-700/50 border border-slate-600 text-slate-300">
                      {tip}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            {/* GRÀFIC HORARI (Basic) */}
            <div className="bg-black/20 border border-white/10 rounded-3xl p-6 backdrop-blur-sm">
              <h3 className="font-bold mb-4 flex items-center gap-2"><Clock size={16} /> Evolució 24h</h3>
              <div className="h-32 w-full">
                <HourlyChart data={currentData.chartData} type="temp" color="#818cf8" />
              </div>
            </div>
          </div>

          {/* 2. BARRA LATERAL (WIDGETS) */}
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <StatWidget icon={Wind} label="Vent (km/h)" value={currentData.wind} color="text-teal-400" />
              <StatWidget icon={Droplets} label="Humitat" value={`${currentData.humidity}%`} color="text-blue-400" />
              <StatWidget icon={Gauge} label="Pressió" value={currentData.pressure} sub="hPa" color="text-pink-400" />
              <StatWidget icon={Zap} label="CAPE" value={currentData.cape} sub="J/kg" color="text-yellow-400" />
              
              <StatWidget 
                icon={Thermometer} 
                label="Punt Rosada" 
                value={`${currentData.dewPoint}°`} 
                color={currentData.dewPoint > 20 ? "text-red-400" : "text-green-400"} 
              />
              
              {currentData.pollen && (
                <StatWidget icon={Flower2} label="Pol·len" value={currentData.pollen > 10 ? "Alt" : "Baix"} color="text-lime-400" />
              )}
            </div>

            {/* SOL I LLUNA */}
            <div className="bg-black/20 border border-white/10 rounded-3xl p-6 backdrop-blur-sm flex justify-between items-center">
              <div className="flex flex-col items-center">
                <Sunrise className="text-orange-400 mb-1" size={20} />
                <span className="text-sm font-bold">{new Date(currentData.sunrise).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}</span>
                <span className="text-[10px] text-slate-400">Sortida</span>
              </div>
              <div className="h-8 w-px bg-white/10"></div>
              <div className="flex flex-col items-center">
                <Sunset className="text-purple-400 mb-1" size={20} />
                <span className="text-sm font-bold">{new Date(currentData.sunset).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}</span>
                <span className="text-[10px] text-slate-400">Posta</span>
              </div>
              <div className="h-8 w-px bg-white/10"></div>
              <div className="flex flex-col items-center">
                 <Moon className="text-slate-300 mb-1" size={20} />
                 <span className="text-sm font-bold">{Math.round(getMoonPhase(currentData.shiftedNow) * 100)}%</span>
                 <span className="text-[10px] text-slate-400">Lluna</span>
              </div>
            </div>

            {/* PREVISIÓ 7 DIES */}
            <div className="bg-black/20 border border-white/10 rounded-3xl p-6 backdrop-blur-sm">
              <h3 className="font-bold mb-4 flex items-center gap-2"><LayoutTemplate size={16} /> 7 Dies</h3>
              <div className="space-y-3">
                {weatherData.daily.time.slice(1, 6).map((day, i) => (
                  <div key={day} className="flex items-center justify-between text-sm">
                    <span className="w-12 font-medium text-slate-300 capitalize">
                      {new Date(day).toLocaleDateString('ca-ES', { weekday: 'short' })}
                    </span>
                    <WeatherIcon code={weatherData.daily.weather_code[i+1]} className="w-6 h-6" />
                    <div className="flex items-center gap-3 w-24 justify-end font-mono">
                      <span className="text-slate-400">{Math.round(weatherData.daily.temperature_2m_min[i+1])}°</span>
                      <div className="w-16 h-1.5 bg-slate-700 rounded-full overflow-hidden relative">
                         <div 
                           className="absolute h-full bg-indigo-500" 
                           style={{
                             left: `${((weatherData.daily.temperature_2m_min[i+1] - currentData.min) / (currentData.max - currentData.min + 1)) * 100}%`,
                             right: `${100 - ((weatherData.daily.temperature_2m_max[i+1] - currentData.min) / (currentData.max - currentData.min + 1)) * 100}%`
                           }}
                         />
                      </div>
                      <span className="text-white">{Math.round(weatherData.daily.temperature_2m_max[i+1])}°</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}