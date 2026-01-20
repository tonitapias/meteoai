// src/components/ForecastSection.tsx
import React, { memo } from 'react';
import { Calendar, TrendingUp, Umbrella, ArrowRight } from 'lucide-react'; // ChevronRight eliminat
import { SmartForecastCharts } from './WeatherCharts';
import { TempRangeBar } from './WeatherWidgets';
import { getWeatherIcon } from './WeatherIcons';
import { TRANSLATIONS, Language } from '../constants/translations';
import { WeatherUnit } from '../utils/formatters';
import { StrictDailyWeather } from '../utils/weatherLogic';

export interface ChartDataPoint {
  time: string;
  temp: number | null;
  precip: number | null;
  [key: string]: unknown;
}

export interface ComparisonData {
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

    if (!dailyData || !dailyData.time || !Array.isArray(dailyData.temperature_2m_min) || !Array.isArray(dailyData.temperature_2m_max)) {
        return null;
    }

    const formatDate = (dateString: string) => {
        const date = new Date(dateString);
        const dayName = new Intl.DateTimeFormat(lang === 'en' ? 'en-US' : lang === 'es' ? 'es-ES' : 'ca-ES', { weekday: 'short' }).format(date).toUpperCase().replace('.', '');
        const dayNum = date.getDate().toString().padStart(2, '0');
        return { dayName, dayNum };
    };

    return (
        <div className="flex flex-col gap-6 animate-in slide-in-from-bottom-8 duration-700">
            
            <div className="bento-card p-0 overflow-hidden bg-[#0b0c15] border border-white/5 rounded-[2.5rem] shadow-2xl relative">
                <div className="px-6 py-4 border-b border-white/5 bg-[#11131f] flex items-center justify-between sticky top-0 z-20">
                    <h3 className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.25em] text-slate-400">
                        <Calendar className="w-3.5 h-3.5 text-indigo-400" /> {t.weeklyForecast || "PREVISIÓ 7 DIES"}
                    </h3>
                    
                    <div className="hidden md:flex gap-12 text-[9px] font-mono text-slate-600 uppercase tracking-widest mr-16">
                        <span>ESTAT</span>
                        <span>RANG TÈRMIC</span>
                        <span>PRECIPITACIÓ</span>
                    </div>

                    <span className="text-[10px] text-slate-500 font-bold bg-slate-900/50 px-3 py-1 rounded-full border border-white/5 font-mono">
                        {Math.max(0, dailyData.time.length - 1)} DIES
                    </span>
                </div>

                <div className="divide-y divide-white/5">
                    {dailyData.time.map((dateStr: string, index: number) => {
                        if (index === 0) return null; 

                        const minVal = dailyData.temperature_2m_min[index];
                        const maxVal = dailyData.temperature_2m_max[index];
                        
                        if (minVal === undefined || maxVal === undefined) return null;

                        let code = dailyData.weathercode?.[index] ?? dailyData.weather_code?.[index] ?? 0;
                        const precipSum = dailyData.precipitation_sum?.[index] ?? 0;
                        const precipProb = dailyData.precipitation_probability_max?.[index] ?? 0;

                        if (code === 0 && precipSum > 5) code = 61;

                        const min = Math.round(minVal);
                        const max = Math.round(maxVal);
                        const { dayName, dayNum } = formatDate(dateStr);

                        const isHighRisk = precipProb > 50;
                        const hasPrecip = precipProb > 0;

                        return (
                            <button 
                                key={dateStr} 
                                onClick={() => onDayClick(index)}
                                className="w-full px-4 py-3 md:px-6 md:py-4 grid grid-cols-12 items-center gap-2 hover:bg-[#1a1d2d] transition-colors group relative overflow-hidden"
                            >
                                <div className="absolute left-0 top-0 bottom-0 w-1 bg-indigo-500 transform -translate-x-full group-hover:translate-x-0 transition-transform duration-300"></div>

                                <div className="col-span-4 md:col-span-3 flex items-center gap-3 md:gap-6">
                                    <div className="flex flex-col items-center justify-center w-10 md:w-12 bg-white/5 rounded-lg py-1 border border-white/5">
                                        <span className="text-[9px] font-black text-slate-400 uppercase tracking-wider">{dayName}</span>
                                        <span className="text-sm font-mono font-bold text-white tabular-nums">{dayNum}</span>
                                    </div>
                                    <div className="scale-90 group-hover:scale-110 transition-transform duration-300 filter drop-shadow-lg opacity-80 group-hover:opacity-100">
                                        {getWeatherIcon(code, "w-8 h-8", true)}
                                    </div>
                                </div>

                                <div className="col-span-5 md:col-span-6 flex items-center justify-center gap-3 px-2">
                                    <span className="text-xs font-mono font-bold text-cyan-300 tabular-nums w-8 text-right">{min}°</span>
                                    <div className="flex-1 h-full flex flex-col justify-center">
                                        <TempRangeBar 
                                            min={min} 
                                            max={max} 
                                            globalMin={weeklyExtremes.min} 
                                            globalMax={weeklyExtremes.max} 
                                        />
                                    </div>
                                    <span className="text-xs font-mono font-bold text-rose-300 tabular-nums w-8 text-left">{max}°</span>
                                </div>

                                <div className="col-span-3 flex items-center justify-end gap-2 md:gap-4">
                                    {hasPrecip ? (
                                        <div className={`
                                            flex items-center gap-1.5 px-2 py-1 rounded-md border transition-all duration-300
                                            ${isHighRisk 
                                                ? 'bg-blue-500/10 border-blue-500/40 shadow-[0_0_10px_rgba(59,130,246,0.2)]' 
                                                : 'bg-transparent border-transparent opacity-60'}
                                        `}>
                                            <Umbrella className={`w-3 h-3 ${isHighRisk ? 'text-blue-400 animate-pulse' : 'text-slate-500'}`} />
                                            <div className="flex flex-col items-end leading-none">
                                                <span className={`text-[10px] font-mono font-bold tabular-nums ${isHighRisk ? 'text-blue-200' : 'text-slate-400'}`}>
                                                    {precipProb}%
                                                </span>
                                                {precipSum > 0 && isHighRisk && (
                                                    <span className="text-[8px] font-mono text-blue-400/80 tabular-nums">
                                                        {precipSum >= 1 ? Math.round(precipSum) : precipSum.toFixed(1)}mm
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    ) : (
                                        // MODIFICACIÓ: Text 'CAP' en lloc de 'NIL'
                                        <span className="text-[9px] font-mono font-bold text-slate-700 uppercase tracking-widest hidden md:block">CAP</span>
                                    )}
                                    
                                    <div className="w-6 h-6 rounded-full bg-white/5 flex items-center justify-center group-hover:bg-indigo-500 group-hover:text-white transition-all border border-white/5 group-hover:border-indigo-400">
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