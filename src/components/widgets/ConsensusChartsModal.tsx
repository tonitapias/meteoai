// src/components/widgets/ConsensusChartsModal.tsx
import React, { useId, useState } from 'react';
import { Language } from '../../translations';
import { X, LineChart } from 'lucide-react';
import { getMappedConsensusSeries, HourlySeriesBundle } from '../../utils/consensusMath';

interface ConsensusChartsModalProps {
  closeModal: () => void;
  lang: Language | string;
  utcOffset: number;
  nowTimestamp: number;
  hourlyTimes: string[];
  hourlyGlobalTimes: string[];
  regionalModelLabel: string;
  hourlyLocal: HourlySeriesBundle;
  hourlyGlobal: HourlySeriesBundle;
  hourlyEcmwf: HourlySeriesBundle;
  hourlyGfs: HourlySeriesBundle;
  hourlyIcon: HourlySeriesBundle;
  hourlyAifs: HourlySeriesBundle;
}

// Paleta fixa per a les sèries de referència (constant en tots els gràfics i
// idiomes); el model regional actiu (LOC) fa servir el color propi de cada
// mètrica (definit a la crida de cada <TacticalSvgChart>), com ja passava
// abans amb 2 sèries.
const SERIES_COLORS = {
  glo: '#94a3b8',
  ecmwf: '#a78bfa',
  gfs: '#22d3ee',
  icon: '#4ade80',
  aifs: '#facc15'
} as const;

// DICCIONARI i18n INTERN
const translations = {
  ca: {
    modalTitle: 'Telemetria Gràfica Avançada',
    subtitle: 'SÍNTESI MULTIMODEL',
    sync: 'SINCRONITZANT MATRIUS VECTORS...',
    temp: 'Temperatura',
    rain: 'Precipitació',
    wind: 'Vent Sostingut (10m)',
    gusts: 'Ràfegues de Vent',
  },
  es: {
    modalTitle: 'Telemetría Gráfica Avanzada',
    subtitle: 'SÍNTESIS MULTIMODELO',
    sync: 'SINCRONIZANDO MATRICES DE VECTORES...',
    temp: 'Temperatura',
    rain: 'Precipitación',
    wind: 'Viento Sostenido (10m)',
    gusts: 'Ráfagas de Viento',
  },
  en: {
    modalTitle: 'Advanced Graphical Telemetry',
    subtitle: 'MULTI-MODEL SYNTHESIS',
    sync: 'SYNCHRONIZING VECTOR MATRICES...',
    temp: 'Temperature',
    rain: 'Precipitation',
    wind: 'Sustained Wind (10m)',
    gusts: 'Wind Gusts',
  },
  fr: {
    modalTitle: 'Télémétrie Graphique Avancée',
    subtitle: 'SYNTHÈSE MULTI-MODÈLES',
    sync: 'SYNCHRONISATION DES MATRICES VECTORIELLES...',
    temp: 'Température',
    rain: 'Précipitations',
    wind: 'Vent Soutenu (10m)',
    gusts: 'Rafales de Vent',
  }
};

interface ChartSeriesInput {
  id: string;
  label: string;
  data: (number | null)[];
  colorHex: string;
}

