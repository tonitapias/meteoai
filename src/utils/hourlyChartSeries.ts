// src/utils/hourlyChartSeries.ts
// Sèrie horària que dibuixen els gràfics d'Expert (SmartForecastCharts): la línia principal i la de cada
// model global (ECMWF, GFS, ICON, AIFS), per a qualsevol conjunt d'hores de la previsió.
//
// Abans hi havia DOS camins que alimentaven el mateix gràfic i no coincidien: el del tauler d'Expert
// (useChartData → generateHourlyChartData) dibuixava la temperatura en brut, i el del detall de dia
// (useDayDetailData) la corregia per inversió tèrmica com la resta de l'app (capçalera, 24 h, setmana,
// IA). Ara tots dos passen per aquí, així que una mateixa hora no pot sortir amb dues xifres diferents.
//
// NO és el mateix que generateHourlyChartData: aquell manté la temperatura CRUA a propòsit, perquè
// resolveDailyExtremes (dailyExtremes.ts) hi aplica la correcció a la seva manera; corregir-la també allà
// la corregiria dues vegades. Aquesta sèrie és només per DIBUIXAR.
//
// DOCTRINA RISC ZERO: una dada que falta és null, mai un 0 fals (0 °C, 0 %, 0 mm són valors reals) i
// mai el valor d'un altre model en silenci. Les sèries de model queden alineades hora a hora amb la
// principal (un forat és un null a la seva posició, no una hora que desapareix i desplaça les altres).
import type { ExtendedWeatherData, StrictCurrentWeather } from '../types/weatherLogicTypes';
import type { WeatherUnit } from './formatters';
import { getInversionCorrectedTemp } from './rules/temperatureCorrections';
import { calculateSnowLevel } from './rules/winterRules';
import { resolveIsDay } from './hourlyWeatherCode';
import { extractValidArrayNum, extractValidNum, getSafeLatitude, getSafeMonthFromIso } from './weatherMath';

export const CHART_MODEL_KEYS = ['ecmwf', 'gfs', 'icon', 'aifs'] as const;
export type ChartModelKey = (typeof CHART_MODEL_KEYS)[number];

/** Una hora dibuixable. `temp` ja porta la correcció d'inversió i la unitat de l'usuari. */
export type HourlyChartPoint = {
    time: string;
    temp: number | null;
    /** Probabilitat de pluja (%). */
    rain: number | null;
    /** Volum de pluja (mm/h). */
    precip: number | null;
    wind: number | null;
    gusts: number | null;
    /** Cota de neu (m). */
    snowLevel: number | null;
};

export interface HourlyChartSeries {
    primary: HourlyChartPoint[];
    /** null si no hi ha cap model de comparació amb dades. Un model sense dades és una sèrie buida. */
    comparison: Record<ChartModelKey, HourlyChartPoint[]> | null;
}

type Reader = (key: string) => number | null;

// Cadena de reserva per a la cota de neu de la línia principal: els models regionals (AROME HD...) no
// publiquen freezing_level_height. Mateix ordre que la resta de l'app (vegeu resolveFreezingLevel).
const FREEZING_LEVEL_FALLBACK: ReadonlyArray<ChartModelKey> = ['ecmwf', 'gfs', 'icon'];

