// src/utils/weatherLogic.ts
import { TRANSLATIONS, Language } from '../translations';
import { WEATHER_THRESHOLDS } from '../constants/weatherConfig';
import { 
    TranslationMap, 
    StrictCurrentWeather, 
    StrictDailyWeather, 
    ReliabilityResult 
} from '../types/weatherLogicTypes';
import { safeNum, calculateDewPoint } from './physics';

// --- RE-EXPORTACIONS ---
export * from '../types/weatherLogicTypes';
export * from './physics';
export * from './aromeEngine';
export * from './normData';
export * from './aiContext';

// Desestructurem per comoditat
const { 
  PRECIPITATION, 
  CLOUDS, 
  HUMIDITY, 
  CAPE, 
  SNOW, 
  VISIBILITY 
} = WEATHER_THRESHOLDS;

// ==========================================
// CONSTANTS INTERNES (NO EXPORTADES)
// ==========================================

// Virga: Pluja que s'evapora abans de tocar terra
const VIRGA_HUMIDITY_LIMIT = 45; // % Mínim d'humitat per permetre pluja feble
const VIRGA_PRECIP_LIMIT = 1.5;  // mm Màxims per considerar filtrar la pluja

// Llindars de Fiabilitat (Diferència entre models)
const RELIABILITY = {
    TEMP_HIGH_DIFF: 5,   // > 5 graus de diferència és ALERTA
    PRECIP_HIGH_DIFF: 10, // > 10mm de diferència és ALERTA
    TEMP_MED_DIFF: 2,    // > 2 graus és DIVERGÈNCIA
    PRECIP_MED_DIFF: 3   // > 3mm és DIVERGÈNCIA
};

// ==========================================
// HELPERS PRIVATS
// ==========================================

/** Calcula el % de núvols efectiu ponderant els baixos (més impacte), mitjans i alts */
const calculateEffectiveCloudCover = (low: number, mid: number, high: number): number => {
    return Math.min(100, (low * 1.0) + (mid * 0.6) + (high * 0.3));
};

/** Obté la precipitació màxima actual (entre dada minutal i horària) */
const getInstantaneousPrecipitation = (minutelyData: number[], currentPrecip: number): number => {
    if (minutelyData && minutelyData.length > 0) {
        return Math.max(...minutelyData.map(v => safeNum(v, 0)));
    }
    return safeNum(currentPrecip, 0);
};

/** Ajusta el codi de cel (serè/ennuvolat) basant-se en el % de cobertura */
const adjustBaseSkyCode = (code: number, cloudCover: number): number => {
    if (code > 3) return code;

    if (cloudCover > CLOUDS.OVERCAST) return 3; 
    if (cloudCover > CLOUDS.SCATTERED) return 2; 
    if (cloudCover > CLOUDS.FEW) return 1; 
    return 0; 
};

/** * FILTRE VIRGA: Evita dir que plou quan l'aire és molt sec.
 */
const checkForVirga = (code: number, humidity: number, cloudCover: number, precip: number): number => {
    const isRain = (code >= 51 && code <= 67) || (code >= 80 && code <= 82);
    
    if (!isRain) return code;

    if (humidity < VIRGA_HUMIDITY_LIMIT && precip < VIRGA_PRECIP_LIMIT) {
        // Retornem a l'estat de cel base (sense pluja)
        return cloudCover > 50 ? 3 : 2; 
    }

    return code;
};

/** Detecta condicions de boira o humitat extrema */
const checkForFog = (code: number, temp: number, humidity: number, cloudCover: number): number => {
    if (code >= 48) return code;

    const dewPoint = calculateDewPoint(temp, humidity);
    const spread = temp - dewPoint;

    if (code < 45 && spread < HUMIDITY.DEW_SPREAD && humidity > HUMIDITY.FOG_BASE && cloudCover > 50) {
        return 45;
    }
    if (code === 0 && humidity > HUMIDITY.HIGH) {
        return 1;
    }
    return code;
};

