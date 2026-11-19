// src/utils/temperatureDetail.ts
// Lògica pura del giny i del modal de Temperatura (pestanya Detall): la finestra horària des d'ara, amb la temperatura i
// la sensació tèrmica tal com les mostra la resta de l'app, i el resum que en treuen la targeta i el modal.
//
// Font única, cap xifra pròpia:
//   - "ara" = getCurrentDisplayTemp (bloc `current` + correcció d'inversió): el mateix número que la capçalera i que la
//     targeta "ARA" de les 24 h. La sensació d'ara, getInversionCorrectedApparent sobre aquest mateix número.
//   - les hores = buildHourlyChartSeries (la sèrie que DIBUIXEN els gràfics, ja corregida per inversió amb el mes i el
//     vent de cada hora); la sensació de cada hora es desplaça tant com la seva temperatura (getInversionCorrectedApparent).
//   - la màxima i la mínima d'avui = resolveTodayExtremes (dailyExtremes.ts), les mateixes que la capçalera.
// Reutilitza hourly.temperature_2m i hourly.apparent_temperature, ja demanats a Open-Meteo: cap crida de xarxa nova.
//
// DOCTRINA RISC ZERO: una hora sense dada és null (mai un 0 °C fals, que és un valor real) i no compta per a cap
// extrem, tendència ni recompte.
import type { ExtendedWeatherData, StrictCurrentWeather } from '../types/weatherLogicTypes';
import { WEATHER_THRESHOLDS } from '../constants/weatherConfig';
import { buildHourlyChartSeries } from './hourlyChartSeries';
import { getCurrentDisplayTemp, getInversionCorrectedApparent } from './rules/temperatureCorrections';
import { extractValidArrayNum, getSafeLatitude } from './weatherMath';

const { TEMP } = WEATHER_THRESHOLDS;

/** Per sota d'aquesta variació en 3 h (°C), la temperatura es considera estable. */
export const TREND_STEADY_C = 1;
/** Un canvi en 3 h a partir d'aquí (°C) es destaca com a "brusc" al modal. */
export const SHARP_CHANGE_C = 4;
/** Diferència mínima (°C) entre sensació i temperatura per dir que "se sent" diferent. */
export const FEELS_GAP_C = 1;

export interface TemperaturePoint {
    /** Hora local de l'API ("2026-11-19T15:00"). */
    time: string;
    /** °C, corregida per inversió (la que es mostra). */
    temp: number | null;
    /** Sensació tèrmica en °C, desplaçada igual que la temperatura. */
    feels: number | null;
    isDay: boolean;
}

/** Posició de l'hora actual dins `hourly.time` (comparant per hora), o -1. */
export const findCurrentHourIndex = (times: unknown, currentTime: unknown): number => {
    if (!Array.isArray(times) || typeof currentTime !== 'string' || currentTime.length < 13) return -1;
    const prefix = currentTime.slice(0, 13);
    return times.findIndex(t => typeof t === 'string' && t.startsWith(prefix));
};

/**
 * Les `hours` hores a partir de l'actual (inclosa). La primera és "ara": porta la temperatura i la sensació del bloc
 * `current`, com la capçalera. Sense l'hora actual a `hourly`, buit.
 */
