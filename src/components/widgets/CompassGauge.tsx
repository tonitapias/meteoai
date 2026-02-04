import React from 'react';
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

  const gustIntensity = (gusts || 0) > 60 ? 'text-rose-400' : (gusts || 0) > 40 ? 'text-amber-400' : 'text-slate-400';
  const hasGusts = gusts && gusts > (speed || 0) + 5; 

  return (
    <div className={WIDGET_BASE_STYLE}>
      <div className="flex justify-between items-start w-full z-10">
          <div className={TITLE_STYLE.replace('mb-4', 'mb-0')}>
              <Wind className="w-3.5 h-3.5 text-indigo-400" /> {t.wind || "VENT"}
          </div>
          <div className="flex flex-col items-end">
               <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">{displayDeg}° {directionText}</span>
          </div>
      </div>
      
      <div className="relative flex-1 flex flex-col items-center justify-center min-h-[140px] mt-2">
        <div className="relative w-40 h-40 flex items-center justify-center">
             <div className="absolute inset-0 rounded-full border border-slate-700/30 bg-[#0f111a] shadow-inner">
                {[...Array(12)].map((_, i) => (
                    <div key={i} 
                        className="absolute w-0.5 h-1.5 bg-slate-600/40 left-1/2 top-0 origin-bottom"
                        style={{ transform: `translateX(-50%) rotate(${i * 30}deg) translateY(4px)` }}
                    />
                ))}
                 <span className="absolute top-1 left-1/2 -translate-x-1/2 text-[9px] font-bold text-slate-500">N</span>
                 <span className="absolute bottom-1 left-1/2 -translate-x-1/2 text-[9px] font-bold text-slate-500">S</span>
                 <span className="absolute left-1 top-1/2 -translate-y-1/2 text-[9px] font-bold text-slate-500">W</span>
                 <span className="absolute right-1 top-1/2 -translate-y-1/2 text-[9px] font-bold text-slate-500">E</span>
             </div>

             <div className="absolute w-full h-full flex items-center justify-center transition-transform duration-1000 cubic-bezier(0.34, 1.56, 0.64, 1)" style={{ transform: `rotate(${degrees ?? 0}deg)` }}>
                <div className="relative w-full h-full">
                    <div className="absolute top-2 left-1/2 -translate-x-1/2 w-0 h-0 border-l-[6px] border-l-transparent border-r-[6px] border-r-transparent border-b-[24px] border-b-emerald-400 filter drop-shadow-[0_0_8px_rgba(52,211,153,0.8)]"></div>
                    <div className="absolute bottom-2 left-1/2 -translate-x-1/2 w-0.5 h-3 bg-slate-700/50"></div>
                </div>
             </div>

             <div className="absolute flex flex-col items-center justify-center z-10 bg-[#161825]/95 backdrop-blur-md w-20 h-20 rounded-full border border-white/10 shadow-2xl ring-1 ring-white/5">
                <span className="text-2xl font-black text-white tabular-nums tracking-tighter leading-none">{displaySpeed}</span>
                <span className="text-[8px] text-emerald-400 font-bold uppercase tracking-wide opacity-80">km/h</span>
                
                {hasGusts && (
                    <div className="absolute -bottom-6 flex items-center gap-1 px-2 py-0.5 bg-black/40 rounded-full border border-white/5">
                        <Zap className={`w-2.5 h-2.5 ${gustIntensity}`} />
                        <span className={`text-[9px] font-mono font-bold ${gustIntensity} tabular-nums`}>
                            {displayGusts}
                        </span>
                    </div>
                )}
             </div>
        </div>
      </div>
    </div>
  );
};