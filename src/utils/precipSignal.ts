// src/utils/precipSignal.ts
// La probabilitat diària de pluja és el MÀXIM de les probabilitats horàries: un 5-10 % és una sola hora
// amb un senyal feble, no un dia de risc. Per sota d'aquest llindar les pantalles la mostren atenuada
// (però la mostren). El comparteixen el gràfic de tendència i el detall de dia.
export const LIKELY_WET_PROBABILITY = 20;

export const isLikelyWet = (prob: number | null): boolean => prob !== null && prob >= LIKELY_WET_PROBABILITY;
