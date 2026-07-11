import { memo } from 'react';
import { Calendar, TrendingUp, Umbrella, ArrowRight } from 'lucide-react'; 
import { SmartForecastCharts } from './WeatherCharts';
import { TempRangeBar } from './WeatherWidgets';
import { getWeatherIcon } from './WeatherIcons';
import { TRANSLATIONS, Language } from '../translations';
import { WeatherUnit, formatPrecipitation } from '../utils/formatters';
import { StrictDailyWeather } from '../types/weatherLogicTypes';

export interface ChartDataPoint {
  time: string;
  temp: number | null;
  precip: number | null;
  [key: string]: unknown;
}

export interface ComparisonData {
  gfs: ChartDataPoint[];
  icon: ChartDataPoint[];
  [key: string]: unknown;
}

interface ForecastSectionProps {
    chartData: ChartDataPoint[]; 
    comparisonData: ComparisonData | null; 
    dailyData: StrictDailyWeather; 
    weeklyExtremes: { min: number; max: number };
    unit: WeatherUnit; 
    lang: Language; 
    onDayClick: (index: number) => void;
    comparisonEnabled: boolean;
    showCharts?: boolean;
}

// HELPER RISC ZERO: Extracció matemàticament segura de valors per a llistes de dades
const getSafeArrayNum = (arr: unknown, index: number, fallback: number = 0): number => {
    if (!Array.isArray(arr)) return fallback;
    const val = arr[index];
    return (typeof val === 'number' && !isNaN(val)) ? val : fallback;
};

