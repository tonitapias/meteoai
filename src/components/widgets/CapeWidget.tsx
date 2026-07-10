import { Zap, AlertTriangle, Activity, CloudOff } from 'lucide-react';
import { WidgetProps } from './widgetTypes';
import { WIDGET_BASE_STYLE, TITLE_STYLE } from './widgetStyles';
import { getTrans } from './widgetHelpers';

export interface CapeWidgetProps extends Omit<WidgetProps, 'cape'> {
    capeData?: (number | null)[];
    currentHourIndex?: number;
}

export const CapeWidget = ({ capeData = [], currentHourIndex = 0, lang }: CapeWidgetProps) => {
    // DOCTRINA RISC ZERO: Extracció del diccionari
    const t = getTrans(lang) as Record<string, unknown>;
    
    // Extracció segura protegint contra matrius buides i destriant 0 (Estable) de null (Sense Dades)
    const rawCape = (Array.isArray(capeData) && capeData.length > currentHourIndex) ? capeData[currentHourIndex] : null;
    const hasValidData = typeof rawCape === 'number' && !isNaN(rawCape);
    
    const safeCape = hasValidData ? rawCape : 0;
    const displayCape = hasValidData ? Math.round(safeCape) : '--'; 
    
    // Estats inicials per defecte (Pèrdua de telemetria / Risc Desconegut)
    let severity = String(t.unknown || 'DESCONEGUT');
    let color = 'text-slate-500';
    let barColor = 'bg-slate-700/50';
    let borderColor = 'border-slate-500/20';
    let bgGlow = 'from-slate-950/20 to-black/80';
    
    // Escala base de 3000 J/kg per al càlcul visual de la barra
    const MAX_CAPE = 3000;
    const heightPct = hasValidData ? Math.min((safeCape / MAX_CAPE) * 100, 100) : 0;

    if (hasValidData) {
        if (safeCape >= 2000) { 
            severity = String(t.severe || 'Severa'); 
            color = 'text-rose-500'; 
            barColor = 'bg-gradient-to-t from-rose-600 via-rose-500 to-orange-500'; 
            borderColor = 'border-rose-500/40';
            bgGlow = 'from-rose-950/30 to-black/80';
        } else if (safeCape >= 1000) { 
            severity = String(t.high || 'Alta'); 
            color = 'text-amber-400'; 
            barColor = 'bg-gradient-to-t from-amber-500 via-amber-400 to-transparent'; 
            borderColor = 'border-amber-400/40';
            bgGlow = 'from-amber-950/20 to-black/80';
        } else if (safeCape >= 300) { 
            severity = String(t.moderate || 'Moderada'); 
            color = 'text-yellow-300'; 
            barColor = 'bg-gradient-to-t from-yellow-400 to-transparent'; 
            borderColor = 'border-yellow-400/30';
            bgGlow = 'from-yellow-950/10 to-black/80';
        } else {
            severity = String(t.stable || 'Estable'); 
            color = 'text-emerald-400'; 
            barColor = 'bg-gradient-to-t from-emerald-500 via-emerald-400 to-transparent'; 
            borderColor = 'border-emerald-500/20';
            bgGlow = 'from-emerald-950/10 to-black/80';
        }
    }

    // SPATIAL UI BASE AMB MATRIU DE FONS
    const SPATIAL_WIDGET_STYLE = `${WIDGET_BASE_STYLE} relative overflow-hidden backdrop-blur-md bg-gradient-to-br ${bgGlow} border ${borderColor} shadow-[0_8px_32px_rgba(0,0,0,0.5)] transform-gpu transition-colors duration-700`;
    const MATRIX_BG = `absolute inset-0 z-0 opacity-[0.03] pointer-events-none bg-[linear-gradient(to_right,#ffffff_1px,transparent_1px),linear-gradient(to_bottom,#ffffff_1px,transparent_1px)] bg-[size:12px_12px]`;

    return (
      <div className={SPATIAL_WIDGET_STYLE}>
          {/* Capes de fons espacials */}
          <div className={MATRIX_BG}></div>
          <div className={`absolute top-0 right-0 w-32 h-32 opacity-10 rounded-full blur-3xl pointer-events-none z-0 ${hasValidData ? color.replace('text-', 'bg-') : 'bg-slate-500'}`}></div>

          <div className={`${TITLE_STYLE} flex justify-between items-center w-full z-10 relative`}>
              <div className="flex items-center gap-2">
                  {hasValidData ? (
                      <Zap className={`w-4 h-4 ${color} drop-shadow-[0_0_8px_currentColor] transition-colors duration-500`} /> 
                  ) : (
                      <CloudOff className="w-4 h-4 text-slate-500" />
                  )}
                  <span className="tracking-wider text-slate-200">
                    {String(t.instability_actual || "CAPE ACTUAL")}
                  </span>
              </div>
              
              {/* Indicador Tàctic LIVE de Telemetria */}
              <div className={`flex items-center gap-1.5 px-2 py-0.5 rounded border shadow-sm transition-colors duration-500 ${hasValidData ? 'border-cyan-500/30 bg-cyan-500/10 shadow-[0_0_10px_rgba(6,182,212,0.15)]' : 'border-slate-500/30 bg-slate-500/10'}`}>
                  <span className="relative flex h-1.5 w-1.5">
                      {hasValidData && <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75"></span>}
                      <span className={`relative inline-flex rounded-full h-1.5 w-1.5 ${hasValidData ? 'bg-cyan-500' : 'bg-slate-500'}`}></span>
                  </span>
                  <Activity className={`w-3 h-3 ${hasValidData ? 'text-cyan-400' : 'text-slate-500'}`} />
              </div>
          </div>

          <div className="flex-1 flex items-stretch gap-4 relative mt-2 z-10">
              {/* Instrument Analògic: Barra de progrés amb llindars absoluts */}
              <div className="w-4 bg-black/60 rounded-full border border-white/5 relative overflow-hidden flex flex-col justify-end shadow-inner backdrop-blur-md">
                  {/* Línies de calibratge (Ticks) dels llindars */}
                  <div className="absolute inset-0 z-10 pointer-events-none">
                      <div className="absolute w-full h-px bg-rose-500/50" style={{ bottom: `${(2000 / MAX_CAPE) * 100}%` }}></div>
                      <div className="absolute w-full h-px bg-amber-500/50" style={{ bottom: `${(1000 / MAX_CAPE) * 100}%` }}></div>
                      <div className="absolute w-full h-px bg-yellow-400/50" style={{ bottom: `${(300 / MAX_CAPE) * 100}%` }}></div>
                  </div>
                  
                  {/* Barra de valor */}
                  <div className={`w-full ${barColor} transition-all duration-1000 ease-out relative`} style={{ height: `${Math.max(hasValidData ? 2 : 0, heightPct)}%` }}>
                      {hasValidData && <div className="absolute top-0 w-full h-[2px] bg-white shadow-[0_0_12px_white]"></div>}
                  </div>
              </div>

              <div className="flex-1 flex flex-col justify-center">
                  <span className={`text-4xl sm:text-5xl font-black tracking-tighter tabular-nums ${color} drop-shadow-xl leading-none`}>
                      {displayCape}
                  </span>
                  <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mb-3 mt-1">
                      {hasValidData ? 'J/kg' : String(t.no_data || 'SENSE DADES')}
                  </span>
                  
                  <div className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border backdrop-blur-md bg-black/40 w-fit transition-colors duration-500 ${hasValidData && safeCape >= 300 ? borderColor : 'border-white/5'}`}>
                      {hasValidData && safeCape >= 300 && <AlertTriangle className={`w-3.5 h-3.5 ${color}`} />}
                      {!hasValidData && <CloudOff className="w-3.5 h-3.5 text-slate-500" />}
                      <span className={`text-[10px] font-black uppercase tracking-wider ${color}`}>
                          {severity}
                      </span>
                  </div>
              </div>
          </div>
      </div>
    );
};