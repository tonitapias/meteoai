import { useState, useEffect, useMemo } from 'react';
import { Sunrise } from 'lucide-react';
import { WidgetProps } from './widgetTypes';
import { WIDGET_BASE_STYLE, TITLE_STYLE } from './widgetStyles';
import { getTrans, timeStringToSeconds, secondsToTime } from './widgetHelpers';

export const SunArcWidget = ({ sunrise, sunset, lang, utcOffset }: WidgetProps) => {
    const t = getTrans(lang);
    const [currentTimeSeconds, setCurrentTimeSeconds] = useState<number>(() => Math.floor(Date.now() / 1000));

    // DOCTRINA RISC ZERO: Erradicació del "@ts-expect-error" i blindatge de textos
    const tRecord = (typeof t === 'object' && t !== null) ? (t as Record<string, unknown>) : {};
    const titleSunCycle = typeof tRecord.sunCycle === 'string' ? tRecord.sunCycle : "CICLE SOLAR";
    const labelSunrise = typeof tRecord.sunrise === 'string' ? tRecord.sunrise : "SORTIDA";
    const labelSunset = typeof tRecord.sunset === 'string' ? tRecord.sunset : "POSTA";

    useEffect(() => {
        const timer = setInterval(() => {
             setCurrentTimeSeconds(Math.floor(Date.now() / 1000));
        }, 60000); 
        return () => clearInterval(timer);
    }, []);

    const { sunPosition, progressPercent, statusText, countdown, isDaytime, displaySunrise, displaySunset } = useMemo(() => {
        if (!sunrise || !sunset) return { 
            sunPosition: { x: 0, y: 100 }, progressPercent: 0, statusText: '--', countdown: '--h --m', isDaytime: true, displaySunrise: '--:--', displaySunset: '--:--'
        };

        const localNowTotalSeconds = currentTimeSeconds + (typeof utcOffset === 'number' ? utcOffset : 0);
        const currentSecondsOfDay = localNowTotalSeconds % 86400;

        const sunriseSeconds = timeStringToSeconds(sunrise);
        const sunsetSeconds = timeStringToSeconds(sunset);

        let diffSeconds = 0;
        let nextEventLabel = "";
        let isDay = false;
        let pct = 0;

        if (currentSecondsOfDay >= sunriseSeconds && currentSecondsOfDay < sunsetSeconds) {
            isDay = true;
            nextEventLabel = lang === 'ca' ? "Posta de sol en" : "Sunset in";
            diffSeconds = sunsetSeconds - currentSecondsOfDay;
            // Risc Zero: Protegim contra divisió per zero si sortida i posta fossin la mateixa (ex: pols)
            const dayDuration = Math.max(1, sunsetSeconds - sunriseSeconds);
            pct = (currentSecondsOfDay - sunriseSeconds) / dayDuration;
        } else {
            isDay = false;
            nextEventLabel = lang === 'ca' ? "Sortida en" : "Sunrise in";
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
        // Coordenades tàctiques de la paràbola SVG
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

    // Spatial UI aplicat al fons
    const SPATIAL_WIDGET_STYLE = `${WIDGET_BASE_STYLE} backdrop-blur-md bg-gradient-to-br from-[#0f111a]/90 to-black border border-white/10 shadow-[0_8px_32px_rgba(0,0,0,0.5)] transform-gpu`;

    return (
        <div className={SPATIAL_WIDGET_STYLE}>
             <div className="flex justify-between items-start w-full z-10 p-1">
                <div className={`${TITLE_STYLE.replace('mb-4', 'mb-0')} flex items-center gap-1.5`}>
                    <Sunrise className="w-4 h-4 text-amber-400 drop-shadow-[0_0_8px_rgba(251,191,36,0.5)]" />
                    <span className="tracking-wider">
                        {titleSunCycle}
                    </span>
                </div>
                <div className="flex flex-col items-end bg-black/40 px-2.5 py-1 rounded-md border border-white/5 backdrop-blur-sm">
                    <span className="text-[9px] text-slate-400 font-bold uppercase tracking-widest">{statusText}</span>
                    <div className="flex items-center gap-1.5 mt-0.5">
                        <span className={`w-1.5 h-1.5 rounded-full animate-pulse ${isDaytime ? 'bg-amber-400 shadow-[0_0_6px_#fbbf24]' : 'bg-indigo-400 shadow-[0_0_6px_#818cf8]'}`}></span>
                        <span className={`text-xs font-mono font-black tabular-nums tracking-wide ${isDaytime ? 'text-amber-300' : 'text-indigo-300'}`}>
                            {countdown}
                        </span>
                    </div>
                </div>
             </div>

             <div className="relative flex-1 w-full flex items-center justify-center mt-4">
                 <svg className="w-full h-28 overflow-visible" viewBox="0 0 100 100" preserveAspectRatio="none">
                     <defs>
                        <linearGradient id="arcGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                            <stop offset="0%" stopColor="#4f46e5" stopOpacity="0.4" />
                            <stop offset="50%" stopColor="#fbbf24" stopOpacity="0.9" />
                            <stop offset="100%" stopColor="#4f46e5" stopOpacity="0.4" />
                        </linearGradient>
                        <filter id="tacticalGlow" x="-50%" y="-50%" width="200%" height="200%">
                            <feGaussianBlur stdDeviation="3" result="coloredBlur"/>
                            <feMerge>
                                <feMergeNode in="coloredBlur"/>
                                <feMergeNode in="SourceGraphic"/>
                            </feMerge>
                        </filter>
                     </defs>

                     {/* Ruta de fons */}
                     <path d="M 10,90 Q 50,10 90,90" fill="none" stroke="#1e293b" strokeWidth="2" strokeDasharray="4 4" strokeLinecap="round" />
                     
                     {/* Ruta de progrés il·luminada */}
                     <path 
                        d="M 10,90 Q 50,10 90,90" 
                        fill="none" 
                        stroke="url(#arcGradient)" 
                        strokeWidth="3.5" 
                        strokeLinecap="round"
                        strokeDasharray="135" 
                        strokeDashoffset={135 - (135 * (isDaytime ? progressPercent / 100 : 0))} 
                        className="transition-all duration-1000 ease-out opacity-90"
                     />

                     {/* Sol o Lluna dinàmic */}
                     <g style={{ transform: `translate(${sunPosition.x}px, ${sunPosition.y}px)`, transition: 'transform 1s cubic-bezier(0.4, 0, 0.2, 1)' }}>
                        <circle r="9" fill={isDaytime ? "#fbbf24" : "#4f46e5"} className="opacity-20 animate-pulse" />
                        <circle r="4" fill={isDaytime ? "#ffffff" : "#c7d2fe"} filter="url(#tacticalGlow)" />
                     </g>
                 </svg>

                 {/* Horitzó espacial */}
                 <div className="absolute bottom-0 w-full h-[2px] bg-gradient-to-r from-transparent via-slate-500/30 to-transparent"></div>
             </div>
             
             <div className="flex justify-between items-end w-full mt-3 px-2">
                 <div className="flex flex-col items-start gap-1">
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">{labelSunrise}</span>
                    <span className="text-[13px] font-mono font-black text-white tabular-nums bg-[#0f111a] px-2.5 py-1 rounded border border-white/10 shadow-inner">
                        {displaySunrise}
                    </span>
                 </div>
                 
                 <div className="flex flex-col items-end gap-1">
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">{labelSunset}</span>
                    <span className="text-[13px] font-mono font-black text-white tabular-nums bg-[#0f111a] px-2.5 py-1 rounded border border-white/10 shadow-inner">
                        {displaySunset}
                    </span>
                 </div>
             </div>
        </div>
    );
};