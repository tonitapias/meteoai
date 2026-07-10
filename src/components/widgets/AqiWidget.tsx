import { Wind, CloudOff } from 'lucide-react';
import { WidgetProps } from './widgetTypes';
import { WIDGET_BASE_STYLE } from './widgetStyles';
import { getTrans } from './widgetHelpers';

type AqiResult = { 
    value: number; 
    type: 'EAQI' | 'USAQI';
    pm25: number | null;
    pm10: number | null;
};

// Diccionari Tàctic Local per a Risc Zero (Garanteix els 4 idiomes encara que falli l'i18n global)
type SupportedLang = 'ca' | 'es' | 'en' | 'fr';

const AQI_TRANSLATIONS: Record<SupportedLang, Record<string, string>> = {
    ca: {
        title: "QUALITAT AIRE",
        nd: "N/D",
        good: "BONA",
        fair: "RAONABLE",
        moderate: "MODERADA",
        sensitive: "SENSIBLE",
        poor: "DOLENTA",
        very_poor: "MOLT DOLENTA",
        extreme: "EXTREMA",
        hazardous: "PERILLOSA"
    },
    es: {
        title: "CALIDAD AIRE",
        nd: "N/D",
        good: "BUENA",
        fair: "RAZONABLE",
        moderate: "MODERADA",
        sensitive: "SENSIBLE",
        poor: "MALA",
        very_poor: "MUY MALA",
        extreme: "EXTREMA",
        hazardous: "PELIGROSA"
    },
    en: {
        title: "AIR QUALITY",
        nd: "N/A",
        good: "GOOD",
        fair: "FAIR",
        moderate: "MODERATE",
        sensitive: "SENSITIVE",
        poor: "POOR",
        very_poor: "VERY POOR",
        extreme: "EXTREME",
        hazardous: "HAZARDOUS"
    },
    fr: {
        title: "QUALITÉ AIR",
        nd: "N/D",
        good: "BONNE",
        fair: "PASSABLE",
        moderate: "MODÉRÉE",
        sensitive: "SENSIBLE",
        poor: "MAUVAISE",
        very_poor: "TRÈS MAUVAISE",
        extreme: "EXTRÊME",
        hazardous: "DANGEREUSE"
    }
};

// Resolució segura d'idioma (Fallback sempre a Català)
const getSafeLang = (langParam?: string): SupportedLang => {
    if (!langParam) return 'ca';
    const l = langParam.toLowerCase().substring(0, 2);
    if (l === 'es') return 'es';
    if (l === 'en') return 'en';
    if (l === 'fr') return 'fr';
    return 'ca';
};

