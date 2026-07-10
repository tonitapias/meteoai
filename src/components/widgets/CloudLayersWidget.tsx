import { Layers, CloudOff } from 'lucide-react';
import { WidgetProps } from './widgetTypes';
import { WIDGET_BASE_STYLE, TITLE_STYLE } from './widgetStyles';
import { getTrans } from './widgetHelpers';

export const CloudLayersWidget = ({ low, mid, high, lang }: WidgetProps) => {
  // DOCTRINA RISC ZERO: Extracció segura de traduccions sense "any"
  const t = getTrans(lang) as Record<string, unknown>;
  let title = "NÚVOLS";
  let lHigh = "Alts", lMid = "Mitjans", lLow = "Baixos";
  
  if (t && typeof t.cloudLayers === 'object' && t.cloudLayers !== null) {
      const cl = t.cloudLayers as Record<string, string>;
      title = (cl.title || title).toUpperCase();
      lHigh = cl.high || lHigh;
      lMid = cl.mid || lMid;
      lLow = cl.low || lLow;
  }

  // DOCTRINA RISC ZERO: Separació estricta entre 0% (Cel Clar) i null (Pèrdua de Telemetria)
  const parseLayer = (val: unknown, label: string, colorClass: string, glowClass: string) => {
      const isValid = typeof val === 'number' && !isNaN(val);
      // Limitem matemàticament entre 0 i 100 només si tenim dades reals
      const safeNum = isValid ? Math.max(0, Math.min(val as number, 100)) : 0;
      
      return {
          label,
          isValid,
          value: safeNum,
          display: isValid ? Math.round(safeNum).toString() : '--',
          bgClass: isValid ? colorClass : 'from-slate-700/50 to-slate-800/50',
          glowClass: isValid && safeNum > 0 ? glowClass : '', // Només brilla si hi ha dades I hi ha núvols
          textClass: isValid ? 'text-white' : 'text-slate-500'
      };
  };

  // Lògica de dades amb colors aeris i efectes de resplendor tàctic
  const layers = [
      parseLayer(high, lHigh, 'from-sky-300 to-sky-100', 'shadow-[0_0_12px_rgba(186,230,253,0.8)]'),
      parseLayer(mid, lMid, 'from-blue-500 to-sky-400', 'shadow-[0_0_12px_rgba(56,189,248,0.8)]'),
      parseLayer(low, lLow, 'from-indigo-600 to-blue-500', 'shadow-[0_0_12px_rgba(79,70,229,0.8)]'),
  ];

  // Dark Dashboard Spatial UI
  const SPATIAL_WIDGET_STYLE = `${WIDGET_BASE_STYLE} relative overflow-hidden backdrop-blur-md bg-gradient-to-br from-indigo-950/20 to-black/80 border border-white/10 shadow-[0_8px_32px_rgba(0,0,0,0.5)] transform-gpu flex flex-col p-3 sm:p-4 transition-colors duration-700`;
  const MATRIX_BG = `absolute inset-0 z-0 opacity-[0.03] pointer-events-none bg-[linear-gradient(to_right,#ffffff_1px,transparent_1px),linear-gradient(to_bottom,#ffffff_1px,transparent_1px)] bg-[size:12px_12px]`;

  return (
    <div className={SPATIAL_WIDGET_STYLE}>
       {/* Capa de fons espacial */}
       <div className={MATRIX_BG}></div>

       <div className={`${TITLE_STYLE.replace('mb-4', 'mb-3')} flex items-center gap-1.5 z-10 relative`}>
           <Layers className="w-4 h-4 text-sky-400 drop-shadow-[0_0_8px_rgba(56,189,248,0.5)]" /> 
           <span className="tracking-wider">{title}</span>
       </div>
       
       <div className="flex-1 flex items-end justify-between gap-3 sm:gap-4 px-1 relative min-h-[140px] mt-2 z-10">
          {/* Graella espacial de radar atmosfèric */}
          <div className="absolute inset-0 flex flex-col justify-between py-6 pointer-events-none opacity-30 z-0">
              <div className="w-full border-t border-dashed border-slate-400/50"></div>
              <div className="w-full border-t border-dashed border-slate-400/50"></div>
              <div className="w-full border-t border-dashed border-slate-400/50"></div>
          </div>

          {layers.map((layer, i) => (
             <div key={i} className="flex flex-col items-center justify-end w-full h-full relative group/beam z-10">
                 {/* Cilindre contenidor de la barra */}
                 <div className={`w-full relative rounded-t-lg overflow-hidden border-x border-t h-full flex items-end shadow-[inset_0_0_10px_rgba(0,0,0,0.5)] backdrop-blur-sm transition-colors duration-500 ${layer.isValid ? 'bg-[#0f111a]/60 border-white/5' : 'bg-slate-900/40 border-slate-500/10'}`}>
                     <div 
                        className={`w-full transition-all duration-1000 ease-out bg-gradient-to-t ${layer.bgClass} relative opacity-90`}
                        // Altura mínima del 4% només per mantenir la geometria si hi ha dades. Si no hi ha dades, es queda pla.
                        style={{ height: layer.isValid ? `${Math.max(4, layer.value)}%` : '2%' }}
                     >
                        {/* Emissor de llum superior (Glow) */}
                        <div className={`absolute top-0 w-full h-[3px] ${layer.isValid ? 'bg-white' : 'bg-slate-600'} ${layer.glowClass}`}></div>
                     </div>
                 </div>
                 
                 {/* Dades emmarcades (Spatial UI) */}
                 <div className={`mt-2.5 text-center z-20 w-full py-1.5 rounded-md border backdrop-blur-md shadow-lg transition-colors duration-500 ${layer.isValid ? 'bg-black/40 border-white/5' : 'bg-slate-900/40 border-slate-500/20'}`}>
                     <span className={`block text-xl sm:text-2xl font-black tabular-nums leading-none mb-1 drop-shadow-md ${layer.textClass}`}>
                        {layer.display}
                        {layer.isValid && <span className="text-[10px] align-top text-slate-400 ml-0.5">%</span>}
                     </span>
                     <div className="flex items-center justify-center gap-1">
                        {!layer.isValid && <CloudOff className="w-2.5 h-2.5 text-slate-500" />}
                        <span className={`block text-[9px] font-black uppercase tracking-widest ${layer.isValid ? 'text-slate-400' : 'text-slate-500'}`}>
                            {layer.label}
                        </span>
                     </div>
                 </div>
             </div>
          ))}
      </div>
    </div>
  );
};