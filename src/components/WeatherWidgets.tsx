/* eslint-disable react/prop-types */
// src/components/WeatherWidgets.tsx
import React, { useState, useEffect, useMemo } from 'react';
import { 
  Sunrise, Moon, Flower2, Droplets, Zap, Mountain, Clock, Wind, Layers, AlertTriangle
} from 'lucide-react';
import { TRANSLATIONS, Language } from '../constants/translations';

const WIDGET_BASE_STYLE = "bg-gradient-to-br from-[#1a1d2d] to-[#11131f] border border-white/10 p-5 md:p-6 rounded-[2rem] relative group transition-all duration-500 hover:border-indigo-500/30 hover:shadow-[0_15px_40px_-10px_rgba(0,0,0,0.6)] h-full flex flex-col justify-between overflow-hidden ring-1 ring-white/5";
const TITLE_STYLE = "text-[10px] font-black text-indigo-200/60 uppercase tracking-[0.25em] mb-4 flex items-center gap-2 relative z-10";

export interface ChartDataPoint {
  time: string;
  temp: number;
  icon: React.ReactNode; 
  precip?: number;
  precipText?: string;
  isNow?: boolean;
}

interface WidgetProps {
  lang: Language;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [key: string]: any;
}

interface CircularGaugeProps {
    icon: React.ReactNode;
    label: string;
    value: number;
    max: number;
    subText?: string;
    color?: string;
}

interface HourlyWidgetProps {
  data: ChartDataPoint[];
  lang: Language;
}

const getTrans = (lang: Language) => TRANSLATIONS[lang] || TRANSLATIONS['ca'];

const getMoonPhaseText = (phase: number) => {
  if (phase < 0.03 || phase > 0.97) return "Nova";
  if (phase < 0.22) return "Creixent";
  if (phase < 0.28) return "1r Quart";
  if (phase < 0.47) return "Gibosa C.";
  if (phase < 0.53) return "Plena";
  if (phase < 0.72) return "Gibosa M.";
  if (phase < 0.78) return "3r Quart";
  return "Minvant";
};

const timeStringToSeconds = (timeStr: string | undefined) => {
    if (!timeStr) return 0;
    const timePart = timeStr.includes('T') ? timeStr.split('T')[1].slice(0, 5) : timeStr.slice(0, 5);
    const [hours, mins] = timePart.split(':').map(Number);
    return (hours * 3600) + (mins * 60);
};

const secondsToTime = (totalSeconds: number) => {
    const hours = Math.floor(totalSeconds / 3600).toString().padStart(2, '0');
    const minutes = Math.floor((totalSeconds % 3600) / 60).toString().padStart(2, '0');
    return `${hours}:${minutes}`;
};

const getWindDirectionText = (degrees: number) => {
    const directions = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
    const index = Math.round(degrees / 45) % 8;
    return directions[index];
};

// --- GINYS ---

