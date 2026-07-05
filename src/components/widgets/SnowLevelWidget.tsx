import { Mountain } from 'lucide-react';
import { WidgetProps } from './widgetTypes';
import { WIDGET_BASE_STYLE, TITLE_STYLE } from './widgetStyles';
import { getTrans } from './widgetHelpers';

export const SnowLevelWidget = ({ freezingLevel, unit, lang }: WidgetProps) => {
    const t = getTrans(lang);
    // Risc Zero: Evitem operacions si no hi ha dades
    const hasData = typeof freezingLevel === 'number' && !isNaN(freezingLevel);
    // El límit de neu sol situar-se uns 300m per sota de la isoterma 0ºC
    const snowLimit = Math.max(0, (hasData ? freezingLevel : 0) - 300);
    const isFt = unit === 'imperial' || unit === 'F';
    const displayLevel = hasData ? (isFt ? Math.round(snowLimit * 3.28084) : Math.round(snowLimit)) : '--';
    
    const SPATIAL_WIDGET_STYLE = `${WIDGET_BASE_STYLE} backdrop-blur-md bg-gradient-to-br from-black/60 to-[#0f111a]/80 border border-white/10 shadow-[0_8px_32px_rgba(0,0,0,0.5)] transform-gpu p-3 sm:p-4 flex flex-col`;

    return (
        <div className={SPATIAL_WIDGET_STYLE}>
            <div className={`${TITLE_STYLE.replace('mb-4', 'mb-2')} flex items-center gap-1.5 z-20`}>
                <Mountain className="w-4 h-4 text-sky-300 drop-shadow-[0_0_8px_rgba(125,211,252,0.5)]" /> 
                <span className="tracking-wider">{t.snowLevel || "COTA NEU"}</span>
            </div>
            
            <div className="flex-1 flex flex-col items-center justify-center relative overflow-hidden rounded-xl bg-black/20 border border-white/5 shadow-inner mt-2">
                {/* Holograma de la muntanya al fons */}
                <div className="absolute inset-0 flex items-end justify-center opacity-[0.15]">
                    <svg viewBox="0 0 100 60" className="w-full h-full text-sky-400 fill-current" preserveAspectRatio="none">
                        <path d="M50 10 L100 60 L0 60 Z" />
                    </svg>
                </div>
                {/* Línia de la cota */}
                <div className="absolute top-[45%] w-full border-t-[1.5px] border-dashed border-sky-300/40"></div>
                
                {/* Visualització de Dades (Spatial UI) */}
                <div className="z-10 text-center flex flex-col items-center bg-black/40 px-6 py-2 rounded-lg border border-white/10 backdrop-blur-sm shadow-xl">
                    <span className="text-4xl sm:text-5xl font-black text-white tracking-tighter tabular-nums drop-shadow-[0_0_15px_rgba(255,255,255,0.4)] leading-none">
                        {displayLevel}
                    </span>
                    <div className="flex items-center gap-1.5 mt-2 bg-[#0f111a] px-2.5 py-1 rounded border border-white/5">
                        <span className="w-1.5 h-1.5 bg-sky-400 rounded-full animate-pulse shadow-[0_0_6px_#38bdf8]"></span>
                        <span className="text-[10px] font-black text-sky-200 uppercase tracking-widest">{isFt ? 'FT' : 'METRES'}</span>
                    </div>
                </div>
            </div>
        </div>
    );
};