// DOCTRINA RISC ZERO & SPATIAL UI: Renderitzat SVG Segur i Ultra-Estètic
// [NETEJA] Generalitzat de 2 sèries fixes (Loc/Glo) a N: `series[0]` és
// sempre la sèrie primària (el model regional actiu) i rep el tractament
// complet (àrea, línia gruixuda, punts amb etiqueta numèrica); la resta
// ('series.slice(1)': GLO/ECMWF/AIFS/GFS/ICON) es dibuixen com a línies fines
// de referència sense etiquetes per evitar el caos de N textos superposats.
const TacticalSvgChart = ({
  title, unit, times, series, type, zeroBased = false
}: {
  title: string; unit: string; times: string[];
  series: ChartSeriesInput[];
  type: 'line' | 'bar'; zeroBased?: boolean;
}) => {
  const chartW = 1000;
  const chartH = 220;
  const padX = 35;
  const padY = 45;
  const padBottom = 30;
  const drawW = chartW - padX * 2;
  const drawH = chartH - padY - padBottom;

  const primary = series[0];
  const secondary = series.slice(1);

  // TOOLTIP INTERACTIU: amb 6 sèries, llegir el valor exacte d'una en concret
  // directament del gràfic és difícil (línies fines superposades). En lloc de
  // redissenyar les línies, es mostren tots els valors d'una hora concreta a
  // demanda en passar-hi el ratolí (o tocant-hi al mòbil, sense arrossegar per
  // no interferir amb el scroll horitzontal natiu del contenidor).
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);

  const indexFromClientX = (clientX: number, target: SVGSVGElement): number | null => {
    if (xStep <= 0) return null;
    const rect = target.getBoundingClientRect();
    if (rect.width === 0) return null;
    const scaleX = chartW / rect.width;
    const localX = (clientX - rect.left) * scaleX;
    const idx = Math.round((localX - padX) / xStep);
    return Math.max(0, Math.min(times.length - 1, idx));
  };

  const merged = series.flatMap(s => s.data).filter((v): v is number => typeof v === 'number' && !isNaN(v));
  let min = merged.length > 0 ? Math.min(...merged) : 0;
  let max = merged.length > 0 ? Math.max(...merged) : 1;

  if (min === max) max = min + 1;
  
  // [FIX PRECISIÓ] Abans es detectava "és un gràfic de vent?" mirant si el títol ja
  // traduït contenia "VENT"/"Wind"/"Vent" — en castellà "Viento" no conté "Vent" com a
  // subcadena, així que els gràfics de vent/ràfegues en castellà no començaven mai a
  // zero. Ara es passa un booleà explícit, independent de l'idioma.
  const isZeroBased = type === 'bar' || zeroBased;
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
  const gradPrimaryId = `gradPrimary-${baseId}`;

  return (
     <div className="w-full shrink-0 bg-[#070b14] border border-white/10 rounded-[20px] p-4 sm:p-5 flex flex-col shadow-[0_15px_40px_rgba(0,0,0,0.6)] relative overflow-hidden group">

        {/* Fons Tàctic */}
        <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:16px_16px] opacity-20 pointer-events-none"></div>

        {/* Capçalera del Giny */}
        <div className="flex items-center justify-between flex-wrap gap-2 mb-4 shrink-0 relative z-10">
           <div className="flex items-baseline gap-2">
               <span className="text-sm md:text-base font-black text-white uppercase tracking-widest">{title}</span>
               <span className="text-[10px] md:text-xs text-slate-500 font-bold">({unit})</span>
           </div>
           <div className="flex flex-wrap gap-2 md:gap-3 text-[9px] md:text-[10px] font-black tracking-widest uppercase bg-black/60 px-3 py-1.5 rounded-lg border border-white/5 backdrop-blur-md">
              {series.map((s, idx) => (
                 <span key={s.id} className="flex items-center gap-1.5">
                     <div className="w-2.5 h-2.5 rounded-full shadow-[0_0_8px_currentColor]" style={{ backgroundColor: s.colorHex, color: s.colorHex }}></div>
                     <span className={idx === 0 ? 'text-slate-100 drop-shadow-md' : 'text-slate-500'}>{s.label}</span>
                 </span>
              ))}
           </div>
        </div>

        {/* Contenidor Scrollable */}
        <div className="w-full overflow-x-auto overflow-y-hidden custom-scrollbar bg-[#020308] rounded-xl border border-white/5 relative z-10 shadow-inner">
           <div style={{ width: `${chartW}px`, height: `${chartH}px` }} className="relative shrink-0">
              <svg xmlns="http://www.w3.org/2000/svg" width={chartW} height={chartH} viewBox={`0 0 ${chartW} ${chartH}`} className="block absolute inset-0 cursor-crosshair"
                 onMouseMove={(e) => setHoverIndex(indexFromClientX(e.clientX, e.currentTarget))}
                 onMouseLeave={() => setHoverIndex(null)}
                 onTouchStart={(e) => {
                    const touch = e.touches[0];
                    if (touch) setHoverIndex(indexFromClientX(touch.clientX, e.currentTarget));
                 }}
              >

                 <defs>
                    <linearGradient id={gradPrimaryId} x1="0" y1="0" x2="0" y2="1">
                       <stop offset="0%" stopColor={primary?.colorHex} stopOpacity="0.35" />
                       <stop offset="100%" stopColor={primary?.colorHex} stopOpacity="0.0" />
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
                       {/* -- SÈRIES SECUNDÀRIES (Fons, línies fines de referència) -- */}
                       {secondary.map(s => (
                          <path key={`line-${s.id}`} d={buildLinePath(s.data)} fill="none" stroke={s.colorHex} strokeWidth="2.5" strokeDasharray="5 5" strokeLinecap="round" strokeLinejoin="round" opacity="0.6" />
                       ))}

                       {/* -- MODEL REGIONAL ACTIU (Primer Pla) -- */}
                       {primary && (
                          <>
                             <path d={buildAreaPath(primary.data)} fill={`url(#${gradPrimaryId})`} />
                             <path d={buildLinePath(primary.data)} fill="none" stroke={primary.colorHex} strokeWidth="8" strokeLinecap="round" strokeLinejoin="round" opacity="0.15" />
                             <path d={buildLinePath(primary.data)} fill="none" stroke={primary.colorHex} strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" opacity="0.4" />
                             <path d={buildLinePath(primary.data)} fill="none" stroke={primary.colorHex} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" opacity="1" />
                          </>
                       )}

                       {/* Punts i etiqueta numèrica: només per a la sèrie primària (amb N sèries,
                           etiquetar-les totes seria il·legible; les secundàries només es llegeixen
                           per la seva posició relativa a la línia primària, com un meteograma real). */}
                       {primary && times.map((_, i) => {
                          const val = primary.data[i];
                          const isValid = typeof val === 'number' && !isNaN(val);
                          if (!isValid) return null;
                          const x = padX + i * xStep;
                          const y = getY(val);

                          return (
                             <g key={`nodes-${i}`}>
                                <circle cx={x} cy={y} r="5" fill="#000000" stroke={primary.colorHex} strokeWidth="1" opacity="0.5" />
                                <circle cx={x} cy={y} r="2.5" fill={primary.colorHex} />
                                <text x={x} y={y - 10} fill="#ffffff" fontSize="11" fontWeight="900" textAnchor="middle" fontFamily="monospace" style={{ textShadow: `0px 2px 4px rgba(0,0,0,1)` }}>
                                   {val.toFixed(1)}
                                </text>
                             </g>
                          );
                       })}
                    </>
                 ) : (
                    <g>
                       {/* -- GRÀFICA DE BARRES (Precipitació/Neu): barra només per a la sèrie
                           primària; les secundàries com a punts petits sobre la mateixa escala -- */}
                       {times.map((_, i) => {
                          const xBase = padX + i * xStep;
                          const yBase = padY + drawH;

                          const valPrimary = primary?.data[i];
                          const isValidPrimary = typeof valPrimary === 'number' && !isNaN(valPrimary);
                          const yPrimary = isValidPrimary ? getY(valPrimary as number) : yBase;
                          const hPrimary = isValidPrimary ? yBase - yPrimary : 0;

                          return (
                             <g key={`bar-${i}`}>
                                {isValidPrimary && (valPrimary as number) > 0 && primary && (
                                    <>
                                        <rect x={xBase - 6} y={yPrimary} width={12} height={hPrimary} fill={primary.colorHex} opacity="0.3" rx="4" />
                                        <rect x={xBase - 3} y={yPrimary} width={6} height={hPrimary} fill={primary.colorHex} rx="3" />
                                        <text x={xBase} y={yPrimary - 6} fill="#ffffff" fontSize="11" fontWeight="900" textAnchor="middle" fontFamily="monospace" style={{ textShadow: `0px 2px 4px rgba(0,0,0,1)` }}>
                                           {(valPrimary as number).toFixed(1)}
                                        </text>
                                    </>
                                )}
                                {secondary.map(s => {
                                   const v = s.data[i];
                                   if (typeof v !== 'number' || isNaN(v) || v <= 0) return null;
                                   return <circle key={`dot-${s.id}-${i}`} cx={xBase} cy={getY(v)} r="2.5" fill={s.colorHex} opacity="0.85" />;
                                })}
                             </g>
                          );
                       })}
                    </g>
                 )}

                 {/* CROSSHAIR + TOOLTIP: valors de les 6 sèries a l'hora sobre la qual
                     es passa el ratolí (o es toca al mòbil), perquè no calgui desxifrar-los
                     directament de línies fines superposades. */}
                 {hoverIndex !== null && (() => {
                    const hx = padX + hoverIndex * xStep;
                    const rows = series.map(s => ({ s, val: s.data[hoverIndex] }));
                    const tooltipW = 168;
                    const tooltipH = 22 + rows.length * 16;
                    const flip = hx + 14 + tooltipW > chartW - 4;
                    const tipX = flip ? hx - 14 - tooltipW : hx + 14;
                    const tipY = padY;

                    return (
                       <g pointerEvents="none">
                          <line x1={hx} y1={padY} x2={hx} y2={padY + drawH} stroke="#ffffff" strokeOpacity="0.35" strokeWidth="1.5" strokeDasharray="3 3" />

                          {series.map(s => {
                             const val = s.data[hoverIndex];
                             if (typeof val !== 'number' || isNaN(val)) return null;
                             return <circle key={`hover-dot-${s.id}`} cx={hx} cy={getY(val)} r={s.id === primary?.id ? 5 : 3.5} fill={s.colorHex} stroke="#000000" strokeOpacity="0.5" strokeWidth="1" />;
                          })}

                          <rect x={tipX} y={tipY} width={tooltipW} height={tooltipH} rx="8" fill="#05070e" fillOpacity="0.94" stroke="#ffffff" strokeOpacity="0.15" />
                          <text x={tipX + 10} y={tipY + 15} fill="#94a3b8" fontSize="10" fontWeight="bold" fontFamily="monospace">
                             {formatTimeStr(times[hoverIndex])}
                          </text>
                          {rows.map((r, i) => {
                             const rowY = tipY + 15 + (i + 1) * 16;
                             const displayVal = typeof r.val === 'number' && !isNaN(r.val) ? `${r.val.toFixed(1)} ${unit}` : '—';
                             return (
                                <g key={`tip-row-${r.s.id}`}>
                                   <circle cx={tipX + 12} cy={rowY - 4} r="3.5" fill={r.s.colorHex} />
                                   <text x={tipX + 22} y={rowY} fill="#e2e8f0" fontSize="10" fontWeight="bold" fontFamily="monospace">{r.s.label}</text>
                                   <text x={tipX + tooltipW - 10} y={rowY} fill="#ffffff" fontSize="10" fontWeight="900" fontFamily="monospace" textAnchor="end">{displayVal}</text>
                                </g>
                             );
                          })}
                       </g>
                    );
                 })()}
              </svg>
           </div>
        </div>
     </div>
  );
};