const ForecastSection = memo(function ForecastSection({ 
    chartData, comparisonData, dailyData, weeklyExtremes, unit, lang, onDayClick, comparisonEnabled, showCharts = true 
}: ForecastSectionProps) {
    // DOCTRINA RISC ZERO: Extracció tipada
    const tRecord = (TRANSLATIONS[lang] || TRANSLATIONS['ca']) as Record<string, unknown>;
    
    // Risc Zero: Evitem fallades en el renderitzat si la dada principal està malformada
    if (!dailyData || !Array.isArray(dailyData.time) || dailyData.time.length === 0) return null;

    // SPATIAL UI BASE
    const MATRIX_BG = `absolute inset-0 z-0 opacity-[0.03] pointer-events-none bg-[linear-gradient(to_right,#ffffff_1px,transparent_1px),linear-gradient(to_bottom,#ffffff_1px,transparent_1px)] bg-[size:12px_12px]`;
    const PANEL_STYLE = `p-4 md:p-8 bg-gradient-to-br from-[#0f111a]/95 to-black/90 border border-white/5 rounded-[2rem] relative overflow-hidden shadow-[0_8px_32px_rgba(0,0,0,0.5)] backdrop-blur-md transform-gpu transition-colors duration-700`;

    return (
        <div className="flex flex-col gap-6 w-full max-w-7xl mx-auto z-10 relative">
            
            {/* SPATIAL UI: Caixa Tàctica Dels 7 Dies */}
            <div className={PANEL_STYLE} style={{ transform: 'translateZ(0)' }}>
                <div className={MATRIX_BG}></div>
                
                {/* Resplendor Direccional (Glow Tàctic) */}
                <div className="absolute top-0 right-0 w-[400px] h-[400px] bg-indigo-500/10 rounded-full blur-[100px] -mr-20 -mt-20 pointer-events-none mix-blend-screen z-0"></div>
                
                <h3 className="mb-6 flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.25em] text-slate-300 z-10 relative px-2">
                    <Calendar className="w-4 h-4 text-indigo-400 drop-shadow-[0_0_5px_rgba(129,140,248,0.8)]"/> 
                    {typeof tRecord.forecast7days === 'string' ? tRecord.forecast7days : "PREVISIÓ 7 DIES"}
                </h3>

                <div className="grid grid-cols-1 gap-2.5 relative z-10">
                    {dailyData.time.slice(1).map((rawDate: unknown, index: number) => {
                        // Extracció de data blindada
                        if (typeof rawDate !== 'string') return null;
                        
                        const date = new Date(rawDate);
                        
                        // RISC ZERO: Si la data no es pot parsejar, ignorem la iteració per evitar NaN
                        if (isNaN(date.getTime())) return null;

                        const i = index + 1; // Índex real desplaçat (obviem "avui" índex 0)
                        
                        const dayName = date.toLocaleDateString(lang === 'ca' ? 'ca-ES' : lang === 'es' ? 'es-ES' : 'en-US', { weekday: 'long' });
                        const dateNum = date.getDate();
                        
                        // Lectura robusta Risc Zero
                        const maxTemp = getSafeArrayNum(dailyData.temperature_2m_max, i);
                        const minTemp = getSafeArrayNum(dailyData.temperature_2m_min, i);
                        const rawCode = getSafeArrayNum(dailyData.weather_code, i);
                        const precipProb = getSafeArrayNum(dailyData.precipitation_probability_max, i);
                        const precipSum = getSafeArrayNum(dailyData.precipitation_sum, i);
                        const snowSum = getSafeArrayNum(dailyData.snowfall_sum, i); 
                        const maxWind = getSafeArrayNum(dailyData.wind_speed_10m_max, i);

                        // MOTOR VISUAL INTEL·LIGENT (Amb protecció contra el tipus unknown del ChartDataPoint)
                        let code = rawCode;
                        if (rawCode <= 3 && Array.isArray(chartData) && chartData.length > 0) {
                            const dateOnly = rawDate.slice(0, 10); 
                            
                            const dayHours = chartData.filter(d => 
                                typeof d.time === 'string' && 
                                d.time.startsWith(dateOnly) && 
                                d.isDay === 1
                            );

                            if (dayHours.length > 0) {
                                // Càsting segur del camp genèric `cloud`
                                const totalClouds = dayHours.reduce((acc, curr) => {
                                    const c = Number(curr.cloud);
                                    return acc + (isNaN(c) ? 0 : c);
                                }, 0);
                                
                                const avgClouds = totalClouds / dayHours.length;

                                if (avgClouds > 85) code = 3;
                                else if (avgClouds > 45) code = 2;
                                else if (avgClouds > 15) code = 1;
                                else code = 0;
                            }
                        }

                        return (
                            <button 
                                key={`daily-row-${rawDate}`}
                                onClick={() => onDayClick(i)}
                                className="group flex items-center justify-between p-3 md:p-4 rounded-[1.25rem] bg-black/40 border border-white/5 hover:bg-white/[0.04] hover:border-indigo-500/40 hover:shadow-[0_4px_20px_rgba(99,102,241,0.15)] transition-all duration-300 w-full backdrop-blur-md"
                            >
                                {/* PANELL DATA */}
                                <div className="flex items-center gap-3 w-auto min-w-[100px] md:w-[180px]">
                                    <div className="w-10 h-10 md:w-11 md:h-11 flex items-center justify-center rounded-xl bg-[#050608]/80 border border-white/5 text-slate-400 group-hover:bg-indigo-900/40 group-hover:border-indigo-500/40 group-hover:text-indigo-300 transition-all duration-300 shrink-0 shadow-[inset_0_1px_4px_rgba(0,0,0,0.5)] group-hover:shadow-[inset_0_1px_4px_rgba(99,102,241,0.3)]">
                                        <span className="text-lg md:text-xl font-black tracking-tighter">{dateNum}</span>
                                    </div>
                                    <div className="flex flex-col items-start truncate">
                                        <span className="text-xs md:text-sm font-bold uppercase tracking-wide text-slate-300 group-hover:text-white truncate max-w-[70px] md:max-w-none transition-colors duration-300">
                                            {dayName}
                                        </span>
                                        {precipProb > 0 && (
                                            <div className="flex items-center gap-1 mt-0.5">
                                                <Umbrella className="w-2.5 h-2.5 text-cyan-400 drop-shadow-[0_0_3px_rgba(34,211,238,0.5)]" />
                                                <span className="text-[9px] md:text-[10px] font-black text-cyan-400 tabular-nums">{precipProb}%</span>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* ICONA CENTRAL */}
                                <div className="flex items-center justify-center flex-1 px-2 md:px-4">
                                     <div className="scale-[0.8] md:scale-[1.1] transition-transform group-hover:scale-[1.25] duration-500 transform-gpu">
                                        {getWeatherIcon(code, "w-10 h-10 md:w-11 md:h-11", true, 0, maxWind)}
                                     </div>
                                </div>

                                {/* GRÀFIC TÈRMIC ESCRIPTORI */}
                                <div className="hidden md:flex flex-col items-center justify-center w-[130px] px-2">
                                    <div className="w-full flex justify-between text-[11px] font-bold text-slate-400 mb-1.5">
                                        <span className="group-hover:text-cyan-300 transition-colors duration-300">{Math.round(minTemp)}°</span>
                                        <span className="group-hover:text-red-300 transition-colors duration-300">{Math.round(maxTemp)}°</span>
                                    </div>
                                    <div className="opacity-80 group-hover:opacity-100 transition-opacity duration-300 w-full">
                                        <TempRangeBar 
                                            min={minTemp} 
                                            max={maxTemp} 
                                            globalMin={weeklyExtremes.min} 
                                            globalMax={weeklyExtremes.max} 
                                        />
                                    </div>
                                </div>

                                {/* RESUM TÈRMIC MÒBIL */}
                                <div className="md:hidden flex flex-col items-end justify-center mr-3">
                                    <span className="text-[15px] font-black text-slate-200 group-hover:text-white tabular-nums leading-none mb-1 transition-colors duration-300">
                                        {Math.round(maxTemp)}°
                                    </span>
                                    <span className="text-[11px] font-bold text-slate-500 group-hover:text-cyan-400 tabular-nums leading-none transition-colors duration-300">
                                        {Math.round(minTemp)}°
                                    </span>
                                </div>

                                {/* DADES DE PLUJA I ACCIÓ */}
                                <div className="flex items-center justify-end gap-2 md:gap-3 w-[80px] md:w-[130px]">
                                    {precipSum > 0 ? (
                                        <span className="text-[9px] md:text-[10px] text-cyan-200 font-mono font-black bg-cyan-950/40 px-1.5 py-1 md:px-2 rounded-md border border-cyan-500/30 group-hover:border-cyan-400/50 group-hover:text-cyan-300 transition-all duration-300 shadow-[inset_0_1px_2px_rgba(6,182,212,0.1)] group-hover:shadow-[0_0_8px_rgba(6,182,212,0.4)]">
                                            {formatPrecipitation(precipSum, snowSum)}
                                        </span>
                                    ) : (
                                        <span className="text-[9px] font-black text-slate-600 uppercase tracking-widest hidden md:block group-hover:text-slate-500 transition-colors">
                                            CAP
                                        </span>
                                    )}
                                    
                                    {/* Botó de fletxa Spatial UI */}
                                    <div className="w-6 h-6 md:w-7 md:h-7 rounded-full bg-[#050608] flex items-center justify-center group-hover:bg-indigo-500 group-hover:text-white transition-all duration-500 border border-white/10 group-hover:border-indigo-400 shrink-0 shadow-[inset_0_1px_2px_rgba(255,255,255,0.05)] group-hover:shadow-[0_0_10px_rgba(99,102,241,0.8)]">
                                        <ArrowRight className="w-3 h-3 text-slate-500 group-hover:text-white transition-colors" />
                                    </div>
                                </div>
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* SECCIÓ DE GRÀFICA COMPACTA (Opcional segons mode) */}
            {showCharts && comparisonEnabled && (
                 <div className={PANEL_STYLE}>
                    <div className={MATRIX_BG}></div>
                    <div className="absolute bottom-0 left-0 w-64 h-64 bg-emerald-500/5 rounded-full blur-[80px] pointer-events-none mix-blend-screen z-0"></div>
                    
                    <h3 className="mb-6 flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.25em] text-slate-300 relative z-10">
                        <TrendingUp className="w-4 h-4 text-emerald-400 drop-shadow-[0_0_5px_rgba(52,211,153,0.8)]"/> 
                        {typeof tRecord.trend24h === 'string' ? tRecord.trend24h : "TENDÈNCIA"}
                    </h3>
                    
                    <div className="relative z-10">
                        <SmartForecastCharts 
                            data={chartData} 
                            comparisonData={comparisonData} 
                            unit={unit === 'F' ? '°F' : '°C'} 
                            lang={lang} 
                        />
                    </div>
                </div>
            )}
        </div>
    );
});

export default ForecastSection;