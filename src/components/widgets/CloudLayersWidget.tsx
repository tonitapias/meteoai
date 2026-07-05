import { Layers } from 'lucide-react';
import { WidgetProps } from './widgetTypes';
import { WIDGET_BASE_STYLE, TITLE_STYLE } from './widgetStyles';
import { getTrans, safeVal } from './widgetHelpers';

export const CloudLayersWidget = ({ low, mid, high, lang }: WidgetProps) => {
  const t = getTrans(lang);
  let title = "NÚVOLS";
  let lHigh = "Alts", lMid = "Mitjans", lLow = "Baixos";
  if (typeof t.cloudLayers === 'object') { 
      title = t.cloudLayers.title.toUpperCase(); 
      lHigh = t.cloudLayers.high; 
      lMid = t.cloudLayers.mid; 
      lLow = t.cloudLayers.low; 
  }

  // Risc Zero: Assegurem valors numèrics dins del rang (0-100) per evitar trencaments CSS
  const safeHigh = typeof high === 'number' && !isNaN(high) ? Math.max(0, Math.min(high, 100)) : 0;
  const safeMid = typeof mid === 'number' && !isNaN(mid) ? Math.max(0, Math.min(mid, 100)) : 0;
  const safeLow = typeof low === 'number' && !isNaN(low) ? Math.max(0, Math.min(low, 100)) : 0;

  // Lògica de dades amb colors aeris i efectes de resplendor tàctic
  const layers = [
      { l: lHigh, v: high, safeVal: safeHigh, color: 'from-sky-300 to-sky-100', glow: 'shadow-[0_0_12px_rgba(186,230,253,0.8)]' },
      { l: lMid, v: mid, safeVal: safeMid, color: 'from-blue-500 to-sky-400', glow: 'shadow-[0_0_12px_rgba(56,189,248,0.8)]' },
      { l: lLow, v: low, safeVal: safeLow, color: 'from-indigo-600 to-blue-500', glow: 'shadow-[0_0_12px_rgba(79,70,229,0.8)]' },
  ];

  // Dark Dashboard Spatial UI
  const SPATIAL_WIDGET_STYLE = `${WIDGET_BASE_STYLE} backdrop-blur-md bg-gradient-to-br from-black/60 to-[#0f111a]/80 border border-white/10 shadow-[0_8px_32px_rgba(0,0,0,0.5)] transform-gpu flex flex-col p-3 sm:p-4`;

  return (
    <div className={SPATIAL_WIDGET_STYLE}>
       <div className={`${TITLE_STYLE.replace('mb-4', 'mb-3')} flex items-center gap-1.5`}>
           <Layers className="w-4 h-4 text-sky-400 drop-shadow-[0_0_8px_rgba(56,189,248,0.5)]" /> 
           <span className="tracking-wider">{title}</span>
       </div>
       
       <div className="flex-1 flex items-end justify-between gap-3 sm:gap-4 px-1 relative min-h-[140px] mt-2">
          {/* Graella espacial de radar */}
          <div className="absolute inset-0 flex flex-col justify-between py-6 pointer-events-none opacity-30">
              <div className="w-full border-t border-dashed border-slate-400/50"></div>
              <div className="w-full border-t border-dashed border-slate-400/50"></div>
              <div className="w-full border-t border-dashed border-slate-400/50"></div>
          </div>

          {layers.map((layer, i) => (
             <div key={i} className="flex flex-col items-center justify-end w-full h-full relative group/beam z-10">
                 {/* Cilindre contenidor de la barra */}
                 <div className="w-full relative rounded-t-lg overflow-hidden bg-[#0f111a]/60 border-x border-t border-white/5 h-full flex items-end shadow-[inset_0_0_10px_rgba(0,0,0,0.5)] backdrop-blur-sm">
                     <div 
                        className={`w-full transition-all duration-1000 ease-out bg-gradient-to-t ${layer.color} relative opacity-90`}
                        style={{ height: `${Math.max(4, layer.safeVal)}%` }}
                     >
                        {/* Emissor de llum superior */}
                        <div className={`absolute top-0 w-full h-[3px] bg-white ${layer.safeVal > 0 ? layer.glow : ''}`}></div>
                     </div>
                 </div>
                 
                 {/* Dades emmarcades (Spatial UI) */}
                 <div className="mt-2.5 text-center z-20 bg-black/40 w-full py-1.5 rounded-md border border-white/5 backdrop-blur-md shadow-lg">
                     <span className="block text-xl sm:text-2xl font-black text-white tabular-nums leading-none mb-1 drop-shadow-md">
                        {safeVal(layer.v)}<span className="text-[10px] align-top text-slate-400 ml-0.5">%</span>
                     </span>
                     <span className="block text-[9px] font-black text-slate-400 uppercase tracking-widest">{layer.l}</span>
                 </div>
             </div>
          ))}
      </div>
    </div>
  );
};