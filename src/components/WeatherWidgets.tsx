// src/components/WeatherWidgets.tsx
import React from 'react';
import { 
  Sunrise, Sunset, Moon, Flower2, TrendingUp, TrendingDown, Minus, 
  Thermometer, Droplets, Zap, Mountain, Cloud
} from 'lucide-react';
import { TRANSLATIONS, Language } from '../constants/translations';
import { WeatherUnit } from '../utils/formatters';

// --- ESTIL BASE ---
const WIDGET_BASE_STYLE = "bg-slate-900/60 border border-slate-800/50 p-4 rounded-2xl backdrop-blur-sm relative group transition-all duration-300 hover:scale-[1.02] hover:bg-white/10 hover:border-white/30 hover:shadow-2xl h-full flex flex-col justify-between";

// --- HELPERS ---
const getMoonPhaseText = (phase: number, lang: Language = 'ca') => {
  const t = TRANSLATIONS[lang] ? TRANSLATIONS[lang].moonPhases : TRANSLATIONS['ca'].moonPhases;
  if (phase < 0.03 || phase > 0.97) return t.new;
  if (phase < 0.22) return t.waxingCrescent;
  if (phase < 0.28) return t.firstQuarter;
  if (phase < 0.47) return t.waxingGibbous;
  if (phase < 0.53) return t.full;
  if (phase < 0.72) return t.waningGibbous;
  if (phase < 0.78) return t.lastQuarter;
  return t.waningCrescent;
};

// --- INTERFÍCIES ---
interface BaseWidgetProps {
    lang?: Language;
}

// --- WIDGETS ---

interface TempRangeBarProps {
    min: number; max: number;
    globalMin: number; globalMax: number;
    displayMin: number; displayMax: number;
}
export const TempRangeBar = ({ min, max, globalMin, globalMax, displayMin, displayMax }: TempRangeBarProps) => {
  const totalRange = globalMax - globalMin || 1;
  const safeMin = Math.max(min, globalMin);
  const safeMax = Math.min(max, globalMax);
  const leftPct = ((safeMin - globalMin) / totalRange) * 100;
  const widthPct = ((safeMax - safeMin) / totalRange) * 100;

  return (
    <div className="flex items-center gap-3 w-full max-w-[12rem] md:max-w-[16rem]">
      <span className="text-xs text-slate-400 w-8 text-right font-medium tabular-nums">{displayMin}°</span>
      <div className="flex-1 h-1.5 bg-slate-700/50 rounded-full relative overflow-hidden">
        <div className="absolute h-full rounded-full bg-gradient-to-r from-cyan-400 via-indigo-400 to-amber-400 opacity-90" style={{ left: `${leftPct}%`, width: `${widthPct}%`, minWidth: '6px' }} />
      </div>
      <span className="text-xs text-white w-8 text-left font-bold tabular-nums">{displayMax}°</span>
    </div>
  )
};

