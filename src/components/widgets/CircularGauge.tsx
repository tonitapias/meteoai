import { CircularGaugeProps } from './widgetTypes';
import { WIDGET_BASE_STYLE, TITLE_STYLE } from './widgetStyles';
import { safeVal } from './widgetHelpers';

export const CircularGauge = ({ icon, label, value, max, subText, color = "text-blue-400" }: CircularGaugeProps) => {
    const radius = 38;
    const circumference = 2 * Math.PI * radius; 
    const safeValue = value ?? 0;
    const offset = circumference - (Math.min(safeValue / max, 1) * circumference);
    const displayValue = safeVal(value);

    return (
        <div className={WIDGET_BASE_STYLE}>
            <div className={TITLE_STYLE}>{icon} {label}</div>
            <div className="relative w-full flex-1 flex items-center justify-center">
                 <div className="relative w-32 h-32 flex items-center justify-center">
                     <svg className="w-full h-full -rotate-90 drop-shadow-xl" viewBox="0 0 100 100">
                         <circle cx="50" cy="50" r={radius} fill="none" stroke="#0f111a" strokeWidth="8" strokeLinecap="round" className="opacity-50" />
                         <circle cx="50" cy="50" r={radius} fill="none" stroke="#1e293b" strokeWidth="8" strokeLinecap="round" />
                         <circle cx="50" cy="50" r={radius} fill="none" stroke="currentColor" strokeWidth="8" strokeLinecap="round" 
                            className={`${color} filter drop-shadow-[0_0_4px_rgba(255,255,255,0.3)]`}
                            style={{ strokeDasharray: circumference, strokeDashoffset: offset, transition: "stroke-dashoffset 1.5s cubic-bezier(0.34, 1.56, 0.64, 1)" }} />
                     </svg>
                     <div className="absolute flex flex-col items-center">
                         <span className="text-3xl font-black text-white tabular-nums tracking-tighter">{displayValue}</span>
                         {subText && <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider bg-white/5 px-2 py-0.5 rounded-full border border-white/5 mt-1">{subText}</span>}
                     </div>
                 </div>
            </div>
        </div>
    );
};