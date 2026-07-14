// src/components/widgets/ConsensusWidget.tsx
import React, { useState, useEffect, useCallback } from 'react';
import { ConsensusMetrics } from '../../utils/consensusMath';
import { Language } from '../../translations';
import { ConsensusModal } from './ConsensusModal';
import { ConsensusChartsModal } from './ConsensusChartsModal';
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
  LineChart
} from 'lucide-react';

export type ModalType = 'temp' | 'rain' | 'wind' | 'charts';

interface ConsensusWidgetProps {
  metrics: ConsensusMetrics;
  aromeTemp: number | undefined;
  aromePrecip: number | undefined;
  aromeWind: number | undefined;
  lang: Language;
  utcOffset?: number; 
  hourlyTimes?: string[];
  hourlyGlobalTimes?: string[];
  hourlyLocal?: { temp?: (number | null)[]; rain?: (number | null)[]; wind?: (number | null)[]; gusts?: (number | null)[] };
  hourlyGlobal?: { temp?: (number | null)[]; rain?: (number | null)[]; wind?: (number | null)[]; gusts?: (number | null)[] };
}

export const ConsensusWidget: React.FC<ConsensusWidgetProps> = ({
  metrics, aromeTemp, aromePrecip, aromeWind, lang,
  utcOffset = 0,
  hourlyTimes = [], hourlyGlobalTimes = [], hourlyLocal = {}, hourlyGlobal = {}
}) => {
  const [activeModal, setActiveModal] = useState<ModalType | null>(null);
  const [nowTimestamp, setNowTimestamp] = useState(() => Date.now());
  
  const isCa = lang === 'ca';
  
  const t = {
    title: isCa ? 'Motor de Consens' : 'Consensus Engine',
    affinity: isCa ? 'Precisió' : 'Accuracy',
    temp: 'TEMP', rain: isCa ? 'PLUJA' : 'RAIN', snow: 'NEU', wind: 'VENT', diff: 'Δ',
    chartsBtn: isCa ? 'Telemetria Gràfica Completa' : 'Full Graphical Telemetry',
    status: { sync: isCa ? 'Alineat' : 'Aligned', discrepancy: isCa ? 'Discrepància' : 'Variance', alert: isCa ? 'Divergència' : 'Divergence' }
  };

  // DOCTRINA RISC ZERO: Validació estricta de números
  const isValidNum = (val: unknown): val is number => typeof val === 'number' && !Number.isNaN(val);
  
  const safeAromeTemp = isValidNum(aromeTemp) ? aromeTemp : undefined;
  const safeWrfTemp = isValidNum(metrics.wrfTemp) ? metrics.wrfTemp : null;
  const isSnowRisk = (safeAromeTemp !== undefined && safeAromeTemp <= 2) || (safeWrfTemp !== null && safeWrfTemp <= 2);

  const safeScore = Math.max(0, Math.min(100, isValidNum(metrics.score) ? metrics.score : 0));

  const getTheme = (score: number) => {
    if (score >= 75) return { accent: 'text-emerald-400', border: 'border-emerald-500/30', bg: 'bg-emerald-500/10', glow: 'from-emerald-900/30', shadow: 'shadow-[0_15px_40px_rgba(16,185,129,0.2)]', status: t.status.sync, icon: <CheckCircle2 className="w-5 h-5 md:w-6 md:h-6 drop-shadow-md" /> };
    if (score >= 55) return { accent: 'text-amber-400', border: 'border-amber-500/30', bg: 'bg-amber-500/10', glow: 'from-amber-900/30', shadow: 'shadow-[0_15px_40px_rgba(245,158,11,0.2)]', status: t.status.discrepancy, icon: <Activity className="w-5 h-5 md:w-6 md:h-6 drop-shadow-md" /> };
    return { accent: 'text-rose-500', border: 'border-rose-500/40', bg: 'bg-rose-500/10', glow: 'from-rose-900/40', shadow: 'shadow-[0_15px_40px_rgba(244,63,94,0.2)]', status: t.status.alert, icon: <GitBranch className="w-5 h-5 md:w-6 md:h-6 drop-shadow-md" /> };
  };

  const theme = getTheme(safeScore);
  const radius = 42; 
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (safeScore / 100) * circumference;

  const renderTrend = (local: number | null | undefined, global: number | null | undefined, type: 'temp' | 'rain' | 'wind') => {
    if (!isValidNum(local) || !isValidNum(global) || local === global) return <MoveRight className="w-4 h-4 text-slate-500" />;
    const isUp = global > local;
    let iconClass = "w-4 h-4 transition-transform duration-300 drop-shadow-sm ";
    if (type === 'temp') iconClass += isUp ? "text-rose-500" : "text-sky-400";
    else if (type === 'rain') iconClass += isUp ? "text-sky-400" : "text-slate-500";
    else iconClass += isUp ? "text-amber-400" : "text-emerald-400";
    return isUp ? <ArrowUpRight className={iconClass} /> : <ArrowDownRight className={iconClass} />;
  };

  const formatVal = (val: number | null | undefined) => isValidNum(val) ? val : '--';
  const formatDelta = (val: number | null | undefined) => isValidNum(val) ? val.toFixed(1) : '--';

  // PROTECCIÓ HISTORY API: Prevé dobles clicks ràpids que trenquen el "botó enrere" natiu
  const openModal = useCallback((type: ModalType) => {
    if (activeModal) return; 
    setNowTimestamp(Date.now()); 
    window.history.pushState({ modalOpen: 'consensus' }, '');
    setActiveModal(type);
  }, [activeModal]);

  const closeModal = useCallback(() => {
    setActiveModal(null);
    if (window.history.state?.modalOpen === 'consensus') {
        window.history.back();
    }
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => { 
        if (e.key === 'Escape' && activeModal) closeModal();
    };
    const handlePopState = () => { if (activeModal) setActiveModal(null); };
    
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('popstate', handlePopState);
    return () => { 
        window.removeEventListener('keydown', handleKeyDown); 
        window.removeEventListener('popstate', handlePopState); 
    };
  }, [activeModal, closeModal]);

  return (
    <>
      <div className="w-full relative perspective-[2000px]">
        {/* SPATIAL UI: Animacions restringides a Desktop (md:) per estalviar bateria operativa en mòbil */}
        <style>
          {`
            @keyframes spatial-float-pc { 0%, 100% { transform: rotateX(1deg) rotateY(-0.5deg) translateY(0px); } 50% { transform: rotateX(-0.5deg) rotateY(0.5deg) translateY(-2px); } }
            .preserve-3d { transform-style: preserve-3d; }
          `}
        </style>

        <div className={`w-full relative bg-[#060913]/90 backdrop-blur-2xl backdrop-saturate-150 border ${theme.border} rounded-[24px] md:rounded-[32px] ${theme.shadow} preserve-3d md:animate-[spatial-float-pc_10s_ease-in-out_infinite] transition-transform duration-500`}>
           <div className="absolute inset-0 overflow-hidden rounded-[24px] md:rounded-[32px]">
              <div className={`absolute inset-0 bg-[linear-gradient(currentColor_1px,transparent_1px),linear-gradient(90deg,currentColor_1px,transparent_1px)] bg-[size:24px_24px] md:bg-[size:32px_32px] opacity-[0.03] [transform:translateZ(-50px)] ${theme.accent}`}></div>
              <div className={`absolute inset-0 bg-gradient-to-br ${theme.glow} to-transparent opacity-60 md:opacity-40`}></div>
           </div>

           <div className="p-4 sm:p-6 md:p-8 flex flex-col gap-6 md:gap-8 relative z-10 preserve-3d">
              <div className="flex flex-col sm:flex-row sm:justify-between items-start sm:items-center w-full gap-4 sm:gap-0 [transform:translateZ(30px)]">
                 <div className="flex items-center gap-3 md:gap-4">
                    <div className={`w-9 h-9 md:w-12 md:h-12 rounded-xl md:rounded-2xl bg-[#0a0f1c] border ${theme.border} flex items-center justify-center shadow-[inset_0_0_15px_rgba(0,0,0,0.8)] relative overflow-hidden backdrop-blur-md`}>
                       <Cpu className={`w-4 h-4 md:w-5 md:h-5 ${theme.accent} relative z-10 drop-shadow-[0_0_8px_currentColor]`} />
                       {/* Animació pulse només visible a Desktop o evitada si es vol màxim estalvi */}
                       <div className={`absolute inset-0 opacity-20 md:animate-pulse ${theme.bg}`}></div>
                    </div>
                    <div>
                       <h2 className="text-xs md:text-sm font-black text-white uppercase tracking-[0.2em] drop-shadow-md">{t.title}</h2>
                       <div className="flex items-center gap-1.5 md:gap-2 mt-0.5 md:mt-1">
                          <span className="relative flex h-2.5 w-2.5">
                            <span className={`md:animate-ping absolute inline-flex h-full w-full rounded-full opacity-50 bg-current ${theme.accent}`}></span>
                            <span className={`relative inline-flex rounded-full h-full w-full bg-current shadow-[0_0_6px_currentColor] ${theme.accent}`}></span>
                          </span>
                          <span className={`text-[10px] sm:text-[11px] md:text-xs font-black uppercase tracking-widest ${theme.accent} drop-shadow-sm`}>{theme.status}</span>
                       </div>
                    </div>
                 </div>

                 <div className="flex items-center gap-3 md:gap-4 bg-black/50 px-3 md:px-5 py-2 md:py-2.5 rounded-2xl md:rounded-3xl border border-white/10 backdrop-blur-md shadow-[inset_0_0_15px_rgba(0,0,0,0.5)] self-end sm:self-auto">
                    <div className="flex flex-col items-end">
                       <span className="text-[10px] md:text-[11px] font-bold text-slate-400 uppercase tracking-widest">{t.affinity}</span>
                       <span className="text-2xl sm:text-3xl font-black text-white leading-none tracking-tighter drop-shadow-lg">{safeScore}<span className={`text-sm md:text-base ml-0.5 md:ml-1 ${theme.accent}`}>%</span></span>
                    </div>
                    <div className="relative flex items-center justify-center w-12 h-12 sm:w-14 sm:h-14 md:w-16 md:h-16">
                       <div className={`absolute inset-[-4px] md:inset-[-6px] border ${theme.border} rounded-full border-dashed md:animate-[spin_15s_linear_infinite]`}></div>
                       <svg className="absolute inset-0 w-full h-full transform -rotate-90 drop-shadow-[0_0_10px_currentColor]" viewBox="0 0 100 100">
                          <circle cx="50" cy="50" r={radius} className="stroke-black/50" strokeWidth="8" fill="transparent" />
                          <circle cx="50" cy="50" r={radius} className={`${theme.accent} transition-all duration-1000 ease-out`} strokeWidth="8" fill="transparent" strokeLinecap="round" strokeDasharray={circumference} strokeDashoffset={strokeDashoffset} style={{ filter: 'drop-shadow(0 0 8px currentColor)' }} />
                       </svg>
                       <div className={`z-10 bg-[#0a0f1c] rounded-full p-1.5 md:p-2 shadow-[inset_0_0_15px_rgba(0,0,0,1)] border ${theme.border}`}>
                          {theme.icon}
                       </div>
                    </div>
                 </div>
              </div>

              <div className="grid grid-cols-3 gap-2 sm:gap-4 md:gap-6 w-full preserve-3d [transform:translateZ(40px)]">
                 {/* MIDES DE TEXT I CONTRAST MILLORATS PER A LECTURA EXTERIOR */}
                 <div onClick={() => openModal('temp')} className="cursor-pointer group relative bg-black/40 backdrop-blur-xl backdrop-saturate-150 transition-all duration-300 rounded-[20px] md:rounded-[24px] p-3 sm:p-4 md:p-5 border border-white/10 flex flex-col items-center justify-between shadow-[0_10px_30px_rgba(0,0,0,0.6)] hover:border-rose-500/30 hover:bg-black/60 md:hover:-translate-y-1 active:scale-95">
                    <div className="flex items-center gap-1.5 md:gap-2 text-slate-300 mb-2 sm:mb-3 md:mb-4">
                        <Thermometer className="w-4 h-4 md:w-5 md:h-5 group-hover:text-rose-500 transition-colors duration-300 drop-shadow-md" />
                        <span className="text-[10px] sm:text-[11px] md:text-xs font-black tracking-widest drop-shadow-sm">{t.temp}</span>
                    </div>
                    <div className="flex flex-col items-center mb-4 md:mb-5">
                        <div className="text-2xl sm:text-3xl md:text-4xl font-black text-white leading-none tracking-tighter drop-shadow-lg">{formatVal(aromeTemp)}<span className="text-xs sm:text-sm text-slate-400 font-bold ml-0.5">°</span></div>
                        <div className="text-[10px] sm:text-[11px] font-medium text-slate-400 mt-1.5 flex gap-1 items-baseline">WRF <span className="text-slate-200 font-black">{formatVal(metrics.wrfTemp)}°</span></div>
                    </div>
                    <div className="w-full bg-black/80 rounded-xl py-2 flex justify-center items-center gap-2 border border-white/5 shadow-inner">
                        <span className="text-[10px] md:text-[11px] text-slate-500 font-black">{t.diff}</span>
                        <div className="flex items-center gap-1 text-[11px] sm:text-xs font-black text-white">{formatDelta(metrics.tempDiff)}° {renderTrend(aromeTemp, metrics.wrfTemp, 'temp')}</div>
                    </div>
                 </div>

                 <div onClick={() => openModal('rain')} className={`cursor-pointer group relative bg-black/40 backdrop-blur-xl backdrop-saturate-150 transition-all duration-300 rounded-[20px] md:rounded-[24px] p-3 sm:p-4 md:p-5 border flex flex-col items-center justify-between shadow-[0_10px_30px_rgba(0,0,0,0.6)] hover:bg-black/60 md:hover:-translate-y-1 active:scale-95 ${isSnowRisk ? 'border-sky-500/30' : 'border-white/10 hover:border-sky-500/30'}`}>
                    {isSnowRisk && <div className="absolute inset-0 bg-sky-500/10 rounded-[20px] md:rounded-[24px] animate-pulse pointer-events-none"></div>}
                    <div className={`flex items-center gap-1.5 md:gap-2 mb-2 sm:mb-3 md:mb-4 ${isSnowRisk ? 'text-sky-300 drop-shadow-[0_0_8px_currentColor]' : 'text-slate-300'}`}>
                        {isSnowRisk ? <CloudSnow className="w-4 h-4 md:w-5 md:h-5 text-white transition-colors duration-300" /> : <CloudRain className="w-4 h-4 md:w-5 md:h-5 group-hover:text-sky-400 transition-colors duration-300 drop-shadow-md" />}
                        <span className="text-[10px] sm:text-[11px] md:text-xs font-black tracking-widest drop-shadow-sm">{isSnowRisk ? t.snow : t.rain}</span>
                    </div>
                    <div className="flex flex-col items-center mb-4 md:mb-5">
                        <div className="flex items-baseline leading-none tracking-tighter drop-shadow-lg"><span className="text-2xl sm:text-3xl md:text-4xl font-black text-white">{formatVal(aromePrecip)}</span><span className="text-[10px] sm:text-xs text-slate-400 font-bold ml-1">mm</span></div>
                        <div className="text-[10px] sm:text-[11px] font-medium text-slate-400 mt-1.5 flex gap-1 items-baseline">WRF <span className="text-slate-200 font-black">{formatVal(metrics.wrfPrecip)}<span className="text-[9px] font-normal text-slate-400 ml-[1px]">mm</span></span></div>
                    </div>
                    <div className="w-full bg-black/80 rounded-xl py-2 flex justify-center items-center gap-2 border border-white/5 shadow-inner">
                        <span className="text-[10px] md:text-[11px] text-slate-500 font-black">{t.diff}</span>
                        <div className="flex items-center gap-1 text-[11px] sm:text-xs font-black text-white">{formatDelta(metrics.precipDiff)} {renderTrend(aromePrecip, metrics.wrfPrecip, 'rain')}</div>
                    </div>
                 </div>

                 <div onClick={() => openModal('wind')} className="cursor-pointer group relative bg-black/40 backdrop-blur-xl backdrop-saturate-150 transition-all duration-300 rounded-[20px] md:rounded-[24px] p-3 sm:p-4 md:p-5 border border-white/10 flex flex-col items-center justify-between shadow-[0_10px_30px_rgba(0,0,0,0.6)] hover:border-amber-500/30 hover:bg-black/60 md:hover:-translate-y-1 active:scale-95">
                    <div className="flex items-center gap-1.5 md:gap-2 text-slate-300 mb-2 sm:mb-3 md:mb-4">
                        <Wind className="w-4 h-4 md:w-5 md:h-5 group-hover:text-amber-400 transition-colors duration-300 drop-shadow-md" />
                        <span className="text-[10px] sm:text-[11px] md:text-xs font-black tracking-widest drop-shadow-sm">{t.wind}</span>
                    </div>
                    <div className="flex flex-col items-center mb-4 md:mb-5">
                        <div className="flex items-baseline leading-none tracking-tighter drop-shadow-lg"><span className="text-2xl sm:text-3xl md:text-4xl font-black text-white">{formatVal(aromeWind)}</span><span className="text-[10px] sm:text-xs text-slate-400 font-bold ml-1">kmh</span></div>
                        <div className="text-[10px] sm:text-[11px] font-medium text-slate-400 mt-1.5 flex gap-1 items-baseline">WRF <span className="text-slate-200 font-black">{formatVal(metrics.wrfWind)}<span className="text-[9px] font-normal text-slate-400 ml-[1px]">km</span></span></div>
                    </div>
                    <div className="w-full bg-black/80 rounded-xl py-2 flex justify-center items-center gap-2 border border-white/5 shadow-inner">
                        <span className="text-[10px] md:text-[11px] text-slate-500 font-black">{t.diff}</span>
                        <div className="flex items-center gap-1 text-[11px] sm:text-xs font-black text-white">{formatDelta(metrics.windDiff)} {renderTrend(aromeWind, metrics.wrfWind, 'wind')}</div>
                    </div>
                 </div>
              </div>

              <div className="w-full [transform:translateZ(20px)] mt-[-10px] md:mt-[-15px]">
                  <button 
                     onClick={() => openModal('charts')}
                     className="w-full relative group overflow-hidden bg-black/60 backdrop-blur-md border border-white/10 hover:border-cyan-500/40 rounded-xl md:rounded-2xl py-3 md:py-4 flex items-center justify-center gap-3 transition-all duration-300 shadow-[inset_0_0_20px_rgba(0,0,0,0.8)] active:scale-[0.98]"
                  >
                     <LineChart className="w-4 h-4 md:w-5 md:h-5 text-cyan-400 group-hover:text-cyan-300 drop-shadow-[0_0_8px_currentColor] transition-colors relative z-10" />
                     <span className="text-[11px] sm:text-xs md:text-sm font-black text-cyan-100 group-hover:text-white uppercase tracking-[0.2em] relative z-10 transition-colors drop-shadow-md">
                        {t.chartsBtn}
                     </span>
                  </button>
              </div>

           </div>
        </div>
      </div>

      {activeModal && activeModal !== 'charts' && (
        <ConsensusModal
          activeModal={activeModal}
          closeModal={closeModal}
          lang={lang}
          utcOffset={utcOffset}
          nowTimestamp={nowTimestamp}
          hourlyTimes={hourlyTimes}
          hourlyGlobalTimes={hourlyGlobalTimes}
          hourlyLocal={hourlyLocal}
          hourlyGlobal={hourlyGlobal}
        />
      )}
      
      {activeModal === 'charts' && (
        <ConsensusChartsModal
          closeModal={closeModal}
          lang={lang}
          utcOffset={utcOffset}
          nowTimestamp={nowTimestamp}
          hourlyTimes={hourlyTimes}
          hourlyGlobalTimes={hourlyGlobalTimes}
          hourlyLocal={hourlyLocal}
          hourlyGlobal={hourlyGlobal}
        />
      )}
    </>
  );
};