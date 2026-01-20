import React, { useMemo } from 'react';
import { X, Calendar, Droplets, Wind, Thermometer, Sun, Moon, Mountain, Clock, ArrowDown, ArrowUp } from 'lucide-react';
import { SmartForecastCharts } from './WeatherCharts'; 
import { TRANSLATIONS, Language } from '../constants/translations';
import { ExtendedWeatherData } from '../utils/weatherLogic';
import { WeatherUnit } from '../utils/formatters';
import { useDayDetailData } from '../hooks/useDayDetailData';
import { getWeatherIcon } from './WeatherIcons';

interface StatCardProps {
  icon: React.ElementType;
  label: string;
  value: string | number;
  sub?: string;
  color: string;
}

const StatCard = ({ icon: Icon, label, value, sub, color }: StatCardProps) => (
  <div className="bg-[#151725] border border-white/5 p-4 rounded-2xl flex flex-col items-center justify-center text-center gap-2 shadow-lg group hover:border-white/10 transition-colors">
    <div className={`p-2 rounded-xl bg-white/5 ${color} bg-opacity-10 mb-1`}>
        <Icon className={`w-5 h-5 ${color}`} strokeWidth={2.5}/>
    </div>
    <span className="text-[10px] text-slate-500 uppercase font-black tracking-widest">{label}</span>
    <span className="text-xl font-mono font-bold text-slate-200 tabular-nums">
      {value}<span className="text-xs ml-0.5 font-bold text-slate-500">{sub}</span>
    </span>
  </div>
);

interface DayDetailModalProps {
  weatherData: ExtendedWeatherData | null;
  selectedDayIndex: number | null;
  onClose: () => void;
  unit: WeatherUnit;
  lang: Language;
  shiftedNow?: Date;
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
  
  const { dayData, hourlyData, comparisonData, snowLevelText } = useDayDetailData(weatherData, selectedDayIndex);

  const tableRows = useMemo(() => {
    if (!weatherData || selectedDayIndex === null || !weatherData.hourly) return [];
    
    // Obtenim la data base del dia seleccionat
    const dateStr = weatherData.daily.time[selectedDayIndex];
    const startIndex = weatherData.hourly.time.findIndex((t: string) => t.startsWith(dateStr));
    
    if (startIndex === -1) return [];

    // Obtenim hores de sortida i posta de sol REALS per a aquest dia
    let sunriseHour = 7;
    let sunsetHour = 20;
    
    if (weatherData.daily.sunrise?.[selectedDayIndex] && weatherData.daily.sunset?.[selectedDayIndex]) {
        sunriseHour = new Date(weatherData.daily.sunrise[selectedDayIndex]).getHours();
        sunsetHour = new Date(weatherData.daily.sunset[selectedDayIndex]).getHours();
    }

    return Array.from({ length: 24 }).map((_, i) => {
        const idx = startIndex + i;
        if (idx >= weatherData.hourly.time.length) return null;

        const time = weatherData.hourly.time[idx];
        const temp = weatherData.hourly.temperature_2m[idx];
        
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const h = weatherData.hourly as any;
        const code = h.weather_code?.[idx] ?? h.weathercode?.[idx] ?? 0;
        
        const precipProb = weatherData.hourly.precipitation_probability?.[idx] ?? 0;
        const precipSum = weatherData.hourly.precipitation?.[idx] ?? 0;
        const windSpeed = weatherData.hourly.wind_speed_10m?.[idx] ?? 0;
        
        // Lògica de dia/nit dinàmica
        const currentHour = parseInt(time.split('T')[1].slice(0, 2), 10);
        const isDay = currentHour >= sunriseHour && currentHour < sunsetHour;

        return {
            hour: time.split('T')[1].slice(0, 5),
            temp,
            code,
            precipProb,
            precipSum,
            windSpeed,
            isDay
        };
    }).filter(Boolean);
  }, [weatherData, selectedDayIndex]);