export const ConsensusChartsModal: React.FC<ConsensusChartsModalProps> = ({
  closeModal, lang, utcOffset, nowTimestamp,
  hourlyTimes, hourlyGlobalTimes, regionalModelLabel,
  hourlyLocal, hourlyGlobal, hourlyEcmwf, hourlyGfs, hourlyIcon, hourlyAifs
}) => {
  const safeLang = lang in translations ? (lang as keyof typeof translations) : 'en';
  const t = translations[safeLang];

  const { displayTimes, series } = getMappedConsensusSeries(
    hourlyTimes,
    [
      { id: 'loc', label: regionalModelLabel, data: hourlyLocal },
      { id: 'ecmwf', label: 'ECMWF', data: hourlyEcmwf },
      { id: 'aifs', label: 'AIFS', data: hourlyAifs },
      { id: 'gfs', label: 'GFS', data: hourlyGfs },
      { id: 'icon', label: 'ICON', data: hourlyIcon }
    ],
    [{ id: 'glo', label: 'GLOBAL', times: hourlyGlobalTimes, data: hourlyGlobal }],
    utcOffset,
    nowTimestamp
  );

  const seriesFor = (field: 'temp' | 'rain' | 'wind' | 'gusts', colors: Record<string, string>): ChartSeriesInput[] =>
    series.map(s => ({ id: s.id, label: s.label, data: s[field], colorHex: colors[s.id] ?? SERIES_COLORS.glo }));

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
                <TacticalSvgChart title={t.temp} unit="°C" times={displayTimes} type="line" series={seriesFor('temp', { loc: '#f43f5e', ...SERIES_COLORS })} />
                <TacticalSvgChart title={t.rain} unit="mm" times={displayTimes} type="bar" series={seriesFor('rain', { loc: '#38bdf8', ...SERIES_COLORS })} />
                <TacticalSvgChart title={t.wind} unit="km/h" times={displayTimes} type="line" zeroBased series={seriesFor('wind', { loc: '#fbbf24', ...SERIES_COLORS })} />
                <TacticalSvgChart title={t.gusts} unit="km/h" times={displayTimes} type="line" zeroBased series={seriesFor('gusts', { loc: '#f97316', ...SERIES_COLORS })} />
             </div>
          )}
        </div>

      </div>
    </div>
  );
};