interface SunArcWidgetProps extends BaseWidgetProps {
    sunrise: string; sunset: string; shiftedNow: Date;
}
export const SunArcWidget = ({ sunrise, sunset, lang = 'ca', shiftedNow }: SunArcWidgetProps) => {
  const t = TRANSLATIONS[lang] || TRANSLATIONS['ca'];
  const sunriseTime = new Date(sunrise).getTime();
  const sunsetTime = new Date(sunset).getTime();
  const now = shiftedNow.getTime();

  const isToday = shiftedNow.toDateString() === new Date(sunrise).toDateString();
  
  let progress = 0;
  let nextEventText = "";
  
  if (isToday) {
     const totalDayLength = sunsetTime - sunriseTime;
     const elapsed = now - sunriseTime;
     progress = Math.max(0, Math.min(1, elapsed / totalDayLength));
     
     if (now < sunriseTime) {
        const diff = sunriseTime - now;
        const h = Math.floor(diff / 3600000);
        const m = Math.floor((diff % 3600000) / 60000);
        nextEventText = `${t.sunRiseIn} ${h}h ${m}m`;
     } else if (now < sunsetTime) {
        const diff = sunsetTime - now;
        const h = Math.floor(diff / 3600000);
        const m = Math.floor((diff % 3600000) / 60000);
        nextEventText = `${t.sunSetIn} ${h}h ${m}m`;
     } else { nextEventText = t.sunSetDone; }
  } else if (now > sunsetTime) { progress = 1; nextEventText = t.sunSetDone; }
  
  const r = 35; const cx = 50; const cy = 50;
  const angle = Math.PI - (progress * Math.PI);
  const sunX = cx + r * Math.cos(angle);
  const sunY = cy - r * Math.sin(angle); 

  return (
    <div className={`${WIDGET_BASE_STYLE} min-h-[140px] items-center justify-center`}>
       <div className="w-full flex justify-between items-center text-xs text-slate-400 font-medium uppercase tracking-wider mb-2">
          <span className="flex items-center gap-1"><Sunrise className="w-3 h-3 text-orange-400" strokeWidth={2.5}/> {t.sunrise}</span>
          <span className="flex items-center gap-1">{t.sunset} <Sunset className="w-3 h-3 text-purple-400" strokeWidth={2.5}/></span>
       </div>
       <div className="relative w-full h-24 overflow-hidden">
          <svg viewBox="0 0 100 60" className="w-full h-full">
             <path d="M10,50 A40,40 0 0,1 90,50" fill="none" stroke="#334155" strokeWidth="2" strokeDasharray="4 4" />
             <g transform={`translate(${sunX - 6}, ${sunY - 6})`}>
                <circle cx="6" cy="6" r="4" fill="#fbbf24" className="animate-pulse shadow-lg shadow-amber-500/50" />
                <circle cx="6" cy="6" r="8" stroke="#fbbf24" strokeWidth="1" opacity="0.5" />
             </g>
             <line x1="0" y1="55" x2="100" y2="55" stroke="#1e293b" strokeWidth="1" />
          </svg>
          <div className="absolute bottom-2 left-0 right-0 text-center">
             <span className="text-[10px] font-bold text-amber-300 bg-amber-900/30 px-2 py-0.5 rounded-full border border-amber-500/20 backdrop-blur-sm">{nextEventText}</span>
          </div>
       </div>
       <div className="w-full flex justify-between items-end -mt-4 z-10">
          <span className="text-sm font-bold text-white">{new Date(sunrise).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}</span>
          <span className="text-xs text-amber-400 font-medium bg-amber-500/10 px-2 py-0.5 rounded-full border border-amber-500/20">{isToday ? (progress > 0 && progress < 1 ? t.day : t.night) : t.sun}</span>
          <span className="text-sm font-bold text-white">{new Date(sunset).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}</span>
       </div>
    </div>
  );
};

