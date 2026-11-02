// src/utils/precipSignal.ts
// La probabilitat diària de pluja és el MÀXIM de les probabilitats horàries: un 5-10 % és una sola hora
// amb un senyal feble, no un dia de risc. Per sota d'aquest llindar les pantalles la mostren atenuada
// (però la mostren). El comparteixen el gràfic de tendència i el detall de dia.
export const LIKELY_WET_PROBABILITY = 20;

export const isLikelyWet = (prob: number | null): boolean => prob !== null && prob >= LIKELY_WET_PROBABILITY;

// QUANTITAT d'un dia: la probabilitat diu si plourà, no quant. Un 80 % amb 0,3 mm són quatre gotes, i ressaltar-lo
// igual que un dia de 15 mm el fa semblar un dia de pluja. Llindars de la suma diària (mm).
export type DailyPrecipClass = 'trace' | 'light' | 'moderate' | 'heavy';
/** Neu a partir de la qual un dia es mostra com a neu, en cm (el mateix llindar que formatPrecipitation). */
export const SNOW_SHOWN_CM = 0.2;
export const DAILY_PRECIP_LIGHT_MM = 1;
export const DAILY_PRECIP_MODERATE_MM = 5;
export const DAILY_PRECIP_HEAVY_MM = 20;

/** Classe de la quantitat prevista d'un dia; null si no se'n sap res (mai no es dona per "quatre gotes" un buit). */
export const classifyDailyPrecip = (mm: number | null): DailyPrecipClass | null => {
    if (mm === null || isNaN(mm)) return null;
    if (mm < DAILY_PRECIP_LIGHT_MM) return 'trace';
    if (mm < DAILY_PRECIP_MODERATE_MM) return 'light';
    return mm < DAILY_PRECIP_HEAVY_MM ? 'moderate' : 'heavy';
};
