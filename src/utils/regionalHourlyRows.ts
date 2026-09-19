// src/utils/regionalHourlyRows.ts
// Files horàries del modal del model regional (AROME HD, ICON-D2...). Extret de
// RegionalModelModal.tsx com a funció pura perquè es pugui testar que la icona de
// cada fila coincideix amb la de la resta de l'app (vegeu hourlyWeatherCode.ts).
import type { ExtendedWeatherData, StrictCurrentWeather } from '../types/weatherLogicTypes';
import { getHourlyWeatherCode, getHourlyEffectiveCloudCover, resolveFreezingLevel, resolveIsDay, type HourlySeries } from './hourlyWeatherCode';
import { getInversionCorrectedTemp } from './rules/temperatureCorrections';
import { calculateEffectiveCloudCover } from './rules/cloudRules';
import { extractValidArrayNum, getSafeArrayNum, getSafeMonthFromIso } from './weatherMath';

export interface RegionalHourlyRow {
    time: string;
    hour: number;
    date: string;
    temp: number;
    precip: number;
    code: number;
    wind: number;
    gust: number;
    windDir: number;
    cape: number;
    freezingLevel: number;
    isDay: boolean;
    cloudCover: number;
    /** % de núvols de la mateixa sèrie que decideix la icona (vegeu getHourlyEffectiveCloudCover). */
    iconCloudCover: number | null;
}

interface BuildRowsArgs {
    /** Sèries crues del model regional (ja sense sufixos de model). */
    hourly: HourlySeries | undefined;
    /** Elevació de la graella del model regional (la que mostra la capçalera). */
    elevation: number;
    utcOffsetSeconds: number;
    latitude: number;
    /**
     * Dades combinades de l'app (model regional + global) — la mateixa font que
     * llegeixen Forecast24h i DayDetailModal. Si hi és, la icona i la cota 0 °C de
     * cada fila es calculen sobre aquesta sèrie perquè la mateixa hora mostri el
     * mateix a tot arreu. Sense ella, s'usa la sèrie crua del model regional.
     */
    baseData?: ExtendedWeatherData | null;
    /** Només per a tests. */
    now?: Date;
}

export const buildRegionalHourlyRows = ({
    hourly,
    elevation,
    utcOffsetSeconds,
    latitude,
    baseData,
    now = new Date()
}: BuildRowsArgs): RegionalHourlyRow[] => {
    const times = hourly?.time;
    if (!hourly || !Array.isArray(times) || times.length === 0) return [];

    const locationNow = new Date(now.getTime() + utcOffsetSeconds * 1000);
    const todayDateStr = locationNow.toISOString().split('T')[0];
    const nowHour = locationNow.getUTCHours();

    // Índex de la sèrie combinada per timestamp ("YYYY-MM-DDTHH:00", mateix format
    // d'Open-Meteo a les dues peticions amb timezone=auto).
    const baseHourly = baseData?.hourly as unknown as HourlySeries | undefined;
    const baseTimes = baseHourly?.time;
    const baseIndexByTime = new Map<string, number>();
    if (Array.isArray(baseTimes)) {
        baseTimes.forEach((t, i) => { if (typeof t === 'string') baseIndexByTime.set(t, i); });
    }
    const baseElevation = typeof baseData?.elevation === 'number' && !isNaN(baseData.elevation)
        ? baseData.elevation
        : elevation;

    const rows: RegionalHourlyRow[] = [];

    for (let i = 0; i < times.length; i++) {
        const timeStr = times[i];
        if (!timeStr || typeof timeStr !== 'string') continue;

        const dateStr = timeStr.slice(0, 10);
        const hour = parseInt(timeStr.slice(11, 13), 10);

        if (dateStr < todayDateStr) continue;
        if (dateStr === todayDateStr && hour < nowHour) continue;

        const tempActual = extractValidArrayNum(hourly.temperature_2m, i);
        if (tempActual === null) continue;

        // Sèrie sobre la qual es decideix la icona i la cota 0 °C d'aquesta fila:
        // la combinada si aquesta hora hi és, si no la crua del model regional.
        const baseIdx = baseIndexByTime.get(timeStr);
        const useBase = !!baseHourly && baseIdx !== undefined;
        const iconSeries: HourlySeries = useBase ? baseHourly : hourly;
        const iconIdx = useBase ? baseIdx : i;
        const iconElevation = useBase ? baseElevation : elevation;

        const low = getSafeArrayNum(hourly.cloud_cover_low, i, 0);
        const mid = getSafeArrayNum(hourly.cloud_cover_mid, i, 0);
        const high = getSafeArrayNum(hourly.cloud_cover_high, i, 0);
        const wind = getSafeArrayNum(hourly.wind_speed_10m, i, 0);
        const gust = getSafeArrayNum(hourly.wind_gusts_10m, i, 0);

        const isDay = resolveIsDay(iconSeries, iconIdx, () => resolveIsDay(hourly, i, () => hour >= 7 && hour <= 21));

        const code = getHourlyWeatherCode(iconSeries, iconIdx, iconElevation, baseData?.hourlyComparison);

        // Mateixa correcció d'inversió tèrmica que Forecast24h i DayDetailModal,
        // perquè la mateixa hora no mostri dues temperatures diferents a l'hivern.
        const temp = getInversionCorrectedTemp(
            {
                temperature_2m: tempActual,
                is_day: isDay ? 1 : 0,
                wind_speed_10m: wind,
                cloud_cover_low: low,
                cloud_cover_mid: mid,
                cloud_cover_high: high
            } as unknown as StrictCurrentWeather,
            getSafeMonthFromIso(timeStr),
            latitude
        );

        rows.push({
            time: timeStr,
            hour,
            date: dateStr,
            temp,
            precip: getSafeArrayNum(hourly.precipitation, i, 0),
            // code només pot ser null si la temperatura és invàlida, i ja hem fet
            // `continue` més amunt en aquest cas — el ?? 0 és defensiu per al tipatge.
            code: code ?? 0,
            wind,
            gust: Math.max(wind, gust),
            windDir: getSafeArrayNum(hourly.wind_direction_10m, i, 0),
            cape: getSafeArrayNum(hourly.cape, i, 0),
            freezingLevel: resolveFreezingLevel(iconSeries, iconIdx, iconElevation, tempActual, baseData?.hourlyComparison),
            isDay,
            cloudCover: calculateEffectiveCloudCover(low, mid, high),
            iconCloudCover: getHourlyEffectiveCloudCover(iconSeries, iconIdx)
        });
    }

    return rows;
};
