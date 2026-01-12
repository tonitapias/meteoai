// src/components/ForecastSection.tsx
import React, { memo } from 'react';
import { Clock, Calendar, TrendingUp, ChevronRight, AlertTriangle, Umbrella, Droplets, Snowflake } from 'lucide-react';
import { SmartForecastCharts } from './WeatherCharts';
import { TempRangeBar } from './WeatherWidgets';
import { getWeatherIcon } from './WeatherIcons';
import { TRANSLATIONS, Language } from '../constants/translations';
import { WeatherUnit, formatTemp } from '../utils/formatters';

interface ForecastSectionProps {
    chartData: any[];
    comparisonData: any;
    dailyData: any;
    weeklyExtremes: { min: number; max: number };
    unit: WeatherUnit;
    lang: Language;
    onDayClick: (index: number) => void;
    comparisonEnabled: boolean;
}

const ForecastSection = memo(function ForecastSection({ 
    chartData, comparisonData, dailyData, weeklyExtremes, unit, lang, onDayClick, comparisonEnabled 
}: ForecastSectionProps) {
  const t = TRANSLATIONS[lang] || TRANSLATIONS['ca'];
  
  const formatDate = (dateString: string) => {
      const d = dateString.includes('T') ? new Date(dateString) : new Date(`${dateString}T00:00:00`);
      return new Intl.DateTimeFormat(lang === 'ca' ? 'ca-ES' : 'en-US', { weekday: 'short', day: 'numeric' }).format(d);
  };

  return (
    <div className="flex flex-col gap-6 w-full">
        
        {/* 1. CAROUSEL HORARI (24h) */}
        <div className="bg-slate-900/40 border border-white/10 rounded-3xl p-5 backdrop-blur-sm shadow-lg w-full overflow-hidden">
            <h3 className="font-bold text-white flex items-center gap-2 mb-4 text-sm uppercase tracking-wider pl-1">
                <Clock className="w-4 h-4 text-indigo-400"/> {t.hourlyEvolution} (24h)
            </h3>
            <div className="flex gap-2 overflow-x-auto pb-4 custom-scrollbar snap-x snap-mandatory">
                {chartData.map((h, i) => {
                    if (i > 24 && i % 3 !== 0) return null;
                    
                    const isSnow = h.temp < 1.5;
                    const precipAmount = h.precip || 0;
                    const precipProb = h.rain || 0;

                    return (
                        <div key={i} className="flex flex-col items-center min-w-[4rem] snap-start p-2 rounded-xl hover:bg-white/5 transition-colors border border-transparent hover:border-white/5">
                            <span className="text-xs text-slate-400 font-medium mb-1">{new Date(h.time).getHours()}h</span>
                            <div className="my-1 scale-100 drop-shadow-sm">{getWeatherIcon(h.code, "w-8 h-8", h.isDay)}</div>   
                            <span className="text-sm font-bold text-white mt-1">{Math.round(h.temp)}°</span>
                            
                            {precipProb > 0 ? (
                                <div className="mt-2 w-full flex flex-col items-center">
                                    {precipAmount > 0 && (
                                        <div className={`flex items-center gap-0.5 text-[10px] font-bold mb-0.5 ${isSnow ? 'text-white' : 'text-blue-200'}`}>
                                            {isSnow ? <Snowflake className="w-2.5 h-2.5" /> : <Droplets className="w-2.5 h-2.5" />}
                                            {precipAmount >= 10 ? Math.round(precipAmount) : precipAmount.toFixed(1)}
                                            <span className="opacity-70 text-[8px]">{isSnow ? 'cm' : 'mm'}</span>
                                        </div>
                                    )}
                                    <div className="w-full flex flex-col items-center gap-0.5">
                                        <div className="h-1 w-8 bg-slate-700/50 rounded-full overflow-hidden">
                                            <div className={`h-full rounded-full ${isSnow ? 'bg-slate-200' : 'bg-blue-500'}`} style={{ width: `${Math.min(precipProb, 100)}%` }}></div>
                                        </div>
                                        <span className={`text-[9px] font-bold ${isSnow ? 'text-slate-300' : 'text-blue-400'}`}>{precipProb}%</span>
                                    </div>
                                </div>
                            ) : (
                                <div className="mt-2 h-8"></div>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>

        {/* 2. PREVISIÓ 7 DIES (AMB MM/CM) */}
        <div className="bg-slate-900/40 border border-white/10 rounded-3xl p-5 backdrop-blur-sm shadow-lg w-full">
            <h3 className="font-bold text-white flex items-center gap-2 mb-4 text-sm uppercase tracking-wider pl-1">
                <Calendar className="w-4 h-4 text-amber-400"/> {t.forecast7days}
            </h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                {dailyData.time.slice(1).map((day: string, idx: number) => {
                    const i = idx + 1;
                    const min = dailyData.temperature_2m_min[i];
                    const max = dailyData.temperature_2m_max[i];
                    const rainProb = dailyData.precipitation_probability_max[i];
                    
                    // Noves dades de quantitat
                    const precipSum = dailyData.precipitation_sum ? dailyData.precipitation_sum[i] : 0;
                    const snowSum = dailyData.snowfall_sum ? dailyData.snowfall_sum[i] : 0;
                    
                    const isSnowForecast = snowSum > 0;
                    const amount = isSnowForecast ? snowSum : precipSum;
                    const amountUnit = isSnowForecast ? 'cm' : 'mm';

                    // Càlcul de Divergència
                    const gfsMax = comparisonData?.daily?.gfs?.temperature_2m_max?.[i];
                    const iconMax = comparisonData?.daily?.icon?.temperature_2m_max?.[i];
                    let diff = 0;
                    if (gfsMax !== undefined && iconMax !== undefined) diff = Math.abs(gfsMax - iconMax);
                    const showDivergence = diff > 4;

                    return (
                        <button key={day} onClick={() => onDayClick(i)} className="flex flex-col p-3.5 bg-white/[0.02] hover:bg-white/[0.08] border border-white/5 rounded-2xl transition-all group active:scale-[0.98] gap-3">
                            <div className="flex items-center justify-between w-full">
                                <div className="flex items-center gap-3">
                                    <div className="font-bold text-slate-200 capitalize w-14 text-left text-sm">{formatDate(day)}</div>
                                    <div className="scale-100 drop-shadow-sm">{getWeatherIcon(dailyData.weather_code[i], "w-8 h-8", 1)}</div>
                                </div>
                                <div className="flex-1 ml-4 mr-2">
                                    <TempRangeBar min={Math.round(min)} max={Math.round(max)} globalMin={weeklyExtremes.min} globalMax={weeklyExtremes.max} displayMin={formatTemp(min, unit)} displayMax={formatTemp(max, unit)}/>
                                </div>
                                <ChevronRight className="w-4 h-4 text-white/20 group-hover:text-white/60" />
                            </div>

                            {/* Fila de detalls extra (Probabilitat, Quantitat i Divergència) */}
                            {(rainProb > 0 || showDivergence || amount > 0) && (
                                <div className="flex flex-wrap items-center gap-2 pl-[4.5rem] w-full">
                                    
                                    {/* Badge Probabilitat % */}
                                    {rainProb > 0 && (
                                        <div className={`flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded border ${rainProb > 50 ? 'bg-blue-500/20 text-blue-200 border-blue-500/30' : 'bg-slate-700/30 text-slate-300 border-slate-600/30'}`}>
                                            <Umbrella className="w-3 h-3" />
                                            {rainProb}%
                                        </div>
                                    )}

                                    {/* Badge Quantitat (NOU) */}
                                    {amount > 0 && (
                                        <div className={`flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded border ${isSnowForecast ? 'bg-slate-100/10 text-white border-white/20' : 'bg-cyan-500/10 text-cyan-200 border-cyan-500/20'}`}>
                                            {isSnowForecast ? <Snowflake className="w-3 h-3"/> : <Droplets className="w-3 h-3"/>}
                                            {amount >= 10 ? Math.round(amount) : amount.toFixed(1)}{amountUnit}
                                        </div>
                                    )}

                                    {/* Alerta Incertesa */}
                                    {showDivergence && (
                                        <div className="flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20 animate-pulse" title="Alta incertesa entre models">
                                            <AlertTriangle className="w-3 h-3" />
                                            <span className="hidden sm:inline">Incertesa</span>
                                        </div>
                                    )}
                                </div>
                            )}
                        </button>
                    );
                })}
            </div>
        </div>

        {/* 3. GRÀFICS DE MODELS */}
        {comparisonEnabled && (
             <div className="bg-slate-900/40 border border-white/10 rounded-3xl p-5 relative overflow-hidden backdrop-blur-sm shadow-xl w-full">
                <div className="flex justify-between items-center mb-6 pl-1">
                    <h3 className="font-bold text-white flex items-center gap-2 text-sm uppercase tracking-wider">
                        <TrendingUp className="w-4 h-4 text-indigo-400"/> {t.trend24h}
                    </h3>
                    <div className="hidden md:flex gap-2">
                        <span className="text-[10px] bg-indigo-500/20 text-indigo-200 px-2 py-1 rounded border border-indigo-500/30 font-bold tracking-wider">ECMWF</span>
                        <span className="text-[10px] bg-green-500/20 text-green-200 px-2 py-1 rounded border border-green-500/30 font-bold tracking-wider">GFS</span>
                        <span className="text-[10px] bg-amber-500/20 text-amber-200 px-2 py-1 rounded border border-amber-500/30 font-bold tracking-wider">ICON</span>
                    </div>
                </div>
                
                <div className="w-full overflow-hidden">
                    <div className="w-full">
                        <SmartForecastCharts data={chartData} comparisonData={comparisonData} unit={unit === 'F' ? '°F' : '°C'} lang={lang} />
                    </div>
                </div>
            </div>
        )}
    </div>
  );
});

export default ForecastSection;