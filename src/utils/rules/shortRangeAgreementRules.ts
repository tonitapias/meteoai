// src/utils/rules/shortRangeAgreementRules.ts
import type { ExtendedWeatherData, ReliabilityResult } from '../../types/weatherLogicTypes';
import { extractValidArrayNum, extractValidNum } from '../weatherMath';

// ACORD ENTRE MODELS PER A LES PRÒXIMES 6 HORES (la insígnia de l'"ANÀLISI METEO IA | +6H").
//
// Abans la insígnia reutilitzava la fiabilitat del DIA sencer (reliabilityRules, dia 0): de nit jutjava un dia
// gairebé tot passat i no les hores de les quals parla el text. Mesurat amb 262.617 finestres de 6 h (30 aeroports
// europeus, setembre 2025 – setembre 2026; previsió de curt termini d'Open-Meteo — l'arxiu de passades anteriors,
// "dia 0" — de la sèrie que mostra l'app, és a dir el model regional si n'hi ha, i d'ECMWF, GFS, ICON i AIFS,
// contra els METAR), prenent com a "fallada" que la temperatura mostrada s'equivoqui > 3 °C en alguna hora o que
// l'encert sobre si plourà sigui erroni:
//   - la insígnia antiga no separava res: fallada 18,6 / 23,2 / 18,2 % amb alta / mitjana / baixa (a Catalunya
//     l'"Incertesa alta" sortia un 20 % del temps i fallava menys, 11 %, que el "Consens", 23 %);
//   - aquesta regla: 10,2 / 25,5 / 55,5 % (repartiment 56,7 / 32,8 / 10,5 % de finestres; Catalunya 12,5 / 25,2 /
//     38,7 %).
//
// TEMPERATURA. Dues mesures, cada hora de la finestra i fent-ne la mitjana:
//   - el rang entre la sèrie mostrada i els models globals (quant discrepen tots plegats);
//   - la distància de la sèrie mostrada a la mitjana dels globals (si el que veu l'usuari va per lliure).
// Cadascuna es normalitza pel seu valor típic (mediana 2,1 °C i 0,7 °C) i se'n fa la mitjana. Juntes separen millor
// que qualsevol de les dues soles (AUC 0,785 per a un error > 3 °C, contra 0,751 del rang sol i 0,656 de la insígnia
// antiga) i tallen a la meitat els falsos avisos on els models globals tenen un biaix fix de graella sense que la
// previsió falli (aeroport de Barcelona: "baixa" un 24,5 % de les finestres amb el rang sol, 12 % amb les dues).
// Treure el biaix de cada model sobre 24 h o comparar només la forma de la corba ho feia pitjor.
//
// PLUJA. Si la sèrie mostrada dona pluja (≥ 0,3 mm en les 6 h) o no, i quants models globals diuen el contrari.
// La proporció de fallades segueix gairebé exactament la proporció de globals que discrepen: cap 3-4 %, 1 de 4
// 17-20 %, 2 de 4 31-41 %, 3 o 4 de 4 50-74 %.
//
// Es fa servir la temperatura dels models EN BRUT, sense la correcció d'inversió tèrmica de l'app
// (temperatureCorrections): aquí es mesura l'acord entre models, no la nostra correcció, i la calibració és en brut.
// Límit conegut: la calibració usa la passada més recent de cada hora (termini de 0 a 6 h aprox.); a l'app les
// passades arriben amb unes hores de retard, així que el termini real és una mica més llarg.

const WINDOW_HOURS = 6;
// Menys hores vàlides o menys models globals no és una comparació: sense dada, no hi ha insígnia (mai una de fingida).
const MIN_VALID_HOURS = 4;
const MIN_GLOBAL_MODELS = 2;

const GLOBAL_MODELS = ['ecmwf', 'gfs', 'icon', 'aifs'] as const;

const TYPICAL_TEMP_RANGE = 2.1;
const TYPICAL_DISPLAYED_DEVIATION = 0.7;
const TEMP_MEDIUM_SCORE = 1.3;
const TEMP_LOW_SCORE = 2.5;

const WET_TOTAL_MM = 0.3;
const RAIN_MEDIUM_DISSENT = 0.5;
const RAIN_LOW_DISSENT = 0.75;