interface MoonPhaseIconProps extends BaseWidgetProps {
    phase: number; lat?: number; className?: string;
}
export const MoonPhaseIcon = ({ phase, lat = 41, className = "w-4 h-4", lang = 'ca' }: MoonPhaseIconProps) => {
  const uniqueId = React.useId().replace(/:/g, '');
  
  const p = phase % 1;
  const r = 9; const cx = 12; const cy = 12; const theta = p * 2 * Math.PI;
  const rx = Math.abs(r * Math.cos(theta));
  const isWaxing = p <= 0.5; const isCrescent = (p < 0.25) || (p > 0.75); 
  const outerD = isWaxing ? `M ${cx},${cy-r} A ${r},${r} 0 0 1 ${cx},${cy+r}` : `M ${cx},${cy-r} A ${r},${r} 0 0 0 ${cx},${cy+r}`;
  let sweep = 0; if (isWaxing) { sweep = isCrescent ? 0 : 1; } else { sweep = !isCrescent ? 0 : 1; }
  const innerD = `A ${rx},${r} 0 0 ${sweep} ${cx},${cy-r}`;
  const d = `${outerD} ${innerD} Z`;
  const transform = lat < 0 ? "scale(-1, 1)" : "";

  return (
    <svg viewBox="0 0 24 24" className={`${className} filter drop-shadow-md`} style={{transform}} stroke="none">
       <title>{getMoonPhaseText(phase, lang)}</title>
       <defs>
         <radialGradient id={`moonGradient-${uniqueId}`} cx="50%" cy="50%" r="80%" fx="30%" fy="30%"> 
            <stop offset="0%" stopColor="#f1f5f9" /> 
            <stop offset="90%" stopColor="#cbd5e1" /> 
         </radialGradient>
         <filter id={`moonGlow-${uniqueId}`} x="-20%" y="-20%" width="140%" height="140%"> <feGaussianBlur stdDeviation="0.8" result="blur" /> <feComposite in="SourceGraphic" in2="blur" operator="over" /> </filter>
       </defs>
       <circle cx={cx} cy={cy} r={r} fill="#1e293b" stroke="#334155" strokeWidth="0.5" />
       <path d={d} fill={`url(#moonGradient-${uniqueId})`} className="" />
    </svg>
  );
};

interface MoonWidgetProps extends BaseWidgetProps {
    phase: number; lat: number;
}
export const MoonWidget = ({ phase, lat, lang = 'ca' }: MoonWidgetProps) => {
  const t = TRANSLATIONS[lang] || TRANSLATIONS['ca'];
  const phaseName = getMoonPhaseText(phase, lang);
  const illumination = Math.round((1 - Math.abs((phase - 0.5) * 2)) * 100);
  return (
    <div className={`${WIDGET_BASE_STYLE} min-h-[140px] items-center justify-center`}>
       <div className="absolute top-4 left-4 flex items-center gap-2 text-xs font-bold uppercase text-indigo-300 tracking-wider"><Moon className="w-3 h-3" strokeWidth={2.5} /> {t.moonPhase}</div>
       <div className="flex flex-col items-center justify-center mt-2">
          <div className="relative">
             <div className="absolute inset-0 bg-indigo-500/10 blur-xl rounded-full"></div>
             <MoonPhaseIcon phase={phase} lat={lat} className="w-16 h-16 text-slate-200 relative z-10" lang={lang} />
          </div>
          <span className="text-lg font-bold text-white mt-4">{phaseName}</span>
          <span className="text-xs text-slate-400 mt-1 font-medium bg-slate-800/50 px-2 py-0.5 rounded-full border border-slate-700">{illumination}% {t.illumination}</span>
       </div>
    </div>
  );
};

interface PollenWidgetProps extends BaseWidgetProps {
    data: any; // AqiData.current
}
export const PollenWidget = ({ data, lang = 'ca' }: PollenWidgetProps) => {
  if (!data) return null;
  const t = TRANSLATIONS[lang] || TRANSLATIONS['ca'];
  
  // Per simplificar, tipem com string key access ja que sabem que existeixen
  const pollenMap = [
    { key: 'alder', val: data.alder_pollen },
    { key: 'birch', val: data.birch_pollen },
    { key: 'grass', val: data.grass_pollen },
    { key: 'mugwort', val: data.mugwort_pollen },
    { key: 'olive', val: data.olive_pollen },
    { key: 'ragweed', val: data.ragweed_pollen }
  ];

  const getLevelColor = (val: number) => {
    if (!val || val < 10) return 'bg-green-500'; 
    if (val < 50) return 'bg-yellow-500'; 
    if (val < 200) return 'bg-orange-500'; 
    return 'bg-red-500'; 
  };

  return (
    <div className={`${WIDGET_BASE_STYLE} min-h-[140px]`}>
       <div className="flex items-center gap-2 text-xs font-bold uppercase text-indigo-300 tracking-wider mb-3">
         <Flower2 className="w-3 h-3" strokeWidth={2.5} /> {t.pollen}
       </div>
       <div className="grid grid-cols-2 gap-2 flex-1">
          {pollenMap.map((item) => (
             <div key={item.key} className="flex items-center justify-between bg-slate-950/30 p-2 rounded-lg border border-white/5">
                <span className="text-xs text-slate-300 font-medium">{(t.pollenTypes as any)[item.key]}</span>
                <div className={`w-2.5 h-2.5 rounded-full ${getLevelColor(item.val)} shadow-sm`}></div>
             </div>
          ))}
       </div>
    </div>
  );
};