export const buildHourlyChartSeries = (
    weatherData: ExtendedWeatherData | null | undefined,
    indices: readonly number[],
    unit: WeatherUnit
): HourlyChartSeries => {
    const hourly = weatherData?.hourly as Record<string, unknown> | undefined;
    if (!weatherData || !hourly || !Array.isArray(hourly.time)) return { primary: [], comparison: null };

    const times = hourly.time as unknown[];
    // Les hores sense marca de temps es descarten per a TOTES les sèries alhora, perquè segueixin alineades.
    const validIndices = indices.filter(i => typeof times[i] === 'string');
    const latitude = getSafeLatitude(weatherData.location);
    const comparisonRaw = weatherData.hourlyComparison as
        | Partial<Record<ChartModelKey, Record<string, unknown>[] | undefined>>
        | undefined;

    const primaryReader = (idx: number): Reader => key => extractValidArrayNum(hourly[key], idx);
    const modelReader = (model: ChartModelKey, idx: number): Reader => {
        const row = comparisonRaw?.[model]?.[idx];
        return key => (row ? extractValidNum(row[key]) : null);
    };

    const toUserUnit = (celsius: number | null): number | null =>
        celsius === null ? null : unit === 'F' ? Math.round((celsius * 9) / 5 + 32) : celsius;

    /**
     * Mateixa fórmula que Forecast24h i DayDetailModal: mes de la pròpia hora i latitud de la ubicació.
     * Cada model es corregeix amb el SEU vent i les SEVES capes de núvols (són el que decideix si hi ha
     * inversió); si un model no els publica, s'usen els de la línia principal en aquella hora.
     */
    const buildPoint = (
        idx: number,
        read: Reader,
        fallback: Reader | null,
        isDay: boolean,
        snowSource: number | null
    ): HourlyChartPoint => {
        const time = String(times[idx]);
        const pick = (key: string): number | null => read(key) ?? fallback?.(key) ?? null;

        const rawTemp = read('temperature_2m');
        const correctedTemp = rawTemp === null
            ? null
            : getInversionCorrectedTemp(
                {
                    temperature_2m: rawTemp,
                    cloud_cover_low: pick('cloud_cover_low') ?? 0,
                    cloud_cover_mid: pick('cloud_cover_mid') ?? 0,
                    cloud_cover_high: pick('cloud_cover_high') ?? 0,
                    wind_speed_10m: pick('wind_speed_10m') ?? 0,
                    is_day: isDay ? 1 : 0
                } as unknown as StrictCurrentWeather,
                getSafeMonthFromIso(time),
                latitude
            );

        return {
            time,
            temp: toUserUnit(correctedTemp),
            rain: read('precipitation_probability'),
            precip: read('precipitation'),
            wind: read('wind_speed_10m'),
            gusts: read('wind_gusts_10m'),
            snowLevel: calculateSnowLevel(snowSource)
        };
    };

    const primaryFreezingLevel = (idx: number): number | null => {
        const own = extractValidArrayNum(hourly.freezing_level_height, idx);
        if (own !== null) return own;
        for (const model of FREEZING_LEVEL_FALLBACK) {
            const value = modelReader(model, idx)('freezing_level_height');
            if (value !== null) return value;
        }
        return null;
    };

    const isDayAt = new Map<number, boolean>();
    const primary = validIndices.map(idx => {
        const isDay = resolveIsDay(hourly, idx, () => true);
        isDayAt.set(idx, isDay);
        return buildPoint(idx, primaryReader(idx), null, isDay, primaryFreezingLevel(idx));
    });

    if (!comparisonRaw) return { primary, comparison: null };

    const comparison = {} as Record<ChartModelKey, HourlyChartPoint[]>;
    let anyModelHasData = false;
    for (const model of CHART_MODEL_KEYS) {
        if (!Array.isArray(comparisonRaw[model])) {
            comparison[model] = [];
            continue;
        }
        const points = validIndices.map(idx => {
            const read = modelReader(model, idx);
            const ownIsDay = read('is_day');
            const isDay = ownIsDay !== null ? ownIsDay >= 1 : (isDayAt.get(idx) ?? true);
            // La cota de neu d'un model és la SEVA (ECMWF i AIFS no la publiquen: línia absent, no inventada).
            return buildPoint(idx, read, primaryReader(idx), isDay, read('freezing_level_height'));
        });
        const hasData = points.some(p => p.temp !== null || p.precip !== null || p.wind !== null);
        comparison[model] = hasData ? points : [];
        anyModelHasData = anyModelHasData || hasData;
    }

    return { primary, comparison: anyModelHasData ? comparison : null };
};
