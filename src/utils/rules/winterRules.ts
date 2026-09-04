import { WEATHER_THRESHOLDS } from '../../constants/weatherConfig';

const { SNOW, PRECIPITATION } = WEATHER_THRESHOLDS;

/**
 * Determina si les condicions tèrmiques permeten neu/aiguaneu: temperatura
 * de superfície prou baixa, o cota de gel prou a prop de la superfície.
 * Font única d'aquest criteri — l'usen tant determineSnowCode (per decidir
 * si transforma un codi de pluja en neu) com applyThermalLock a
 * weatherLogic.ts (per NO esborrar el codi de neu que aquesta funció acaba
 * de produir; abans usava un llindar propi de temp<=0 que desfeia sempre
 * la franja d'aiguaneu 0–4°C que aquesta funció construeix més avall).
 */
export const isSnowPossible = (temp: number, freezingLevel: number, elevation: number): boolean => {
    const freezingDist = freezingLevel - elevation;
    return temp <= SNOW.TEMP_SNOW || (temp <= SNOW.TEMP_MIX && freezingDist < SNOW.FREEZING_BUFFER);
};

/** Determina si la pluja s'ha de convertir en neu per temperatura */
export const determineSnowCode = (
    code: number,
    temp: number,
    freezingLevel: number,
    elevation: number,
    precipAmount: number
): number => {
    if (!isSnowPossible(temp, freezingLevel, elevation)) return code;

    const isRainCode = (code >= 51 && code <= 67) || (code >= 80 && code <= 82) || (code >= 95);

    if (isRainCode || precipAmount > 0) {
        if (code === 65 || code === 82 || code === 67 || code >= 95 || precipAmount > PRECIPITATION.MODERATE) return 75; 
        if (code === 63 || code === 81 || code === 55 || code === 57 || precipAmount >= PRECIPITATION.LIGHT) return 73; 
        return 71; 
    }
    
    if ((code >= 71 && code <= 77) || code === 85 || code === 86) return code;
    
    return code;
};

/**
 * [FIX PRECISIÓ] Càlcul de la cota de neu (altitud on la pluja passa a neu) a
 * partir del nivell de congelació. Abans hi havia tres còpies independents
 * d'aquesta mateixa fórmula (useDayDetailData.ts, useChartData.ts,
 * weatherMappers.ts): dues amb el número màgic 300 fix, una amb la constant
 * SNOW.FREEZING_BUFFER. Es consolida aquí perquè un canvi futur del buffer
 * només calgui fer-lo un cop.
 * NOTA: no aplica el cap de visualització (MAX_DISPLAY_SNOW_LEVEL) — això és
 * una decisió de presentació (veure snowLevelText a useDayDetailData.ts), no
 * del càlcul físic en si.
 */
export const calculateSnowLevel = (freezingLevel: unknown): number | null => {
    if (typeof freezingLevel !== 'number' || isNaN(freezingLevel)) return null;
    return Math.max(0, freezingLevel - SNOW.FREEZING_BUFFER);
};