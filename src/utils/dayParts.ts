// src/utils/dayParts.ts
// Resum d'un dia per franges (matinada, matí, tarda, nit) a partir de les files de la taula horària del
// detall del dia. Serveix la tira "moments del dia": una lectura ràpida del dia abans de les 24 hores.
//
// DOCTRINA RISC ZERO: una franja sense dades d'una magnitud en dóna null (mai un 0 fals) i una franja
// sense cap hora no existeix. La icona segueix les mateixes regles que la icona del dia (dailyWeatherCode.ts).
import { adjustBaseSkyCode } from './rules/cloudRules';
import { worstPrecipCode } from './dailyWeatherCode';

/** El mínim d'una fila de la taula horària que cal per resumir una franja. */
export interface DayPartRow {
    /** Hora local "HH:MM". */
    hour: string;
    temp: number | null;
    code: number | null;
    precipProb: number | null;
    precipSum: number | null;
    snowfall: number | null;
    windSpeed: number | null;
    isDay: boolean;
    cloudCover: number | null;
}

export type DayPartKey = 'night' | 'morning' | 'afternoon' | 'evening';

/** Franges de 6 hores; `to` és exclusiu (la franja de la nit acaba a les 24). */
export const DAY_PARTS: ReadonlyArray<{ key: DayPartKey; from: number; to: number }> = [
    { key: 'night', from: 0, to: 6 },
    { key: 'morning', from: 6, to: 12 },
    { key: 'afternoon', from: 12, to: 18 },
    { key: 'evening', from: 18, to: 24 }
];

export interface DayPartSummary {
    key: DayPartKey;
    from: number;
    to: number;
    tempMin: number | null;
    tempMax: number | null;
    /** Codi de la icona de la franja, o null si cap hora en porta. */
    code: number | null;
    /** La major part de la franja és de dia (decideix si s'hi pinta sol o lluna). */
    isDay: boolean;
    /** Mitjana de núvols (%) de les hores amb dada, o null. */
    avgClouds: number | null;
    windMax: number | null;
    precipProbMax: number | null;
    /** Total de pluja de la franja (mm), o null si cap hora en porta dada. */
    precipSum: number | null;
    snowfall: number | null;
}

const isNum = (v: number | null | undefined): v is number => typeof v === 'number' && !isNaN(v);

const present = (values: ReadonlyArray<number | null>): number[] => values.filter(isNum);

const maxOrNull = (values: ReadonlyArray<number | null>): number | null => {
    const nums = present(values);
    return nums.length === 0 ? null : Math.max(...nums);
};

const minOrNull = (values: ReadonlyArray<number | null>): number | null => {
    const nums = present(values);
    return nums.length === 0 ? null : Math.min(...nums);
};

const sumOrNull = (values: ReadonlyArray<number | null>): number | null => {
    const nums = present(values);
    return nums.length === 0 ? null : nums.reduce((a, b) => a + b, 0);
};

const hourOf = (hour: string): number | null => {
    const h = parseInt(hour.slice(0, 2), 10);
    return isNaN(h) ? null : h;
};

/** La franja a la qual pertany una hora (0-23), o null si l'hora no és vàlida. */
export const partOfHour = (hour: number): DayPartKey | null =>
    DAY_PARTS.find(p => hour >= p.from && hour < p.to)?.key ?? null;

/**
 * Codi de la icona d'una franja. Mateix criteri que la icona del dia:
 *  - la precipitació o tempesta més severa de les hores (cap hora aïllada de pluja s'amaga);
 *  - la boira només si ocupa la meitat de la franja o més (una sola hora d'alba no pinta tota la franja);
 *  - si no, el cel que diuen els núvols de la franja (mateixos llindars que la resta de l'app);
 *  - sense núvols, el cel més ennuvolat que hagi donat el motor.
 */
const partCode = (codes: ReadonlyArray<number | null>, avgClouds: number | null): number | null => {
    const valid = present(codes);
    if (valid.length === 0) return null;

    const precip = worstPrecipCode(valid);
    if (precip !== null) return precip;

    const fog = valid.filter(c => c === 45 || c === 48);
    if (fog.length > 0 && fog.length * 2 >= valid.length) return Math.max(...fog);

    if (avgClouds !== null) return adjustBaseSkyCode(0, avgClouds);

    const sky = valid.filter(c => c <= 3);
    return sky.length > 0 ? Math.max(...sky) : null;
};

/** Les franges del dia que tenen almenys una hora, en ordre. */
export const summarizeDayParts = (rows: ReadonlyArray<DayPartRow>): DayPartSummary[] =>
    DAY_PARTS.flatMap(({ key, from, to }): DayPartSummary[] => {
        const inPart = rows.filter(r => {
            const h = hourOf(r.hour);
            return h !== null && h >= from && h < to;
        });
        if (inPart.length === 0) return [];

        const avgClouds = (() => {
            const clouds = present(inPart.map(r => r.cloudCover));
            return clouds.length === 0 ? null : clouds.reduce((a, b) => a + b, 0) / clouds.length;
        })();

        return [{
            key, from, to,
            tempMin: minOrNull(inPart.map(r => r.temp)),
            tempMax: maxOrNull(inPart.map(r => r.temp)),
            code: partCode(inPart.map(r => r.code), avgClouds),
            isDay: inPart.filter(r => r.isDay).length * 2 >= inPart.length,
            avgClouds,
            windMax: maxOrNull(inPart.map(r => r.windSpeed)),
            precipProbMax: maxOrNull(inPart.map(r => r.precipProb)),
            precipSum: sumOrNull(inPart.map(r => r.precipSum)),
            snowfall: sumOrNull(inPart.map(r => r.snowfall))
        }];
    });
