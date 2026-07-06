import React, { useMemo, useEffect, useCallback } from 'react';
import { X, Calendar, Droplets, Wind, Thermometer, Sun, Moon, Mountain, Clock, ArrowDown, ArrowUp } from 'lucide-react';
import { SmartForecastCharts } from './WeatherCharts'; 
import { TRANSLATIONS, Language } from '../translations';
import { ExtendedWeatherData } from '../types/weatherLogicTypes';
import { WeatherUnit, formatPrecipitation } from '../utils/formatters';
import { useDayDetailData } from '../hooks/useDayDetailData';
import { getWeatherIcon } from './WeatherIcons';

interface StatCardProps {
  icon: React.ElementType;
  label: string;
  value: string | number;
  sub?: string;
  color: string;
  glowClasses: string;
}

const StatCard = ({ icon: Icon, label, value, sub, color, glowClasses }: StatCardProps) => (
  <div className="bg-slate-900/60 border border-slate-700/50 p-4 rounded-2xl flex flex-col items-center justify-center text-center gap-2 shadow-lg backdrop-blur-md group hover:border-slate-500/50 transition-all duration-300 transform-gpu" style={{ transform: 'translateZ(0)' }}>
    <div className={`p-2.5 rounded-xl bg-slate-950 border border-white/5 mb-1 transition-shadow duration-300 ${glowClasses}`}>
        <Icon className={`w-5 h-5 ${color}`} strokeWidth={2.5}/>
    </div>
    <span className="text-[10px] text-slate-400 uppercase font-black tracking-widest">{label}</span>
    <span className="text-xl font-mono font-black text-slate-100 tabular-nums tracking-tight">
      {value}<span className="text-xs ml-0.5 font-bold text-slate-500">{sub}</span>
    </span>
  </div>
);

