import { Zap, AlertTriangle } from 'lucide-react';
import { WidgetProps } from './widgetTypes';
import { WIDGET_BASE_STYLE, TITLE_STYLE } from './widgetStyles';
import { getTrans, safeVal } from './widgetHelpers';

export const CapeWidget = ({ cape, lang }: WidgetProps) => {
    const t = getTrans(lang);
    const safeCape = cape ?? 0;
    const displayCape = safeVal(cape);
    
    // Llindars d'alerta tàctica ajustats per orografia mediterrània/prepirinenca
    let severity = 'Estable';
    let color = 'text-emerald-400';
    let barColor = 'bg-gradient-to-t from-emerald-500 via-emerald-400 to-transparent';
    let borderColor = 'border-emerald-500/20';
    
    // Escala base de 3000 J/kg per al càlcul visual de la barra
    const heightPct = Math.min((safeCape / 3000) * 100, 100);

    if (safeCape >= 2000) { 
        severity = 'Severa'; 
        color = 'text-rose-500'; 
        barColor = 'bg-gradient-to-t from-rose-600 via-rose-500 to-orange-500'; 
        borderColor = 'border-rose-500/40';
    } else if (safeCape >= 1000) { 
        severity = 'Alta'; 
        color = 'text-amber-400'; 
        barColor = 'bg-gradient-to-t from-amber-500 via-amber-400 to-transparent'; 
        borderColor = 'border-amber-400/40';
    } else if (safeCape >= 300) { 
        severity = 'Moderada'; 
        color = 'text-yellow-300'; 
        barColor = 'bg-gradient-to-t from-yellow-400 to-transparent'; 
        borderColor = 'border-yellow-400/30';
    }

    const SPATIAL_WIDGET_STYLE = `${WIDGET_BASE_STYLE} backdrop-blur-md bg-gradient-to-br from-black/60 to-[#0f111a]/80 border ${borderColor} shadow-[0_8px_32px_rgba(0,0,0,0.5)] transform-gpu`;

    return (
      <div className={SPATIAL_WIDGET_STYLE}>
          <div className={TITLE_STYLE}>
              <Zap className={`w-4 h-4 ${color} drop-shadow-[0_0_8px_rgba(251,191,36,0.5)] transition-colors duration-500`} /> 
              <span className="tracking-wider">
                {
                    // @ts-expect-error: Fallback segur a 'CAPE' garantit.
                    t.instability || "CAPE MAX"
                }
              </span>
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