export const CompassGauge = ({ degrees, speed, gusts, lang }: WidgetProps) => {
  const t = getTrans(lang);
  const directionText = getWindDirectionText(degrees);
  const gustIntensity = (gusts || 0) > 60 ? 'text-rose-400' : (gusts || 0) > 40 ? 'text-amber-400' : 'text-slate-400';
  const hasGusts = gusts && gusts > speed + 5; 

  return (
    <div className={WIDGET_BASE_STYLE}>
      <div className="flex justify-between items-start w-full z-10">
          <div className={TITLE_STYLE.replace('mb-4', 'mb-0')}>
              <Wind className="w-3.5 h-3.5 text-indigo-400" /> {t.wind || "VENT"}
          </div>
          <div className="flex flex-col items-end">
               <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">{degrees}° {directionText}</span>
          </div>
      </div>
      
      <div className="relative flex-1 flex flex-col items-center justify-center min-h-[140px] mt-2">
        <div className="relative w-40 h-40 flex items-center justify-center">
             <div className="absolute inset-0 rounded-full border border-slate-700/30 bg-[#0f111a] shadow-inner">
                {[...Array(12)].map((_, i) => (
                    <div key={i} 
                        className="absolute w-0.5 h-1.5 bg-slate-600/40 left-1/2 top-0 origin-bottom"
                        style={{ transform: `translateX(-50%) rotate(${i * 30}deg) translateY(4px)` }}
                    />
                ))}
                 <span className="absolute top-1 left-1/2 -translate-x-1/2 text-[9px] font-bold text-slate-500">N</span>
                 <span className="absolute bottom-1 left-1/2 -translate-x-1/2 text-[9px] font-bold text-slate-500">S</span>
                 <span className="absolute left-1 top-1/2 -translate-y-1/2 text-[9px] font-bold text-slate-500">W</span>
                 <span className="absolute right-1 top-1/2 -translate-y-1/2 text-[9px] font-bold text-slate-500">E</span>
             </div>

             <div className="absolute w-full h-full flex items-center justify-center transition-transform duration-1000 cubic-bezier(0.34, 1.56, 0.64, 1)" style={{ transform: `rotate(${degrees}deg)` }}>
                <div className="relative w-full h-full">
                    <div className="absolute top-2 left-1/2 -translate-x-1/2 w-0 h-0 border-l-[6px] border-l-transparent border-r-[6px] border-r-transparent border-b-[24px] border-b-emerald-400 filter drop-shadow-[0_0_8px_rgba(52,211,153,0.8)]"></div>
                    <div className="absolute bottom-2 left-1/2 -translate-x-1/2 w-0.5 h-3 bg-slate-700/50"></div>
                </div>
             </div>

             <div className="absolute flex flex-col items-center justify-center z-10 bg-[#161825]/95 backdrop-blur-md w-20 h-20 rounded-full border border-white/10 shadow-2xl ring-1 ring-white/5">
                <span className="text-2xl font-black text-white tabular-nums tracking-tighter leading-none">{Math.round(speed)}</span>
                <span className="text-[8px] text-emerald-400 font-bold uppercase tracking-wide opacity-80">km/h</span>
                
                {hasGusts && (
                    <div className="absolute -bottom-6 flex items-center gap-1 px-2 py-0.5 bg-black/40 rounded-full border border-white/5">
                        <Zap className={`w-2.5 h-2.5 ${gustIntensity}`} />
                        <span className={`text-[9px] font-mono font-bold ${gustIntensity} tabular-nums`}>
                            {Math.round(gusts)}
                        </span>
                    </div>
                )}
             </div>
        </div>
      </div>
    </div>
  );
};

