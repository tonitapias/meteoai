// src/utils/rules/inversionRules.ts

/**
 * Detecta si hi ha condicions favorables per a la inversió tèrmica.
 * (Nit serena d'hivern + Vent en calma = Fred acumulat a les valls)
 */
export const checkInversionRisk = (
    isDay: number,
    windSpeed: number,
    cloudCover: number,
    month: number, // 0-11 (Gen-Des)
    latitude?: number
): boolean => {
    // 1. Només passa a l'hivern (Novembre a Març aprox a l'Hemisferi Nord).
    // [FIX PRECISIÓ] L'app permet cercar qualsevol ciutat del món (sense
    // restricció geogràfica), així que per a l'Hemisferi Sud (latitude < 0)
    // "hivern" cau 6 mesos desplaçat (Maig a Setembre), no Nov-Mar. Sense
    // latitud coneguda, mantenim el comportament anterior (Hemisferi Nord).
    const isSouthernHemisphere = typeof latitude === 'number' && latitude < 0;
    const isWinter = isSouthernHemisphere
        ? (month >= 4 && month <= 8)
        : (month <= 2 || month >= 10);

    if (!isWinter) return false;

    // 2. Ha de ser de nit (refredament radiatiu)
    if (isDay === 1) return false;

    // 3. El vent ha d'estar pràcticament en calma (< 6 km/h)
    // Si fa vent, l'aire es barreja i trenca la inversió.
    if (windSpeed > 6) return false;

    // 4. El cel ha d'estar serè (< 20% núvols)
    // Els núvols actuen com a manta i eviten que la calor escapi.
    if (cloudCover > 20) return false;

    return true;
};