import { Wind, CloudOff } from 'lucide-react';
import { WidgetProps } from './widgetTypes';
import { WIDGET_BASE_STYLE, CARD_VEIL, MATRIX_BG } from './widgetStyles';
import { getTrans } from './widgetHelpers';
import { AQI_TRANSLATIONS, AqiLevel, AqiResult, extractAqiData, getAqiLevel, getAqiSafeLang } from '../../utils/aqiLevel';

type AqiStyle = { color: string; bg: string; shadow: string };

// Els llindars de cada nivell són a utils/aqiLevel.ts; aquí només el color de cada nivell i escala.
const EAQI_STYLES: Partial<Record<AqiLevel, AqiStyle>> = {
    extreme: { color: 'text-purple-500', bg: 'bg-purple-500', shadow: 'shadow-[0_0_12px_#a855f7]' },
    very_poor: { color: 'text-fuchsia-500', bg: 'bg-fuchsia-500', shadow: 'shadow-[0_0_12px_#d946ef]' },
    poor: { color: 'text-rose-500', bg: 'bg-rose-500', shadow: 'shadow-[0_0_12px_#f43f5e]' },
    moderate: { color: 'text-yellow-300', bg: 'bg-yellow-300', shadow: 'shadow-[0_0_8px_#fde047]' },
    fair: { color: 'text-emerald-400', bg: 'bg-emerald-500', shadow: 'shadow-[0_0_8px_#34d399]' },
    good: { color: 'text-cyan-400', bg: 'bg-cyan-500', shadow: 'shadow-[0_0_8px_#22d3ee]' }
};

const USAQI_STYLES: Partial<Record<AqiLevel, AqiStyle>> = {
    hazardous: { color: 'text-red-800', bg: 'bg-red-800', shadow: 'shadow-[0_0_16px_#991b1b]' },
    very_poor: { color: 'text-fuchsia-500', bg: 'bg-fuchsia-500', shadow: 'shadow-[0_0_12px_#d946ef]' },
    poor: { color: 'text-rose-500', bg: 'bg-rose-500', shadow: 'shadow-[0_0_12px_#f43f5e]' },
    sensitive: { color: 'text-amber-400', bg: 'bg-amber-400', shadow: 'shadow-[0_0_12px_#fbbf24]' },
    moderate: { color: 'text-yellow-300', bg: 'bg-yellow-300', shadow: 'shadow-[0_0_8px_#fde047]' },
    good: { color: 'text-emerald-400', bg: 'bg-emerald-500', shadow: 'shadow-[0_0_8px_#34d399]' }
};