  if (!dayData) return null;

  const formatTime = (isoString?: string) => {
      if (!isoString) return "--:--";
      const date = new Date(isoString);
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }); 
  };

  const formatDate = (isoString: string) => {
      const date = new Date(isoString);
      return date.toLocaleDateString(lang === 'en' ? 'en-US' : lang === 'es' ? 'es-ES' : 'ca-ES', {
          weekday: 'long', day: 'numeric', month: 'long'
      });
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-[#05060A]/90 backdrop-blur-xl animate-in fade-in duration-300">
      <div className="bg-[#0B0C15] border border-white/10 w-full max-w-4xl max-h-[90vh] overflow-y-auto custom-scrollbar rounded-[2.5rem] shadow-2xl relative ring-1 ring-white/5">
          <button 
            onClick={onClose}
            className="absolute top-6 right-6 p-2.5 bg-[#151725] rounded-full text-slate-400 hover:text-white border border-white/10 hover:border-white/30 transition-all z-50 hover:rotate-90 duration-300"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="p-8 pb-10 bg-[#11131f] border-b border-white/5 relative overflow-hidden">
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-indigo-500 via-purple-500 to-indigo-500 opacity-50"></div>
              
              <div className="flex flex-col items-center justify-center text-center relative z-10">
                  <div className="flex items-center gap-2 text-indigo-400 font-black uppercase tracking-[0.3em] text-[10px] mb-3 bg-indigo-500/10 px-3 py-1 rounded-full border border-indigo-500/20">
                      <Calendar className="w-3.5 h-3.5" /> {t.forecast || "DETALL DEL DIA"}
                  </div>
                  
                  <h2 className="text-3xl md:text-5xl font-black text-white capitalize tracking-tight mb-2">
                      {formatDate(dayData.date)}
                  </h2>
                  
                  <div className="flex items-center justify-center gap-6 mt-4">
                      <div className="flex items-center gap-2">
                          <ArrowUp className="w-5 h-5 text-rose-400" />
                          <span className="text-4xl font-mono font-medium text-white tracking-tighter tabular-nums">
                              {Math.round(dayData.maxTemp)}°
                          </span>
                      </div>
                      <div className="w-px h-8 bg-white/10"></div>
                      <div className="flex items-center gap-2">
                          <ArrowDown className="w-5 h-5 text-cyan-400" />
                          <span className="text-4xl font-mono font-medium text-slate-400 tracking-tighter tabular-nums">
                              {Math.round(dayData.minTemp)}°
                          </span>
                      </div>
                  </div>
              </div>
          </div>

          <div className="p-6 md:p-8 space-y-8">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <StatCard icon={Droplets} label={t.precip || "PRECIPITACIÓ"} value={`${(dayData.precipSum || 0).toFixed(1)}`} sub="mm" color="text-blue-400" />
                <StatCard icon={Wind} label={t.wind || "VENT MÀX"} value={`${Math.round(dayData.windMax || 0)}`} sub="km/h" color="text-emerald-400" />
                <StatCard icon={Sun} label="INDEX UV" value={`${(dayData.uvMax || 0).toFixed(1)}`} sub="" color="text-amber-400" />
                <StatCard icon={Mountain} label={t.snowLevel || "COTA NEU"} value={typeof snowLevelText === 'number' ? Math.round(snowLevelText) : snowLevelText} sub={typeof snowLevelText === 'number' ? (unit === 'F' ? 'ft' : 'm') : ''} color="text-indigo-300" />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-[#151725] border border-white/5 p-5 rounded-3xl flex items-center justify-between group hover:border-amber-500/20 transition-colors">
                   <div className="flex items-center gap-4">
                      <div className="p-3 bg-amber-500/10 rounded-2xl text-amber-400 border border-amber-500/20"><Sun className="w-6 h-6"/></div>
                      <div>
                          <span className="text-[10px] text-slate-500 font-black uppercase tracking-widest">{t.sunrise}</span>
                          <div className="text-2xl font-mono font-bold text-white tabular-nums">{formatTime(dayData.sunrise)}</div>
                      </div>
                   </div>
                </div>

                <div className="bg-[#151725] border border-white/5 p-5 rounded-3xl flex items-center justify-between group hover:border-indigo-500/20 transition-colors">
                   <div className="flex items-center gap-4">
                      <div className="p-3 bg-indigo-500/10 rounded-2xl text-indigo-400 border border-indigo-500/20"><Moon className="w-6 h-6"/></div>
                      <div>
                          <span className="text-[10px] text-slate-500 font-black uppercase tracking-widest">{t.sunset}</span>
                          <div className="text-2xl font-mono font-bold text-white tabular-nums">{formatTime(dayData.sunset)}</div>
                      </div>
                   </div>
                </div>
            </div>

            <div className="bg-[#151725] border border-white/5 rounded-[2.5rem] p-6 md:p-8 shadow-inner">
               <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-[0.25em] mb-6 flex items-center gap-2">
                  <Thermometer className="w-4 h-4 text-indigo-400" /> 
                  {t.hourlyEvolution || "EVOLUCIÓ TÈRMICA"}
               </h3>
               <SmartForecastCharts 
                  data={hourlyData} 
                  comparisonData={comparisonData} 
                  unit={unit === 'F' ? '°F' : '°C'} 
                  lang={lang} 
                  activeDayDate={dayData.date}
                  shiftedNow={shiftedNow}
               />
            </div>

            {tableRows && tableRows.length > 0 && (
                <div className="bg-[#151725] border border-white/5 rounded-[2.5rem] overflow-hidden">
                    <div className="px-8 py-6 border-b border-white/5 bg-[#1a1d2d]">
                         <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-[0.25em] flex items-center gap-2">
                            <Clock className="w-4 h-4 text-emerald-400" /> 
                            PREVISIÓ PER HORES
                        </h3>
                    </div>
                    <div className="divide-y divide-white/5">
                        <div className="grid grid-cols-12 px-6 py-3 text-[9px] font-black uppercase tracking-widest text-slate-600">
                            <div className="col-span-2">HORA</div>
                            <div className="col-span-2 text-center">CEL</div>
                            <div className="col-span-3 text-center">TEMP</div>
                            <div className="col-span-3 text-right">PLUJA</div>
                            <div className="col-span-2 text-right">VENT</div>
                        </div>
                        {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                        {tableRows.map((row: any, idx) => (
                            <div key={idx} className="grid grid-cols-12 px-6 py-4 items-center hover:bg-white/5 transition-colors group">
                                <div className="col-span-2 text-sm font-mono font-bold text-slate-400 group-hover:text-white">
                                    {row.hour}
                                </div>
                                <div className="col-span-2 flex justify-center">
                                    <div className="scale-75 origin-center">{getWeatherIcon(row.code, "w-8 h-8", row.isDay)}</div>
                                </div>
                                <div className="col-span-3 text-center text-sm font-mono font-bold text-white tabular-nums">
                                    {Math.round(row.temp)}°
                                </div>
                                <div className="col-span-3 flex justify-end items-center gap-1.5">
                                    {row.precipProb > 0 ? (
                                        <>
                                            <span className="text-[10px] font-bold text-blue-400">{row.precipProb}%</span>
                                            {row.precipSum > 0 && <span className="text-[9px] text-slate-600 font-mono hidden md:inline">{row.precipSum}mm</span>}
                                        </>
                                    ) : <span className="text-slate-700">-</span>}
                                </div>
                                <div className="col-span-2 text-right text-xs font-mono font-bold text-slate-500 group-hover:text-emerald-400 tabular-nums">
                                    {Math.round(row.windSpeed)} <span className="text-[9px]">km/h</span>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}
            
            <div className="h-6"></div>
          </div>
      </div>
    </div>
  );
}