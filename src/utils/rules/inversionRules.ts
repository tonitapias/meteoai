// src/utils/rules/inversionRules.ts

/**
 * Detecta si hi ha condicions favorables per a la inversió tèrmica.
 * (Nit serena d'hivern + Vent en calma = Fred acumulat a les valls)
 */
export const checkInversionRisk = (
    isDay: number,
    windSpeed: number,
    cloudCover: number,
    month: number // 0-11 (Gen-Des)
): boolean => {
    // 1. Només passa a l'hivern (Novembre a Març aprox)
    // Mesos: 0=Gen, 1=Feb, 2=Mar, 10=Nov, 11=Des
    const isWinter = month <= 2 || month >= 10;
    
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