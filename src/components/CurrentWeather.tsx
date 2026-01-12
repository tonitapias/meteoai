// src/components/CurrentWeather.tsx
import React from 'react';
import { Star, Map, Zap, Wind, Droplets, ThermometerSun, MapPin, Clock, ArrowUp, ArrowDown } from 'lucide-react';
import { getWeatherIcon } from './WeatherIcons';
import { getWeatherLabel, ExtendedWeatherData } from '../utils/weatherLogic';
import { WeatherUnit, formatTemp } from '../utils/formatters';
import { Language } from '../constants/translations';
import { AirQualityData } from '../services/weatherApi';

interface LivingIconProps { windSpeed: number; precip: number; children: React.ReactNode; }

const LivingIcon = ({ windSpeed, precip, children }: LivingIconProps) => {
  const animationStyle = windSpeed > 25 ? 'wiggle 1s ease-in-out infinite' : windSpeed > 15 ? 'wiggle 3s ease-in-out infinite' : 'none';
  return <div style={{ animation: animationStyle, transformOrigin: 'bottom center' }} className={`transition-all duration-1000 ${precip > 2 ? 'animate-pulse' : ''} filter drop-shadow-[0_10px_20px_rgba(0,0,0,0.3)]`}>{children}</div>;
};

interface CurrentWeatherProps {
  data: ExtendedWeatherData; effectiveCode: number; unit: WeatherUnit; lang: Language; shiftedNow: Date;
  isFavorite: boolean; onToggleFavorite: () => void; onShowRadar: () => void; onShowArome: () => void;
  aqiData: AirQualityData | null; showAromeBtn?: boolean;
}

