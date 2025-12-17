import React, { useMemo } from 'react';
import { 
  X, Split, Clock, CloudSnow, Umbrella, Wind, Mountain, 
  Sun, Activity, Sunrise, Sunset 
} from 'lucide-react';

import { TRANSLATIONS } from '../constants/translations';
import { HourlyForecastChart } from './WeatherCharts';
import { formatTemp, getUnitLabel, formatTime, formatDate } from '../utils/formatters'; 
import { getWeatherIcon } from './WeatherIcons';

const DetailStat = ({ label, value, icon }) => (
  <div className="bg-slate-950/80 p-4 rounded-2xl border border-slate-800 flex flex-col items-center hover:border-slate-600 transition-colors">
     <div className="text-slate-400 text-xs mb-2 flex items-center gap-1.5 font-medium uppercase tracking-wide">{icon} {label}</div>
     <div className="font-bold text-white text-lg">{value}</div>
  </div>
);

export default function DayDetailModal({ 
  weatherData, 
  selectedDayIndex, 
  onClose, 
  unit, 
  lang, 
  viewMode, 
  shiftedNow
}) { // <--- AQUÍ FALTAVA TANCAR EL PARÈNTESI I OBRIR LA CLAU
  
  const t = TRANSLATIONS[lang];

  // 1. Hooks de càlcul de dades
  const dayHourlyData = useMemo(() => {
    if (selectedDayIndex === null || !weatherData?.hourly?.temperature_2m) return [];
    
    const dayIdx = selectedDayIndex;
    const startHour = dayIdx * 24;
    const endHour = startHour + 24;
    
    return weatherData.hourly.temperature_2m.slice(startHour, endHour).map((temp, i) => ({
      temp: formatTemp(temp, unit),
      apparent: formatTemp(weatherData.hourly.apparent_temperature[startHour + i], unit),
      rain: weatherData.hourly.precipitation_probability[startHour + i],
      precip: weatherData.hourly.precipitation[startHour + i], 
      wind: weatherData.hourly.wind_speed_10m[startHour + i],
      windDir: weatherData.hourly.wind_direction_10m[startHour + i],
      cloud: weatherData.hourly.cloud_cover[startHour + i],
      humidity: weatherData.hourly.relative_humidity_2m[startHour + i],
      uv: weatherData.hourly.uv_index[startHour + i],
      snowLevel: weatherData.hourly.freezing_level_height ? Math.max(0, weatherData.hourly.freezing_level_height[startHour + i] - 300) : 0,
      time: weatherData.hourly.time[startHour + i],
      isDay: weatherData.hourly.is_day[startHour + i],
      code: weatherData.hourly.weather_code[startHour + i]
    }));
  }, [weatherData, selectedDayIndex, unit]);

  const dayComparisonData = useMemo(() => {
      if (!weatherData?.hourlyComparison || selectedDayIndex === null) return null;
      const startHour = selectedDayIndex * 24;
      const endHour = startHour + 24;

      const sliceModel = (modelData) => {
          if (!modelData) return [];
          return modelData.slice(startHour, endHour).map((d, i) => ({
              temp: formatTemp(d.temperature_2m, unit),
              rain: d.precipitation_probability,
              wind: d.wind_speed_10m,
              cloud: d.cloud_cover,
              humidity: d.relative_humidity_2m,
              time: weatherData.hourly.time[startHour + i]
          }));
      };

      return {
          gfs: sliceModel(weatherData.hourlyComparison.gfs),
          icon: sliceModel(weatherData.hourlyComparison.icon)
      };
  }, [weatherData, selectedDayIndex, unit]);

  const dailyModelComparison = useMemo(() => {
      if(!weatherData?.dailyComparison || selectedDayIndex === null) return null;
      const dayIdx = selectedDayIndex;
      
      const getData = (source) => {
           if(!source) return { max: '-', min: '-', rain: '-' };
           return {
               max: source.temperature_2m_max ? formatTemp(source.temperature_2m_max[dayIdx], unit) + '°' : '-',
               min: source.temperature_2m_min ? formatTemp(source.temperature_2m_min[dayIdx], unit) + '°' : '-',
               rain: source.precipitation_probability_max ? source.precipitation_probability_max[dayIdx] + '%' : '-'
           };
      };

      return {
          best: getData(weatherData.daily),
          gfs: getData(weatherData.dailyComparison.gfs),
          icon: getData(weatherData.dailyComparison.icon)
      };
  }, [weatherData, selectedDayIndex, unit]);

  // Si no hi ha dia seleccionat, no renderitzem res
  if (selectedDayIndex === null || !weatherData) return null;

  const dateStr = weatherData.daily.time[selectedDayIndex];
  const precipSum = weatherData.daily.precipitation_sum[selectedDayIndex];
  const snowSum = weatherData.daily.snowfall_sum[selectedDayIndex];
  const uvIndex = weatherData.daily.uv_index_max[selectedDayIndex];

  const freezingLevels = dayHourlyData.map(d => d.snowLevel).filter(val => val !== undefined && val !== null);
  const minSnowLevel = freezingLevels.length ? Math.min(...freezingLevels) : 0;
  const maxSnowLevel = freezingLevels.length ? Math.max(...freezingLevels) : 0;

  return (
    <div className="fixed inset-0 z-[100] flex items-end md:items-center justify-center p-0 md:p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200" onClick={onClose}>
      <div 
        className="bg-slate-900 border-t md:border border-slate-700 w-full max-w-2xl rounded-t-3xl md:rounded-3xl shadow-2xl overflow-hidden animate-in slide-in-from-bottom duration-300 max-h-[90vh] overflow-y-auto custom-scrollbar"
        onClick={e => e.stopPropagation()}
      >
        <div className="md:hidden w-full flex justify-center pt-3 pb-1">
           <div className="w-12 h-1.5 bg-slate-700 rounded-full"></div>
        </div>

        {/* HEADER */}
        <div className="bg-slate-800/50 p-6 flex justify-between items-center border-b border-slate-700 sticky top-0 backdrop-blur-md z-20">
          <div>
            <h3 className="text-xl font-bold text-white capitalize">
              {formatDate(dateStr, lang, { weekday: 'long', day: 'numeric', month: 'long' })}
            </h3>
            <p className="text-xs text-slate-400">{t.detailedForecast}</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-700 rounded-full text-white transition-colors">
            <X className="w-5 h-5" strokeWidth={2.5} />
          </button>
        </div>

        <div className="p-6 space-y-6">
          
          {/* COMPARACIÓ DE MODELS */}
          {dailyModelComparison && (
             <div className="bg-slate-950/50 rounded-2xl p-4 border border-indigo-500/20 shadow-inner">
                <div className="flex items-center gap-2 mb-3 text-sm font-bold text-indigo-300 uppercase tracking-wider">
                    <Split className="w-4 h-4" /> {t.modelCompareTitle}
                </div>
                <div className="grid grid-cols-4 gap-2 text-xs md:text-sm">
                    <div className="text-slate-500 font-bold">Model</div>
                    <div className="text-slate-400 text-center font-medium">Max</div>
                    <div className="text-slate-400 text-center font-medium">Min</div>
                    <div className="text-slate-400 text-center font-medium">Pluja</div>

                    <div className="flex items-center gap-1.5 font-bold text-indigo-300">
                        <div className="w-2 h-2 rounded-full bg-indigo-500"></div> ECMWF
                    </div>
                    <div className="text-center text-white font-bold bg-white/5 rounded py-1">{dailyModelComparison.best.max}</div>
                    <div className="text-center text-white font-bold bg-white/5 rounded py-1">{dailyModelComparison.best.min}</div>
                    <div className="text-center text-blue-300 font-bold bg-blue-500/10 rounded py-1">{dailyModelComparison.best.rain}</div>

                    <div className="flex items-center gap-1.5 font-bold text-green-300">
                         <div className="w-2 h-2 rounded-full bg-green-500"></div> GFS
                    </div>
                    <div className="text-center text-white font-bold bg-white/5 rounded py-1">{dailyModelComparison.gfs.max}</div>
                    <div className="text-center text-white font-bold bg-white/5 rounded py-1">{dailyModelComparison.gfs.min}</div>
                    <div className="text-center text-blue-300 font-bold bg-blue-500/10 rounded py-1">{dailyModelComparison.gfs.rain}</div>

                    <div className="flex items-center gap-1.5 font-bold text-amber-300">
                         <div className="w-2 h-2 rounded-full bg-amber-500"></div> ICON
                    </div>
                    <div className="text-center text-white font-bold bg-white/5 rounded py-1">{dailyModelComparison.icon.max}</div>
                    <div className="text-center text-white font-bold bg-white/5 rounded py-1">{dailyModelComparison.icon.min}</div>
                    <div className="text-center text-blue-300 font-bold bg-blue-500/10 rounded py-1">{dailyModelComparison.icon.rain}</div>
                </div>
             </div>
          )}

          {/* GRÀFICA EXPERT */}
          {viewMode === 'expert' && (
            <div className="bg-slate-950/30 rounded-2xl p-4 border border-white/5">
              <div className="flex items-center justify-between mb-4">
                 <div className="flex items-center gap-2 text-sm font-bold text-slate-300">
                   <Clock className="w-4 h-4 text-indigo-400 drop-shadow-sm fill-indigo-400/20" strokeWidth={2.5}/> {t.hourlyEvolution}
                 </div>
              </div>
              <HourlyForecastChart data={dayHourlyData} comparisonData={dayComparisonData} unit={getUnitLabel(unit)} lang={lang} shiftedNow={shiftedNow} />
            </div>
          )}
          
          {/* LLISTA BÀSICA */}
          {viewMode === 'basic' && (
             <div className="flex gap-4 overflow-x-auto pb-2 custom-scrollbar">
                {dayHourlyData.filter((_, i) => i % 3 === 0).map((h, i) => (
                   <div key={i} className="flex flex-col items-center min-w-[3rem]">
                      <span className="text-xs text-slate-400">{new Date(h.time).getHours()}h</span>
                      {/* Crida a getWeatherIcon importat */}
                      <div className="my-1 scale-75">{getWeatherIcon(h.code, "w-6 h-6", h.isDay, h.rain, h.wind)}</div>
                      <span className="text-sm font-bold">{Math.round(h.temp)}°</span>
                      <div className="flex flex-col items-center mt-1 h-6 justify-start">
                         {h.rain > 0 && <span className="text-[10px] text-blue-400 font-bold">{h.rain}%</span>}
                         {h.precip > 0.25 && <span className="text-[9px] text-cyan-400 font-bold">{h.precip}mm</span>}
                      </div>
                   </div>
                ))}
             </div>
          )}

          {/* GRID D'ESTADÍSTIQUES */}
          <div className="grid grid-cols-2 gap-4">
            {snowSum > 0 ? (
               <DetailStat label={t.snowAccumulated} value={`${snowSum} cm`} icon={<CloudSnow className="w-4 h-4 text-cyan-200 drop-shadow-sm fill-cyan-200/20" strokeWidth={2.5}/>} />
            ) : precipSum > 0.25 ? (
               <DetailStat label={t.totalPrecipitation} value={`${Math.round(precipSum)} mm`} icon={<Umbrella className="w-4 h-4 text-blue-400 drop-shadow-sm fill-blue-400/20" strokeWidth={2.5}/>} />
            ) : (
               <DetailStat label={t.rainProb} value={`${weatherData.daily.precipitation_probability_max[selectedDayIndex]}%`} icon={<Umbrella className="w-4 h-4 text-blue-400 drop-shadow-sm fill-blue-400/20" strokeWidth={2.5}/>} />
            )}
            
            <DetailStat label={t.windMax} value={`${weatherData.daily.wind_speed_10m_max[selectedDayIndex]} km/h`} icon={<Wind className="w-4 h-4 text-teal-400 drop-shadow-sm fill-teal-400/20" strokeWidth={2.5}/>} />
            
            <DetailStat 
               label={t.snowLevel} 
               value={`${Math.round(minSnowLevel)} - ${Math.round(maxSnowLevel)}m`} 
               icon={<Mountain className="w-4 h-4 text-stone-400 drop-shadow-sm fill-stone-400/20" strokeWidth={2.5}/>} 
            />

            <div className="bg-slate-950/80 p-4 rounded-2xl border border-slate-800 flex flex-col items-center hover:border-slate-600 transition-colors">
               <div className="text-slate-400 text-xs mb-2 flex items-center gap-1.5 font-medium uppercase tracking-wide"><Sun className="w-4 h-4 text-amber-400 drop-shadow-sm fill-amber-400/20" strokeWidth={2.5}/> {t.uvIndex}</div>
               <div className="font-bold text-white text-lg">{uvIndex}</div>
               <div className="w-full h-1.5 bg-slate-700 rounded-full mt-2 overflow-hidden flex">
                  <div className={`h-full ${uvIndex <= 2 ? 'bg-green-400' : uvIndex <= 5 ? 'bg-yellow-400' : uvIndex <= 7 ? 'bg-orange-400' : uvIndex <= 10 ? 'bg-red-500' : 'bg-purple-500'}`} style={{width: `${Math.min((uvIndex/11)*100, 100)}%`}}></div>
               </div>
               <div className="text-[9px] text-slate-500 mt-1 uppercase font-bold">
                  {uvIndex <= 2 ? t.uvLow : uvIndex <= 5 ? t.uvMod : uvIndex <= 7 ? t.uvHigh : uvIndex <= 10 ? t.uvVeryHigh : t.uvExtreme}
               </div>
            </div>

            <DetailStat label={t.tempMin} value={`${formatTemp(weatherData.daily.temperature_2m_min[selectedDayIndex], unit)}${getUnitLabel(unit)}`} icon={<Activity className="w-4 h-4 text-indigo-400 drop-shadow-sm fill-indigo-400/20" strokeWidth={2.5}/>} />
            <DetailStat label={t.sunrise} value={formatTime(weatherData.daily.sunrise[selectedDayIndex], lang)} icon={<Sunrise className="w-4 h-4 text-orange-400 drop-shadow-sm fill-orange-400/20" strokeWidth={2.5}/>} />
            <DetailStat label={t.sunset} value={formatTime(weatherData.daily.sunset[selectedDayIndex], lang)} icon={<Sunset className="w-4 h-4 text-purple-400 drop-shadow-sm fill-purple-400/20" strokeWidth={2.5}/>} />
          </div>
        </div>
      </div>
    </div>
  );
}