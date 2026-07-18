// src/components/widgets/ConsensusModal.tsx
import React from 'react';
import { Language } from '../../translations';
import { Thermometer, CloudRain, Wind, X, ArrowUpRight, ArrowDownRight, MoveRight } from 'lucide-react';
import { ModalType } from './ConsensusWidget';

interface ConsensusModalProps {
  activeModal: ModalType;
  closeModal: () => void;
  lang: Language | string;
  utcOffset: number;
  nowTimestamp: number;
  hourlyTimes: string[];
  hourlyGlobalTimes: string[];
  hourlyLocal: { temp?: (number | null)[]; rain?: (number | null)[]; wind?: (number | null)[]; gusts?: (number | null)[] };
  hourlyGlobal: { temp?: (number | null)[]; rain?: (number | null)[]; wind?: (number | null)[]; gusts?: (number | null)[] };
}

const translations = {
  ca: {
    modalTitle: 'Telemetria Horària',
    local: 'LOC', global: 'GLO', now: 'ARA',
    sync: 'Sincronitzant matrius horàries...',
    tempLabel: 'TEMPERATURA',
    rainLabel: 'PLUJA / NEU',
    windLabel: 'VENT (10M)'
  },
  es: {
    modalTitle: 'Telemetría Horaria',
    local: 'LOC', global: 'GLO', now: 'AHORA',
    sync: 'Sincronizando matrices horarias...',
    tempLabel: 'TEMPERATURA',
    rainLabel: 'LLUVIA / NIEVE',
    windLabel: 'VIENTO (10M)'
  },
  en: {
    modalTitle: 'Hourly Telemetry',
    local: 'LOC', global: 'GLO', now: 'NOW',
    sync: 'Synchronizing hourly matrices...',
    tempLabel: 'TEMPERATURE',
    rainLabel: 'RAIN / SNOW',
    windLabel: 'WIND (10M)'
  },
  fr: {
    modalTitle: 'Télémétrie Horaire',
    local: 'LOC', global: 'GLO', now: 'ACTUEL',
    sync: 'Synchronisation des matrices horaires...',
    tempLabel: 'TEMPÉRATURE',
    rainLabel: 'PLUIE / NEIGE',
    windLabel: 'VENT (10M)'
  }
};

