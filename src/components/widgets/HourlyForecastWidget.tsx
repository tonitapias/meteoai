import React from 'react';
import { Clock } from 'lucide-react';
import { HourlyWidgetProps } from './widgetTypes';
import { getTrans, safeVal } from './widgetHelpers';

export const HourlyForecastWidget = ({ data, lang }: HourlyWidgetProps) => {
  const t = getTrans(lang);
  return (
    <div className="w-full h-full flex flex-col bg-[#0b0c15] rounded-[2rem] border border-white/5 overflow-hidden shadow-2xl relative">
      <style>{`
        .custom-scroll::-webkit-scrollbar { height: 4px; }
        .custom-scroll::-webkit-scrollbar-track { background: transparent; margin: 0 20px; }
        .custom-scroll::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.15); border-radius: 10px; }
        .custom-scroll::-webkit-scrollbar-thumb:hover { background: rgba(255,255,255,0.3); }
      `}</style>
      
      <div className="px-6 py-4 flex items-center justify-between border-b border-white/5 bg-[#11131f]/80 backdrop-blur-md sticky top-0 z-20">
         <div className="flex items-center gap-2">
            <Clock className="w-3.5 h-3.5 text-indigo-400" />
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.25em]">{t.hourlyForecast || "EVOLUCIÓ 24H"}</span>
         </div>
      </div>
      
      <div className="flex overflow-x-auto px-4 py-5 gap-3 custom-scroll snap-x bg-gradient-to-b from-[#0b0c15] to-[#11131f]">
        {data.map((hour, idx) => {
            const hasPrecip = (hour.precip || 0) > 0;
            const cardClass = hour.isNow 
                ? 'bg-indigo-600/10 border-indigo-500/40 ring-1 ring-indigo-500/20 shadow-[0_0_15px_rgba(99,102,241,0.2)]' 
                : 'bg-[#151725] border-white/5 hover:border-white/20 hover:bg-[#1e2130]';
            const displayTemp = safeVal(hour.temp);

            return (
              <div key={idx} className={`flex-shrink-0 flex flex-col items-center justify-between w-[72px] h-[145px] py-3 rounded-[1.25rem] border ${cardClass} transition-all duration-300 snap-start group`}>
                <span className={`text-[10px] font-bold ${hour.isNow ? 'text-indigo-300' : 'text-slate-500 group-hover:text-slate-300'}`}>{hour.time}</span>
                
                <div className="my-1 scale-90 group-hover:scale-110 transition-transform duration-300 filter drop-shadow-lg">
                    {hour.icon}
                </div>
                
                <div className="flex flex-col items-center w-full gap-1.5">
                    <span className="text-lg font-black text-white tabular-nums tracking-tight">{displayTemp}°</span>
                    <div className="w-full px-2.5">
                        <div className="w-full h-1 bg-[#0f111a] rounded-full overflow-hidden">
                            <div className="h-full bg-blue-500 rounded-full transition-all" style={{width: `${hasPrecip ? Math.max(hour.precip || 0, 30) : 0}%`, opacity: hasPrecip ? 1 : 0}}></div>
                        </div>
                    </div>
                    <span className="text-[8px] font-bold text-blue-400 tabular-nums h-2 leading-none opacity-80">{hour.precipText || ''}</span>
                </div>
              </div>
            );
        })}
      </div>
    </div>
  );
};