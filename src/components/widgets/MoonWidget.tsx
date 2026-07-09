import { Moon } from 'lucide-react';
// DOCTRINA RISC ZERO: Importació mitjançant Namespace (* as) 
import * as SunCalc from 'suncalc'; 
import { WidgetProps } from './widgetTypes';
import { WIDGET_BASE_STYLE, TITLE_STYLE } from './widgetStyles';
import { getTrans, getMoonPhaseText } from './widgetHelpers';
import { MoonPhaseIcon } from '../MoonPhaseIcon'; 

// Ampliem la interfície localment. Necessitem 'lon' per a la precisió astronòmica.
type TacticalMoonWidgetProps = WidgetProps & {
    lon?: number; 
    date?: Date | string | number; 
};

export const MoonWidget = ({ phase, lat, lon, lang, date }: TacticalMoonWidgetProps) => {
    const t = getTrans(lang);
    
    // Validació estricta d'objecte i extracció tipada de text
    const tRecord = (typeof t === 'object' && t !== null) ? (t as Record<string, unknown>) : {};
    const titleMoon = typeof tRecord.moonPhase === 'string' ? tRecord.moonPhase : "LLUNA";
    
    const hasData = phase !== null && phase !== undefined && !isNaN(phase);
    
    // Càlcul de la il·luminació real (0-100%) protegit contra divisions o nuls
    const illumination = hasData ? Math.round(((1 - Math.cos(phase * 2 * Math.PI)) / 2) * 100) : 0;
    
    const moonText = hasData ? getMoonPhaseText(phase) : '--';
    const moonAge = hasData ? Math.round(phase * 29.53) : 0;
    
    // Utilitzem 'lat' per detectar l'hemisferi
    const isSouth = typeof lat === 'number' && lat < 0;

    // --- MOTOR MATEMÀTIC TÀCTIC (Risc Zero + Escombratge de 3 Dies) ---
    let safeMoonrise: string | null = null;
    let safeMoonset: string | null = null;
    let isNextDayRise = false;
    let isNextDaySet = false;

    if (typeof lat === 'number' && typeof lon === 'number') {
        try {
            const targetDate = date ? new Date(date) : new Date();
            
            // 1. Definim les fronteres exactes del nostre dia LOCAL a nivell de mil·lisegon
            const startOfDay = new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate(), 0, 0, 0).getTime();
            const endOfDay = new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate(), 23, 59, 59, 999).getTime();

            // 2. Preparem els dies adjacents per esquivar el decalatge de l'UTC
            const yesterday = new Date(targetDate.getTime() - 86400000);
            const tomorrow = new Date(targetDate.getTime() + 86400000);

            const getTimes = (d: Date) => SunCalc.getMoonTimes(d, lat, lon);
            
            // 3. Recopilem tots els esdeveniments de la finestra de 3 dies
            const allRises = [getTimes(yesterday).rise, getTimes(targetDate).rise, getTimes(tomorrow).rise].filter(Boolean) as Date[];
            const allSets = [getTimes(yesterday).set, getTimes(targetDate).set, getTimes(tomorrow).set].filter(Boolean) as Date[];

            // 4. Filtrem estrictament pel nostre dia local
            let localRise = allRises.find(d => d.getTime() >= startOfDay && d.getTime() <= endOfDay);
            let localSet = allSets.find(d => d.getTime() >= startOfDay && d.getTime() <= endOfDay);

            // 5. TÀCTICA DE PREVISIÓ (+1d): Si realment no hi ha esdeveniment avui, busquem el següent
            if (!localRise) {
                localRise = allRises.find(d => d.getTime() > endOfDay);
                if (localRise) isNextDayRise = true;
            }
            if (!localSet) {
                localSet = allSets.find(d => d.getTime() > endOfDay);
                if (localSet) isNextDaySet = true;
            }

            const formatTime = (timeData?: Date): string | null => {
                if (!timeData || isNaN(timeData.getTime())) return null;
                return timeData.toLocaleTimeString('ca-ES', { 
                    hour: '2-digit', 
                    minute: '2-digit', 
                    hour12: false 
                });
            };

            safeMoonrise = formatTime(localRise);
            safeMoonset = formatTime(localSet);

        } catch (error) {
            console.error("Error al calcular el cicle lunar local:", error);
        }
    }

    // SPATIAL UI: Bucle Continu per a l'animació orbital 
    // Inserit directament per no haver de modificar l'arxiu tailwind.config.js de producció
    const cinematicAnimations = `
        @keyframes lunar-levitation {
            0%, 100% { transform: ${isSouth ? 'scaleX(-1)' : ''} translateY(0px) translateZ(10px); }
            50% { transform: ${isSouth ? 'scaleX(-1)' : ''} translateY(-6px) translateZ(10px); }
        }
        @keyframes lunar-glow {
            0%, 100% { filter: drop-shadow(0 0 12px rgba(255,255,255,0.15)); }
            50% { filter: drop-shadow(0 0 28px rgba(255,255,255,0.5)); }
        }
        .animate-lunar-loop {
            animation: lunar-levitation 8s ease-in-out infinite, lunar-glow 5s ease-in-out infinite;
            will-change: transform, filter;
        }
    `;

    // Aplicació del Dark Dashboard Spatial UI
    const SPATIAL_WIDGET_STYLE = `${WIDGET_BASE_STYLE} backdrop-blur-md bg-gradient-to-br from-indigo-950/40 to-black/60 border border-indigo-500/10 shadow-[0_8px_32px_rgba(0,0,0,0.5)] transform-gpu p-3 sm:p-4 flex flex-col justify-between h-full`;

    return (
        <div className={SPATIAL_WIDGET_STYLE}>
             {/* Injecció segura de l'animació a l'arbre DOM */}
             <style>{cinematicAnimations}</style>

             {/* CAPÇALERA */}
             <div className="flex items-center justify-between w-full mb-3">
                 <span className={`${TITLE_STYLE.replace('mb-4', 'mb-0')} flex items-center gap-1.5`}>
                     <Moon className="w-4 h-4 text-indigo-300 drop-shadow-[0_0_8px_rgba(165,180,252,0.5)]" /> 
                     <span className="tracking-wider">{titleMoon}</span>
                 </span>
                 <div className="flex flex-col items-end bg-black/30 px-2 py-0.5 rounded border border-white/5 backdrop-blur-sm">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Dia {moonAge}</span>
                 </div>
             </div>
             
             {/* INDICADOR PRINCIPAL */}
             <div className="flex items-center justify-center flex-1 gap-6 sm:gap-8 mb-4 mt-2">
                 {/* La classe animate-lunar-loop dota de vida pròpia a la icona */}
                 <div className="w-20 h-20 sm:w-24 sm:h-24 animate-lunar-loop">
                    <MoonPhaseIcon phase={hasData ? phase : 0} className="w-full h-full text-slate-200" />
                 </div>
                 
                 <div className="flex flex-col justify-center">
                    <span className="text-3xl sm:text-4xl font-black text-white tracking-tighter drop-shadow-md leading-none mb-1">
                        {hasData ? illumination : '--'}%
                    </span>
                    <span className="text-sm sm:text-base text-indigo-200 font-bold mb-1 tracking-wide leading-none">
                        {moonText}
                    </span>
                    <span className="text-[9px] text-slate-500 font-bold uppercase tracking-widest border-t border-white/10 pt-1.5 mt-1">
                        Il·luminació
                    </span>
                 </div>
             </div>

             {/* TELEMETRIA ASTRONÒMICA AUTÒNOMA (SPATIAL UI) */}
             <div className="flex items-center justify-between w-full pt-3 border-t border-indigo-500/20 mt-auto bg-black/20 rounded-b px-2 pb-1">
                {/* Dades de Sortida */}
                <div className="flex flex-col items-start">
                    <span className="text-[9px] text-slate-500 font-bold uppercase tracking-widest mb-0.5">Sortida</span>
                    <span className={`flex items-baseline gap-1 text-xs sm:text-sm font-mono font-bold tracking-tight ${safeMoonrise ? 'text-cyan-400 drop-shadow-[0_0_5px_rgba(34,211,238,0.4)]' : 'text-slate-600'}`}>
                        {safeMoonrise || '--:--'}
                        {isNextDayRise && <span className="text-[8px] font-sans text-cyan-200/60 tracking-normal">+1d</span>}
                    </span>
                </div>
                
                {/* Separador de profunditat */}
                <div className="w-[1px] h-6 bg-gradient-to-b from-transparent via-indigo-500/30 to-transparent"></div>
                
                {/* Dades de Posta */}
                <div className="flex flex-col items-end">
                    <span className="text-[9px] text-slate-500 font-bold uppercase tracking-widest mb-0.5">Posta</span>
                    <span className={`flex items-baseline gap-1 text-xs sm:text-sm font-mono font-bold tracking-tight ${safeMoonset ? 'text-amber-400 drop-shadow-[0_0_5px_rgba(251,191,36,0.4)]' : 'text-slate-600'}`}>
                        {isNextDaySet && <span className="text-[8px] font-sans text-amber-200/60 tracking-normal">+1d</span>}
                        {safeMoonset || '--:--'}
                    </span>
                </div>
             </div>
        </div>
    );
};