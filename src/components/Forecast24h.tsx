import React, { useMemo } from 'react';
import { ShieldCheck, Zap } from 'lucide-react';
import { getWeatherIcon } from './WeatherIcons';
import { ExtendedWeatherData } from '../utils/weatherLogic';
import { Language } from '../constants/translations';
import { HourlyForecastWidget, ChartDataPoint } from './WeatherWidgets';
import { WeatherUnit, formatPrecipitation } from '../utils/formatters';

export default function Forecast24h({ data, lang }: { data: ExtendedWeatherData, lang: Language, unit?: WeatherUnit }) {
    // ELIMINAT 'daily' del destructuring perquè no s'usava
    const { hourly, current } = data;
    
    const isArome = current.source === 'AROME HD';
    const sourceLabel = isArome ? 'AROME HD' : 'GFS / GLOBAL';

    const hourlyChartData: ChartDataPoint[] = useMemo(() => {
        if (!hourly || !hourly.time || !Array.isArray(hourly.time)) return [];
        
        const now = new Date();
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const day = String(now.getDate()).padStart(2, '0');
        const hour = String(now.getHours()).padStart(2, '0');
        
        // Busquem l'índex de l'hora actual
        const currentIsoHourPrefix = `${year}-${month}-${day}T${hour}`;
        const startIndex = hourly.time.findIndex((t: string) => t.startsWith(currentIsoHourPrefix));
        
        if (startIndex === -1) return [];

        return Array.from({ length: 25 }).map((_, i) => {
            const targetIndex = startIndex + i;
            
            // Si sortim del rang, retornem dades buides
            if (targetIndex >= hourly.time.length) {
                return { time: '', temp: 0, icon: null, precip: 0, precipText: '', isNow: false };
            }

            const timeStr = hourly.time[targetIndex];
            const dateObj = new Date(timeStr);
            const hours = String(dateObj.getHours()).padStart(2, '0');
            
            const temp = hourly.temperature_2m[targetIndex] || 0;
            const code = hourly.weather_code[targetIndex] || 0;
            const pProb = hourly.precipitation_probability?.[targetIndex] || 0;
            const pAmt = hourly.precipitation?.[targetIndex] || 0;
            
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const sAmt = (hourly as any).snowfall?.[targetIndex] || 0;
            
            const windSpeed = hourly.wind_speed_10m?.[targetIndex] || 0;
            const isDay = hourly.is_day?.[targetIndex] === 1;

            // ELIMINAT: 'cape' i 'simCurrent' que no s'utilitzaven
            
            // Lògica de text de precipitació
            let precipString = '';
            if (pAmt > 0) {
                precipString = formatPrecipitation(pAmt, sAmt);
            } else if (pProb > 0) {
                precipString = `${pProb}%`;
            }

            return {
                time: i === 0 ? (lang === 'ca' ? 'ARA' : 'NOW') : `${hours}H`,
                temp: temp,
                icon: getWeatherIcon(code, "w-8 h-8", isDay, pProb, windSpeed),
                precip: pProb || (pAmt > 0 ? 100 : 0),
                precipText: precipString,
                isNow: i === 0
            };
        });
      }, [hourly, lang]); // ELIMINAT 'current' de dependències perquè ja no s'usa dins del useMemo

    return (
        <div className="relative group w-full">
            <div className="absolute -top-3 right-4 z-20 flex items-center gap-1.5 px-2 py-0.5 rounded bg-[#151725] border border-white/10 shadow-lg transform -translate-y-1/2 ring-1 ring-white/5">
                {isArome ? (
                    <>
                        <Zap className="w-3 h-3 text-emerald-400 fill-emerald-400/20 animate-pulse" />
                        <span className="text-[9px] font-mono font-bold text-emerald-400 tracking-widest">AROME HD</span>
                    </>
                ) : (
                    <>
                        <ShieldCheck className="w-3 h-3 text-indigo-400" />
                        <span className="text-[9px] font-mono font-bold text-indigo-400 tracking-widest">{sourceLabel}</span>
                    </>
                )}
            </div>
            
            <HourlyForecastWidget data={hourlyChartData} lang={lang} />
        </div>
    );
}