// DOCTRINA RISC ZERO: Extracció profunda blindada amb limitador de recursivitat (Stack Overflow Protection)
const extractAqiData = (dataObj: unknown, depth = 0): AqiResult | null => {
    // Tallem en sec si passem de 4 nivells de profunditat per evitar bucles infinits
    if (!dataObj || typeof dataObj !== 'object' || depth > 4) return null;
    const record = dataObj as Record<string, unknown>;

    // Extracció segura de PM2.5 i PM10
    const pm25 = typeof record.pm2_5 === 'number' && !isNaN(record.pm2_5) ? record.pm2_5 : null;
    const pm10 = typeof record.pm10 === 'number' && !isNaN(record.pm10) ? record.pm10 : null;

    // 1. PRIORITAT ABSOLUTA: Escala Europea Oficial (AEMA)
    if (typeof record.european_aqi === 'number' && !isNaN(record.european_aqi)) {
        return { value: record.european_aqi, type: 'EAQI', pm25, pm10 };
    }
    
    // 2. FALLBACK: Escala Americana (EPA)
    if (typeof record.us_aqi === 'number' && !isNaN(record.us_aqi)) {
        return { value: record.us_aqi, type: 'USAQI', pm25, pm10 };
    }
    if (typeof record.aqi === 'number' && !isNaN(record.aqi)) {
        return { value: record.aqi, type: 'USAQI', pm25, pm10 };
    }

    // 3. Cerca recursiva controlada
    const wrapperKeys = ['current', 'current_weather', 'hourly', 'daily', 'air_quality'];
    for (const wrapper of wrapperKeys) {
        if (record[wrapper] && typeof record[wrapper] === 'object') {
            const nestedAqi = extractAqiData(record[wrapper], depth + 1);
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
    const safeLang = getSafeLang(lang);
    const tLocal = AQI_TRANSLATIONS[safeLang];
    
    // Prioritzem el diccionari global pel títol si existeix, si no, usem el local
    const tRecord = (typeof t === 'object' && t !== null) ? (t as Record<string, unknown>) : {};
    const titleAqi = typeof tRecord.aqi === 'string' ? tRecord.aqi : tLocal.title;

    const aqiData = extractAqiData(data);

    const getAqiState = (result: AqiResult | null) => {
        if (!result) return { color: 'text-slate-500', bg: 'bg-slate-500/20', shadow: 'shadow-none', label: tLocal.nd, barMax: 100 };
        
        const { value, type } = result;

        // ESTÀNDARD EAQI (Agència Europea de Medi Ambient): 6 Nivells Oficials
        if (type === 'EAQI') {
            if (value > 150) return { color: 'text-purple-500', bg: 'bg-purple-500', shadow: 'shadow-[0_0_12px_#a855f7]', label: tLocal.extreme, barMax: 200 };
            if (value > 100) return { color: 'text-fuchsia-500', bg: 'bg-fuchsia-500', shadow: 'shadow-[0_0_12px_#d946ef]', label: tLocal.very_poor, barMax: 200 };
            if (value > 50)  return { color: 'text-rose-500', bg: 'bg-rose-500', shadow: 'shadow-[0_0_12px_#f43f5e]', label: tLocal.poor, barMax: 200 };
            if (value > 40)  return { color: 'text-yellow-300', bg: 'bg-yellow-300', shadow: 'shadow-[0_0_8px_#fde047]', label: tLocal.moderate, barMax: 200 };
            if (value > 20)  return { color: 'text-emerald-400', bg: 'bg-emerald-500', shadow: 'shadow-[0_0_8px_#34d399]', label: tLocal.fair, barMax: 200 };
            return { color: 'text-cyan-400', bg: 'bg-cyan-500', shadow: 'shadow-[0_0_8px_#22d3ee]', label: tLocal.good, barMax: 200 };
        } 
        
        // ESTÀNDARD USAQI (EPA): 6 Nivells Oficials (Arriba fins a 500)
        else {
            if (value > 300) return { color: 'text-red-800', bg: 'bg-red-800', shadow: 'shadow-[0_0_16px_#991b1b]', label: tLocal.hazardous, barMax: 500 };
            if (value > 200) return { color: 'text-fuchsia-500', bg: 'bg-fuchsia-500', shadow: 'shadow-[0_0_12px_#d946ef]', label: tLocal.very_poor, barMax: 500 };
            if (value > 150) return { color: 'text-rose-500', bg: 'bg-rose-500', shadow: 'shadow-[0_0_12px_#f43f5e]', label: tLocal.poor, barMax: 500 };
            if (value > 100) return { color: 'text-amber-400', bg: 'bg-amber-400', shadow: 'shadow-[0_0_12px_#fbbf24]', label: tLocal.sensitive, barMax: 500 };
            if (value > 50)  return { color: 'text-yellow-300', bg: 'bg-yellow-300', shadow: 'shadow-[0_0_8px_#fde047]', label: tLocal.moderate, barMax: 500 };
            return { color: 'text-emerald-400', bg: 'bg-emerald-500', shadow: 'shadow-[0_0_8px_#34d399]', label: tLocal.good, barMax: 500 };
        }
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
    const SPATIAL_WIDGET_STYLE = `${WIDGET_BASE_STYLE} !flex-row items-center gap-6 backdrop-blur-md transition-colors duration-700 relative overflow-hidden border shadow-[0_8px_32px_rgba(0,0,0,0.5)] transform-gpu p-3 sm:p-4 ${hasValidData ? 'bg-gradient-to-br from-[#0f111a]/90 to-black/80 border-white/10' : 'bg-gradient-to-br from-slate-900/50 to-black/80 border-slate-700/50'}`;
    const MATRIX_BG = `absolute inset-0 z-0 opacity-[0.03] pointer-events-none bg-[linear-gradient(to_right,#ffffff_1px,transparent_1px),linear-gradient(to_bottom,#ffffff_1px,transparent_1px)] bg-[size:12px_12px]`;

    return (
        <div className={SPATIAL_WIDGET_STYLE}>
            {/* Matriu Tàctica */}
            <div className={MATRIX_BG}></div>

            {/* Contenidor Icona */}
            <div className={`relative w-16 h-16 sm:w-20 sm:h-20 flex items-center justify-center rounded-xl border shadow-inner group backdrop-blur-sm z-10 transition-colors duration-500 ${hasValidData ? 'bg-[#0f111a]/80 border-white/10' : 'bg-slate-800/40 border-slate-700/50'}`}>
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