export const CircularGauge = ({ icon, label, value, max, subText, color = "text-blue-400" }: CircularGaugeProps) => {
    const radius = 38;
    const circumference = 2 * Math.PI * radius; 
    const offset = circumference - (Math.min(value / max, 1) * circumference);
    return (
        <div className={WIDGET_BASE_STYLE}>
            <div className={TITLE_STYLE}>{icon} {label}</div>
            <div className="relative w-full flex-1 flex items-center justify-center">
                 <div className="relative w-32 h-32 flex items-center justify-center">
                     <svg className="w-full h-full -rotate-90 drop-shadow-xl" viewBox="0 0 100 100">
                         <circle cx="50" cy="50" r={radius} fill="none" stroke="#0f111a" strokeWidth="8" strokeLinecap="round" className="opacity-50" />
                         <circle cx="50" cy="50" r={radius} fill="none" stroke="#1e293b" strokeWidth="8" strokeLinecap="round" />
                         <circle cx="50" cy="50" r={radius} fill="none" stroke="currentColor" strokeWidth="8" strokeLinecap="round" 
                            className={`${color} filter drop-shadow-[0_0_4px_rgba(255,255,255,0.3)]`}
                            style={{ strokeDasharray: circumference, strokeDashoffset: offset, transition: "stroke-dashoffset 1.5s cubic-bezier(0.34, 1.56, 0.64, 1)" }} />
                     </svg>
                     <div className="absolute flex flex-col items-center">
                         <span className="text-3xl font-black text-white tabular-nums tracking-tighter">{value}</span>
                         {subText && <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider bg-white/5 px-2 py-0.5 rounded-full border border-white/5 mt-1">{subText}</span>}
                     </div>
                 </div>
            </div>
        </div>
    );
};

export const CloudLayersWidget = ({ low, mid, high, lang }: WidgetProps) => {
  const t = getTrans(lang);
  let title = "NÚVOLS";
  let lHigh = "Alts", lMid = "Mitjans", lLow = "Baixos";
  if (typeof t.cloudLayers === 'object') { title = t.cloudLayers.title.toUpperCase(); lHigh = t.cloudLayers.high; lMid = t.cloudLayers.mid; lLow = t.cloudLayers.low; }

  const layers = [
      { l: lHigh, v: high, color: 'from-blue-200 to-blue-300' },
      { l: lMid, v: mid, color: 'from-blue-300 to-blue-500' },
      { l: lLow, v: low, color: 'from-blue-500 to-indigo-600' },
  ];

  return (
    <div className={WIDGET_BASE_STYLE}>
       <div className={TITLE_STYLE}><Layers className="w-3.5 h-3.5 text-blue-400" /> {title}</div>
       <div className="flex-1 flex items-end justify-between gap-2 px-1 relative">
          <div className="absolute inset-0 flex flex-col justify-between py-2 pointer-events-none opacity-20">
              <div className="w-full border-t border-dashed border-slate-500"></div>
              <div className="w-full border-t border-dashed border-slate-500"></div>
              <div className="w-full border-t border-dashed border-slate-500"></div>
              <div className="w-full border-t border-dashed border-slate-500"></div>
          </div>

          {layers.map((layer, i) => (
             <div key={i} className="flex flex-col items-center justify-end w-full h-full relative group/beam z-10">
                 <div className="w-full relative rounded-t-lg overflow-hidden bg-[#0f111a] border-x border-t border-white/5 h-full flex items-end shadow-inner">
                     <div 
                        className={`w-full transition-all duration-1000 ease-out bg-gradient-to-t ${layer.color} relative`}
                        style={{ height: `${Math.max(5, layer.v)}%`, opacity: layer.v === 0 ? 0.1 : 0.9 }}
                     >
                        <div className="absolute top-0 w-full h-[2px] bg-white/50 shadow-[0_0_10px_white]"></div>
                     </div>
                 </div>
                 
                 <div className="mt-2 text-center z-20">
                     <span className="block text-[18px] font-black text-white tabular-nums leading-none mb-0.5">{Math.round(layer.v)}<span className="text-[9px] align-top opacity-50">%</span></span>
                     <span className="block text-[8px] font-bold text-slate-500 uppercase tracking-wider">{layer.l}</span>
                 </div>
             </div>
          ))}
      </div>
    </div>
  );
};

export const SnowLevelWidget = ({ freezingLevel, unit, lang }: WidgetProps) => {
    const t = getTrans(lang);
    const snowLimit = Math.max(0, (freezingLevel || 0) - 300);
    const isFt = unit === 'imperial' || unit === 'F';
    const displayLevel = isFt ? Math.round(snowLimit * 3.28084) : Math.round(snowLimit);
    
    return (
        <div className={WIDGET_BASE_STYLE}>
            <div className={TITLE_STYLE}><Mountain className="w-3.5 h-3.5 text-indigo-300" /> {t.snowLevel || "COTA NEU"}</div>
            <div className="flex-1 flex flex-col items-center justify-center relative overflow-hidden rounded-xl">
                <div className="absolute inset-0 flex items-end justify-center opacity-20">
                    <svg viewBox="0 0 100 60" className="w-full h-full text-indigo-500 fill-current" preserveAspectRatio="none">
                        <path d="M50 10 L100 60 L0 60 Z" />
                    </svg>
                </div>
                <div className="absolute top-[40%] w-full border-t border-dashed border-indigo-300/30"></div>
                <div className="z-10 text-center flex flex-col items-center">
                    <span className="text-5xl font-black text-white tracking-tighter tabular-nums drop-shadow-xl">{displayLevel}</span>
                    <div className="flex items-center gap-1 mt-1 bg-[#0f111a]/80 px-2 py-0.5 rounded border border-white/10 backdrop-blur-sm">
                        <span className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-pulse"></span>
                        <span className="text-[9px] font-bold text-indigo-200 uppercase tracking-widest">{isFt ? 'FT' : 'METRES'}</span>
                    </div>
                </div>
            </div>
        </div>
    );
};

export const DewPointWidget = ({ value, humidity, lang }: WidgetProps) => {
    const t = getTrans(lang);
    return (
      <div className={WIDGET_BASE_STYLE}>
          <div className={TITLE_STYLE}><Droplets className="w-3.5 h-3.5 text-cyan-400" /> {t.dewPoint || "ROSADA"}</div>
          <div className="flex items-center justify-between px-2 flex-1 pb-4">
              <div className="flex flex-col items-start">
                  <span className="text-4xl font-black text-white tabular-nums tracking-tighter drop-shadow-lg">{Math.round(value)}°</span>
                  <span className="text-[9px] text-slate-500 font-bold uppercase tracking-wide mt-1">Punt Rosada</span>
              </div>
              <div className="h-10 w-px bg-gradient-to-b from-transparent via-white/10 to-transparent mx-2"></div>
              <div className="flex flex-col items-end">
                  <span className="text-2xl font-bold text-cyan-400 tabular-nums">{humidity}%</span>
                  <span className="text-[9px] text-slate-500 font-bold uppercase tracking-wide mt-1 text-right">Humitat Rel.</span>
              </div>
          </div>
          <div className="w-full h-1.5 bg-[#0f111a] rounded-full overflow-hidden border border-white/5">
              <div className={`h-full rounded-full ${value > 20 ? 'bg-rose-500' : value > 15 ? 'bg-amber-400' : 'bg-emerald-400'} shadow-[0_0_8px_currentColor]`} style={{width: `${Math.min(((value + 10) / 40) * 100, 100)}%`}}></div>
          </div>
      </div>
    );
};

export const CapeWidget = ({ cape, lang }: WidgetProps) => {
    const t = getTrans(lang);
    
    // Nivells d'alerta
    let severity = 'Estable';
    let color = 'text-emerald-400';
    let barColor = 'bg-gradient-to-t from-emerald-500 via-emerald-400 to-transparent';
    const heightPct = Math.min((cape / 3000) * 100, 100); // CORREGIT: 'const' en lloc de 'let'

    if (cape > 2500) { severity = 'Severa'; color = 'text-rose-500'; barColor = 'bg-gradient-to-t from-rose-600 via-rose-500 to-orange-500'; }
    else if (cape > 1000) { severity = 'Alta'; color = 'text-amber-400'; barColor = 'bg-gradient-to-t from-amber-500 via-yellow-400 to-transparent'; }
    else if (cape > 500) { severity = 'Moderada'; color = 'text-yellow-300'; barColor = 'bg-gradient-to-t from-yellow-400 to-transparent'; }

    return (
      <div className={WIDGET_BASE_STYLE}>
          <div className={TITLE_STYLE}><Zap className="w-3.5 h-3.5 text-amber-400" /> {t.instability || "CAPE"}</div>
          <div className="flex-1 flex items-stretch gap-4 relative">
              <div className="w-3 bg-[#0f111a] rounded-full border border-white/10 relative overflow-hidden flex flex-col justify-end shadow-inner">
                  <div className="absolute inset-0 flex flex-col justify-between py-1 px-0.5 opacity-30 z-10 pointer-events-none">
                      {[...Array(10)].map((_, i) => <div key={i} className="w-full h-px bg-white"></div>)}
                  </div>
                  <div className={`w-full ${barColor} transition-all duration-1000 ease-out relative`} style={{ height: `${Math.max(5, heightPct)}%` }}>
                      <div className="absolute top-0 w-full h-[2px] bg-white shadow-[0_0_8px_white]"></div>
                  </div>
              </div>

              <div className="flex-1 flex flex-col justify-center">
                  <span className={`text-4xl font-black tracking-tighter tabular-nums ${color} drop-shadow-lg leading-none`}>
                      {Math.round(cape)}
                  </span>
                  <span className="text-[9px] text-slate-500 font-bold uppercase tracking-widest mb-3">J/kg</span>
                  
                  <div className={`flex items-center gap-1.5 px-2 py-1 rounded-md border bg-black/20 w-fit ${cape > 1000 ? 'border-amber-500/30' : 'border-white/5'}`}>
                      {cape > 1000 && <AlertTriangle className={`w-3 h-3 ${color}`} />}
                      <span className={`text-[9px] font-black uppercase tracking-wider ${color}`}>
                          {severity}
                      </span>
                  </div>
              </div>
          </div>
      </div>
    );
};

export const PollenWidget = ({ data, lang }: WidgetProps) => {
    const t = getTrans(lang);
    const aqi = data?.us_aqi ?? 0;
    
    const getAQIColor = (val: number) => {
        if (val > 150) return 'text-rose-500';
        if (val > 100) return 'text-orange-400';
        if (val > 50) return 'text-yellow-400';
        return 'text-emerald-400';
    };
    
    const colorClass = getAQIColor(aqi);
    const label = aqi > 150 ? "MALA" : aqi > 100 ? "SENSIBLE" : aqi > 50 ? "MODERADA" : "B O N A";

    return (
        <div className={`${WIDGET_BASE_STYLE} !flex-row items-center gap-6`}>
            <div className="relative w-16 h-16 flex items-center justify-center bg-[#0f111a] rounded-xl border border-white/5 shadow-inner group">
                <Flower2 className={`w-8 h-8 ${colorClass} transition-colors duration-500`} />
                <div className={`absolute -top-1 -right-1 w-3 h-3 rounded-full ${aqi > 50 ? 'bg-amber-500 animate-pulse' : 'bg-emerald-500'} border-2 border-[#151725]`}></div>
            </div>

            <div className="flex-1 flex flex-col justify-center">
                <div className="flex justify-between items-center mb-1">
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.2em]">{t.airQuality || "QUALITAT AIRE"}</span>
                    <span className={`text-xs font-mono font-bold ${colorClass} tabular-nums`}>AQI {aqi}</span>
                </div>
                
                <div className="flex gap-0.5 h-3 w-full mb-2">
                    {[...Array(20)].map((_, i) => {
                        const threshold = i * (300/20);
                        const isActive = aqi >= threshold;
                        const segmentColor = threshold > 150 ? 'bg-rose-500' : threshold > 100 ? 'bg-orange-400' : threshold > 50 ? 'bg-yellow-400' : 'bg-emerald-500';
                        return (
                            <div 
                                key={i} 
                                className={`flex-1 rounded-sm transition-all duration-500 ${isActive ? segmentColor : 'bg-[#0f111a] border border-white/5'}`}
                                style={{ opacity: isActive ? 1 : 0.2 }}
                            ></div>
                        );
                    })}
                </div>

                <span className={`text-xl font-black ${colorClass} tracking-tighter uppercase drop-shadow-md`}>
                    {label}
                </span>
            </div>
        </div>
    );
};