// DOCTRINA RISC ZERO: Interfície estricta per evitar usar 'any'
interface TableRowData {
    hour: string;
    temp: number;
    code: number;
    precipProb: number;
    precipSum: number;
    snowfall: number;
    windSpeed: number;
    isDay: boolean;
}

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
  lang
}: DayDetailModalProps) {
  const t = TRANSLATIONS[lang] || TRANSLATIONS['ca'];
  
  const { dayData, hourlyData, comparisonData, snowLevelText } = useDayDetailData(weatherData, selectedDayIndex);

  // --- NAVEGACIÓ TÀCTICA (UNIFICADA) ---
  const handleClose = useCallback(() => {
      window.history.back();
  }, []);

  const handleBackdropClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
      if (e.target === e.currentTarget) {
          handleClose();
      }
  }, [handleClose]);

  useEffect(() => {
      window.history.pushState({ modal: 'dayDetail' }, '');
      
      const handlePopState = () => {
          onClose(); 
      };
      
      const handleKeyDown = (e: KeyboardEvent) => {
          if (e.key === 'Escape') {
              handleClose(); 
          }
      };
      
      window.addEventListener('popstate', handlePopState);
      window.addEventListener('keydown', handleKeyDown);
      
      return () => {
          window.removeEventListener('popstate', handlePopState);
          window.removeEventListener('keydown', handleKeyDown);
      };
  }, [onClose, handleClose]);

  const formattedPrecipitation = useMemo(() => {
    if (!dayData || !weatherData || selectedDayIndex === null) return { val: "0", unit: "mm" };
    
    const dailyRaw = weatherData.daily as unknown as Record<string, unknown>;
    const snowSumArr = dailyRaw.snowfall_sum;
    const snowSum = Array.isArray(snowSumArr) && typeof snowSumArr[selectedDayIndex] === 'number' 
        ? (snowSumArr[selectedDayIndex] as number) 
        : 0;
    
    const rawString = formatPrecipitation(dayData.precipSum || 0, snowSum);
    const [val, u] = rawString.split(' '); 
    return { val, unit: u };
  }, [dayData, weatherData, selectedDayIndex]);

  const tableRows = useMemo<TableRowData[]>(() => {
    if (!weatherData || selectedDayIndex === null || !weatherData.hourly || !Array.isArray(weatherData.hourly.time)) return [];
    
    const dateStr = weatherData.daily.time[selectedDayIndex];
    if (typeof dateStr !== 'string') return [];

    const startIndex = weatherData.hourly.time.findIndex((timeStr) => typeof timeStr === 'string' && timeStr.startsWith(dateStr));
    
    if (startIndex === -1) return [];

    let sunriseHour = 7;
    let sunsetHour = 20;
    
    if (Array.isArray(weatherData.daily.sunrise) && Array.isArray(weatherData.daily.sunset)) {
        const sr = weatherData.daily.sunrise[selectedDayIndex];
        const ss = weatherData.daily.sunset[selectedDayIndex];
        if (typeof sr === 'string') sunriseHour = new Date(sr).getHours();
        if (typeof ss === 'string') sunsetHour = new Date(ss).getHours();
    }

    const rows: TableRowData[] = [];
    const hRaw = weatherData.hourly as unknown as Record<string, unknown>;

    for (let i = 0; i < 24; i++) {
        const idx = startIndex + i;
        if (idx >= weatherData.hourly.time.length) break;

        const time = weatherData.hourly.time[idx];
        if (typeof time !== 'string') continue;

        const t2m = weatherData.hourly.temperature_2m;
        const temp = Array.isArray(t2m) && typeof t2m[idx] === 'number' ? t2m[idx] as number : 0;
        
        const weatherCodeArr = hRaw.weather_code ?? hRaw.weathercode;
        const code = Array.isArray(weatherCodeArr) && typeof weatherCodeArr[idx] === 'number' ? weatherCodeArr[idx] as number : 0;
        
        const pProbArr = weatherData.hourly.precipitation_probability;
        const precipProb = Array.isArray(pProbArr) && typeof pProbArr[idx] === 'number' ? pProbArr[idx] as number : 0;
        
        const pSumArr = weatherData.hourly.precipitation;
        const precipSum = Array.isArray(pSumArr) && typeof pSumArr[idx] === 'number' ? pSumArr[idx] as number : 0;
        
        const sFallArr = hRaw.snowfall;
        const snowfall = Array.isArray(sFallArr) && typeof sFallArr[idx] === 'number' ? sFallArr[idx] as number : 0;

        const wSpeedArr = weatherData.hourly.wind_speed_10m;
        const windSpeed = Array.isArray(wSpeedArr) && typeof wSpeedArr[idx] === 'number' ? wSpeedArr[idx] as number : 0;
        
        const currentHour = parseInt(time.split('T')[1]?.slice(0, 2) || "0", 10);
        const isDay = currentHour >= sunriseHour && currentHour < sunsetHour;

        rows.push({
            hour: time.split('T')[1]?.slice(0, 5) || "--:--",
            temp,
            code,
            precipProb,
            precipSum,
            snowfall,
            windSpeed,
            isDay
        });
    }

    return rows;
  }, [weatherData, selectedDayIndex]);

  if (!dayData) return null;

  const formatTime = (isoString?: string) => {
      if (!isoString) return "--:--";
      try {
          return new Date(isoString).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }); 
      } catch { return "--:--"; }
  };

  const formatDate = (isoString: string) => {
      try {
          return new Date(isoString).toLocaleDateString(lang === 'en' ? 'en-US' : lang === 'es' ? 'es-ES' : 'ca-ES', {
              weekday: 'long', day: 'numeric', month: 'long'
          });
      } catch { return isoString; }
  };

  return (
    <div 
        className="fixed inset-0 z-[100] flex items-center justify-center p-2 sm:p-4 bg-[#020617]/95 backdrop-blur-xl animate-in fade-in duration-200"
        onClick={handleBackdropClick}
    >
      <div className="bg-slate-950 border border-slate-800 w-full max-w-4xl max-h-[95vh] overflow-y-auto custom-scrollbar rounded-[2rem] shadow-2xl relative ring-1 ring-white/5">
          
          <button 
            onClick={handleClose}
            className="absolute top-5 right-5 p-2 bg-slate-900 rounded-full text-slate-400 hover:text-cyan-400 border border-slate-700 hover:border-cyan-500/50 transition-all z-50 hover:rotate-90 duration-300 shadow-md"
            aria-label="Tancar"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="p-6 pb-8 bg-slate-900/50 border-b border-slate-800 relative overflow-hidden">
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-cyan-500 to-transparent opacity-60 shadow-[0_0_15px_rgba(34,211,238,0.5)]"></div>
              
              <div className="flex flex-col items-center justify-center text-center relative z-10 pt-2">
                  <div className="flex items-center gap-2 text-cyan-400 font-black uppercase tracking-[0.3em] text-[10px] mb-3 bg-cyan-950/40 px-3 py-1.5 rounded-md border border-cyan-500/30 backdrop-blur-md shadow-[0_0_10px_rgba(6,182,212,0.15)]">
                      <Calendar className="w-3.5 h-3.5" /> {t.dayDetail?.forecast || "DETALL DEL DIA"}
                  </div>
                  
                  <h2 className="text-3xl md:text-5xl font-black text-slate-100 capitalize tracking-tight mb-2">
                      {formatDate(dayData.date)}
                  </h2>
                  
                  <div className="flex items-center justify-center gap-6 mt-4 bg-slate-950/60 px-6 py-2 rounded-2xl border border-white/5">
                      <div className="flex items-center gap-2">
                          <ArrowUp className="w-4 h-4 text-red-400 drop-shadow-[0_0_5px_rgba(248,113,113,0.8)]" />
                          <span className="text-3xl font-mono font-bold text-slate-200 tracking-tighter tabular-nums">
                              {Math.round(dayData.maxTemp || 0)}°
                          </span>
                      </div>
                      <div className="w-px h-6 bg-slate-700"></div>
                      <div className="flex items-center gap-2">
                          <ArrowDown className="w-4 h-4 text-cyan-400 drop-shadow-[0_0_5px_rgba(34,211,238,0.8)]" />
                          <span className="text-3xl font-mono font-bold text-slate-400 tracking-tighter tabular-nums">
                              {Math.round(dayData.minTemp || 0)}°
                          </span>
                      </div>
                  </div>
              </div>
          </div>

          <div className="p-4 md:p-8 space-y-6">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
                <StatCard 
                    icon={Droplets} 
                    label={t.dayDetail?.precip || "PRECIPITACIÓ"} 
                    value={formattedPrecipitation.val} 
                    sub={formattedPrecipitation.unit} 
                    color="text-blue-400" 
                    glowClasses="shadow-[0_0_12px_rgba(96,165,250,0.25)] group-hover:shadow-[0_0_20px_rgba(96,165,250,0.5)]" 
                />
                <StatCard 
                    icon={Wind} 
                    label={t.wind || "VENT MÀX"} 
                    value={`${Math.round(dayData.windMax || 0)}`} 
                    sub="km/h" 
                    color="text-emerald-400" 
                    glowClasses="shadow-[0_0_12px_rgba(52,211,153,0.25)] group-hover:shadow-[0_0_20px_rgba(52,211,153,0.5)]" 
                />
                <StatCard 
                    icon={Sun} 
                    label="INDEX UV" 
                    value={`${(dayData.uvMax || 0).toFixed(1)}`} 
                    sub="" 
                    color="text-amber-400" 
                    glowClasses="shadow-[0_0_12px_rgba(251,191,36,0.25)] group-hover:shadow-[0_0_20px_rgba(251,191,36,0.5)]" 
                />
                <StatCard 
                    icon={Mountain} 
                    label={t.snowLevel || "COTA NEU"} 
                    value={typeof snowLevelText === 'number' ? Math.round(snowLevelText) : snowLevelText} 
                    sub={typeof snowLevelText === 'number' ? (unit === 'F' ? 'ft' : 'm') : ''} 
                    color="text-indigo-400" 
                    glowClasses="shadow-[0_0_12px_rgba(129,140,248,0.25)] group-hover:shadow-[0_0_20px_rgba(129,140,248,0.5)]" 
                />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4">
                <div className="bg-slate-900/60 border border-slate-800 p-5 rounded-2xl flex items-center justify-between group hover:border-amber-500/30 transition-colors backdrop-blur-sm">
                   <div className="flex items-center gap-4">
                      <div className="p-3 bg-slate-950 rounded-xl text-amber-400 border border-amber-500/20 group-hover:shadow-[0_0_15px_rgba(251,191,36,0.3)] transition-all">
                          <Sun className="w-5 h-5"/>
                      </div>
                      <div>
                          <span className="text-[10px] text-slate-500 font-black uppercase tracking-widest">{t.sunrise || "SORTIDA"}</span>
                          <div className="text-2xl font-mono font-bold text-slate-200 tabular-nums">{formatTime(dayData.sunrise)}</div>
                      </div>
                   </div>
                </div>

                <div className="bg-slate-900/60 border border-slate-800 p-5 rounded-2xl flex items-center justify-between group hover:border-indigo-500/30 transition-colors backdrop-blur-sm">
                   <div className="flex items-center gap-4">
                      <div className="p-3 bg-slate-950 rounded-xl text-indigo-400 border border-indigo-500/20 group-hover:shadow-[0_0_15px_rgba(99,102,241,0.3)] transition-all">
                          <Moon className="w-5 h-5"/>
                      </div>
                      <div>
                          <span className="text-[10px] text-slate-500 font-black uppercase tracking-widest">{t.sunset || "POSTA"}</span>
                          <div className="text-2xl font-mono font-bold text-slate-200 tabular-nums">{formatTime(dayData.sunset)}</div>
                      </div>
                   </div>
                </div>
            </div>

            <div className="bg-slate-900/40 border border-slate-800 rounded-3xl p-5 md:p-8 shadow-inner">
               <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.25em] mb-6 flex items-center gap-2">
                  <Thermometer className="w-4 h-4 text-rose-400" /> 
                  {t.hourlyEvolution || "EVOLUCIÓ TÈRMICA"}
               </h3>
               <SmartForecastCharts 
                  data={hourlyData} 
                  comparisonData={comparisonData} 
                  unit={unit === 'F' ? '°F' : '°C'} 
                  lang={lang} 
               />
            </div>

            {tableRows && tableRows.length > 0 && (
                <div className="bg-slate-900/40 border border-slate-800 rounded-3xl overflow-hidden shadow-inner">
                    <div className="px-6 md:px-8 py-5 border-b border-slate-800 bg-slate-950/60">
                         <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.25em] flex items-center gap-2">
                            <Clock className="w-4 h-4 text-cyan-400" /> 
                            PREVISIÓ PER HORES
                        </h3>
                    </div>
                    
                    <div className="divide-y divide-slate-800/60">
                        <div className="grid grid-cols-12 px-4 md:px-6 py-3 text-[9px] font-black uppercase tracking-widest text-slate-500 bg-slate-950/30">
                            <div className="col-span-2">HORA</div>
                            <div className="col-span-2 text-center">CEL</div>
                            <div className="col-span-3 text-center">TEMP</div>
                            <div className="col-span-3 text-right">PLUJA</div>
                            <div className="col-span-2 text-right">VENT</div>
                        </div>
                        
                        {tableRows.map((row: TableRowData, idx: number) => {
                            const showPrecip = row.precipProb > 0 || row.precipSum > 0;
                            return (
                            <div key={`row-${idx}`} className="grid grid-cols-12 px-4 md:px-6 py-4 items-center hover:bg-slate-800/40 transition-colors group">
                                <div className="col-span-2 text-xs md:text-sm font-mono font-bold text-slate-400 group-hover:text-cyan-300 transition-colors">
                                    {row.hour}
                                </div>
                                
                                <div className="col-span-2 flex justify-center">
                                    <div className="scale-[0.6] md:scale-75 origin-center filter drop-shadow-md group-hover:scale-90 transition-transform duration-300">
                                        {getWeatherIcon(row.code, "w-10 h-10", row.isDay, row.precipProb, row.windSpeed)}
                                    </div>
                                </div>
                                
                                <div className="col-span-3 text-center text-sm md:text-base font-mono font-bold text-slate-200 tabular-nums">
                                    {Math.round(row.temp)}°
                                </div>
                                
                                <div className="col-span-3 flex flex-col md:flex-row justify-end items-end md:items-center gap-0.5 md:gap-1.5">
                                    {showPrecip ? (
                                        <>
                                            <span className="text-[10px] md:text-[11px] font-black text-blue-400 tabular-nums">
                                                {row.precipProb}%
                                            </span>
                                            {row.precipSum > 0 && (
                                                <span className="text-[9px] text-slate-500 font-mono font-bold bg-blue-950/30 px-1 py-0.5 rounded border border-blue-900/50">
                                                    {formatPrecipitation(row.precipSum, row.snowfall)}
                                                </span>
                                            )}
                                        </>
                                    ) : <span className="text-slate-700 font-bold">-</span>}
                                </div>
                                
                                <div className="col-span-2 flex flex-col items-end text-xs font-mono font-bold text-slate-500 group-hover:text-emerald-400 tabular-nums transition-colors">
                                    <span>{Math.round(row.windSpeed)}</span>
                                    <span className="text-[8px] uppercase tracking-widest opacity-60">km/h</span>
                                </div>
                            </div>
                            );
                        })}
                    </div>
                </div>
            )}
            
            <div className="h-6"></div>
          </div>
      </div>
    </div>
  );
}