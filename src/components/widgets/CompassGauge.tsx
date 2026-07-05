import { Wind, Zap } from 'lucide-react';
import { WidgetProps } from './widgetTypes';
import { WIDGET_BASE_STYLE, TITLE_STYLE } from './widgetStyles';
import { getTrans, getWindDirectionText, safeVal } from './widgetHelpers';

export const CompassGauge = ({ degrees, speed, gusts, lang }: WidgetProps) => {
  const t = getTrans(lang);
  const directionText = degrees != null ? getWindDirectionText(degrees) : '--';
  const displayDeg = safeVal(degrees);
  const displaySpeed = safeVal(speed);
  const displayGusts = safeVal(gusts);

  // Risc Zero: Assegurem que operem amb números reals
  const safeGusts = typeof gusts === 'number' ? gusts : 0;
  const safeSpeed = typeof speed === 'number' ? speed : 0;

  // Escala tàctica de ratxes de vent (adaptada a condicions de muntanya)
  const gustIntensity = safeGusts > 80 ? 'text-rose-500' : safeGusts > 50 ? 'text-amber-400' : 'text-indigo-300';
  const hasGusts = safeGusts > safeSpeed + 5; 

  // Dark Dashboard Spatial UI
  const SPATIAL_WIDGET_STYLE = `${WIDGET_BASE_STYLE} backdrop-blur-md bg-gradient-to-br from-black/60 to-[#0f111a]/80 border border-white/10 shadow-[0_8px_32px_rgba(0,0,0,0.5)] transform-gpu flex flex-col`;

  return (
    <div className={SPATIAL_WIDGET_STYLE}>
      <div className="flex justify-between items-start w-full z-10 p-1">
          <div className={`${TITLE_STYLE.replace('mb-4', 'mb-0')} flex items-center gap-1.5`}>
              <Wind className="w-4 h-4 text-indigo-400 drop-shadow-[0_0_8px_rgba(129,140,248,0.5)]" /> 
              <span className="tracking-wider">{t.wind || "VENT"}</span>
          </div>
          <div className="flex flex-col items-end bg-black/40 px-2.5 py-1 rounded-md border border-white/5 backdrop-blur-sm">
               <span className="text-[10px] font-black text-slate-300 uppercase tracking-widest">{displayDeg}° {directionText}</span>
          </div>
      </div>
      
      <div className="relative flex-1 flex flex-col items-center justify-center min-h-[140px] mt-4">
        <div className="relative w-40 h-40 flex items-center justify-center filter drop-shadow-xl">
             {/* Esfera exterior del compàs amb profunditat */}
             <div className="absolute inset-0 rounded-full border border-slate-700/50 bg-[#0f111a]/80 backdrop-blur-md shadow-[inset_0_4px_12px_rgba(0,0,0,0.8)]">
                {[...Array(12)].map((_, i) => (
                    <div key={i} 
                        className="absolute w-0.5 h-1.5 bg-slate-500/50 left-1/2 top-0 origin-bottom"
                        style={{ transform: `translateX(-50%) rotate(${i * 30}deg) translateY(6px)` }}
                    />
                ))}
                 <span className="absolute top-2 left-1/2 -translate-x-1/2 text-[10px] font-black text-slate-400">N</span>
                 <span className="absolute bottom-2 left-1/2 -translate-x-1/2 text-[10px] font-black text-slate-400">S</span>
                 <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[10px] font-black text-slate-400">W</span>
                 <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] font-black text-slate-400">E</span>
             </div>

             {/* Agulla dinàmica de direcció */}
             <div className="absolute w-full h-full flex items-center justify-center transition-transform duration-1000 cubic-bezier(0.34, 1.56, 0.64, 1)" style={{ transform: `rotate(${degrees ?? 0}deg)` }}>
                <div className="relative w-full h-full">
                    <div className="absolute top-3 left-1/2 -translate-x-1/2 w-0 h-0 border-l-[6px] border-l-transparent border-r-[6px] border-r-transparent border-b-[28px] border-b-indigo-400 filter drop-shadow-[0_0_8px_rgba(129,140,248,0.8)]"></div>
                    <div className="absolute bottom-3 left-1/2 -translate-x-1/2 w-1 h-4 bg-slate-600/60 rounded-full"></div>
                </div>
             </div>

             {/* Centre tàctic - Velocitat base */}
             <div className="absolute flex flex-col items-center justify-center z-10 bg-[#0f111a]/95 backdrop-blur-lg w-20 h-20 rounded-full border border-indigo-500/20 shadow-2xl ring-1 ring-white/10">
                <span className="text-3xl font-black text-white tabular-nums tracking-tighter leading-none drop-shadow-md">{displaySpeed}</span>
                <span className="text-[9px] text-indigo-300 font-bold uppercase tracking-widest opacity-90 mt-0.5">km/h</span>
                
                {/* Alerta de Ratxes (Nomenclatura Corregida) */}
                {hasGusts && (
                    <div className="absolute -bottom-7 flex items-center gap-1.5 px-2.5 py-1 bg-black/80 backdrop-blur-md rounded border border-white/10 shadow-[0_4px_12px_rgba(0,0,0,0.5)]">
                        <Zap className={`w-3 h-3 ${gustIntensity} animate-pulse`} />
                        <div className="flex flex-col items-start leading-none">
                            <span className={`text-[10px] font-mono font-black ${gustIntensity} tabular-nums tracking-tight`}>
                                {displayGusts} <span className="text-[7px] opacity-70">km/h</span>
                            </span>
                            <span className={`text-[6px] font-black uppercase tracking-widest ${gustIntensity} opacity-80 mt-0.5`}>
                                {lang === 'ca' ? 'Ratxes' : 'Gusts'}
                            </span>
                        </div>
                    </div>
                )}
             </div>
        </div>
      </div>
    </div>
  );
};