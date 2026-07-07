// src/components/widgets/ConsensusChartsModal.tsx
import React, { useId } from 'react';
import { Language } from '../../translations';
import { X, LineChart } from 'lucide-react';

interface ConsensusChartsModalProps {
  closeModal: () => void;
  lang: Language | string;
  utcOffset: number;
  nowTimestamp: number;
  hourlyTimes: string[];
  hourlyGlobalTimes: string[];
  hourlyLocal: { temp?: (number | null)[]; rain?: (number | null)[]; wind?: (number | null)[]; gusts?: (number | null)[] };
  hourlyGlobal: { temp?: (number | null)[]; rain?: (number | null)[]; wind?: (number | null)[]; gusts?: (number | null)[] };
}

// DICCIONARI i18n INTERN
const translations = {
  ca: {
    modalTitle: 'Telemetria Gràfica Avançada',
    subtitle: 'SÍNTESI WRF vs AROME / HARMONIE',
    sync: 'SINCRONITZANT MATRIUS VECTORS...',
    temp: 'Temperatura',
    rain: 'Precipitació',
    wind: 'Vent Sostingut (10m)',
    gusts: 'Ràfegues de Vent',
  },
  es: {
    modalTitle: 'Telemetría Gráfica Avanzada',
    subtitle: 'SÍNTESIS WRF vs AROME / HARMONIE',
    sync: 'SINCRONIZANDO MATRICES DE VECTORES...',
    temp: 'Temperatura',
    rain: 'Precipitación',
    wind: 'Viento Sostenido (10m)',
    gusts: 'Ráfagas de Viento',
  },
  en: {
    modalTitle: 'Advanced Graphical Telemetry',
    subtitle: 'WRF vs AROME / HARMONIE SYNTHESIS',
    sync: 'SYNCHRONIZING VECTOR MATRICES...',
    temp: 'Temperature',
    rain: 'Precipitation',
    wind: 'Sustained Wind (10m)',
    gusts: 'Wind Gusts',
  },
  fr: {
    modalTitle: 'Télémétrie Graphique Avancée',
    subtitle: 'SYNTHÈSE WRF vs AROME / HARMONIE',
    sync: 'SYNCHRONISATION DES MATRICES VECTORIELLES...',
    temp: 'Température',
    rain: 'Précipitations',
    wind: 'Vent Soutenu (10m)',
    gusts: 'Rafales de Vent',
  }
};

