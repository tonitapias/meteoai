// src/utils/dailyModelSpread.ts
// Quant discrepen els models sobre les temperatures d'UN dia de la previsió setmanal i quina
// fiabilitat en resulta. El gràfic de tendència (TrendChartModal) ho dibuixa perquè un canvi d'1-2°
// entre dos dies veïns queda per sota del soroll entre models (mesurat: la dispersió de la màxima
// creix d'1,1° avui a ~2,5° als dies 4-6, i la de la mínima és de 3-4° a qualsevol horitzó).
import type { ExtendedWeatherData, StrictDailyWeather } from '../types/weatherLogicTypes';
import { calculateReliability } from './rules/reliabilityRules';
import { extractValidArrayNum } from './weatherMath';

export interface ModelRange {
    low: number;
    high: number;
}

export interface DailyModelSpread {
    /** Rang de la màxima entre models (incloent-hi el valor mostrat), o null si no n'hi ha almenys dos. */
    maxRange: ModelRange | null;
    /** Rang de la mínima entre models (incloent-hi el valor mostrat), o null si no n'hi ha almenys dos. */
    minRange: ModelRange | null;
    /** Acord entre models (calculateReliability), o null si no es pot comparar cap model. */
    reliability: 'high' | 'medium' | 'low' | null;
}

// Un rang entre models de menys d'1° no s'ha de dibuixar: no aporta res i embruta la pantalla.
export const MIN_VISIBLE_SPREAD = 1;
export const hasVisibleRange = (r: ModelRange | null): r is ModelRange =>
    r !== null && r.high - r.low >= MIN_VISIBLE_SPREAD;

const COMPARED_MODELS = ['ecmwf', 'gfs', 'icon'] as const;

const nonNull = (values: ReadonlyArray<number | null>): number[] =>
    values.filter((v): v is number => v !== null);

/**
 * Rang de `models` més el valor mostrat. Cal comparar almenys dos MODELS: el valor mostrat sol
 * (o repetint el del model diari) no és cap comparació i no en fa sortir una dispersió fingida.
 */
const spreadRange = (models: ReadonlyArray<number | null>, displayed: number | null): ModelRange | null => {
    if (nonNull(models).length < 2) return null;
    const nums = nonNull([...models, displayed]);
    return { low: Math.min(...nums), high: Math.max(...nums) };
};

/**
 * `dayIndex`: índex del dia dins `daily`/`comparison` (0 = avui).
 * `displayedMax`/`displayedMin`: les xifres que el gràfic mostra (poden venir d'un model regional que
 * no és a `comparison`); entren al rang perquè la marca de dispersió contingui sempre la càpsula.
 * Un model sense dada per a aquell dia (p. ex. ICON més enllà de ~7,5 dies) simplement no hi compta.
 */
export const resolveDailySpread = (
    dayIndex: number,
    displayedMax: number | null,
    displayedMin: number | null,
    daily: StrictDailyWeather | null | undefined,
    comparison: ExtendedWeatherData['dailyComparison'] | null | undefined
): DailyModelSpread => {
    const modelValues = (key: string): Array<number | null> => [
        extractValidArrayNum(daily?.[key], dayIndex),
        ...COMPARED_MODELS.map(m => extractValidArrayNum(comparison?.[m]?.[key], dayIndex))
    ];

    const maxValues = modelValues('temperature_2m_max');

    const reliability = daily && comparison && nonNull(maxValues).length >= 2
        ? calculateReliability(daily, comparison.gfs, comparison.icon, dayIndex, comparison.ecmwf).level
        : null;

    return {
        maxRange: spreadRange(maxValues, displayedMax),
        minRange: spreadRange(modelValues('temperature_2m_min'), displayedMin),
        reliability
    };
};
