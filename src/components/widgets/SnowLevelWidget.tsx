import { Mountain, CloudOff } from 'lucide-react';
import { WidgetProps } from './widgetTypes';
import { WIDGET_BASE_STYLE, TITLE_STYLE } from './widgetStyles';
import { getTrans } from './widgetHelpers';

export const SnowLevelWidget = ({ freezingLevel, unit, lang }: WidgetProps) => {
    // DOCTRINA RISC ZERO: Extracció tipada
    const t = getTrans(lang) as Record<string, unknown>;
    const tTitle = typeof t.snowLevel === 'string' ? t.snowLevel : "COTA NEU";

    // Risc Zero: Validació estricta abans de cap càlcul termodinàmic
    const hasValidData = typeof freezingLevel === 'number' && !isNaN(freezingLevel);
    
    // El límit de neu sol situar-se uns 300m per sota de la isoterma 0ºC.
    // Només calculem si tenim dades reals per evitar falsos positius de neu a cota 0m.
    const snowLimit = hasValidData ? Math.max(0, freezingLevel - 300) : null;
    
    const isFt = unit === 'imperial' || unit === 'F';
    const displayLevel = hasValidData && snowLimit !== null 
        ? (isFt ? Math.round(snowLimit * 3.28084) : Math.round(snowLimit)) 
        : '--';
    
    // SPATIAL UI: Altímetria dinàmica sobre el fons
    // Establim un cim visual de referència (ex: 4000m per als Pirineus/Alps)
    const VISUAL_MAX_ALTITUDE = 4000;
    // Calculem la posició Y de la línia. El 0% és el cim, el 100% és la base.
    // Limitem entre el 10% i el 90% perquè la línia no surti del marc de l'instrument.
    const linePercent = hasValidData && snowLimit !== null 
        ? Math.max(10, Math.min(90, 100 - (snowLimit / VISUAL_MAX_ALTITUDE) * 100)) 
        : 50; // Posició central apagada si no hi ha dades

    // Estats visuals
    const bgGlow = hasValidData ? "from-sky-950/20 to-black/80" : "from-slate-900/50 to-black/80";
    const borderColor = hasValidData ? "border-white/5" : "border-slate-700/50";
    
    // SPATIAL UI BASE AMB MATRIU DE FONS
    const SPATIAL_WIDGET_STYLE = `${WIDGET_BASE_STYLE} relative overflow-hidden backdrop-blur-md bg-gradient-to-br transition-colors duration-700 ${bgGlow} border ${borderColor} shadow-[0_8px_32px_rgba(0,0,0,0.5)] transform-gpu p-3 sm:p-4 flex flex-col select-none`;
    const MATRIX_BG = `absolute inset-0 z-0 opacity-[0.03] pointer-events-none bg-[linear-gradient(to_right,#ffffff_1px,transparent_1px),linear-gradient(to_bottom,#ffffff_1px,transparent_1px)] bg-[size:12px_12px]`;

    return (
        <div className={SPATIAL_WIDGET_STYLE}>
            {/* Matriu Tàctica */}
            <div className={MATRIX_BG}></div>

            <div className={`${TITLE_STYLE.replace('mb-4', 'mb-2')} flex items-center gap-1.5 z-20 relative`}>
                {hasValidData ? (
                    <Mountain className="w-4 h-4 text-sky-300 drop-shadow-[0_0_8px_rgba(125,211,252,0.5)] transition-colors duration-500" /> 
                ) : (
                    <CloudOff className="w-4 h-4 text-slate-500" />
                )}
                <span className="tracking-wider text-slate-200">{tTitle}</span>
            </div>
            
            <div className={`flex-1 flex flex-col items-center justify-center relative overflow-hidden rounded-xl border shadow-inner mt-2 transition-colors duration-700 z-10 ${hasValidData ? 'bg-black/20 border-white/5' : 'bg-slate-900/40 border-slate-800/50'}`}>
                
                {/* Holograma de la muntanya al fons */}
                <div className="absolute inset-0 flex items-end justify-center pointer-events-none z-0">
                    <svg viewBox="0 0 100 60" className={`w-full h-full fill-current transition-colors duration-1000 ${hasValidData ? 'text-sky-500/20' : 'text-slate-600/10'}`} preserveAspectRatio="none">
                        <path d="M50 10 L100 60 L0 60 Z" />
                    </svg>
                </div>

                {/* Línia Altimètrica Dinàmica */}
                <div 
                    className={`absolute w-full border-t-[1.5px] border-dashed transition-all duration-1000 ease-out z-10 ${hasValidData ? 'border-sky-300/50 shadow-[0_0_8px_rgba(125,211,252,0.3)]' : 'border-slate-600/30 opacity-0'}`}
                    style={{ top: `${linePercent}%` }}
                ></div>
                
                {/* Visualització de Dades (Spatial UI) */}
                <div className={`z-20 text-center flex flex-col items-center px-6 py-2 rounded-lg border backdrop-blur-sm shadow-xl transition-colors duration-500 ${hasValidData ? 'bg-black/40 border-white/10' : 'bg-[#0f111a]/60 border-slate-700/50'}`}>
                    <span className={`text-4xl sm:text-5xl font-black tracking-tighter tabular-nums leading-none transition-colors duration-500 ${hasValidData ? 'text-white drop-shadow-[0_0_15px_rgba(255,255,255,0.4)]' : 'text-slate-600'}`}>
                        {displayLevel}
                    </span>
                    
                    <div className={`flex items-center gap-1.5 mt-2 px-2.5 py-1 rounded border transition-colors duration-500 ${hasValidData ? 'bg-[#0f111a] border-white/5' : 'bg-slate-800/50 border-slate-700/50'}`}>
                        {hasValidData ? (
                            <span className="w-1.5 h-1.5 bg-sky-400 rounded-full animate-pulse shadow-[0_0_6px_#38bdf8]"></span>
                        ) : (
                            <span className="w-1.5 h-1.5 bg-slate-600 rounded-full"></span>
                        )}
                        <span className={`text-[10px] font-black uppercase tracking-widest transition-colors duration-500 ${hasValidData ? 'text-sky-200' : 'text-slate-500'}`}>
                            {hasValidData ? (isFt ? 'FT' : 'METRES') : (lang === 'ca' ? 'SENSE DADES' : 'NO DATA')}
                        </span>
                    </div>
                </div>
            </div>
        </div>
    );
};