// DOCTRINA RISC ZERO & SPATIAL UI: Renderitzat SVG Segur i Ultra-Estètic
const TacticalSvgChart = ({
  title, unit, times, locData, gloData, type, locColorHex, gloColorHex
}: {
  title: string; unit: string; times: string[]; 
  locData: (number | null)[]; gloData: (number | null)[];
  type: 'line' | 'bar'; locColorHex: string; gloColorHex: string;
}) => {
  const chartW = 1000; 
  const chartH = 220; 
  const padX = 35; 
  const padY = 45; 
  const padBottom = 30; 
  const drawW = chartW - padX * 2;
  const drawH = chartH - padY - padBottom;
  
  const merged = [...locData, ...gloData].filter((v): v is number => typeof v === 'number' && !isNaN(v));
  let min = merged.length > 0 ? Math.min(...merged) : 0;
  let max = merged.length > 0 ? Math.max(...merged) : 1;
  
  if (min === max) max = min + 1;
  
  const isZeroBased = type === 'bar' || title.includes('VENT') || title.includes('Wind') || title.includes('Vent');
  if (isZeroBased && min > 0) min = 0;

  const renderMin = isZeroBased ? min : min - (max - min) * 0.15;
  const renderMax = max + (max - min) * 0.15;
  const xStep = times.length > 1 ? drawW / (times.length - 1) : 0;

  const getY = (val: number) => {
      return padY + drawH - ((val - renderMin) / (renderMax - renderMin)) * drawH;
  };

  const buildLinePath = (data: (number|null)[]) => {
     let path = '';
     let isFirst = true;
     for (let i = 0; i < times.length; i++) {
        const val = data[i];
        if (typeof val === 'number' && !isNaN(val)) {
           const x = padX + i * xStep;
           const y = getY(val);
           if (isFirst) { path += `M ${x.toFixed(1)},${y.toFixed(1)} `; isFirst = false; }
           else { path += `L ${x.toFixed(1)},${y.toFixed(1)} `; }
        } else {
           isFirst = true; 
        }
     }
     return path;
  };

  const buildAreaPath = (data: (number|null)[]) => {
     const line = buildLinePath(data);
     if (!line) return '';
     let firstIdx = -1, lastIdx = -1;
     for (let i = 0; i < times.length; i++) {
        const v = data[i];
        if (typeof v === 'number' && !isNaN(v)) {
           if (firstIdx === -1) firstIdx = i;
           lastIdx = i;
        }
     }
     if (firstIdx === -1) return '';
     const startX = padX + firstIdx * xStep;
     const endX = padX + lastIdx * xStep;
     const base = padY + drawH;
     return `${line} L ${endX.toFixed(1)},${base} L ${startX.toFixed(1)},${base} Z`;
  };

  const formatTimeStr = (tStr: string) => {
     try {
       if (tStr.includes('T') && !tStr.includes('Z')) return tStr.split('T')[1].substring(0, 5);
       return new Date(tStr).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
     } catch { return '--:--'; }
  };

  const baseId = useId().replace(/:/g, ''); 
  const gradLocId = `gradLoc-${baseId}`;
  const gradGloId = `gradGlo-${baseId}`;

  return (
     <div className="w-full shrink-0 bg-[#070b14] border border-white/10 rounded-[20px] p-4 sm:p-5 flex flex-col shadow-[0_15px_40px_rgba(0,0,0,0.6)] relative overflow-hidden group">
        
        {/* Fons Tàctic */}
        <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:16px_16px] opacity-20 pointer-events-none"></div>

        {/* Capçalera del Giny */}
        <div className="flex items-center justify-between mb-4 shrink-0 relative z-10">
           <div className="flex items-baseline gap-2">
               <span className="text-sm md:text-base font-black text-white uppercase tracking-widest">{title}</span>
               <span className="text-[10px] md:text-xs text-slate-500 font-bold">({unit})</span>
           </div>
           <div className="flex gap-3 md:gap-4 text-[9px] md:text-[10px] font-black tracking-widest uppercase bg-black/60 px-3 py-1.5 rounded-lg border border-white/5 backdrop-blur-md">
              <span className="flex items-center gap-1.5">
                  <div className="w-2.5 h-2.5 rounded-full shadow-[0_0_8px_currentColor]" style={{ backgroundColor: locColorHex, color: locColorHex }}></div>
                  <span className="text-slate-100 drop-shadow-md">LOC</span>
              </span>
              <span className="flex items-center gap-1.5">
                  <div className="w-2.5 h-2.5 border-2 border-dashed rounded-full" style={{ borderColor: gloColorHex }}></div>
                  <span className="text-slate-500">GLO</span>
              </span>
           </div>
        </div>
        
        {/* Contenidor Scrollable */}
        <div className="w-full overflow-x-auto overflow-y-hidden custom-scrollbar bg-[#020308] rounded-xl border border-white/5 relative z-10 shadow-inner">
           <div style={{ width: `${chartW}px`, height: `${chartH}px` }} className="relative shrink-0">
              <svg xmlns="http://www.w3.org/2000/svg" width={chartW} height={chartH} viewBox={`0 0 ${chartW} ${chartH}`} className="block absolute inset-0">
                 
                 <defs>
                    <linearGradient id={gradLocId} x1="0" y1="0" x2="0" y2="1">
                       <stop offset="0%" stopColor={locColorHex} stopOpacity="0.35" />
                       <stop offset="100%" stopColor={locColorHex} stopOpacity="0.0" />
                    </linearGradient>
                    <linearGradient id={gradGloId} x1="0" y1="0" x2="0" y2="1">
                       <stop offset="0%" stopColor={gloColorHex} stopOpacity="0.15" />
                       <stop offset="100%" stopColor={gloColorHex} stopOpacity="0.0" />
                    </linearGradient>
                 </defs>

                 {/* Eix Y (Línies Horitzontals) */}
                 {Array.from({ length: 4 }).map((_, i) => {
                    const y = padY + (drawH / 3) * i;
                    const val = renderMax - ((renderMax - renderMin) / 3) * i;
                    return (
                       <g key={`grid-h-${i}`}>
                          <line x1={padX} y1={y} x2={padX + drawW} y2={y} stroke="#ffffff" strokeOpacity="0.05" strokeDasharray="4 4" />
                          <text x={padX - 8} y={y + 4} fill="#475569" fontSize="11" fontWeight="bold" textAnchor="end" fontFamily="monospace">
                              {val.toFixed(isZeroBased ? 1 : 0)}
                          </text>
                       </g>
                    );
                 })}
                 
                 {/* Eix X (Temps Vertical) */}
                 {times.map((t, i) => {
                    const x = padX + i * xStep;
                    return (
                       <g key={`t-${i}`}>
                          <line x1={x} y1={padY} x2={x} y2={padY + drawH} stroke="#ffffff" strokeOpacity={i % 4 === 0 ? "0.1" : "0.03"} />
                          {i % 2 === 0 && (
                              <text x={x} y={chartH - 8} fill="#64748b" fontSize="11" fontWeight="bold" textAnchor="middle" fontFamily="monospace">
                                  {formatTimeStr(t)}
                              </text>
                          )}
                       </g>
                    )
                 })}

                 {/* Dibuix Gràfic */}
                 {type === 'line' ? (
                    <>
                       {/* -- MODEL GLOBAL (Fons) -- */}
                       <path d={buildAreaPath(gloData)} fill={`url(#${gradGloId})`} />
                       <path d={buildLinePath(gloData)} fill="none" stroke={gloColorHex} strokeWidth="2.5" strokeDasharray="5 5" strokeLinecap="round" strokeLinejoin="round" opacity="0.6" />
                       
                       {/* -- MODEL LOCAL (Primer Pla) -- */}
                       <path d={buildAreaPath(locData)} fill={`url(#${gradLocId})`} />
                       <path d={buildLinePath(locData)} fill="none" stroke={locColorHex} strokeWidth="8" strokeLinecap="round" strokeLinejoin="round" opacity="0.15" />
                       <path d={buildLinePath(locData)} fill="none" stroke={locColorHex} strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" opacity="0.4" />
                       <path d={buildLinePath(locData)} fill="none" stroke={locColorHex} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" opacity="1" />
                       
                       {/* Punts de Dades i Textos (Motor Anti-Col·lisió) */}
                       {times.map((_, i) => {
                          const valLoc = locData[i];
                          const valGlo = gloData[i];
                          
                          const isValidLoc = typeof valLoc === 'number' && !isNaN(valLoc);
                          const isValidGlo = typeof valGlo === 'number' && !isNaN(valGlo);
                          
                          if (!isValidLoc && !isValidGlo) return null;
                          const x = padX + i * xStep;
                          
                          // CORRECCIÓ ESLINT: Ús de const en lloc de let per les posicions base
                          const yLoc = isValidLoc ? getY(valLoc) : 0;
                          const yGlo = isValidGlo ? getY(valGlo) : 0;
                          
                          let locTextY = yLoc - 10;
                          let gloTextY = yGlo + 14;

                          // Algorisme Anti-Overlap
                          if (isValidLoc && isValidGlo && Math.abs(yLoc - yGlo) < 18) {
                              if (yLoc <= yGlo) { 
                                  locTextY = yLoc - 10;
                                  gloTextY = yGlo + 15;
                              } else { 
                                  locTextY = yLoc + 15;
                                  gloTextY = yGlo - 10;
                              }
                          }

                          return (
                             <g key={`nodes-${i}`}>
                                {isValidGlo && (
                                   <>
                                      <circle cx={x} cy={yGlo} r="3" fill="#020308" stroke={gloColorHex} strokeWidth="1.5" opacity="0.9" />
                                      <text x={x} y={gloTextY} fill={gloColorHex} fontSize="10" fontWeight="700" textAnchor="middle" fontFamily="monospace" style={{ textShadow: `0px 1px 3px rgba(0,0,0,1)` }}>
                                         {valGlo.toFixed(1)}
                                      </text>
                                   </>
                                )}
                                {isValidLoc && (
                                   <>
                                      <circle cx={x} cy={yLoc} r="5" fill="#000000" stroke={locColorHex} strokeWidth="1" opacity="0.5" />
                                      <circle cx={x} cy={yLoc} r="2.5" fill={locColorHex} />
                                      <text x={x} y={locTextY} fill="#ffffff" fontSize="11" fontWeight="900" textAnchor="middle" fontFamily="monospace" style={{ textShadow: `0px 2px 4px rgba(0,0,0,1)` }}>
                                         {valLoc.toFixed(1)}
                                      </text>
                                   </>
                                )}
                             </g>
                          );
                       })}
                    </>
                 ) : (
                    <g>
                       {/* -- GRÀFICA DE BARRES (Precipitació/Neu) -- */}
                       {times.map((_, i) => {
                          const valLoc = locData[i];
                          const valGlo = gloData[i];
                          const xBase = padX + i * xStep;
                          const yBase = padY + drawH; 
                          
                          const isValidGlo = typeof valGlo === 'number' && !isNaN(valGlo);
                          const yGlo = isValidGlo ? getY(valGlo) : yBase;
                          const hGlo = isValidGlo ? yBase - yGlo : 0;
                          
                          const isValidLoc = typeof valLoc === 'number' && !isNaN(valLoc);
                          const yLoc = isValidLoc ? getY(valLoc) : yBase;
                          const hLoc = isValidLoc ? yBase - yLoc : 0;

                          let locTextY = yLoc - 6;
                          let gloTextY = yGlo - 6;

                          if (isValidLoc && isValidGlo && Math.abs(yLoc - yGlo) < 16) {
                              if (valGlo > valLoc) {
                                  gloTextY = yGlo + 12; 
                                  locTextY = yLoc - 6;
                              } else {
                                  locTextY = yLoc - 6;
                                  gloTextY = yGlo + 12;
                              }
                          }

                          return (
                             <g key={`bar-${i}`}>
                                {isValidGlo && valGlo > 0 && (
                                    <>
                                       <rect x={xBase - 10} y={yGlo} width={20} height={hGlo} fill={gloColorHex} opacity="0.2" rx="4" />
                                       <text x={xBase} y={gloTextY} fill={gloColorHex} fontSize="9" fontWeight="800" textAnchor="middle" fontFamily="monospace" style={{ textShadow: `0px 1px 3px rgba(0,0,0,1)` }}>
                                          {valGlo.toFixed(1)}
                                       </text>
                                    </>
                                )}
                                {isValidLoc && valLoc > 0 && (
                                    <>
                                        <rect x={xBase - 6} y={yLoc} width={12} height={hLoc} fill={locColorHex} opacity="0.3" rx="4" />
                                        <rect x={xBase - 3} y={yLoc} width={6} height={hLoc} fill={locColorHex} rx="3" />
                                        <text x={xBase} y={locTextY} fill="#ffffff" fontSize="11" fontWeight="900" textAnchor="middle" fontFamily="monospace" style={{ textShadow: `0px 2px 4px rgba(0,0,0,1)` }}>
                                           {valLoc.toFixed(1)}
                                        </text>
                                    </>
                                )}
                             </g>
                          );
                       })}
                    </g>
                 )}
              </svg>
           </div>
        </div>
     </div>
  );
};

