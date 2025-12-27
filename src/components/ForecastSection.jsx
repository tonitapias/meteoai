// src/components/ForecastSection.jsx
import React from 'react';
import { Clock, Calendar, TrendingUp, Umbrella } from 'lucide-react';
import { HourlyForecastChart } from './WeatherCharts';
import { TempRangeBar, MoonPhaseIcon } from './WeatherWidgets';
import { getWeatherIcon } from './WeatherIcons';
import { getMoonPhase } from '../utils/weatherLogic';
import { TRANSLATIONS } from '../constants/translations';

// Funció auxiliar per formatar dates
const formatDate = (dateString, lang) => {
    const locales = { ca: 'ca-ES', es: 'es-ES', en: 'en-US', fr: 'fr-FR' };
    const date = dateString.includes('T') ? new Date(dateString) : new Date(`${dateString}T00:00:00`);
    return new Intl.DateTimeFormat(locales[lang] || locales['ca'], { weekday: 'short' }).format(date);
};

const isSnowCode = (code) => (code >= 71 && code <= 77) || code === 85 || code === 86;

export default function ForecastSection({ 
    chartData, 
    comparisonData, 
    dailyData, 
    weeklyExtremes, 
    unit, 
    lang, 
    onDayClick,
    comparisonEnabled 
}) {
  const t = TRANSLATIONS[lang] || TRANSLATIONS['ca'];
  
  const formatTemp = (tempC) => {
    if (unit === 'F') return Math.round((tempC * 9/5) + 32);
    return Math.round(tempC);
  };
  const getUnitLabel = () => unit === 'F' ? '°F' : '°C';

  return (
    <div className="flex flex-col gap-6">
        {/* Previsió Horària (Targetes petites) */}
        <div className="bg-slate-900/40 border border-white/10 rounded-3xl p-6 backdrop-blur-sm shadow-xl">
            <h3 className="font-bold text-white flex items-center gap-2 mb-4">
                <Clock className="w-4 h-4 text-indigo-400 drop-shadow-sm fill-indigo-400/20" strokeWidth={2.5}/> {t.hourlyEvolution} (24h)
            </h3>
            {/* UX UPGRADE: Afegit snap-x per millor scroll en mòbil */}
            <div className="flex gap-4 overflow-x-auto pb-4 custom-scrollbar snap-x snap-mandatory">
                {chartData.filter((_, i) => i % 3 === 0).map((h) => (
                    <div key={h.time} className="flex flex-col items-center min-w-[3rem] snap-start">
                        <span className="text-xs text-slate-400">{new Date(h.time).getHours()}h</span>
                        <div className="my-1 scale-75 filter drop-shadow-sm">{getWeatherIcon(h.code, "w-8 h-8", h.isDay, h.rain, h.wind, h.humidity, h.precip)}</div>
                        <span className="text-sm font-bold">{Math.round(h.temp)}°</span>
                        <div className="flex flex-col items-center mt-1 h-6 justify-start">
                        {h.rain > 0 && <span className="text-[10px] text-blue-400 font-bold">{h.rain}%</span>}
                        {h.precip > 0.25 && <span className="text-[9px] text-cyan-400 font-bold">{h.precip}mm</span>}
                        </div>
                    </div>
                ))}
            </div>
        </div>

        {/* Llista 7 Dies */}
        <div className="bg-slate-900/40 border border-white/10 rounded-3xl p-6 backdrop-blur-sm shadow-xl">
            <h3 className="font-bold text-white mb-5 flex items-center gap-2">
                <Calendar className="w-4 h-4 text-amber-400 drop-shadow-sm fill-amber-400/20" strokeWidth={2.5}/> {t.forecast7days}
            </h3>
            <div className="space-y-2">
                {dailyData.time.slice(1).map((day, idx) => {
                    const i = idx + 1;
                    const displayCode = dailyData.weather_code[i];
                    const precipSum = dailyData.precipitation_sum[i];
                    const rainProb = dailyData.precipitation_probability_max[i];
                    const snowSum = dailyData.snowfall_sum[i];
                    const listMoonPhase = getMoonPhase(new Date(day));
                    
                    return (
                        <button 
                        key={day}
                        type="button"
                        onClick={() => onDayClick(i)}
                        className="w-full flex items-center justify-between p-3 hover:bg-white/5 rounded-xl transition-colors group touch-manipulation active:bg-white/10"
                        >
                        <div className="w-16 text-left">
                            <span className="font-bold text-slate-200 capitalize">{formatDate(day, lang)}</span>
                        </div>

                        <div className="hidden md:flex justify-center w-10 opacity-70">
                            <MoonPhaseIcon phase={listMoonPhase} className="w-6 h-6" />
                        </div>

                        <div className="flex items-center gap-3 w-32 md:w-36">
                            <div className="group-hover:scale-110 transition-transform filter drop-shadow-md">
                                {getWeatherIcon(displayCode, "w-8 h-8", 1, rainProb)}
                            </div>
                            <div className="flex flex-col items-start">
                                {rainProb > 10 && (
                                <span className={`text-xs flex items-center font-bold gap-0.5 ${isSnowCode(displayCode) ? 'text-cyan-200' : 'text-blue-300'}`}>
                                    <Umbrella className="w-3 h-3" strokeWidth={2.5}/>
                                    {rainProb}%
                                </span>
                                )}
                                {snowSum > 0 ? (
                                <span className="text-[10px] font-medium text-cyan-100 flex items-center gap-0.5">
                                    {snowSum}cm
                                </span>
                                ) : precipSum > 0.1 ? (
                                <span className="text-[10px] font-medium text-blue-200 flex items-center gap-0.5">
                                    {precipSum < 0.25 ? "IP" : `${Math.round(precipSum)}mm`}
                                </span>
                                ) : null}
                            </div>
                        </div>

                        <div className="flex-1 flex justify-end md:justify-center">
                            <TempRangeBar 
                                min={Math.round(dailyData.temperature_2m_min[i])}
                                max={Math.round(dailyData.temperature_2m_max[i])}
                                globalMin={weeklyExtremes.min}
                                globalMax={weeklyExtremes.max}
                                displayMin={formatTemp(dailyData.temperature_2m_min[i])}
                                displayMax={formatTemp(dailyData.temperature_2m_max[i])}
                            />
                        </div>
                        </button>
                    );
                })}
            </div>
        </div>

        {/* Gràfica de tendència */}
        {comparisonEnabled && (
             <div className="bg-slate-900/40 border border-white/10 rounded-3xl p-4 md:p-6 relative overflow-hidden backdrop-blur-sm flex flex-col shadow-xl">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 z-10 gap-4">
                <h3 className="font-bold text-white flex items-center gap-2"><TrendingUp className="w-4 h-4 text-indigo-400 drop-shadow-sm fill-indigo-400/20" strokeWidth={2.5}/> {t.trend24h}</h3>
                </div>
                <HourlyForecastChart data={chartData} comparisonData={comparisonData} unit={getUnitLabel()} lang={lang} />
            </div>
        )}
    </div>
  );
}