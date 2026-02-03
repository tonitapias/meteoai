// src/utils/weatherLogic.ts
import { TRANSLATIONS, Language } from '../translations';
import { WEATHER_THRESHOLDS } from '../constants/weatherConfig';
import { 
    TranslationMap, 
    StrictCurrentWeather, 
    StrictDailyWeather, 
    ReliabilityResult 
} from '../types/weatherLogicTypes';
import { safeNum } from './physics';

// --- NOUS IMPORTS DE REGLES (Mòduls especialitzats) ---
import { adjustBaseSkyCode, calculateEffectiveCloudCover } from './rules/cloudRules';
import { getInstantaneousPrecipitation, checkForVirga, adjustRainIntensity } from './rules/precipitationRules';
import { checkForFog, checkCriticalVisibility } from './rules/visibilityRules';
import { adjustForStorms } from './rules/stormRules';
import { determineSnowCode } from './rules/winterRules';

// --- RE-EXPORTACIONS (Mantenim compatibilitat amb la resta de l'app) ---
export * from '../types/weatherLogicTypes';
export * from './physics';
export * from './aromeEngine';
export * from './normData';
export * from './aiContext';

// Constants locals de fiabilitat 
const RELIABILITY = {
    TEMP_HIGH_DIFF: 5,   
    PRECIP_HIGH_DIFF: 10, 
    TEMP_MED_DIFF: 2,    
    PRECIP_MED_DIFF: 3   
};

// ==========================================
// FUNCIONS EXPORTADES
// ==========================================

/**
 * Obté l'etiqueta de text (Ex: "Pluja lleugera") per a un codi WMO
 */
export const getWeatherLabel = (current: StrictCurrentWeather | undefined, language: Language): string => {
  const tr = (TRANSLATIONS[language] || TRANSLATIONS['ca']) as TranslationMap;
  if (!tr || !current) return "";
  const code = safeNum(current.weather_code, 0);
  return tr.wmo[code] || "---";
};

/**
 * MOTOR PRINCIPAL: Orquestra els diferents mòduls de regles per determinar el codi de temps real.
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

    // --- PIPELINE DE DECISIÓ (Seqüència lògica) ---
    
    // A. Estat base del cel (Núvols)
    code = adjustBaseSkyCode(code, cloudCover);

    // B. Correcció AROME (Prioritat al model HD)
    if (isArome && precipInstantanea >= PRECIPITATION.TRACE && code < 51) {
        code = 61; 
    }

    // C. Filtre Virga (Evitar falsos positius de pluja)
    code = checkForVirga(code, humidity, cloudCover, precipInstantanea);

    // D. Detecció de Boira
    code = checkForFog(code, temp, humidity, cloudCover);
    
    // E. Ajust per Tempestes (CAPE)
    code = adjustForStorms(code, cape, cloudCover, precipInstantanea);
    
    // F. Transformació a Neu (si cal per temperatura)
    code = determineSnowCode(code, temp, freezingLevel, elevation, precipInstantanea);
    
    // G. Visibilitat crítica final (excepte si plou)
    code = checkCriticalVisibility(code, visibility, precipInstantanea);

    // H. Ajustar intensitat final de la pluja (si no és neu)
    const isSnow = (code >= 71 && code <= 77) || code === 85 || code === 86;
    if (!isSnow) {
        code = adjustRainIntensity(code, precipInstantanea);
    }

    return code;
};

/**
 * Calcula la fiabilitat de la predicció comparant 3 models.
 */
export const calculateReliability = (
    dailyBest: StrictDailyWeather, 
    dailyGFS: StrictDailyWeather, 
    dailyICON: StrictDailyWeather, 
    dayIndex: number = 0
): ReliabilityResult => {
  if (!dailyGFS || !dailyICON || !dailyBest) {
      return { level: 'medium', type: 'general', value: 0 }; 
  }
  
  const tempBest = safeNum(dailyBest.temperature_2m_max?.[dayIndex]);
  const tempGFS = safeNum(dailyGFS.temperature_2m_max?.[dayIndex]);
  const tempICON = safeNum(dailyICON.temperature_2m_max?.[dayIndex]);
  
  const temps = [tempBest, tempGFS, tempICON];
  const diffTemp = Math.max(...temps) - Math.min(...temps);
  
  const precipBest = safeNum(dailyBest.precipitation_sum?.[dayIndex]);
  const precipGFS = safeNum(dailyGFS.precipitation_sum?.[dayIndex]);
  const precipICON = safeNum(dailyICON.precipitation_sum?.[dayIndex]);
  
  const precips = [precipBest, precipGFS, precipICON];
  const diffPrecip = Math.max(...precips) - Math.min(...precips);

  if (diffTemp > RELIABILITY.TEMP_HIGH_DIFF) {
      return { level: 'low', type: 'temp', value: Number(diffTemp.toFixed(1)) };
  }
  if (diffPrecip > RELIABILITY.PRECIP_HIGH_DIFF) {
      return { level: 'low', type: 'precip', value: Number(diffPrecip.toFixed(1)) };
  }
  
  if (diffTemp > RELIABILITY.TEMP_MED_DIFF || diffPrecip > RELIABILITY.PRECIP_MED_DIFF) {
      return { level: 'medium', type: 'divergent', value: 0 };
  }
  
  return { level: 'high', type: 'ok', value: 0 };
};