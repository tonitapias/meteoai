// src/utils/trendSummary.ts
// Resum de la setmana del gràfic de tendència (TrendChartModal): la conclusió que l'usuari trauria mirant-lo, dita en
// clar i sense fer-la més certa del que és. Aquí hi ha la lògica; el text de cada idioma el fa trendSummaryText.ts.
//   - FORMA de les màximes (i de les mínimes, només si canvien de veritat): sense grans canvis, de pujades i baixades,
//     una vall o un cim (baixa i torna a pujar, o al revés: el pas d'un front), un canvi de mica en mica (recta) o un
//     salt a partir d'un dia (graó). ABANS només es comparaven el primer i l'últim dia: una setmana plana amb un dilluns
//     més càlid sortia com un "escalfament al llarg de la setmana".
//   - INCERTESA amb el rang probable (80 %) calibrat que dibuixen els bigotis (probableRange.ts). ABANS es feia amb el
//     rang entre models, que només conté la real la meitat de les vegades: amb dades reals (11-2026, 16 ciutats) avisava
//     de "poc segur" en 8 de 10 canvis que els bigotis del mateix gràfic donaven per clars.
//   - PLUJA: els dies que el gràfic destaca (isLikelyWet) i la quantitat més gran d'un sol dia.
import { isLikelyWet } from './precipSignal';

export interface ValueRange {
    low: number;
    high: number;
}

export interface TrendSummaryDay {
    max: number | null;
    min: number | null;
    /** Rang probable (80 %) de la màxima i de la mínima mostrades (els bigotis del gràfic), si n'hi ha. */
    maxProbable?: ValueRange | null;
    minProbable?: ValueRange | null;
    precipProb?: number | null;
    precipSum?: number | null;
    snowSum?: number | null;
}

/** Una temperatura i el dia on és (índex dins la llista de dies del resum). */
export interface DayValue {
    day: number;
    value: number;
}

export type TrendDirection = 'up' | 'down';

/** Sense pujada ni baixada: oscil·lació petita (stable) o gran (variable). */
interface FlatShapeFields { low: number; high: number }
/** Baixa fins a `extreme` (vall) o puja fins a `extreme` (cim) de `firstDay` a `lastDay`, i després torna fins a `end`. */
interface TurnShapeFields { extreme: number; firstDay: number; lastDay: number; end: number }

// Un membre per `kind` (no `kind: 'valley' | 'peak'` en un de sol): així `s.kind === 'valley' || s.kind === 'peak'`
// descarta tots dos en la branca contrària.
export type TempShape =
    | ({ kind: 'stable' } & FlatShapeFields)
    | ({ kind: 'variable' } & FlatShapeFields)
    | ({ kind: 'valley' } & TurnShapeFields)
    | ({ kind: 'peak' } & TurnShapeFields)
    /** Canvi de mica en mica, del primer a l'últim dia. */
    | { kind: 'gradual'; dir: TrendDirection; from: DayValue; to: DayValue }
    /** Un tram fins a `before.lastDay` i, a partir de `after.firstDay`, un salt que arriba fins a `after.extreme`. */
    | {
        kind: 'step';
        dir: TrendDirection;
        before: { low: number; high: number; firstDay: number; lastDay: number };
        after: { firstDay: number; lastDay: number; extreme: DayValue };
    };

/** Formes que afirmen un canvi d'un nivell a un altre (i que, per tant, poden ser incertes). */
export type ChangeShape = Extract<TempShape, { kind: 'gradual' | 'step' }>;
/** Formes que val la pena dir de les mínimes: totes menys "sense grans canvis" i "de pujades i baixades". */
export type MovingShape = Exclude<TempShape, { kind: 'stable' | 'variable' }>;

/** El canvi anunciat encara no és segur: el rang probable del dia d'arribada inclou el nivell de sortida. */
export interface TrendUncertainty {
    temp: 'max' | 'min';
    day: number;
    low: number;
    high: number;
}

export interface PrecipSummary {
    /** Dies amb pluja probable (sense neu) i dies amb neu, en ordre. */
    rainDays: number[];
    snowDays: number[];
    /** Quantitat més gran d'un sol dia (mm de pluja / cm de neu), o null si cap dia no en preveu. */
    maxRain: number | null;
    maxSnow: number | null;
    /** Cap dia amb probabilitat destacada ni cap quantitat prevista (i tots amb dada): no es preveu pluja. */
    dry: boolean;
}

export interface TrendSummary {
    max: TempShape;
    /** Mínimes NOMÉS si canvien de veritat (vall, cim, de mica en mica o amb un salt); si no, null i no se'n parla. */
    min: MovingShape | null;
    uncertain: TrendUncertainty | null;
    precip: PrecipSummary;
}