export const buildTemperatureWindow = (
    weatherData: ExtendedWeatherData | null | undefined,
    hours: number
): TemperaturePoint[] => {
    const hourly = weatherData?.hourly as Record<string, unknown> | undefined;
    if (!weatherData || !hourly || !Array.isArray(hourly.time)) return [];

    const times = hourly.time as unknown[];
    const start = findCurrentHourIndex(times, weatherData.current?.time);
    if (start === -1) return [];

    const end = Math.min(times.length, start + Math.max(0, hours));
    // Les mateixes hores que descarta buildHourlyChartSeries (sense marca de temps), perquè les dues llistes quadrin.
    const indices = Array.from({ length: end - start }, (_, i) => start + i).filter(i => typeof times[i] === 'string');
    const { primary } = buildHourlyChartSeries(weatherData, indices, 'C');

    const apparent = Array.isArray(hourly.apparent_temperature) ? hourly.apparent_temperature : [];
    const points: TemperaturePoint[] = primary.map((p, k) => {
        const idx = indices[k];
        return {
            time: p.time,
            temp: p.temp,
            feels: getInversionCorrectedApparent(apparent[idx], extractValidArrayNum(hourly.temperature_2m, idx), p.temp),
            isDay: p.isDay,
        };
    });

    // "Ara" = capçalera (lectura de cada 15 min), no l'hora en punt, que pot diferir un grau o més.
    const current = weatherData.current as StrictCurrentWeather | undefined;
    if (points.length > 0 && current) {
        const nowTemp = getCurrentDisplayTemp(current, getSafeLatitude(weatherData.location));
        if (nowTemp !== null) {
            const nowFeels = getInversionCorrectedApparent(current.apparent_temperature, current.temperature_2m, nowTemp);
            points[0] = { ...points[0], temp: nowTemp, feels: nowFeels ?? points[0].feels };
        }
    }
    return points;
};

export interface TemperatureMark {
    value: number;
    /** Posició dins la finestra (0 = ara). */
    index: number;
    time: string;
}

export interface TemperatureSummary {
    min: TemperatureMark | null;
    max: TemperatureMark | null;
    feelsMin: TemperatureMark | null;
    feelsMax: TemperatureMark | null;
    /** Temperatura d'aquí a 3 h menys la d'ara (°C), o null si falta alguna de les dues. */
    trend3h: number | null;
    /** El canvi més gran en 3 h de tota la finestra (a l'hora on acaba). */
    steepest3h: { fromIndex: number; toIndex: number; delta: number } | null;
    /** Hores amb temperatura <= 0 °C. */
    frostHours: number;
    /** Primera hora amb temperatura <= 0 °C. */
    firstFrost: TemperatureMark | null;
    /** Hores amb temperatura >= TEMP.HOT (30 °C). */
    heatHours: number;
    /** Primera hora amb temperatura >= TEMP.HOT. */
    firstHeat: TemperatureMark | null;
}

const pickExtreme = (
    points: ReadonlyArray<TemperaturePoint>,
    key: 'temp' | 'feels',
    better: (candidate: number, best: number) => boolean
): TemperatureMark | null => {
    let best: TemperatureMark | null = null;
    points.forEach((p, index) => {
        const v = p[key];
        if (v === null) return;
        if (!best || better(v, best.value)) best = { value: v, index, time: p.time };
    });
    return best;
};

const firstWhere = (points: ReadonlyArray<TemperaturePoint>, test: (t: number) => boolean): TemperatureMark | null => {
    const index = points.findIndex(p => p.temp !== null && test(p.temp));
    return index === -1 ? null : { value: points[index].temp as number, index, time: points[index].time };
};

/** Resum d'una finestra de buildTemperatureWindow. En empat, l'hora més propera. */
export const summarizeTemperature = (points: ReadonlyArray<TemperaturePoint>): TemperatureSummary => {
    let steepest3h: TemperatureSummary['steepest3h'] = null;
    for (let i = 3; i < points.length; i++) {
        const to = points[i].temp;
        const from = points[i - 3].temp;
        if (to === null || from === null) continue;
        const delta = Math.round((to - from) * 10) / 10;
        if (!steepest3h || Math.abs(delta) > Math.abs(steepest3h.delta)) steepest3h = { fromIndex: i - 3, toIndex: i, delta };
    }

    const now = points[0]?.temp ?? null;
    const in3h = points[3]?.temp ?? null;
    const isFrost = (t: number) => t <= TEMP.FREEZING;
    const isHeat = (t: number) => t >= TEMP.HOT;

    return {
        min: pickExtreme(points, 'temp', (c, b) => c < b),
        max: pickExtreme(points, 'temp', (c, b) => c > b),
        feelsMin: pickExtreme(points, 'feels', (c, b) => c < b),
        feelsMax: pickExtreme(points, 'feels', (c, b) => c > b),
        trend3h: now !== null && in3h !== null ? Math.round((in3h - now) * 10) / 10 : null,
        steepest3h,
        frostHours: points.filter(p => p.temp !== null && isFrost(p.temp)).length,
        firstFrost: firstWhere(points, isFrost),
        heatHours: points.filter(p => p.temp !== null && isHeat(p.temp)).length,
        firstHeat: firstWhere(points, isHeat),
    };
};