interface CompassGaugeProps extends BaseWidgetProps {
    degrees: number; speed: number; label: string; subText?: string;
}
export const CompassGauge = ({ degrees, speed, label, subText, lang = 'ca' }: CompassGaugeProps) => {
  const t = TRANSLATIONS[lang] || TRANSLATIONS['ca'];
  const directions = t.directions || ['N', 'NE', 'E', 'SE', 'S', 'SO', 'O', 'NO'];
  const index = Math.round(((degrees %= 360) < 0 ? degrees + 360 : degrees) / 45) % 8;
  const dirText = directions[index];
  
  const N = directions[0];
  const S = directions[4];
  const E = directions[2];
  const W = directions[6];

  return (
    <div className={`${WIDGET_BASE_STYLE} items-center justify-center`}>
      <div className="relative w-24 h-24 flex items-center justify-center mb-1">
         <div className="absolute inset-0 rounded-full border-2 border-slate-800 flex items-center justify-center">
            <span className="absolute top-1 text-[8px] text-slate-500 font-bold">{N}</span>
            <span className="absolute bottom-1 text-[8px] text-slate-500 font-bold">{S}</span>
            <span className="absolute left-1 text-[8px] text-slate-500 font-bold">{W}</span>
            <span className="absolute right-1 text-[8px] text-slate-500 font-bold">{E}</span>
         </div>
         <div 
            className="w-full h-full flex items-center justify-center transition-transform duration-1000 ease-out"
            style={{ transform: `rotate(${degrees}deg)` }}
         >
             <div className="w-1 h-12 bg-gradient-to-b from-red-500 to-transparent rounded-full relative -top-2">
                <div className="absolute top-0 left-1/2 transform -translate-x-1/2 -mt-1 w-0 h-0 border-l-[4px] border-l-transparent border-r-[4px] border-r-transparent border-b-[8px] border-b-red-500"></div>
             </div>
         </div>
         <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-900/80 m-6 rounded-full border border-slate-700 backdrop-blur-sm">
            <span className="text-sm font-bold text-white">{Math.round(speed)}</span>
            <span className="text-[9px] text-slate-400">km/h</span>
         </div>
      </div>
      <div className="text-xs text-slate-400 font-medium uppercase tracking-wider">{label}</div>
      <div className="text-xs font-bold text-teal-400 mt-0.5">{dirText} ({degrees}°)</div>
    </div>
  );
};

