// src/utils/trendSummary.ts
// Frase resum de la tendència de les màximes dels 7 dies del gràfic (TrendChartModal): la conclusió que
// l'usuari trauria mirant les càpsules, dita en clar i sense fer-la més certa del que és.

export type TrendKind = 'warming' | 'cooling' | 'variable' | 'stable';

export interface TrendSummary {
    kind: TrendKind;
    /** Màxima del primer i de l'últim dia amb dada. */
    from: number;
    to: number;
    /** Màxima més baixa i més alta de la setmana. */
    low: number;
    high: number;
    /** El canvi és menys del doble del desacord entre models a l'últim dia: no es pot afirmar amb seguretat. */
    uncertain: boolean;
}

export interface TrendSummaryDay {
    max: number | null;
    /** Rang de la màxima entre models (vegeu dailyModelSpread), si n'hi ha. */
    maxRange?: { low: number; high: number } | null;
}

/** Un canvi de la màxima entre el primer i l'últim dia a partir d'aquí és un escalfament o un refredament. */
export const TREND_CHANGE_DEG = 3;
/** Sense canvi net, una oscil·lació de la setmana a partir d'aquí és "variable" i no "estable". */
export const TREND_SWING_DEG = 5;
/** Amb menys d'aquests dies amb dada no es diu res: dues xifres no fan una tendència. */
const MIN_DAYS = 3;

export const summarizeTrend = (days: ReadonlyArray<TrendSummaryDay>): TrendSummary | null => {
    const withMax = days.filter((d): d is TrendSummaryDay & { max: number } => d.max !== null);
    if (withMax.length < MIN_DAYS) return null;

    const first = withMax[0];
    const last = withMax[withMax.length - 1];
    const maxes = withMax.map(d => d.max);
    const low = Math.min(...maxes);
    const high = Math.max(...maxes);
    const delta = last.max - first.max;

    let kind: TrendKind;
    if (Math.abs(delta) >= TREND_CHANGE_DEG) kind = delta > 0 ? 'warming' : 'cooling';
    else if (high - low >= TREND_SWING_DEG) kind = 'variable';
    else kind = 'stable';

    // Només un canvi afirmat (escalfament/refredament) pot ser incert: "estable" i "variable" no hi apostem.
    const lastSpread = last.maxRange ? last.maxRange.high - last.maxRange.low : 0;
    const uncertain = (kind === 'warming' || kind === 'cooling') && lastSpread > 0 && Math.abs(delta) < 2 * lastSpread;

    return { kind, from: first.max, to: last.max, low, high, uncertain };
};