export const ConsensusChartsModal: React.FC<ConsensusChartsModalProps> = ({
  closeModal, lang, utcOffset, nowTimestamp,
  hourlyTimes, hourlyGlobalTimes, hourlyLocal, hourlyGlobal
}) => {
  const safeLang = lang in translations ? (lang as keyof typeof translations) : 'en';
  const t = translations[safeLang];

  const getAbsoluteEpoch = (timeStr: string) => {
    if (!timeStr) return NaN;
    if (timeStr.includes('Z') || timeStr.match(/[+-]\d{2}:?\d{2}$/)) return new Date(timeStr).getTime();
    return new Date(timeStr + 'Z').getTime() - (utcOffset * 1000);
  };

  const getMappedData = () => {
     let startIndex = hourlyTimes.findIndex(t => {
        const epoch = getAbsoluteEpoch(t);
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
        return displayTimes.map(time => dict.get(getAbsoluteEpoch(time)) ?? null);
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

  const data = getMappedData();

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-2 sm:p-4 bg-black/90 backdrop-blur-2xl animate-in fade-in duration-300">
      
      <div className="bg-[#05070e] border border-white/10 rounded-[28px] md:rounded-[32px] w-full max-w-6xl h-full max-h-[95vh] md:max-h-[85vh] shadow-[0_0_100px_rgba(0,0,0,1)] overflow-hidden flex flex-col transform animate-in zoom-in-95 slide-in-from-bottom-4 duration-300">
        
        {/* Capçalera */}
        <div className="flex justify-between items-center p-4 md:p-6 border-b border-white/10 bg-[#080b14] shrink-0 relative z-20 shadow-md">
          <div className="absolute inset-0 bg-gradient-to-r from-cyan-500/5 to-transparent pointer-events-none"></div>
          <div className="flex items-center gap-4 relative z-10">
            <div className="p-2.5 md:p-3 rounded-xl md:rounded-2xl bg-cyan-950/30 border border-cyan-500/30 shadow-inner">
                <LineChart className="w-5 h-5 md:w-7 md:h-7 text-cyan-400 drop-shadow-[0_0_8px_currentColor]" />
            </div>
            <div>
              <h3 className="text-white font-black uppercase tracking-[0.2em] text-[11px] sm:text-sm md:text-base drop-shadow-md">{t.modalTitle}</h3>
              <p className="text-[9px] md:text-xs text-slate-400 font-mono tracking-widest mt-0.5 md:mt-1">{t.subtitle}</p>
            </div>
          </div>
          <button onClick={closeModal} className="w-10 h-10 md:w-12 md:h-12 rounded-full bg-black/60 border border-white/10 flex items-center justify-center md:hover:bg-white/10 active:scale-95 transition-all duration-300 text-white relative z-10"><X className="w-5 h-5" /></button>
        </div>

        {/* Zona Scrollable de Gràfiques */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 md:p-8 relative bg-[#030409]">
          
          {hourlyTimes.length === 0 ? (
             <div className="flex items-center justify-center h-full">
                <div className="text-cyan-400 text-center font-mono text-xs animate-pulse tracking-widest border border-cyan-500/20 px-6 py-4 rounded-xl bg-cyan-950/20">
                   {t.sync}
                </div>
             </div>
          ) : (
             <div className="flex flex-col gap-6 md:gap-8 pb-10 max-w-full">
                <TacticalSvgChart title={t.temp} unit="°C" times={data.displayTimes} locData={data.tempLoc} gloData={data.tempGlo} type="line" locColorHex="#f43f5e" gloColorHex="#94a3b8" />
                <TacticalSvgChart title={t.rain} unit="mm" times={data.displayTimes} locData={data.rainLoc} gloData={data.rainGlo} type="bar" locColorHex="#38bdf8" gloColorHex="#94a3b8" />
                <TacticalSvgChart title={t.wind} unit="km/h" times={data.displayTimes} locData={data.windLoc} gloData={data.windGlo} type="line" locColorHex="#fbbf24" gloColorHex="#94a3b8" />
                <TacticalSvgChart title={t.gusts} unit="km/h" times={data.displayTimes} locData={data.gustsLoc} gloData={data.gustsGlo} type="line" locColorHex="#f97316" gloColorHex="#94a3b8" />
             </div>
          )}
        </div>

      </div>
    </div>
  );
};