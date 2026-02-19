import { Mountain } from 'lucide-react';
import { WidgetProps } from './widgetTypes';
import { WIDGET_BASE_STYLE, TITLE_STYLE } from './widgetStyles';
import { getTrans } from './widgetHelpers';

export const SnowLevelWidget = ({ freezingLevel, unit, lang }: WidgetProps) => {
    const t = getTrans(lang);
    const hasData = freezingLevel !== null && freezingLevel !== undefined;
    const snowLimit = Math.max(0, (freezingLevel || 0) - 300);
    const isFt = unit === 'imperial' || unit === 'F';
    const displayLevel = hasData ? (isFt ? Math.round(snowLimit * 3.28084) : Math.round(snowLimit)) : '--';
    
    return (
        <div className={WIDGET_BASE_STYLE}>
            <div className={TITLE_STYLE}><Mountain className="w-3.5 h-3.5 text-indigo-300" /> {t.snowLevel || "COTA NEU"}</div>
            <div className="flex-1 flex flex-col items-center justify-center relative overflow-hidden rounded-xl">
                <div className="absolute inset-0 flex items-end justify-center opacity-20">
                    <svg viewBox="0 0 100 60" className="w-full h-full text-indigo-500 fill-current" preserveAspectRatio="none">
                        <path d="M50 10 L100 60 L0 60 Z" />
                    </svg>
                </div>
                <div className="absolute top-[40%] w-full border-t border-dashed border-indigo-300/30"></div>
                <div className="z-10 text-center flex flex-col items-center">
                    <span className="text-5xl font-black text-white tracking-tighter tabular-nums drop-shadow-xl">{displayLevel}</span>
                    <div className="flex items-center gap-1 mt-1 bg-[#0f111a]/80 px-2 py-0.5 rounded border border-white/10 backdrop-blur-sm">
                        <span className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-pulse"></span>
                        <span className="text-[9px] font-bold text-indigo-200 uppercase tracking-widest">{isFt ? 'FT' : 'METRES'}</span>
                    </div>
                </div>
            </div>
        </div>
    );
};