interface CircularGaugeProps extends BaseWidgetProps {
    value: number; max?: number; label: string; icon: React.ReactNode; 
    color?: string; subText?: string; trend?: string | null; trendLabel?: string | null;
}
export const CircularGauge = ({ value, max = 100, label, icon, color = "text-indigo-500", subText, trend = null, trendLabel = null }: CircularGaugeProps) => {
  const radius = 30;
  const circumference = 2 * Math.PI * radius;
  const normalizedValue = label.includes("Pressió") || label.includes("Pressure") || label.includes("Presión") 
      ? Math.max(0, Math.min((value - 950) / 100, 1)) 
      : Math.min(value, max) / max;
  
  const strokeDashoffset = circumference - normalizedValue * circumference;

  return (
    <div className={`${WIDGET_BASE_STYLE} items-center justify-center`}>
      <div className="relative w-24 h-24 flex items-center justify-center">
         <svg className="w-full h-full transform -rotate-90">
            <circle cx="50%" cy="50%" r={radius} stroke="currentColor" strokeWidth="6" fill="transparent" className="text-slate-800" />
            <circle cx="50%" cy="50%" r={radius} stroke="currentColor" strokeWidth="6" fill="transparent" strokeDasharray={circumference} strokeDashoffset={strokeDashoffset} strokeLinecap="round" className={`${color} transition-all duration-1000 ease-out`} />
         </svg>
         <div className="absolute inset-0 flex flex-col items-center justify-center">
            <div className={`mb-1 ${color}`}>{icon}</div>
            <span className="text-sm font-bold text-white">{value}</span>
         </div>
      </div>
      <div className="text-xs text-slate-400 font-medium uppercase tracking-wider mt-2">{label}</div>
      {subText && <div className="text-[10px] text-slate-500 mt-1">{subText}</div>}
      
      {trend && (
         <div className={`absolute top-2 right-2 flex items-center gap-0.5 text-[10px] font-bold px-1.5 py-0.5 rounded-full border bg-slate-950/50 ${
             trend === 'rising' ? 'text-teal-400 border-teal-500/30' : 
             trend === 'falling' ? 'text-rose-400 border-rose-500/30' : 
             'text-slate-400 border-slate-500/30'
         }`}>
             {trend === 'rising' && <TrendingUp className="w-3 h-3" />}
             {trend === 'falling' && <TrendingDown className="w-3 h-3" />}
             {trend === 'steady' && <Minus className="w-3 h-3" />}
             {trendLabel}
         </div>
      )}
    </div>
  );
};

interface DewPointWidgetProps extends BaseWidgetProps {
    value: number; humidity: number; unit: WeatherUnit;
}
export const DewPointWidget = ({ value, humidity, lang = 'ca', unit }: DewPointWidgetProps) => { 
    const t = TRANSLATIONS[lang] || TRANSLATIONS['ca'];
    
    let status = t.dpComfortable;
    let color = "text-teal-400";
    let bgColor = "bg-teal-500";
    let bgOpacity = "bg-teal-500/10";
    
    const percentage = Math.min(Math.max((value / 28) * 100, 0), 100);

    if (value < 10) {
        status = t.dpDry;
        color = "text-blue-400";
        bgColor = "bg-blue-500";
        bgOpacity = "bg-blue-500/10";
    } else if (value >= 10 && value <= 15) {
        status = t.dpComfortable;
        color = "text-green-400";
        bgColor = "bg-green-500";
        bgOpacity = "bg-green-500/10";
    } else if (value > 15 && value <= 20) {
        status = t.dpHumid;
        color = "text-yellow-400";
        bgColor = "bg-yellow-500";
        bgOpacity = "bg-yellow-500/10";
    } else if (value > 20 && value <= 24) {
        status = t.dpOppressive;
        color = "text-orange-500";
        bgColor = "bg-orange-500";
        bgOpacity = "bg-orange-500/10";
    } else if (value > 24) {
        status = t.dpExtreme;
        color = "text-red-500 animate-pulse";
        bgColor = "bg-red-500";
        bgOpacity = "bg-red-500/10";
    }

    const displayValue = unit === 'F' ? Math.round((value * 9/5) + 32) : Math.round(value);

    return (
        <div className={`${WIDGET_BASE_STYLE} items-center justify-center`}>
            <div className="absolute top-2 left-3 flex items-center gap-1.5">
                <Thermometer className={`w-3.5 h-3.5 ${color}`} strokeWidth={2.5} />
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{t.dewPoint}</span>
            </div>
            
            <div className="flex flex-col items-center mt-3 w-full">
                 <div className="relative mb-2 flex items-baseline gap-2">
                    <div className={`text-3xl font-bold ${color}`}>{displayValue}°</div>
                    <div className="flex items-center gap-0.5 text-slate-400 text-xs font-medium bg-slate-800/50 px-1.5 py-0.5 rounded-md border border-white/5" title={t.humidity}>
                        <Droplets className="w-3 h-3" />
                        <span>{humidity}%</span>
                    </div>
                 </div>
                 
                 <div className="w-full max-w-[80%] h-2 bg-slate-800 rounded-full overflow-hidden relative">
                    <div className={`h-full ${bgColor} transition-all duration-1000`} style={{width: `${percentage}%`}}></div>
                 </div>
                 
                 <div className={`mt-2 px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wider ${color} ${bgOpacity} border border-current border-opacity-20`}>
                    {status}
                 </div>
                 <div className="text-[9px] text-slate-500 mt-1.5 text-center px-2 leading-tight">
                    {t.dewPointDesc}
                 </div>
            </div>
        </div>
    )
};

