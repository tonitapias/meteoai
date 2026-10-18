import { useState, useEffect, useMemo } from 'react';
import { Sunrise, CloudOff } from 'lucide-react';
import type { Language } from '../../translations';
import { WidgetProps } from './widgetTypes';
import { WIDGET_BASE_STYLE, TITLE_STYLE, MATRIX_BG } from './widgetStyles';
import { getTrans, timeStringToSeconds, secondsToTime } from './widgetHelpers';

// Textos propis de la targeta en els 4 idiomes. El títol és el mateix que el del modal Cicle solar i les
// etiquetes del compte enrere, les mateixes que les seves (sense el temps). Còpia local a propòsit: el
// diccionari del modal (solarI18n) viu al seu tros de codi diferit i no s'ha d'arrossegar fins aquí.
const SUN_ARC_TEXT: Readonly<Record<Language, { title: string; sunriseIn: string; sunsetIn: string; noData: string }>> = {
    ca: { title: 'CICLE SOLAR', sunriseIn: 'Sortida en', sunsetIn: 'Posta de sol en', noData: 'SENSE DADES' },
    es: { title: 'CICLO SOLAR', sunriseIn: 'Salida del sol en', sunsetIn: 'Puesta de sol en', noData: 'SIN DATOS' },
    en: { title: 'SUN CYCLE', sunriseIn: 'Sunrise in', sunsetIn: 'Sunset in', noData: 'NO DATA' },
    fr: { title: 'CYCLE SOLAIRE', sunriseIn: 'Lever du soleil dans', sunsetIn: 'Coucher du soleil dans', noData: 'PAS DE DONNÉES' },
};

