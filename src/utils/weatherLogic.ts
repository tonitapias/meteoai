// src/utils/weatherLogic.ts
import { WEATHER_THRESHOLDS } from '../constants/weatherConfig';
import { StrictCurrentWeather } from '../types/weatherLogicTypes';
import { safeNum } from './physics';

// --- IMPORTS DE REGLES (Mòduls especialitzats) ---
import { adjustBaseSkyCode, calculateEffectiveCloudCover } from './rules/cloudRules';
import { getInstantaneousPrecipitation, checkForVirga, adjustRainIntensity } from './rules/precipitationRules';
import { checkForFog, checkCriticalVisibility } from './rules/visibilityRules';
import { adjustForStorms } from './rules/stormRules';
import { determineSnowCode } from './rules/winterRules';
// NOU IMPORT
import { calculateReliability } from './rules/reliabilityRules';

// --- RE-EXPORTACIONS ---
// Exportem la funció de fiabilitat perquè la resta de l'app la pugui fer servir
// sense haver de canviar els imports als fitxers existents.
export { calculateReliability }; 

// Mantenim la resta d'exports per compatibilitat
export * from '../types/weatherLogicTypes';
export * from './physics';
export * from './aromeEngine';
export * from './normData';
export * from './aiContext';


// ==========================================
// MOTOR PRINCIPAL (Orquestrador)
// ==========================================

/**
 * Orquestra els diferents mòduls de regles per determinar el codi de temps real.
 */
export const getRealTimeWeatherCode = (
    current: StrictCurrentWeather, 
    minutelyPrecipData: number[], 
    _prob: number = 0, 
    freezingLevel: number = 2500, 
    elevation: number = 0,
    cape: number = 0 
): number => {
    if (!current) return 0;
    
    let code = safeNum(current.weather_code, 0);
    const isArome = current.source === 'AROME HD'; 
    const temp = safeNum(current.temperature_2m, 15);
    const visibility = safeNum(current.visibility, 10000);
    const humidity = safeNum(current.relative_humidity_2m, 50);
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

    // B. Correcció AROME
    if (isArome && precipInstantanea >= PRECIPITATION.TRACE && code < 51) {
        code = 61; 
    }

    // C. Filtre Virga
    code = checkForVirga(code, humidity, cloudCover, precipInstantanea);

    // D. Detecció de Boira
    code = checkForFog(code, temp, humidity, cloudCover);
    
    // E. Ajust per Tempestes (CAPE)
    code = adjustForStorms(code, cape, cloudCover, precipInstantanea);
    
    // F. Transformació a Neu
    code = determineSnowCode(code, temp, freezingLevel, elevation, precipInstantanea);
    
    // G. Visibilitat crítica final
    code = checkCriticalVisibility(code, visibility, precipInstantanea);

    // H. Ajustar intensitat final
    const isSnow = (code >= 71 && code <= 77) || code === 85 || code === 86;
    if (!isSnow) {
        code = adjustRainIntensity(code, precipInstantanea);
    }

    return code;
};