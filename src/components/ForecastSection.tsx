// src/components/ForecastSection.tsx
import { memo } from 'react';
import { Calendar, TrendingUp, Umbrella, ArrowRight } from 'lucide-react'; 
import { SmartForecastCharts } from './WeatherCharts';
import { TempRangeBar } from './WeatherWidgets';
import { getWeatherIcon } from './WeatherIcons';
import { TRANSLATIONS, Language } from '../translations';
import { WeatherUnit, formatPrecipitation } from '../utils/formatters';
// MODIFICAT: Importem la interfície des del lloc correcte
import { StrictDailyWeather } from '../types/weatherLogicTypes';

export interface ChartDataPoint {
  time: string;
  temp: number | null;
  precip: number | null;
  [key: string]: unknown;
}

// MODIFICAT: Alignem la interfície amb l'estructura que demana el component SmartForecastCharts
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

const ForecastSection = memo(function ForecastSection({ 
    chartData, comparisonData, dailyData, weeklyExtremes, unit, lang, onDayClick, comparisonEnabled, showCharts = true 
}: ForecastSectionProps) {
    const t = TRANSLATIONS[lang] || TRANSLATIONS['ca'];
    
    // Si no hi ha dades, no renderitzem res
    if (!dailyData || !dailyData.time) return null;

    return (
        <div className="flex flex-col gap-6 w-full max-w-7xl mx-auto">
            <div className="bento-card p-4 md:p-8 bg-[#151725] border border-white/5 rounded-[2.5rem] relative overflow-hidden shadow-2xl">
                <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/5 rounded-full blur-[80px] -mr-16 -mt-16 pointer-events-none"></div>
                
                <h3 className="mb-6 flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 z-10 relative px-2">
                    <Calendar className="w-3.5 h-3.5 text-indigo-400"/> {t.forecast7days || "PREVISIÓ 7 DIES"}
                </h3>

                <div className="grid grid-cols-1 gap-3 relative z-10">
                    {/* MODIFICAT: Tipem explícitament els paràmetres del map (string i number) */}
                    {dailyData.time.slice(1).map((dateStr: string, index: number) => {
                        const i = index + 1;
                        
                        const date = new Date(dateStr);
                        const dayName = date.toLocaleDateString(lang === 'ca' ? 'ca-ES' : 'en-US', { weekday: 'long' });
                        const dateNum = date.getDate();
                        const maxTemp = dailyData.temperature_2m_max?.[i] ?? 0;
                        const minTemp = dailyData.temperature_2m_min?.[i] ?? 0;
                        const rawCode = dailyData.weather_code?.[i] ?? 0; // MODIFICAT: Guardem com rawCode
                        const precipProb = dailyData.precipitation_probability_max?.[i] ?? 0;
                        const precipSum = dailyData.precipitation_sum?.[i] ?? 0;
                        const snowSum = dailyData.snowfall_sum?.[i] ?? 0; 
                        const maxWind = dailyData.wind_speed_10m_max?.[i] ?? 0;

                        // --- INICI MÀGIA VISUAL 7 DIES ---
                        let code = rawCode;
                        
                        // Si el codi original diu que no plou/nega (0, 1, 2, 3), recalculem els núvols amb les hores d'aquell dia
                        if (rawCode <= 3 && chartData && chartData.length > 0) {
                            const dateOnly = dateStr.slice(0, 10); // Extraiem només la data, ex: "2024-03-15"
                            
                            // Busquem a chartData totes les hores que coincideixen amb aquest dia i que són de dia
                            const dayHours = chartData.filter(d => 
                                typeof d.time === 'string' && 
                                d.time.startsWith(dateOnly) && 
                                d.isDay === 1
                            );

                            if (dayHours.length > 0) {
                                // Calculem la mitjana de núvols reals durant les hores de sol (fent càsting segur a Number)
                                const avgClouds = dayHours.reduce((acc, curr) => acc + (Number(curr.cloud) || 0), 0) / dayHours.length;

                                // Apliquem la mateixa escala lògica que a la resta de l'app
                                if (avgClouds > 85) code = 3;
                                else if (avgClouds > 45) code = 2;
                                else if (avgClouds > 15) code = 1;
                                else code = 0;
                            }
                        }
                        // --- FI MÀGIA VISUAL ---

                        return (
                            <button 
                                key={dateStr}
                                onClick={() => onDayClick(i)}
                                className="group flex items-center justify-between p-3 md:p-4 rounded-2xl bg-[#0B0C15] border border-white/5 hover:bg-[#1a1d2d] hover:border-indigo-500/30 transition-all duration-300 w-full"
                            >
                                {/* DATA I NOM */}
                                <div className="flex items-center gap-3 md:gap-4 w-auto min-w-[100px] md:w-[180px]">
                                    <div className="w-10 h-10 md:w-12 md:h-12 flex items-center justify-center rounded-xl bg-white/5 text-slate-400 group-hover:bg-white/10 group-hover:text-white transition-colors shrink-0">
                                        <span className="text-lg font-black tracking-tighter">{dateNum}</span>
                                    </div>
                                    <div className="flex flex-col items-start truncate">
                                        <span className="text-xs md:text-sm font-bold uppercase tracking-wide text-slate-300 group-hover:text-white truncate max-w-[70px] md:max-w-none">
                                            {dayName}
                                        </span>
                                        {precipProb > 0 && (
                                            <div className="flex items-center gap-1 mt-0.5">
                                                <Umbrella className="w-2.5 h-2.5 md:w-3 md:h-3 text-blue-400" />
                                                <span className="text-[9px] md:text-[10px] font-mono font-bold text-blue-400">{precipProb}%</span>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* ICONA */}
                                <div className="flex items-center justify-center flex-1 px-2 md:px-4">
                                     <div className="scale-75 md:scale-100 drop-shadow-lg transition-transform group-hover:scale-110 duration-300">
                                        {/* isDay=true, _rainProb=0, windSpeed=maxWind */}
                                        {getWeatherIcon(code, "w-10 h-10", true, 0, maxWind)}
                                     </div>
                                </div>

                                {/* TEMPERATURES (VERSIÓ DESKTOP) */}
                                <div className="hidden md:flex flex-col items-center justify-center w-[120px] px-2">
                                    <div className="w-full flex justify-between text-[10px] font-bold text-slate-500 mb-1">
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

                                {/* TEMPERATURES (VERSIÓ MÒBIL) */}
                                <div className="md:hidden flex flex-col items-end justify-center mr-3">
                                    <span className="text-sm font-bold text-white tabular-nums leading-none mb-1">{Math.round(maxTemp)}°</span>
                                    <span className="text-xs font-bold text-slate-500 tabular-nums leading-none">{Math.round(minTemp)}°</span>
                                </div>

                                {/* PLUJA I FLETXA */}
                                <div className="flex items-center justify-end gap-2 md:gap-3 w-[70px] md:w-[140px]">
                                    {precipSum > 0 ? (
                                        <span className="text-[9px] md:text-[10px] text-slate-500 font-mono font-bold bg-blue-500/10 px-1.5 py-1 md:px-2 rounded-md border border-blue-500/20 group-hover:border-blue-500/40 group-hover:text-blue-300 transition-colors">
                                            {formatPrecipitation(precipSum, snowSum)}
                                        </span>
                                    ) : (
                                        <span className="text-[9px] font-mono font-bold text-slate-700 uppercase tracking-widest hidden md:block">CAP</span>
                                    )}
                                    
                                    <div className="w-6 h-6 rounded-full bg-white/5 flex items-center justify-center group-hover:bg-indigo-500 group-hover:text-white transition-all border border-white/5 group-hover:border-indigo-400 shrink-0">
                                        <ArrowRight className="w-3 h-3 text-slate-500 group-hover:text-white transition-colors" />
                                    </div>
                                </div>
                            </button>
                        );
                    })}
                </div>
            </div>

            {showCharts && comparisonEnabled && (
                 <div className="bento-card p-6 bg-[#151725] border border-white/5 rounded-[2.5rem]">
                    <h3 className="mb-6 flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
                        <TrendingUp className="w-3.5 h-3.5 text-emerald-400"/> {t.trend24h || "TENDÈNCIA"}
                    </h3>
                    <SmartForecastCharts data={chartData} comparisonData={comparisonData} unit={unit === 'F' ? '°F' : '°C'} lang={lang} />
                </div>
            )}
        </div>
    );
});

export default ForecastSection;