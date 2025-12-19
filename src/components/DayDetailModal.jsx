import React, { useMemo } from 'react';
import { X, Calendar, Droplets, Wind, Thermometer, Sun, Moon, Umbrella, Mountain } from 'lucide-react';
import { HourlyForecastChart } from './WeatherCharts';

export default function DayDetailModal({ 
  weatherData, 
  selectedDayIndex, 
  onClose, 
  unit, 
  lang,
  viewMode,
  shiftedNow,
  getWeatherIcon 
}) {
  if (selectedDayIndex === null || !weatherData) return null;

  // 1. Dades generals del dia (Resum)
  const dayData = useMemo(() => {
    const i = selectedDayIndex;
    return {
      date: weatherData.daily.time[i],
      maxTemp: weatherData.daily.temperature_2m_max[i],
      minTemp: weatherData.daily.temperature_2m_min[i],
      weatherCode: weatherData.daily.weather_code[i],
      precipSum: weatherData.daily.precipitation_sum[i],
      precipProb: weatherData.daily.precipitation_probability_max[i],
      windMax: weatherData.daily.wind_speed_10m_max[i],
      sunrise: weatherData.daily.sunrise[i],
      sunset: weatherData.daily.sunset[i],
      uvMax: weatherData.daily.uv_index_max[i]
    };
  }, [weatherData, selectedDayIndex]);

  // 2. Calculem els índexs horaris que corresponen a aquest dia concret
  const dayIndices = useMemo(() => {
    const targetDate = new Date(dayData.date).toDateString();
    return weatherData.hourly.time
      .map((t, idx) => ({ t: new Date(t).toDateString(), idx }))
      .filter(item => item.t === targetDate)
      .map(item => item.idx);
  }, [weatherData, dayData]);

  // 3. Dades Principals (Model Europeu/Best Match) amb correcció de Cota de Neu
  const hourlyDataForDay = useMemo(() => {
    if (dayIndices.length === 0) return [];

    // Buscador intel·ligent de variables (Cota de neu)
    const keys = Object.keys(weatherData.hourly);
    const findKey = (baseName) => {
        return keys.find(k => k === baseName) || 
               keys.find(k => k.includes(baseName) && k.includes('ecmwf')) ||
               keys.find(k => k.includes(baseName) && k.includes('gfs')) ||
               keys.find(k => k.includes(baseName));
    };

    const snowKey = findKey('freezing_level_height');
    const tempKey = findKey('temperature_2m'); // Per seguretat
    
    return dayIndices.map(idx => {
        // Recuperem cota de neu crua
        const rawFl = snowKey && weatherData.hourly[snowKey] ? weatherData.hourly[snowKey][idx] : null;
        // Fallback als comparatius si cal
        const fallbackFl = rawFl ?? weatherData.hourlyComparison?.gfs?.[idx]?.freezing_level_height ?? weatherData.hourlyComparison?.icon?.[idx]?.freezing_level_height;
        
        // Càlcul final cota de neu (-300m)
        const snowLevel = (fallbackFl !== null && fallbackFl !== undefined) ? Math.max(0, fallbackFl - 300) : null;

        return {
            time: weatherData.hourly.time[idx],
            temp: weatherData.hourly.temperature_2m ? weatherData.hourly.temperature_2m[idx] : 0,
            rain: weatherData.hourly.precipitation_probability ? weatherData.hourly.precipitation_probability[idx] : 0,
            snowLevel: snowLevel, 
            isDay: weatherData.hourly.is_day ? weatherData.hourly.is_day[idx] : 1,
            code: weatherData.hourly.weather_code ? weatherData.hourly.weather_code[idx] : 0,
            precip: weatherData.hourly.precipitation ? weatherData.hourly.precipitation[idx] : 0,
            wind: weatherData.hourly.wind_speed_10m ? weatherData.hourly.wind_speed_10m[idx] : 0,
            humidity: weatherData.hourly.relative_humidity_2m ? weatherData.hourly.relative_humidity_2m[idx] : 0,
        };
    });
  }, [weatherData, dayIndices]);

    
  const comparisonDataForDay = useMemo(() => {
      if (!weatherData.hourlyComparison || dayIndices.length === 0) return null;

      const extractModelData = (modelArray) => {
          if (!modelArray) return [];
          return dayIndices.map(idx => {
              const d = modelArray[idx];
              if (!d) return null;

              // --- CORRECCIÓ: Recuperem la cota de neu per a la comparativa ---
              let fl = d.freezing_level_height;
              
              // Cerca de seguretat per si la clau té un nom brut
              if (fl === undefined) {
                  const keys = Object.keys(d);
                  const dirtyKey = keys.find(k => k.includes('freezing_level_height'));
                  if (dirtyKey) fl = d[dirtyKey];
              }

              // Càlcul final (-300m)
              const snowLevel = (fl !== null && fl !== undefined) ? Math.max(0, fl - 300) : null;
              // ----------------------------------------------------------------

              return {
                  time: weatherData.hourly.time[idx],
                  temp: d.temperature_2m,
                  rain: d.precipitation_probability,
                  wind: d.wind_speed_10m,
                  cloud: d.cloud_cover,
                  humidity: d.relative_humidity_2m,
                  snowLevel: snowLevel // ARA SÍ: Afegim la dada al gràfic
              };
          }).filter(Boolean);
      };

      return {
          gfs: extractModelData(weatherData.hourlyComparison.gfs),
          icon: extractModelData(weatherData.hourlyComparison.icon)
      };
  }, [weatherData, dayIndices]);

  // 5. Càlcul del rang de cota de neu per mostrar al resum
  const snowLevelRange = useMemo(() => {
     if (hourlyDataForDay.length === 0) return "---";
     const levels = hourlyDataForDay.map(d => d.snowLevel).filter(l => l !== null);
     if (levels.length === 0) return "---";
     const min = Math.min(...levels);
     const max = Math.max(...levels);
     if (min === max) return `${Math.round(min)}m`;
     return `${Math.round(min)} - ${Math.round(max)}m`;
  }, [hourlyDataForDay]);

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString(lang === 'ca' ? 'ca-ES' : lang === 'es' ? 'es-ES' : 'en-US', { 
      weekday: 'long', day: 'numeric', month: 'long' 
    });
  };

  const formatTime = (isoString) => {
    return new Date(isoString).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div 
        className="bg-slate-900 border border-white/10 w-full max-w-4xl max-h-[90vh] overflow-y-auto rounded-3xl shadow-2xl relative animate-in zoom-in-95 duration-300 custom-scrollbar"
        onClick={(e) => e.stopPropagation()}
      >
        <button 
          onClick={onClose}
          className="absolute top-4 right-4 p-2 bg-white/5 hover:bg-white/10 rounded-full transition-colors z-10"
        >
          <X className="w-6 h-6 text-slate-400 hover:text-white" />
        </button>

        <div className="p-6 md:p-8">
          {/* Capçalera del Modal */}
          <div className="flex flex-col md:flex-row gap-6 md:items-center justify-between mb-8 border-b border-white/5 pb-6">
            <div>
               <h2 className="text-3xl font-bold text-white capitalize mb-2">{formatDate(dayData.date)}</h2>
               <div className="flex items-center gap-2 text-slate-400">
                  <Calendar className="w-4 h-4"/>
                  <span className="text-sm font-medium">Previsió detallada del dia</span>
               </div>
            </div>
            
            <div className="flex items-center gap-4 bg-white/5 px-5 py-3 rounded-2xl">
               <div className="flex flex-col items-center">
                  <span className="text-xs text-rose-300 font-bold uppercase tracking-wider">Màx</span>
                  <span className="text-2xl font-bold text-white">{Math.round(dayData.maxTemp)}°</span>
               </div>
               <div className="w-px h-8 bg-white/10"></div>
               <div className="flex flex-col items-center">
                  <span className="text-xs text-cyan-300 font-bold uppercase tracking-wider">Mín</span>
                  <span className="text-2xl font-bold text-white">{Math.round(dayData.minTemp)}°</span>
               </div>
            </div>
          </div>

          {/* Widgets de Resum */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
             <div className="bg-slate-800/50 p-4 rounded-2xl flex flex-col items-center justify-center text-center gap-2">
                <Droplets className="w-6 h-6 text-blue-400 mb-1"/>
                <span className="text-xs text-slate-400 uppercase font-bold">Precipitació Total</span>
                <span className="text-lg font-bold text-slate-200">{dayData.precipSum} mm</span>
             </div>
             
             <div className="bg-slate-800/50 p-4 rounded-2xl flex flex-col items-center justify-center text-center gap-2">
                <Wind className="w-6 h-6 text-teal-400 mb-1"/>
                <span className="text-xs text-slate-400 uppercase font-bold">Vent Màx</span>
                <span className="text-lg font-bold text-slate-200">{dayData.windMax} km/h</span>
             </div>

             <div className="bg-slate-800/50 p-4 rounded-2xl flex flex-col items-center justify-center text-center gap-2">
                <Mountain className="w-6 h-6 text-indigo-300 mb-1"/>
                <span className="text-xs text-slate-400 uppercase font-bold">Cota de neu</span>
                <span className="text-lg font-bold text-slate-200">{snowLevelRange}</span>
             </div>

             <div className="bg-slate-800/50 p-4 rounded-2xl flex flex-col items-center justify-center text-center gap-2">
                <Sun className="w-6 h-6 text-amber-400 mb-1"/>
                <span className="text-xs text-slate-400 uppercase font-bold">Índex UV</span>
                <span className="text-lg font-bold text-slate-200">
                    {dayData.uvMax} 
                    <span className="text-xs ml-1 font-normal opacity-70">
                        {dayData.uvMax > 10 ? '(Extrem)' : dayData.uvMax > 7 ? '(Molt Alt)' : dayData.uvMax > 5 ? '(Alt)' : dayData.uvMax > 2 ? '(Moderat)' : '(Baix)'}
                    </span>
                </span>
             </div>
          </div>
          
          {/* Sol i Lluna */}
          <div className="grid grid-cols-2 gap-4 mb-8">
              <div className="bg-gradient-to-br from-amber-500/10 to-orange-500/10 border border-amber-500/20 p-4 rounded-2xl flex items-center justify-between">
                 <div className="flex items-center gap-3">
                    <div className="p-2 bg-amber-500/20 rounded-full text-amber-400"><Sun className="w-5 h-5"/></div>
                    <div className="flex flex-col">
                        <span className="text-xs text-amber-200/70 font-bold uppercase">Sortida Sol</span>
                        <span className="text-xl font-bold text-amber-100">{formatTime(dayData.sunrise)}</span>
                    </div>
                 </div>
              </div>

              <div className="bg-gradient-to-br from-indigo-500/10 to-purple-500/10 border border-indigo-500/20 p-4 rounded-2xl flex items-center justify-between">
                 <div className="flex items-center gap-3">
                    <div className="p-2 bg-indigo-500/20 rounded-full text-indigo-400"><Moon className="w-5 h-5"/></div>
                    <div className="flex flex-col">
                        <span className="text-xs text-indigo-200/70 font-bold uppercase">Posta Sol</span>
                        <span className="text-xl font-bold text-indigo-100">{formatTime(dayData.sunset)}</span>
                    </div>
                 </div>
              </div>
          </div>

          {/* GRÀFIC HORARI AMB COMPARATIVA */}
          <div className="bg-slate-950/50 border border-white/5 rounded-3xl p-4 md:p-6">
             <h3 className="font-bold text-white mb-6 flex items-center gap-2">
                <Thermometer className="w-5 h-5 text-indigo-400"/> Evolució Horària
             </h3>
             
             <HourlyForecastChart 
                data={hourlyDataForDay} 
                comparisonData={comparisonDataForDay} // AQUI ESTÀ LA CLAU
                unit={unit} 
                lang={lang} 
                shiftedNow={shiftedNow}
                isDetailView={true} 
             />
          </div>

        </div>
      </div>
    </div>
  );
}