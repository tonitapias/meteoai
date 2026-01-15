// src/components/CurrentWeather.tsx
import React from 'react';
import { Star, Map, Zap, Wind, Droplets, ThermometerSun, ArrowUp, ArrowDown } from 'lucide-react';
import { getWeatherIcon } from './WeatherIcons';
import { getWeatherLabel, ExtendedWeatherData } from '../utils/weatherLogic';
import { WeatherUnit, formatTemp } from '../utils/formatters';
import { Language } from '../constants/translations';
import { AirQualityData } from '../services/weatherApi';

interface LivingIconProps { windSpeed: number; precip: number; children: React.ReactNode; }
const LivingIcon = ({ windSpeed, precip, children }: LivingIconProps) => {
  const animationStyle = windSpeed > 25 ? 'wiggle 1s ease-in-out infinite' : windSpeed > 15 ? 'wiggle 3s ease-in-out infinite' : 'none';
  return <div style={{ animation: animationStyle }} className={`transition-transform duration-700 ${precip > 2 ? 'animate-pulse' : ''} filter drop-shadow-[0_20px_40px_rgba(0,0,0,0.35)]`}>{children}</div>;
};

interface CurrentWeatherProps {
  data: ExtendedWeatherData; effectiveCode: number; unit: WeatherUnit; lang: Language; shiftedNow: Date;
  isFavorite: boolean; onToggleFavorite: () => void; onShowRadar: () => void; onShowArome: () => void;
  aqiData: AirQualityData | null; showAromeBtn?: boolean;
}

const getRawTime = (isoString: string): string => {
    if (!isoString || !isoString.includes('T')) return "--:--";
    return isoString.split('T')[1].substring(0, 5); 
};

const getRawDate = (isoString: string, lang: Language): string => {
    if (!isoString) return "";
    try {
        const datePart = isoString.split('T')[0];
        const [y, m, d] = datePart.split('-').map(Number);
        const safeDate = new Date(y, m - 1, d, 12, 0, 0); 
        return new Intl.DateTimeFormat(lang === 'ca' ? 'ca-ES' : 'en-US', { weekday: 'long', day: 'numeric', month: 'long' }).format(safeDate);
    } catch (e) {
        return isoString.split('T')[0];
    }
};

