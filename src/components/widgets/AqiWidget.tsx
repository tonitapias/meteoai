import { Wind, AlertTriangle } from 'lucide-react';
import { WidgetProps } from './widgetTypes';
import { WIDGET_BASE_STYLE } from './widgetStyles';
import { getTrans } from './widgetHelpers';

type AqiResult = { 
    value: number; 
    type: 'EAQI' | 'USAQI';
    pm25: number | null;
    pm10: number | null;
};

// Extracció profunda blindada amb suport per micro-telemetria de partícules
const extractAqiData = (dataObj: unknown): AqiResult | null => {
    if (!dataObj || typeof dataObj !== 'object') return null;
    const record = dataObj as Record<string, unknown>;

    // Doctrina Risc Zero: Extracció segura de PM2.5 i PM10
    const pm25 = typeof record.pm2_5 === 'number' && !isNaN(record.pm2_5) ? record.pm2_5 : null;
    const pm10 = typeof record.pm10 === 'number' && !isNaN(record.pm10) ? record.pm10 : null;

    // 1. PRIORITAT ABSOLUTA: Escala Europea
    if (typeof record.european_aqi === 'number' && !isNaN(record.european_aqi)) {
        return { value: record.european_aqi, type: 'EAQI', pm25, pm10 };
    }
    
    // 2. FALLBACK: Escala Americana
    if (typeof record.us_aqi === 'number' && !isNaN(record.us_aqi)) {
        return { value: record.us_aqi, type: 'USAQI', pm25, pm10 };
    }
    if (typeof record.aqi === 'number' && !isNaN(record.aqi)) {
        return { value: record.aqi, type: 'USAQI', pm25, pm10 };
    }

    // 3. Cerca recursiva
    const wrapperKeys = ['current', 'current_weather', 'hourly', 'daily', 'air_quality'];
    for (const wrapper of wrapperKeys) {
        if (record[wrapper] && typeof record[wrapper] === 'object') {
            const nestedAqi = extractAqiData(record[wrapper]);
            if (nestedAqi !== null) {
                return {
                    ...nestedAqi,
                    // Prioritzem els PM niuats, però usem els globals si falten
                    pm25: nestedAqi.pm25 ?? pm25,
                    pm10: nestedAqi.pm10 ?? pm10
                };
            }
        }
    }

    return null;
};

