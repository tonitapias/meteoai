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

// FIX: Helpers per parsejar l'hora i data "CRUES" sense conversions de zona horària del navegador
const getRawTime = (isoString: string): string => {
    if (!isoString || !isoString.includes('T')) return "--:--";
    // Exemple: "2023-10-27T15:30" -> split 'T' -> "15:30"
    return isoString.split('T')[1].substring(0, 5); 
};

const getRawDate = (isoString: string, lang: Language): string => {
    if (!isoString) return "";
    try {
        // Truc: Creem la data a les 12:00 del migdia per evitar que els offsets de zona horària canviïn el dia
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
  
  // FIX: Usem les dades "crues" de l'API per visualitzar text, ignorant l'objecte Date local
  const displayTime = getRawTime(current.time as string); 
  const displayDate = getRawDate(current.time as string, lang);

  return (
    <div className="bento-card h-full flex flex-col justify-between p-6 md:p-8 group min-h-[550px] relative z-0">
        
        {/* Ambient Backlight */}
        <div className="absolute top-0 right-0 w-80 h-80 bg-indigo-500/20 rounded-full blur-[120px] -mr-20 -mt-20 pointer-events-none z-[-1]"></div>
        <div className="absolute bottom-0 left-0 w-60 h-60 bg-blue-500/10 rounded-full blur-[100px] -ml-20 -mb-20 pointer-events-none z-[-1]"></div>

        {/* HEADER */}
        <div className="flex justify-between items-start">
            <div className="flex flex-col gap-2">
                <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded-full bg-white/10 border border-white/5 text-[10px] font-bold uppercase tracking-widest text-slate-300">
                        {location?.country || "Local"}
                    </span>
                    {isUsingArome && (
                        <span className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-emerald-500/20 border border-emerald-500/30 text-[10px] font-bold uppercase tracking-widest text-emerald-400 ring-1 ring-emerald-500/50 shadow-[0_0_10px_rgba(16,185,129,0.3)]">
                            <span className="animate-pulse w-1.5 h-1.5 rounded-full bg-emerald-400"></span> AROME HD
                        </span>
                    )}
                </div>
                <h2 className="text-4xl md:text-5xl font-black text-white tracking-tighter flex items-center gap-3">
                    {location?.name}
                    <button onClick={onToggleFavorite} className="text-slate-500 hover:text-amber-400 transition-colors active:scale-90">
                        <Star className={`w-6 h-6 ${isFavorite ? 'fill-current text-amber-400' : ''}`} />
                    </button>
                </h2>
                <div className="text-slate-400 text-sm font-medium capitalize flex items-center gap-2">
                    {displayDate} <span className="opacity-50">|</span> {displayTime}
                </div>
            </div>
        </div>

        {/* CENTER: BIG TEMP & ICON */}
        <div className="flex-1 flex flex-col items-center justify-center py-6">
            <LivingIcon windSpeed={current.wind_speed_10m} precip={current.precipitation}>
                {getWeatherIcon(effectiveCode, "w-48 h-48 md:w-64 md:h-64", current.is_day)}
            </LivingIcon>
            <div className="text-center -mt-6 relative">
                <h1 className="text-[7rem] md:text-[10rem] font-black text-transparent bg-clip-text bg-gradient-to-b from-white to-white/60 leading-[0.85] tracking-tighter text-glow select-none">
                    {getTemp(current.temperature_2m)}°
                </h1>
                <p className="text-xl md:text-2xl font-medium text-indigo-100/90 capitalize mt-2 tracking-wide">
                    {getWeatherLabel({ ...current, weather_code: effectiveCode }, lang)}
                </p>
            </div>
        </div>

        {/* FOOTER */}
        <div className="flex flex-col gap-6">
            <div className="grid grid-cols-3 gap-3">
                 {[
                    { icon: Wind, val: Math.round(current.wind_speed_10m), u: 'km/h' },
                    { icon: Droplets, val: current.relative_humidity_2m, u: '%' },
                    { icon: ThermometerSun, val: getTemp(current.apparent_temperature), u: '°' }
                ].map((s, i) => (
                    <div key={i} className="flex flex-col items-center justify-center p-3 rounded-2xl bg-white/5 border border-white/5 backdrop-blur-sm hover:bg-white/10 transition-colors">
                        <s.icon className="w-5 h-5 text-indigo-300 mb-1" />
                        <span className="text-lg font-bold">{s.val}<span className="text-xs text-slate-400 ml-0.5">{s.u}</span></span>
                    </div>
                ))}
            </div>

            <div className="flex flex-col md:flex-row gap-4 items-center justify-between pt-4 border-t border-white/5">
                <div className="flex gap-4 text-sm font-bold">
                    <span className="flex items-center gap-1 text-rose-300"><ArrowUp className="w-4 h-4" /> {getTemp(daily.temperature_2m_max[0])}°</span>
                    <span className="flex items-center gap-1 text-cyan-300"><ArrowDown className="w-4 h-4" /> {getTemp(daily.temperature_2m_min[0])}°</span>
                </div>
                <div className="flex gap-2 w-full md:w-auto">
                    <button onClick={onShowRadar} className="flex-1 md:flex-none flex items-center justify-center gap-2 px-5 py-2.5 bg-indigo-500/20 hover:bg-indigo-500/30 border border-indigo-500/30 rounded-xl transition-all text-indigo-100 text-sm font-bold active:scale-95">
                        <Map className="w-4 h-4" /> Radar
                    </button>
                    {showAromeBtn && (
                         <button onClick={onShowArome} className="flex-1 md:flex-none flex items-center justify-center gap-2 px-5 py-2.5 bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/30 rounded-xl transition-all text-emerald-100 text-sm font-bold active:scale-95">
                            <Zap className="w-4 h-4" /> AROME
                        </button>
                    )}
                </div>
            </div>
        </div>
    </div>
  );
}