// CORREGIT: Ús d'inicialització mandrosa per evitar l'error "impure function"
export const SunArcWidget = ({ sunrise, sunset, lang, utcOffset }: WidgetProps) => {
    const t = getTrans(lang);
    // FIX: () => Math.floor... evita que s'executi a cada render
    const [currentTimeSeconds, setCurrentTimeSeconds] = useState<number>(() => Math.floor(Date.now() / 1000));

    // Timer pur: actualitza l'estat cada minut
    useEffect(() => {
        const timer = setInterval(() => {
             setCurrentTimeSeconds(Math.floor(Date.now() / 1000));
        }, 60000); 
        return () => clearInterval(timer);
    }, []);

    const { sunPosition, progressPercent, statusText, countdown, isDaytime, displaySunrise, displaySunset } = useMemo(() => {
        if (!sunrise || !sunset) return { 
            sunPosition: { x: 0, y: 100 }, progressPercent: 0, statusText: '--', countdown: '', isDaytime: true, displaySunrise: '--:--', displaySunset: '--:--'
        };

        const localNowTotalSeconds = currentTimeSeconds + (utcOffset || 0);
        const currentSecondsOfDay = localNowTotalSeconds % 86400;

        const sunriseSeconds = timeStringToSeconds(sunrise);
        const sunsetSeconds = timeStringToSeconds(sunset);

        let diffSeconds = 0;
        let nextEventLabel = "";
        let isDay = false;
        let pct = 0;

        if (currentSecondsOfDay >= sunriseSeconds && currentSecondsOfDay < sunsetSeconds) {
            isDay = true;
            nextEventLabel = lang === 'ca' ? "Posta de sol" : "Sunset in";
            diffSeconds = sunsetSeconds - currentSecondsOfDay;
            const dayDuration = sunsetSeconds - sunriseSeconds;
            pct = (currentSecondsOfDay - sunriseSeconds) / dayDuration;
        } else {
            isDay = false;
            nextEventLabel = lang === 'ca' ? "Sortida" : "Sunrise in";
            if (currentSecondsOfDay < sunriseSeconds) {
                diffSeconds = sunriseSeconds - currentSecondsOfDay;
                pct = 0; 
            } else {
                diffSeconds = (86400 - currentSecondsOfDay) + sunriseSeconds;
                pct = 1; 
            }
        }

        const hoursLeft = Math.floor(diffSeconds / 3600);
        const minsLeft = Math.floor((diffSeconds % 3600) / 60);
        const countdownStr = `${hoursLeft}h ${minsLeft}m`;

        const tVal = Math.max(0, Math.min(1, pct));
        const p0 = { x: 10, y: 90 };
        const p1 = { x: 50, y: 10 };
        const p2 = { x: 90, y: 90 };

        const x = Math.pow(1-tVal, 2) * p0.x + 2 * (1-tVal) * tVal * p1.x + Math.pow(tVal, 2) * p2.x;
        const y = Math.pow(1-tVal, 2) * p0.y + 2 * (1-tVal) * tVal * p1.y + Math.pow(tVal, 2) * p2.y;

        return {
            sunPosition: { x, y },
            progressPercent: tVal * 100,
            statusText: nextEventLabel,
            countdown: countdownStr,
            isDaytime: isDay,
            displaySunrise: secondsToTime(sunriseSeconds),
            displaySunset: secondsToTime(sunsetSeconds)
        };
    }, [currentTimeSeconds, sunrise, sunset, lang, utcOffset]);

    return (
        <div className={WIDGET_BASE_STYLE}>
             <div className="flex justify-between items-start w-full z-10">
                <div className={TITLE_STYLE.replace('mb-4', 'mb-0')}>
                    <Sunrise className="w-3.5 h-3.5 text-amber-400" />
                    {t.sunCycle || "CICLE SOLAR"}
                </div>
                <div className="flex flex-col items-end">
                    <span className="text-[9px] text-slate-500 font-bold uppercase tracking-wider">{statusText}</span>
                    <div className="flex items-center gap-1.5 mt-0.5">
                        <span className={`w-1.5 h-1.5 rounded-full animate-pulse ${isDaytime ? 'bg-amber-400' : 'bg-indigo-400'}`}></span>
                        <span className={`text-xs font-mono font-medium tabular-nums tracking-wide ${isDaytime ? 'text-amber-100' : 'text-indigo-100'}`}>
                            {countdown}
                        </span>
                    </div>
                </div>
             </div>

             <div className="relative flex-1 w-full flex items-center justify-center mt-2">
                 <svg className="w-full h-28 overflow-visible" viewBox="0 0 100 100" preserveAspectRatio="none">
                     <defs>
                        <linearGradient id="arcGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                            <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.4" />
                            <stop offset="50%" stopColor="#fbbf24" stopOpacity="0.8" />
                            <stop offset="100%" stopColor="#6366f1" stopOpacity="0.4" />
                        </linearGradient>
                        <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
                            <feGaussianBlur stdDeviation="2.5" result="coloredBlur"/>
                            <feMerge>
                                <feMergeNode in="coloredBlur"/>
                                <feMergeNode in="SourceGraphic"/>
                            </feMerge>
                        </filter>
                     </defs>

                     <path d="M 10,90 Q 50,10 90,90" fill="none" stroke="#1e293b" strokeWidth="2" strokeDasharray="4 4" strokeLinecap="round" />
                     
                     <path 
                        d="M 10,90 Q 50,10 90,90" 
                        fill="none" 
                        stroke="url(#arcGradient)" 
                        strokeWidth="3" 
                        strokeLinecap="round"
                        strokeDasharray="135" 
                        strokeDashoffset={135 - (135 * (isDaytime ? progressPercent / 100 : 0))} 
                        className="transition-all duration-1000 ease-out opacity-80"
                     />

                     <g style={{ transform: `translate(${sunPosition.x}px, ${sunPosition.y}px)`, transition: 'transform 1s cubic-bezier(0.4, 0, 0.2, 1)' }}>
                        <circle r="8" fill={isDaytime ? "#fbbf24" : "#6366f1"} className="opacity-20 animate-pulse" />
                        <circle r="3.5" fill={isDaytime ? "#fff" : "#a5b4fc"} filter="url(#glow)" className="drop-shadow-[0_0_8px_rgba(251,191,36,0.8)]" />
                     </g>
                 </svg>

                 <div className="absolute bottom-0 w-full h-px bg-gradient-to-r from-transparent via-white/10 to-transparent"></div>
             </div>
             
             <div className="flex justify-between items-end w-full mt-2 px-2">
                 <div className="flex flex-col items-start gap-1">
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">{t.sunrise || "SORTIDA"}</span>
                    <span className="text-sm font-mono font-medium text-white tabular-nums bg-[#151725] px-2 py-0.5 rounded border border-white/5">
                        {displaySunrise}
                    </span>
                 </div>
                 
                 <div className="flex flex-col items-end gap-1">
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">{t.sunset || "POSTA"}</span>
                    <span className="text-sm font-mono font-medium text-white tabular-nums bg-[#151725] px-2 py-0.5 rounded border border-white/5">
                        {displaySunset}
                    </span>
                 </div>
             </div>
        </div>
    );
};

