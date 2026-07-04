// src/components/widgets/ConsensusWidget.tsx
import React from 'react';
import { ConsensusMetrics } from '../../utils/consensusMath';
import { Language } from '../../translations';
import { 
  CheckCircle2, 
  Activity, 
  GitBranch, 
  Thermometer, 
  CloudRain, 
  CloudSnow, 
  Wind,
  ArrowUpRight,
  ArrowDownRight,
  MoveRight,
  Cpu
} from 'lucide-react';

interface ConsensusWidgetProps {
  metrics: ConsensusMetrics;
  aromeTemp: number | undefined;
  aromePrecip: number | undefined;
  aromeWind: number | undefined;
  lang: Language;
}

export const ConsensusWidget: React.FC<ConsensusWidgetProps> = ({
  metrics,
  aromeTemp,
  aromePrecip,
  aromeWind,
  lang
}) => {
  const isCa = lang === 'ca';
  const t = {
    title: isCa ? 'Motor de Consens' : 'Consensus Engine',
    affinity: isCa ? 'Precisió' : 'Accuracy',
    temp: 'TEMP',
    rain: isCa ? 'PLUJA' : 'RAIN',
    snow: 'NEU',
    wind: 'VENT',
    diff: 'Δ',
    status: {
      sync: isCa ? 'Alineat' : 'Aligned',
      discrepancy: isCa ? 'Discrepància' : 'Variance',
      alert: isCa ? 'Divergència' : 'Divergence',
    }
  };

  const isSnowRisk = (aromeTemp !== undefined && aromeTemp <= 2) || 
                     (metrics.wrfTemp !== null && metrics.wrfTemp <= 2);

  const getTheme = (score: number) => {
    if (score >= 75) return { 
      accent: 'text-emerald-400', border: 'border-emerald-500/20', bg: 'bg-emerald-500/10',
      glow: 'from-emerald-500/5', status: t.status.sync, icon: <CheckCircle2 className="w-3.5 h-3.5" />
    };
    if (score >= 55) return { 
      accent: 'text-amber-400', border: 'border-amber-500/20', bg: 'bg-amber-500/10',
      glow: 'from-amber-500/5', status: t.status.discrepancy, icon: <Activity className="w-3.5 h-3.5" />
    };
    return { 
      accent: 'text-rose-400', border: 'border-rose-500/20', bg: 'bg-rose-500/10',
      glow: 'from-rose-500/5', status: t.status.alert, icon: <GitBranch className="w-3.5 h-3.5" />
    };
  };

  const theme = getTheme(metrics.score);
  const radius = 42; 
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (metrics.score / 100) * circumference;

  const renderTrend = (local: number | null | undefined, global: number | null | undefined, type: 'temp' | 'rain' | 'wind') => {
    if (local == null || global == null || local === global) {
      return <MoveRight className="w-3.5 h-3.5 text-slate-600" />;
    }
    const isUp = global > local;
    let iconClass = "w-3.5 h-3.5 ";
    
    if (type === 'temp') iconClass += isUp ? "text-rose-400" : "text-sky-400";
    else if (type === 'rain') iconClass += isUp ? "text-sky-400" : "text-slate-500";
    else iconClass += isUp ? "text-amber-400" : "text-emerald-400";

    return isUp ? <ArrowUpRight className={iconClass} /> : <ArrowDownRight className={iconClass} />;
  };

  const formatVal = (val: number | null | undefined) => val !== null && val !== undefined ? val : '--';
  const formatDelta = (val: number | null | undefined) => val !== null && val !== undefined ? val.toFixed(1) : '--';

  return (
    // CONTENIDOR AMB PERSPECTIVA PER HABILITAR EL 3D
    <div className="w-full relative perspective-[1200px]">
      
      {/* ANIMACIONS INJECTADES (Levitació i Feix de Llum) */}
      <style>
        {`
          @keyframes spatial-float {
            0%, 100% { transform: rotateX(1deg) rotateY(-1deg) translateY(0px); }
            50% { transform: rotateX(-1deg) rotateY(1deg) translateY(-4px); }
          }
          @keyframes shimmer-sweep {
            0% { transform: translateX(-150%) skewX(-15deg); }
            100% { transform: translateX(250%) skewX(-15deg); }
          }
          .animate-spatial {
            animation: spatial-float 8s ease-in-out infinite;
            transform-style: preserve-3d;
          }
          .animate-shimmer::after {
            content: '';
            position: absolute;
            top: 0; right: 0; bottom: 0; left: 0;
            background: linear-gradient(90deg, transparent, rgba(255,255,255,0.03), transparent);
            animation: shimmer-sweep 4s infinite;
            pointer-events: none;
            z-index: 20;
          }
          .pop-out {
            transform: translateZ(20px);
          }
        `}
      </style>

      {/* TARGETA PRINCIPAL ANIMADA EN 3D */}
      <div className={`w-full relative overflow-hidden bg-[#0B0F19] border border-slate-800/60 rounded-[24px] shadow-[0_20px_40px_rgba(0,0,0,0.6)] animate-spatial bg-gradient-to-br ${theme.glow} to-transparent`}>
         
         <div className={`absolute top-0 inset-x-0 h-[2px] bg-gradient-to-r from-transparent via-current to-transparent opacity-50 ${theme.accent}`}></div>

         <div className="p-4 sm:p-6 flex flex-col gap-5 sm:gap-6 relative z-10 pop-out">
            
            {/* CAPÇALERA I INDICADOR GENERAL */}
            <div className="flex justify-between items-center w-full">
               
               <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-slate-800/80 border border-slate-700/50 flex items-center justify-center shadow-inner relative overflow-hidden">
                     <Cpu className="w-4 h-4 text-slate-400 relative z-10" />
                     {/* Fons del microxip que batega */}
                     <div className={`absolute inset-0 opacity-20 ${theme.bg} animate-pulse`}></div>
                  </div>
                  <div>
                     <h2 className="text-[10px] sm:text-xs font-bold text-slate-300 uppercase tracking-widest drop-shadow-md">
                       {t.title}
                     </h2>
                     <div className="flex items-center gap-1.5 mt-0.5">
                        <span className="relative flex h-2 w-2">
                          <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-40 bg-current ${theme.accent}`}></span>
                          <span className={`relative inline-flex rounded-full h-2 w-2 bg-current ${theme.accent}`}></span>
                        </span>
                        <span className={`text-[9px] sm:text-[10px] font-semibold uppercase tracking-wider ${theme.accent} drop-shadow-[0_0_8px_currentColor]`}>
                           {theme.status}
                        </span>
                     </div>
                  </div>
               </div>

               {/* RELLOTGE DE CONSENS 3D */}
               <div className="flex items-center gap-3">
                  <div className="flex flex-col items-end">
                     <span className="text-[10px] sm:text-xs font-bold text-slate-400 uppercase tracking-widest">{t.affinity}</span>
                     <span className="text-xl sm:text-2xl font-black text-white leading-none tracking-tight drop-shadow-lg">
                        {metrics.score}<span className={`text-sm ml-0.5 ${theme.accent}`}>%</span>
                     </span>
                  </div>
                  
                  <div className="relative flex items-center justify-center w-12 h-12 sm:w-14 sm:h-14">
                     {/* Anell giratori exterior (Alta tecnologia) */}
                     <div className="absolute inset-[-4px] border border-slate-700/40 rounded-full border-dashed animate-[spin_15s_linear_infinite]"></div>
                     
                     <svg className="absolute inset-0 w-full h-full transform -rotate-90 drop-shadow-[0_0_6px_rgba(0,0,0,0.5)]" viewBox="0 0 100 100">
                        <circle cx="50" cy="50" r={radius} className="stroke-slate-800" strokeWidth="8" fill="transparent" />
                        <circle
                           cx="50" cy="50" r={radius}
                           className={`${theme.accent} transition-all duration-1000 ease-out`}
                           strokeWidth="8" fill="transparent" strokeLinecap="round"
                           strokeDasharray={circumference} strokeDashoffset={strokeDashoffset}
                           style={{ filter: 'drop-shadow(0 0 4px currentColor)' }}
                        />
                     </svg>
                     <div className="z-10 bg-[#0B0F19] rounded-full p-1 shadow-[inset_0_0_10px_rgba(0,0,0,1)]">
                        {React.cloneElement(theme.icon as React.ReactElement<{ className: string }>, { className: `w-3.5 h-3.5 ${theme.accent}` })}
                     </div>
                  </div>
               </div>
            </div>

            {/* GRAELLA DE DADES AMB SHIMMER I POP-OUT */}
            <div className="grid grid-cols-3 gap-2 sm:gap-4 w-full">

               {/* TARGETA TEMPERATURA */}
               <div className="relative overflow-hidden bg-slate-900/40 backdrop-blur-sm hover:bg-slate-800/60 transition-colors duration-300 rounded-[16px] sm:rounded-2xl p-2.5 sm:p-4 border border-slate-700/30 flex flex-col items-center justify-between shadow-lg animate-shimmer">
                  <div className="flex items-center gap-1 sm:gap-1.5 text-slate-400 mb-2 relative z-10">
                     <Thermometer className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                     <span className="text-[9px] sm:text-[10px] font-bold tracking-widest">{t.temp}</span>
                  </div>
                  
                  <div className="flex flex-col items-center mb-3 relative z-10">
                     <div className="text-lg sm:text-2xl font-black text-white leading-none tracking-tight drop-shadow-md">
                        {formatVal(aromeTemp)}<span className="text-[10px] sm:text-xs text-slate-500 font-bold ml-0.5">°</span>
                     </div>
                     <div className="text-[9px] sm:text-[10px] font-medium text-slate-500 mt-1">
                        WRF <span className="text-slate-300 font-bold">{formatVal(metrics.wrfTemp)}°</span>
                     </div>
                  </div>

                  <div className="w-full bg-[#050810]/80 rounded-lg py-1.5 flex justify-center items-center gap-1.5 border border-slate-800/80 shadow-[inset_0_2px_4px_rgba(0,0,0,0.5)] relative z-10">
                     <span className="text-[9px] text-slate-500 font-bold">{t.diff}</span>
                     <div className="flex items-center gap-0.5 text-[10px] sm:text-[11px] font-black text-slate-200">
                        {formatDelta(metrics.tempDiff)}° {renderTrend(aromeTemp, metrics.wrfTemp, 'temp')}
                     </div>
                  </div>
               </div>

               {/* TARGETA PLUJA / NEU */}
               <div className={`relative overflow-hidden bg-slate-900/40 backdrop-blur-sm hover:bg-slate-800/60 transition-colors duration-300 rounded-[16px] sm:rounded-2xl p-2.5 sm:p-4 border flex flex-col items-center justify-between shadow-lg animate-shimmer ${isSnowRisk ? 'border-sky-900/50 bg-sky-950/20' : 'border-slate-700/30'}`} style={{ animationDelay: '0.2s' }}>
                  <div className={`flex items-center gap-1 sm:gap-1.5 mb-2 relative z-10 ${isSnowRisk ? 'text-sky-400 drop-shadow-[0_0_5px_currentColor]' : 'text-slate-400'}`}>
                     {isSnowRisk ? <CloudSnow className="w-3.5 h-3.5 sm:w-4 sm:h-4 animate-pulse" /> : <CloudRain className="w-3.5 h-3.5 sm:w-4 sm:h-4" />}
                     <span className="text-[9px] sm:text-[10px] font-bold tracking-widest">{isSnowRisk ? t.snow : t.rain}</span>
                  </div>
                  
                  <div className="flex flex-col items-center mb-3 relative z-10">
                     <div className="flex items-baseline leading-none tracking-tight drop-shadow-md">
                        <span className="text-lg sm:text-2xl font-black text-white">{formatVal(aromePrecip)}</span>
                        <span className="text-[8px] sm:text-[9px] text-slate-500 font-bold ml-0.5">mm</span>
                     </div>
                     <div className="text-[9px] sm:text-[10px] font-medium text-slate-500 mt-1 flex items-baseline gap-1">
                        WRF <span className="text-slate-300 font-bold">{formatVal(metrics.wrfPrecip)}<span className="text-[7px] font-normal text-slate-500 ml-[1px]">mm</span></span>
                     </div>
                  </div>

                  <div className="w-full bg-[#050810]/80 rounded-lg py-1.5 flex justify-center items-center gap-1.5 border border-slate-800/80 shadow-[inset_0_2px_4px_rgba(0,0,0,0.5)] relative z-10">
                     <span className="text-[9px] text-slate-500 font-bold">{t.diff}</span>
                     <div className="flex items-center gap-0.5 text-[10px] sm:text-[11px] font-black text-slate-200">
                        {formatDelta(metrics.precipDiff)} {renderTrend(aromePrecip, metrics.wrfPrecip, 'rain')}
                     </div>
                  </div>
               </div>

               {/* TARGETA VENT */}
               <div className="relative overflow-hidden bg-slate-900/40 backdrop-blur-sm hover:bg-slate-800/60 transition-colors duration-300 rounded-[16px] sm:rounded-2xl p-2.5 sm:p-4 border border-slate-700/30 flex flex-col items-center justify-between shadow-lg animate-shimmer" style={{ animationDelay: '0.4s' }}>
                  <div className="flex items-center gap-1 sm:gap-1.5 text-slate-400 mb-2 relative z-10">
                     <Wind className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                     <span className="text-[9px] sm:text-[10px] font-bold tracking-widest">{t.wind}</span>
                  </div>
                  
                  <div className="flex flex-col items-center mb-3 relative z-10">
                     <div className="flex items-baseline leading-none tracking-tight drop-shadow-md">
                        <span className="text-lg sm:text-2xl font-black text-white">{formatVal(aromeWind)}</span>
                        <span className="text-[8px] sm:text-[9px] text-slate-500 font-bold ml-0.5">km/h</span>
                     </div>
                     <div className="text-[9px] sm:text-[10px] font-medium text-slate-500 mt-1 flex items-baseline gap-1">
                        WRF <span className="text-slate-300 font-bold">{formatVal(metrics.wrfWind)}<span className="text-[7px] font-normal text-slate-500 ml-[1px]">km</span></span>
                     </div>
                  </div>

                  <div className="w-full bg-[#050810]/80 rounded-lg py-1.5 flex justify-center items-center gap-1.5 border border-slate-800/80 shadow-[inset_0_2px_4px_rgba(0,0,0,0.5)] relative z-10">
                     <span className="text-[9px] text-slate-500 font-bold">{t.diff}</span>
                     <div className="flex items-center gap-0.5 text-[10px] sm:text-[11px] font-black text-slate-200">
                        {formatDelta(metrics.windDiff)} {renderTrend(aromeWind, metrics.wrfWind, 'wind')}
                     </div>
                  </div>
               </div>

            </div>
         </div>
      </div>
    </div>
  );
};