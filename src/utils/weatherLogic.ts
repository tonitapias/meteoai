// src/utils/weatherLogic.ts
import { WEATHER_THRESHOLDS } from '../constants/weatherConfig';
import { StrictCurrentWeather } from '../types/weatherLogicTypes';
import { safeNum } from './physics';

// --- IMPORTS DE REGLES (Mòduls especialitzats) ---
import { adjustBaseSkyCode, calculateEffectiveCloudCover } from './rules/cloudRules';
import { getInstantaneousPrecipitation, checkForVirga } from './rules/precipitationRules';
import { checkForFog } from './rules/visibilityRules';
import { adjustForStorms } from './rules/stormRules';
import { determineSnowCode } from './rules/winterRules';

// NOTA: Hem eliminat els re-exports (export *) per evitar dependències circulars i millorar el tree-shaking.
// Si necessites tipus, importa'ls de 'types/weatherLogicTypes'.
// Si necessites física, importa'ls de 'utils/physics'.

// ==========================================
// MOTOR PRINCIPAL (Orquestrador)
// ==========================================

/**
 * Orquestra els diferents mòduls de regles per determinar el codi de temps real.
 * Aquesta funció és l'única responsabilitat real d'aquest fitxer.
 */
export const getRealTimeWeatherCode = (
    current: StrictCurrentWeather, 
    minutelyPrecipData: number[], 
    rainProb: number,
    freezingLevel: number,
    elevation: number
): number => {
    
    // 0. Estat Inicial
    let code = safeNum(current.weather_code, 0);
    const temp = safeNum(current.temperature_2m, 0);
    const humidity = safeNum(current.relative_humidity_2m, 50);
    const cape = safeNum(current.cape, 0); // Si no tenim CAPE, assumim 0
    
    // Constants
    const { PRECIPITATION } = WEATHER_THRESHOLDS;

    // 1. Dades Calculades (Núvols i Precipitació)
    const cloudCover = calculateEffectiveCloudCover(
        safeNum(current.cloud_cover_low, 0),
        safeNum(current.cloud_cover_mid, 0),
        safeNum(current.cloud_cover_high, 0)
    );

    const precipInstantanea = getInstantaneousPrecipitation(minutelyPrecipData, safeNum(current.precipitation, 0));

    // --- PIPELINE DE DECISIÓ ---
    
    // A. Estat base del cel
    code = adjustBaseSkyCode(code, cloudCover);

    // B. Correcció AROME (Si detectem pluja intensa que el model general no veu)
    // Nota: El flag isArome no el passem explícitament, però si precipInstantanea ve de minutely_15 (AROME), ja té la info.
    if (precipInstantanea >= PRECIPITATION.TRACE && code < 51) {
        // Forcem codi de pluja si hi ha precipitació física real, encara que el model digui núvol.
        code = 61; 
    }

    // C. Filtre Virga (Pluja que no arriba a terra)
    code = checkForVirga(code, humidity, cloudCover, precipInstantanea);

    // D. Detecció de Boira
    code = checkForFog(code, temp, humidity, cloudCover);
    
    // E. Ajust per Tempestes (CAPE)
    code = adjustForStorms(code, cape, cloudCover, precipInstantanea);
    
    // F. Transformació a Neu (Cota de neu vs Elevació real)
    code = determineSnowCode(code, temp, freezingLevel, elevation, precipInstantanea);

    return code;
};