export const MoonWidget = ({ phase, lat, lang }: WidgetProps) => {
    const t = getTrans(lang);
    const pct = Math.round(phase * 100);
    const moonText = getMoonPhaseText(phase);
    const moonAge = Math.round(phase * 29.53);
    const isSouth = (lat ?? 0) < 0;

    return (
        <div className={WIDGET_BASE_STYLE}>
             <div className="flex items-center justify-between w-full mb-2">
                 <span className={TITLE_STYLE.replace('mb-4', 'mb-0')}><Moon className="w-3.5 h-3.5 text-indigo-300" /> {t.moonPhase || "LLUNA"}</span>
                 <div className="flex flex-col items-end">
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Dia {moonAge}</span>
                 </div>
             </div>
             
             <div className="flex items-center justify-center flex-1 gap-6">
                 <div className="w-20 h-20 rounded-full bg-[#0f111a] border border-slate-700/50 relative overflow-hidden shadow-2xl ring-1 ring-black">
                    {/* AQUI ESTÀ LA CORRECCIÓ: invertit per Hemisferi Nord */}
                    <div className="absolute inset-0 w-full h-full" style={{ transform: isSouth ? 'none' : 'scaleX(-1)' }}>
                        <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/stardust.png')] opacity-30"></div>
                        <div className="absolute inset-0 rounded-full bg-slate-800 shadow-inner"></div>
                        
                        <div 
                            className="absolute inset-0 rounded-full transition-all duration-1000 bg-slate-200"
                            style={{ 
                                clipPath: `inset(0 ${100 - pct}% 0 0)`, 
                                filter: 'blur(2px)', 
                                mixBlendMode: 'screen' 
                            }}
                        ></div>
                        
                        <div className="absolute top-4 left-5 w-4 h-4 bg-black/10 rounded-full blur-[1px]"></div>
                        <div className="absolute bottom-5 right-4 w-6 h-6 bg-black/10 rounded-full blur-[1px]"></div>
                        <div className="absolute top-8 right-2 w-3 h-3 bg-black/10 rounded-full blur-[0.5px]"></div>
                    </div>
                 </div>
                 
                 <div className="flex flex-col justify-center">
                    <span className="text-2xl font-black text-white tracking-tight">{pct}%</span>
                    <span className="text-sm text-indigo-200 font-bold mb-1">{moonText}</span>
                    <span className="text-[8px] text-slate-500 font-bold uppercase tracking-widest border-t border-white/5 pt-1 mt-1">
                        Il·luminació
                    </span>
                 </div>
             </div>
        </div>
    );
};

