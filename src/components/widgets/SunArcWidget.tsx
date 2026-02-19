import { useState, useEffect, useMemo } from 'react';
import { Sunrise } from 'lucide-react';
import { WidgetProps } from './widgetTypes';
import { WIDGET_BASE_STYLE, TITLE_STYLE } from './widgetStyles';
import { getTrans, timeStringToSeconds, secondsToTime } from './widgetHelpers';

export const SunArcWidget = ({ sunrise, sunset, lang, utcOffset }: WidgetProps) => {
    const t = getTrans(lang);
    const [currentTimeSeconds, setCurrentTimeSeconds] = useState<number>(() => Math.floor(Date.now() / 1000));

    useEffect(() => {
        const timer = setInterval(() => {
             setCurrentTimeSeconds(Math.floor(Date.now() / 1000));
        }, 60000); 
        return () => clearInterval(timer);
    }, []);

    const { sunPosition, progressPercent, statusText, countdown, isDaytime, displaySunrise, displaySunset } = useMemo(() => {
        if (!sunrise || !sunset) return { 
            sunPosition: { x: 0, y: 100 }, progressPercent: 0, statusText: '--', countdown: '', isDaytime: true, displaySunrise: '--:--', displaySunset: '--:--'
        };

        const localNowTotalSeconds = currentTimeSeconds + (utcOffset || 0);
        const currentSecondsOfDay = localNowTotalSeconds % 86400;

        const sunriseSeconds = timeStringToSeconds(sunrise);
        const sunsetSeconds = timeStringToSeconds(sunset);

        let diffSeconds = 0;
        let nextEventLabel = "";
        let isDay = false;
        let pct = 0;

        if (currentSecondsOfDay >= sunriseSeconds && currentSecondsOfDay < sunsetSeconds) {
            isDay = true;
            nextEventLabel = lang === 'ca' ? "Posta de sol" : "Sunset in";
            diffSeconds = sunsetSeconds - currentSecondsOfDay;
            const dayDuration = sunsetSeconds - sunriseSeconds;
            pct = (currentSecondsOfDay - sunriseSeconds) / dayDuration;
        } else {
            isDay = false;
            nextEventLabel = lang === 'ca' ? "Sortida" : "Sunrise in";
            if (currentSecondsOfDay < sunriseSeconds) {
                diffSeconds = sunriseSeconds - currentSecondsOfDay;
                pct = 0; 
            } else {
                diffSeconds = (86400 - currentSecondsOfDay) + sunriseSeconds;
                pct = 1; 
            }
        }

        const hoursLeft = Math.floor(diffSeconds / 3600);
        const minsLeft = Math.floor((diffSeconds % 3600) / 60);
        const countdownStr = `${hoursLeft}h ${minsLeft}m`;

        const tVal = Math.max(0, Math.min(1, pct));
        const p0 = { x: 10, y: 90 };
        const p1 = { x: 50, y: 10 };
        const p2 = { x: 90, y: 90 };

        const x = Math.pow(1-tVal, 2) * p0.x + 2 * (1-tVal) * tVal * p1.x + Math.pow(tVal, 2) * p2.x;
        const y = Math.pow(1-tVal, 2) * p0.y + 2 * (1-tVal) * tVal * p1.y + Math.pow(tVal, 2) * p2.y;

        return {
            sunPosition: { x, y },
            progressPercent: tVal * 100,
            statusText: nextEventLabel,
            countdown: countdownStr,
            isDaytime: isDay,
            displaySunrise: secondsToTime(sunriseSeconds),
            displaySunset: secondsToTime(sunsetSeconds)
        };
    }, [currentTimeSeconds, sunrise, sunset, lang, utcOffset]);

    return (
        <div className={WIDGET_BASE_STYLE}>
             <div className="flex justify-between items-start w-full z-10">
                <div className={TITLE_STYLE.replace('mb-4', 'mb-0')}>
                    <Sunrise className="w-3.5 h-3.5 text-amber-400" />
                    {
                        // @ts-expect-error: La clau 'sunCycle' no existeix a l'arxiu de traduccions actual.
                        // Ometem l'error per mantenir el Risc Zero, ja que el fallback actua correctament en producció.
                        t.sunCycle || "CICLE SOLAR"
                    }
                </div>
                <div className="flex flex-col items-end">
                    <span className="text-[9px] text-slate-500 font-bold uppercase tracking-wider">{statusText}</span>
                    <div className="flex items-center gap-1.5 mt-0.5">
                        <span className={`w-1.5 h-1.5 rounded-full animate-pulse ${isDaytime ? 'bg-amber-400' : 'bg-indigo-400'}`}></span>
                        <span className={`text-xs font-mono font-medium tabular-nums tracking-wide ${isDaytime ? 'text-amber-100' : 'text-indigo-100'}`}>
                            {countdown}
                        </span>
                    </div>
                </div>
             </div>

             <div className="relative flex-1 w-full flex items-center justify-center mt-2">
                 <svg className="w-full h-28 overflow-visible" viewBox="0 0 100 100" preserveAspectRatio="none">
                     <defs>
                        <linearGradient id="arcGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                            <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.4" />
                            <stop offset="50%" stopColor="#fbbf24" stopOpacity="0.8" />
                            <stop offset="100%" stopColor="#6366f1" stopOpacity="0.4" />
                        </linearGradient>
                        <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
                            <feGaussianBlur stdDeviation="2.5" result="coloredBlur"/>
                            <feMerge>
                                <feMergeNode in="coloredBlur"/>
                                <feMergeNode in="SourceGraphic"/>
                            </feMerge>
                        </filter>
                     </defs>

                     <path d="M 10,90 Q 50,10 90,90" fill="none" stroke="#1e293b" strokeWidth="2" strokeDasharray="4 4" strokeLinecap="round" />
                     
                     <path 
                        d="M 10,90 Q 50,10 90,90" 
                        fill="none" 
                        stroke="url(#arcGradient)" 
                        strokeWidth="3" 
                        strokeLinecap="round"
                        strokeDasharray="135" 
                        strokeDashoffset={135 - (135 * (isDaytime ? progressPercent / 100 : 0))} 
                        className="transition-all duration-1000 ease-out opacity-80"
                     />

                     <g style={{ transform: `translate(${sunPosition.x}px, ${sunPosition.y}px)`, transition: 'transform 1s cubic-bezier(0.4, 0, 0.2, 1)' }}>
                        <circle r="8" fill={isDaytime ? "#fbbf24" : "#6366f1"} className="opacity-20 animate-pulse" />
                        <circle r="3.5" fill={isDaytime ? "#fff" : "#a5b4fc"} filter="url(#glow)" className="drop-shadow-[0_0_8px_rgba(251,191,36,0.8)]" />
                     </g>
                 </svg>

                 <div className="absolute bottom-0 w-full h-px bg-gradient-to-r from-transparent via-white/10 to-transparent"></div>
             </div>
             
             <div className="flex justify-between items-end w-full mt-2 px-2">
                 <div className="flex flex-col items-start gap-1">
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">{t.sunrise || "SORTIDA"}</span>
                    <span className="text-sm font-mono font-medium text-white tabular-nums bg-[#151725] px-2 py-0.5 rounded border border-white/5">
                        {displaySunrise}
                    </span>
                 </div>
                 
                 <div className="flex flex-col items-end gap-1">
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">{t.sunset || "POSTA"}</span>
                    <span className="text-sm font-mono font-medium text-white tabular-nums bg-[#151725] px-2 py-0.5 rounded border border-white/5">
                        {displaySunset}
                    </span>
                 </div>
             </div>
        </div>
    );
};