interface CapeWidgetProps extends BaseWidgetProps {
    cape: number;
}
export const CapeWidget = ({ cape, lang = 'ca' }: CapeWidgetProps) => {
    const t = TRANSLATIONS[lang] || TRANSLATIONS['ca'];
    let status = t.capeStable;
    let color = "text-green-400";
    let bgColor = "bg-green-500";
    let percentage = Math.min((cape / 3000) * 100, 100);

    if (cape > 1000 && cape <= 2500) {
        status = t.capeModerate;
        color = "text-orange-400";
        bgColor = "bg-orange-500";
    } else if (cape > 2500) {
        status = t.capeExtreme;
        color = "text-red-500 animate-pulse";
        bgColor = "bg-red-500";
    }

    return (
        <div className={`${WIDGET_BASE_STYLE} items-center justify-center`}>
            <div className="absolute top-2 left-3 flex items-center gap-1.5">
                <Zap className={`w-3.5 h-3.5 ${color}`} strokeWidth={2.5} />
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{t.stormPotential}</span>
            </div>
            
            <div className="flex flex-col items-center mt-4">
                <span className={`text-2xl font-bold ${color}`}>{Math.round(cape)}</span>
                <span className="text-[9px] text-slate-500 mb-2">J/kg (CAPE)</span>
                
                <div className="w-20 h-1.5 bg-slate-800 rounded-full overflow-hidden">
                    <div className={`h-full ${bgColor} transition-all duration-1000`} style={{width: `${percentage}%`}}></div>
                </div>
                <span className={`text-xs font-bold mt-2 px-2 py-0.5 rounded border border-white/5 bg-white/5 ${color}`}>{status}</span>
            </div>
        </div>
    )
};

