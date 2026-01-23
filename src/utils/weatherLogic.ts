// src/utils/weatherLogic.ts
import { TRANSLATIONS, Language } from '../translations';
// IMPORT CRÍTIC: Ara importem tot l'objecte de configuració
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
// HELPERS PRIVATS (Ara usant Constants)
// ==========================================

/** Calcula el % de núvols efectiu ponderant els baixos, mitjans i alts */
const calculateEffectiveCloudCover = (low: number, mid: number, high: number): number => {
    return Math.min(100, (low * 1.0) + (mid * 0.6) + (high * 0.3));
};

/** Obté la precipitació màxima actual */
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

/** Detecta condicions de boira o humitat extrema */
const checkForFog = (code: number, temp: number, humidity: number, cloudCover: number): number => {
    if (code >= 48) return code;

    const dewPoint = calculateDewPoint(temp, humidity);
    const spread = temp - dewPoint;

    // Ús de constants HUMIDITY
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
    
    // Ús de constants SNOW
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

    // Ús de constants PRECIPITATION
    if (precipAmount >= PRECIPITATION.TRACE) { 
        if (precipAmount > PRECIPITATION.HEAVY) return 65; 
        if (precipAmount >= 1.0) return 63; // Nota: Open-Meteo usa 1.0 com estàndard, podem mantenir-lo o usar PRECIPITATION.MODERATE
        return 61; 
    } 
    return code;
};

// ==========================================
// FUNCIONS EXPORTADES
// ==========================================

export const getWeatherLabel = (current: StrictCurrentWeather | undefined, language: Language): string => {
  const tr = (TRANSLATIONS[language] || TRANSLATIONS['ca']) as TranslationMap;
  if (!tr || !current) return "";
  const code = safeNum(current.weather_code, 0);
  return tr.wmo[code] || "---";
};

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
    code = adjustBaseSkyCode(code, cloudCover);

    if (isArome && precipInstantanea >= PRECIPITATION.TRACE && code < 51) {
        code = 61; 
    }

    code = checkForFog(code, temp, humidity, cloudCover);
    code = adjustForStorms(code, cape, cloudCover, precipInstantanea);
    code = determineSnowCode(code, temp, freezingLevel, elevation, precipInstantanea);
    
    // VISIBILITY.POOR en lloc de 1000
    if ((code === 45 || code === 48 || visibility < VISIBILITY.POOR) && precipInstantanea < PRECIPITATION.TRACE) {
        return 45;
    }

    const isSnow = (code >= 71 && code <= 77) || code === 85 || code === 86;
    if (!isSnow) {
        code = adjustRainIntensity(code, precipInstantanea);
    }

    return code;
};

export const calculateReliability = (dailyBest: StrictDailyWeather, dailyGFS: StrictDailyWeather, dailyICON: StrictDailyWeather, dayIndex: number = 0): ReliabilityResult => {
  if (!dailyGFS || !dailyICON || !dailyBest) {
      return { level: 'medium', type: 'general', value: 0 }; 
  }
  
  const t1 = safeNum(dailyBest.temperature_2m_max?.[dayIndex]);
  const t2 = safeNum(dailyGFS.temperature_2m_max?.[dayIndex]);
  const t3 = safeNum(dailyICON.temperature_2m_max?.[dayIndex]);
  const diffTemp = Math.max(t1, t2, t3) - Math.min(t1, t2, t3);
  
  const p1 = safeNum(dailyBest.precipitation_sum?.[dayIndex]);
  const p2 = safeNum(dailyGFS.precipitation_sum?.[dayIndex]);
  const p3 = safeNum(dailyICON.precipitation_sum?.[dayIndex]);
  const diffPrecip = Math.max(p1, p2, p3) - Math.min(p1, p2, p3);

  if (diffTemp > 5) {
      return { level: 'low', type: 'temp', value: diffTemp.toFixed(1) };
  }
  if (diffPrecip > 10) {
      return { level: 'low', type: 'precip', value: diffPrecip.toFixed(1) };
  }
  
  if (diffTemp > 2 || diffPrecip > 3) {
      return { level: 'medium', type: 'divergent', value: 0 };
  }
  
  return { level: 'high', type: 'ok', value: 0 };
};