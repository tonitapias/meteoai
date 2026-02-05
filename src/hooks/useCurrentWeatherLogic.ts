// src/hooks/useCurrentWeatherLogic.ts
import { useMemo } from 'react';
import { ExtendedWeatherData } from '../utils/weatherLogic';
import { formatTemp, WeatherUnit, getWeatherLabel } from '../utils/formatters';
import { Language } from '../translations';
// 1. NOU IMPORT: La nostra lògica segura
import { getInversionCorrectedTemp } from '../utils/rules/temperatureCorrections';
import { StrictCurrentWeather } from '../types/weatherLogicTypes';

const getStatusColor = (code: number) => {
    if (code <= 1) return 'bg-emerald-500 shadow-[0_0_10px_#10b981]';
    if (code <= 3) return 'bg-blue-400 shadow-[0_0_10px_#60a5fa]';
    if (code >= 95) return 'bg-rose-500 shadow-[0_0_10px_#f43f5e] animate-pulse';
    if (code >= 51) return 'bg-amber-400 shadow-[0_0_10px_#fbbf24]';
    return 'bg-slate-400';
};

interface UseCurrentWeatherLogicProps {
    data: ExtendedWeatherData;
    unit: WeatherUnit;
    lang: Language;
    shiftedNow?: Date;
    effectiveCode: number;
}

export const useCurrentWeatherLogic = ({ 
    data, unit, lang, shiftedNow, effectiveCode 
}: UseCurrentWeatherLogicProps) => {
    
    const { current, location, daily } = data;

    const formattedData = useMemo(() => {
        if (!current) return null;

        // 2. NOVA IMPLEMENTACIÓ: Calculem la temperatura corregida aquí, a la vista.
        // Convertim 'current' a StrictCurrentWeather per satisfer el tipatge.
        // (Això és segur perquè getInversionCorrectedTemp fa servir safeNum internament)
        const realTemp = getInversionCorrectedTemp(current as unknown as StrictCurrentWeather);

        const renderTemp = (t: number | null | undefined) => {
            const val = formatTemp(t, unit);
            return val !== null ? val : '--';
        };

        const displayDate = shiftedNow || new Date();
        const displayTimeStr = `${String(displayDate.getHours()).padStart(2, '0')}:${String(displayDate.getMinutes()).padStart(2, '0')}`;
        
        const dateStr = displayDate.toLocaleDateString(lang === 'ca' ? 'ca-ES' : 'en-US', { 
            weekday: 'short', day: 'numeric', month: 'short' 
        }).toUpperCase().replace('.', '');

        const maxTemp = daily?.temperature_2m_max?.[0];
        const minTemp = daily?.temperature_2m_min?.[0];

        return {
            temps: {
                // 3. ACTUALITZACIÓ: Usem 'realTemp' en lloc de 'current.temperature_2m'
                main: renderTemp(realTemp), 
                max: renderTemp(maxTemp),
                min: renderTemp(minTemp),
                apparent: renderTemp(current.apparent_temperature)
            },
            meta: {
                locationName: location?.name,
                country: location?.country || "LOCAL",
                isUsingArome: current.source === 'AROME HD',
                time: displayTimeStr,
                date: dateStr,
                isDay: current.is_day
            },
            stats: {
                windSpeed: current.wind_speed_10m != null ? Math.round(current.wind_speed_10m) : '--',
                humidity: current.relative_humidity_2m != null ? current.relative_humidity_2m : '--',
            },
            visuals: {
                statusColor: getStatusColor(effectiveCode),
                weatherLabel: getWeatherLabel({ ...current, weather_code: effectiveCode }, lang)
            }
        };
    }, [current, location, daily, unit, lang, shiftedNow, effectiveCode]);

    return formattedData;
};