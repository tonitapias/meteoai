// src/components/widgets/ConsensusWidget.tsx
import React, { useState, useEffect } from 'react';
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
  Cpu,
  X
} from 'lucide-react';

interface ConsensusWidgetProps {
  metrics: ConsensusMetrics;
  aromeTemp: number | undefined;
  aromePrecip: number | undefined;
  aromeWind: number | undefined;
  lang: Language;
  utcOffset?: number; 
  hourlyTimes?: string[];
  hourlyGlobalTimes?: string[];
  hourlyLocal?: { temp?: (number | null)[]; rain?: (number | null)[]; wind?: (number | null)[] };
  hourlyGlobal?: { temp?: (number | null)[]; rain?: (number | null)[]; wind?: (number | null)[] };
}

type ModalType = 'temp' | 'rain' | 'wind'; 

export const ConsensusWidget: React.FC<ConsensusWidgetProps> = ({
  metrics, aromeTemp, aromePrecip, aromeWind, lang,
  utcOffset = 0,
  hourlyTimes = [], hourlyGlobalTimes = [], hourlyLocal = {}, hourlyGlobal = {}
}) => {
  const [activeModal, setActiveModal] = useState<ModalType | null>(null);
  // 2. SOLUCIÓ ESLINT: Estat pur per capturar l'hora sense trencar el renderitzat
  const [nowTimestamp, setNowTimestamp] = useState(() => Date.now());
  
  const isCa = lang === 'ca';
  
  const t = {
    title: isCa ? 'Motor de Consens' : 'Consensus Engine',
    affinity: isCa ? 'Precisió' : 'Accuracy',
    temp: 'TEMP', rain: isCa ? 'PLUJA' : 'RAIN', snow: 'NEU', wind: 'VENT', diff: 'Δ',
    status: { sync: isCa ? 'Alineat' : 'Aligned', discrepancy: isCa ? 'Discrepància' : 'Variance', alert: isCa ? 'Divergència' : 'Divergence' },
    modalTitle: isCa ? 'Telemetria Horària' : 'Hourly Telemetry',
    local: 'LOC', global: 'GLO', now: isCa ? 'ARA' : 'NOW'
  };

  const isSnowRisk = (aromeTemp !== undefined && aromeTemp <= 2) || (metrics.wrfTemp !== null && metrics.wrfTemp <= 2);

  const getTheme = (score: number) => {
    if (score >= 75) return { accent: 'text-emerald-400', border: 'border-emerald-500/30', bg: 'bg-emerald-500/10', glow: 'from-emerald-900/30', shadow: 'shadow-[0_20px_50px_rgba(16,185,129,0.3)]', status: t.status.sync, icon: <CheckCircle2 className="w-5 h-5 md:w-6 md:h-6" /> };
    if (score >= 55) return { accent: 'text-amber-400', border: 'border-amber-500/30', bg: 'bg-amber-500/10', glow: 'from-amber-900/30', shadow: 'shadow-[0_20px_50px_rgba(245,158,11,0.3)]', status: t.status.discrepancy, icon: <Activity className="w-5 h-5 md:w-6 md:h-6" /> };
    return { accent: 'text-rose-400', border: 'border-rose-500/30', bg: 'bg-rose-500/10', glow: 'from-rose-900/30', shadow: 'shadow-[0_20px_50px_rgba(225,29,72,0.3)]', status: t.status.alert, icon: <GitBranch className="w-5 h-5 md:w-6 md:h-6" /> };
  };

  const theme = getTheme(metrics.score);
  const radius = 42; 
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (metrics.score / 100) * circumference;

  const renderTrend = (local: number | null | undefined, global: number | null | undefined, type: 'temp' | 'rain' | 'wind') => {
    if (local == null || global == null || local === global) return <MoveRight className="w-3.5 h-3.5 md:w-4 md:h-4 text-slate-600" />;
    const isUp = global > local;
    let iconClass = "w-3.5 h-3.5 md:w-4 md:h-4 transition-transform duration-300 ";
    if (type === 'temp') iconClass += isUp ? "text-rose-400" : "text-sky-400";
    else if (type === 'rain') iconClass += isUp ? "text-sky-400" : "text-slate-500";
    else iconClass += isUp ? "text-amber-400" : "text-emerald-400";
    return isUp ? <ArrowUpRight className={iconClass} /> : <ArrowDownRight className={iconClass} />;
  };

  const formatVal = (val: number | null | undefined) => val !== null && val !== undefined ? val : '--';
  const formatDelta = (val: number | null | undefined) => val !== null && val !== undefined ? val.toFixed(1) : '--';

  const getAbsoluteEpoch = (timeStr: string) => {
    if (!timeStr) return NaN;
    if (timeStr.includes('Z') || timeStr.match(/[+-]\d{2}:?\d{2}$/)) {
        return new Date(timeStr).getTime();
    }
    const utcEpoch = new Date(timeStr + 'Z').getTime();
    return utcEpoch - (utcOffset * 1000);
  };
  
  const formatTimeSafely = (timeStr: string) => {
    try {
      const parts = timeStr.split('T');
      if (parts.length === 2 && !timeStr.includes('Z')) {
          return parts[1].substring(0, 5);
      }
      const d = new Date(timeStr);
      if (isNaN(d.getTime())) return '--:--';
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch {
      return '--:--';
    }
  };

  const openModal = (type: ModalType) => {
    // Sincronitzem l'hora en el moment exacte del clic en lloc d'impurificar el render
    setNowTimestamp(Date.now()); 
    window.history.pushState({ modalOpen: 'consensus' }, '');
    setActiveModal(type);
  };

  const closeModal = () => {
    setActiveModal(null);
    if (window.history.state?.modalOpen === 'consensus') window.history.back();
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => { if (e.key === 'Escape' && activeModal) closeModal(); };
    const handlePopState = () => { if (activeModal) setActiveModal(null); };
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('popstate', handlePopState);
    return () => { window.removeEventListener('keydown', handleKeyDown); window.removeEventListener('popstate', handlePopState); };
  }, [activeModal]);

  const renderModalContent = () => {
    if (!activeModal || hourlyTimes.length === 0) return <div className="text-slate-500 text-center py-10 font-mono text-xs">Sincronitzant matrius horàries...</div>;
    
    const locArr = hourlyLocal[activeModal] || [];
    const rawGloArr = hourlyGlobal[activeModal] || [];
    const unit = activeModal === 'temp' ? '°' : activeModal === 'rain' ? ' mm' : ' km/h';
    
    const globalDict = new Map<number, number | null>();
    rawGloArr.forEach((val, idx) => {
       const timeStr = hourlyGlobalTimes[idx];
       const epoch = getAbsoluteEpoch(timeStr);
       if (!isNaN(epoch)) {
           globalDict.set(epoch, val);
       }
    });
    
    let startIndex = hourlyTimes.findIndex(t => {
       const epoch = getAbsoluteEpoch(t);
       return !isNaN(epoch) && epoch >= nowTimestamp - (60 * 60 * 1000); 
    });
    
    if (startIndex === -1) startIndex = 0;
    const displayTimes = hourlyTimes.slice(startIndex, startIndex + 24);

    let minVal = Infinity;
    let maxVal = -Infinity;
    let hasValidData = false;

    for (let i = 0; i < displayTimes.length; i++) {
      const realIndex = startIndex + i;
      const tKeyStr = hourlyTimes[realIndex];
      const epochKey = getAbsoluteEpoch(tKeyStr);
      
      const l = locArr[realIndex];
      const g = !isNaN(epochKey) ? (globalDict.get(epochKey) ?? null) : null;

      if (l != null) { if(l < minVal) minVal = l; if(l > maxVal) maxVal = l; hasValidData = true; }
      if (g != null) { if(g < minVal) minVal = g; if(g > maxVal) maxVal = g; hasValidData = true; }
    }
    
    if (!hasValidData) {
      minVal = 0;
      maxVal = 1;
    } else {
      if (activeModal === 'rain' || activeModal === 'wind') {
         minVal = 0; 
         if (maxVal === 0) maxVal = 1; 
      } else {
         if (maxVal === minVal) maxVal = minVal + 1; 
      }
    }

    const barColor = activeModal === 'temp' 
      ? 'from-rose-500/20 to-rose-400/5' 
      : activeModal === 'rain' 
        ? 'from-sky-500/20 to-sky-400/5' 
        : 'from-amber-500/20 to-amber-400/5';

    return (
      <div className="flex flex-col gap-2 md:gap-3 max-h-[65vh] md:max-h-[70vh] overflow-y-auto pr-2 custom-scrollbar">
        {displayTimes.map((timeKey, i) => {
          const realIndex = startIndex + i;
          const locVal = locArr[realIndex];
          const epochKey = getAbsoluteEpoch(timeKey);
          const gloVal = !isNaN(epochKey) ? (globalDict.get(epochKey) ?? null) : null;
          const diff = locVal != null && gloVal != null ? (gloVal - locVal).toFixed(1) : '--';
          const isNow = i === 0;

          const refVal = locVal ?? gloVal;
          let widthPct = 0;
          if (refVal != null && maxVal > minVal) {
              widthPct = ((refVal - minVal) / (maxVal - minVal)) * 100;
              widthPct = Math.max(0, Math.min(100, widthPct)); 
          }

          return (
            <div key={i} className={`relative flex items-center justify-between bg-[#050810] border ${isNow ? 'border-sky-500/40 shadow-[inset_0_0_15px_rgba(14,165,233,0.15)]' : 'border-slate-800/50 md:hover:border-slate-600/50 md:hover:bg-slate-800/40'} rounded-xl p-3 md:p-4 transition-all duration-300 overflow-hidden group`}>
              
              <div 
                 className={`absolute left-0 top-0 bottom-0 bg-gradient-to-r ${barColor} transition-all duration-1000 ease-out z-0`}
                 style={{ width: `${widthPct}%` }}
              />

              <div className="flex flex-col items-center w-12 md:w-16 relative z-10">
                 {isNow && <span className="text-[7px] md:text-[9px] font-black text-sky-400 mb-0.5 tracking-widest">{t.now}</span>}
                 <span className={`${isNow ? 'text-sky-100 font-bold' : 'text-slate-400 group-hover:text-slate-200'} font-mono text-[10px] md:text-xs transition-colors`}>{formatTimeSafely(timeKey)}</span>
              </div>
              
              <div className="flex flex-1 items-center justify-around px-4 md:px-8 relative z-10">
                <div className="flex flex-col items-center">
                  <span className="text-[8px] md:text-[10px] text-slate-600 group-hover:text-slate-500 font-black tracking-widest transition-colors">{t.local}</span>
                  <span className="text-white font-bold text-sm md:text-base">{formatVal(locVal)}<span className="text-[9px] md:text-[11px] text-slate-500 ml-0.5">{unit}</span></span>
                </div>
                <div className="h-6 md:h-8 w-px bg-slate-800 group-hover:bg-slate-700 transition-colors"></div>
                <div className="flex flex-col items-center">
                  <span className="text-[8px] md:text-[10px] text-slate-600 group-hover:text-slate-500 font-black tracking-widest transition-colors">{t.global}</span>
                  <span className="text-slate-300 font-bold text-sm md:text-base">{formatVal(gloVal)}<span className="text-[9px] md:text-[11px] text-slate-500 ml-0.5">{unit}</span></span>
                </div>
              </div>
              
              <div className={`w-14 md:w-16 rounded-lg py-1 md:py-1.5 flex justify-center items-center gap-1 border relative z-10 ${isNow ? 'bg-black/60 border-sky-900/50 shadow-[inset_0_1px_2px_rgba(0,0,0,0.5)]' : 'bg-[#030712]/80 border-slate-800/80 backdrop-blur-sm group-hover:border-slate-700'} transition-colors`}>
                <span className="text-[10px] md:text-[11px] font-black text-slate-200">{diff !== '--' && Number(diff) > 0 ? `+${diff}` : diff}</span>
                {renderTrend(locVal, gloVal, activeModal)}
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <>
      <div className="w-full relative perspective-[2000px]">
        <style>
          {`
            @keyframes spatial-float-active { 0%, 100% { transform: rotateX(2deg) rotateY(-1deg) translateY(0px); } 50% { transform: rotateX(-1deg) rotateY(1deg) translateY(-4px); } }
            @keyframes spatial-float-pc { 0%, 100% { transform: rotateX(1deg) rotateY(-0.5deg) translateY(0px); } 50% { transform: rotateX(-0.5deg) rotateY(0.5deg) translateY(-2px); } }
            .preserve-3d { transform-style: preserve-3d; }
            .custom-scrollbar::-webkit-scrollbar { width: 4px; }
            @media (min-width: 768px) { .custom-scrollbar::-webkit-scrollbar { width: 6px; } }
            .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
            .custom-scrollbar::-webkit-scrollbar-thumb { background: #1e293b; border-radius: 6px; }
            .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #334155; }
          `}
        </style>

        <div className={`w-full relative bg-[#030712]/90 backdrop-blur-2xl backdrop-saturate-150 border ${theme.border} rounded-[24px] md:rounded-[32px] ${theme.shadow} preserve-3d animate-[spatial-float-active_8s_ease-in-out_infinite] md:animate-[spatial-float-pc_10s_ease-in-out_infinite] transition-transform duration-500`}>
           <div className="absolute inset-0 overflow-hidden rounded-[24px] md:rounded-[32px]">
              <div className={`absolute inset-0 bg-[linear-gradient(currentColor_1px,transparent_1px),linear-gradient(90deg,currentColor_1px,transparent_1px)] bg-[size:24px_24px] md:bg-[size:32px_32px] opacity-[0.03] [transform:translateZ(-50px)] ${theme.accent}`}></div>
              <div className={`absolute inset-0 bg-gradient-to-br ${theme.glow} to-transparent opacity-60 md:opacity-40`}></div>
           </div>

           <div className="p-4 sm:p-6 md:p-8 flex flex-col gap-6 md:gap-8 relative z-10 preserve-3d">
              <div className="flex flex-col sm:flex-row sm:justify-between items-start sm:items-center w-full gap-4 sm:gap-0 [transform:translateZ(30px)]">
                 <div className="flex items-center gap-3 md:gap-4">
                    <div className={`w-9 h-9 md:w-12 md:h-12 rounded-xl md:rounded-2xl bg-[#050810] border ${theme.border} flex items-center justify-center shadow-[inset_0_0_15px_rgba(0,0,0,0.8)] relative overflow-hidden`}>
                       <Cpu className={`w-4 h-4 md:w-5 md:h-5 ${theme.accent} relative z-10`} />
                       <div className={`absolute inset-0 opacity-20 ${theme.bg} animate-pulse`}></div>
                    </div>
                    <div>
                       <h2 className="text-[11px] sm:text-xs md:text-sm font-black text-white uppercase tracking-[0.2em] drop-shadow-md">{t.title}</h2>
                       <div className="flex items-center gap-1.5 md:gap-2 mt-0.5 md:mt-1">
                          <span className="relative flex h-2 w-2 md:h-2.5 md:w-2.5">
                            <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-40 bg-current ${theme.accent}`}></span>
                            <span className={`relative inline-flex rounded-full h-full w-full bg-current ${theme.accent}`}></span>
                          </span>
                          <span className={`text-[9px] sm:text-[10px] md:text-[11px] font-bold uppercase tracking-widest ${theme.accent}`}>{theme.status}</span>
                       </div>
                    </div>
                 </div>

                 <div className="flex items-center gap-3 md:gap-4 bg-[#050810]/50 px-3 md:px-5 py-1.5 md:py-2.5 rounded-2xl md:rounded-3xl border border-slate-800/60 backdrop-blur-md shadow-[inset_0_1px_1px_rgba(255,255,255,0.05)] self-end sm:self-auto">
                    <div className="flex flex-col items-end">
                       <span className="text-[9px] sm:text-[10px] md:text-[11px] font-bold text-slate-500 uppercase tracking-widest">{t.affinity}</span>
                       <span className="text-xl sm:text-2xl md:text-3xl font-black text-white leading-none tracking-tighter drop-shadow-lg">{metrics.score}<span className={`text-sm md:text-base ml-0.5 md:ml-1 ${theme.accent}`}>%</span></span>
                    </div>
                    <div className="relative flex items-center justify-center w-12 h-12 sm:w-14 sm:h-14 md:w-16 md:h-16">
                       <div className={`absolute inset-[-4px] md:inset-[-6px] border ${theme.border} rounded-full border-dashed animate-[spin_15s_linear_infinite]`}></div>
                       <svg className="absolute inset-0 w-full h-full transform -rotate-90 drop-shadow-[0_0_10px_currentColor]" viewBox="0 0 100 100">
                          <circle cx="50" cy="50" r={radius} className="stroke-slate-900" strokeWidth="8" fill="transparent" />
                          <circle cx="50" cy="50" r={radius} className={`${theme.accent} transition-all duration-1000 ease-out`} strokeWidth="8" fill="transparent" strokeLinecap="round" strokeDasharray={circumference} strokeDashoffset={strokeDashoffset} style={{ filter: 'drop-shadow(0 0 8px currentColor)' }} />
                       </svg>
                       <div className={`z-10 bg-[#030712] rounded-full p-1.5 md:p-2 shadow-[inset_0_0_15px_rgba(0,0,0,1)] border ${theme.border}`}>
                          {theme.icon}
                       </div>
                    </div>
                 </div>
              </div>

              <div className="grid grid-cols-3 gap-2 sm:gap-4 md:gap-6 w-full preserve-3d [transform:translateZ(40px)]">
                 <div onClick={() => openModal('temp')} className="cursor-pointer group relative bg-[#0B0F19]/80 backdrop-blur-lg backdrop-saturate-150 transition-all duration-300 rounded-[20px] md:rounded-[24px] p-3 sm:p-4 md:p-5 border border-slate-800/80 flex flex-col items-center justify-between shadow-[0_10px_30px_rgba(0,0,0,0.5)] md:hover:border-slate-500/50 md:hover:-translate-y-2 md:hover:shadow-[0_20px_40px_rgba(0,0,0,0.4)] active:scale-95 active:translate-y-0">
                    <div className="absolute inset-0 rounded-[20px] md:rounded-[24px] bg-gradient-to-b from-white/[0.04] to-transparent pointer-events-none"></div>
                    <div className="flex items-center gap-1.5 md:gap-2 text-slate-400 mb-2 sm:mb-3 md:mb-4">
                        <Thermometer className="w-3.5 h-3.5 sm:w-4 sm:h-4 md:w-5 md:h-5 group-hover:text-rose-400 transition-colors duration-300" />
                        <span className="text-[9px] sm:text-[10px] md:text-[11px] font-black tracking-widest">{t.temp}</span>
                    </div>
                    <div className="flex flex-col items-center mb-4 md:mb-5">
                        <div className="text-xl sm:text-3xl md:text-4xl font-black text-white leading-none tracking-tighter drop-shadow-md">{formatVal(aromeTemp)}<span className="text-[10px] sm:text-xs md:text-sm text-slate-600 font-bold ml-0.5">°</span></div>
                        <div className="text-[9px] sm:text-[10px] md:text-[11px] font-medium text-slate-500 mt-1 md:mt-2 transition-colors group-hover:text-slate-400">WRF <span className="text-slate-300 font-bold">{formatVal(metrics.wrfTemp)}°</span></div>
                    </div>
                    <div className="w-full bg-[#030712] rounded-xl md:rounded-2xl py-2 md:py-2.5 flex justify-center items-center gap-2 border border-slate-800/60 shadow-[inset_0_1px_2px_rgba(0,0,0,1)] group-hover:border-slate-600 group-hover:bg-[#050810] transition-colors duration-300">
                        <span className="text-[9px] md:text-[10px] text-slate-600 font-black">{t.diff}</span>
                        <div className="flex items-center gap-0.5 md:gap-1 text-[10px] sm:text-[11px] md:text-xs font-black text-slate-200">{formatDelta(metrics.tempDiff)}° {renderTrend(aromeTemp, metrics.wrfTemp, 'temp')}</div>
                    </div>
                 </div>

                 <div onClick={() => openModal('rain')} className={`cursor-pointer group relative bg-[#0B0F19]/80 backdrop-blur-lg backdrop-saturate-150 transition-all duration-300 rounded-[20px] md:rounded-[24px] p-3 sm:p-4 md:p-5 border flex flex-col items-center justify-between shadow-[0_10px_30px_rgba(0,0,0,0.5)] md:hover:-translate-y-2 md:hover:shadow-[0_20px_40px_rgba(0,0,0,0.4)] active:scale-95 active:translate-y-0 ${isSnowRisk ? 'border-sky-900/50 md:hover:border-sky-500/50' : 'border-slate-800/80 md:hover:border-slate-500/50'}`}>
                    <div className="absolute inset-0 rounded-[20px] md:rounded-[24px] bg-gradient-to-b from-white/[0.04] to-transparent pointer-events-none"></div>
                    {isSnowRisk && <div className="absolute inset-0 bg-sky-500/5 rounded-[20px] md:rounded-[24px] animate-pulse pointer-events-none"></div>}
                    <div className={`flex items-center gap-1.5 md:gap-2 mb-2 sm:mb-3 md:mb-4 ${isSnowRisk ? 'text-sky-400 drop-shadow-[0_0_5px_currentColor]' : 'text-slate-400'}`}>
                        {isSnowRisk ? <CloudSnow className="w-3.5 h-3.5 sm:w-4 sm:h-4 md:w-5 md:h-5 group-hover:text-sky-300 transition-colors duration-300" /> : <CloudRain className="w-3.5 h-3.5 sm:w-4 sm:h-4 md:w-5 md:h-5 group-hover:text-sky-400 transition-colors duration-300" />}
                        <span className="text-[9px] sm:text-[10px] md:text-[11px] font-black tracking-widest">{isSnowRisk ? t.snow : t.rain}</span>
                    </div>
                    <div className="flex flex-col items-center mb-4 md:mb-5">
                        <div className="flex items-baseline leading-none tracking-tighter drop-shadow-md"><span className="text-xl sm:text-3xl md:text-4xl font-black text-white">{formatVal(aromePrecip)}</span><span className="text-[8px] sm:text-[10px] md:text-[11px] text-slate-600 font-bold ml-0.5 md:ml-1">mm</span></div>
                        <div className="text-[9px] sm:text-[10px] md:text-[11px] font-medium text-slate-500 mt-1 md:mt-2 flex items-baseline gap-1 transition-colors group-hover:text-slate-400">WRF <span className="text-slate-300 font-bold">{formatVal(metrics.wrfPrecip)}<span className="text-[7px] md:text-[9px] font-normal text-slate-600 ml-[1px]">mm</span></span></div>
                    </div>
                    <div className="w-full bg-[#030712] rounded-xl md:rounded-2xl py-2 md:py-2.5 flex justify-center items-center gap-2 border border-slate-800/60 shadow-[inset_0_1px_2px_rgba(0,0,0,1)] group-hover:border-slate-600 group-hover:bg-[#050810] transition-colors duration-300">
                        <span className="text-[9px] md:text-[10px] text-slate-600 font-black">{t.diff}</span>
                        <div className="flex items-center gap-0.5 md:gap-1 text-[10px] sm:text-[11px] md:text-xs font-black text-slate-200">{formatDelta(metrics.precipDiff)} {renderTrend(aromePrecip, metrics.wrfPrecip, 'rain')}</div>
                    </div>
                 </div>

                 <div onClick={() => openModal('wind')} className="cursor-pointer group relative bg-[#0B0F19]/80 backdrop-blur-lg backdrop-saturate-150 transition-all duration-300 rounded-[20px] md:rounded-[24px] p-3 sm:p-4 md:p-5 border border-slate-800/80 flex flex-col items-center justify-between shadow-[0_10px_30px_rgba(0,0,0,0.5)] md:hover:border-amber-500/50 md:hover:-translate-y-2 md:hover:shadow-[0_20px_40px_rgba(0,0,0,0.4)] active:scale-95 active:translate-y-0">
                    <div className="absolute inset-0 rounded-[20px] md:rounded-[24px] bg-gradient-to-b from-white/[0.04] to-transparent pointer-events-none"></div>
                    <div className="flex items-center gap-1.5 md:gap-2 text-slate-400 mb-2 sm:mb-3 md:mb-4">
                        <Wind className="w-3.5 h-3.5 sm:w-4 sm:h-4 md:w-5 md:h-5 group-hover:text-amber-400 transition-colors duration-300" />
                        <span className="text-[9px] sm:text-[10px] md:text-[11px] font-black tracking-widest">{t.wind}</span>
                    </div>
                    <div className="flex flex-col items-center mb-4 md:mb-5">
                        <div className="flex items-baseline leading-none tracking-tighter drop-shadow-md"><span className="text-xl sm:text-3xl md:text-4xl font-black text-white">{formatVal(aromeWind)}</span><span className="text-[8px] sm:text-[10px] md:text-[11px] text-slate-600 font-bold ml-0.5 md:ml-1">kmh</span></div>
                        <div className="text-[9px] sm:text-[10px] md:text-[11px] font-medium text-slate-500 mt-1 md:mt-2 flex items-baseline gap-1 transition-colors group-hover:text-slate-400">WRF <span className="text-slate-300 font-bold">{formatVal(metrics.wrfWind)}<span className="text-[7px] md:text-[9px] font-normal text-slate-600 ml-[1px]">km</span></span></div>
                    </div>
                    <div className="w-full bg-[#030712] rounded-xl md:rounded-2xl py-2 md:py-2.5 flex justify-center items-center gap-2 border border-slate-800/60 shadow-[inset_0_1px_2px_rgba(0,0,0,1)] group-hover:border-slate-600 group-hover:bg-[#050810] transition-colors duration-300">
                        <span className="text-[9px] md:text-[10px] text-slate-600 font-black">{t.diff}</span>
                        <div className="flex items-center gap-0.5 md:gap-1 text-[10px] sm:text-[11px] md:text-xs font-black text-slate-200">{formatDelta(metrics.windDiff)} {renderTrend(aromeWind, metrics.wrfWind, 'wind')}</div>
                    </div>
                 </div>
              </div>
           </div>
        </div>
      </div>

      {activeModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-[#030712]/85 backdrop-blur-2xl backdrop-saturate-150 animate-in fade-in duration-300">
          <div className="bg-[#0B0F19] border border-slate-700/60 rounded-[32px] w-[95%] sm:max-w-md md:max-w-2xl lg:max-w-3xl shadow-[0_0_100px_rgba(0,0,0,1)] overflow-hidden flex flex-col transform scale-100 animate-in zoom-in-95 slide-in-from-bottom-4 duration-300">
            <div className="flex justify-between items-center p-5 md:p-6 border-b border-slate-800/80 bg-[#050810]/90 backdrop-blur-md relative z-10">
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-slate-800/10 to-transparent pointer-events-none"></div>
              <div className="flex items-center gap-4">
                <div className={`p-3 rounded-2xl bg-slate-800/40 border border-slate-700/50 shadow-inner`}>
                    {activeModal === 'temp' && <Thermometer className="w-6 h-6 md:w-7 md:h-7 text-rose-400 drop-shadow-[0_0_8px_currentColor]" />}
                    {activeModal === 'rain' && <CloudRain className="w-6 h-6 md:w-7 md:h-7 text-sky-400 drop-shadow-[0_0_8px_currentColor]" />}
                    {activeModal === 'wind' && <Wind className="w-6 h-6 md:w-7 md:h-7 text-amber-400 drop-shadow-[0_0_8px_currentColor]" />}
                </div>
                <div>
                  <h3 className="text-white font-black uppercase tracking-[0.2em] text-sm md:text-base drop-shadow-md">{t.modalTitle}</h3>
                  <p className="text-[10px] md:text-xs text-slate-500 font-mono tracking-widest mt-0.5">
                    {activeModal === 'temp' ? 'TEMPERATURA' : activeModal === 'rain' ? 'PLUJA / NEU' : 'VENT (10M)'}
                  </p>
                </div>
              </div>
              <button onClick={closeModal} className="w-10 h-10 md:w-12 md:h-12 rounded-full bg-[#030712] border border-slate-700/80 flex items-center justify-center md:hover:bg-slate-800 md:hover:scale-110 active:scale-95 transition-all duration-300 text-slate-300 shadow-[inset_0_1px_2px_rgba(255,255,255,0.05)]"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-4 md:p-6 bg-[linear-gradient(rgba(255,255,255,0.015)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.015)_1px,transparent_1px)] bg-[size:24px_24px] md:bg-[size:32px_32px] bg-[#030712] relative">
              <div className="absolute inset-0 bg-gradient-to-b from-[#050810]/50 to-transparent pointer-events-none"></div>
              {renderModalContent()}
            </div>
          </div>
        </div>
      )}
    </>
  );
};