export const AqiWidget = ({ data, lang }: WidgetProps) => {
    const t = getTrans(lang);
    const safeLang = getAqiSafeLang(lang);
    const tLocal = AQI_TRANSLATIONS[safeLang];
    
    // Prioritzem el diccionari global pel títol si existeix, si no, usem el local
    const tRecord = (typeof t === 'object' && t !== null) ? (t as Record<string, unknown>) : {};
    const titleAqi = typeof tRecord.aqi === 'string' ? tRecord.aqi : tLocal.title;

    const aqiData = extractAqiData(data);

    const getAqiState = (result: AqiResult | null) => {
        if (!result) return { color: 'text-slate-500', bg: 'bg-slate-500/20', shadow: 'shadow-none', label: tLocal.nd, barMax: 100 };

        const level = getAqiLevel(result);
        const style = (result.type === 'EAQI' ? EAQI_STYLES : USAQI_STYLES)[level] ?? { color: 'text-slate-500', bg: 'bg-slate-500/20', shadow: 'shadow-none' };
        return { ...style, label: tLocal[level], barMax: result.type === 'EAQI' ? 200 : 500 };
    };

    const { color, bg, shadow, label, barMax } = getAqiState(aqiData);
    const displayValue = aqiData ? Math.round(aqiData.value) : null;
    const hasValidData = displayValue !== null;
    
    // Alerta tàctica dinàmica basada en els llindars oficials
    const isAlert = hasValidData && (
        (aqiData?.type === 'EAQI' && displayValue > 50) || 
        (aqiData?.type === 'USAQI' && displayValue > 100)
    );

    const pm25 = aqiData?.pm25 ?? null;
    const pm10 = aqiData?.pm10 ?? null;
    const hasMicroTelemetry = pm25 !== null || pm10 !== null;

    // SPATIAL UI BASE AMB MATRIU DE FONS
    const SPATIAL_WIDGET_STYLE = `${WIDGET_BASE_STYLE} ${CARD_VEIL} !flex-row items-center gap-6 transition-colors duration-700 relative overflow-hidden border shadow-[0_8px_32px_rgba(0,0,0,0.5)] transform-gpu p-3 sm:p-4 ${hasValidData ? 'bg-gradient-to-br from-[#0f111a]/90 to-black/80 border-white/10' : 'bg-gradient-to-br from-slate-900/50 to-black/80 border-slate-700/50'}`;

    return (
        <div className={SPATIAL_WIDGET_STYLE}>
            {/* Matriu Tàctica */}
            <div className={MATRIX_BG}></div>

            {/* Contenidor Icona */}
            <div className={`relative w-16 h-16 sm:w-20 sm:h-20 flex items-center justify-center rounded-xl border shadow-inner group z-10 transition-colors duration-500 ${hasValidData ? 'bg-[#0f111a]/80 border-white/10' : 'bg-slate-800/40 border-slate-700/50'}`}>
                {!hasValidData ? (
                    <CloudOff className="w-8 h-8 sm:w-10 sm:h-10 text-slate-500 opacity-80" />
                ) : (
                    <Wind className={`w-8 h-8 sm:w-10 sm:h-10 ${color} transition-colors duration-500 filter drop-shadow-[0_0_8px_currentColor]`} />
                )}
                {/* Llum de telemetria (Només brilla si hi ha dades) */}
                <div className={`absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full ${hasValidData ? bg : 'bg-slate-600'} ${isAlert ? 'animate-pulse' : ''} ${hasValidData ? shadow : 'shadow-none'} border-2 border-[#151725] transition-colors duration-500`}></div>
            </div>

            {/* Panell de Dades i Telemetria */}
            <div className="flex-1 flex flex-col justify-center z-10">
                <div className="flex justify-between items-center mb-1">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em]">
                        {titleAqi} {hasValidData && aqiData?.type === 'EAQI' ? '(EU)' : ''}
                    </span>
                    <span className={`text-xs sm:text-sm font-mono font-black ${hasValidData ? color : 'text-slate-500'} tabular-nums px-2 py-0.5 rounded border transition-colors duration-500 ${hasValidData ? 'bg-black/40 border-white/5' : 'bg-transparent border-slate-700/50'}`}>
                        {hasValidData ? `AQI ${displayValue}` : 'AQI --'}
                    </span>
                </div>
                
                {/* Carril Tàctic AQI: Desactivació completa si no hi ha dades */}
                <div className={`flex gap-0.5 h-3.5 w-full mb-1.5 rounded-sm border p-px transition-colors duration-500 ${hasValidData ? 'bg-[#0f111a] border-white/5' : 'bg-slate-900/50 border-slate-800'}`}>
                    {Array.from({ length: 20 }).map((_, i) => {
                        const threshold = i * (barMax / 20); 
                        const isActive = hasValidData && displayValue >= threshold;
                        
                        let segmentColor = 'bg-slate-700'; // Default per pèrdua de dades
                        
                        if (hasValidData) {
                            segmentColor = 'bg-emerald-500'; // Default tàctic
                            if (aqiData?.type === 'EAQI') {
                                if (threshold > 150) segmentColor = 'bg-purple-500';
                                else if (threshold > 100) segmentColor = 'bg-fuchsia-500';
                                else if (threshold > 50)  segmentColor = 'bg-rose-500';
                                else if (threshold > 40)  segmentColor = 'bg-yellow-300';
                                else if (threshold > 20)  segmentColor = 'bg-emerald-400';
                                else segmentColor = 'bg-cyan-500';
                            } else {
                                if (threshold > 300) segmentColor = 'bg-red-800';
                                else if (threshold > 200) segmentColor = 'bg-fuchsia-500';
                                else if (threshold > 150) segmentColor = 'bg-rose-500';
                                else if (threshold > 100) segmentColor = 'bg-amber-400';
                                else if (threshold > 50)  segmentColor = 'bg-yellow-300';
                            }
                        }
                        
                        return (
                            <div 
                                key={`aqi-segment-${i}`} 
                                className={`flex-1 rounded-[1px] transition-all duration-500 ${isActive ? segmentColor : 'bg-[#1a1d2e]'}`}
                                style={{ opacity: isActive ? 1 : 0.3 }}
                            ></div>
                        );
                    })}
                </div>

                {/* Zona Inferior: Etiqueta Principal i Micro-Telemetria */}
                <div className="flex items-end justify-between mt-0.5">
                    <span className={`text-xl sm:text-2xl font-black ${color} tracking-tighter uppercase drop-shadow-md leading-none transition-colors duration-500`}>
                        {label}
                    </span>
                    
                    {/* Renderitzat impecable a nivell de tipatge per als contaminants principals */}
                    {hasValidData && hasMicroTelemetry && (
                        <div className="flex gap-2 text-[9px] sm:text-[10px] font-mono text-slate-500 bg-black/30 px-1.5 py-0.5 rounded border border-white/5">
                            {pm25 !== null && <span>PM2.5 <span className="text-slate-300">{pm25.toFixed(1)}</span></span>}
                            {pm10 !== null && <span>PM10 <span className="text-slate-300">{pm10.toFixed(1)}</span></span>}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};