/** Canvi de la màxima a partir del qual es parla de pujada o baixada. */
export const TREND_CHANGE_DEG = 3;
/** Idem per a la mínima: més alt perquè és més sorollosa (els models hi discrepen 3-4° a qualsevol dia). */
export const MIN_TREND_CHANGE_DEG = 4;
/** Sense pujada ni baixada, una oscil·lació a partir d'aquí és "de pujades i baixades" i no "sense grans canvis". */
export const TREND_SWING_DEG = 5;
/** Part de la variació de la setmana que ha d'explicar una recta o un graó perquè la frase la descrigui així. */
export const SHAPE_FIT_MIN = 0.6;
/** Els dies a menys d'aquests graus del punt més baix (o més alt) formen el fons de la vall (o el cim). */
const TURN_FLOOR_DEG = 1;
/** Oscil·lació que es tolera a cada banda d'una vall o un cim abans de considerar-ho dents de serra. */
const TURN_NOISE_DEG = 1;
/** Neu a partir de la qual un dia és de neu (el mateix llindar a partir del qual formatPrecipitation la mostra). */
const SNOW_MIN_CM = 0.2;
/** Amb menys d'aquests dies amb màxima no es diu res: dues xifres no fan una tendència. */
const MIN_DAYS = 3;

const mean = (xs: ReadonlyArray<number>): number => xs.reduce((a, x) => a + x, 0) / xs.length;
const squaredError = (xs: ReadonlyArray<number>): number => {
    const m = mean(xs);
    return xs.reduce((a, x) => a + (x - m) ** 2, 0);
};

/**
 * Vall de `values` (índexs dins `values`): el fons ha de tenir dies a banda i banda, s'hi ha de baixar i se n'ha de
 * tornar a pujar sense dents de serra, i almenys `changeDeg` per cada costat. Per a un cim, es crida amb els valors girats.
 */
const findValley = (values: ReadonlyArray<number>, changeDeg: number): { bottom: number; first: number; last: number; end: number } | null => {
    const bottom = Math.min(...values);
    let first = values.indexOf(bottom);
    let last = first;
    while (first > 0 && values[first - 1] <= bottom + TURN_FLOOR_DEG) first--;
    while (last < values.length - 1 && values[last + 1] <= bottom + TURN_FLOOR_DEG) last++;
    if (first === 0 || last === values.length - 1) return null;

    const down = values.slice(0, first + 1);
    const up = values.slice(last);
    const smooth = down.every((v, i) => i === 0 || v <= down[i - 1] + TURN_NOISE_DEG)
        && up.every((v, i) => i === 0 || v >= up[i - 1] - TURN_NOISE_DEG);
    const start = Math.max(...values.slice(0, first));
    const end = Math.max(...values.slice(last + 1));
    return smooth && start - bottom >= changeDeg && end - bottom >= changeDeg ? { bottom, first, last, end } : null;
};

/** Com van les temperatures `points` (en ordre de dia): la forma que n'explica més variació, si n'explica prou. */
const fitShape = (points: ReadonlyArray<DayValue>, changeDeg: number): TempShape => {
    const values = points.map(p => p.value);
    const low = Math.min(...values);
    const high = Math.max(...values);
    if (high - low < changeDeg) return { kind: 'stable', low, high };

    // Vall o cim primer: d'una U, una recta o un graó només en dirien la meitat ("pugen fins a 15°" amagaria que abans
    // baixen fins a 5°). Només es dona si s'hi baixa i se'n torna a pujar netament, almenys `changeDeg` per cada costat.
    const valley = findValley(values, changeDeg);
    if (valley) {
        return { kind: 'valley', extreme: valley.bottom, firstDay: points[valley.first].day, lastDay: points[valley.last].day, end: valley.end };
    }
    const peak = findValley(values.map(v => -v), changeDeg);
    if (peak) {
        return { kind: 'peak', extreme: -peak.bottom, firstDay: points[peak.first].day, lastDay: points[peak.last].day, end: -peak.end };
    }

    const total = squaredError(values);
    const candidates: Array<{ shape: ChangeShape; fit: number }> = [];

    // Recta (mínims quadrats): un canvi de mica en mica. El primer i l'últim dia, que són les xifres que dirà la
    // frase, també han de mostrar el canvi.
    const first = points[0];
    const last = points[points.length - 1];
    const xs = points.map(p => p.day);
    const mx = mean(xs);
    const my = mean(values);
    const sxx = xs.reduce((a, x) => a + (x - mx) ** 2, 0);
    const slope = xs.reduce((a, x, i) => a + (x - mx) * (values[i] - my), 0) / sxx;
    const lineChange = slope * (last.day - first.day);
    const netChange = last.value - first.value;
    if (Math.abs(lineChange) >= changeDeg && Math.abs(netChange) >= changeDeg && Math.sign(lineChange) === Math.sign(netChange)) {
        candidates.push({ shape: { kind: 'gradual', dir: netChange > 0 ? 'up' : 'down', from: first, to: last }, fit: (slope ** 2 * sxx) / total });
    }

    // Graó: el punt de tall que deixa els dos trams més plans.
    let split = 1;
    let splitFit = -Infinity;
    for (let k = 1; k < points.length; k++) {
        const fit = 1 - (squaredError(values.slice(0, k)) + squaredError(values.slice(k))) / total;
        if (fit > splitFit) { split = k; splitFit = fit; }
    }
    const before = points.slice(0, split);
    const after = points.slice(split);
    const jump = mean(after.map(p => p.value)) - mean(before.map(p => p.value));
    const dir: TrendDirection = jump > 0 ? 'up' : 'down';
    const extreme = after.reduce((e, p) => ((dir === 'up' ? p.value > e.value : p.value < e.value) ? p : e));
    const beforeLow = Math.min(...before.map(p => p.value));
    const beforeHigh = Math.max(...before.map(p => p.value));
    // "Pugen fins a X" ha de ser cert amb les xifres que es veuen: X ha de passar el tram d'abans.
    const beyond = dir === 'up' ? Math.round(extreme.value) > Math.round(beforeHigh) : Math.round(extreme.value) < Math.round(beforeLow);
    if (Math.abs(jump) >= changeDeg && beyond) {
        candidates.push({
            shape: {
                kind: 'step',
                dir,
                before: { low: beforeLow, high: beforeHigh, firstDay: before[0].day, lastDay: before[before.length - 1].day },
                after: { firstDay: after[0].day, lastDay: after[after.length - 1].day, extreme }
            },
            fit: splitFit
        });
    }

    // A igual ajust guanya la recta (és la forma més simple).
    const best = candidates.filter(c => c.fit >= SHAPE_FIT_MIN).sort((a, b) => b.fit - a.fit)[0];
    if (best) return best.shape;
    return { kind: high - low >= TREND_SWING_DEG ? 'variable' : 'stable', low, high };
};

