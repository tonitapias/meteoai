// src/utils/chartInsights.ts
// Lectura resumida dels gràfics d'Expert: els extrems, la pluja prevista i QUANT s'assemblen els models.
// Tot són funcions pures sobre la sèrie que ja dibuixa el gràfic (hourlyChartSeries.ts), així que el resum
// i la línia que es veu no poden divergir.
//
// L'"acord" compara els models GLOBALS entre ells (ECMWF, GFS, ICON, AIFS). La línia principal (que pot ser
// un model regional d'alta resolució) no hi compta: un AROME que difereix del global en terreny complex no
// és desacord, és resolució. Cal comparar almenys DOS models: amb un de sol no hi ha res a comparar i no
// s'inventa un "acord perfecte" (DOCTRINA RISC ZERO).
import { CHART_MODEL_KEYS, type ChartModelKey, type HourlyChartPoint } from './hourlyChartSeries';

export type AgreementLevel = 'high' | 'medium' | 'low';
export type ComparisonSeries = Record<ChartModelKey, HourlyChartPoint[]>;

/**
 * Llindars d'acord, calibrats el 21-09-2026 amb 48 finestres reals de 24 h (16 ciutats de tots els climes ×
 * 3 desfasaments, els 4 models): la dispersió mitjana horària entre models té mediana de 2,2° a la
 * temperatura, 5,2 km/h al vent i 102 m a la cota de neu; així queden ~25 % "alt", ~45 % "mitjà" i
 * ~30 % "baix" en lloc d'un semàfor sempre vermell o sempre verd. La pluja reutilitza els llindars que l'app
 * ja té a reliabilityRules.ts (rang del total entre models: >3 mm mitjà, >10 mm baix).
 */
export const AGREEMENT_THRESHOLDS = {
    temp: { high: 1.5, medium: 3 },
    wind: { high: 4.5, medium: 7.5 },
    snowLevel: { high: 75, medium: 150 },
    rainTotal: { high: 3, medium: 10 }
} as const;

/** Hores mínimes amb almenys dos models per fer una mitjana de dispersió que tingui sentit. */
const MIN_COMPARED_HOURS = 6;
/** Una hora "plou" a partir d'aquest volum (mm/h); un model "té pluja" a partir d'aquest total (mm). */
const RAIN_START_MM = 0.1;
const MODEL_HAS_RAIN_MM = 0.2;
/** Diferència màxima (en unitats de la magnitud) perquè dues sèries es considerin la MATEIXA. */
const IDENTICAL_TOLERANCE = 0.05;

export interface PeakFigure {
    value: number;
    /** Posició dins la sèrie; l'hora s'obté amb la `time` d'aquest punt. */
    index: number;
}

type NumericField = 'temp' | 'rain' | 'precip' | 'wind' | 'gusts' | 'snowLevel';

const levelOf = (value: number | null, t: { readonly high: number; readonly medium: number }): AgreementLevel | null =>
    value === null ? null : value <= t.high ? 'high' : value <= t.medium ? 'medium' : 'low';

const activeModels = (comparison: ComparisonSeries | null): ChartModelKey[] =>
    comparison ? CHART_MODEL_KEYS.filter(k => comparison[k].length > 0) : [];

const valuesAt = (comparison: ComparisonSeries, models: ChartModelKey[], index: number, field: NumericField): number[] =>
    models
        .map(k => comparison[k][index]?.[field])
        .filter((v): v is number => typeof v === 'number' && !Number.isNaN(v));

const seriesLength = (comparison: ComparisonSeries, models: ChartModelKey[]): number =>
    models.reduce((n, k) => Math.max(n, comparison[k].length), 0);

/** Dispersió (màx − mín entre models) de cada hora en què n'hi ha almenys dos amb dada. */
const hourlySpreads = (comparison: ComparisonSeries | null, field: NumericField): Array<{ index: number; spread: number }> => {
    const models = activeModels(comparison);
    if (!comparison || models.length < 2) return [];
    const out: Array<{ index: number; spread: number }> = [];
    for (let i = 0; i < seriesLength(comparison, models); i++) {
        const v = valuesAt(comparison, models, i, field);
        if (v.length >= 2) out.push({ index: i, spread: Math.max(...v) - Math.min(...v) });
    }
    return out;
};

/** Dispersió mitjana entre models al llarg de la finestra, o null si no hi ha prou hores comparables. */
export const averageSpread = (comparison: ComparisonSeries | null, field: NumericField): number | null => {
    const spreads = hourlySpreads(comparison, field);
    if (spreads.length < MIN_COMPARED_HOURS) return null;
    return spreads.reduce((s, h) => s + h.spread, 0) / spreads.length;
};

/** L'hora amb més desacord entre models (la primera si n'hi ha d'empatades), o null si no es pot comparar. */
export const maxSpread = (comparison: ComparisonSeries | null, field: NumericField): PeakFigure | null => {
    const spreads = hourlySpreads(comparison, field);
    if (spreads.length < MIN_COMPARED_HOURS) return null;
    const best = spreads.reduce((b, h) => (h.spread > b.spread ? h : b));
    return { value: best.spread, index: best.index };
};

