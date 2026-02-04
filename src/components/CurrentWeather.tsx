// src/components/CurrentWeather.tsx
import React from 'react';
import { Star, Map, Zap, Wind, Droplets, Navigation, ArrowUp, ArrowDown, Activity } from 'lucide-react';
import { getWeatherIcon } from './WeatherIcons';
import { ExtendedWeatherData } from '../utils/weatherLogic';
import { WeatherUnit } from '../utils/formatters';
import { Language } from '../translations';
import { AirQualityData } from '../types/weather';
// NOU IMPORT DEL HOOK
import { useCurrentWeatherLogic } from '../hooks/useCurrentWeatherLogic';

interface CurrentWeatherProps {
  data: ExtendedWeatherData; 
  effectiveCode: number; 
  unit: WeatherUnit; 
  lang: Language; 
  isFavorite: boolean; 
  onToggleFavorite: () => void; 
  onShowRadar: () => void; 
  onShowArome: () => void;
  aqiData: AirQualityData | null; 
  showAromeBtn?: boolean; 
  shiftedNow?: Date;
}

export default function CurrentWeather(props: CurrentWeatherProps) {
  // Tota la lògica s'ha delegat al hook
  const weather = useCurrentWeatherLogic({ 
      data: props.data, 
      unit: props.unit, 
      lang: props.lang, 
      shiftedNow: props.shiftedNow, 
      effectiveCode: props.effectiveCode 
  });

  if (!weather) return null;

  return (
    <div className="w-full relative group">
        <div className="w-full flex flex-col md:flex-row items-stretch justify-between p-6 md:p-10 bg-[#0B0C15] rounded-[3rem] border border-white/5 relative overflow-hidden shadow-2xl gap-8 ring-1 ring-white/5">
            <div className="absolute top-0 right-0 w-[400px] h-[400px] bg-indigo-500/10 rounded-full blur-[120px] -mr-20 -mt-20 pointer-events-none mix-blend-screen"></div>
            
            <div className="flex-1 flex flex-col justify-between z-10">
                <div className="flex justify-between items-start">
                    <div className="flex flex-col gap-1">
                        <div className="flex items-center gap-3 mb-1">
                             <div className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-white/5 border border-white/10">
                                <Navigation className="w-3 h-3 text-indigo-400" />
                                <span className="text-[9px] font-mono font-bold text-indigo-200 tracking-widest uppercase">{weather.meta.country}</span>
                             </div>
                             {weather.meta.isUsingArome && (
                                <span className="flex items-center gap-1 px-2 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/20 text-[9px] font-mono font-bold text-emerald-400 tracking-widest uppercase">
                                    <Zap className="w-2.5 h-2.5" /> AROME HD
                                </span>
                             )}
                        </div>
                        
                        <h2 className="text-4xl md:text-6xl font-black text-white tracking-tighter uppercase leading-[0.9] drop-shadow-lg break-words">
                            {weather.meta.locationName}
                        </h2>
                        
                        <div className="flex items-center gap-4 mt-2">
                             <span className="text-2xl font-mono font-medium text-white tracking-tight">{weather.meta.time}</span>
                             <div className="h-4 w-px bg-white/10"></div>
                             <span className="text-sm font-bold text-slate-400 uppercase tracking-wider">{weather.meta.date}</span>
                        </div>
                    </div>

                    <button 
                        onClick={props.onToggleFavorite} 
                        className="md:hidden p-3 bg-white/5 rounded-xl text-slate-400 hover:text-amber-400"
                        aria-label={props.isFavorite ? "Eliminar de favorits" : "Afegir a favorits"}
                    >
                        <Star className={`w-5 h-5 ${props.isFavorite ? 'fill-amber-400 text-amber-400' : ''}`} />
                    </button>
                </div>

                <div className="mt-8 md:mt-12 flex flex-col md:flex-row items-baseline md:items-end gap-6">
                     <div className="relative leading-none">
                        <h1 className="text-[6rem] sm:text-[8rem] md:text-[10rem] font-mono font-medium text-white tracking-tighter tabular-nums drop-shadow-2xl z-10 relative">
                            {weather.temps.main}°
                        </h1>
                        <div className="absolute inset-0 text-[6rem] sm:text-[8rem] md:text-[10rem] font-mono font-medium text-indigo-500 blur-3xl opacity-20 select-none pointer-events-none tracking-tighter tabular-nums">
                            {weather.temps.main}°
                        </div>
                     </div>

                     <div className="flex flex-col gap-4 pb-6 md:pb-10 min-w-[140px]">
                        <div className="flex items-center gap-3 px-3 py-1.5 rounded-full bg-white/5 border border-white/10 backdrop-blur-md w-fit">
                             <span className={`w-2 h-2 rounded-full ${weather.visuals.statusColor} transition-colors duration-500`}></span>
                             <span className="text-xs font-black text-white uppercase tracking-wider">
                                {weather.visuals.weatherLabel}
                             </span>
                        </div>

                        <div className="flex items-center gap-4 text-sm font-mono font-bold text-slate-400">
                            <div className="flex items-center gap-1">
                                <ArrowUp className="w-3.5 h-3.5 text-rose-400" />
                                <span className="text-white tabular-nums">{weather.temps.max}°</span>
                            </div>
                            <div className="w-px h-3 bg-white/10"></div>
                            <div className="flex items-center gap-1">
                                <ArrowDown className="w-3.5 h-3.5 text-cyan-400" />
                                <span className="text-white tabular-nums">{weather.temps.min}°</span>
                            </div>
                        </div>
                     </div>
                </div>
            </div>

            <div className="w-full md:w-[320px] flex flex-col gap-4 z-10 shrink-0 mt-0 md:mt-0 relative">
                <div className="flex-1 flex items-center justify-center min-h-[180px] md:min-h-[220px] relative -mt-8 md:mt-0">
                     <div className="drop-shadow-[0_0_60px_rgba(99,102,241,0.6)] md:drop-shadow-[0_0_40px_rgba(99,102,241,0.3)] transition-transform duration-700 hover:scale-105 relative z-20">
                        {getWeatherIcon(props.effectiveCode, "w-48 h-48 md:w-56 md:h-56", weather.meta.isDay)}
                     </div>
                </div>

                <div className="grid grid-cols-3 gap-2 relative z-10">
                    {[ 
                        { i: Wind, v: weather.stats.windSpeed, u: 'km/h', l: 'VENT' }, 
                        { i: Droplets, v: weather.stats.humidity, u: '%', l: 'HUMITAT' }, 
                        { i: Activity, v: weather.temps.apparent, u: '°', l: 'SENSACIÓ' } 
                    ].map((s, idx) => (
                        <div key={idx} className="flex flex-col items-center justify-center p-3 rounded-xl bg-[#151725] border border-white/5 hover:border-white/10 transition-colors group">
                            <s.i className="w-4 h-4 text-slate-500 mb-1 group-hover:text-indigo-400 transition-colors" />
                            <span className="text-lg font-mono font-bold text-white tabular-nums tracking-tight">
                                {s.v}<span className="text-[9px] text-slate-500 ml-0.5">{s.u}</span>
                            </span>
                            <span className="text-[8px] text-slate-600 font-black uppercase tracking-widest">{s.l}</span>
                        </div>
                    ))}
                </div>

                <div className="flex gap-2 pt-2 relative z-10">
                    <button onClick={props.onShowRadar} className="flex-1 py-3 bg-indigo-500/10 hover:bg-indigo-500/20 border border-indigo-500/30 rounded-xl text-indigo-200 text-[10px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 hover:shadow-[0_0_15px_rgba(99,102,241,0.2)] active:scale-95">
                        <Map className="w-3.5 h-3.5" /> RADAR
                    </button>
                    
                    {props.showAromeBtn && (
                        <button onClick={props.onShowArome} className="flex-1 py-3 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 rounded-xl text-emerald-300 text-[10px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 hover:shadow-[0_0_15px_rgba(16,185,129,0.2)] active:scale-95">
                            <Zap className="w-3.5 h-3.5" /> AROME HD
                        </button>
                    )}

                    <button 
                        onClick={props.onToggleFavorite} 
                        className="hidden md:flex p-3 bg-white/5 hover:bg-white/10 rounded-xl border border-white/5 text-slate-400 hover:text-amber-400 transition-colors"
                        aria-label={props.isFavorite ? "Eliminar de favorits" : "Afegir a favorits"}
                    >
                        <Star className={`w-5 h-5 ${props.isFavorite ? 'fill-amber-400 text-amber-400' : ''}`} />
                    </button>
                </div>
            </div>
        </div>
    </div>
  );
}