export const ConsensusModal: React.FC<ConsensusModalProps> = ({
  activeModal, closeModal, lang, utcOffset, nowTimestamp,
  hourlyTimes, hourlyGlobalTimes, hourlyLocal, hourlyGlobal
}) => {
  const safeLang = lang in translations ? (lang as keyof typeof translations) : 'en';
  const t = translations[safeLang];

  const formatVal = (val: number | null | undefined) => typeof val === 'number' && !isNaN(val) ? val : '--';
  
  const getAbsoluteEpoch = (timeStr: string) => {
    if (!timeStr) return NaN;
    if (timeStr.includes('Z') || timeStr.match(/[+-]\d{2}:?\d{2}$/)) return new Date(timeStr).getTime();
    return new Date(timeStr + 'Z').getTime() - (utcOffset * 1000);
  };
  
  const formatTimeSafely = (timeStr: string) => {
    try {
      const parts = timeStr.split('T');
      if (parts.length === 2 && !timeStr.includes('Z')) return parts[1].substring(0, 5);
      const d = new Date(timeStr);
      if (isNaN(d.getTime())) return '--:--';
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch { return '--:--'; }
  };

  const renderTrend = (local: number | null | undefined, global: number | null | undefined, type: 'temp' | 'rain' | 'wind') => {
    if (typeof local !== 'number' || typeof global !== 'number' || local === global) return <MoveRight className="w-4 h-4 text-slate-500" />;
    const isUp = global > local;
    let iconClass = "w-4 h-4 transition-transform duration-300 ";
    if (type === 'temp') iconClass += isUp ? "text-rose-500" : "text-sky-400";
    else if (type === 'rain') iconClass += isUp ? "text-sky-400" : "text-slate-500";
    else iconClass += isUp ? "text-amber-400" : "text-emerald-400";
    return isUp ? <ArrowUpRight className={iconClass} /> : <ArrowDownRight className={iconClass} />;
  };

  const getMappedData = () => {
     let startIndex = hourlyTimes.findIndex(timeStr => {
        const epoch = getAbsoluteEpoch(timeStr);
        return !isNaN(epoch) && epoch >= nowTimestamp - (60 * 60 * 1000); 
     });
     if (startIndex === -1) startIndex = 0;
     const displayTimes = hourlyTimes.slice(startIndex, startIndex + 24);

     const mapGlobalArr = (arr: (number|null)[] = []) => {
        const dict = new Map<number, number | null>();
        arr.forEach((val, idx) => {
           const ep = getAbsoluteEpoch(hourlyGlobalTimes[idx]);
           if (!isNaN(ep)) dict.set(ep, val);
        });
        return displayTimes.map(timeStr => dict.get(getAbsoluteEpoch(timeStr)) ?? null);
     };

     const getAlignedLocal = (arr: (number|null|undefined)[] | undefined) => {
        if (!arr) return displayTimes.map(() => null);
        const sliced = arr.slice(startIndex, startIndex + 24);
        return displayTimes.map((_, i) => {
           const val = sliced[i];
           return (typeof val === 'number' && !isNaN(val)) ? val : null;
        });
     };

     return {
        displayTimes,
        tempLoc: getAlignedLocal(hourlyLocal.temp),
        tempGlo: mapGlobalArr(hourlyGlobal.temp),
        rainLoc: getAlignedLocal(hourlyLocal.rain),
        rainGlo: mapGlobalArr(hourlyGlobal.rain),
        windLoc: getAlignedLocal(hourlyLocal.wind),
        windGlo: mapGlobalArr(hourlyGlobal.wind),
        gustsLoc: getAlignedLocal(hourlyLocal.gusts),
        gustsGlo: mapGlobalArr(hourlyGlobal.gusts)
     };
  };

  const renderListContent = () => {
    if (hourlyTimes.length === 0) return <div className="text-slate-400 text-center py-12 font-mono text-[10px] sm:text-xs tracking-widest uppercase animate-pulse">{t.sync}</div>;
    const { displayTimes, ...mapped } = getMappedData();
    
    const locArr = activeModal === 'temp' ? mapped.tempLoc : activeModal === 'rain' ? mapped.rainLoc : mapped.windLoc;
    const gloArr = activeModal === 'temp' ? mapped.tempGlo : activeModal === 'rain' ? mapped.rainGlo : mapped.windGlo;
    const unit = activeModal === 'temp' ? '°' : activeModal === 'rain' ? 'mm' : 'km/h';
    
    let minVal = Infinity; let maxVal = -Infinity; let hasValidData = false;
    locArr.forEach(l => { if(typeof l === 'number' && !isNaN(l)) { if(l<minVal) minVal = l; if(l>maxVal) maxVal = l; hasValidData = true; } });
    gloArr.forEach(g => { if(typeof g === 'number' && !isNaN(g)) { if(g<minVal) minVal = g; if(g>maxVal) maxVal = g; hasValidData = true; } });
    
    if (!hasValidData) { minVal = 0; maxVal = 1; } 
    else {
      if (activeModal === 'rain' || activeModal === 'wind') { minVal = 0; if (maxVal === 0) maxVal = 1; } 
      else if (maxVal === minVal) { maxVal = minVal + 1; }
    }

    const barColor = activeModal === 'temp' ? 'from-rose-500/20 to-rose-400/5' : activeModal === 'rain' ? 'from-sky-500/20 to-sky-400/5' : 'from-amber-500/20 to-amber-400/5';

    return (
      <div className="flex flex-col gap-3 max-h-[60vh] sm:max-h-[65vh] md:max-h-[70vh] overflow-y-auto pr-1 sm:pr-2 pb-4 custom-scrollbar">
        {displayTimes.map((timeKey, i) => {
          const locVal = locArr[i];
          const gloVal = gloArr[i];
          const locGustVal = mapped.gustsLoc[i];
          const gloGustVal = mapped.gustsGlo[i];
          
          const isValidLoc = typeof locVal === 'number' && !isNaN(locVal);
          const isValidGlo = typeof gloVal === 'number' && !isNaN(gloVal);
          const diff = (isValidLoc && isValidGlo) ? (gloVal - locVal).toFixed(1) : '--';
          const isNow = i === 0;

          const refVal = isValidLoc ? locVal : (isValidGlo ? gloVal : null);
          let widthPct = 0;
          if (refVal !== null && maxVal > minVal) {
              widthPct = ((refVal - minVal) / (maxVal - minVal)) * 100;
              widthPct = Math.max(0, Math.min(100, widthPct)); 
          }

          const diffBadge = (
            <div className={`px-2 py-1.5 sm:px-3 sm:py-2 rounded-xl flex items-center justify-center gap-1 sm:gap-1.5 border backdrop-blur-md shadow-sm ${isNow ? 'bg-black/80 border-sky-500/30 shadow-[inset_0_0_8px_rgba(14,165,233,0.3)]' : 'bg-black/40 border-slate-700/50 group-hover:border-slate-500/60'} transition-colors`}>
              <span className="text-xs sm:text-sm font-black text-white leading-none font-mono drop-shadow-md">
                {diff !== '--' && Number(diff) > 0 ? `+${diff}` : diff}
              </span>
              {renderTrend(locVal, gloVal, activeModal as 'temp' | 'rain' | 'wind')}
            </div>
          );

          return (
            <div key={`list-${i}`} className={`shrink-0 relative flex flex-col sm:flex-row sm:items-center w-full bg-[#0a0f1c]/80 border ${isNow ? 'border-sky-500/40 shadow-[0_0_20px_rgba(14,165,233,0.2)] z-10' : 'border-white/5 hover:border-white/10 hover:bg-[#0f1424]/90'} rounded-2xl p-4 sm:p-4 gap-3 sm:gap-0 transition-all duration-300 overflow-hidden group backdrop-blur-sm`}>
              <div className={`absolute left-0 top-0 bottom-0 bg-gradient-to-r ${barColor} transition-all duration-1000 ease-out z-0 opacity-80`} style={{ width: `${widthPct}%` }} />

              <div className="relative z-10 flex w-full sm:w-24 items-center justify-between sm:justify-start shrink-0">
                <div className="flex flex-col justify-center">
                   {isNow && <span className="text-[10px] font-black text-sky-400 tracking-widest leading-none mb-1 drop-shadow-[0_0_5px_currentColor]">{t.now}</span>}
                   <span className={`${isNow ? 'text-white font-black drop-shadow-md' : 'text-slate-300 font-bold'} font-mono text-sm md:text-base leading-none`}>{formatTimeSafely(timeKey)}</span>
                </div>
                <div className="sm:hidden">{diffBadge}</div>
              </div>
              
              <div className="relative z-10 flex-1 grid grid-cols-2 gap-3 sm:flex sm:grid-cols-none sm:items-center sm:justify-center sm:gap-8 w-full">
                <div className="flex flex-col items-start sm:items-end bg-black/30 sm:bg-transparent border border-white/5 sm:border-0 rounded-xl p-2.5 sm:p-0 backdrop-blur-sm sm:backdrop-blur-none shadow-inner sm:shadow-none">
                  <span className="text-[10px] text-slate-500 font-black tracking-widest mb-1 sm:mb-0.5">{t.local}</span>
                  <span className="text-base sm:text-lg md:text-xl font-black text-white leading-none tracking-tighter drop-shadow-md">
                    {formatVal(locVal)}<span className="text-[10px] text-slate-400 ml-0.5 font-bold uppercase">{unit}</span>
                  </span>
                  {activeModal === 'wind' && (
                    <span className="text-[10px] text-amber-400 font-mono mt-1 font-black flex items-center gap-0.5 drop-shadow-[0_0_4px_rgba(245,158,11,0.4)] animate-pulse">
                      ⚡ {formatVal(locGustVal)}<span className="text-[8px] text-amber-500/70 font-bold uppercase">kmh</span>
                    </span>
                  )}
                </div>
                
                <div className="hidden sm:block w-px h-8 bg-gradient-to-b from-transparent via-slate-500/50 to-transparent"></div>
                
                <div className="flex flex-col items-start bg-black/30 sm:bg-transparent border border-white/5 sm:border-0 rounded-xl p-2.5 sm:p-0 backdrop-blur-sm sm:backdrop-blur-none shadow-inner sm:shadow-none">
                  <span className="text-[10px] text-slate-500 font-black tracking-widest mb-1 sm:mb-0.5">{t.global}</span>
                  <span className="text-base sm:text-lg md:text-xl font-black text-slate-400 leading-none tracking-tighter">
                    {formatVal(gloVal)}<span className="text-[10px] text-slate-600 ml-0.5 font-bold uppercase">{unit}</span>
                  </span>
                  {activeModal === 'wind' && (
                    <span className="text-[10px] text-slate-500 font-mono mt-1 font-bold flex items-center gap-0.5">
                      ⚡ {formatVal(gloGustVal)}<span className="text-[8px] text-slate-600/70 font-bold uppercase">kmh</span>
                    </span>
                  )}
                </div>
              </div>
              
              <div className="hidden sm:flex shrink-0 justify-end relative z-10 w-24">{diffBadge}</div>
            </div>
          );
        })}
      </div>
    );
  };

  if (activeModal === 'charts') return null; 

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-2xl backdrop-saturate-150 animate-in fade-in duration-300">
      <div className="bg-[#080b14] border border-white/10 rounded-[28px] md:rounded-[32px] w-[96%] sm:max-w-md md:max-w-3xl lg:max-w-4xl shadow-[0_0_80px_rgba(0,0,0,1)] overflow-hidden flex flex-col transform animate-in zoom-in-95 slide-in-from-bottom-4 duration-300">
        <div className="flex justify-between items-center p-4 sm:p-5 md:p-6 border-b border-white/5 bg-[#0a0f1c]/90 backdrop-blur-md relative z-10">
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/[0.02] to-transparent pointer-events-none"></div>
          <div className="flex items-center gap-3 sm:gap-4">
            <div className="p-2.5 sm:p-3 rounded-2xl bg-black/50 border border-white/5 shadow-inner">
                {activeModal === 'temp' && <Thermometer className="w-5 h-5 sm:w-6 sm:h-6 md:w-7 md:h-7 text-rose-500 drop-shadow-[0_0_8px_currentColor]" />}
                {activeModal === 'rain' && <CloudRain className="w-5 h-5 sm:w-6 sm:h-6 md:w-7 md:h-7 text-sky-400 drop-shadow-[0_0_8px_currentColor]" />}
                {activeModal === 'wind' && <Wind className="w-5 h-5 sm:w-6 sm:h-6 md:w-7 md:h-7 text-amber-400 drop-shadow-[0_0_8px_currentColor]" />}
            </div>
            <div>
              <h3 className="text-white font-black uppercase tracking-[0.2em] text-xs sm:text-sm md:text-base drop-shadow-md">{t.modalTitle}</h3>
              <p className="text-[9px] sm:text-[10px] md:text-xs text-slate-400 font-mono tracking-widest mt-0.5">
                {activeModal === 'temp' ? t.tempLabel : activeModal === 'rain' ? t.rainLabel : t.windLabel}
              </p>
            </div>
          </div>
          <button onClick={closeModal} className="w-9 h-9 sm:w-10 sm:h-10 md:w-12 md:h-12 rounded-full bg-black/60 border border-white/10 flex items-center justify-center md:hover:bg-white/10 md:hover:scale-105 active:scale-95 transition-all duration-300 text-white shadow-inner"><X className="w-4 h-4 sm:w-5 sm:h-5" /></button>
        </div>
        <div className="p-3 sm:p-4 md:p-6 bg-[linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:24px_24px] md:bg-[size:32px_32px] bg-[#060913] relative">
          <div className="absolute inset-0 bg-gradient-to-b from-[#0a0f1c]/80 to-transparent pointer-events-none"></div>
          {renderListContent()}
        </div>
      </div>
    </div>
  );
};