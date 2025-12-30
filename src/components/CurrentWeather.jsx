// src/components/CurrentWeather.jsx
import React from 'react';
import { Star, Map, MapPin, Clock, Zap } from 'lucide-react';
import { getWeatherIcon } from './WeatherIcons';
import { getWeatherLabel } from '../utils/weatherLogic';

const LivingIcon = ({ code, rainProb, windSpeed, precip, children }) => {
  const animationStyle = windSpeed > 25 ? 'wiggle 1s ease-in-out infinite' : 
                         windSpeed > 15 ? 'wiggle 3s ease-in-out infinite' : 'none';

  const style = {
    animation: animationStyle,
    transformOrigin: 'bottom center',
    filter: precip > 2 ? 'drop-shadow(0 0 10px rgba(255,255,255,0.5))' : ''
  };

  const className = `transition-all duration-1000 ${precip > 2 ? 'animate-pulse' : ''}`;

  return (
    <div style={style} className={className}>
      {children}
    </div>
  );
};

export default function CurrentWeather({ 
  data, 
  effectiveCode, 
  unit, 
  lang, 
  shiftedNow, 
  isFavorite, 
  onToggleFavorite, 
  onShowRadar,
  onShowArome,
  showAromeBtn = false 
}) {
  const { current, location, daily } = data;
  const { is_day, temperature_2m, wind_speed_10m, precipitation, relative_humidity_2m, apparent_temperature } = current;

  // Detectem l'origen de la dada
  const isHighPrecision = current.source === 'AROME HD';

  const formatTemp = (tempC) => {
    if (unit === 'F') return Math.round((tempC * 9/5) + 32);
    return Math.round(tempC);
  };

  const currentRainProb = data.hourly?.precipitation_probability?.[0] || 0;
  const currentPrecip15 = data.minutely_15?.precipitation?.slice(0, 4).reduce((a, b) => a + (b || 0), 0) || 0;

  return (
    <div className="flex flex-col gap-6 w-full lg:w-auto relative">
            
            {/* INDICADOR D'ESTAT MINIMALISTA (Punt Verd) */}
{isHighPrecision && (
    <div 
        className="absolute top-2 right-2 md:-top-5 md:-right-2 flex items-center justify-center animate-in fade-in zoom-in duration-500"
        title="Dades d'Alta Precisió (AROME) Actives" // Tooltip per si algú posa el ratolí a sobre
    >
        <span className="relative flex h-3 w-3">
          {/* Ona expansiva (Ping) */}
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
          {/* Punt central sòlid */}
          <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.6)]"></span>
        </span>
    </div>
)}

            <div className="flex flex-col">
                <div className="flex items-center gap-3">
                        <h2 className="text-3xl md:text-4xl font-bold text-white tracking-tighter">{location.name}</h2>
                        
                        <button 
                          onClick={onToggleFavorite} 
                          className="hover:scale-110 transition-transform p-1 active:scale-90"
                          aria-label={isFavorite ? "Treure de preferits" : "Afegir a preferits"}
                        >
                            <Star className={`w-6 h-6 transition-colors ${isFavorite ? 'text-amber-400 fill-amber-400' : 'text-slate-600 hover:text-amber-300'}`} strokeWidth={2.5} />
                        </button>
                        
                        <button 
                            onClick={onShowRadar}
                            className="ml-2 p-2 rounded-full bg-indigo-500/20 hover:bg-indigo-500/40 text-indigo-300 transition-colors border border-indigo-500/30 flex items-center gap-1.5 md:gap-2 px-3 group"
                        >
                            <Map className="w-4 h-4 md:w-5 md:h-5 group-hover:scale-110 transition-transform" strokeWidth={2.5} />
                            <span className="hidden md:inline text-[10px] md:text-xs font-bold uppercase tracking-wider">RADAR</span>
                        </button>

                        {/* BOTÓ ACTIVAR AROME (NOU DISSENY OPCIÓ A) */}
                        {showAromeBtn && (
                          <button 
                              onClick={onShowArome}
                              className="relative overflow-hidden p-2 px-4 rounded-full bg-slate-900/40 hover:bg-cyan-950/30 text-slate-300 hover:text-cyan-200 transition-all border border-slate-700/50 hover:border-cyan-500/50 flex items-center gap-2 group shadow-sm hover:shadow-[0_0_20px_rgba(34,211,238,0.1)]"
                          >
                              {/* Efecte de brillantor al fer hover */}
                              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-cyan-400/10 to-transparent -translate-x-[150%] group-hover:translate-x-[150%] transition-transform duration-700 ease-in-out" />
                              
                              <Zap className="w-4 h-4 text-slate-400 group-hover:text-cyan-400 transition-colors" strokeWidth={2.5} />
                              <span className="hidden md:inline text-[10px] md:text-xs font-bold uppercase tracking-wider">
                                AROME
                              </span>
                          </button>
                        )}
                </div>
                
                <div className="flex items-center gap-3 text-sm text-indigo-200 font-medium mt-1">
                        <span className="flex items-center gap-1.5"><MapPin className="w-3.5 h-3.5"/> {location.country}</span>
                        <span className="w-1 h-1 bg-indigo-500 rounded-full"></span>
                        <span className="flex items-center gap-1.5 text-slate-400">
                            <Clock className="w-3.5 h-3.5"/> 
                            {shiftedNow.toLocaleTimeString([], {hour: '2-digit', minute: '2-digit'})}
                        </span>
                </div>
            </div>

            <div className="flex items-center gap-6">
                <div className="filter drop-shadow-2xl animate-in zoom-in duration-500">
                    <LivingIcon 
                        code={effectiveCode} 
                        isDay={is_day}
                        rainProb={currentRainProb}
                        windSpeed={wind_speed_10m}
                        precip={precipitation}
                    >
                        {getWeatherIcon(
                            effectiveCode, 
                            "w-24 h-24 md:w-32 md:h-32", 
                            is_day, 
                            currentRainProb, 
                            wind_speed_10m, 
                            relative_humidity_2m,
                            currentPrecip15 
                        )}
                    </LivingIcon>
                </div>

                <div className="flex flex-col justify-center">
                        <span className="text-8xl md:text-9xl font-bold text-white leading-none tracking-tighter drop-shadow-2xl">
                        {formatTemp(temperature_2m)}°
                        </span>
                        <div className="flex flex-col">
                            <span className="text-xl md:text-2xl font-medium text-indigo-200 capitalize mt-2">
                                {getWeatherLabel({ ...current, weather_code: effectiveCode }, lang)}
                            </span>
                            {/* ETIQUETA DE FONT ACTUALITZADA AL COLOR CYAN */}
                            {isHighPrecision && (
                                <span className="text-[10px] text-cyan-300/70 font-medium uppercase tracking-widest mt-0.5 animate-in fade-in">
                                    Font: Arome France
                                </span>
                            )}
                        </div>
                </div>
            </div>

            <div className="flex flex-wrap items-center gap-3">
                    <div className="flex items-center gap-3 text-indigo-100 font-bold bg-white/5 border border-white/5 px-4 py-2 rounded-full text-sm backdrop-blur-md shadow-lg">
                        <span className="text-rose-300 flex items-center gap-1">↑ {formatTemp(daily.temperature_2m_max[0])}°</span>
                        <span className="w-px h-3 bg-white/20"></span>
                        <span className="text-cyan-300 flex items-center gap-1">↓ {formatTemp(daily.temperature_2m_min[0])}°</span>
                    </div>
                    <div className="text-sm text-slate-400 font-medium px-2">
                         Sens. <span className="text-slate-200 font-bold">{formatTemp(apparent_temperature)}°</span>
                    </div>
            </div>
    </div>
  );
}