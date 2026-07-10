import { useState, useEffect, useMemo } from 'react';
import { Sunrise, CloudOff } from 'lucide-react';
import { WidgetProps } from './widgetTypes';
import { WIDGET_BASE_STYLE, TITLE_STYLE } from './widgetStyles';
import { getTrans, timeStringToSeconds, secondsToTime } from './widgetHelpers';

export const SunArcWidget = ({ sunrise, sunset, lang, utcOffset }: WidgetProps) => {
    // DOCTRINA RISC ZERO: Erradicació del "@ts-expect-error" i blindatge de textos
    const t = getTrans(lang) as Record<string, unknown>;
    const titleSunCycle = typeof t.sunCycle === 'string' ? t.sunCycle : "CICLE SOLAR";
    const labelSunrise = typeof t.sunrise === 'string' ? t.sunrise : "SORTIDA";
    const labelSunset = typeof t.sunset === 'string' ? t.sunset : "POSTA";
    const tNoData = lang === 'ca' ? "SENSE DADES" : (lang === 'en' ? "NO DATA" : "SIN DATOS");

    const [currentTimeSeconds, setCurrentTimeSeconds] = useState<number>(() => Math.floor(Date.now() / 1000));

    useEffect(() => {
        const timer = setInterval(() => {
             setCurrentTimeSeconds(Math.floor(Date.now() / 1000));
        }, 60000); 
        return () => clearInterval(timer);
    }, []);

    // Risc Zero: Validació estricta de format d'hora abans d'operar matemàticament
    const isValidTime = (tStr?: string) => typeof tStr === 'string' && tStr.includes(':') && tStr.length >= 4;
    const hasValidData = isValidTime(sunrise) && isValidTime(sunset);

    const { sunPosition, progressPercent, statusText, countdown, isDaytime, displaySunrise, displaySunset } = useMemo(() => {
        // Fallback robust d'interfície si falla l'API
        if (!hasValidData || !sunrise || !sunset) {
            return { 
                sunPosition: { x: 50, y: 90 }, // Posatíem l'indicador mort al centre baix
                progressPercent: 0, 
                statusText: tNoData, 
                countdown: '--h --m', 
                isDaytime: false, 
                displaySunrise: '--:--', 
                displaySunset: '--:--'
            };
        }

        const localNowTotalSeconds = currentTimeSeconds + (typeof utcOffset === 'number' ? utcOffset : 0);
        const currentSecondsOfDay = localNowTotalSeconds % 86400;

        const sunriseSeconds = timeStringToSeconds(sunrise);
        const sunsetSeconds = timeStringToSeconds(sunset);

        // Si l'extracció de segons ha retornat NaN, abortem i fallback
        if (isNaN(sunriseSeconds) || isNaN(sunsetSeconds)) {
             return { sunPosition: { x: 50, y: 90 }, progressPercent: 0, statusText: tNoData, countdown: '--h --m', isDaytime: false, displaySunrise: '--:--', displaySunset: '--:--' };
        }

        let diffSeconds = 0;
        let nextEventLabel = "";
        let isDay = false;
        let pct = 0;

        if (currentSecondsOfDay >= sunriseSeconds && currentSecondsOfDay < sunsetSeconds) {
            isDay = true;
            nextEventLabel = lang === 'ca' ? "Posta de sol en" : "Sunset in";
            diffSeconds = sunsetSeconds - currentSecondsOfDay;
            // Risc Zero: Protegim contra divisió per zero si sortida i posta fossin idèntiques
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
    }, [currentTimeSeconds, sunrise, sunset, lang, utcOffset, hasValidData, tNoData]);

    // SPATIAL UI BASE AMB MATRIU DE FONS
    const bgGlow = hasValidData 
        ? (isDaytime ? "from-amber-950/20 to-black/90" : "from-indigo-950/20 to-black/90")
        : "from-slate-900/50 to-black/80";
        
    const SPATIAL_WIDGET_STYLE = `${WIDGET_BASE_STYLE} relative overflow-hidden backdrop-blur-md bg-gradient-to-br transition-colors duration-1000 ${bgGlow} border ${hasValidData ? 'border-white/5' : 'border-slate-700/50'} shadow-[0_8px_32px_rgba(0,0,0,0.5)] transform-gpu select-none`;
    const MATRIX_BG = `absolute inset-0 z-0 opacity-[0.03] pointer-events-none bg-[linear-gradient(to_right,#ffffff_1px,transparent_1px),linear-gradient(to_bottom,#ffffff_1px,transparent_1px)] bg-[size:12px_12px]`;

    return (
        <div className={SPATIAL_WIDGET_STYLE}>
             <div className={MATRIX_BG}></div>

             <div className="flex justify-between items-start w-full z-10 p-1 relative">
                <div className={`${TITLE_STYLE.replace('mb-4', 'mb-0')} flex items-center gap-1.5`}>
                    {hasValidData ? (
                        <Sunrise className={`w-4 h-4 transition-colors duration-500 ${isDaytime ? 'text-amber-400 drop-shadow-[0_0_8px_rgba(251,191,36,0.5)]' : 'text-indigo-400 drop-shadow-[0_0_8px_rgba(129,140,248,0.5)]'}`} />
                    ) : (
                        <CloudOff className="w-4 h-4 text-slate-500" />
                    )}
                    <span className="tracking-wider text-slate-200">
                        {titleSunCycle}
                    </span>
                </div>
                <div className={`flex flex-col items-end px-2.5 py-1 rounded-md border backdrop-blur-sm transition-colors duration-500 ${hasValidData ? 'bg-black/40 border-white/5' : 'bg-slate-800/40 border-slate-700/50'}`}>
                    <span className={`text-[9px] font-bold uppercase tracking-widest transition-colors duration-500 ${hasValidData ? 'text-slate-400' : 'text-slate-500'}`}>
                        {statusText}
                    </span>
                    <div className="flex items-center gap-1.5 mt-0.5">
                        {hasValidData ? (
                            <span className={`w-1.5 h-1.5 rounded-full animate-pulse transition-colors duration-500 ${isDaytime ? 'bg-amber-400 shadow-[0_0_6px_#fbbf24]' : 'bg-indigo-400 shadow-[0_0_6px_#818cf8]'}`}></span>
                        ) : (
                            <span className="w-1.5 h-1.5 rounded-full bg-slate-600"></span>
                        )}
                        <span className={`text-xs font-mono font-black tabular-nums tracking-wide transition-colors duration-500 ${hasValidData ? (isDaytime ? 'text-amber-300' : 'text-indigo-300') : 'text-slate-500'}`}>
                            {countdown}
                        </span>
                    </div>
                </div>
             </div>

             <div className="relative flex-1 w-full flex items-center justify-center mt-4 z-10">
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

                     {/* Ruta de fons (Òrbita passiva) */}
                     <path 
                        d="M 10,90 Q 50,10 90,90" 
                        fill="none" 
                        stroke="#1e293b" 
                        strokeWidth="2" 
                        strokeDasharray="4 4" 
                        strokeLinecap="round" 
                     />
                     
                     {/* Marca del Migdia Solar (Zenit) */}
                     {hasValidData && (
                         <line x1="50" y1="8" x2="50" y2="12" stroke="#475569" strokeWidth="2" strokeLinecap="round" />
                     )}

                     {/* Ruta de progrés il·luminada (S'apaga si no hi ha dades) */}
                     {hasValidData && (
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
                     )}

                     {/* Sol o Lluna dinàmic (S'amaga si no hi ha dades) */}
                     {hasValidData && (
                         <g style={{ transform: `translate(${sunPosition.x}px, ${sunPosition.y}px)`, transition: 'transform 1s cubic-bezier(0.4, 0, 0.2, 1)' }}>
                            <circle r="9" fill={isDaytime ? "#fbbf24" : "#4f46e5"} className="opacity-20 animate-pulse" />
                            <circle r="4" fill={isDaytime ? "#ffffff" : "#c7d2fe"} filter="url(#tacticalGlow)" />
                         </g>
                     )}
                 </svg>

                 {/* Horitzó espacial */}
                 <div className="absolute bottom-0 w-full h-[2px] bg-gradient-to-r from-transparent via-slate-500/30 to-transparent"></div>
             </div>
             
             <div className="flex justify-between items-end w-full mt-3 px-2 z-10 relative">
                 <div className="flex flex-col items-start gap-1">
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">{labelSunrise}</span>
                    <span className={`text-[13px] font-mono font-black tabular-nums px-2.5 py-1 rounded border shadow-inner transition-colors duration-500 ${hasValidData ? 'text-white bg-[#0f111a] border-white/10' : 'text-slate-600 bg-slate-900/50 border-slate-700/50'}`}>
                        {displaySunrise}
                    </span>
                 </div>
                 
                 <div className="flex flex-col items-end gap-1">
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">{labelSunset}</span>
                    <span className={`text-[13px] font-mono font-black tabular-nums px-2.5 py-1 rounded border shadow-inner transition-colors duration-500 ${hasValidData ? 'text-white bg-[#0f111a] border-white/10' : 'text-slate-600 bg-slate-900/50 border-slate-700/50'}`}>
                        {displaySunset}
                    </span>
                 </div>
             </div>
        </div>
    );
};