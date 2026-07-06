import { Flower2 } from 'lucide-react';
import { WidgetProps } from './widgetTypes';
import { WIDGET_BASE_STYLE } from './widgetStyles';
import { getTrans } from './widgetHelpers';

export const PollenWidget = ({ data, lang }: WidgetProps) => {
    const t = getTrans(lang);
    
    // DOCTRINA RISC ZERO: Validació estricta del diccionari de traduccions
    const tRecord = (typeof t === 'object' && t !== null) ? (t as Record<string, unknown>) : {};
    const titleAqi = typeof tRecord.aqi === 'string' ? tRecord.aqi : "QUALITAT AIRE";

    // DOCTRINA RISC ZERO: Aïllament segur de l'objecte 'data' abans d'accedir a les seves propietats
    // Evitem errors TS si 'WidgetProps.data' ve definit com a 'unknown'
    const safeData = (typeof data === 'object' && data !== null) ? (data as Record<string, unknown>) : {};
    const aqi = typeof safeData.us_aqi === 'number' && !isNaN(safeData.us_aqi) ? safeData.us_aqi : 0;
    
    const getAQIColor = (val: number) => {
        if (val > 150) return 'text-rose-500';
        if (val > 100) return 'text-amber-400';
        if (val > 50) return 'text-yellow-300';
        return 'text-emerald-400';
    };
    
    const colorClass = getAQIColor(aqi);
    const label = aqi > 150 ? "MALA" : aqi > 100 ? "SENSIBLE" : aqi > 50 ? "MODERADA" : "BONA";

    const SPATIAL_WIDGET_STYLE = `${WIDGET_BASE_STYLE} !flex-row items-center gap-6 backdrop-blur-md bg-gradient-to-br from-black/60 to-[#0f111a]/80 border border-white/10 shadow-[0_8px_32px_rgba(0,0,0,0.5)] transform-gpu p-3 sm:p-4`;

    return (
        <div className={SPATIAL_WIDGET_STYLE}>
            <div className="relative w-16 h-16 sm:w-20 sm:h-20 flex items-center justify-center bg-[#0f111a]/80 rounded-xl border border-white/10 shadow-inner group backdrop-blur-sm">
                <Flower2 className={`w-8 h-8 sm:w-10 sm:h-10 ${colorClass} transition-colors duration-500 filter drop-shadow-[0_0_8px_currentColor]`} />
                <div className={`absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full ${aqi > 50 ? 'bg-amber-400 animate-pulse shadow-[0_0_8px_#fbbf24]' : 'bg-emerald-500'} border-2 border-[#151725]`}></div>
            </div>

            <div className="flex-1 flex flex-col justify-center">
                <div className="flex justify-between items-center mb-1">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em]">
                        {titleAqi}
                    </span>
                    <span className={`text-xs sm:text-sm font-mono font-black ${colorClass} tabular-nums bg-black/40 px-2 py-0.5 rounded border border-white/5`}>
                        AQI {aqi}
                    </span>
                </div>
                
                {/* Carril de partícules tàctic amb array de longitud protegida */}
                <div className="flex gap-0.5 h-3.5 w-full mb-2 bg-[#0f111a] rounded-sm border border-white/5 p-px">
                    {Array.from({ length: 20 }).map((_, i) => {
                        const threshold = i * (300/20);
                        const isActive = aqi >= threshold;
                        let segmentColor = 'bg-emerald-400';
                        if (threshold > 150) segmentColor = 'bg-rose-500';
                        else if (threshold > 100) segmentColor = 'bg-amber-400';
                        else if (threshold > 50) segmentColor = 'bg-yellow-300';
                        
                        return (
                            <div 
                                key={`aqi-segment-${i}`} 
                                className={`flex-1 rounded-[1px] transition-all duration-500 ${isActive ? segmentColor : 'bg-transparent'}`}
                                style={{ opacity: isActive ? 1 : 0 }}
                            ></div>
                        );
                    })}
                </div>

                <span className={`text-xl sm:text-2xl font-black ${colorClass} tracking-tighter uppercase drop-shadow-md leading-none`}>
                    {label}
                </span>
            </div>
        </div>
    );
};