interface SnowLevelWidgetProps extends BaseWidgetProps {
    freezingLevel?: number | null; unit: WeatherUnit;
}
export const SnowLevelWidget = ({ freezingLevel, unit, lang = 'ca' }: SnowLevelWidgetProps) => {
  if (freezingLevel === null || freezingLevel === undefined) return null;

  const t = TRANSLATIONS[lang] || TRANSLATIONS['ca'];
  const snowLevel = Math.max(0, freezingLevel - 300);
  const formatH = (val: number) => `${Math.round(val)}m`;
  const maxVisualHeight = 3500;
  const percentage = Math.max(5, Math.min(100, 100 - (snowLevel / maxVisualHeight * 100)));

  let barColor = 'bg-indigo-500'; 
  if (snowLevel < 1000) barColor = 'bg-cyan-300'; 
  else if (snowLevel < 2000) barColor = 'bg-blue-400'; 

  return (
    <div className={`${WIDGET_BASE_STYLE} overflow-hidden`}>
      <div className="flex items-center gap-2 text-indigo-300 mb-2 z-10">
        <Mountain className="w-4 h-4" strokeWidth={2.5} />
        <span className="text-xs font-bold uppercase tracking-wider">{t.snowLevel}</span>
      </div>

      <div className="flex flex-col gap-1 z-10 mt-1">
        <div className="flex justify-between items-end">
             <span className="text-3xl font-bold text-white leading-none">
                {snowLevel > 4000 ? "> 4000m" : formatH(snowLevel)}
             </span>
        </div>
        <span className="text-xs text-slate-400 font-medium flex items-center gap-1">
           {t.freezingLevelAt} <span className="text-slate-200 font-mono bg-white/5 px-1 rounded">{formatH(freezingLevel)}</span>
        </span>
      </div>

      <div className="absolute bottom-0 right-0 w-24 h-24 opacity-20 group-hover:opacity-30 transition-opacity pointer-events-none">
         <svg viewBox="0 0 100 100" className="fill-current text-white">
            <path d="M50 10 L90 90 L10 90 Z" />
            <path d="M50 10 L65 40 L35 40 Z" fill="white" className="opacity-80" />
         </svg>
      </div>
      
      <div className="mt-3 w-full bg-slate-800 rounded-full h-1.5 overflow-hidden flex z-10 relative">
          <div 
            className={`h-full transition-all duration-1000 ${barColor}`} 
            style={{ width: `${percentage}%` }} 
          ></div>
      </div>
      
      <div className="mt-1 text-[9px] text-slate-500 text-right z-10">
         {snowLevel < 1000 ? (lang === 'ca' ? "Cota baixa" : "Low level") : 
          snowLevel > 2500 ? (lang === 'ca' ? "Alta muntanya" : "High mountain") : ""}
      </div>
    </div>
  );
};

interface CloudLayersWidgetProps extends BaseWidgetProps {
    low: number; mid: number; high: number;
}
export const CloudLayersWidget = ({ low, mid, high, lang = 'ca' }: CloudLayersWidgetProps) => {
    const l = Math.round(low || 0);
    const m = Math.round(mid || 0);
    const h = Math.round(high || 0);
    
    // Assegurem que cloudLayers existeix abans d'accedir
    const tr = TRANSLATIONS[lang] || TRANSLATIONS['ca'];
    const t = (tr as any).cloudLayers || (TRANSLATIONS['ca'] as any).cloudLayers;

    return (
        <div className={`${WIDGET_BASE_STYLE}`}>
            <div className="flex items-center gap-2 mb-3">
                <Cloud className="w-5 h-5 text-indigo-300" strokeWidth={2.5} />
                <span className="text-xs font-bold uppercase tracking-wider text-slate-400">{t?.title || "Núvols"}</span>
            </div>
            
            <div className="flex flex-col gap-3 flex-grow justify-center">
                <div className="space-y-1">
                    <div className="flex justify-between text-xs text-indigo-200">
                        <span>{t?.high || "Alts"}</span>
                        <span>{h}%</span>
                    </div>
                    <div className="h-1.5 w-full bg-slate-950/50 rounded-full overflow-hidden">
                        <div className="h-full bg-indigo-300/80 rounded-full transition-all duration-1000" style={{ width: `${h}%` }}></div>
                    </div>
                </div>

                <div className="space-y-1">
                    <div className="flex justify-between text-xs text-indigo-200">
                        <span>{t?.mid || "Mitjans"}</span>
                        <span>{m}%</span>
                    </div>
                    <div className="h-1.5 w-full bg-slate-950/50 rounded-full overflow-hidden">
                        <div className="h-full bg-indigo-400/80 rounded-full transition-all duration-1000" style={{ width: `${m}%` }}></div>
                    </div>
                </div>

                <div className="space-y-1">
                    <div className="flex justify-between text-xs text-indigo-200">
                        <span>{t?.low || "Baixos"}</span>
                        <span>{l}%</span>
                    </div>
                    <div className="h-1.5 w-full bg-slate-950/50 rounded-full overflow-hidden">
                        <div className="h-full bg-indigo-500 rounded-full transition-all duration-1000" style={{ width: `${l}%` }}></div>
                    </div>
                </div>
            </div>
        </div>
    );
};