export type TemperatureTrend = 'rising' | 'falling' | 'steady';

export const classifyTemperatureTrend = (delta3h: number | null): TemperatureTrend => {
    if (delta3h === null || Math.abs(delta3h) < TREND_STEADY_C) return 'steady';
    return delta3h > 0 ? 'rising' : 'falling';
};

/**
 * Franja de sensació tèrmica, amb els mateixos llindars (WEATHER_THRESHOLDS.TEMP) i les mateixes vores que el text de
 * l'anàlisi (analyzeTemperature, aiContext.ts): <= 0 gelada, < 10 fred, < 15 fresc, < 25 suau, < 30 càlid; i, a més,
 * calor (< 35) i calor extrema.
 */
export type ThermalBand = 'freezing' | 'cold' | 'cool' | 'mild' | 'warm' | 'hot' | 'extreme';

export const getThermalBand = (celsius: number): ThermalBand => {
    if (celsius <= TEMP.FREEZING) return 'freezing';
    if (celsius < TEMP.COLD) return 'cold';
    if (celsius < TEMP.MILD) return 'cool';
    if (celsius < TEMP.WARM) return 'mild';
    if (celsius < TEMP.HOT) return 'warm';
    if (celsius < TEMP.EXTREME_HEAT) return 'hot';
    return 'extreme';
};

/**
 * Per què la sensació s'allunya de la temperatura, només quan és evident (no s'endevina): el vent quan se sent més fred
 * amb vent apreciable, la humitat quan se sent més calor amb aire humit i càlid. 'none' si se sent igual o no és clar.
 */
export type FeelsCause = 'wind' | 'humidity' | 'colder' | 'warmer' | 'none';

export const WIND_CHILL_MIN_KMH = 10;
export const MUGGY_MIN_HUMIDITY = 60;

export const getFeelsCause = (
    temp: number | null,
    feels: number | null,
    windKmh: number | null,
    humidity: number | null
): FeelsCause => {
    if (temp === null || feels === null) return 'none';
    const gap = feels - temp;
    if (Math.abs(gap) < FEELS_GAP_C) return 'none';
    if (gap < 0) return windKmh !== null && windKmh >= WIND_CHILL_MIN_KMH ? 'wind' : 'colder';
    return humidity !== null && humidity >= MUGGY_MIN_HUMIDITY && temp >= TEMP.MILD ? 'humidity' : 'warmer';
};

/** Posició (0-1) d'un valor dins un rang, o null. Un rang buit (màx = mín) el posa al mig. */
export const positionInRange = (value: number | null, min: number | null, max: number | null): number | null => {
    if (value === null || min === null || max === null) return null;
    if (!(max > min)) return 0.5;
    return Math.max(0, Math.min(1, (value - min) / (max - min)));
};

/** °C a la unitat de l'usuari (sense arrodonir). */
export const toUserTemp = (celsius: number, unit: string): number => (unit === 'F' ? (celsius * 9) / 5 + 32 : celsius);

/** Diferència de temperatura en °C a la unitat de l'usuari (una diferència no porta el +32). */
export const toUserTempDelta = (deltaC: number, unit: string): number => (unit === 'F' ? (deltaC * 9) / 5 : deltaC);
