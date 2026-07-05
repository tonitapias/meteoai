import { CircularGaugeProps } from './widgetTypes';
import { WIDGET_BASE_STYLE, TITLE_STYLE } from './widgetStyles';
import { safeVal } from './widgetHelpers';

export const CircularGauge = ({ icon, label, value, max, subText, color = "text-indigo-400" }: CircularGaugeProps) => {
    const radius = 38;
    const circumference = 2 * Math.PI * radius; 
    
    // Risc Zero: Protegim el valor i evitem divisions per zero si max ve corrupte
    const safeValue = typeof value === 'number' && !isNaN(value) ? value : 0;
    const safeMax = typeof max === 'number' && max > 0 ? max : 1;
    
    const offset = circumference - (Math.min(safeValue / safeMax, 1) * circumference);
    const displayValue = safeVal(value);

    // Spatial UI: Dark Dashboard integrat
    const SPATIAL_WIDGET_STYLE = `${WIDGET_BASE_STYLE} backdrop-blur-md bg-gradient-to-br from-black/60 to-[#0f111a]/80 border border-white/10 shadow-[0_8px_32px_rgba(0,0,0,0.5)] transform-gpu flex flex-col`;

    return (
        <div className={SPATIAL_WIDGET_STYLE}>
            <div className={TITLE_STYLE}>
                <span className={`drop-shadow-[0_0_8px_rgba(255,255,255,0.3)] ${color}`}>{icon}</span> 
                <span className="tracking-wider">{label}</span>
            </div>
            <div className="relative w-full flex-1 flex items-center justify-center mt-2">
                 <div className="relative w-32 h-32 flex items-center justify-center filter drop-shadow-xl">
                     <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
                         {/* Fons fosc de l'esfera */}
                         <circle cx="50" cy="50" r={radius} fill="none" stroke="#0f111a" strokeWidth="8" strokeLinecap="round" className="opacity-80" />
                         {/* Carril de fons */}
                         <circle cx="50" cy="50" r={radius} fill="none" stroke="#1e293b" strokeWidth="8" strokeLinecap="round" />
                         {/* Barra de progrés amb resplendor */}
                         <circle 
                            cx="50" cy="50" r={radius} fill="none" stroke="currentColor" strokeWidth="8" strokeLinecap="round" 
                            className={`${color} filter drop-shadow-[0_0_6px_currentColor]`}
                            style={{ 
                                strokeDasharray: circumference, 
                                strokeDashoffset: offset, 
                                transition: "stroke-dashoffset 1.5s cubic-bezier(0.34, 1.56, 0.64, 1)" 
                            }} 
                         />
                     </svg>
                     <div className="absolute flex flex-col items-center">
                         <span className="text-3xl sm:text-4xl font-black text-white tabular-nums tracking-tighter drop-shadow-md">
                             {displayValue}
                         </span>
                         {subText && (
                             <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest bg-black/40 px-2.5 py-0.5 rounded-full border border-white/10 mt-1 backdrop-blur-sm">
                                 {subText}
                             </span>
                         )}
                     </div>
                 </div>
            </div>
        </div>
    );
};