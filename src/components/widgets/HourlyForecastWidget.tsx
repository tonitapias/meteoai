import { Clock } from 'lucide-react';
import { HourlyWidgetProps } from './widgetTypes';
import { getTrans, safeVal } from './widgetHelpers';

export const HourlyForecastWidget = ({ data, lang }: HourlyWidgetProps) => {
  const t = getTrans(lang);
  
  // SOLUCIÓ RISC ZERO DEFINITIVA: 
  // 1. Comprovem de forma nativa que 't' és un objecte vàlid i no nul abans del càsting.
  // 2. Busquem primer 'hourlyEvolution' (detectat en altres ginys) i després 'hourlyForecast'.
  const tRecord = (typeof t === 'object' && t !== null) ? (t as Record<string, unknown>) : {};
  
  const widgetTitle = 
      typeof tRecord.hourlyEvolution === 'string' ? tRecord.hourlyEvolution :
      typeof tRecord.hourlyForecast === 'string' ? tRecord.hourlyForecast : 
      "EVOLUCIÓ 24H";

  return (
    <div 
        className="w-full h-full flex flex-col bg-slate-900/40 rounded-[2rem] border border-white/5 overflow-hidden shadow-2xl relative transform-gpu"
        style={{ transform: 'translateZ(0)' }}
    >
      
      {/* Capçalera Tàctica (Spatial UI) */}
      <div className="px-6 py-4 flex items-center justify-between border-b border-white/5 bg-slate-950/80 backdrop-blur-md sticky top-0 z-20 shadow-sm">
         <div className="flex items-center gap-2">
            <Clock className="w-3.5 h-3.5 text-cyan-400 drop-shadow-[0_0_3px_rgba(34,211,238,0.8)]" />
            <span className="text-[10px] font-black text-slate-300 uppercase tracking-[0.25em]">
                {widgetTitle}
            </span>
         </div>
      </div>
      
      {/* Contenidor amb Scroll Aïllat per Tailwind (No pol·lució CSS Global) */}
      <div className={`
        flex overflow-x-auto px-4 py-5 gap-3 snap-x bg-gradient-to-b from-slate-950/60 to-slate-900/40
        [&::-webkit-scrollbar]:h-1.5
        [&::-webkit-scrollbar-track]:bg-transparent
        [&::-webkit-scrollbar-track]:mx-5
        [&::-webkit-scrollbar-thumb]:bg-white/10
        hover:[&::-webkit-scrollbar-thumb]:bg-white/25
        [&::-webkit-scrollbar-thumb]:rounded-full
        transition-colors duration-300
      `}>
        {data.map((hour, idx) => {
            // MATEMÀTICA SEGURA: Blindem el valor de precipitació
            const precipVal = typeof hour.precip === 'number' && !isNaN(hour.precip) ? hour.precip : 0;
            const hasPrecip = precipVal > 0;
            
            // Estils Tàctics Dinàmics
            const cardClass = hour.isNow 
                ? 'bg-cyan-900/20 border-cyan-500/50 ring-1 ring-cyan-500/30 shadow-[0_0_15px_rgba(6,182,212,0.25)]' 
                : 'bg-slate-900/50 border-white/5 hover:border-white/20 hover:bg-slate-800/80';
                
            const displayTemp = safeVal(hour.temp);

            return (
              <div 
                key={`hourly-node-${idx}`} 
                className={`flex-shrink-0 flex flex-col items-center justify-between w-[72px] h-[145px] py-3 rounded-[1.25rem] border backdrop-blur-sm ${cardClass} transition-all duration-300 snap-start group`}
              >
                <span className={`text-[10px] font-bold tracking-wider ${hour.isNow ? 'text-cyan-300 drop-shadow-md' : 'text-slate-400 group-hover:text-slate-200'}`}>
                    {hour.time}
                </span>
                
                <div className="my-1 scale-90 group-hover:scale-110 transition-transform duration-300 filter drop-shadow-[0_4px_6px_rgba(0,0,0,0.5)]">
                    {hour.icon}
                </div>
                
                <div className="flex flex-col items-center w-full gap-1.5">
                    <span className="text-lg font-black text-white tabular-nums tracking-tight">
                        {displayTemp}°
                    </span>
                    
                    {/* Barra de telemetria integrada (Data Bar In-Line) */}
                    <div className="w-full px-2.5">
                        <div className="w-full h-1.5 bg-slate-950/80 rounded-full overflow-hidden border border-white/5 shadow-inner">
                            <div 
                                className="h-full bg-cyan-400 rounded-full transition-all duration-500 ease-out" 
                                style={{ 
                                    width: `${hasPrecip ? Math.max(precipVal, 10) : 0}%`, 
                                    opacity: hasPrecip ? 1 : 0,
                                    boxShadow: hasPrecip ? '0 0 8px rgba(34,211,238,0.6)' : 'none'
                                }}
                            />
                        </div>
                    </div>
                    
                    <span className="text-[9px] font-black text-cyan-400 tabular-nums h-2 leading-none opacity-90 drop-shadow-sm">
                        {hour.precipText || ''}
                    </span>
                </div>
              </div>
            );
        })}
      </div>
    </div>
  );
};