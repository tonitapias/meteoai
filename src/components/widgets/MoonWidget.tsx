import React from 'react';
import { Moon } from 'lucide-react';
import { WidgetProps } from './widgetTypes';
import { WIDGET_BASE_STYLE, TITLE_STYLE } from './widgetStyles';
import { getTrans, getMoonPhaseText } from './widgetHelpers';
import { MoonPhaseIcon } from '../MoonPhaseIcon'; // <--- Import corregit (un nivell amunt)

export const MoonWidget = ({ phase, lat, lang }: WidgetProps) => {
    const t = getTrans(lang);
    const hasData = phase !== null && phase !== undefined;
    
    // Càlcul de la il·luminació real (0-100%)
    const illumination = hasData ? Math.round(((1 - Math.cos(phase * 2 * Math.PI)) / 2) * 100) : 0;
    
    const moonText = hasData ? getMoonPhaseText(phase) : '--';
    const moonAge = hasData ? Math.round(phase * 29.53) : 0;
    
    // Utilitzem 'lat' per detectar l'hemisferi
    // Si estem al sud (lat < 0), invertim la visualització horitzontalment
    const isSouth = (lat ?? 0) < 0;

    return (
        <div className={WIDGET_BASE_STYLE}>
             <div className="flex items-center justify-between w-full mb-2">
                 <span className={TITLE_STYLE.replace('mb-4', 'mb-0')}><Moon className="w-3.5 h-3.5 text-indigo-300" /> {t.moonPhase || "LLUNA"}</span>
                 <div className="flex flex-col items-end">
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Dia {moonAge}</span>
                 </div>
             </div>
             
             <div className="flex items-center justify-center flex-1 gap-6">
                 {/* Apliquem transformació mirall si és hemisferi sud */}
                 <div className="w-20 h-20" style={{ transform: isSouth ? 'scaleX(-1)' : 'none' }}>
                    <MoonPhaseIcon phase={phase} className="w-full h-full text-slate-200" />
                 </div>
                 
                 <div className="flex flex-col justify-center">
                    <span className="text-2xl font-black text-white tracking-tight">{hasData ? illumination : '--'}%</span>
                    <span className="text-sm text-indigo-200 font-bold mb-1">{moonText}</span>
                    <span className="text-[8px] text-slate-500 font-bold uppercase tracking-widest border-t border-white/5 pt-1 mt-1">
                        Il·luminació
                    </span>
                 </div>
             </div>
        </div>
    );
};