const peak = (points: HourlyChartPoint[], field: NumericField, mode: 'max' | 'min'): PeakFigure | null => {
    let best: PeakFigure | null = null;
    points.forEach((p, index) => {
        const v = p[field];
        if (typeof v !== 'number' || Number.isNaN(v)) return;
        if (best === null || (mode === 'max' ? v > best.value : v < best.value)) best = { value: v, index };
    });
    return best;
};

/** Total de la finestra, només si TOTES les hores tenen dada (un total parcial no és comparable). */
const completeTotal = (points: HourlyChartPoint[]): number | null => {
    if (points.length === 0) return null;
    let total = 0;
    for (const p of points) {
        if (typeof p.precip !== 'number' || Number.isNaN(p.precip)) return null;
        total += p.precip;
    }
    return total;
};

const firstRainIndex = (points: HourlyChartPoint[]): number | null => {
    const i = points.findIndex(p => typeof p.precip === 'number' && p.precip >= RAIN_START_MM);
    return i === -1 ? null : i;
};

/**
 * Una sèrie de model és "la mateixa" que la principal quan en TOTES les hores en què tenen la magnitud les
 * dues coincideixen. Passa a l'Europa del sud: la línia principal és `best_match`, que allà ÉS ICON (a Girona
 * i Galícia, 72 de 72 hores idèntiques): dibuixar-la dues vegades és tinta sense informació.
 */
export const isSeriesIdentical = (
    primary: HourlyChartPoint[],
    model: HourlyChartPoint[],
    field: NumericField = 'temp'
): boolean => {
    let compared = 0;
    const n = Math.min(primary.length, model.length);
    for (let i = 0; i < n; i++) {
        const a = primary[i][field];
        const b = model[i][field];
        if (typeof a !== 'number' || typeof b !== 'number') continue;
        if (Math.abs(a - b) > IDENTICAL_TOLERANCE) return false;
        compared++;
    }
    return compared >= MIN_COMPARED_HOURS;
};

/** Models que coincideixen amb la línia principal i, per tant, no cal dibuixar (sí comptar a l'acord). */
export const modelsIdenticalToPrimary = (primary: HourlyChartPoint[], comparison: ComparisonSeries | null): ChartModelKey[] =>
    activeModels(comparison).filter(k => isSeriesIdentical(primary, comparison![k]));

export interface ChartInsights {
    temp: {
        high: PeakFigure | null;
        low: PeakFigure | null;
        maxDisagreement: PeakFigure | null;
        agreement: AgreementLevel | null;
    };
    rain: {
        /** Total de la finestra de la línia principal (mm). */
        total: number | null;
        /** Total mínim i màxim entre els models amb totals complets. */
        modelTotals: { min: number; max: number } | null;
        /** Primera hora amb pluja de la línia principal. */
        firstRain: number | null;
        /** Primera hora amb pluja més primerenca i més tardana entre els models que en preveuen. */
        modelFirstRain: { first: number; last: number } | null;
        modelsWithRain: number;
        modelsCompared: number;
        agreement: AgreementLevel | null;
    };
    wind: {
        maxGust: PeakFigure | null;
        maxWind: PeakFigure | null;
        averageSpread: number | null;
        agreement: AgreementLevel | null;
    };
    snowLevel: {
        agreement: AgreementLevel | null;
    };
}

export const buildChartInsights = (primary: HourlyChartPoint[], comparison: ComparisonSeries | null): ChartInsights => {
    const models = activeModels(comparison);

    const totals = comparison
        ? models
            .map(k => completeTotal(comparison[k]))
            .filter((t): t is number => t !== null)
        : [];
    const modelTotals = totals.length > 0 ? { min: Math.min(...totals), max: Math.max(...totals) } : null;

    const firstRains = comparison
        ? models
            .filter(k => completeTotal(comparison[k]) !== null)
            .map(k => firstRainIndex(comparison[k]))
            .filter((i): i is number => i !== null)
        : [];

    return {
        temp: {
            high: peak(primary, 'temp', 'max'),
            low: peak(primary, 'temp', 'min'),
            maxDisagreement: maxSpread(comparison, 'temp'),
            agreement: levelOf(averageSpread(comparison, 'temp'), AGREEMENT_THRESHOLDS.temp)
        },
        rain: {
            total: completeTotal(primary),
            modelTotals,
            firstRain: firstRainIndex(primary),
            modelFirstRain: firstRains.length > 0 ? { first: Math.min(...firstRains), last: Math.max(...firstRains) } : null,
            modelsWithRain: totals.filter(t => t >= MODEL_HAS_RAIN_MM).length,
            modelsCompared: totals.length,
            agreement: totals.length >= 2 && modelTotals
                ? levelOf(modelTotals.max - modelTotals.min, AGREEMENT_THRESHOLDS.rainTotal)
                : null
        },
        wind: {
            maxGust: peak(primary, 'gusts', 'max'),
            maxWind: peak(primary, 'wind', 'max'),
            averageSpread: averageSpread(comparison, 'wind'),
            agreement: levelOf(averageSpread(comparison, 'wind'), AGREEMENT_THRESHOLDS.wind)
        },
        snowLevel: {
            agreement: levelOf(averageSpread(comparison, 'snowLevel'), AGREEMENT_THRESHOLDS.snowLevel)
        }
    };
};
