import { Moon, CloudOff } from 'lucide-react';
// DOCTRINA RISC ZERO: Importació mitjançant Namespace (* as) 
import * as SunCalc from 'suncalc'; 
import { WidgetProps } from './widgetTypes';
import { WIDGET_BASE_STYLE, TITLE_STYLE } from './widgetStyles';
import { getTrans, getMoonPhaseText } from './widgetHelpers';
import { MoonPhaseIcon } from '../MoonPhaseIcon'; 

// Ampliem la interfície localment. Afegim el timezone per a la telemetria global.
type TacticalMoonWidgetProps = WidgetProps & {
    lon?: number; 
    date?: Date | string | number; 
    timezone?: string;
};

export const MoonWidget = ({ phase, lat, lon, lang, date, timezone }: TacticalMoonWidgetProps) => {
    // DOCTRINA RISC ZERO: Validació estricta d'objecte i extracció tipada
    const t = getTrans(lang) as Record<string, unknown>;
    const titleMoon = typeof t.moonPhase === 'string' ? t.moonPhase : "LLUNA";
    const tIllumination = lang === 'ca' ? "Il·luminació" : (lang === 'en' ? "Illumination" : "Iluminación");
    const tRise = lang === 'ca' ? "Sortida" : (lang === 'en' ? "Rise" : "Salida");
    const tSet = lang === 'ca' ? "Posta" : (lang === 'en' ? "Set" : "Puesta");
    const tDay = lang === 'ca' ? "Dia" : (lang === 'en' ? "Day" : "Día");
    
    // Separació estricta de disponibilitat de dades
    const hasData = typeof phase === 'number' && !isNaN(phase);
    const hasValidCoords = typeof lat === 'number' && !isNaN(lat) && typeof lon === 'number' && !isNaN(lon);
    
    // Càlcul de la il·luminació real (0-100%) protegit contra divisions o nuls
    const illumination = hasData ? Math.round(((1 - Math.cos(phase * 2 * Math.PI)) / 2) * 100) : 0;
    
    const moonText = hasData ? getMoonPhaseText(phase) : '--';
    const moonAge = hasData ? Math.round(phase * 29.53) : '--';
    
    // Utilitzem 'lat' per detectar l'hemisferi de manera segura
    const isSouth = hasValidCoords && lat < 0;

    // --- MOTOR MATEMÀTIC TÀCTIC (Risc Zero Global + Escombratge de 3 Dies) ---
    let safeMoonrise: string | null = null;
    let safeMoonset: string | null = null;
    let isNextDayRise = false;
    let isNextDaySet = false;

    if (hasValidCoords) {
        try {
            // Definim el fus horari. Si no en rebem, utilitzem el del dispositiu com a xarxa de seguretat.
            const tz = typeof timezone === 'string' && timezone.trim() !== '' 
                ? timezone 
                : Intl.DateTimeFormat().resolvedOptions().timeZone;
                
            const targetDate = date ? new Date(date) : new Date();
            
            // Formatadors estrictes acoblats al fus horari destí per evitar desajustos celestes
            const dateFormatter = new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' });
            const timeFormatter = new Intl.DateTimeFormat('ca-ES', { timeZone: tz, hour: '2-digit', minute: '2-digit', hour12: false });
            
            // L'"avui" absolut de la localitat consultada
            const targetDateStr = dateFormatter.format(targetDate);

            // Preparem els dies adjacents
            const yesterday = new Date(targetDate.getTime() - 86400000);
            const tomorrow = new Date(targetDate.getTime() + 86400000);

            const getTimes = (d: Date) => SunCalc.getMoonTimes(d, lat, lon);
            
            // Recopilem tots els esdeveniments de la finestra
            const allRises = [getTimes(yesterday).rise, getTimes(targetDate).rise, getTimes(tomorrow).rise].filter(Boolean) as Date[];
            const allSets = [getTimes(yesterday).set, getTimes(targetDate).set, getTimes(tomorrow).set].filter(Boolean) as Date[];

            // TÀCTICA DE FUS HORARI: Seleccionem l'esdeveniment que, a l'avaluar-se sota el fus horari destí, coincideix
            let localRise = allRises.find(d => dateFormatter.format(d) === targetDateStr);
            let localSet = allSets.find(d => dateFormatter.format(d) === targetDateStr);

            // TÀCTICA DE PREVISIÓ (+1d)
            if (!localRise) {
                localRise = allRises.find(d => dateFormatter.format(d) > targetDateStr);
                if (localRise) isNextDayRise = true;
            }
            if (!localSet) {
                localSet = allSets.find(d => dateFormatter.format(d) > targetDateStr);
                if (localSet) isNextDaySet = true;
            }

            const formatTime = (timeData?: Date): string | null => {
                if (!timeData || isNaN(timeData.getTime())) return null;
                return timeFormatter.format(timeData); // Hora blindada al país destí
            };

            safeMoonrise = formatTime(localRise);
            safeMoonset = formatTime(localSet);

        } catch (error) {
            console.error("Error al calcular el cicle lunar global:", error);
            // safeMoonrise i safeMoonset romanen null per defecte, activant els fallbacks visuals
        }
    }

    // SPATIAL UI: Seamless Loop Cinemàtic (Només s'activa si hi ha dades per protegir la lògica de pèrdua de senyal)
    const cinematicAnimations = `
        @keyframes lunar-levitation {
            0%, 100% { transform: ${isSouth ? 'scaleX(-1)' : ''} translateY(0px) translateZ(10px); }
            50% { transform: ${isSouth ? 'scaleX(-1)' : ''} translateY(-6px) translateZ(10px); }
        }
        @keyframes lunar-glow {
            0%, 100% { filter: drop-shadow(0 0 10px rgba(255,255,255,0.15)); }
            50% { filter: drop-shadow(0 0 25px rgba(255,255,255,0.4)); }
        }
        .animate-lunar-loop {
            animation: lunar-levitation 8s ease-in-out infinite, lunar-glow 5s ease-in-out infinite;
            will-change: transform, filter;
        }
    `;

    // Estats visuals
    const bgGlow = hasData ? "from-indigo-950/30 to-black/80" : "from-slate-900/50 to-black/80";
    const borderColor = hasData ? "border-white/5" : "border-slate-700/50";
    
    const SPATIAL_WIDGET_STYLE = `${WIDGET_BASE_STYLE} relative overflow-hidden backdrop-blur-md bg-gradient-to-br transition-colors duration-700 ${bgGlow} border ${borderColor} shadow-[0_8px_32px_rgba(0,0,0,0.5)] transform-gpu p-3 sm:p-4 flex flex-col justify-between h-full select-none`;
    const MATRIX_BG = `absolute inset-0 z-0 opacity-[0.03] pointer-events-none bg-[linear-gradient(to_right,#ffffff_1px,transparent_1px),linear-gradient(to_bottom,#ffffff_1px,transparent_1px)] bg-[size:12px_12px]`;

    return (
        <div className={SPATIAL_WIDGET_STYLE}>
             {/* Només injectem els estils del bucle si hi ha telemetria */}
             {hasData && <style>{cinematicAnimations}</style>}
             
             <div className={MATRIX_BG}></div>
             
             {/* Llum atmosfèrica de fons */}
             <div className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-40 h-40 rounded-full blur-[50px] transition-colors duration-1000 pointer-events-none z-0 ${hasData ? 'bg-indigo-500/10' : 'bg-slate-700/10'}`}></div>

             <div className="flex items-center justify-between w-full mb-3 z-10 relative">
                 <span className={`${TITLE_STYLE.replace('mb-4', 'mb-0')} flex items-center gap-1.5`}>
                     {hasData ? (
                         <Moon className="w-4 h-4 text-indigo-300 drop-shadow-[0_0_8px_rgba(165,180,252,0.5)] transition-colors duration-500" /> 
                     ) : (
                         <CloudOff className="w-4 h-4 text-slate-500" />
                     )}
                     <span className="tracking-wider text-slate-200">{titleMoon}</span>
                 </span>
                 <div className={`flex flex-col items-end px-2 py-0.5 rounded border backdrop-blur-sm transition-colors duration-500 ${hasData ? 'bg-black/30 border-white/5' : 'bg-slate-800/40 border-slate-700/50'}`}>
                    <span className={`text-[10px] font-bold uppercase tracking-widest transition-colors duration-500 ${hasData ? 'text-slate-300' : 'text-slate-500'}`}>
                        {tDay} {moonAge}
                    </span>
                 </div>
             </div>
             
             <div className="flex items-center justify-center flex-1 gap-6 sm:gap-8 mb-4 mt-2 z-10 relative">
                 <div className={`w-20 h-20 sm:w-24 sm:h-24 transition-all duration-1000 ${hasData ? 'animate-lunar-loop' : 'opacity-40 grayscale filter blur-[1px]'}`}>
                    <MoonPhaseIcon phase={hasData ? phase : 0} className={`w-full h-full ${hasData ? 'text-slate-200' : 'text-slate-500'}`} />
                 </div>
                 
                 <div className="flex flex-col justify-center">
                    <span className={`text-3xl sm:text-4xl font-black tabular-nums tracking-tighter leading-none mb-1 transition-colors duration-500 ${hasData ? 'text-white drop-shadow-md' : 'text-slate-600'}`}>
                        {hasData ? illumination : '--'}%
                    </span>
                    <span className={`text-sm sm:text-base font-bold mb-1 tracking-wide leading-none transition-colors duration-500 ${hasData ? 'text-indigo-200' : 'text-slate-500'}`}>
                        {moonText}
                    </span>
                    <span className="text-[9px] text-slate-500 font-bold uppercase tracking-widest border-t border-white/10 pt-1.5 mt-1">
                        {tIllumination}
                    </span>
                 </div>
             </div>

             <div className={`flex items-center justify-between w-full pt-3 border-t mt-auto rounded-b px-2 pb-1 z-10 relative transition-colors duration-500 ${hasValidCoords ? 'border-indigo-500/20 bg-black/20' : 'border-slate-700/50 bg-slate-900/40'}`}>
                <div className="flex flex-col items-start">
                    <span className="text-[9px] text-slate-500 font-bold uppercase tracking-widest mb-0.5">{tRise}</span>
                    <span className={`flex items-baseline gap-1 text-xs sm:text-sm font-mono font-bold tracking-tight transition-colors duration-500 ${safeMoonrise ? 'text-cyan-400 drop-shadow-[0_0_5px_rgba(34,211,238,0.4)]' : 'text-slate-600'}`}>
                        {safeMoonrise || '--:--'}
                        {isNextDayRise && <span className="text-[8px] font-sans text-cyan-200/60 tracking-normal drop-shadow-none">+1d</span>}
                    </span>
                </div>
                
                <div className={`w-[1px] h-6 bg-gradient-to-b from-transparent transition-colors duration-500 to-transparent ${hasValidCoords ? 'via-indigo-500/30' : 'via-slate-700/50'}`}></div>
                
                <div className="flex flex-col items-end">
                    <span className="text-[9px] text-slate-500 font-bold uppercase tracking-widest mb-0.5">{tSet}</span>
                    <span className={`flex items-baseline gap-1 text-xs sm:text-sm font-mono font-bold tracking-tight transition-colors duration-500 ${safeMoonset ? 'text-amber-400 drop-shadow-[0_0_5px_rgba(251,191,36,0.4)]' : 'text-slate-600'}`}>
                        {isNextDaySet && <span className="text-[8px] font-sans text-amber-200/60 tracking-normal drop-shadow-none">+1d</span>}
                        {safeMoonset || '--:--'}
                    </span>
                </div>
             </div>
        </div>
    );
};