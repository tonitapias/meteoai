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
  MoveRight
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
  // 1. DICCIONARI D'IDIOMES
  const isCa = lang === 'ca';
  const t = {
    title: isCa ? 'Consens de Models' : 'Models Consensus',
    affinity: isCa ? 'Afinitat' : 'Affinity',
    temp: isCa ? 'Temp' : 'Temp',
    rain: isCa ? 'Pluja' : 'Rain',
    snow: isCa ? 'Neu' : 'Snow',
    wind: isCa ? 'Vent' : 'Wind',
    diff: isCa ? 'Dif.' : 'Diff.',
    status: {
      sync: isCa ? 'Sincronitzat' : 'Synchronized',
      discrepancy: isCa ? 'Discrepància' : 'Discrepancy',
      alert: isCa ? 'Alerta Models' : 'Models Alert',
    }
  };

  // 2. ACTIVADOR TÈRMIC DE NEU
  const isSnowRisk = (aromeTemp !== undefined && aromeTemp <= 2) || 
                     (metrics.wrfTemp !== null && metrics.wrfTemp <= 2);

  // 3. PALETA NEON-GLASS
  const getTheme = (score: number) => {
    if (score >= 75) return { 
      text: 'text-emerald-400', stroke: 'stroke-emerald-400', 
      glow: 'bg-emerald-500/20'
    };
    if (score >= 55) return { 
      text: 'text-sky-400', stroke: 'stroke-sky-400', 
      glow: 'bg-sky-500/20'
    };
    return { 
      text: 'text-rose-400', stroke: 'stroke-rose-400', 
      glow: 'bg-rose-500/20'
    };
  };

  const theme = getTheme(metrics.score);

  // 4. MATEMÀTICA DE L'ANELL
  const radius = 50; 
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (metrics.score / 100) * circumference;

  // 5. RENDER DE TENDÈNCIES
  const renderTrend = (trend: 'up' | 'down' | 'flat') => {
    if (trend === 'flat') return <MoveRight className="w-4 h-4 text-slate-500" />;
    return trend === 'up' 
      ? <ArrowUpRight className="w-4 h-4 text-rose-400" />
      : <ArrowDownRight className="w-4 h-4 text-sky-400" />;
  };

  const getStatus = (score: number) => {
    if (score >= 75) return { label: t.status.sync, icon: <CheckCircle2 className="w-4 h-4" /> };
    if (score >= 55) return { label: t.status.discrepancy, icon: <Activity className="w-4 h-4" /> };
    return { label: t.status.alert, icon: <GitBranch className="w-4 h-4" /> };
  };

  const status = getStatus(metrics.score);

  const formatVal = (val: number | null | undefined) => val !== null && val !== undefined ? val : '--';
  const formatDelta = (val: number | null | undefined) => val !== null && val !== undefined ? val.toFixed(1) : '--';

  return (
    // CONTENIDOR PRINCIPAL (Glassmorphism Pur)
    <div className="w-full relative overflow-hidden bg-slate-950/40 backdrop-blur-2xl border border-white/10 rounded-[28px] p-5 sm:p-7 shadow-[0_8px_32px_rgba(0,0,0,0.5)]">
       
       {/* LLUM LÍQUIDA SURREALISTA (Fons animat) */}
       <style>
         {`
           @keyframes blob {
             0% { transform: translate(0px, 0px) scale(1); }
             33% { transform: translate(30px, -50px) scale(1.1); }
             66% { transform: translate(-20px, 20px) scale(0.9); }
             100% { transform: translate(0px, 0px) scale(1); }
           }
           .animate-blob { animation: blob 10s infinite alternate; }
         `}
       </style>
       <div className={`absolute -top-10 -left-10 w-64 h-64 rounded-full mix-blend-screen filter blur-[80px] opacity-60 animate-blob pointer-events-none z-0 ${theme.glow}`}></div>
       <div className={`absolute -bottom-10 -right-10 w-64 h-64 rounded-full mix-blend-screen filter blur-[80px] opacity-40 animate-blob pointer-events-none z-0 ${theme.glow}`} style={{ animationDelay: '2s' }}></div>

       {/* CAPÇALERA (Flotant) */}
       <div className="flex justify-between items-center w-full mb-6 relative z-10">
         <h2 className="text-xs sm:text-sm font-black text-white/90 uppercase tracking-[0.2em] drop-shadow-md">
           {t.title}
         </h2>
         <div className="inline-flex items-center gap-2 text-[10px] font-black uppercase px-3 py-1.5 rounded-full border border-white/10 bg-black/20 text-white/90 tracking-widest backdrop-blur-md shadow-[inset_0_1px_0_0_rgba(255,255,255,0.1)]">
           {React.cloneElement(status.icon as React.ReactElement<{ className: string }>, { className: `w-3.5 h-3.5 ${theme.text}` })}
           {status.label}
         </div>
       </div>

       {/* GRAELLA PRINCIPAL (Bento Layout) */}
       <div className="flex flex-col sm:flex-row items-center gap-6 sm:gap-8 w-full relative z-10">

          {/* L'ANELL NEON (Alta definició) */}
          <div className="relative flex items-center justify-center shrink-0 w-32 h-32 drop-shadow-[0_0_15px_rgba(0,0,0,0.5)]">
             <svg className="absolute inset-0 w-full h-full transform -rotate-90">
                <circle cx="64" cy="64" r={radius} className="stroke-black/40" strokeWidth="6" fill="transparent" />
                <circle cx="64" cy="64" r={radius} className="stroke-white/5" strokeWidth="6" fill="transparent" />
                <circle
                   cx="64" cy="64" r={radius}
                   className={`${theme.stroke} transition-all duration-1000 ease-out`}
                   strokeWidth="6" fill="transparent"
                   strokeDasharray={circumference} strokeDashoffset={strokeDashoffset} strokeLinecap="round"
                   style={{ filter: 'drop-shadow(0 0 4px currentColor)' }}
                />
             </svg>
             <div className="flex flex-col items-center justify-center">
                <div className="flex items-start">
                   <span className="text-4xl font-black leading-none tracking-tighter text-white drop-shadow-lg">
                      {metrics.score}
                   </span>
                   <span className={`text-lg font-bold leading-none ml-0.5 ${theme.text}`}>%</span>
                </div>
                <span className="text-[9px] text-white/50 uppercase tracking-[0.2em] font-bold mt-1.5">
                   {t.affinity}
                </span>
             </div>
          </div>

          {/* TARGETES DE DADES (Cristall Bento) */}
          <div className="flex-1 grid grid-cols-3 gap-3 w-full">

             {/* TARGETA TEMPERATURA */}
             <div className="bg-white/[0.03] backdrop-blur-xl rounded-2xl p-3 border border-white/10 flex flex-col shadow-[inset_0_1px_0_0_rgba(255,255,255,0.05)] transition-transform hover:-translate-y-1 hover:bg-white/[0.05] duration-300">
                <div className="flex justify-center items-center gap-1.5 text-white/70 text-xs font-bold mb-3">
                   <Thermometer className="w-3.5 h-3.5" /> {t.temp}
                </div>
                
                <div className="flex flex-col gap-1 mb-3">
                   <div className="flex justify-between items-baseline">
                      <span className="text-[9px] text-white/40 font-semibold uppercase tracking-wider">Local</span>
                      <span className="text-sm font-black text-white">{formatVal(aromeTemp)}°</span>
                   </div>
                   <div className="flex justify-between items-baseline">
                      <span className="text-[9px] text-white/40 font-semibold uppercase tracking-wider">Global</span>
                      <span className="text-sm font-bold text-white/60">{formatVal(metrics.wrfTemp)}°</span>
                   </div>
                </div>

                <div className="mt-auto bg-black/30 rounded-xl p-2 flex justify-between items-center border border-white/5">
                   <span className="text-[9px] font-bold text-white/40">{t.diff}</span>
                   <div className="flex items-center gap-1 text-xs font-black text-white">
                      {formatDelta(metrics.tempDiff)}° {renderTrend(metrics.tempTrend)}
                   </div>
                </div>
             </div>

             {/* TARGETA PLUJA / NEU */}
             <div className={`bg-white/[0.03] backdrop-blur-xl rounded-2xl p-3 border flex flex-col shadow-[inset_0_1px_0_0_rgba(255,255,255,0.05)] transition-transform hover:-translate-y-1 duration-300 ${isSnowRisk ? 'border-sky-400/30 bg-sky-950/20' : 'border-white/10 hover:bg-white/[0.05]'}`}>
                <div className={`flex justify-center items-center gap-1.5 text-xs font-bold mb-3 ${isSnowRisk ? 'text-sky-300' : 'text-white/70'}`}>
                   {isSnowRisk ? <CloudSnow className="w-3.5 h-3.5 animate-pulse" /> : <CloudRain className="w-3.5 h-3.5" />}
                   {isSnowRisk ? t.snow : t.rain}
                </div>
                
                <div className="flex flex-col gap-1 mb-3">
                   <div className="flex justify-between items-baseline">
                      <span className="text-[9px] text-white/40 font-semibold uppercase tracking-wider">Local</span>
                      <span className="text-sm font-black text-white">{formatVal(aromePrecip)}<span className="text-[9px] font-normal ml-0.5 text-white/50">mm</span></span>
                   </div>
                   <div className="flex justify-between items-baseline">
                      <span className="text-[9px] text-white/40 font-semibold uppercase tracking-wider">Global</span>
                      <span className="text-sm font-bold text-white/60">{formatVal(metrics.wrfPrecip)}<span className="text-[9px] font-normal ml-0.5 text-white/40">mm</span></span>
                   </div>
                </div>

                <div className="mt-auto bg-black/30 rounded-xl p-2 flex justify-between items-center border border-white/5">
                   <span className="text-[9px] font-bold text-white/40">{t.diff}</span>
                   <div className="flex items-center gap-1 text-xs font-black text-white">
                      {formatDelta(metrics.precipDiff)} {renderTrend(metrics.precipTrend)}
                   </div>
                </div>
             </div>

             {/* TARGETA VENT */}
             <div className="bg-white/[0.03] backdrop-blur-xl rounded-2xl p-3 border border-white/10 flex flex-col shadow-[inset_0_1px_0_0_rgba(255,255,255,0.05)] transition-transform hover:-translate-y-1 hover:bg-white/[0.05] duration-300">
                <div className="flex justify-center items-center gap-1.5 text-white/70 text-xs font-bold mb-3">
                   <Wind className="w-3.5 h-3.5" /> {t.wind}
                </div>
                
                <div className="flex flex-col gap-1 mb-3">
                   <div className="flex justify-between items-baseline">
                      <span className="text-[9px] text-white/40 font-semibold uppercase tracking-wider">Local</span>
                      <span className="text-sm font-black text-white">{formatVal(aromeWind)}<span className="text-[9px] font-normal ml-0.5 text-white/50">km/h</span></span>
                   </div>
                   <div className="flex justify-between items-baseline">
                      <span className="text-[9px] text-white/40 font-semibold uppercase tracking-wider">Global</span>
                      <span className="text-sm font-bold text-white/60">{formatVal(metrics.wrfWind)}<span className="text-[9px] font-normal ml-0.5 text-white/40">km/h</span></span>
                   </div>
                </div>

                <div className="mt-auto bg-black/30 rounded-xl p-2 flex justify-between items-center border border-white/5">
                   <span className="text-[9px] font-bold text-white/40">{t.diff}</span>
                   <div className="flex items-center gap-1 text-xs font-black text-white">
                      {formatDelta(metrics.windDiff)} {renderTrend(metrics.windTrend)}
                   </div>
                </div>
             </div>

          </div>
       </div>
    </div>
  );
};