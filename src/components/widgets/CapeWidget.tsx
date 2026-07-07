import { Zap, AlertTriangle, Activity } from 'lucide-react';
import { WidgetProps } from './widgetTypes';
import { WIDGET_BASE_STYLE, TITLE_STYLE } from './widgetStyles';
import { getTrans, safeVal } from './widgetHelpers';

export interface CapeWidgetProps extends Omit<WidgetProps, 'cape'> {
    capeData?: (number | null)[];
    currentHourIndex?: number;
}

export const CapeWidget = ({ capeData = [], currentHourIndex = 0, lang }: CapeWidgetProps) => {
    // DOCTRINA RISC ZERO: Forcem el tipatge global de les traduccions un sol cop
    const t = getTrans(lang) as Record<string, unknown>;
    
    // Extracció segura protegint contra matrius buides, fora de límits i nuls
    const rawCape = (capeData && capeData.length > currentHourIndex) ? capeData[currentHourIndex] : null;
    const safeCape = rawCape ?? 0;
    const displayCape = safeVal(rawCape); 
    
    // DOCTRINA RISC ZERO: Connectem els estats a les traduccions, protegits amb fallbacks tàctics
    let severity = String(t.stable || 'Estable');
    let color = 'text-emerald-400';
    let barColor = 'bg-gradient-to-t from-emerald-500 via-emerald-400 to-transparent';
    let borderColor = 'border-emerald-500/20';
    
    // Escala base de 3000 J/kg per al càlcul visual de la barra
    const heightPct = Math.min((safeCape / 3000) * 100, 100);

    if (safeCape >= 2000) { 
        severity = String(t.severe || 'Severa'); 
        color = 'text-rose-500'; 
        barColor = 'bg-gradient-to-t from-rose-600 via-rose-500 to-orange-500'; 
        borderColor = 'border-rose-500/40';
    } else if (safeCape >= 1000) { 
        severity = String(t.high || 'Alta'); 
        color = 'text-amber-400'; 
        barColor = 'bg-gradient-to-t from-amber-500 via-amber-400 to-transparent'; 
        borderColor = 'border-amber-400/40';
    } else if (safeCape >= 300) { 
        severity = String(t.moderate || 'Moderada'); 
        color = 'text-yellow-300'; 
        barColor = 'bg-gradient-to-t from-yellow-400 to-transparent'; 
        borderColor = 'border-yellow-400/30';
    }

    const SPATIAL_WIDGET_STYLE = `${WIDGET_BASE_STYLE} backdrop-blur-md bg-gradient-to-br from-black/60 to-[#0f111a]/80 border ${borderColor} shadow-[0_8px_32px_rgba(0,0,0,0.5)] transform-gpu`;

    return (
      <div className={SPATIAL_WIDGET_STYLE}>
          <div className={`${TITLE_STYLE} flex justify-between items-center w-full`}>
              <div className="flex items-center gap-2">
                  <Zap className={`w-4 h-4 ${color} drop-shadow-[0_0_8px_rgba(251,191,36,0.5)] transition-colors duration-500`} /> 
                  <span className="tracking-wider text-slate-200">
                    {String(t.instability_actual || "CAPE ACTUAL")}
                  </span>
              </div>
              
              {/* Indicador Tàctic LIVE de Telemetria */}
              <div className="flex items-center gap-1.5 px-2 py-0.5 rounded border border-cyan-500/30 bg-cyan-500/10 shadow-[0_0_10px_rgba(6,182,212,0.15)]">
                  <span className="relative flex h-1.5 w-1.5">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-cyan-500"></span>
                  </span>
                  <Activity className="w-3 h-3 text-cyan-400" />
              </div>
          </div>

          <div className="flex-1 flex items-stretch gap-4 relative mt-2">
              <div className="w-4 bg-black/50 rounded-full border border-white/10 relative overflow-hidden flex flex-col justify-end shadow-inner backdrop-blur-sm">
                  <div className="absolute inset-0 flex flex-col justify-between py-1 px-0.5 opacity-30 z-10 pointer-events-none">
                      {[...Array(10)].map((_, i) => <div key={i} className="w-full h-px bg-white/60"></div>)}
                  </div>
                  <div className={`w-full ${barColor} transition-all duration-1000 ease-out relative`} style={{ height: `${Math.max(5, heightPct)}%` }}>
                      <div className="absolute top-0 w-full h-[2px] bg-white shadow-[0_0_12px_white]"></div>
                  </div>
              </div>

              <div className="flex-1 flex flex-col justify-center">
                  <span className={`text-4xl sm:text-5xl font-black tracking-tighter tabular-nums ${color} drop-shadow-xl leading-none`}>
                      {displayCape}
                  </span>
                  <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mb-3 mt-1">J/kg</span>
                  
                  <div className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border backdrop-blur-md bg-black/40 w-fit ${safeCape >= 300 ? borderColor : 'border-white/5'}`}>
                      {safeCape >= 300 && <AlertTriangle className={`w-3.5 h-3.5 ${color}`} />}
                      <span className={`text-[10px] font-black uppercase tracking-wider ${color}`}>
                          {severity}
                      </span>
                  </div>
              </div>
          </div>
      </div>
    );
};