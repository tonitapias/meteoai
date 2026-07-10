import { Clock, CloudOff } from 'lucide-react';
import { HourlyWidgetProps } from './widgetTypes';
import { getTrans } from './widgetHelpers';

export const HourlyForecastWidget = ({ data, lang }: HourlyWidgetProps) => {
  // DOCTRINA RISC ZERO: Forcem el tipatge global de les traduccions sense usar 'any'
  const t = getTrans(lang) as Record<string, unknown>;
  
  const widgetTitle = 
      typeof t.hourlyEvolution === 'string' ? t.hourlyEvolution :
      typeof t.hourlyForecast === 'string' ? t.hourlyForecast : 
      "EVOLUCIÓ 24H";

  // RISC ZERO DEFINITIU: Si la matriu 'data' no existeix, està mal formada, o ve com a 'null'
  // des de l'API, tallem l'execució abans que un .map() ens pugui causar un crash a producció.
  const hasValidData = Array.isArray(data) && data.length > 0;

  // SPATIAL UI BASE AMB MATRIU DE FONS
  const SPATIAL_WIDGET_STYLE = `w-full h-full flex flex-col rounded-[2rem] border overflow-hidden shadow-[0_8px_32px_rgba(0,0,0,0.5)] relative transform-gpu transition-colors duration-700 ${hasValidData ? 'bg-gradient-to-br from-[#0f111a]/90 to-black/80 border-white/5' : 'bg-gradient-to-br from-slate-900/50 to-black/80 border-slate-700/50'}`;
  const MATRIX_BG = `absolute inset-0 z-0 opacity-[0.03] pointer-events-none bg-[linear-gradient(to_right,#ffffff_1px,transparent_1px),linear-gradient(to_bottom,#ffffff_1px,transparent_1px)] bg-[size:12px_12px]`;

  return (
    <div className={SPATIAL_WIDGET_STYLE}>
      
      {/* Matriu Tàctica */}
      <div className={MATRIX_BG}></div>

      {/* Capçalera Tàctica (Spatial UI) */}
      <div className={`px-6 py-4 flex items-center justify-between border-b bg-slate-950/80 backdrop-blur-md sticky top-0 z-20 transition-colors duration-700 ${hasValidData ? 'border-white/5 shadow-sm' : 'border-slate-700/50 shadow-none'}`}>
         <div className="flex items-center gap-2">
            {hasValidData ? (
                <Clock className="w-3.5 h-3.5 text-cyan-400 drop-shadow-[0_0_3px_rgba(34,211,238,0.8)] transition-colors duration-500" />
            ) : (
                <CloudOff className="w-3.5 h-3.5 text-slate-500" />
            )}
            <span className={`text-[10px] font-black uppercase tracking-[0.25em] transition-colors duration-500 ${hasValidData ? 'text-slate-300' : 'text-slate-500'}`}>
                {widgetTitle}
            </span>
         </div>
      </div>
      
      {/* Contenidor de Dades: Actua com a barrera si falla la telemetria */}
      {!hasValidData ? (
          <div className="flex-1 flex flex-col items-center justify-center min-h-[180px] z-10">
              <CloudOff className="w-8 h-8 text-slate-600 mb-2 opacity-50" />
              <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">
                  {lang === 'ca' ? 'SENSE DADES' : 'NO DATA'}
              </span>
          </div>
      ) : (
          <div className={`
            flex overflow-x-auto px-4 py-5 gap-3 snap-x z-10
            [&::-webkit-scrollbar]:h-1.5
            [&::-webkit-scrollbar-track]:bg-transparent
            [&::-webkit-scrollbar-track]:mx-5
            [&::-webkit-scrollbar-thumb]:bg-white/10
            hover:[&::-webkit-scrollbar-thumb]:bg-white/25
            [&::-webkit-scrollbar-thumb]:rounded-full
          `}>
            {data.map((hour, idx) => {
                // MATEMÀTICA SEGURA: Blindem el valor de precipitació i asseguerm un render net
                const precipVal = typeof hour.precip === 'number' && !isNaN(hour.precip) ? hour.precip : 0;
                const hasPrecip = precipVal > 0;
                
                // Escala tàctica visual: assumim que 10mm/h omple la barra al 100%.
                // L'envoltori de Math.min(100, X) prevé que tempestes torrencials desbordin el DOM i trenquin l'UI.
                const precipPercent = hasPrecip ? Math.min(100, Math.max(15, (precipVal / 10) * 100)) : 0;
                
                // Estils Tàctics Dinàmics segons estat cronològic
                const cardClass = hour.isNow 
                    ? 'bg-cyan-950/40 border-cyan-500/50 ring-1 ring-cyan-500/30 shadow-[0_0_15px_rgba(6,182,212,0.25)]' 
                    : 'bg-black/40 border-white/5 hover:border-white/20 hover:bg-[#0f111a]/80';
                    
                const displayTemp = typeof hour.temp === 'number' && !isNaN(hour.temp) ? Math.round(hour.temp) : '--';

                return (
                  <div 
                    key={`hourly-node-${idx}`} 
                    className={`flex-shrink-0 flex flex-col items-center justify-between w-[72px] h-[145px] py-3 rounded-[1.25rem] border backdrop-blur-sm ${cardClass} transition-all duration-300 snap-start group`}
                  >
                    <span className={`text-[10px] font-bold tracking-wider transition-colors duration-300 ${hour.isNow ? 'text-cyan-300 drop-shadow-[0_0_5px_rgba(103,232,249,0.5)]' : 'text-slate-400 group-hover:text-slate-200'}`}>
                        {hour.time || '--:--'}
                    </span>
                    
                    <div className="my-1 scale-90 group-hover:scale-110 transition-transform duration-300 filter drop-shadow-[0_4px_6px_rgba(0,0,0,0.5)]">
                        {hour.icon || <CloudOff className="w-6 h-6 text-slate-600" />}
                    </div>
                    
                    <div className="flex flex-col items-center w-full gap-1.5">
                        <span className={`text-lg font-black tabular-nums tracking-tight ${displayTemp === '--' ? 'text-slate-500' : 'text-white'}`}>
                            {displayTemp}°
                        </span>
                        
                        {/* Barra de telemetria integrada (Data Bar In-Line) */}
                        <div className="w-full px-2.5">
                            <div className="w-full h-1.5 bg-slate-900/80 rounded-full overflow-hidden border border-white/5 shadow-inner relative">
                                <div 
                                    className="absolute left-0 top-0 h-full bg-cyan-400 rounded-full transition-all duration-500 ease-out" 
                                    style={{ 
                                        width: `${precipPercent}%`, 
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
      )}
    </div>
  );
};