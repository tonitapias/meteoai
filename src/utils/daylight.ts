// src/utils/daylight.ts
// Durada del dia (sortida → posta de sol) a partir de les hores locals que dóna l'API.

/** Minuts des de mitjanit d'una hora ISO local ("2026-09-22T07:39"), o null si no és una hora vàlida. Sense passar per Date/fus horari. */
const localMinutes = (iso: string | null | undefined): number | null => {
    if (typeof iso !== 'string' || !iso.includes('T')) return null;
    const match = /T(\d{2}):(\d{2})/.exec(iso);
    if (!match) return null;
    const hours = Number(match[1]);
    const minutes = Number(match[2]);
    return hours <= 23 && minutes <= 59 ? hours * 60 + minutes : null;
};

/**
 * Segons de llum entre la sortida i la posta, o null si falta alguna de les dues o no tenen sentit
 * (posta no posterior a la sortida: nit polar, dada incompleta...). Mai un 0 o una durada inventada.
 */
export const daylightSeconds = (
    sunrise: string | null | undefined,
    sunset: string | null | undefined
): number | null => {
    const from = localMinutes(sunrise);
    const to = localMinutes(sunset);
    if (from === null || to === null || to <= from) return null;
    return (to - from) * 60;
};
