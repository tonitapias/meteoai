// src/utils/weatherLogic.ts
import { WEATHER_THRESHOLDS } from '../constants/weatherConfig';
import type { StrictCurrentWeather } from '../types/weatherLogicTypes';
import { safeNum } from './physics';

// --- IMPORTS DE REGLES (Mòduls especialitzats) ---
import { adjustBaseSkyCode, calculateEffectiveCloudCover } from './rules/cloudRules';
import { getInstantaneousPrecipitation, checkForVirga, adjustRainIntensity } from './rules/precipitationRules';
import { checkForFog, checkCriticalVisibility } from './rules/visibilityRules';
import { adjustForStorms } from './rules/stormRules';
import { determineSnowCode } from './rules/winterRules';

// ==========================================
// TALLAFOCS DE LA DOCTRINA DE RISC ZERO
// ==========================================

const applyTelemetrySync = (code: number, precipAmt: number = 0): number => {
    let syncedCode = code;
    if (precipAmt > 0) {
        // Fals Negatiu (Tempesta Oculta): L'API diu sol/núvol però plou.
        // Talls canònics (TRACE/MODERATE/HEAVY) en lloc de llindars fets a mà.
        if (syncedCode <= 48) {
            syncedCode = adjustRainIntensity(syncedCode, precipAmt);
        }
    } else if (precipAmt === 0) {
        // Fals Positiu (Gota freda visual): L'API diu pluja però no cau aigua
        const isPrecipCode = 
            (syncedCode >= 51 && syncedCode <= 67) || 
            (syncedCode >= 71 && syncedCode <= 77) || 
            (syncedCode >= 80 && syncedCode <= 86) || 
            syncedCode === 95;
        if (isPrecipCode) syncedCode = 3; 
    }
    return syncedCode;
};

const applyThermalLock = (code: number, temp: number): number => {
    if (temp <= 0) return code;
    
    let safeCode = code;
    // Si estem a +0ºC, el gel/neu és un error físic del model i la rebaixem a aigua
    if (safeCode === 48) safeCode = 45; 
    if (safeCode === 56) safeCode = 51; 
    if (safeCode === 57) safeCode = 53; 
    if (safeCode === 66) safeCode = 61; 
    if (safeCode === 67) safeCode = 63; 
    if (safeCode >= 71 && safeCode <= 77) safeCode = 63; 
    if (safeCode === 85 || safeCode === 86) safeCode = 81; 
    
    return safeCode;
};

// ==========================================
// MOTOR PRINCIPAL (Orquestrador)
// ==========================================

/**
 * Orquestra els diferents mòduls de regles per determinar el codi de temps real.
 * Ara actua com la Única Font de Veritat absoluta per a tota l'App.
 */
export const getRealTimeWeatherCode = (
    current: StrictCurrentWeather, 
    minutelyPrecipData: number[], 
    _rainProb: number, // [FIX] Guió baix per ometre l'error
    freezingLevel: number,
    elevation: number
): number => {
    
    // 0. Estat Inicial
    let code = safeNum(current.weather_code, 0);
    const temp = safeNum(current.temperature_2m, 0);
    const humidity = safeNum(current.relative_humidity_2m, 50);
    const cape = safeNum(current.cape, 0); 
    
    // Constants
    const { VISIBILITY } = WEATHER_THRESHOLDS;

    // 1. Dades Calculades (Núvols, Precipitació i Visibilitat)
    const cloudCover = calculateEffectiveCloudCover(
        safeNum(current.cloud_cover_low, 0),
        safeNum(current.cloud_cover_mid, 0),
        safeNum(current.cloud_cover_high, 0)
    );

    const precipInstantanea = getInstantaneousPrecipitation(minutelyPrecipData, safeNum(current.precipitation, 0));

    // Sense dada real, assumim visibilitat bona (Risc Zero: no forcem boira sense proves)
    const visibility = safeNum(current.visibility, VISIBILITY.GOOD);

    // --- PIPELINE DE DECISIÓ ---
    
    // A. Estat base del cel
    code = adjustBaseSkyCode(code, cloudCover);

    // B. Sincronització de Telemetria — abans del virga/boira/neu.
    // Ha de fixar si de debò plou o no (i amb quina intensitat) abans que
    // els mòduls següents decideixin res sobre un codi encara no corregit.
    code = applyTelemetrySync(code, precipInstantanea);

    // C. Filtre Virga (última paraula real sobre si la pluja arriba a terra)
    code = checkForVirga(code, humidity, cloudCover, precipInstantanea);

    // D. Detecció de Boira per punt de rosada (amb el seu propi tallafoc integrat)
    code = checkForFog(code, temp, humidity, cloudCover);

    // D2. Detecció de Boira per visibilitat real d'AROME — xarxa de seguretat
    // quan el punt de rosada no ha disparat però la visibilitat mesurada sí.
    code = checkCriticalVisibility(code, visibility, precipInstantanea, temp, humidity);
    
    // E. Ajust per Tempestes (CAPE)
    code = adjustForStorms(code, cape, cloudCover, precipInstantanea);
    
    // F. Transformació a Neu 
    code = determineSnowCode(code, temp, freezingLevel, elevation, precipInstantanea);

    // --- G. SEGELLAT DEFINITIU (DOCTRINA RISC ZERO) ---
    // Bloqueig Tèrmic (Erradica icones de neu/gel en temperatures positives)
    code = applyThermalLock(code, temp);

    return code;
};