export default function CurrentWeather({ 
  data, effectiveCode, unit, lang, shiftedNow, isFavorite, onToggleFavorite, onShowRadar, onShowArome, showAromeBtn 
}: CurrentWeatherProps) {
  const { current, location, daily } = data;
  const isUsingArome = current.source === 'AROME HD';
  const getTemp = (t: number) => formatTemp(t, unit);
  
  const displayTime = getRawTime(current.time as string); 
  const displayDate = getRawDate(current.time as string, lang);
  const countryName = location?.country || "Local";

  return (
    <div className="bento-card h-full flex flex-col justify-between p-6 md:p-8 group min-h-[550px] relative z-0">
        
        {/* Ambient Backlight */}
        <div className="absolute top-0 right-0 w-80 h-80 bg-indigo-500/20 rounded-full blur-[120px] -mr-20 -mt-20 pointer-events-none z-[-1]"></div>
        <div className="absolute bottom-0 left-0 w-60 h-60 bg-blue-500/10 rounded-full blur-[100px] -ml-20 -mb-20 pointer-events-none z-[-1]"></div>

        {/* HEADER */}
        <div className="flex justify-between items-start w-full overflow-hidden">
            <div className="flex flex-col gap-1 w-full min-w-0"> {/* min-w-0 permet que el truncament funcioni */}
                <div className="flex items-center gap-2 flex-wrap mb-1">
                    <span 
                        className="px-2.5 py-0.5 rounded-full bg-white/10 border border-white/5 text-[9px] font-bold uppercase tracking-widest text-slate-300 truncate max-w-[120px]"
                        title={countryName} 
                    >
                        {countryName}
                    </span>

                    {isUsingArome && (
                        <span className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-emerald-500/20 border border-emerald-500/30 text-[9px] font-bold uppercase tracking-widest text-emerald-400 shrink-0">
                            <span className="animate-pulse w-1 h-1 rounded-full bg-emerald-400"></span> AROME HD
                        </span>
                    )}
                </div>
                
                <div className="flex items-start justify-between gap-3 w-full">
                    <h2 
                        className="text-3xl md:text-4xl font-black text-white tracking-tight leading-tight line-clamp-2 flex-1"
                        title={location?.name}
                    >
                        {location?.name}
                    </h2>
                    
                    <button 
                        onClick={onToggleFavorite} 
                        className="text-slate-500 hover:text-amber-400 transition-colors active:scale-90 shrink-0 mt-1"
                    >
                        <Star className={`w-6 h-6 ${isFavorite ? 'fill-current text-amber-400' : ''}`} />
                    </button>
                </div>

                <div className="text-slate-400 text-xs md:text-sm font-medium capitalize flex items-center gap-2 mt-1">
                    {displayDate} <span className="opacity-30">|</span> {displayTime}
                </div>
            </div>
        </div>

        {/* CENTER: BIG TEMP & ICON */}
        <div className="flex-1 flex flex-col items-center justify-center py-4">
            <LivingIcon windSpeed={current.wind_speed_10m} precip={current.precipitation}>
                {getWeatherIcon(effectiveCode, "w-40 h-40 md:w-56 md:h-56", current.is_day)}
            </LivingIcon>
            <div className="text-center -mt-4 relative">
                <h1 className="text-[6.5rem] md:text-[8.5rem] font-black text-transparent bg-clip-text bg-gradient-to-b from-white to-white/60 leading-none tracking-tighter text-glow select-none">
                    {getTemp(current.temperature_2m)}°
                </h1>
                <p className="text-lg md:text-xl font-medium text-indigo-100/90 capitalize tracking-wide">
                    {getWeatherLabel({ ...current, weather_code: effectiveCode }, lang)}
                </p>
            </div>
        </div>

        {/* FOOTER */}
        <div className="flex flex-col gap-5">
            <div className="grid grid-cols-3 gap-2.5">
                 {[
                    { icon: Wind, val: Math.round(current.wind_speed_10m), u: 'km/h' },
                    { icon: Droplets, val: current.relative_humidity_2m, u: '%' },
                    { icon: ThermometerSun, val: getTemp(current.apparent_temperature), u: '°' }
                ].map((s, i) => (
                    <div key={i} className="flex flex-col items-center justify-center p-3 rounded-2xl bg-white/5 border border-white/5 backdrop-blur-sm hover:bg-white/10 transition-colors">
                        <s.icon className="w-4 h-4 text-indigo-300 mb-1" />
                        <span className="text-base md:text-lg font-bold">{s.val}<span className="text-[10px] text-slate-500 ml-0.5 font-normal">{s.u}</span></span>
                    </div>
                ))}
            </div>

            <div className="flex flex-col md:flex-row gap-4 items-center justify-between pt-4 border-t border-white/5">
                <div className="flex gap-4 text-xs md:text-sm font-bold">
                    <span className="flex items-center gap-1.5 text-rose-300/90"><ArrowUp className="w-3.5 h-3.5" /> {getTemp(daily.temperature_2m_max[0])}°</span>
                    <span className="flex items-center gap-1.5 text-cyan-300/90"><ArrowDown className="w-3.5 h-3.5" /> {getTemp(daily.temperature_2m_min[0])}°</span>
                </div>
                <div className="flex gap-2 w-full md:w-auto">
                    <button onClick={onShowRadar} className="flex-1 md:flex-none flex items-center justify-center gap-2 px-4 py-2 bg-indigo-500/10 hover:bg-indigo-500/20 border border-indigo-500/20 rounded-xl transition-all text-indigo-100 text-xs font-bold active:scale-95">
                        <Map className="w-3.5 h-3.5" /> Radar
                    </button>
                    {showAromeBtn && (
                         <button onClick={onShowArome} className="flex-1 md:flex-none flex items-center justify-center gap-2 px-4 py-2 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/20 rounded-xl transition-all text-emerald-100 text-xs font-bold active:scale-95">
                            <Zap className="w-3.5 h-3.5" /> AROME
                        </button>
                    )}
                </div>
            </div>
        </div>
    </div>
  );
}