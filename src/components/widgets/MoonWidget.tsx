import { Moon } from 'lucide-react';
import { WidgetProps } from './widgetTypes';
import { WIDGET_BASE_STYLE, TITLE_STYLE } from './widgetStyles';
import { getTrans, getMoonPhaseText } from './widgetHelpers';
import { MoonPhaseIcon } from '../MoonPhaseIcon'; 

export const MoonWidget = ({ phase, lat, lang }: WidgetProps) => {
    const t = getTrans(lang);
    
    // DOCTRINA RISC ZERO: Validació estricta d'objecte i extracció tipada de text
    const tRecord = (typeof t === 'object' && t !== null) ? (t as Record<string, unknown>) : {};
    const titleMoon = typeof tRecord.moonPhase === 'string' ? tRecord.moonPhase : "LLUNA";
    
    const hasData = phase !== null && phase !== undefined && !isNaN(phase);
    
    // Càlcul de la il·luminació real (0-100%) protegit contra divisions o nuls
    const illumination = hasData ? Math.round(((1 - Math.cos(phase * 2 * Math.PI)) / 2) * 100) : 0;
    
    const moonText = hasData ? getMoonPhaseText(phase) : '--';
    const moonAge = hasData ? Math.round(phase * 29.53) : 0;
    
    // Utilitzem 'lat' per detectar l'hemisferi
    // Si estem al sud (lat < 0), invertim la visualització horitzontalment
    const isSouth = typeof lat === 'number' && lat < 0;

    // Aplicació del Dark Dashboard Spatial UI
    const SPATIAL_WIDGET_STYLE = `${WIDGET_BASE_STYLE} backdrop-blur-md bg-gradient-to-br from-indigo-950/40 to-black/60 border border-indigo-500/10 shadow-[0_8px_32px_rgba(0,0,0,0.5)] transform-gpu p-3 sm:p-4 flex flex-col`;

    return (
        <div className={SPATIAL_WIDGET_STYLE}>
             <div className="flex items-center justify-between w-full mb-3">
                 <span className={`${TITLE_STYLE.replace('mb-4', 'mb-0')} flex items-center gap-1.5`}>
                     <Moon className="w-4 h-4 text-indigo-300 drop-shadow-[0_0_8px_rgba(165,180,252,0.5)]" /> 
                     <span className="tracking-wider">{titleMoon}</span>
                 </span>
                 <div className="flex flex-col items-end bg-black/30 px-2 py-0.5 rounded border border-white/5 backdrop-blur-sm">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Dia {moonAge}</span>
                 </div>
             </div>
             
             <div className="flex items-center justify-center flex-1 gap-6 sm:gap-8">
                 {/* Apliquem transformació mirall si és hemisferi sud amb suport Spatial */}
                 <div 
                    className="w-20 h-20 sm:w-24 sm:h-24 filter drop-shadow-[0_0_15px_rgba(255,255,255,0.15)]" 
                    style={{ transform: isSouth ? 'scaleX(-1) translateZ(10px)' : 'translateZ(10px)' }}
                 >
                    <MoonPhaseIcon phase={hasData ? phase : 0} className="w-full h-full text-slate-200" />
                 </div>
                 
                 <div className="flex flex-col justify-center">
                    <span className="text-3xl sm:text-4xl font-black text-white tracking-tighter drop-shadow-md">
                        {hasData ? illumination : '--'}%
                    </span>
                    <span className="text-sm sm:text-base text-indigo-200 font-bold mb-1 tracking-wide">
                        {moonText}
                    </span>
                    <span className="text-[9px] text-slate-500 font-bold uppercase tracking-widest border-t border-white/10 pt-1.5 mt-1">
                        Il·luminació
                    </span>
                 </div>
             </div>
        </div>
    );
};