// src/utils/dayColumn.ts
// "La columna del dia" del detall (DayDetailModal → dayDetail/DayColumn): les hores del dia de dalt a baix, cadascuna amb
// el seu cel, la temperatura, el marge entre els models globals, la pluja i el vent. És la franja del cel de la Previsió
// girada: el cel de cada hora surt dels MATEIXOS codis del motor (getHourlyWeatherCode → skyKindOfCode).
//
// Aquí hi ha les dades i les regles (quan es diu la sensació tèrmica, quan una ratxa és notable, on és la finestra seca);
// el component només dibuixa.
//
// DOCTRINA RISC ZERO: una dada que falta és null (i la columna hi deixa el buit), mai un 0 fals.
import type { WeatherUnit } from './formatters';
import type { ChartModelKey, HourlyChartPoint } from './hourlyChartSeries';
import { CHART_MODEL_KEYS } from './hourlyChartSeries';
import { getHourlyWeatherCode, type HourlyComparison, type HourlySeries } from './hourlyWeatherCode';
import { skyKindOfCode, type SkyKind } from './daySky';
import { extractValidArrayNum } from './weatherMath';

/** La sensació tèrmica només surt quan s'allunya prou de la temperatura (en °C): si no, és la mateixa xifra repetida. */
export const FEELS_LIKE_MIN_DIFF_C = 3;
/** Una ratxa és notable a partir d'aquí (km/h)... */
export const NOTABLE_GUST_KMH = 40;
/** ...o quan supera el vent mitjà en aquests km/h, si ja és d'una mica de vent (GUST_EXCESS_FLOOR_KMH). */
export const GUST_EXCESS_KMH = 15;
export const GUST_EXCESS_FLOOR_KMH = 25;
/** Una finestra seca més curta que això no ajuda a decidir res. */
export const MIN_DRY_WINDOW_HOURS = 3;

const PRECIP_KINDS: ReadonlySet<SkyKind> = new Set(['rain', 'snow', 'storm']);

export interface DayColumnRow {
    /** Hora ISO de la sèrie ("2026-11-24T07:00"). */
    time: string;
    /** Hora local 0-23 (de la data, no de l'índex: un dia de canvi d'hora no en té 24). */
    hour: number;
    kind: SkyKind | null;
    isDay: boolean;
    /** Temperatura amb la correcció d'inversió, en la unitat de l'usuari (la mateixa que el gràfic). */
    temp: number | null;
    /** Sensació tèrmica en la unitat de l'usuari, NOMÉS quan es nota (vegeu FEELS_LIKE_MIN_DIFF_C). */
    feels: number | null;
    /** Marge entre els models globals a aquesta hora (unitat de l'usuari), o null si no n'hi ha almenys dos. */
    bandLow: number | null;
    bandHigh: number | null;
    precipProb: number | null;
    /** mm de l'hora. */
    precip: number | null;
    /** cm de neu de l'hora. */
    snowfall: number | null;
    wind: number | null;
    /** D'on ve el vent (graus). */
    windDir: number | null;
    /** Ratxa de l'hora, NOMÉS quan és notable (vegeu isNotableGust). */
    gust: number | null;
}

export const isNotableGust = (gust: number | null, wind: number | null): boolean => {
    if (gust === null) return false;
    if (gust >= NOTABLE_GUST_KMH) return true;
    return wind !== null && gust >= GUST_EXCESS_FLOOR_KMH && gust - wind >= GUST_EXCESS_KMH;
};

const toCelsius = (value: number, unit: WeatherUnit): number => (unit === 'F' ? (value - 32) * 5 / 9 : value);
const fromCelsius = (value: number, unit: WeatherUnit): number => (unit === 'F' ? value * 9 / 5 + 32 : value);

export interface BuildDayColumnInput {
    hourly: HourlySeries;
    /** Índexs de `hourly` que són del dia (useDayDetailData.dayIndices). */
    dayIndices: ReadonlyArray<number>;
    /** Línia principal del dia (useDayDetailData.hourlyData): temperatura corregida i dia/nit. */
    primary: ReadonlyArray<HourlyChartPoint>;
    /** Models globals del dia (useDayDetailData.comparisonData). */
    comparison: Partial<Record<ChartModelKey, ReadonlyArray<HourlyChartPoint>>> | null;
    elevation: number;
    hourlyComparison?: HourlyComparison;
    unit: WeatherUnit;
}

