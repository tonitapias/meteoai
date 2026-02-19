import { Zap, AlertTriangle } from 'lucide-react';
import { WidgetProps } from './widgetTypes';
import { WIDGET_BASE_STYLE, TITLE_STYLE } from './widgetStyles';
import { getTrans, safeVal } from './widgetHelpers';

export const CapeWidget = ({ cape, lang }: WidgetProps) => {
    const t = getTrans(lang);
    const safeCape = cape ?? 0;
    const displayCape = safeVal(cape);
    
    // Nivells d'alerta
    let severity = 'Estable';
    let color = 'text-emerald-400';
    let barColor = 'bg-gradient-to-t from-emerald-500 via-emerald-400 to-transparent';
    const heightPct = Math.min((safeCape / 3000) * 100, 100);

    if (safeCape > 2500) { severity = 'Severa'; color = 'text-rose-500'; barColor = 'bg-gradient-to-t from-rose-600 via-rose-500 to-orange-500'; }
    else if (safeCape > 1000) { severity = 'Alta'; color = 'text-amber-400'; barColor = 'bg-gradient-to-t from-amber-500 via-yellow-400 to-transparent'; }
    else if (safeCape > 500) { severity = 'Moderada'; color = 'text-yellow-300'; barColor = 'bg-gradient-to-t from-yellow-400 to-transparent'; }

    return (
      <div className={WIDGET_BASE_STYLE}>
          <div className={TITLE_STYLE}>
              <Zap className="w-3.5 h-3.5 text-amber-400" /> 
              {
                  // @ts-expect-error: La clau 'instability' no existeix a l'arxiu de traduccions actual. 
                  // S'omet l'error per garantir el Risc Zero en el runtime, ja que el fallback "CAPE" 
                  // és el que realment s'està renderitzant en producció.
                  t.instability || "CAPE"
              }
          </div>
          <div className="flex-1 flex items-stretch gap-4 relative">
              <div className="w-3 bg-[#0f111a] rounded-full border border-white/10 relative overflow-hidden flex flex-col justify-end shadow-inner">
                  <div className="absolute inset-0 flex flex-col justify-between py-1 px-0.5 opacity-30 z-10 pointer-events-none">
                      {[...Array(10)].map((_, i) => <div key={i} className="w-full h-px bg-white"></div>)}
                  </div>
                  <div className={`w-full ${barColor} transition-all duration-1000 ease-out relative`} style={{ height: `${Math.max(5, heightPct)}%` }}>
                      <div className="absolute top-0 w-full h-[2px] bg-white shadow-[0_0_8px_white]"></div>
                  </div>
              </div>

              <div className="flex-1 flex flex-col justify-center">
                  <span className={`text-4xl font-black tracking-tighter tabular-nums ${color} drop-shadow-lg leading-none`}>
                      {displayCape}
                  </span>
                  <span className="text-[9px] text-slate-500 font-bold uppercase tracking-widest mb-3">J/kg</span>
                  
                  <div className={`flex items-center gap-1.5 px-2 py-1 rounded-md border bg-black/20 w-fit ${safeCape > 1000 ? 'border-amber-500/30' : 'border-white/5'}`}>
                      {safeCape > 1000 && <AlertTriangle className={`w-3 h-3 ${color}`} />}
                      <span className={`text-[9px] font-black uppercase tracking-wider ${color}`}>
                          {severity}
                      </span>
                  </div>
              </div>
          </div>
      </div>
    );
};