/**
 * El canvi anunciat és incert si el rang probable del dia on arriba encara inclou el nivell de sortida: és a dir, si
 * el mateix bigoti que veu l'usuari aquell dia arriba a l'altura d'on es parteix.
 */
const arrivalUncertainty = (shape: ChangeShape, days: ReadonlyArray<TrendSummaryDay>, temp: 'max' | 'min'): TrendUncertainty | null => {
    const arrival = shape.kind === 'gradual' ? shape.to : shape.after.extreme;
    const start = shape.kind === 'gradual'
        ? shape.from.value
        : (shape.dir === 'up' ? shape.before.high : shape.before.low);
    const range = temp === 'max' ? days[arrival.day]?.maxProbable : days[arrival.day]?.minProbable;
    if (!range) return null;
    const reachesStart = shape.dir === 'up' ? range.low <= start : range.high >= start;
    return reachesStart ? { temp, day: arrival.day, low: range.low, high: range.high } : null;
};

const summarizePrecip = (days: ReadonlyArray<TrendSummaryDay>): PrecipSummary => {
    const rainDays: number[] = [];
    const snowDays: number[] = [];
    let maxRain: number | null = null;
    let maxSnow: number | null = null;
    days.forEach((d, day) => {
        if (!isLikelyWet(d.precipProb ?? null)) return;
        const snow = d.snowSum ?? 0;
        if (snow >= SNOW_MIN_CM) {
            snowDays.push(day);
            maxSnow = Math.max(maxSnow ?? 0, snow);
        } else {
            rainDays.push(day);
            const rain = d.precipSum ?? 0;
            if (rain > 0) maxRain = Math.max(maxRain ?? 0, rain);
        }
    });
    // "No es preveu pluja" només si ho diu cada dia: probabilitat coneguda i baixa, i cap quantitat (ni 0,1 mm).
    const dry = days.length > 0 && days.every(d =>
        d.precipProb !== null && d.precipProb !== undefined && !isLikelyWet(d.precipProb)
        && d.precipSum === 0 && !((d.snowSum ?? 0) > 0));
    return { rainDays, snowDays, maxRain, maxSnow, dry };
};

export const summarizeTrend = (days: ReadonlyArray<TrendSummaryDay>): TrendSummary | null => {
    const points = (key: 'max' | 'min'): DayValue[] =>
        days.flatMap((d, day) => {
            const value = d[key];
            return value !== null ? [{ day, value }] : [];
        });

    const maxPoints = points('max');
    if (maxPoints.length < MIN_DAYS) return null;
    const max = fitShape(maxPoints, TREND_CHANGE_DEG);

    const minPoints = points('min');
    const minShape = minPoints.length >= MIN_DAYS ? fitShape(minPoints, MIN_TREND_CHANGE_DEG) : null;
    const min = minShape && minShape.kind !== 'stable' && minShape.kind !== 'variable' ? minShape : null;

    // Primer el de les màximes (és la frase principal); si aquell és segur, el de les mínimes. Una vall o un cim no
    // afirmen cap nivell nou (hi tornen), com "sense grans canvis" i "de pujades i baixades": no hi ha res a avisar.
    const uncertain = (max.kind === 'gradual' || max.kind === 'step' ? arrivalUncertainty(max, days, 'max') : null)
        ?? (min && (min.kind === 'gradual' || min.kind === 'step') ? arrivalUncertainty(min, days, 'min') : null);

    return { max, min, uncertain, precip: summarizePrecip(days) };
};
