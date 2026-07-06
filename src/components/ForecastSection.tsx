// src/components/ForecastSection.tsx
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
    const t = TRANSLATIONS[lang] || TRANSLATIONS['ca'];
    
    // Risc Zero: Evitem fallades en el renderitzat si la dada principal està malformada
    if (!dailyData || !Array.isArray(dailyData.time) || dailyData.time.length === 0) return null;

    return (
        <div className="flex flex-col gap-6 w-full max-w-7xl mx-auto">
            {/* SPATIAL UI: Caixa Tàctica */}
            <div className="p-4 md:p-8 bg-slate-900/40 border border-slate-700/50 rounded-[2rem] relative overflow-hidden shadow-2xl backdrop-blur-md transform-gpu" style={{ transform: 'translateZ(0)' }}>
                {/* Resplendor Direccional (Glow Tàctic) */}
                <div className="absolute top-0 right-0 w-72 h-72 bg-indigo-500/10 rounded-full blur-[100px] -mr-20 -mt-20 pointer-events-none mix-blend-screen"></div>
                
                <h3 className="mb-6 flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.25em] text-slate-400 z-10 relative px-2">
                    <Calendar className="w-4 h-4 text-indigo-400 drop-shadow-[0_0_3px_rgba(129,140,248,0.8)]"/> 
                    {t.forecast7days || "PREVISIÓ 7 DIES"}
                </h3>

                <div className="grid grid-cols-1 gap-2.5 relative z-10">
                    {dailyData.time.slice(1).map((rawDate: unknown, index: number) => {
                        // Extracció de data blindada
                        if (typeof rawDate !== 'string') return null;
                        
                        const i = index + 1; // Índex real desplaçat (obviem "avui" índex 0)
                        
                        const date = new Date(rawDate);
                        const dayName = date.toLocaleDateString(lang === 'ca' ? 'ca-ES' : 'en-US', { weekday: 'long' });
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
                                className="group flex items-center justify-between p-3 md:p-4 rounded-[1.25rem] bg-slate-950/60 border border-white/5 hover:bg-slate-900 hover:border-indigo-500/40 hover:shadow-[0_0_15px_rgba(99,102,241,0.1)] transition-all duration-300 w-full"
                            >
                                {/* PANELL DATA */}
                                <div className="flex items-center gap-3 w-auto min-w-[100px] md:w-[180px]">
                                    <div className="w-10 h-10 md:w-11 md:h-11 flex items-center justify-center rounded-xl bg-slate-900 border border-white/5 text-slate-400 group-hover:bg-indigo-950 group-hover:border-indigo-500/30 group-hover:text-indigo-300 transition-colors shrink-0 shadow-inner">
                                        <span className="text-lg md:text-xl font-black tracking-tighter">{dateNum}</span>
                                    </div>
                                    <div className="flex flex-col items-start truncate">
                                        <span className="text-xs md:text-sm font-bold uppercase tracking-wide text-slate-300 group-hover:text-white truncate max-w-[70px] md:max-w-none transition-colors">
                                            {dayName}
                                        </span>
                                        {precipProb > 0 && (
                                            <div className="flex items-center gap-1 mt-0.5">
                                                <Umbrella className="w-2.5 h-2.5 text-blue-400 drop-shadow-sm" />
                                                <span className="text-[9px] md:text-[10px] font-black text-blue-400">{precipProb}%</span>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* ICONA CENTRAL */}
                                <div className="flex items-center justify-center flex-1 px-2 md:px-4">
                                     <div className="scale-[0.8] md:scale-[1.1] drop-shadow-lg transition-transform group-hover:scale-[1.2] duration-300">
                                        {getWeatherIcon(code, "w-10 h-10", true, 0, maxWind)}
                                     </div>
                                </div>

                                {/* GRÀFIC TÈRMIC ESCRIPTORI */}
                                <div className="hidden md:flex flex-col items-center justify-center w-[130px] px-2">
                                    <div className="w-full flex justify-between text-[11px] font-bold text-slate-400 mb-1.5">
                                        <span>{Math.round(minTemp)}°</span>
                                        <span>{Math.round(maxTemp)}°</span>
                                    </div>
                                    <TempRangeBar 
                                        min={minTemp} 
                                        max={maxTemp} 
                                        globalMin={weeklyExtremes.min} 
                                        globalMax={weeklyExtremes.max} 
                                    />
                                </div>

                                {/* RESUM TÈRMIC MÒBIL */}
                                <div className="md:hidden flex flex-col items-end justify-center mr-3">
                                    <span className="text-[15px] font-black text-slate-200 tabular-nums leading-none mb-1">
                                        {Math.round(maxTemp)}°
                                    </span>
                                    <span className="text-[11px] font-bold text-slate-500 tabular-nums leading-none">
                                        {Math.round(minTemp)}°
                                    </span>
                                </div>

                                {/* DADES DE PLUJA I ACCIÓ */}
                                <div className="flex items-center justify-end gap-2 md:gap-3 w-[80px] md:w-[130px]">
                                    {precipSum > 0 ? (
                                        <span className="text-[9px] md:text-[10px] text-slate-400 font-mono font-bold bg-blue-950/40 px-1.5 py-1 md:px-2 rounded-md border border-blue-900/50 group-hover:border-blue-500/40 group-hover:text-blue-300 transition-colors">
                                            {formatPrecipitation(precipSum, snowSum)}
                                        </span>
                                    ) : (
                                        <span className="text-[9px] font-black text-slate-700 uppercase tracking-widest hidden md:block group-hover:text-slate-600 transition-colors">
                                            CAP
                                        </span>
                                    )}
                                    
                                    <div className="w-6 h-6 md:w-7 md:h-7 rounded-full bg-slate-900 flex items-center justify-center group-hover:bg-indigo-600 group-hover:text-white transition-all duration-300 border border-slate-700 group-hover:border-indigo-400 shrink-0 shadow-sm group-hover:shadow-[0_0_10px_rgba(99,102,241,0.5)]">
                                        <ArrowRight className="w-3 h-3 text-slate-500 group-hover:text-white transition-colors" />
                                    </div>
                                </div>
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* SECCIÓ DE GRÀFICA COMPACTA */}
            {showCharts && comparisonEnabled && (
                 <div className="p-5 md:p-8 bg-slate-900/40 border border-slate-700/50 rounded-[2rem] backdrop-blur-md shadow-2xl">
                    <h3 className="mb-6 flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.25em] text-slate-400">
                        <TrendingUp className="w-4 h-4 text-emerald-400 drop-shadow-[0_0_3px_rgba(52,211,153,0.8)]"/> 
                        {t.trend24h || "TENDÈNCIA"}
                    </h3>
                    <SmartForecastCharts 
                        data={chartData} 
                        comparisonData={comparisonData} 
                        unit={unit === 'F' ? '°F' : '°C'} 
                        lang={lang} 
                    />
                </div>
            )}
        </div>
    );
});

export default ForecastSection;