type HourlyLike = { temperature_2m?: unknown; precipitation?: unknown } | null | undefined;
type HourlyComparison = ExtendedWeatherData['hourlyComparison'] | null | undefined;

const modelValue = (comparison: HourlyComparison, model: typeof GLOBAL_MODELS[number], hour: number, key: string): number | null =>
    extractValidNum(comparison?.[model]?.[hour]?.[key]);

const mean = (values: number[]): number => values.reduce((a, b) => a + b, 0) / values.length;

/** Puntuació de temperatura (1 = discrepància típica), o null si no hi ha prou hores amb prou models. */
const temperatureScore = (hourly: HourlyLike, comparison: HourlyComparison, start: number): { score: number; range: number } | null => {
    const ranges: number[] = [];
    const deviations: number[] = [];
    for (let h = start; h < start + WINDOW_HOURS; h++) {
        const shown = extractValidArrayNum(hourly?.temperature_2m, h);
        const globals = GLOBAL_MODELS.map(m => modelValue(comparison, m, h, 'temperature_2m')).filter((v): v is number => v !== null);
        if (shown === null || globals.length < MIN_GLOBAL_MODELS) continue;
        const all = [shown, ...globals];
        ranges.push(Math.max(...all) - Math.min(...all));
        deviations.push(Math.abs(shown - mean(globals)));
    }
    if (ranges.length < MIN_VALID_HOURS) return null;
    const range = mean(ranges);
    return { score: (range / TYPICAL_TEMP_RANGE + mean(deviations) / TYPICAL_DISPLAYED_DEVIATION) / 2, range };
};

/** Total de la finestra amb prou hores reals; null si no n'hi ha prou (mai un 0 mm fals). */
const windowTotal = (valueAt: (hour: number) => number | null, start: number): number | null => {
    let total = 0;
    let valid = 0;
    for (let h = start; h < start + WINDOW_HOURS; h++) {
        const v = valueAt(h);
        if (v === null) continue;
        total += v;
        valid++;
    }
    return valid >= MIN_VALID_HOURS ? total : null;
};

/** Proporció de models globals que contradiuen la sèrie mostrada sobre si plourà (0 a 1), o null. */
const rainDissent = (hourly: HourlyLike, comparison: HourlyComparison, start: number): number | null => {
    const shownTotal = windowTotal(h => extractValidArrayNum(hourly?.precipitation, h), start);
    if (shownTotal === null) return null;
    const globalTotals = GLOBAL_MODELS
        .map(m => windowTotal(h => modelValue(comparison, m, h, 'precipitation'), start))
        .filter((v): v is number => v !== null);
    if (globalTotals.length < MIN_GLOBAL_MODELS) return null;
    const shownWet = shownTotal >= WET_TOTAL_MM;
    return globalTotals.filter(total => (total >= WET_TOTAL_MM) !== shownWet).length / globalTotals.length;
};

/**
 * Acord entre la previsió mostrada i els models globals per a les 6 hores que comencen a `startIndex`
 * (l'hora actual dins `hourly.time`). `hourly` és la sèrie combinada que veu l'usuari; `comparison`, la de
 * cada model global alineada índex a índex (normData.ts). Retorna null si no es pot comparar: sense
 * insígnia, en lloc d'un "consens" o una "incertesa" inventats.
 */
export const calculateShortRangeAgreement = (
    hourly: HourlyLike,
    comparison: HourlyComparison,
    startIndex: number
): ReliabilityResult | null => {
    if (!hourly || !comparison || !Number.isInteger(startIndex) || startIndex < 0) return null;

    const temp = temperatureScore(hourly, comparison, startIndex);
    const dissent = rainDissent(hourly, comparison, startIndex);
    if (temp === null && dissent === null) return null;

    if (temp !== null && temp.score > TEMP_LOW_SCORE) {
        return { level: 'low', type: 'temp', value: Number(temp.range.toFixed(1)) };
    }
    if (dissent !== null && dissent >= RAIN_LOW_DISSENT) {
        return { level: 'low', type: 'precip', value: Number(dissent.toFixed(2)) };
    }
    if ((temp !== null && temp.score > TEMP_MEDIUM_SCORE) || (dissent !== null && dissent >= RAIN_MEDIUM_DISSENT)) {
        return { level: 'medium', type: 'divergent', value: 0 };
    }
    return { level: 'high', type: 'ok', value: 0 };
};
