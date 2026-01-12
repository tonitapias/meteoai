// src/components/DayDetailModal.tsx
import React, { useMemo } from 'react';
import { X, Calendar, Droplets, Wind, Thermometer, Sun, Moon, Mountain } from 'lucide-react';
import { SmartForecastCharts } from './WeatherCharts'; // <--- CORRECCIÓ: Importem el nou component
import { TRANSLATIONS, Language } from '../constants/translations';
import { ExtendedWeatherData } from '../utils/weatherLogic';
import { WeatherUnit } from '../utils/formatters';

interface DayDetailModalProps {
  weatherData: ExtendedWeatherData | null;
  selectedDayIndex: number | null;
  onClose: () => void;
  unit: WeatherUnit;
  lang: Language;
  shiftedNow: Date;
}

export default function DayDetailModal({ 
  weatherData, 
  selectedDayIndex, 
  onClose, 
  unit, 
  lang,
  shiftedNow
}: DayDetailModalProps) {
  const t = TRANSLATIONS[lang] || TRANSLATIONS['ca'];

  if (selectedDayIndex === null || !weatherData) return null;

  // Dades diàries
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

  // Índexs horaris
  const dayIndices = useMemo(() => {
    if (!dayData.date) return [];
    const targetDayStr = dayData.date.includes('T') ? dayData.date.split('T')[0] : dayData.date;

    return weatherData.hourly.time
      .map((t, idx) => ({ 
        datePart: t.includes('T') ? t.split('T')[0] : t, 
        idx 
      }))
      .filter(item => item.datePart === targetDayStr)
      .map(item => item.idx);
  }, [weatherData, dayData]);

  // Construcció de dades horàries
  const hourlyDataForDay = useMemo(() => {
    if (dayIndices.length === 0) return [];

    return dayIndices.map(idx => {
        let fl = weatherData.hourly.freezing_level_height ? weatherData.hourly.freezing_level_height[idx] : null;
        
        // Fallback si falta la cota de neu
        if (fl === null || fl === undefined) {
             fl = weatherData.hourlyComparison?.gfs?.[idx]?.freezing_level_height ?? 
                  weatherData.hourlyComparison?.icon?.[idx]?.freezing_level_height;
        }

        const snowLevel = (fl !== null && fl !== undefined) ? Math.max(0, fl - 300) : null;

        return {
            time: weatherData.hourly.time[idx],
            temp: weatherData.hourly.temperature_2m[idx],
            rain: weatherData.hourly.precipitation_probability[idx],
            snowLevel: snowLevel, 
            isDay: weatherData.hourly.is_day[idx],
            code: weatherData.hourly.weather_code[idx],
            precip: weatherData.hourly.precipitation[idx],
            wind: weatherData.hourly.wind_speed_10m[idx],
            humidity: weatherData.hourly.relative_humidity_2m[idx],
        };
    });
  }, [weatherData, dayIndices]);

  const comparisonDataForDay = useMemo(() => {
      if (!weatherData.hourlyComparison || dayIndices.length === 0) return null;

      const extractModelData = (modelArray: any[]) => {
          if (!modelArray || !modelArray.length) return [];
          return dayIndices.map(idx => {
              const d = modelArray[idx];
              if (!d) return null;
              
              const fl = d.freezing_level_height;
              const snowLevel = (fl !== null && fl !== undefined) ? Math.max(0, fl - 300) : null;

              return {
                  time: weatherData.hourly.time[idx],
                  temp: d.temperature_2m,
                  rain: d.precipitation_probability,
                  wind: d.wind_speed_10m,
                  cloud: d.cloud_cover,
                  humidity: d.relative_humidity_2m,
                  snowLevel: snowLevel 
              };
          }).filter(Boolean);
      };

      return {
          gfs: extractModelData(weatherData.hourlyComparison.gfs),
          icon: extractModelData(weatherData.hourlyComparison.icon)
      };
  }, [weatherData, dayIndices]);

  const snowLevelRange = useMemo(() => {
     if (hourlyDataForDay.length === 0) return "---";
     const levels = hourlyDataForDay.map(d => d.snowLevel).filter((l): l is number => l !== null && l !== undefined);
     if (levels.length === 0) return "---";
     const min = Math.min(...levels);
     const max = Math.max(...levels);
     if (Math.abs(max - min) < 50) return `${Math.round(min)}m`;
     if (min > 4500) return "> 4500m";
     return `${Math.round(min)} - ${Math.round(max)}m`;
  }, [hourlyDataForDay]);

  const formatDate = (dateString: string) => {
    const locale = lang === 'ca' ? 'ca-ES' : lang === 'es' ? 'es-ES' : lang === 'fr' ? 'fr-FR' : 'en-US';
    return new Date(dateString).toLocaleDateString(locale, { 
      weekday: 'long', day: 'numeric', month: 'long' 
    });
  };

  const formatTime = (isoString: string) => {
    return new Date(isoString).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
  };

  const getUVLevelText = (val: number) => {
      if (val > 10) return `(${t.uvExtreme})`;
      if (val > 7) return `(${t.uvVeryHigh})`;
      if (val > 5) return `(${t.uvHigh})`;
      if (val > 2) return `(${t.uvMod})`;
      return `(${t.uvLow})`;
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div 
        className="bg-slate-900 border border-white/10 w-full max-w-4xl max-h-[90vh] overflow-y-auto rounded-3xl shadow-2xl relative animate-in zoom-in-95 duration-300 custom-scrollbar"
        onClick={(e) => e.stopPropagation()}
      >
        <button 
          onClick={onClose}
          aria-label={"Tancar"}
          className="absolute top-4 right-4 p-2 bg-white/5 hover:bg-white/10 rounded-full transition-colors z-10"
        >
          <X className="w-6 h-6 text-slate-400 hover:text-white" />
        </button>

        <div className="p-6 md:p-8">
          <div className="flex flex-col md:flex-row gap-6 md:items-center justify-between mb-8 border-b border-white/5 pb-6">
            <div>
               <h2 className="text-3xl font-bold text-white capitalize mb-2">{formatDate(dayData.date)}</h2>
               <div className="flex items-center gap-2 text-slate-400">
                  <Calendar className="w-4 h-4" strokeWidth={2.5}/>
                  <span className="text-sm font-medium">{t.dayDetailTitle}</span>
               </div>
            </div>
            
            <div className="flex items-center gap-4 bg-white/5 px-5 py-3 rounded-2xl">
               <div className="flex flex-col items-center">
                  <span className="text-xs text-rose-300 font-bold uppercase tracking-wider">{t.max}</span>
                  <span className="text-2xl font-bold text-white">{Math.round(dayData.maxTemp)}°</span>
               </div>
               <div className="w-px h-8 bg-white/10"></div>
               <div className="flex flex-col items-center">
                  <span className="text-xs text-cyan-300 font-bold uppercase tracking-wider">{t.min}</span>
                  <span className="text-2xl font-bold text-white">{Math.round(dayData.minTemp)}°</span>
               </div>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
             <div className="bg-slate-800/50 p-4 rounded-2xl flex flex-col items-center justify-center text-center gap-2">
                <Droplets className="w-6 h-6 text-blue-400 mb-1" strokeWidth={2.5}/>
                <span className="text-xs text-slate-400 uppercase font-bold">{t.totalPrecipitation}</span>
                <span className="text-lg font-bold text-slate-200">{dayData.precipSum} mm</span>
             </div>
             
             <div className="bg-slate-800/50 p-4 rounded-2xl flex flex-col items-center justify-center text-center gap-2">
                <Wind className="w-6 h-6 text-teal-400 mb-1" strokeWidth={2.5}/>
                <span className="text-xs text-slate-400 uppercase font-bold">{t.windMax}</span>
                <span className="text-lg font-bold text-slate-200">{dayData.windMax} km/h</span>
             </div>

             <div className="bg-slate-800/50 p-4 rounded-2xl flex flex-col items-center justify-center text-center gap-2">
                <Mountain className="w-6 h-6 text-indigo-300 mb-1" strokeWidth={2.5}/>
                <span className="text-xs text-slate-400 uppercase font-bold">{t.snowLevel}</span>
                <span className="text-lg font-bold text-slate-200">{snowLevelRange}</span>
             </div>

             <div className="bg-slate-800/50 p-4 rounded-2xl flex flex-col items-center justify-center text-center gap-2">
                <Sun className="w-6 h-6 text-amber-400 mb-1" strokeWidth={2.5}/>
                <span className="text-xs text-slate-400 uppercase font-bold">{t.uvIndex}</span>
                <span className="text-lg font-bold text-slate-200">
                    {dayData.uvMax} 
                    <span className="text-xs ml-1 font-normal opacity-70">{getUVLevelText(dayData.uvMax)}</span>
                </span>
             </div>
          </div>
          
          <div className="grid grid-cols-2 gap-4 mb-8">
              <div className="bg-gradient-to-br from-amber-500/10 to-orange-500/10 border border-amber-500/20 p-4 rounded-2xl flex items-center justify-between">
                 <div className="flex items-center gap-3">
                    <div className="p-2 bg-amber-500/20 rounded-full text-amber-400"><Sun className="w-5 h-5"/></div>
                    <div className="flex flex-col">
                        <span className="text-xs text-amber-200/70 font-bold uppercase">{t.sunrise}</span>
                        <span className="text-xl font-bold text-amber-100">{formatTime(dayData.sunrise)}</span>
                    </div>
                 </div>
              </div>

              <div className="bg-gradient-to-br from-indigo-500/10 to-purple-500/10 border border-indigo-500/20 p-4 rounded-2xl flex items-center justify-between">
                 <div className="flex items-center gap-3">
                    <div className="p-2 bg-indigo-500/20 rounded-full text-indigo-400"><Moon className="w-5 h-5"/></div>
                    <div className="flex flex-col">
                        <span className="text-xs text-indigo-200/70 font-bold uppercase">{t.sunset}</span>
                        <span className="text-xl font-bold text-indigo-100">{formatTime(dayData.sunset)}</span>
                    </div>
                 </div>
              </div>
          </div>

          <div className="bg-slate-950/50 border border-white/5 rounded-3xl p-4 md:p-6">
             <h3 className="font-bold text-white mb-6 flex items-center gap-2">
                <Thermometer className="w-5 h-5 text-indigo-400" strokeWidth={2.5}/> {t.hourlyEvolution}
             </h3>
             
             {/* CORRECCIÓ: Usem SmartForecastCharts amb formatatge d'unitat */}
             <SmartForecastCharts 
                data={hourlyDataForDay} 
                comparisonData={comparisonDataForDay} 
                unit={unit === 'F' ? '°F' : '°C'} 
                lang={lang} 
             />
          </div>

        </div>
      </div>
    </div>
  );
}