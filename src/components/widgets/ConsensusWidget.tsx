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
  hourlyTimes?: string[];
  hourlyLocal?: { temp?: (number | null)[]; rain?: (number | null)[]; wind?: (number | null)[] };
  hourlyGlobal?: { temp?: (number | null)[]; rain?: (number | null)[]; wind?: (number | null)[] };
}

type ModalType = 'temp' | 'rain' | 'wind'; 

export const ConsensusWidget: React.FC<ConsensusWidgetProps> = ({
  metrics, aromeTemp, aromePrecip, aromeWind, lang,
  hourlyTimes = [], hourlyLocal = {}, hourlyGlobal = {}
}) => {
  const [activeModal, setActiveModal] = useState<ModalType | null>(null);
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

  // ARQUITECTURA TAILWIND CORREGIDA: Les classes d'ombra arbitràries han d'estar escrites completament perquè el compilador estàtic les trobi.
  const getTheme = (score: number) => {
    if (score >= 75) return { accent: 'text-emerald-400', border: 'border-emerald-500/30', bg: 'bg-emerald-500/10', glow: 'from-emerald-900/30', shadow: 'shadow-[0_20px_50px_rgba(16,185,129,0.3)]', status: t.status.sync, icon: <CheckCircle2 className="w-4 h-4" /> };
    if (score >= 55) return { accent: 'text-amber-400', border: 'border-amber-500/30', bg: 'bg-amber-500/10', glow: 'from-amber-900/30', shadow: 'shadow-[0_20px_50px_rgba(245,158,11,0.3)]', status: t.status.discrepancy, icon: <Activity className="w-4 h-4" /> };
    return { accent: 'text-rose-400', border: 'border-rose-500/30', bg: 'bg-rose-500/10', glow: 'from-rose-900/30', shadow: 'shadow-[0_20px_50px_rgba(225,29,72,0.3)]', status: t.status.alert, icon: <GitBranch className="w-4 h-4" /> };
  };

  const theme = getTheme(metrics.score);
  const radius = 42; 
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (metrics.score / 100) * circumference;

  const renderTrend = (local: number | null | undefined, global: number | null | undefined, type: 'temp' | 'rain' | 'wind') => {
    if (local == null || global == null || local === global) return <MoveRight className="w-3.5 h-3.5 text-slate-600" />;
    const isUp = global > local;
    let iconClass = "w-3.5 h-3.5 ";
    if (type === 'temp') iconClass += isUp ? "text-rose-400" : "text-sky-400";
    else if (type === 'rain') iconClass += isUp ? "text-sky-400" : "text-slate-500";
    else iconClass += isUp ? "text-amber-400" : "text-emerald-400";
    return isUp ? <ArrowUpRight className={iconClass} /> : <ArrowDownRight className={iconClass} />;
  };

  const formatVal = (val: number | null | undefined) => val !== null && val !== undefined ? val : '--';
  const formatDelta = (val: number | null | undefined) => val !== null && val !== undefined ? val.toFixed(1) : '--';
  const formatTime = (iso: string) => new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  const openModal = (type: ModalType) => {
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

  // RENDERITZADOR DE LA MODAL AMB HUD DE BARRES (Data Bars In-Line)
  const renderModalContent = () => {
    if (!activeModal || hourlyTimes.length === 0) return <div className="text-slate-500 text-center py-10 font-mono text-xs">Sincronitzant matrius horàries...</div>;
    
    const locArr = hourlyLocal[activeModal] || [];
    const gloArr = hourlyGlobal[activeModal] || [];
    const unit = activeModal === 'temp' ? '°' : activeModal === 'rain' ? ' mm' : ' km/h';
    
    const now = new Date(); now.setMinutes(0, 0, 0);
    let startIndex = hourlyTimes.findIndex(t => new Date(t).getTime() >= now.getTime());
    if (startIndex === -1) startIndex = 0;
    const displayTimes = hourlyTimes.slice(startIndex, startIndex + 24);

    // 1. ESCÀNER MATEMÀTIC DE LÍMITS (Risc Zero)
    let minVal = Infinity;
    let maxVal = -Infinity;
    for (let i = 0; i < displayTimes.length; i++) {
      const realIndex = startIndex + i;
      const l = locArr[realIndex];
      const g = gloArr[realIndex];
      if (l != null) { if(l < minVal) minVal = l; if(l > maxVal) maxVal = l; }
      if (g != null) { if(g < minVal) minVal = g; if(g > maxVal) maxVal = g; }
    }
    
    // 2. AJUST DE LÍMITS PER FÍSICA ATMOSFÈRICA
    if (activeModal === 'rain' || activeModal === 'wind') {
       minVal = 0; // La pluja i el vent neixen a 0 absolut
       if (maxVal === 0) maxVal = 1; // Evitar la divisió per zero (NaN) si el dia és pla
    } else {
       if (maxVal === minVal) maxVal = minVal + 1; // Temperatura constant tot el dia
    }

    // Assignació del color de la matriu segons el giny
    const barColor = activeModal === 'temp' 
      ? 'from-rose-500/20 to-rose-400/5' 
      : activeModal === 'rain' 
        ? 'from-sky-500/20 to-sky-400/5' 
        : 'from-amber-500/20 to-amber-400/5';

    return (
      <div className="flex flex-col gap-2 max-h-[60vh] overflow-y-auto pr-2 custom-scrollbar">
        {displayTimes.map((time, i) => {
          const realIndex = startIndex + i;
          const locVal = locArr[realIndex];
          const gloVal = gloArr[realIndex];
          const diff = locVal != null && gloVal != null ? (gloVal - locVal).toFixed(1) : '--';
          const isNow = i === 0;

          // 3. CÀLCUL DEL PERCENTATGE DE LA BARRA (Fallback a model global si cau el local)
          const refVal = locVal ?? gloVal;
          let widthPct = 0;
          if (refVal != null) {
              widthPct = ((refVal - minVal) / (maxVal - minVal)) * 100;
              widthPct = Math.max(0, Math.min(100, widthPct)); // Assegurem topalls
          }

          return (
            <div key={i} className={`relative flex items-center justify-between bg-[#050810] border ${isNow ? 'border-sky-500/40 shadow-[inset_0_0_15px_rgba(14,165,233,0.15)]' : 'border-slate-800/50 hover:border-slate-600/50'} rounded-xl p-3 transition-colors overflow-hidden group`}>
              
              {/* HUD ESPACIAL DE L'OPCIÓ C (Barra de fons dinàmica) */}
              <div 
                 className={`absolute left-0 top-0 bottom-0 bg-gradient-to-r ${barColor} transition-all duration-1000 ease-out z-0`}
                 style={{ width: `${widthPct}%` }}
              />

              {/* CONTINGUT (Elevat a Z-10 per mantenir la lectura tàctica) */}
              <div className="flex flex-col items-center w-12 relative z-10">
                 {isNow && <span className="text-[7px] font-black text-sky-400 mb-0.5 tracking-widest">{t.now}</span>}
                 <span className={`${isNow ? 'text-sky-100 font-bold' : 'text-slate-400'} font-mono text-[10px]`}>{formatTime(time)}</span>
              </div>
              
              <div className="flex flex-1 items-center justify-around px-4 relative z-10">
                <div className="flex flex-col items-center">
                  <span className="text-[8px] text-slate-600 font-black tracking-widest">{t.local}</span>
                  <span className="text-white font-bold text-sm">{formatVal(locVal)}<span className="text-[9px] text-slate-500">{unit}</span></span>
                </div>
                <div className="h-6 w-px bg-slate-800"></div>
                <div className="flex flex-col items-center">
                  <span className="text-[8px] text-slate-600 font-black tracking-widest">{t.global}</span>
                  <span className="text-slate-300 font-bold text-sm">{formatVal(gloVal)}<span className="text-[9px] text-slate-500">{unit}</span></span>
                </div>
              </div>
              
              <div className={`w-14 rounded-lg py-1 flex justify-center items-center gap-1 border relative z-10 ${isNow ? 'bg-black/60 border-sky-900/50' : 'bg-[#030712]/80 border-slate-800/80 backdrop-blur-sm'}`}>
                <span className="text-[10px] font-black text-slate-200">{diff !== '--' && Number(diff) > 0 ? `+${diff}` : diff}</span>
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
      <div className="w-full relative perspective-[1200px]">
        <style>
          {`
            @keyframes spatial-float-active { 0%, 100% { transform: rotateX(2deg) rotateY(-1deg) translateY(0px); } 50% { transform: rotateX(-1deg) rotateY(1deg) translateY(-4px); } }
            @keyframes scanline { 0% { transform: translateY(-100%); } 100% { transform: translateY(100%); } }
            .preserve-3d { transform-style: preserve-3d; }
            .custom-scrollbar::-webkit-scrollbar { width: 4px; }
            .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
            .custom-scrollbar::-webkit-scrollbar-thumb { background: #1e293b; border-radius: 4px; }
          `}
        </style>

        {/* NOU: ${theme.shadow} s'injecta directament com a classe completa */}
        <div className={`w-full relative bg-[#030712]/90 backdrop-blur-xl border ${theme.border} rounded-[24px] ${theme.shadow} preserve-3d animate-[spatial-float-active_8s_ease-in-out_infinite]`}>
           <div className="absolute inset-0 overflow-hidden rounded-[24px]">
              <div className={`absolute inset-0 bg-[linear-gradient(currentColor_1px,transparent_1px),linear-gradient(90deg,currentColor_1px,transparent_1px)] bg-[size:24px_24px] opacity-[0.03] [transform:translateZ(-50px)] ${theme.accent}`}></div>
              <div className={`absolute inset-0 bg-gradient-to-br ${theme.glow} to-transparent opacity-60`}></div>
           </div>

           <div className="p-4 sm:p-6 flex flex-col gap-6 relative z-10 preserve-3d">
              <div className="flex justify-between items-center w-full [transform:translateZ(30px)]">
                 <div className="flex items-center gap-3">
                    <div className={`w-9 h-9 rounded-xl bg-[#050810] border ${theme.border} flex items-center justify-center shadow-[inset_0_0_15px_rgba(0,0,0,0.8)] relative overflow-hidden`}>
                       <Cpu className={`w-4 h-4 ${theme.accent} relative z-10`} />
                       <div className={`absolute inset-0 opacity-20 ${theme.bg} animate-pulse`}></div>
                    </div>
                    <div>
                       <h2 className="text-[11px] sm:text-xs font-black text-white uppercase tracking-[0.2em] drop-shadow-md">{t.title}</h2>
                       <div className="flex items-center gap-1.5 mt-0.5">
                          <span className="relative flex h-2 w-2">
                            <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-40 bg-current ${theme.accent}`}></span>
                            <span className={`relative inline-flex rounded-full h-2 w-2 bg-current ${theme.accent}`}></span>
                          </span>
                          <span className={`text-[9px] sm:text-[10px] font-bold uppercase tracking-widest ${theme.accent}`}>{theme.status}</span>
                       </div>
                    </div>
                 </div>

                 <div className="flex items-center gap-3 bg-[#050810]/50 px-3 py-1.5 rounded-2xl border border-slate-800/60 backdrop-blur-sm">
                    <div className="flex flex-col items-end">
                       <span className="text-[9px] sm:text-[10px] font-bold text-slate-500 uppercase tracking-widest">{t.affinity}</span>
                       <span className="text-xl sm:text-2xl font-black text-white leading-none tracking-tighter drop-shadow-lg">{metrics.score}<span className={`text-sm ml-0.5 ${theme.accent}`}>%</span></span>
                    </div>
                    <div className="relative flex items-center justify-center w-12 h-12 sm:w-14 sm:h-14">
                       <div className={`absolute inset-[-4px] border ${theme.border} rounded-full border-dashed animate-[spin_15s_linear_infinite]`}></div>
                       <svg className="absolute inset-0 w-full h-full transform -rotate-90 drop-shadow-[0_0_8px_currentColor]" viewBox="0 0 100 100">
                          <circle cx="50" cy="50" r={radius} className="stroke-slate-900" strokeWidth="8" fill="transparent" />
                          <circle cx="50" cy="50" r={radius} className={`${theme.accent} transition-all duration-1000 ease-out`} strokeWidth="8" fill="transparent" strokeLinecap="round" strokeDasharray={circumference} strokeDashoffset={strokeDashoffset} style={{ filter: 'drop-shadow(0 0 6px currentColor)' }} />
                       </svg>
                       <div className={`z-10 bg-[#030712] rounded-full p-1.5 shadow-[inset_0_0_15px_rgba(0,0,0,1)] border ${theme.border}`}>
                          {theme.icon}
                       </div>
                    </div>
                 </div>
              </div>

              <div className="grid grid-cols-3 gap-3 sm:gap-5 w-full preserve-3d [transform:translateZ(40px)]">
                 <div onClick={() => openModal('temp')} className="cursor-pointer group relative bg-[#0B0F19]/80 backdrop-blur-md transition-all duration-300 rounded-[20px] p-3 sm:p-4 border border-slate-800/80 flex flex-col items-center justify-between shadow-[0_10px_30px_rgba(0,0,0,0.5)] hover:border-slate-500/50 hover:-translate-y-1 active:translate-y-0">
                    <div className="absolute inset-0 rounded-[20px] bg-gradient-to-b from-white/[0.02] to-transparent pointer-events-none"></div>
                    <div className="flex items-center gap-1.5 text-slate-400 mb-2 sm:mb-3">
                        <Thermometer className="w-3.5 h-3.5 sm:w-4 sm:h-4 group-hover:text-rose-400 transition-colors" />
                        <span className="text-[9px] sm:text-[10px] font-black tracking-widest">{t.temp}</span>
                    </div>
                    <div className="flex flex-col items-center mb-4">
                        <div className="text-xl sm:text-3xl font-black text-white leading-none tracking-tighter drop-shadow-md">{formatVal(aromeTemp)}<span className="text-[10px] sm:text-xs text-slate-600 font-bold ml-0.5">°</span></div>
                        <div className="text-[9px] sm:text-[10px] font-medium text-slate-500 mt-1">WRF <span className="text-slate-300 font-bold">{formatVal(metrics.wrfTemp)}°</span></div>
                    </div>
                    <div className="w-full bg-[#030712] rounded-xl py-2 flex justify-center items-center gap-2 border border-slate-800/60 shadow-inner group-hover:border-slate-700 transition-colors">
                        <span className="text-[9px] text-slate-600 font-black">{t.diff}</span>
                        <div className="flex items-center gap-0.5 text-[10px] sm:text-[11px] font-black text-slate-200">{formatDelta(metrics.tempDiff)}° {renderTrend(aromeTemp, metrics.wrfTemp, 'temp')}</div>
                    </div>
                 </div>

                 <div onClick={() => openModal('rain')} className={`cursor-pointer group relative bg-[#0B0F19]/80 backdrop-blur-md transition-all duration-300 rounded-[20px] p-3 sm:p-4 border flex flex-col items-center justify-between shadow-[0_10px_30px_rgba(0,0,0,0.5)] hover:-translate-y-1 active:translate-y-0 ${isSnowRisk ? 'border-sky-900/50 hover:border-sky-500/50' : 'border-slate-800/80 hover:border-slate-500/50'}`}>
                    <div className="absolute inset-0 rounded-[20px] bg-gradient-to-b from-white/[0.02] to-transparent pointer-events-none"></div>
                    {isSnowRisk && <div className="absolute inset-0 bg-sky-500/5 rounded-[20px] animate-pulse pointer-events-none"></div>}
                    <div className={`flex items-center gap-1.5 mb-2 sm:mb-3 ${isSnowRisk ? 'text-sky-400 drop-shadow-[0_0_5px_currentColor]' : 'text-slate-400'}`}>
                        {isSnowRisk ? <CloudSnow className="w-3.5 h-3.5 sm:w-4 sm:h-4 group-hover:text-sky-300 transition-colors" /> : <CloudRain className="w-3.5 h-3.5 sm:w-4 sm:h-4 group-hover:text-sky-400 transition-colors" />}
                        <span className="text-[9px] sm:text-[10px] font-black tracking-widest">{isSnowRisk ? t.snow : t.rain}</span>
                    </div>
                    <div className="flex flex-col items-center mb-4">
                        <div className="flex items-baseline leading-none tracking-tighter drop-shadow-md"><span className="text-xl sm:text-3xl font-black text-white">{formatVal(aromePrecip)}</span><span className="text-[8px] sm:text-[10px] text-slate-600 font-bold ml-0.5">mm</span></div>
                        <div className="text-[9px] sm:text-[10px] font-medium text-slate-500 mt-1 flex items-baseline gap-1">WRF <span className="text-slate-300 font-bold">{formatVal(metrics.wrfPrecip)}<span className="text-[7px] font-normal text-slate-600 ml-[1px]">mm</span></span></div>
                    </div>
                    <div className="w-full bg-[#030712] rounded-xl py-2 flex justify-center items-center gap-2 border border-slate-800/60 shadow-inner group-hover:border-slate-700 transition-colors">
                        <span className="text-[9px] text-slate-600 font-black">{t.diff}</span>
                        <div className="flex items-center gap-0.5 text-[10px] sm:text-[11px] font-black text-slate-200">{formatDelta(metrics.precipDiff)} {renderTrend(aromePrecip, metrics.wrfPrecip, 'rain')}</div>
                    </div>
                 </div>

                 <div onClick={() => openModal('wind')} className="cursor-pointer group relative bg-[#0B0F19]/80 backdrop-blur-md transition-all duration-300 rounded-[20px] p-3 sm:p-4 border border-slate-800/80 flex flex-col items-center justify-between shadow-[0_10px_30px_rgba(0,0,0,0.5)] hover:border-amber-500/50 hover:-translate-y-1 active:translate-y-0">
                    <div className="absolute inset-0 rounded-[20px] bg-gradient-to-b from-white/[0.02] to-transparent pointer-events-none"></div>
                    <div className="flex items-center gap-1.5 text-slate-400 mb-2 sm:mb-3">
                        <Wind className="w-3.5 h-3.5 sm:w-4 sm:h-4 group-hover:text-amber-400 transition-colors" />
                        <span className="text-[9px] sm:text-[10px] font-black tracking-widest">{t.wind}</span>
                    </div>
                    <div className="flex flex-col items-center mb-4">
                        <div className="flex items-baseline leading-none tracking-tighter drop-shadow-md"><span className="text-xl sm:text-3xl font-black text-white">{formatVal(aromeWind)}</span><span className="text-[8px] sm:text-[10px] text-slate-600 font-bold ml-0.5">kmh</span></div>
                        <div className="text-[9px] sm:text-[10px] font-medium text-slate-500 mt-1 flex items-baseline gap-1">WRF <span className="text-slate-300 font-bold">{formatVal(metrics.wrfWind)}<span className="text-[7px] font-normal text-slate-600 ml-[1px]">km</span></span></div>
                    </div>
                    <div className="w-full bg-[#030712] rounded-xl py-2 flex justify-center items-center gap-2 border border-slate-800/60 shadow-inner group-hover:border-slate-700 transition-colors">
                        <span className="text-[9px] text-slate-600 font-black">{t.diff}</span>
                        <div className="flex items-center gap-0.5 text-[10px] sm:text-[11px] font-black text-slate-200">{formatDelta(metrics.windDiff)} {renderTrend(aromeWind, metrics.wrfWind, 'wind')}</div>
                    </div>
                 </div>
              </div>
           </div>
        </div>
      </div>

      {activeModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-[#030712]/80 backdrop-blur-xl animate-in fade-in duration-200">
          <div className="bg-[#0B0F19] border border-slate-700/50 rounded-3xl w-full max-w-sm shadow-[0_0_80px_rgba(0,0,0,0.9)] overflow-hidden flex flex-col transform scale-100 animate-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center p-5 border-b border-slate-800 bg-[#050810]">
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-xl bg-slate-800/50 border border-slate-700/50`}>
                    {activeModal === 'temp' && <Thermometer className="w-5 h-5 text-rose-400 drop-shadow-[0_0_5px_currentColor]" />}
                    {activeModal === 'rain' && <CloudRain className="w-5 h-5 text-sky-400 drop-shadow-[0_0_5px_currentColor]" />}
                    {activeModal === 'wind' && <Wind className="w-5 h-5 text-amber-400 drop-shadow-[0_0_5px_currentColor]" />}
                </div>
                <div>
                  <h3 className="text-white font-black uppercase tracking-widest text-sm drop-shadow-md">{t.modalTitle}</h3>
                  <p className="text-[9px] text-slate-500 font-mono tracking-widest">
                    {activeModal === 'temp' ? 'TEMPERATURA' : activeModal === 'rain' ? 'PLUJA / NEU' : 'VENT (10M)'}
                  </p>
                </div>
              </div>
              <button onClick={closeModal} className="w-9 h-9 rounded-full bg-[#030712] border border-slate-800 flex items-center justify-center hover:bg-slate-800 transition-colors text-slate-300 shadow-inner"><X className="w-4 h-4" /></button>
            </div>
            <div className="p-4 bg-[linear-gradient(rgba(255,255,255,0.01)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.01)_1px,transparent_1px)] bg-[size:20px_20px] bg-[#030712]">
              {renderModalContent()}
            </div>
          </div>
        </div>
      )}
    </>
  );
};