// nextSunrise: sortida de demà (daily.sunrise[1]). Després de la posta, el compte enrere hi apunta.
export const SunArcWidget = ({ sunrise, sunset, nextSunrise, lang, utcOffset }: WidgetProps) => {
    // DOCTRINA RISC ZERO: Erradicació del "@ts-expect-error" i blindatge de textos
    const t = getTrans(lang) as Record<string, unknown>;
    const text = SUN_ARC_TEXT[lang] ?? SUN_ARC_TEXT.ca;
    const titleSunCycle = text.title;
    const labelSunrise = typeof t.sunrise === 'string' ? t.sunrise : "SORTIDA";
    const labelSunset = typeof t.sunset === 'string' ? t.sunset : "POSTA";
    const tNoData = text.noData;

    const [currentTimeSeconds, setCurrentTimeSeconds] = useState<number>(() => Math.floor(Date.now() / 1000));

    // Rellotge alineat amb el canvi de minut: les hores d'Open-Meteo són minuts sencers i el compte enrere
    // arrodoneix avall, així que només canvia a hh:mm:00. Amb un interval des del muntatge la targeta anava
    // fins a 59 s endarrerida i, en obrir el modal Cicle solar (que calcula des d'ara mateix), la meitat de
    // les vegades s'hi veia un minut menys. Cada tic es torna a alinear (+50 ms de marge per si s'avança).
    useEffect(() => {
        let timer: ReturnType<typeof setTimeout>;
        const schedule = () => {
            timer = setTimeout(() => {
                setCurrentTimeSeconds(Math.floor(Date.now() / 1000));
                schedule();
            }, 60000 - (Date.now() % 60000) + 50);
        };
        schedule();
        return () => clearTimeout(timer);
    }, []);

    // Risc Zero: Validació estricta de format d'hora abans d'operar matemàticament
    const isValidTime = (tStr?: string) => typeof tStr === 'string' && tStr.includes(':') && tStr.length >= 4;
    const hasValidData = isValidTime(sunrise) && isValidTime(sunset);
    const tomorrowSunrise: string | undefined = isValidTime(nextSunrise) ? nextSunrise : undefined;

    const { sunPosition, litPath, statusText, countdown, isDaytime, displaySunrise, displaySunset } = useMemo(() => {
        // Fallback robust d'interfície si falla l'API
        if (!hasValidData || !sunrise || !sunset) {
            return {
                sunPosition: { x: 50, y: 90 },
                litPath: null,
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
             return { sunPosition: { x: 50, y: 90 }, litPath: null, statusText: tNoData, countdown: '--h --m', isDaytime: false, displaySunrise: '--:--', displaySunset: '--:--' };
        }

        let diffSeconds = 0;
        let nextEventLabel = "";
        let isDay = false;
        let pct = 0;

        if (currentSecondsOfDay >= sunriseSeconds && currentSecondsOfDay < sunsetSeconds) {
            isDay = true;
            nextEventLabel = text.sunsetIn;
            diffSeconds = sunsetSeconds - currentSecondsOfDay;
            // Risc Zero: Protegim contra divisió per zero si sortida i posta fossin idèntiques
            const dayDuration = Math.max(1, sunsetSeconds - sunriseSeconds);
            pct = (currentSecondsOfDay - sunriseSeconds) / dayDuration;
        } else {
            isDay = false;
            nextEventLabel = text.sunriseIn;
            if (currentSecondsOfDay < sunriseSeconds) {
                diffSeconds = sunriseSeconds - currentSecondsOfDay;
                pct = 0; 
            } else {
                // Després de la posta compta fins a la sortida de DEMÀ (abans reutilitzava la d'avui, 1-2 min
                // de diferència amb el modal). Sense l'hora de demà, es manté la d'avui com a aproximació.
                const tomorrowSeconds = tomorrowSunrise ? timeStringToSeconds(tomorrowSunrise) : NaN;
                diffSeconds = (86400 - currentSecondsOfDay) + (isNaN(tomorrowSeconds) ? sunriseSeconds : tomorrowSeconds);
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

        // Tram il·luminat = la mateixa corba retallada exactament al sol (de Casteljau: la subcorba [0, t]
        // d'una quadràtica té per control el punt a t del segment p0→p1). Abans era un traç discontinu de
        // 135 unitats sobre una corba de 118,3 (i t no és proporcional a la longitud): a la tarda la línia
        // anava fins a un 17 % de l'arc per davant del sol i, cap al final del dia, el cobria sencer.
        const litPath = isDay && tVal > 0
            ? `M ${p0.x},${p0.y} Q ${p0.x + (p1.x - p0.x) * tVal},${p0.y + (p1.y - p0.y) * tVal} ${x},${y}`
            : null;

        return {
            sunPosition: { x, y },
            litPath,
            statusText: nextEventLabel,
            countdown: countdownStr,
            isDaytime: isDay,
            displaySunrise: secondsToTime(sunriseSeconds),
            displaySunset: secondsToTime(sunsetSeconds)
        };
    }, [currentTimeSeconds, sunrise, sunset, tomorrowSunrise, utcOffset, hasValidData, tNoData, text]);

    // SPATIAL UI BASE AMB MOTOR 3D ACTIVAT
    const bgGlow = hasValidData 
        ? (isDaytime ? "from-amber-950/20 to-black/90" : "from-indigo-950/20 to-black/90")
        : "from-slate-900/50 to-black/80";
        
    // Injecció de [perspective:1200px] i [transform-style:preserve-3d] per crear la "càmera"
    const SPATIAL_WIDGET_STYLE = `${WIDGET_BASE_STYLE} relative overflow-hidden backdrop-blur-md bg-gradient-to-br transition-colors duration-1000 ${bgGlow} border ${hasValidData ? 'border-white/5' : 'border-slate-700/50'} shadow-[0_8px_32px_rgba(0,0,0,0.5)] transform-gpu select-none [perspective:1200px] [transform-style:preserve-3d]`;

    return (
        <div className={SPATIAL_WIDGET_STYLE}>
             <div className={MATRIX_BG}></div>

             {/* CAPA FRONTAL SUPERIOR (Cognició): Es desplaça cap a l'usuari amb translateZ */}
             <div className="flex justify-between items-start w-full z-20 p-1 relative [transform:translateZ(40px)] [transform-style:preserve-3d]">
                <div className={`${TITLE_STYLE.replace('mb-4', 'mb-0')} flex items-center gap-1.5 shadow-black drop-shadow-md`}>
                    {hasValidData ? (
                        <Sunrise className={`w-4 h-4 transition-colors duration-500 ${isDaytime ? 'text-amber-400 drop-shadow-[0_0_8px_rgba(251,191,36,0.6)]' : 'text-indigo-400 drop-shadow-[0_0_8px_rgba(129,140,248,0.6)]'}`} />
                    ) : (
                        <CloudOff className="w-4 h-4 text-slate-500" />
                    )}
                    <span className="tracking-wider text-slate-200">
                        {titleSunCycle}
                    </span>
                </div>
                
                {/* Targeta flotant amb contrast alt per llegibilitat extrema */}
                <div className={`flex flex-col items-end px-3 py-1.5 rounded-lg border backdrop-blur-md transition-all duration-500 shadow-[0_8px_16px_rgba(0,0,0,0.6)] ${hasValidData ? 'bg-black/60 border-white/10' : 'bg-slate-800/60 border-slate-700/50'}`}>
                    <span className={`text-[9px] font-bold uppercase tracking-widest transition-colors duration-500 ${hasValidData ? 'text-slate-400' : 'text-slate-500'}`}>
                        {statusText}
                    </span>
                    <div className="flex items-center gap-1.5 mt-0.5">
                        {hasValidData ? (
                            <span className={`w-1.5 h-1.5 rounded-full animate-pulse transition-colors duration-500 ${isDaytime ? 'bg-amber-400 shadow-[0_0_8px_#fbbf24]' : 'bg-indigo-400 shadow-[0_0_8px_#818cf8]'}`}></span>
                        ) : (
                            <span className="w-1.5 h-1.5 rounded-full bg-slate-600"></span>
                        )}
                        <span className={`text-xs font-mono font-black tabular-nums tracking-wide transition-colors duration-500 ${hasValidData ? (isDaytime ? 'text-amber-300' : 'text-indigo-300') : 'text-slate-500'}`}>
                            {countdown}
                        </span>
                    </div>
                </div>
             </div>

             {/* CAPA TÀCTICA ISOMÈTRICA: El gràfic rotat i incrustat. Alçada a h-36 per compensar la rotació */}
             <div className="relative flex-1 w-full flex items-center justify-center mt-3 z-10 [transform:rotateX(40deg)_translateZ(10px)] [transform-style:preserve-3d]">
                 <svg className="w-full h-36 overflow-visible" viewBox="0 0 100 100" preserveAspectRatio="none">
                     <defs>
                        {/* En coordenades de l'arc sencer (10→90): el tram il·luminat és més curt que l'arc i,
                            amb objectBoundingBox, el degradat s'hauria comprimit dins del tram. */}
                        <linearGradient id="arcGradient" gradientUnits="userSpaceOnUse" x1="10" y1="0" x2="90" y2="0">
                            <stop offset="0%" stopColor="#4f46e5" stopOpacity="0.3" />
                            <stop offset="50%" stopColor="#fbbf24" stopOpacity="1" />
                            <stop offset="100%" stopColor="#4f46e5" stopOpacity="0.3" />
                        </linearGradient>
                        <filter id="tacticalGlow" x="-50%" y="-50%" width="200%" height="200%">
                            <feGaussianBlur stdDeviation="3.5" result="coloredBlur"/>
                            <feMerge>
                                <feMergeNode in="coloredBlur"/>
                                <feMergeNode in="SourceGraphic"/>
                            </feMerge>
                        </filter>
                     </defs>

                     {/* Base de la projecció tàctica (Horitzó isométric) */}
                     <line x1="5" y1="90" x2="95" y2="90" stroke="#1e293b" strokeWidth="1" strokeDasharray="1 3" />

                     {/* Ruta de fons (Òrbita passiva completa) */}
                     <path 
                        d="M 10,90 Q 50,10 90,90" 
                        fill="none" 
                        stroke="#1e293b" 
                        strokeWidth="2" 
                        strokeDasharray="3 4" 
                        strokeLinecap="round" 
                     />
                     
                     {/* Marca del Migdia Solar (Zenit topogràfic) */}
                     {hasValidData && (
                         <line x1="50" y1="90" x2="50" y2="10" stroke="#334155" strokeWidth="1" strokeDasharray="2 4" className="opacity-50" />
                     )}

                     {/* Ruta de progrés il·luminada */}
                     {litPath && (
                         <path
                            d={litPath}
                            fill="none"
                            stroke="url(#arcGradient)"
                            strokeWidth="3.5"
                            strokeLinecap="round"
                            className="opacity-95 drop-shadow-[0_0_10px_rgba(251,191,36,0.2)]"
                            data-testid="sun-arc-lit"
                         />
                     )}

                     {/* Línia de Balisa (Volumetria Vertical): Causa l'efecte que el sol flota sobre el mapa */}
                     {hasValidData && (
                         <line 
                            x1={sunPosition.x} y1="90" 
                            x2={sunPosition.x} y2={sunPosition.y} 
                            stroke={isDaytime ? "#fbbf24" : "#818cf8"} 
                            strokeWidth="1.5" 
                            strokeDasharray="2 2" 
                            className="opacity-50 transition-all duration-1000"
                         />
                     )}

                     {/* Sol o Lluna dinàmic amb emissió */}
                     {hasValidData && (
                         <g style={{ transform: `translate(${sunPosition.x}px, ${sunPosition.y}px)`, transition: 'transform 1s cubic-bezier(0.4, 0, 0.2, 1)' }}>
                            <circle r="9" fill={isDaytime ? "#fbbf24" : "#4f46e5"} className="opacity-25 animate-pulse" />
                            <circle r="4.5" fill={isDaytime ? "#ffffff" : "#c7d2fe"} filter="url(#tacticalGlow)" />
                         </g>
                     )}
                 </svg>

                 {/* Horitzó espacial profund (Glow base) */}
                 <div className="absolute bottom-2 w-full h-[2px] bg-gradient-to-r from-transparent via-cyan-900/40 to-transparent blur-sm"></div>
             </div>
             
             {/* CAPA FRONTAL INFERIOR (Cognició): Hores vitals a l'avantguarda [translateZ(40px)] */}
             <div className="flex justify-between items-end w-full mt-2 px-2 z-20 relative [transform:translateZ(40px)] [transform-style:preserve-3d]">
                 <div className="flex flex-col items-start gap-1">
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest drop-shadow-md">{labelSunrise}</span>
                    <span className={`text-[13px] font-mono font-black tabular-nums px-3 py-1 rounded-md border shadow-[0_4px_12px_rgba(0,0,0,0.5)] transition-colors duration-500 ${hasValidData ? 'text-white bg-black/80 border-white/10' : 'text-slate-600 bg-slate-900/50 border-slate-700/50'}`}>
                        {displaySunrise}
                    </span>
                 </div>
                 
                 <div className="flex flex-col items-end gap-1">
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest drop-shadow-md">{labelSunset}</span>
                    <span className={`text-[13px] font-mono font-black tabular-nums px-3 py-1 rounded-md border shadow-[0_4px_12px_rgba(0,0,0,0.5)] transition-colors duration-500 ${hasValidData ? 'text-white bg-black/80 border-white/10' : 'text-slate-600 bg-slate-900/50 border-slate-700/50'}`}>
                        {displaySunset}
                    </span>
                 </div>
             </div>
        </div>
    );
};