export const buildDayColumn = ({
    hourly, dayIndices, primary, comparison, elevation, hourlyComparison, unit
}: BuildDayColumnInput): DayColumnRow[] => {
    const times: unknown = hourly.time;
    if (!Array.isArray(times)) return [];

    const primaryByTime = new Map(primary.map(p => [p.time, p]));
    const modelTemps = CHART_MODEL_KEYS
        .map(key => comparison?.[key] ?? [])
        .filter(points => points.length > 0)
        .map(points => new Map(points.map(p => [p.time, p.temp])));

    const rows: DayColumnRow[] = [];
    for (const idx of dayIndices) {
        const time: unknown = times[idx];
        if (typeof time !== 'string' || time.length < 13) continue;
        const hour = Number.parseInt(time.slice(11, 13), 10);
        if (!Number.isFinite(hour)) continue;

        const point = primaryByTime.get(time);
        const temp = point?.temp ?? null;

        const apparent = extractValidArrayNum(hourly.apparent_temperature, idx);
        const feels = temp !== null && apparent !== null && Math.abs(apparent - toCelsius(temp, unit)) >= FEELS_LIKE_MIN_DIFF_C
            ? fromCelsius(apparent, unit)
            : null;

        const models = modelTemps.map(m => m.get(time)).filter((v): v is number => typeof v === 'number');
        const hasBand = models.length >= 2;

        const wind = point?.wind ?? extractValidArrayNum(hourly.wind_speed_10m, idx);
        const gustValue = point?.gusts ?? extractValidArrayNum(hourly.wind_gusts_10m, idx);

        rows.push({
            time,
            hour,
            kind: skyKindOfCode(getHourlyWeatherCode(hourly, idx, elevation, hourlyComparison)),
            isDay: point?.isDay ?? true,
            temp,
            feels,
            bandLow: hasBand ? Math.min(...models) : null,
            bandHigh: hasBand ? Math.max(...models) : null,
            precipProb: point?.rain ?? extractValidArrayNum(hourly.precipitation_probability, idx),
            precip: point?.precip ?? extractValidArrayNum(hourly.precipitation, idx),
            snowfall: extractValidArrayNum(hourly.snowfall, idx),
            wind,
            windDir: extractValidArrayNum(hourly.wind_direction_10m, idx),
            gust: isNotableGust(gustValue, wind) ? gustValue : null
        });
    }
    return rows;
};

/** Una hora "mullada": el motor hi posa pluja, neu o tempesta, o el model hi dona precipitació. */
export const isWetHour = (row: Pick<DayColumnRow, 'kind' | 'precip' | 'snowfall'>): boolean =>
    (row.kind !== null && PRECIP_KINDS.has(row.kind)) ||
    (row.precip !== null && row.precip > 0) ||
    (row.snowfall !== null && row.snowfall > 0);

export interface DryWindow {
    /** Posició de la primera i de l'última fila seca dins de `rows`. */
    firstRow: number;
    lastRow: number;
    /** Hora d'inici (0-23) i de final (1-24) del tram. */
    from: number;
    to: number;
    hours: number;
}

/**
 * La finestra seca del dia: el tram d'hores seguides sense pluja més llarg (el primer, si n'hi ha d'iguals). Només els
 * dies que plou en algun moment (un dia sec del tot ja ho diu la columna) i si dura almenys MIN_DRY_WINDOW_HOURS.
 */
export const findDryWindow = (rows: ReadonlyArray<DayColumnRow>, minHours = MIN_DRY_WINDOW_HOURS): DryWindow | null => {
    if (!rows.some(isWetHour)) return null;

    // Una hora sense codi (sense dades) talla el tram: no es pot dir que sigui seca.
    let first = -1;
    let last = -1;
    let start = -1;
    for (let i = 0; i <= rows.length; i++) {
        const dry = i < rows.length && rows[i].kind !== null && !isWetHour(rows[i]);
        if (dry && start === -1) start = i;
        if (!dry && start !== -1) {
            if (first === -1 || i - 1 - start > last - first) {
                first = start;
                last = i - 1;
            }
            start = -1;
        }
    }
    if (first === -1) return null;
    const hours = last - first + 1;
    if (hours < minHours) return null;
    return { firstRow: first, lastRow: last, from: rows[first].hour, to: rows[last].hour + 1, hours };
};

export interface TempScale {
    /** Valor que va a l'esquerra i a la dreta del carril (unitat de l'usuari). */
    min: number;
    max: number;
    /** Valors de les guies verticals (i de les xifres de la capçalera del carril). */
    ticks: number[];
}

/** Amplada mínima de l'escala (graus): un dia de 2° de diferència no s'ha de dibuixar com si en fossin 20. */
const MIN_SCALE_SPAN = 8;

/** Escala del carril de temperatura: hi caben la previsió, la sensació i el marge entre models de totes les hores. */
export const temperatureScale = (rows: ReadonlyArray<DayColumnRow>): TempScale | null => {
    const values: number[] = [];
    for (const r of rows) {
        for (const v of [r.temp, r.feels, r.bandLow, r.bandHigh]) if (v !== null) values.push(v);
    }
    if (values.length === 0) return null;
    let min = Math.min(...values);
    let max = Math.max(...values);
    if (max - min < MIN_SCALE_SPAN) {
        const mid = (min + max) / 2;
        min = mid - MIN_SCALE_SPAN / 2;
        max = mid + MIN_SCALE_SPAN / 2;
    }
    const span = max - min;
    const step = span <= 12 ? 4 : span <= 24 ? 8 : 10;
    const ticks: number[] = [];
    for (let v = Math.ceil(min / step) * step; v <= max; v += step) ticks.push(v);
    return { min, max, ticks };
};

/** Hora local en fracció ("07:49" → 7,82), o null. Llegeix la part horària d'un ISO sense passar per Date. */
export const hourFraction = (iso: string | null | undefined): number | null => {
    if (typeof iso !== 'string' || !iso.includes('T')) return null;
    const [h, m] = iso.split('T')[1].slice(0, 5).split(':').map(n => Number.parseInt(n, 10));
    if (!Number.isFinite(h)) return null;
    return h + (Number.isFinite(m) ? m / 60 : 0);
};

/**
 * Posició vertical (en files, des de dalt) d'una hora fraccionària dins la columna, o null si l'hora no hi és. Es busca
 * per l'hora de cada fila (un dia de canvi d'hora no té una fila per hora).
 */
export const rowOffsetOf = (rows: ReadonlyArray<DayColumnRow>, fraction: number | null): number | null => {
    if (fraction === null) return null;
    const hour = Math.floor(fraction);
    const i = rows.findIndex(r => r.hour === hour);
    return i === -1 ? null : i + (fraction - hour);
};
