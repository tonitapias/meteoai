import React from 'react';
import { Layers } from 'lucide-react';
import { WidgetProps } from './widgetTypes';
import { WIDGET_BASE_STYLE, TITLE_STYLE } from './widgetStyles';
import { getTrans, safeVal } from './widgetHelpers';

export const CloudLayersWidget = ({ low, mid, high, lang }: WidgetProps) => {
  const t = getTrans(lang);
  let title = "NÚVOLS";
  let lHigh = "Alts", lMid = "Mitjans", lLow = "Baixos";
  if (typeof t.cloudLayers === 'object') { title = t.cloudLayers.title.toUpperCase(); lHigh = t.cloudLayers.high; lMid = t.cloudLayers.mid; lLow = t.cloudLayers.low; }

  const layers = [
      { l: lHigh, v: high, color: 'from-blue-200 to-blue-300' },
      { l: lMid, v: mid, color: 'from-blue-300 to-blue-500' },
      { l: lLow, v: low, color: 'from-blue-500 to-indigo-600' },
  ];

  return (
    <div className={WIDGET_BASE_STYLE}>
       <div className={TITLE_STYLE}><Layers className="w-3.5 h-3.5 text-blue-400" /> {title}</div>
       
       <div className="flex-1 flex items-end justify-between gap-2 px-1 relative min-h-[140px]">
          <div className="absolute inset-0 flex flex-col justify-between py-2 pointer-events-none opacity-20">
              <div className="w-full border-t border-dashed border-slate-500"></div>
              <div className="w-full border-t border-dashed border-slate-500"></div>
              <div className="w-full border-t border-dashed border-slate-500"></div>
              <div className="w-full border-t border-dashed border-slate-500"></div>
          </div>

          {layers.map((layer, i) => (
             <div key={i} className="flex flex-col items-center justify-end w-full h-full relative group/beam z-10">
                 <div className="w-full relative rounded-t-lg overflow-hidden bg-[#0f111a] border-x border-t border-white/5 h-full flex items-end shadow-inner">
                     <div 
                        className={`w-full transition-all duration-1000 ease-out bg-gradient-to-t ${layer.color} relative`}
                        style={{ height: `${Math.max(5, layer.v ?? 0)}%`, opacity: layer.v === 0 ? 0.1 : 0.9 }}
                     >
                        <div className="absolute top-0 w-full h-[2px] bg-white/50 shadow-[0_0_10px_white]"></div>
                     </div>
                 </div>
                 
                 <div className="mt-2 text-center z-20">
                     <span className="block text-[18px] font-black text-white tabular-nums leading-none mb-0.5">{safeVal(layer.v)}<span className="text-[9px] align-top opacity-50">%</span></span>
                     <span className="block text-[8px] font-bold text-slate-500 uppercase tracking-wider">{layer.l}</span>
                 </div>
             </div>
          ))}
      </div>
    </div>
  );
};