import React, { useMemo } from 'react';
import { ShieldCheck, Zap } from 'lucide-react';
import { getWeatherIcon } from './WeatherIcons';
import { getRealTimeWeatherCode, StrictCurrentWeather, ExtendedWeatherData } from '../utils/weatherLogic';
import { Language } from '../constants/translations';
import { HourlyForecastWidget, ChartDataPoint } from './WeatherWidgets';
import { WeatherUnit } from '../utils/formatters';

export default function Forecast24h({ data, lang }: { data: ExtendedWeatherData, lang: Language, unit?: WeatherUnit }) {
    const { hourly, current, daily } = data;
    
    const isArome = current.source === 'AROME HD';
    const sourceLabel = isArome ? 'AROME HD' : 'GFS / GLOBAL';

    const hourlyChartData: ChartDataPoint[] = useMemo(() => {
        if (!hourly || !hourly.time || !Array.isArray(hourly.time)) return [];
        
        // CORRECCIÓ: Construïm l'ISO manualment amb l'hora local, no UTC
        const now = new Date();
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const day = String(now.getDate()).padStart(2, '0');
        const hour = String(now.getHours()).padStart(2, '0');
        
        // Ara tenim "2024-02-14T15" basat en l'hora real del rellotge local
        const nowIso = `${year}-${month}-${day}T${hour}`;

        let startIdx = hourly.time.findIndex((t: string) => t && t.startsWith(nowIso));
        if (startIdx === -1) startIdx = 0; 
        
        return hourly.time.slice(startIdx, startIdx + 24).map((t: string, i: number) => {
            const idx = startIdx + i;
            const dateObj = new Date(t);
            const hours = dateObj.getHours(); 
            
            let isDay = hours >= 7 && hours <= 20;
            const dayIso = t.split('T')[0];
            const dailyIndex = daily?.time?.findIndex((d: string) => d === dayIso);
            
            if (dailyIndex !== -1 && daily?.sunrise?.[dailyIndex] && daily?.sunset?.[dailyIndex]) {
                const sunriseDate = new Date(daily.sunrise[dailyIndex]);
                const sunsetDate = new Date(daily.sunset[dailyIndex]);
                const sunriseHour = sunriseDate.getHours();
                const sunsetHour = sunsetDate.getHours();
                isDay = hours >= sunriseHour && hours < sunsetHour;
            }
    
            const temp = hourly.temperature_2m?.[idx] ?? 0;
            const weatherCode = hourly.weathercode?.[idx] ?? hourly.weather_code?.[idx] ?? 0;
            const pProb = hourly.precipitation_probability?.[idx] ?? 0;
            const pAmt = hourly.precipitation?.[idx] ?? 0;
            const windSpeed = hourly.wind_speed_10m?.[idx] ?? 0;
            const cape = hourly.cape?.[idx] ?? 0;
            
            const simCurrent: StrictCurrentWeather = { 
                ...current, weather_code: weatherCode, temperature_2m: temp, is_day: isDay ? 1 : 0, 
                precipitation: pAmt, relative_humidity_2m: 0, apparent_temperature: temp, wind_speed_10m: windSpeed, time: t
            };
            const code = getRealTimeWeatherCode(simCurrent, [pAmt], pProb, 2500, 0, cape);
    
            return {
                time: i === 0 ? (lang === 'ca' ? 'ARA' : 'NOW') : `${hours}H`,
                temp: temp,
                icon: getWeatherIcon(code, "w-8 h-8", isDay, pProb, windSpeed),
                precip: pProb || (pAmt > 0 ? 100 : 0),
                precipText: pAmt > 0 ? `${pAmt}mm` : (pProb > 0 ? `${pProb}%` : ''),
                isNow: i === 0
            };
        });
      }, [hourly, current, lang, daily]);

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
                        <span className="text-[9px] font-mono font-bold text-indigo-300 tracking-widest">{sourceLabel}</span>
                    </>
                )}
            </div>

            <HourlyForecastWidget data={hourlyChartData} lang={lang} />
        </div>
    );
}