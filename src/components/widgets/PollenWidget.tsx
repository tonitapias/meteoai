import { Flower2 } from 'lucide-react';
import { WidgetProps } from './widgetTypes';
import { WIDGET_BASE_STYLE } from './widgetStyles';
import { getTrans } from './widgetHelpers';

export const PollenWidget = ({ data, lang }: WidgetProps) => {
    const t = getTrans(lang);
    const aqi = data?.us_aqi ?? 0;
    
    const getAQIColor = (val: number) => {
        if (val > 150) return 'text-rose-500';
        if (val > 100) return 'text-orange-400';
        if (val > 50) return 'text-yellow-400';
        return 'text-emerald-400';
    };
    
    const colorClass = getAQIColor(aqi);
    const label = aqi > 150 ? "MALA" : aqi > 100 ? "SENSIBLE" : aqi > 50 ? "MODERADA" : "B O N A";

    return (
        <div className={`${WIDGET_BASE_STYLE} !flex-row items-center gap-6`}>
            <div className="relative w-16 h-16 flex items-center justify-center bg-[#0f111a] rounded-xl border border-white/5 shadow-inner group">
                <Flower2 className={`w-8 h-8 ${colorClass} transition-colors duration-500`} />
                <div className={`absolute -top-1 -right-1 w-3 h-3 rounded-full ${aqi > 50 ? 'bg-amber-500 animate-pulse' : 'bg-emerald-500'} border-2 border-[#151725]`}></div>
            </div>

            <div className="flex-1 flex flex-col justify-center">
                <div className="flex justify-between items-center mb-1">
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.2em]">
                        {t.aqi || "QUALITAT AIRE"}
                    </span>
                    <span className={`text-xs font-mono font-bold ${colorClass} tabular-nums`}>AQI {aqi}</span>
                </div>
                
                <div className="flex gap-0.5 h-3 w-full mb-2">
                    {[...Array(20)].map((_, i) => {
                        const threshold = i * (300/20);
                        const isActive = aqi >= threshold;
                        const segmentColor = threshold > 150 ? 'bg-rose-500' : threshold > 100 ? 'bg-orange-400' : threshold > 50 ? 'bg-yellow-400' : 'bg-emerald-500';
                        return (
                            <div 
                                key={i} 
                                className={`flex-1 rounded-sm transition-all duration-500 ${isActive ? segmentColor : 'bg-[#0f111a] border border-white/5'}`}
                                style={{ opacity: isActive ? 1 : 0.2 }}
                            ></div>
                        );
                    })}
                </div>

                <span className={`text-xl font-black ${colorClass} tracking-tighter uppercase drop-shadow-md`}>
                    {label}
                </span>
            </div>
        </div>
    );
};