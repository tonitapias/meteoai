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

/** Plugim (56, 57) o pluja (66, 67) engelants: precipitació líquida que gela en tocar terra. */
export const isFreezingPrecipCode = (code: number): boolean =>
    code === 56 || code === 57 || code === 66 || code === 67;

/** Aiguaneu: pluja i neu barrejades (68 feble, 69 moderat o fort). WMO 4677; Open-Meteo no el publica, el deriva l'app. */
export const isSleetCode = (code: number): boolean => code === 68 || code === 69;

/** Determina si la pluja s'ha de convertir en neu (o aiguaneu) per temperatura */
export const determineSnowCode = (
    code: number,
    temp: number,
    freezingLevel: number,
    elevation: number,
    precipAmount: number
): number => {
    if (!isSnowPossible(temp, freezingLevel, elevation)) return code;

    // Pluja/plugim engelant: el model ja ha diagnosticat que cau líquida sobre una superfície
    // per sota de 0 °C (cal una capa càlida en altura que fongui la neu, cosa que ni la
    // temperatura de superfície ni la cota de gel poden revelar). És un fenomen DIFERENT de la
    // neu i més perillós (gel transparent a la carretera), així que no el convertim: només
    // es conserva quan la superfície està realment a <= TEMP_SNOW; per sobre, la franja
    // d'aiguaneu continua tractant-se com fins ara.
    if (isFreezingPrecipCode(code) && temp <= SNOW.TEMP_SNOW) return code;

    const isRainCode = (code >= 51 && code <= 67) || (code >= 80 && code <= 82) || (code >= 95);

    if (isRainCode || precipAmount > 0) {
        const heavy = code === 65 || code === 82 || code === 67 || code >= 95 || precipAmount > PRECIPITATION.MODERATE;
        const moderate = code === 63 || code === 81 || code === 55 || code === 57 || precipAmount >= PRECIPITATION.LIGHT;

        // Franja d'aiguaneu: per sobre de TEMP_SNOW (neu segura) la neu només és possible perquè la cota
        // de gel és prop del terra (isSnowPossible). Si la isoterma 0 °C és SOBRE el terra (0 <= dist <
        // FREEZING_BUFFER), la neu travessa una capa càlida i es fon en part abans d'arribar-hi: no és
        // neu, és pluja i neu barrejades. Abans es pintava com a "Nevada", una promesa massa forta.
        // Si la isoterma és sota el terra la columna és freda i, malgrat el T2m, continua sent neu.
        if (temp > SNOW.TEMP_SNOW && freezingLevel - elevation >= 0) return heavy || moderate ? 69 : 68;

        if (heavy) return 75;
        if (moderate) return 73;
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