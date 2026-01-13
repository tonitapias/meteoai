// src/components/ForecastSection.tsx
import React, { memo } from 'react';
import { Clock, Calendar, TrendingUp, ChevronRight, Droplets, Snowflake, Umbrella } from 'lucide-react';
import { SmartForecastCharts } from './WeatherCharts';
import { TempRangeBar } from './WeatherWidgets';
import { getWeatherIcon } from './WeatherIcons';
import { TRANSLATIONS, Language } from '../constants/translations';
import { WeatherUnit, formatTemp } from '../utils/formatters';

interface ForecastSectionProps {
    chartData: any[]; comparisonData: any; dailyData: any; weeklyExtremes: { min: number; max: number };
    unit: WeatherUnit; lang: Language; onDayClick: (index: number) => void; 
    comparisonEnabled: boolean;
    showCharts?: boolean;
}

const ForecastSection = memo(function ForecastSection({ 
    chartData, comparisonData, dailyData, weeklyExtremes, unit, lang, onDayClick, comparisonEnabled, showCharts = true 
}: ForecastSectionProps) {
  const t = TRANSLATIONS[lang] || TRANSLATIONS['ca'];
  
  // FIX: Format segur que evita el timezone shift ("salt de dia"). 
  // Forcem l'hora a les 12:00 del migdia per assegurar que el dia de la setmana es manté estable.
  const formatDate = (dateString: string) => {
      const datePart = dateString.includes('T') ? dateString.split('T')[0] : dateString;
      const [y, m, d] = datePart.split('-').map(Number);
      const safeDate = new Date(y, m - 1, d, 12, 0, 0); 
      return new Intl.DateTimeFormat(lang === 'ca' ? 'ca-ES' : 'en-US', { weekday: 'short', day: 'numeric' }).format(safeDate);
  };

  // FIX: Helper per extreure l'hora crua (HH) de l'ISO string
  const getRawHour = (isoString: string) => {
      try {
          return parseInt(isoString.split('T')[1].split(':')[0], 10);
      } catch (e) {
          return new Date(isoString).getHours();
      }
  };

  return (
    <div className="flex flex-col gap-6 w-full">
        {/* 1. HOURLY STRIP (EVOLUCIÓ 24H) */}
        <div className="bento-card p-6">
            <h3 className="label-upper mb-4 flex items-center gap-2">
                <Clock className="w-4 h-4 text-indigo-400"/> {t.hourlyEvolution} (24h)
            </h3>
            <div className="flex gap-3 overflow-x-auto pb-4 snap-x snap-mandatory scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent hover:scrollbar-thumb-white/20">
                {chartData.map((h, i) => {
                    if (i > 24) return null;
                    const isSnow = h.temp < 1.5;
                    const precipProb = h.rain || 0;
                    const precipAmount = h.precip || 0; 
                    const showPrecipitation = precipProb > 0 || precipAmount >= 0.1;

                    return (
                        <div key={i} className="flex flex-col items-center min-w-[4.5rem] snap-start p-3 rounded-2xl bg-white/5 border border-white/5 hover:bg-white/10 transition-colors">
                            {/* FIX: Use raw hour extraction per evitar hores incorrectes */}
                            <span className="text-xs text-slate-400 font-bold mb-2">{getRawHour(h.time)}h</span>
                            <div className="mb-2 scale-110 drop-shadow-md">
                                {getWeatherIcon(h.code, "w-8 h-8", h.isDay)}
                            </div>   
                            <span className="text-lg font-bold text-white mb-1">{Math.round(h.temp)}°</span>
                            
                            <div className="flex flex-col items-center w-full gap-1 mt-1 min-h-[1.5rem] justify-end">
                                {showPrecipitation ? (
                                    <>
                                        <div className="h-1 w-full bg-slate-700/50 rounded-full overflow-hidden">
                                            <div 
                                                className={`h-full ${isSnow ? 'bg-slate-200' : 'bg-blue-500'}`} 
                                                style={{ width: `${Math.max(Math.min(precipProb, 100), precipAmount > 0 ? 10 : 0)}%` }}
                                            ></div>
                                        </div>
                                        {precipAmount >= 0.1 ? (
                                            <span className={`text-[9px] font-bold ${isSnow ? 'text-slate-300' : 'text-blue-300'}`}>
                                                {precipAmount >= 1 ? Math.round(precipAmount) : precipAmount.toFixed(1)}
                                                {isSnow ? 'cm' : 'mm'}
                                            </span>
                                        ) : (
                                            <span className="text-[9px] font-medium text-slate-500">{precipProb}%</span>
                                        )}
                                    </>
                                ) : (
                                    <div className="h-1 w-full"></div>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>

        {/* 2. DAILY FORECAST */}
        <div className="bento-card p-6">
            <h3 className="label-upper mb-4 flex items-center gap-2">
                <Calendar className="w-4 h-4 text-amber-400"/> {t.forecast7days}
            </h3>
            <div className="grid grid-cols-1 gap-2">
                {dailyData.time.slice(1).map((day: string, idx: number) => {
                    const i = idx + 1;
                    const precipSum = dailyData.precipitation_sum ? dailyData.precipitation_sum[i] : 0;
                    const precipProb = dailyData.precipitation_probability_max ? dailyData.precipitation_probability_max[i] : 0;
                    const isSnow = dailyData.snowfall_sum && dailyData.snowfall_sum[i] > 0;
                    const hasPrecip = precipProb > 0 || precipSum > 0;

                    return (
                        <button key={day} onClick={() => onDayClick(i)} className="flex items-center justify-between p-3.5 bg-white/5 hover:bg-white/10 border border-white/5 rounded-2xl transition-all group w-full active:scale-[0.99]">
                            <div className="flex items-center gap-4 w-28 md:w-32">
                                {/* FIX: Ensure formatDate uses safety logic */}
                                <span className="font-bold text-slate-200 capitalize w-10 text-sm text-left">{formatDate(day).split(' ')[0]}</span>
                                <div className="scale-100">{getWeatherIcon(dailyData.weather_code[i], "w-8 h-8", 1)}</div>
                            </div>
                            
                            <div className="flex-1 mx-2 md:mx-4 relative h-8 flex items-center">
                                <TempRangeBar min={Math.round(dailyData.temperature_2m_min[i])} max={Math.round(dailyData.temperature_2m_max[i])} globalMin={weeklyExtremes.min} globalMax={weeklyExtremes.max} displayMin={formatTemp(dailyData.temperature_2m_min[i], unit)} displayMax={formatTemp(dailyData.temperature_2m_max[i], unit)}/>
                            </div>

                            <div className="flex items-center gap-3 w-auto justify-end min-w-[5.5rem]">
                                {hasPrecip ? (
                                    <div className={`flex flex-col items-end`}>
                                        <div className={`flex items-center gap-1 text-[10px] font-bold ${isSnow ? 'text-slate-200' : 'text-blue-300'}`}>
                                            <Umbrella className="w-3 h-3"/> {precipProb}%
                                        </div>
                                        {precipSum > 0 && (
                                            <span className="text-[9px] text-slate-400 font-medium">
                                                {precipSum >= 1 ? Math.round(precipSum) : precipSum.toFixed(1)}{isSnow ? 'cm' : 'mm'}
                                            </span>
                                        )}
                                    </div>
                                ) : (
                                    <span className="text-[10px] text-slate-600 font-medium">-</span>
                                )}
                                <ChevronRight className="w-4 h-4 text-white/20 group-hover:text-white transition-colors" />
                            </div>
                        </button>
                    );
                })}
            </div>
        </div>

        {/* 3. CHARTS */}
        {showCharts && comparisonEnabled && (
             <div className="bento-card p-6">
                <h3 className="label-upper mb-6 flex items-center gap-2"><TrendingUp className="w-4 h-4 text-emerald-400"/> {t.trend24h}</h3>
                <SmartForecastCharts data={chartData} comparisonData={comparisonData} unit={unit === 'F' ? '°F' : '°C'} lang={lang} />
            </div>
        )}
    </div>
  );
});

export default ForecastSection;