export const HourlyForecastWidget = ({ data, lang }: HourlyWidgetProps) => {
  const t = getTrans(lang);
  return (
    <div className="w-full h-full flex flex-col bg-[#0b0c15] rounded-[2rem] border border-white/5 overflow-hidden shadow-2xl relative">
      <style>{`
        .custom-scroll::-webkit-scrollbar { height: 4px; }
        .custom-scroll::-webkit-scrollbar-track { background: transparent; margin: 0 20px; }
        .custom-scroll::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.15); border-radius: 10px; }
        .custom-scroll::-webkit-scrollbar-thumb:hover { background: rgba(255,255,255,0.3); }
      `}</style>
      
      <div className="px-6 py-4 flex items-center justify-between border-b border-white/5 bg-[#11131f]/80 backdrop-blur-md sticky top-0 z-20">
         <div className="flex items-center gap-2">
            <Clock className="w-3.5 h-3.5 text-indigo-400" />
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.25em]">{t.hourlyForecast || "EVOLUCIÓ 24H"}</span>
         </div>
      </div>
      
      <div className="flex overflow-x-auto px-4 py-5 gap-3 custom-scroll snap-x bg-gradient-to-b from-[#0b0c15] to-[#11131f]">
        {data.map((hour, idx) => {
            const hasPrecip = (hour.precip || 0) > 0;
            const cardClass = hour.isNow 
                ? 'bg-indigo-600/10 border-indigo-500/40 ring-1 ring-indigo-500/20 shadow-[0_0_15px_rgba(99,102,241,0.2)]' 
                : 'bg-[#151725] border-white/5 hover:border-white/20 hover:bg-[#1e2130]';

            return (
              <div key={idx} className={`flex-shrink-0 flex flex-col items-center justify-between w-[72px] h-[145px] py-3 rounded-[1.25rem] border ${cardClass} transition-all duration-300 snap-start group`}>
                <span className={`text-[10px] font-bold ${hour.isNow ? 'text-indigo-300' : 'text-slate-500 group-hover:text-slate-300'}`}>{hour.time}</span>
                
                <div className="my-1 scale-90 group-hover:scale-110 transition-transform duration-300 filter drop-shadow-lg">
                    {hour.icon}
                </div>
                
                <div className="flex flex-col items-center w-full gap-1.5">
                    <span className="text-lg font-black text-white tabular-nums tracking-tight">{Math.round(hour.temp)}°</span>
                    <div className="w-full px-2.5">
                        <div className="w-full h-1 bg-[#0f111a] rounded-full overflow-hidden">
                            <div className="h-full bg-blue-500 rounded-full transition-all" style={{width: `${hasPrecip ? Math.max(hour.precip || 0, 30) : 0}%`, opacity: hasPrecip ? 1 : 0}}></div>
                        </div>
                    </div>
                    <span className="text-[8px] font-bold text-blue-400 tabular-nums h-2 leading-none opacity-80">{hour.precipText || ''}</span>
                </div>
              </div>
            );
        })}
      </div>
    </div>
  );
};

export const TempRangeBar = ({ min, max, globalMin, globalMax }: { min: number, max: number, globalMin: number, globalMax: number }) => {
    const totalRange = (globalMax - globalMin) || 1;
    const leftPercent = ((min - globalMin) / totalRange) * 100;
    const widthPercent = ((max - min) / totalRange) * 100;

    return (
        <div className="w-full h-2.5 bg-[#0f111a] rounded-full relative overflow-hidden border border-white/10 shadow-inner">
            <div className="absolute inset-0 opacity-20 bg-slate-800"></div>
            <div 
                className="absolute h-full rounded-full bg-gradient-to-r from-sky-400 via-yellow-400 to-rose-500 shadow-[0_0_10px_rgba(251,191,36,0.4)]"
                style={{ 
                    left: `${Math.max(0, Math.min(100, leftPercent))}%`, 
                    width: `${Math.max(5, Math.min(100, widthPercent))}%`,
                    transition: 'all 1s cubic-bezier(0.4, 0, 0.2, 1)'
                }}
            ></div>
        </div>
    );
};

export const VisibilityWidget = () => <div className="hidden" />;