export const AqiWidget = ({ data, lang }: WidgetProps) => {
    const t = getTrans(lang);
    
    const tRecord = (typeof t === 'object' && t !== null) ? (t as Record<string, unknown>) : {};
    const titleAqi = typeof tRecord.aqi === 'string' ? tRecord.aqi : "QUALITAT AIRE";

    const aqiData = extractAqiData(data);

    const getAqiState = (result: AqiResult | null) => {
        if (!result) return { color: 'text-cyan-500', bg: 'bg-cyan-500/20', shadow: 'shadow-none', label: "N/D", barMax: 100 };
        
        const { value, type } = result;

        if (type === 'EAQI') {
            if (value >= 100) return { color: 'text-rose-500', bg: 'bg-rose-500', shadow: 'shadow-[0_0_12px_#f43f5e]', label: "MALA", barMax: 100 };
            if (value >= 50) return { color: 'text-amber-400', bg: 'bg-amber-400', shadow: 'shadow-[0_0_12px_#fbbf24]', label: "DEFICIENT", barMax: 100 };
            if (value >= 20) return { color: 'text-yellow-300', bg: 'bg-yellow-300', shadow: 'shadow-[0_0_8px_#fde047]', label: "MODERADA", barMax: 100 };
            return { color: 'text-emerald-400', bg: 'bg-emerald-500', shadow: 'shadow-[0_0_8px_#34d399]', label: "BONA", barMax: 100 };
        } else {
            if (value > 150) return { color: 'text-rose-500', bg: 'bg-rose-500', shadow: 'shadow-[0_0_12px_#f43f5e]', label: "MALA", barMax: 200 };
            if (value > 100) return { color: 'text-amber-400', bg: 'bg-amber-400', shadow: 'shadow-[0_0_12px_#fbbf24]', label: "DEFICIENT", barMax: 200 };
            if (value > 50) return { color: 'text-yellow-300', bg: 'bg-yellow-300', shadow: 'shadow-[0_0_8px_#fde047]', label: "MODERADA", barMax: 200 };
            return { color: 'text-emerald-400', bg: 'bg-emerald-500', shadow: 'shadow-[0_0_8px_#34d399]', label: "BONA", barMax: 200 };
        }
    };

    const { color, bg, shadow, label, barMax } = getAqiState(aqiData);
    const displayValue = aqiData ? Math.round(aqiData.value) : null;
    
    const isAlert = label === "DEFICIENT" || label === "MALA";

    // DOCTRINA RISC ZERO: Destructuració garantida per a TypeScript abans del renderitzat
    const pm25 = aqiData?.pm25 ?? null;
    const pm10 = aqiData?.pm10 ?? null;
    const hasMicroTelemetry = pm25 !== null || pm10 !== null;

    const SPATIAL_WIDGET_STYLE = `${WIDGET_BASE_STYLE} !flex-row items-center gap-6 backdrop-blur-md bg-gradient-to-br from-black/60 to-[#0f111a]/80 border border-white/10 shadow-[0_8px_32px_rgba(0,0,0,0.5)] transform-gpu p-3 sm:p-4`;

    return (
        <div className={SPATIAL_WIDGET_STYLE}>
            {/* Contenidor Icona */}
            <div className="relative w-16 h-16 sm:w-20 sm:h-20 flex items-center justify-center bg-[#0f111a]/80 rounded-xl border border-white/10 shadow-inner group backdrop-blur-sm">
                {aqiData === null ? (
                    <AlertTriangle className={`w-8 h-8 sm:w-10 sm:h-10 ${color} opacity-50`} />
                ) : (
                    <Wind className={`w-8 h-8 sm:w-10 sm:h-10 ${color} transition-colors duration-500 filter drop-shadow-[0_0_8px_currentColor]`} />
                )}
                <div className={`absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full ${bg} ${isAlert ? 'animate-pulse' : ''} ${shadow} border-2 border-[#151725]`}></div>
            </div>

            {/* Panell de Dades i Telemetria */}
            <div className="flex-1 flex flex-col justify-center">
                <div className="flex justify-between items-center mb-1">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em]">
                        {titleAqi} {aqiData?.type === 'EAQI' ? '(EU)' : ''}
                    </span>
                    <span className={`text-xs sm:text-sm font-mono font-black ${color} tabular-nums bg-black/40 px-2 py-0.5 rounded border border-white/5`}>
                        {displayValue !== null ? `AQI ${displayValue}` : 'AQI --'}
                    </span>
                </div>
                
                {/* Carril Tàctic AQI */}
                <div className="flex gap-0.5 h-3.5 w-full mb-1.5 bg-[#0f111a] rounded-sm border border-white/5 p-px">
                    {Array.from({ length: 20 }).map((_, i) => {
                        const threshold = i * (barMax / 20); 
                        const isActive = displayValue !== null && displayValue >= threshold;
                        
                        let segmentColor = 'bg-emerald-400';
                        if (aqiData?.type === 'EAQI') {
                            if (threshold >= 100) segmentColor = 'bg-rose-500';
                            else if (threshold >= 50) segmentColor = 'bg-amber-400';
                            else if (threshold >= 20) segmentColor = 'bg-yellow-300';
                        } else {
                            if (threshold > 150) segmentColor = 'bg-rose-500';
                            else if (threshold > 100) segmentColor = 'bg-amber-400';
                            else if (threshold > 50) segmentColor = 'bg-yellow-300';
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
                <div className="flex items-end justify-between">
                    <span className={`text-xl sm:text-2xl font-black ${color} tracking-tighter uppercase drop-shadow-md leading-none`}>
                        {label}
                    </span>
                    
                    {/* Renderitzat impecable a nivell de tipatge */}
                    {hasMicroTelemetry && (
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