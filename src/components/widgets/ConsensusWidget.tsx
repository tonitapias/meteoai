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
  CloudSnow, // AFEGIT: Icona de neu
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
    snow: isCa ? 'Neu' : 'Snow', // AFEGIT: Diccionari de neu
    wind: isCa ? 'Vent' : 'Wind',
    diff: isCa ? 'Dif.' : 'Diff.',
    status: {
      sync: isCa ? 'Sincronitzat' : 'Synchronized',
      discrepancy: isCa ? 'Discrepància' : 'Discrepancy',
      alert: isCa ? 'Alerta Models' : 'Models Alert',
    }
  };

  // 2. ACTIVADOR TÈRMIC DE NEU (Risc Zero)
  // Si qualsevol dels dos models preveu 2 graus o menys, activem el mode hivernal
  const isSnowRisk = (aromeTemp !== undefined && aromeTemp <= 2) || 
                     (metrics.wrfTemp !== null && metrics.wrfTemp <= 2);

  // 3. PALETA CLARA I D'ALT CONTRAST
  const getTheme = (score: number) => {
    if (score >= 75) return { 
      text: 'text-emerald-400', stroke: 'stroke-emerald-400', 
      bg: 'bg-emerald-950/40', border: 'border-emerald-800/50'
    };
    if (score >= 55) return { 
      text: 'text-sky-400', stroke: 'stroke-sky-400', 
      bg: 'bg-sky-950/40', border: 'border-sky-800/50'
    };
    return { 
      text: 'text-rose-400', stroke: 'stroke-rose-400', 
      bg: 'bg-rose-950/40', border: 'border-rose-800/50'
    };
  };

  const theme = getTheme(metrics.score);

  // 4. MATEMÀTICA DE L'ANELL
  const radius = 54; 
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
    <div className="w-full bg-slate-900 border border-slate-700 rounded-[20px] p-4 sm:p-6 shadow-xl">
       
       {/* CAPÇALERA */}
       <div className="flex justify-between items-center w-full mb-5">
         <h2 className="text-xs sm:text-sm font-bold text-slate-300 uppercase tracking-wider">
           {t.title}
         </h2>
         <div className={`flex items-center gap-1.5 text-xs font-bold uppercase px-3 py-1.5 rounded-lg border ${theme.bg} ${theme.border} ${theme.text}`}>
           {status.icon}
           {status.label}
         </div>
       </div>

       {/* GRAELLA PRINCIPAL */}
       <div className="flex flex-col sm:flex-row items-center gap-6 w-full">

          {/* L'ANELL */}
          <div className="relative flex items-center justify-center shrink-0 w-32 h-32">
             <svg className="absolute inset-0 w-full h-full transform -rotate-90">
                <circle cx="64" cy="64" r={radius} className="stroke-slate-800" strokeWidth="6" fill="transparent" />
                <circle
                   cx="64" cy="64" r={radius}
                   className={`${theme.stroke} transition-all duration-1000 ease-out`}
                   strokeWidth="6" fill="transparent"
                   strokeDasharray={circumference} strokeDashoffset={strokeDashoffset} strokeLinecap="round"
                />
             </svg>
             <div className="flex flex-col items-center justify-center relative z-10 mt-0.5">
                <div className="flex items-start">
                   <span className={`text-4xl font-black leading-none tracking-tight ${theme.text}`}>
                      {metrics.score}
                   </span>
                   <span className={`text-lg font-bold leading-none ml-0.5 opacity-80 ${theme.text}`}>%</span>
                </div>
                <span className="text-[10px] text-slate-400 uppercase tracking-wider font-bold mt-1">
                   {t.affinity}
                </span>
             </div>
          </div>

          {/* TARGETES DE DADES */}
          <div className="flex-1 grid grid-cols-3 gap-2 sm:gap-3 w-full">

             {/* TARGETA TEMPERATURA */}
             <div className="bg-slate-800/80 rounded-xl p-2.5 sm:p-3 border border-slate-700/50 flex flex-col">
                <div className="flex justify-center items-center gap-1.5 text-slate-300 text-xs sm:text-sm font-bold mb-3">
                   <Thermometer className="w-4 h-4" /> {t.temp}
                </div>
                
                <div className="flex flex-col gap-1.5 mb-3">
                   <div className="flex justify-between items-center">
                      <span className="text-[10px] sm:text-xs text-slate-400 font-semibold uppercase">Local</span>
                      <span className="text-sm sm:text-base font-bold text-white">{formatVal(aromeTemp)}°</span>
                   </div>
                   <div className="flex justify-between items-center">
                      <span className="text-[10px] sm:text-xs text-slate-400 font-semibold uppercase">Global</span>
                      <span className="text-sm sm:text-base font-bold text-slate-300">{formatVal(metrics.wrfTemp)}°</span>
                   </div>
                </div>

                <div className="mt-auto bg-slate-900/60 rounded-lg p-1.5 sm:p-2 flex justify-between items-center border border-slate-700/50">
                   <span className="text-[10px] sm:text-xs font-bold text-slate-500">{t.diff}</span>
                   <div className="flex items-center gap-1 text-xs sm:text-sm font-black text-white">
                      {formatDelta(metrics.tempDiff)}° {renderTrend(metrics.tempTrend)}
                   </div>
                </div>
             </div>

             {/* TARGETA PLUJA / NEU DINÀMICA */}
             <div className={`bg-slate-800/80 rounded-xl p-2.5 sm:p-3 border flex flex-col ${isSnowRisk ? 'border-sky-800/50 shadow-[0_0_15px_rgba(14,165,233,0.1)]' : 'border-slate-700/50'}`}>
                <div className={`flex justify-center items-center gap-1.5 text-xs sm:text-sm font-bold mb-3 ${isSnowRisk ? 'text-sky-300' : 'text-slate-300'}`}>
                   {isSnowRisk ? <CloudSnow className="w-4 h-4" /> : <CloudRain className="w-4 h-4" />}
                   {isSnowRisk ? t.snow : t.rain}
                </div>
                
                <div className="flex flex-col gap-1.5 mb-3">
                   <div className="flex justify-between items-center">
                      <span className="text-[10px] sm:text-xs text-slate-400 font-semibold uppercase">Local</span>
                      <span className="text-sm sm:text-base font-bold text-white">{formatVal(aromePrecip)}<span className="text-[10px] font-normal ml-0.5">mm</span></span>
                   </div>
                   <div className="flex justify-between items-center">
                      <span className="text-[10px] sm:text-xs text-slate-400 font-semibold uppercase">Global</span>
                      <span className="text-sm sm:text-base font-bold text-slate-300">{formatVal(metrics.wrfPrecip)}<span className="text-[10px] font-normal ml-0.5">mm</span></span>
                   </div>
                </div>

                <div className="mt-auto bg-slate-900/60 rounded-lg p-1.5 sm:p-2 flex justify-between items-center border border-slate-700/50">
                   <span className="text-[10px] sm:text-xs font-bold text-slate-500">{t.diff}</span>
                   <div className="flex items-center gap-1 text-xs sm:text-sm font-black text-white">
                      {formatDelta(metrics.precipDiff)} {renderTrend(metrics.precipTrend)}
                   </div>
                </div>
             </div>

             {/* TARGETA VENT */}
             <div className="bg-slate-800/80 rounded-xl p-2.5 sm:p-3 border border-slate-700/50 flex flex-col">
                <div className="flex justify-center items-center gap-1.5 text-slate-300 text-xs sm:text-sm font-bold mb-3">
                   <Wind className="w-4 h-4" /> {t.wind}
                </div>
                
                <div className="flex flex-col gap-1.5 mb-3">
                   <div className="flex justify-between items-center">
                      <span className="text-[10px] sm:text-xs text-slate-400 font-semibold uppercase">Local</span>
                      <span className="text-sm sm:text-base font-bold text-white">{formatVal(aromeWind)}<span className="text-[10px] font-normal ml-0.5">km/h</span></span>
                   </div>
                   <div className="flex justify-between items-center">
                      <span className="text-[10px] sm:text-xs text-slate-400 font-semibold uppercase">Global</span>
                      <span className="text-sm sm:text-base font-bold text-slate-300">{formatVal(metrics.wrfWind)}<span className="text-[10px] font-normal ml-0.5">km/h</span></span>
                   </div>
                </div>

                <div className="mt-auto bg-slate-900/60 rounded-lg p-1.5 sm:p-2 flex justify-between items-center border border-slate-700/50">
                   <span className="text-[10px] sm:text-xs font-bold text-slate-500">{t.diff}</span>
                   <div className="flex items-center gap-1 text-xs sm:text-sm font-black text-white">
                      {formatDelta(metrics.windDiff)} {renderTrend(metrics.windTrend)}
                   </div>
                </div>
             </div>

          </div>
       </div>
    </div>
  );
};