/** Ajusta per tempestes si hi ha molta energia (CAPE) */
const adjustForStorms = (code: number, cape: number, cloudCover: number, precipAmount: number): number => {
    if (cape <= CAPE.MIN_STORM) return code; 

    const isPrecipitating = precipAmount >= PRECIPITATION.TRACE || (code >= 51 && code <= 82);

    if (cloudCover > CLOUDS.STORM_BASE) {
        if (isPrecipitating) {
            if (code < 95) return 95;
        } else if (cape > CAPE.HIGH_STORM) {
            return 2; 
        }
    }
    return code;
};

/** Determina si la pluja s'ha de convertir en neu per temperatura */
const determineSnowCode = (
    code: number, 
    temp: number, 
    freezingLevel: number, 
    elevation: number, 
    precipAmount: number
): number => {
    const freezingDist = freezingLevel - elevation;
    const isColdEnough = temp <= SNOW.TEMP_SNOW || (temp <= SNOW.TEMP_MIX && freezingDist < SNOW.FREEZING_BUFFER);

    if (!isColdEnough) return code;

    const isRainCode = (code >= 51 && code <= 67) || (code >= 80 && code <= 82) || (code >= 95);

    if (isRainCode || precipAmount > 0) {
        if (code === 65 || code === 82 || code === 67 || code >= 95 || precipAmount > PRECIPITATION.MODERATE) return 75; 
        if (code === 63 || code === 81 || code === 55 || code === 57 || precipAmount >= PRECIPITATION.LIGHT) return 73; 
        return 71; 
    }
    
    if ((code >= 71 && code <= 77) || code === 85 || code === 86) return code;
    
    return code;
};

/** Ajusta la intensitat de la pluja (feble/moderada/forta) segons mm/h */
const adjustRainIntensity = (code: number, precipAmount: number): number => {
    if (code >= 95) return code;

    if (precipAmount >= PRECIPITATION.TRACE) { 
        if (precipAmount > PRECIPITATION.HEAVY) return 65; 
        if (precipAmount >= 1.0) return 63; 
        return 61; 
    } 
    return code;
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
 * MOTOR PRINCIPAL: Calcula el codi WMO en temps real basant-se en múltiples variables.
 * Aquesta funció corregeix els errors habituals dels models crus (ex: pluja fantasma, neu no detectada).
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

    const cloudCover = calculateEffectiveCloudCover(
        safeNum(current.cloud_cover_low, 0),
        safeNum(current.cloud_cover_mid, 0),
        safeNum(current.cloud_cover_high, 0)
    );

    const precipInstantanea = getInstantaneousPrecipitation(minutelyPrecipData, safeNum(current.precipitation, 0));

    // --- PIPELINE DE DECISIÓ ---
    
    // 1. Estat base del cel
    code = adjustBaseSkyCode(code, cloudCover);

    // 2. Correcció AROME (Forçar pluja si el model HD la veu)
    if (isArome && precipInstantanea >= PRECIPITATION.TRACE && code < 51) {
        code = 61; 
    }

    // 3. Filtre Virga (Eliminar pluja falsa si és molt sec)
    code = checkForVirga(code, humidity, cloudCover, precipInstantanea);

    // 4. Boira i Visibilitat
    code = checkForFog(code, temp, humidity, cloudCover);
    
    // 5. Tempestes (CAPE)
    code = adjustForStorms(code, cape, cloudCover, precipInstantanea);
    
    // 6. Neu (Temperatura i Cota)
    code = determineSnowCode(code, temp, freezingLevel, elevation, precipInstantanea);
    
    // 7. Visibilitat crítica (excepte si plou)
    if ((code === 45 || code === 48 || visibility < VISIBILITY.POOR) && precipInstantanea < PRECIPITATION.TRACE) {
        return 45;
    }

    // 8. Ajustar intensitat final
    const isSnow = (code >= 71 && code <= 77) || code === 85 || code === 86;
    if (!isSnow) {
        code = adjustRainIntensity(code, precipInstantanea);
    }

    return code;
};

/**
 * Calcula la fiabilitat de la predicció comparant 3 models (Best Match, GFS, ICON).
 * Retorna 'high', 'medium' o 'low' segons la divergència.
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
  
  // Extraiem temperatures i precipitacions amb noms clars
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

  // Avaluació segons constants
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