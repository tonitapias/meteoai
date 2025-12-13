import React, { useState, useEffect, useRef } from 'react';
import { 
  Search, Wind, Droplets, Thermometer, MapPin, 
  Sun, Cloud, CloudRain, CloudLightning, Snowflake, 
  CloudFog, CloudSun, BrainCircuit, Activity, AlertTriangle, 
  CheckCircle2, Navigation, X, Sunrise, Sunset, Umbrella, Eye
} from 'lucide-react';

export default function MeteoIA() {
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [weatherData, setWeatherData] = useState(null);
  const [aiAnalysis, setAiAnalysis] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [selectedDayIndex, setSelectedDayIndex] = useState(null); // Nou estat per al dia seleccionat
  const searchRef = useRef(null);

  // Mapa d'icones
  const getWeatherIcon = (code, className = "w-6 h-6") => {
    if (code === 0) return <Sun className={`${className} text-yellow-400`} />;
    if (code >= 1 && code <= 3) return <CloudSun className={`${className} text-orange-300`} />;
    if (code >= 45 && code <= 48) return <CloudFog className={`${className} text-gray-400`} />;
    if (code >= 51 && code <= 67) return <CloudRain className={`${className} text-blue-400`} />;
    if (code >= 71 && code <= 77) return <Snowflake className={`${className} text-cyan-200`} />;
    if (code >= 95) return <CloudLightning className={`${className} text-purple-400`} />;
    return <Cloud className={`${className} text-gray-300`} />;
  };

  const generateAIPrediction = (current, daily, hourly) => {
    const maxTemp = Math.round(daily.temperature_2m_max[0]);
    const minTemp = Math.round(daily.temperature_2m_min[0]);
    const rainProb = daily.precipitation_probability_max[0];
    const windSpeed = current.wind_speed_10m;
    const weatherCode = current.weather_code;

    const next6Hours = hourly.temperature_2m.slice(0, 6);
    const tempTrend = next6Hours[5] > next6Hours[0] ? "pujaran" : "baixaran";

    let summary = "";
    let confidence = "Alta";
    let risk = null;

    if (weatherCode === 0) {
      summary = `Cel serè i estabilitat absoluta a ${query || 'la zona'}. `;
    } else if (weatherCode > 0 && weatherCode < 4) {
      summary = `Intervals de núvols passatgers sense complicacions. `;
    } else if (rainProb > 50) {
      summary = `Atenció: risc de pluja destacable per avui. `;
      confidence = rainProb > 80 ? "Molt Alta" : "Moderada";
    }

    summary += `Màximes previstes de ${maxTemp}°C i mínimes de ${minTemp}°C. `;
    
    if (maxTemp > 30) summary += "Dia molt calorós. ";
    if (minTemp < 5) summary += "Ambient fred, especialment a primera hora. ";

    if (windSpeed > 20) {
      summary += `Vent moderat (${windSpeed} km/h). `;
      risk = "Vent moderat";
    }
    
    summary += `Temperatures que ${tempTrend} pròximament.`;

    if (rainProb > 30 && rainProb < 60) {
      summary += " Incertesa en la precipitació, recomanable precaució.";
      confidence = "Mitjana";
    }

    return { text: summary, confidence, risk };
  };

  useEffect(() => {
    const timer = setTimeout(async () => {
      if (query.length > 2 && showSuggestions) {
        try {
          const res = await fetch(
            `https://geocoding-api.open-meteo.com/v1/search?name=${query}&count=5&language=ca&format=json`
          );
          const data = await res.json();
          setSuggestions(data.results || []);
        } catch (e) { console.error(e); }
      } else if (query.length <= 2) {
        setSuggestions([]);
      }
    }, 400);
    return () => clearTimeout(timer);
  }, [query, showSuggestions]);

  const fetchWeatherByLocation = async (location) => {
    setLoading(true);
    setError(null);
    setAiAnalysis(null);
    setSuggestions([]);
    setShowSuggestions(false);
    setQuery(location.name);
    
    try {
      // Afegim uv_index_max i wind_speed_10m_max a la petició daily
      const weatherRes = await fetch(
        `https://api.open-meteo.com/v1/forecast?latitude=${location.latitude}&longitude=${location.longitude}&current=temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,wind_speed_10m,pressure_msl&hourly=temperature_2m,precipitation_probability,weather_code&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,sunrise,sunset,uv_index_max,wind_speed_10m_max&timezone=auto&models=best_match`
      );
      
      if (!weatherRes.ok) throw new Error("Error connectant amb el satèl·lit");
      
      const data = await weatherRes.json();
      const analysis = generateAIPrediction(data.current, data.daily, data.hourly);
      
      setTimeout(() => setAiAnalysis(analysis), 600);
      setWeatherData({ ...data, location: location });

    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    function handleClickOutside(event) {
      if (searchRef.current && !searchRef.current.contains(event.target)) {
        setShowSuggestions(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Component Modal per al Detall del Dia
  const DayDetailModal = () => {
    if (selectedDayIndex === null || !weatherData) return null;

    const dayIdx = selectedDayIndex;
    const dateStr = weatherData.daily.time[dayIdx];
    const date = new Date(dateStr);
    
    // Calcular l'interval horari corresponent a aquest dia (24h)
    // L'API retorna hourly com una llista plana. Cada dia són 24 entrades.
    const startHour = dayIdx * 24;
    const endHour = startHour + 24;
    const dayHourlyTimes = weatherData.hourly.time.slice(startHour, endHour);
    const dayHourlyTemps = weatherData.hourly.temperature_2m.slice(startHour, endHour);
    const dayHourlyCodes = weatherData.hourly.weather_code.slice(startHour, endHour);
    const dayHourlyRain = weatherData.hourly.precipitation_probability.slice(startHour, endHour);

    return (
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
        <div className="bg-slate-900 border border-slate-700 w-full max-w-2xl rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300">
          
          {/* Modal Header */}
          <div className="bg-slate-800/50 p-6 flex justify-between items-start border-b border-slate-700">
            <div className="flex items-center gap-4">
              <div className="bg-slate-950 p-3 rounded-2xl border border-slate-700">
                {getWeatherIcon(weatherData.daily.weather_code[dayIdx], "w-10 h-10")}
              </div>
              <div>
                <h3 className="text-2xl font-bold text-white">
                  {dayIdx === 0 ? 'Avui' : new Intl.DateTimeFormat('ca-ES', { weekday: 'long', day: 'numeric', month: 'long' }).format(date)}
                </h3>
                <p className="text-indigo-300 text-sm flex items-center gap-2">
                   <MapPin className="w-3 h-3" /> {weatherData.location.name}
                </p>
              </div>
            </div>
            <button 
              onClick={() => setSelectedDayIndex(null)}
              className="p-2 hover:bg-slate-700 rounded-full transition-colors text-slate-400 hover:text-white"
            >
              <X className="w-6 h-6" />
            </button>
          </div>

          {/* Modal Body */}
          <div className="p-6 space-y-6 max-h-[70vh] overflow-y-auto custom-scrollbar">
            
            {/* Resum Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="bg-slate-950/50 p-4 rounded-xl border border-slate-800 flex flex-col items-center">
                 <div className="text-slate-400 text-xs mb-1">Temperatura</div>
                 <div className="flex gap-2 items-end">
                    <span className="text-xl font-bold text-white">{Math.round(weatherData.daily.temperature_2m_max[dayIdx])}°</span>
                    <span className="text-sm text-slate-500">{Math.round(weatherData.daily.temperature_2m_min[dayIdx])}°</span>
                 </div>
              </div>
              <div className="bg-slate-950/50 p-4 rounded-xl border border-slate-800 flex flex-col items-center">
                 <div className="text-slate-400 text-xs mb-1 flex items-center gap-1"><Umbrella className="w-3 h-3"/> Pluja</div>
                 <div className="text-xl font-bold text-blue-300">{weatherData.daily.precipitation_probability_max[dayIdx]}%</div>
              </div>
              <div className="bg-slate-950/50 p-4 rounded-xl border border-slate-800 flex flex-col items-center">
                 <div className="text-slate-400 text-xs mb-1 flex items-center gap-1"><Wind className="w-3 h-3"/> Vent Màx</div>
                 <div className="text-xl font-bold text-teal-300">{weatherData.daily.wind_speed_10m_max[dayIdx]} <span className="text-xs font-normal">km/h</span></div>
              </div>
              <div className="bg-slate-950/50 p-4 rounded-xl border border-slate-800 flex flex-col items-center">
                 <div className="text-slate-400 text-xs mb-1 flex items-center gap-1"><Sun className="w-3 h-3"/> Índex UV</div>
                 <div className="text-xl font-bold text-amber-300">{weatherData.daily.uv_index_max[dayIdx]}</div>
              </div>
            </div>

            {/* Sun Cycle */}
            <div className="flex justify-between items-center bg-slate-800/30 p-4 rounded-xl border border-slate-700/50">
               <div className="flex items-center gap-3">
                  <Sunrise className="w-6 h-6 text-amber-400" />
                  <div>
                    <div className="text-xs text-slate-400">Sortida del sol</div>
                    <div className="font-semibold">{new Date(weatherData.daily.sunrise[dayIdx]).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</div>
                  </div>
               </div>
               <div className="h-px flex-1 bg-gradient-to-r from-transparent via-slate-600 to-transparent mx-4"></div>
               <div className="flex items-center gap-3 text-right">
                  <div>
                    <div className="text-xs text-slate-400">Posta de sol</div>
                    <div className="font-semibold">{new Date(weatherData.daily.sunset[dayIdx]).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</div>
                  </div>
                  <Sunset className="w-6 h-6 text-orange-400" />
               </div>
            </div>

            {/* Hourly Graph Specific for that Day */}
            <div>
              <h4 className="text-sm font-semibold text-slate-300 mb-4 flex items-center gap-2">
                <Activity className="w-4 h-4 text-indigo-400" /> Evolució horària del dia
              </h4>
              <div className="flex overflow-x-auto pb-4 gap-3 custom-scrollbar">
                {dayHourlyTimes.map((t, i) => {
                   // Només mostrem cada 3 hores per no saturar, o totes si es vol
                   if (i % 2 !== 0) return null;
                   return (
                     <div key={t} className="flex flex-col items-center min-w-[50px] space-y-2 p-2 rounded-lg hover:bg-slate-800 transition-colors">
                       <span className="text-[10px] text-slate-500">{new Date(t).getHours()}:00</span>
                       {getWeatherIcon(dayHourlyCodes[i], "w-5 h-5")}
                       <span className="font-bold text-sm">{Math.round(dayHourlyTemps[i])}°</span>
                       {dayHourlyRain[i] > 0 && (
                          <span className="text-[10px] text-blue-400 font-medium">{dayHourlyRain[i]}%</span>
                       )}
                     </div>
                   )
                })}
              </div>
            </div>

          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans p-4 md:p-8 selection:bg-indigo-500 selection:text-white relative">
      <div className="max-w-5xl mx-auto space-y-6">
        
        {/* Header amb CERCADOR */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center bg-slate-900/80 p-5 rounded-2xl border border-slate-800 backdrop-blur-md sticky top-0 z-40 shadow-2xl">
          <div className="flex items-center gap-3 mb-4 md:mb-0">
            <div className="bg-gradient-to-tr from-indigo-600 to-purple-600 p-2.5 rounded-xl shadow-lg shadow-indigo-500/20">
              <BrainCircuit className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-white tracking-tight">Meteo<span className="text-indigo-400">AI</span> Pro</h1>
              <p className="text-xs text-slate-400 font-medium">Model Predictiu Avançat</p>
            </div>
          </div>

          <div className="relative w-full md:w-96" ref={searchRef}>
            <div className="relative">
              <input
                type="text"
                value={query}
                onFocus={() => setShowSuggestions(true)}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setShowSuggestions(true);
                }}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl py-3 pl-11 pr-10 focus:ring-2 focus:ring-indigo-500 focus:outline-none text-sm transition-all shadow-inner placeholder-slate-600"
                placeholder="Cerca el teu poble..."
              />
              <Search className="w-5 h-5 absolute left-3.5 top-3 text-slate-500" />
              {query && (
                <button 
                  onClick={() => { setQuery(''); setSuggestions([]); }}
                  className="absolute right-3 top-3 text-slate-600 hover:text-slate-300"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            {showSuggestions && suggestions.length > 0 && (
              <div className="absolute top-full left-0 right-0 mt-2 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl overflow-hidden z-50 animate-in fade-in zoom-in-95 duration-200">
                {suggestions.map((place) => (
                  <button
                    key={place.id}
                    onClick={() => fetchWeatherByLocation(place)}
                    className="w-full text-left px-4 py-3 hover:bg-indigo-600/20 hover:text-indigo-200 transition-colors flex items-center gap-3 border-b border-slate-800 last:border-0"
                  >
                    <MapPin className="w-4 h-4 text-slate-400 flex-shrink-0" />
                    <div>
                      <div className="font-medium text-slate-200">{place.name}</div>
                      <div className="text-xs text-slate-500">
                        {[place.admin1, place.country].filter(Boolean).join(', ')}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Estat inicial */}
        {!weatherData && !loading && !error && (
          <div className="text-center py-24 px-4">
             <div className="bg-slate-900/50 inline-flex p-6 rounded-full mb-6 border border-slate-800">
                <Navigation className="w-12 h-12 text-indigo-500/50" />
             </div>
             <h2 className="text-2xl font-bold text-slate-300 mb-2">Comença la cerca</h2>
             <p className="text-slate-500 max-w-md mx-auto">
               Cerca "Sant Feliu Sasserra" o qualsevol municipi per veure la potència dels models.
             </p>
          </div>
        )}

        {/* Loading & Error */}
        {error && (
          <div className="bg-red-500/10 border border-red-500/20 text-red-200 p-4 rounded-xl flex items-center gap-3">
            <AlertTriangle className="w-5 h-5" /> {error}
          </div>
        )}

        {loading && (
          <div className="py-32 text-center space-y-6">
            <div className="relative w-20 h-20 mx-auto">
               <div className="absolute inset-0 border-4 border-slate-800 rounded-full"></div>
               <div className="absolute inset-0 border-4 border-indigo-500 rounded-full border-t-transparent animate-spin"></div>
            </div>
            <p className="text-lg font-medium text-white">Carregant previsió...</p>
          </div>
        )}

        {/* MAIN CONTENT */}
        {!loading && weatherData && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-in slide-in-from-bottom-4 duration-700">
            
            <div className="lg:col-span-2 space-y-6">
              {/* Main Card */}
              <div className="bg-gradient-to-br from-indigo-950 to-slate-900 border border-indigo-500/20 p-6 md:p-8 rounded-[2rem] relative overflow-hidden shadow-2xl">
                <div className="relative z-10">
                  <div className="flex justify-between items-start mb-8">
                    <div>
                      <h2 className="text-3xl font-bold text-white flex items-center gap-2">
                        {weatherData.location.name}
                      </h2>
                      <div className="flex items-center gap-2 text-indigo-300 text-sm mt-1">
                        <MapPin className="w-4 h-4" /> {weatherData.location.country}
                      </div>
                    </div>
                    <div className="text-right flex flex-col items-end">
                       <span className="text-xs text-slate-400 uppercase font-bold tracking-wider mb-1">Ara</span>
                       {getWeatherIcon(weatherData.current.weather_code, "w-12 h-12")}
                    </div>
                  </div>

                  <div className="flex items-end gap-6 mb-8">
                    <span className="text-8xl font-bold tracking-tighter text-white drop-shadow-lg">
                      {Math.round(weatherData.current.temperature_2m)}°
                    </span>
                    <div className="pb-6 space-y-1">
                       <div className="text-xl text-indigo-200 font-medium">
                         Max: {Math.round(weatherData.daily.temperature_2m_max[0])}°  Min: {Math.round(weatherData.daily.temperature_2m_min[0])}°
                       </div>
                    </div>
                  </div>

                  {/* AI Block */}
                  <div className="bg-slate-950/60 rounded-2xl p-6 border border-indigo-500/30 backdrop-blur-md">
                    <div className="flex items-center justify-between mb-3">
                       <div className="flex items-center gap-2 text-indigo-300 text-xs font-bold uppercase tracking-wider">
                         <BrainCircuit className="w-4 h-4" /> Anàlisi Intel·ligent
                       </div>
                       {aiAnalysis && (
                         <div className="text-[10px] px-2 py-1 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                           Fiabilitat: {aiAnalysis.confidence}
                         </div>
                       )}
                    </div>
                    {aiAnalysis ? (
                      <p className="text-lg leading-relaxed text-slate-100 font-medium animate-in fade-in">
                        {aiAnalysis.text}
                      </p>
                    ) : (
                      <div className="text-slate-500 text-sm">Generant informe...</div>
                    )}
                  </div>
                </div>
              </div>

              {/* Metrics Grid */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <MetricCard icon={<Wind/>} label="Vent" value={`${weatherData.current.wind_speed_10m} km/h`} />
                <MetricCard icon={<Droplets/>} label="Humitat" value={`${weatherData.current.relative_humidity_2m}%`} />
                <MetricCard icon={<CloudRain/>} label="Pluja (avui)" value={`${weatherData.daily.precipitation_probability_max[0]}%`} />
                <MetricCard icon={<Activity/>} label="Pressió" value={`${Math.round(weatherData.current.pressure_msl)} hPa`} />
              </div>
            </div>

            {/* SIDEBAR: 7 DIES INTERACTIUS */}
            <div className="bg-slate-900 border border-slate-800 p-6 rounded-[2rem] h-full shadow-lg flex flex-col">
              <h3 className="text-lg font-bold mb-6 text-white flex items-center gap-2">
                <Sun className="w-5 h-5 text-amber-400" /> Previsió 7 Dies
              </h3>
              <p className="text-xs text-slate-500 mb-4 -mt-4">Clica en un dia per veure detalls</p>
              
              <div className="divide-y divide-slate-800 flex-1 overflow-y-auto">
                {weatherData.daily.time.map((day, i) => (
                  <button 
                    key={day} 
                    onClick={() => setSelectedDayIndex(i)}
                    className="w-full flex items-center justify-between py-4 group hover:bg-slate-800/50 transition-all rounded-xl px-3 -mx-3 cursor-pointer outline-none focus:bg-slate-800"
                  >
                    <div className="w-16 text-left text-sm text-slate-400 font-medium group-hover:text-white transition-colors">
                      {i === 0 ? 'Avui' : new Intl.DateTimeFormat('ca-ES', { weekday: 'short' }).format(new Date(day))}
                    </div>
                    <div className="flex flex-col items-center flex-1">
                       {getWeatherIcon(weatherData.daily.weather_code[i], "w-6 h-6 mb-1 group-hover:scale-110 transition-transform")}
                       {weatherData.daily.precipitation_probability_max[i] > 20 && (
                         <span className="text-[10px] text-blue-300 font-bold bg-blue-900/30 px-1.5 rounded-full">
                           {weatherData.daily.precipitation_probability_max[i]}%
                         </span>
                       )}
                    </div>
                    <div className="w-20 text-right flex items-center justify-end gap-2">
                      <div className="text-white font-bold">{Math.round(weatherData.daily.temperature_2m_max[i])}°</div>
                      <div className="text-slate-600 text-xs">{Math.round(weatherData.daily.temperature_2m_min[i])}°</div>
                      <Eye className="w-3 h-3 text-indigo-500 opacity-0 group-hover:opacity-100 transition-opacity" />
                    </div>
                  </button>
                ))}
              </div>
            </div>

          </div>
        )}

        {/* RENDER MODAL */}
        <DayDetailModal />
      </div>
    </div>
  );
}

function MetricCard({ icon, label, value }) {
  return (
    <div className="bg-slate-900/80 border border-slate-800 p-4 rounded-2xl flex flex-col items-center justify-center text-center hover:bg-slate-800 transition-colors group">
      <div className="mb-2 text-indigo-400 group-hover:scale-110 transition-transform">{icon}</div>
      <div className="text-xs text-slate-500 mb-1">{label}</div>
      <div className="font-bold text-slate-200">{value}</div>
    </div>
  )
}