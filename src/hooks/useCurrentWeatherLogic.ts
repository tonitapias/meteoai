// src/hooks/useCurrentWeatherLogic.ts
import { useMemo } from 'react';
import type { ExtendedWeatherData, StrictCurrentWeather, LocationMeta } from '../types/weatherLogicTypes';
import { formatTemp, WeatherUnit, getWeatherLabel, getSafeLocale } from '../utils/formatters';
import type { Language } from '../translations';
// 1. NOU IMPORT: La nostra lògica segura
import { getCurrentDisplayTemp, getInversionCorrectedApparent } from '../utils/rules/temperatureCorrections';
import { getSafeLatitude } from '../utils/weatherMath';
import { isRegionalModelActive } from '../constants/regionalModels';
import { resolveTodayExtremes } from '../utils/dailyExtremes';

const getStatusColor = (code: number | null) => {
    if (code === null) return 'bg-slate-600';
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
    effectiveCode: number | null;
    effectiveCloudCover?: number | null;
}

export const useCurrentWeatherLogic = ({
    data, unit, lang, shiftedNow, effectiveCode, effectiveCloudCover
}: UseCurrentWeatherLogicProps) => {
    
    const { current, location } = data;

    // Màxima i mínima d'avui: les mateixes que el detall "Avui", la llista, el gràfic de tendència i el giny de
    // Temperatura (resolveTodayExtremes, dailyExtremes.ts), amb el model regional a les hores on n'hi ha i la correcció
    // d'inversió. En °C: la conversió a °F la fa renderTemp.
    const todayExtremes = useMemo(() => resolveTodayExtremes(data), [data]);

    const formattedData = useMemo(() => {
        if (!current) return null;

        // 2. NOVA IMPLEMENTACIÓ: Calculem la temperatura corregida aquí, a la vista.
        // Convertim 'current' a StrictCurrentWeather per satisfer el tipatge.
        // (Això és segur perquè getInversionCorrectedTemp fa servir safeNum internament)
        // [FIX PRECISIÓ] Passem la latitud perquè la correcció d'inversió sàpiga en
        // quin hemisferi és realment hivern (vegeu inversionRules.ts).
        // La mateixa funció dona el "ARA" de la tira de 24 h (Forecast24h): totes dues xifres han de coincidir.
        const realTemp = getCurrentDisplayTemp(current as unknown as StrictCurrentWeather, getSafeLatitude(location));

        const renderTemp = (t: number | null | undefined) => {
            const val = formatTemp(t, unit);
            return val !== null ? val : '--';
        };

        const displayDate = shiftedNow || new Date();
        const displayTimeStr = `${String(displayDate.getHours()).padStart(2, '0')}:${String(displayDate.getMinutes()).padStart(2, '0')}`;
        
        // Data en el format de cada idioma (abans es i fr la veien en anglès: "MON, NOV 16").
        const dateStr = displayDate.toLocaleDateString(getSafeLocale(lang), { 
            weekday: 'short', day: 'numeric', month: 'short' 
        }).toUpperCase().replace('.', '');

        // Forcem el tipatge de location per corregir la pèrdua d'inferència del compilador (Risc Zero)
        const loc = location as LocationMeta | undefined;

        return {
            temps: {
                // 3. ACTUALITZACIÓ: Usem 'realTemp' en lloc de 'current.temperature_2m'
                main: renderTemp(realTemp), 
                max: renderTemp(todayExtremes.max),
                min: renderTemp(todayExtremes.min),
                // Mateixa correcció d'inversió que la temperatura (vegeu getInversionCorrectedApparent).
                apparent: renderTemp(getInversionCorrectedApparent(current.apparent_temperature, current.temperature_2m, realTemp))
            },
            meta: {
                locationName: loc?.name,
                country: loc?.country,
                regionalModelLabel: isRegionalModelActive(current.source) ? (current.source as string) : null,
                time: displayTimeStr,
                date: dateStr,
                isDay: current.is_day
            },
            stats: {
                windSpeed: current.wind_speed_10m != null ? Math.round(current.wind_speed_10m as number) : '--',
                humidity: current.relative_humidity_2m != null ? current.relative_humidity_2m : '--',
            },
            visuals: {
                statusColor: getStatusColor(effectiveCode),
                // DOCTRINA RISC ZERO: sense codi fiable, "---" (mateix marcador
                // que getWeatherLabel ja usa per a un codi desconegut), mai
                // l'etiqueta d'un 0 fals ("Cel serè").
                weatherLabel: effectiveCode !== null
                    ? getWeatherLabel({ ...current, weather_code: effectiveCode }, lang, effectiveCloudCover)
                    : "---"
            }
        };
    }, [current, location, unit, lang, shiftedNow, effectiveCode, effectiveCloudCover, todayExtremes]);

    return formattedData;
};