export default function CurrentWeather({ 
  data, effectiveCode, unit, lang, shiftedNow, isFavorite, onToggleFavorite, onShowRadar, onShowArome, showAromeBtn 
}: CurrentWeatherProps) {
  const { current, location, daily } = data;
  
  // AROME ACTIU? (Mirem la font de les dades)
  const isUsingArome = current.source === 'AROME HD';
  
  const getTemp = (t: number) => formatTemp(t, unit);
  const formatDateStr = new Intl.DateTimeFormat(lang === 'ca' ? 'ca-ES' : 'en-US', { weekday: 'long', day: 'numeric', month: 'long' }).format(shiftedNow);
  
  return (
    <div className="relative overflow-hidden rounded-[2.5rem] bg-white/5 border border-white/10 shadow-2xl backdrop-blur-2xl group transition-all duration-500 hover:bg-white/[0.07] h-full flex flex-col justify-between p-6 md:p-8">
        
        {/* Glow */}
        <div className="absolute top-0 right-0 -mt-20 -mr-20 w-80 h-80 bg-indigo-500/30 rounded-full blur-[100px] pointer-events-none"></div>
        <div className="absolute bottom-0 left-0 -mb-20 -ml-20 w-60 h-60 bg-blue-500/20 rounded-full blur-[80px] pointer-events-none"></div>
        <style>{`@keyframes wiggle { 0%, 100% { transform: rotate(-3deg); } 50% { transform: rotate(3deg); } }`}</style>

        {/* HEADER */}
        <div className="relative z-10 flex flex-col gap-4">
            <div className="flex justify-between items-start">
                <div>
                    <div className="flex items-center gap-2 mb-2">
                        <span className="px-2 py-0.5 rounded-full bg-white/10 border border-white/5 text-[10px] font-bold uppercase tracking-widest text-slate-300">
                            {location?.country || "Local"}
                        </span>
                        
                        {/* ETIQUETA HD - PUNT VERD (Visible si AROME està actiu) */}
                        {isUsingArome && (
                            <span className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-emerald-500/20 border border-emerald-500/30 text-[10px] font-bold uppercase tracking-widest text-emerald-400 animate-in fade-in zoom-in">
                                <span className="relative flex h-1.5 w-1.5">
                                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                                  <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500"></span>
                                </span>
                                LIVE HD
                            </span>
                        )}
                    </div>
                    <h2 className="text-4xl md:text-5xl font-bold text-white tracking-tighter leading-none flex items-center gap-3">
                        {location?.name}
                        <button onClick={onToggleFavorite} className="text-slate-500 hover:text-amber-400 transition-colors active:scale-90">
                            <Star className={`w-6 h-6 ${isFavorite ? 'fill-current text-amber-400' : ''}`} />
                        </button>
                    </h2>
                    <div className="flex items-center gap-2 mt-2 text-slate-400 text-sm font-medium">
                        <Clock className="w-4 h-4" />
                        <span>{shiftedNow.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                        <span className="w-1 h-1 bg-slate-600 rounded-full"></span>
                        <span className="capitalize">{formatDateStr}</span>
                    </div>
                </div>
            </div>

            {/* MAIN CONTENT */}
            <div className="flex flex-col items-center py-6">
                <LivingIcon windSpeed={current.wind_speed_10m} precip={current.precipitation}>
                    {getWeatherIcon(effectiveCode, "w-48 h-48 md:w-56 md:h-56", current.is_day)}
                </LivingIcon>
                <div className="text-center relative z-10 -mt-6">
                    <span className="text-9xl font-bold text-transparent bg-clip-text bg-gradient-to-b from-white to-slate-300 tracking-tighter leading-none">
                        {getTemp(current.temperature_2m)}°
                    </span>
                    <span className="text-2xl font-medium text-indigo-200 capitalize mt-2 block">
                        {getWeatherLabel({ ...current, weather_code: effectiveCode }, lang)}
                    </span>
                </div>
            </div>
        </div>

        {/* FOOTER ACTIONS & STATS */}
        <div className="relative z-10 flex flex-col gap-4">
            
            {/* BOTONS D'ACCIÓ */}
            <div className="grid grid-cols-2 gap-3">
                <button onClick={onShowRadar} className="flex items-center justify-center gap-2 px-4 py-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded-2xl transition-all group">
                    <Map className="w-5 h-5 text-indigo-400 group-hover:scale-110 transition-transform" />
                    <span className="text-sm font-bold text-slate-200">Radar</span>
                </button>
                
                {/* BOTÓ AROME - ARA ÉS VERD SI ESTÀ DISPONIBLE */}
                {showAromeBtn ? (
                    <button onClick={onShowArome} className="flex items-center justify-center gap-2 px-4 py-3 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/20 rounded-2xl transition-all group">
                        <Zap className="w-5 h-5 text-emerald-400 group-hover:scale-110 transition-transform" />
                        <span className="text-sm font-bold text-emerald-100">AROME HD</span>
                    </button>
                ) : (
                    <div className="flex items-center justify-center gap-2 px-4 py-3 bg-white/5 border border-white/5 rounded-2xl opacity-50 cursor-not-allowed">
                        <Zap className="w-5 h-5" /> <span className="text-sm font-bold">AROME</span>
                    </div>
                )}
            </div>

            {/* Quick Stats */}
            <div className="grid grid-cols-3 gap-2 bg-black/20 p-2 rounded-2xl backdrop-blur-md border border-white/5">
                {[
                    { icon: Wind, val: Math.round(current.wind_speed_10m), u: 'km/h', c: 'text-teal-300', l: 'Vent' },
                    { icon: Droplets, val: current.relative_humidity_2m, u: '%', c: 'text-blue-300', l: 'Hum.' },
                    { icon: ThermometerSun, val: getTemp(current.apparent_temperature), u: '°', c: 'text-amber-300', l: 'Sens.' }
                ].map((s, i) => (
                    <div key={i} className="flex flex-col items-center justify-center p-2 rounded-xl">
                        <s.icon className={`w-4 h-4 mb-1 ${s.c}`} />
                        <span className="text-sm font-bold text-white">{s.val}<span className="text-[10px] text-slate-400 ml-0.5">{s.u}</span></span>
                    </div>
                ))}
            </div>
            
            {/* Hi/Lo */}
            <div className="flex justify-between items-center text-sm font-medium px-2">
                <span className="flex items-center gap-1 text-rose-300"><ArrowUp className="w-4 h-4" /> Màx {getTemp(daily.temperature_2m_max[0])}°</span>
                <span className="w-1 h-1 bg-white/20 rounded-full"></span>
                <span className="flex items-center gap-1 text-cyan-300"><ArrowDown className="w-4 h-4" /> Mín {getTemp(daily.temperature_2m_min[0])}°</span>
            </div>
        </div>
    </div>
  );
}