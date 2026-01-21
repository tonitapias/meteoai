// src/utils/weatherLogic.ts
import { TRANSLATIONS, Language } from '../constants/translations';
import { WEATHER_THRESHOLDS } from '../constants/weatherConfig';
import { WeatherData } from '../services/weatherApi';

const { PRECIPITATION, WIND, TEMP, ALERTS, HUMIDITY } = WEATHER_THRESHOLDS;

// --- DEFINICIÓ DE TIPUS ESTRICTES ---

export interface TranslationMap {
  wmo: Record<number, string>;
  aiRainHeavy: string;
  aiRainMod: string;
  aiRainLight: string;
  aiRainStopping: string;
  aiRainMore: string;
  aiIntroMorning: string;
  aiIntroAfternoon: string;
  aiIntroNight: string;
  aiSummaryClear: string;
  aiSummaryVariable: string;
  aiSummaryVariableNight: string;
  aiSummaryOvercast: string;
  aiSummaryFog: string;
  alertVisibility: string;
  aiSummarySnow: string;
  aiSummaryCloudy: string;
  aiRainChance: string;
  aiRainNone: string;
  aiTempFreezing: string;
  aiTempCold: string;
  aiTempCool: string;
  aiTempMild: string;
  aiTempWarm: string;
  aiTempHot: string;
  aiHeatIndex?: string;
  storm: string;
  alertStorm: string;
  snow: string;
  alertSnow: string;
  rain: string;
  alertRain: string;
  wind: string;
  tipWindbreaker: string;
  alertWindHigh: string;
  alertWindExtreme: string;
  heat: string;
  alertHeatExtreme: string;
  tipHydration: string;
  tipSunscreen: string;
  alertHeatHigh: string;
  sun: string;
  alertUV: string;
  aqi: string;
  alertAir: string;
  cold: string;
  alertColdExtreme: string;
  tipCoat: string;
  tipThermal: string;
  tipLayers: string;
  tipUmbrella: string;
  tipCalm: string;
  aiWindStrong: string;
  aiWindMod: string;
  aiConfidence: string;
  aiConfidenceLow: string;
  aiConfidenceMod: string;
  [key: string]: unknown;
}

export interface Alert {
  type: string;
  msg: string;
  level: 'high' | 'warning' | 'info';
}

export interface StrictCurrentWeather {
  time: string;
  weather_code: number;
  temperature_2m: number;
  apparent_temperature: number;
  relative_humidity_2m: number;
  wind_speed_10m: number;
  wind_gusts_10m?: number;
  visibility?: number;
  cloud_cover?: number;
  is_day: number;
  precipitation?: number;
  rain?: number;
  showers?: number;
  cloud_cover_low?: number;
  cloud_cover_mid?: number;
  cloud_cover_high?: number;
  source?: string;
  minutely15?: number[];
  [key: string]: unknown;
}

export interface StrictHourlyWeather {
  time: string[];
  precipitation_probability?: (number | null)[];
  precipitation: (number | null)[];
  temperature_2m: (number | null)[];
  cape?: (number | null)[];
  wind_speed_10m: (number | null)[];
  wind_gusts_10m?: (number | null)[];
  snow_depth?: (number | null)[];
  relative_humidity_2m: (number | null)[];
  freezing_level_height?: (number | null)[];
  [key: string]: unknown;
}

export interface StrictDailyWeather {
  time: string[];
  precipitation_probability_max?: (number | null)[];
  temperature_2m_max: (number | null)[];
  temperature_2m_min: (number | null)[];
  precipitation_sum?: (number | null)[];
  uv_index_max?: (number | null)[];
  wind_speed_10m_max?: (number | null)[];
  sunrise?: string[];
  sunset?: string[];
  elevation?: number;
  [key: string]: unknown;
}

export interface ExtendedWeatherData extends Omit<WeatherData, 'current' | 'hourly' | 'daily'> {
  current: StrictCurrentWeather;
  hourly: StrictHourlyWeather;
  daily: StrictDailyWeather;
  hourlyComparison?: {
    ecmwf: Record<string, unknown>[];
    gfs: Record<string, unknown>[];
    icon: Record<string, unknown>[];
  };
  dailyComparison?: {
    ecmwf: Record<string, unknown>;
    gfs: Record<string, unknown>;
    icon: Record<string, unknown>;
  };
  [key: string]: unknown;
}

export interface AIPredictionResult {
  text: string;
  tips: string[];
  confidence: string;
  confidenceLevel: string;
  alerts: Alert[];
}

export interface ReliabilityResult {
    level: 'low' | 'medium' | 'high';
    type: 'general' | 'temp' | 'precip' | 'divergent' | 'ok';
    value: number | string;
}

// ==========================================
// 1. FUNCIONS AUXILIARS BÀSIQUES
// ==========================================

const safeNum = (val: unknown, fallback: number = 0): number => {
    if (val === null || val === undefined || Number.isNaN(Number(val))) return fallback;
    return Number(val);
};

export const getShiftedDate = (baseDate: Date, timezoneOrOffset: number | string): Date => {
  if (typeof timezoneOrOffset === 'number') {
      const utcTimestamp = baseDate.getTime(); 
      return new Date(utcTimestamp + (timezoneOrOffset * 1000));
  }
  if (!timezoneOrOffset) return baseDate;
  try {
      return new Date(baseDate.toLocaleString("en-US", { timeZone: timezoneOrOffset as string }));
  } catch {
      return baseDate;
  }
};

export const calculateDewPoint = (T: number, RH: number): number => {
  const a = 17.27, b = 237.7;
  const safeRH = Math.max(RH, 1);
  const alpha = ((a * T) / (b + T)) + Math.log(safeRH / 100.0);
  return (b * alpha) / (a - alpha);
};

export const getMoonPhase = (date: Date): number => {
  let year = date.getFullYear();
  let month = date.getMonth() + 1;
  // eslint-disable-next-line prefer-const
  let day = date.getDate(); 
  
  if (month < 3) { year--; month += 12; }
  const c = 365.25 * year, e = 30.6 * month;
  const jd = c + e + day - 694039.09; 
  let phase = jd / 29.5305882; 
  phase -= Math.floor(phase); 
  return phase; 
};

export const getWeatherLabel = (current: StrictCurrentWeather | undefined, language: Language): string => {
  const tr = (TRANSLATIONS[language] || TRANSLATIONS['ca']) as TranslationMap;
  if (!tr || !current) return "";
  const code = safeNum(current.weather_code, 0);
  return tr.wmo[code] || "---";
};

// ==========================================
// 2. LÒGICA IA I PREDICCIONS
// ==========================================

const analyzePrecipitation = (isRaining: boolean, precipInstantanea: number, code: number, precipNext15: number, tr: TranslationMap) => {
    const parts: string[] = []; 
    if (isRaining) {
        if (precipInstantanea > PRECIPITATION.HEAVY || code === 65 || code === 67 || code === 82) parts.push(tr.aiRainHeavy); 
        else if (precipInstantanea >= 0.7 || code === 63 || code === 81 || code === 53 || code === 55) parts.push(tr.aiRainMod); 
        else parts.push(tr.aiRainLight);

        if (precipInstantanea > 0) {
            if (precipNext15 < PRECIPITATION.LIGHT) parts.push(" " + tr.aiRainStopping);
            else if (precipNext15 > precipInstantanea * PRECIPITATION.INTENSIFY_FACTOR) parts.push(" " + tr.aiRainMore);
        }
    }
    return parts.filter(Boolean);
};

const analyzeSky = (code: number, isDay: number, currentHour: number, visibility: number, rainProb: number, cloudCover: number, tr: TranslationMap, alerts: Alert[]) => {
    const parts: string[] = []; 
    if (isDay) parts.push(currentHour < 12 ? tr.aiIntroMorning : tr.aiIntroAfternoon);
    else parts.push(tr.aiIntroNight);

    if (code === 0 || code === 1) parts.push(tr.aiSummaryClear);
    else if (code === 2) parts.push(isDay ? tr.aiSummaryVariable : tr.aiSummaryVariableNight);
    else if (code === 3) parts.push(tr.aiSummaryOvercast); 
    else if (code === 45 || code === 48) {
        parts.push(tr.aiSummaryFog); 
        if (visibility < 500) alerts.push({ type: "VIS", msg: tr.alertVisibility, level: 'warning' });
    }
    else if ((code >= 71 && code <= 77) || code === 85 || code === 86) parts.push(tr.aiSummarySnow);
    else if (code > 48) parts.push(tr.aiSummaryCloudy);
    
    if (rainProb > 40) parts.push(tr.aiRainChance);
    else if (cloudCover < 30 && code <= 2) parts.push(tr.aiRainNone);
    return parts.filter(Boolean);
};

const analyzeTemperature = (feelsLike: number, temp: number, humidity: number, dailyMin: number, currentHour: number, unit: string, tr: TranslationMap) => {
    const parts: string[] = []; 
    if (feelsLike <= TEMP.FREEZING) parts.push(tr.aiTempFreezing);
    else if (feelsLike > TEMP.FREEZING && feelsLike < TEMP.COLD) parts.push(tr.aiTempCold);
    else if (feelsLike >= TEMP.COLD && feelsLike < TEMP.MILD) {
        if (currentHour >= 15 && dailyMin < TEMP.COLD) parts.push(tr.aiTempCold); 
        else parts.push(tr.aiTempCool); 
    }
    else if (feelsLike >= TEMP.MILD && feelsLike < TEMP.WARM) parts.push(tr.aiTempMild);
    else if (feelsLike >= TEMP.WARM && feelsLike < TEMP.HOT) parts.push(tr.aiTempWarm);
    else if (feelsLike >= TEMP.HOT) parts.push(tr.aiTempHot);

    if (temp > TEMP.WARM && humidity > HUMIDITY.HIGH) {
       let displayFeelsLike = feelsLike;
       if (unit === 'F' || unit === 'imperial') displayFeelsLike = (feelsLike * 9/5) + 32;
       const heatText = tr.aiHeatIndex ? tr.aiHeatIndex.replace('{temp}', String(Math.round(displayFeelsLike))) : "";
       parts.push(heatText);
    }
    return parts.filter(Boolean);
};

interface AlertParams {
    code: number;
    windSpeed: number;
    windGusts: number;
    temp: number;
    rainProb: number;
    isRaining: boolean;
    uvMax: number;
    isDay: number;
    aqiValue: number;
    currentCape: number;
    precipSum: number;
}

const generateAlertsAndTips = (params: AlertParams, tr: TranslationMap) => {
    const { code, windSpeed, windGusts, temp, rainProb, isRaining, uvMax, isDay, aqiValue, currentCape, precipSum } = params;
    const alerts: Alert[] = []; 
    const tips: string[] = [];   
    const isSnow = (code >= 71 && code <= 77) || code === 85 || code === 86;

    if (code >= 95 || currentCape > ALERTS.CAPE_STORM) alerts.push({ type: tr.storm, msg: tr.alertStorm, level: 'high' });
    else if (isSnow) alerts.push({ type: tr.snow, msg: tr.alertSnow, level: 'warning' });
    else if ((code === 65 || code === 82 || precipSum > ALERTS.PRECIP_SUM_HIGH) && isRaining) alerts.push({ type: tr.rain, msg: tr.alertRain, level: 'warning' });

    if (windGusts > 50) {
        alerts.push({ type: tr.wind, msg: "Ràfegues de vent fortes", level: 'warning' });
        tips.push(tr.tipWindbreaker);
    } else if (windSpeed > WIND.STRONG) { 
        alerts.push({ type: tr.wind, msg: tr.alertWindHigh, level: 'warning' }); 
        tips.push(tr.tipWindbreaker); 
    } else if (windSpeed > WIND.EXTREME) {
        alerts.push({ type: tr.wind, msg: tr.alertWindExtreme, level: 'high' });
    }
    
    if (temp > TEMP.EXTREME_HEAT) { alerts.push({ type: tr.heat, msg: tr.alertHeatExtreme, level: 'high' }); tips.push(tr.tipHydration, tr.tipSunscreen); } 
    else if (temp > 30) { alerts.push({ type: tr.heat, msg: tr.alertHeatHigh, level: 'warning' }); tips.push(tr.tipHydration); }

    if (uvMax > ALERTS.UV_HIGH && isDay) { 
        if(uvMax >= ALERTS.UV_EXTREME) alerts.push({ type: tr.sun, msg: tr.alertUV, level: 'high' }); 
        tips.push(tr.tipSunscreen); 
    }
    if (aqiValue > ALERTS.AQI_BAD) alerts.push({ type: tr.aqi, msg: tr.alertAir, level: 'warning' });

    if (temp < TEMP.FREEZING) { alerts.push({ type: tr.cold, msg: tr.alertColdExtreme, level: 'high' }); tips.push(tr.tipCoat, tr.tipThermal); } 
    else if (temp < TEMP.COLD) { tips.push(tr.tipCoat); if (temp < 5) tips.push(tr.tipLayers); } 
    else if (temp >= TEMP.COLD && temp < 16) { tips.push(tr.tipLayers); }

    if (rainProb > 40 || isRaining) tips.push(tr.tipUmbrella);
    if (tips.length === 0) tips.push(tr.tipCalm);

    return { alerts, tips: [...new Set(tips)].slice(0, 4) };
};

const getFutureRainProbability = (hourly: StrictHourlyWeather, daily: StrictDailyWeather, currentHour: number): number => {
    if (hourly && hourly.precipitation_probability) {
        const safeProbs = (hourly.precipitation_probability || [])
            .slice(currentHour, currentHour + 12)
            .map((v) => safeNum(v));
        return Math.max(...safeProbs, 0);
    }
    return safeNum(daily.precipitation_probability_max?.[0], 0);
};

const analyzeWind = (windSpeed: number, tr: TranslationMap) => {
    if (windSpeed > WIND.MODERATE) {
        return windSpeed > WIND.STRONG ? tr.aiWindStrong : tr.aiWindMod;
    }
    return "";
};

export const generateAIPrediction = (
    current: StrictCurrentWeather, 
    daily: StrictDailyWeather, 
    hourly: StrictHourlyWeather, 
    aqiValue: number, 
    language: Language = 'ca', 
    effectiveCode: number | null = null, 
    reliability: ReliabilityResult | null = null, 
    unit: string = 'C'
): AIPredictionResult => {
    const tr = (TRANSLATIONS[language] || TRANSLATIONS['ca']) as TranslationMap;
    if (!tr || !current || !daily || !hourly) {
        return { text: "...", tips: [], alerts: [], confidence: "Error", confidenceLevel: "low" };
    }
    
    try {
        const currentHour = new Date().getHours();
        const code = safeNum(effectiveCode !== null ? effectiveCode : current.weather_code, 0);
        
        const minutely15 = current.minutely15 || [];
        const precipInstantanea = safeNum(minutely15[0]);
        const precipNext15 = safeNum(minutely15[1]);
        
        const isRaining = (code >= 51 && code <= 67) || (code >= 80 && code <= 82) || precipInstantanea >= 0.1;
        const futureRainProb = getFutureRainProbability(hourly, daily, currentHour);
        
        const windSpeed = safeNum(current.wind_speed_10m);
        const windGusts = safeNum(current.wind_gusts_10m);
        const visibility = safeNum(current.visibility, 10000);
        const cloudCover = safeNum(current.cloud_cover, 0);
        const isDay = safeNum(current.is_day, 1);

        let summaryParts: string[] = [];
        const alertsList: Alert[] = []; 

        if (isRaining) {
            summaryParts = analyzePrecipitation(isRaining, precipInstantanea, code, precipNext15, tr);
        } else {
            summaryParts = analyzeSky(code, isDay, currentHour, visibility, futureRainProb, cloudCover, tr, alertsList);
        }

        const currentRainVol = hourly.precipitation ? safeNum(hourly.precipitation[currentHour]) : 0;
        const nextHourRainVol = hourly.precipitation ? safeNum(hourly.precipitation[currentHour + 1]) : 0;
        
        if (nextHourRainVol > currentRainVol * 2 && nextHourRainVol > 1) {
            summaryParts.push(" Atenció: la pluja s'intensificarà notablement aviat.");
        } else if (currentRainVol > 0 && nextHourRainVol === 0) {
            summaryParts.push(" La pluja anirà remetent properament.");
        }

        const windText = analyzeWind(windSpeed, tr);
        if (windText) summaryParts.push(windText);

        const tempParts = analyzeTemperature(
            safeNum(current.apparent_temperature), 
            safeNum(current.temperature_2m), 
            safeNum(current.relative_humidity_2m), 
            safeNum(daily.temperature_2m_min?.[0]), 
            currentHour, unit, tr
        );
        summaryParts = [...summaryParts, ...tempParts];

        const currentCape = hourly.cape ? safeNum(hourly.cape[currentHour]) : 0;
        const precipSum = daily.precipitation_sum ? safeNum(daily.precipitation_sum[0]) : 0;
        const uvMax = daily.uv_index_max ? safeNum(daily.uv_index_max[0]) : 0;

        const alertsAndTips = generateAlertsAndTips({
            code, windSpeed, windGusts, temp: safeNum(current.temperature_2m), 
            rainProb: futureRainProb, isRaining, uvMax, 
            isDay, aqiValue: safeNum(aqiValue), 
            currentCape, precipSum
        }, tr);

        let confidenceText = tr.aiConfidence; 
        let confidenceLevel = 'high';
        if (reliability) {
            if (reliability.level === 'low') { confidenceLevel = 'low'; confidenceText = tr.aiConfidenceLow; } 
            else if (reliability.level === 'medium') { confidenceLevel = 'medium'; confidenceText = tr.aiConfidenceMod; }
        }

        const finalString = summaryParts.filter(Boolean).join("").replace(/\s+/g, ' ');

        return { 
            text: finalString, 
            tips: alertsAndTips.tips, 
            confidence: confidenceText, 
            confidenceLevel, 
            alerts: [...alertsList, ...alertsAndTips.alerts] 
        };

    } catch (error) {
        console.error("AI Generation Error:", error);
        return { text: tr.aiSummaryClear, tips: [], alerts: [], confidence: "Error", confidenceLevel: "low" };
    }
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

    const lowClouds = safeNum(current.cloud_cover_low, 0);
    const midClouds = safeNum(current.cloud_cover_mid, 0);
    const highClouds = safeNum(current.cloud_cover_high, 0);
    
    const effectiveCloudCover = Math.min(100, (lowClouds * 1.0) + (midClouds * 0.6) + (highClouds * 0.3));

    if (code <= 3) {
        if (effectiveCloudCover > 85) code = 3;      
        else if (effectiveCloudCover > 45) code = 2; 
        else if (effectiveCloudCover > 15) code = 1; 
        else code = 0;                      
    }

    const precipInstantanea = minutelyPrecipData && minutelyPrecipData.length > 0 
        ? Math.max(...minutelyPrecipData.map(v => safeNum(v, 0))) 
        : safeNum(current.precipitation, 0);

    if (isArome && precipInstantanea >= PRECIPITATION.TRACE && code < 51) {
        code = 61; 
    }

    const dewPoint = calculateDewPoint(temp, humidity);
    const dewPointSpread = temp - dewPoint;

    if (code < 45 && dewPointSpread < 1.2 && humidity > 96 && effectiveCloudCover > 50) {
        code = 45; 
    } else if (code === 0 && humidity > 92) {
        code = 1; 
    }

    if (cape > 1200) { 
         
        const isPrecipitating = precipInstantanea >= PRECIPITATION.TRACE || (code >= 51 && code <= 82);
        
        if (effectiveCloudCover > 60) {
            if (isPrecipitating) {
                 if (code < 95) code = 95;
            } else if (cape > 2000) {
                code = 2; 
            }
        }
    }

    const freezingDist = freezingLevel - elevation;
    const isColdEnoughForSnow = temp <= 1 || (temp <= 4 && freezingDist < 300);

    if (isColdEnoughForSnow) {
        const isRainCode = (code >= 51 && code <= 67) || (code >= 80 && code <= 82) || (code >= 95);
        if (isRainCode || precipInstantanea > 0) {
            if (code === 65 || code === 82 || code === 67 || code >= 95 || precipInstantanea > 1.5) return 75; 
            if (code === 63 || code === 81 || code === 55 || code === 57 || precipInstantanea >= 0.5) return 73; 
            return 71; 
        }
        if ((code >= 71 && code <= 77) || code === 85 || code === 86) return code;
    }
    
    if ((code === 45 || code === 48 || visibility < 1000) && precipInstantanea < 0.1) {
        return 45;
    }

    if (precipInstantanea >= PRECIPITATION.TRACE) { 
        if (code >= 95) return code; 
        if (precipInstantanea > 4.0) code = 65; 
        else if (precipInstantanea >= 1.0) code = 63; 
        else code = 61; 
    } 

    return code;
};

export const isAromeSupported = (lat: number, lon: number): boolean => {
    if (!lat || !lon) return false;
    const MIN_LAT = 38.0, MAX_LAT = 53.0, MIN_LON = -8.0, MAX_LON = 12.0; 
    return (lat >= MIN_LAT && lat <= MAX_LAT && lon >= MIN_LON && lon <= MAX_LON);
};

export const prepareContextForAI = (current: StrictCurrentWeather, daily: StrictDailyWeather, hourly: StrictHourlyWeather) => {
    if (!current || !daily || !hourly || !hourly.time) return null;

    const currentIsoTime = current.time; 
    let startIndex = hourly.time.findIndex((t: string) => t === currentIsoTime);

    if (startIndex === -1 && currentIsoTime) {
         const currentHourStr = currentIsoTime.slice(0, 13); 
         startIndex = hourly.time.findIndex((t: string) => t.startsWith(currentHourStr));
    }
    
    startIndex = startIndex === -1 ? 0 : startIndex;

    const getNext4h = (key: keyof StrictHourlyWeather) => {
        const data = hourly[key];
        if (!Array.isArray(data)) return [];
        return data.slice(startIndex, startIndex + 4).map((v) => safeNum(v));
    };

    return {
        timestamp: current.time,
        location: { 
            elevation: safeNum(current.elevation || daily.elevation, 0)
        },
        current: {
            temp: safeNum(current.temperature_2m),
            feels_like: safeNum(current.apparent_temperature),
            is_raining: safeNum(current.precipitation) > 0 || safeNum(current.rain) > 0 || safeNum(current.showers) > 0,
            wind_speed: safeNum(current.wind_speed_10m),
            weather_code: safeNum(current.weather_code),
            humidity: safeNum(current.relative_humidity_2m)
        },
        daily_summary: {
            max: safeNum(daily.temperature_2m_max?.[0]),
            min: safeNum(daily.temperature_2m_min?.[0]),
            uv_max: safeNum(daily.uv_index_max?.[0]),
            rain_sum: safeNum(daily.precipitation_sum?.[0]),
            sunrise: daily.sunrise?.[0],
            sunset: daily.sunset?.[0]
        },
        short_term_trend: {
            temps: getNext4h('temperature_2m'),
            rain_prob: getNext4h('precipitation_probability'),
            precip_vol: getNext4h('precipitation'), 
            wind: getNext4h('wind_speed_10m'),
            gusts: getNext4h('wind_gusts_10m'),
            snow_depth: getNext4h('snow_depth') 
        }
    };
};

// --- NOVA IMPLEMENTACIÓ ROBUSTA DE L'INJECCIÓ HÍBRIDA (CORREGIDA LINT) ---

// Funció helper per netejar els sufixes molestos de l'API (AROME, ECMWF, etc.)
const cleanKeys = (obj: Record<string, unknown>): Record<string, unknown> => {
    if (!obj) return {};
    const clean: Record<string, unknown> = {};
    Object.keys(obj).forEach(key => {
        // Elimina qualsevol sufix de model conegut
        const cleanKey = key.replace(/_meteofrance_arome_france_hd|_best_match|_ecmwf|_gfs|_icon/g, '');
        clean[cleanKey] = obj[key];
    });
    return clean;
};

export const injectHighResModels = (baseData: ExtendedWeatherData, highResData: ExtendedWeatherData | null): ExtendedWeatherData => {
    if (!baseData) return baseData;
    const target = typeof structuredClone === 'function' ? structuredClone(baseData) : JSON.parse(JSON.stringify(baseData)) as ExtendedWeatherData; 
    
    // 1. NETEJA PREVIA: Si highResData ve "brut" (amb sufixes), el netegem primer
    if (!highResData) return target;
    
    // CORRECCIÓ LINT: Evitem 'any' usant casting segur a Record<string, unknown>
    const rawHighRes = highResData as unknown as Record<string, unknown>;
    
    // Creem un objecte font netejat per facilitar l'accés
    const source = {
        current: cleanKeys(rawHighRes.current as Record<string, unknown>),
        hourly: {
            ...cleanKeys(rawHighRes.hourly as Record<string, unknown>),
            time: highResData.hourly?.time 
        },
        minutely_15: rawHighRes.minutely_15 
            ? cleanKeys(rawHighRes.minutely_15 as Record<string, unknown>) 
            : undefined
    };

    const masterTimeLength = target.hourly?.time?.length || 0;

    // Assegurem estructura del target
    if (target.hourly && masterTimeLength > 0) {
        Object.keys(target.hourly).forEach(key => {
            if (key === 'time') return;
            const arr = target.hourly[key as keyof StrictHourlyWeather];
            if (Array.isArray(arr)) {
                while (arr.length < masterTimeLength) arr.push(null);
            }
        });
    }

    // 2. INJECCIÓ CURRENT (Dades actuals)
    const CURRENT_FIELDS_TO_OVERWRITE: (keyof StrictCurrentWeather)[] = [
        'temperature_2m', 'relative_humidity_2m', 'apparent_temperature', 
        'is_day', 'precipitation', 'rain', 'showers', 
        'weather_code', 'cloud_cover', 'cloud_cover_low', 
        'cloud_cover_mid', 'cloud_cover_high', 
        'wind_speed_10m', 'wind_gusts_10m', 'visibility'
    ];

    if (source.current && target.current) {
        CURRENT_FIELDS_TO_OVERWRITE.forEach(k => {
             // TypeScript sap que source.current és un Record, així que l'accés és segur
             const val = (source.current as Record<string, unknown>)[k];
             if (val != null && !isNaN(Number(val))) {
                 (target.current as Record<string, unknown>)[k] = val;
             }
        });
        target.current.source = 'AROME HD'; 
    }

    // 3. INJECCIÓ MINUTELY_15 (Amb seguretat anti-penjades)
    // Utilitzem un casting local segur
    const srcMin = source.minutely_15 as Record<string, unknown> | undefined;
    if (srcMin && Array.isArray(srcMin.time) && Array.isArray(srcMin.precipitation)) {
        // Casting segur a la interfície esperada
        target.minutely_15 = srcMin as unknown as { time: string[]; precipitation: number[]; [key: string]: unknown };
    }

    // 4. INJECCIÓ HOURLY (Previsió per hores)
    const HOURLY_FIELDS: (keyof StrictHourlyWeather)[] = [
        'temperature_2m', 'relative_humidity_2m', 'apparent_temperature',
        'precipitation', 'weather_code',
        'cloud_cover', 'cloud_cover_low', 'cloud_cover_mid', 'cloud_cover_high',
        'wind_speed_10m', 'wind_gusts_10m',
        'cape', 'freezing_level_height', 'visibility'
    ];

    if (source.hourly && target.hourly && target.hourly.time) {
        const globalTimeIndexMap = new Map<string, number>();
        target.hourly.time.forEach((t, i) => globalTimeIndexMap.set(t, i));

        // CORRECCIÓ LINT FINAL: Ja no fem servir (source.hourly as any).time
        // Perquè 'source' s'ha definit adalt amb la propietat 'time' explícita.
        const sourceTimes = source.hourly.time || highResData.hourly?.time || [];

        (sourceTimes as string[]).forEach((timeValue: string, sourceIndex: number) => {
            const globalIndex = globalTimeIndexMap.get(timeValue);
            
            if (globalIndex !== undefined) {
                const sH = source.hourly as Record<string, unknown>; // Casting segur
                const tH = target.hourly;
                
                HOURLY_FIELDS.forEach(field => {
                    const srcArr = sH[field];
                    
                    if (Array.isArray(srcArr)) {
                         const val = srcArr[sourceIndex];
                         if (val != null && !isNaN(Number(val))) {
                             if (!tH[field]) {
                                 (tH as Record<string, unknown>)[field] = new Array(masterTimeLength).fill(null);
                             }

                             const tgtArr = tH[field] as (number | null)[];
                             if (Array.isArray(tgtArr)) {
                                 tgtArr[globalIndex] = val;
                             }
                         }
                    }
                });

                // Reforç de probabilitat de pluja si AROME detecta precipitació
                const precipArr = sH.precipitation as number[] | undefined;
                const aromePrecip = precipArr?.[sourceIndex];
                
                if (aromePrecip != null && aromePrecip >= 0.1) {
                    if (!tH.precipitation_probability) tH.precipitation_probability = new Array(masterTimeLength).fill(0);
                    const currentProb = tH.precipitation_probability[globalIndex] || 0;
                    if (currentProb < 50) {
                        tH.precipitation_probability[globalIndex] = Math.max(currentProb, 70);
                    }
                }
            }
        });
    }

    return target;
};

// Replaces unknown types with structured generic objects
type GenericModelData = Record<string, unknown>;

export const normalizeModelData = (data: WeatherData): ExtendedWeatherData => {
    // Cast inicial per transformar l'objecte lax en l'estructura estricta
    // Assumim que les dades de l'API compleixen mínimament
    if (!data || !data.current) return data as unknown as ExtendedWeatherData;
    
    // Creem la base copiant dades. Utilitzem "unknown" intermedi per fer el casting segur.
    const result: ExtendedWeatherData = { 
        ...data, 
        current: { ...data.current }, 
        hourly: { ...data.hourly }, 
        daily: { ...data.daily }, 
        hourlyComparison: { ecmwf: [], gfs: [], icon: [] }, 
        dailyComparison: { ecmwf: {}, gfs: {}, icon: {} } 
    } as unknown as ExtendedWeatherData;
    
    const rawDaily = data.daily as GenericModelData;
    Object.keys(rawDaily || {}).forEach(key => {
        if (key.includes('_best_match')) {
            const cleanKey = key.split('_best_match')[0];
            (result.daily as GenericModelData)[cleanKey] = rawDaily[key]; 
        } else {
            let model: 'ecmwf' | 'gfs' | 'icon' | null = null;
            if (key.includes('_ecmwf_')) model = 'ecmwf';
            else if (key.includes('_gfs_')) model = 'gfs';
            else if (key.includes('_icon_')) model = 'icon';

            if (model && result.dailyComparison) {
                const cleanKey = key.split(`_${model}_`)[0];
                result.dailyComparison[model][cleanKey] = rawDaily[key];
            }
        }
    });

    const timeLength = result.hourly?.time?.length || 0;
    if (result.hourlyComparison) {
        ['ecmwf', 'gfs', 'icon'].forEach(m => {
            // as keyof... cast
            const modelKey = m as keyof typeof result.hourlyComparison; 
            if(result.hourlyComparison) {
                 result.hourlyComparison[modelKey] = Array.from({ length: timeLength }, () => ({}));
            }
        });
    }

    const rawHourly = data.hourly as Record<string, unknown[]>;
    Object.keys(rawHourly || {}).forEach(key => {
        if (key.includes('_best_match')) {
            const cleanKey = key.split('_best_match')[0];
            (result.hourly as GenericModelData)[cleanKey] = rawHourly[key];
        } else {
            let model: 'ecmwf' | 'gfs' | 'icon' | null = null;
            if (key.includes('_ecmwf_')) model = 'ecmwf';
            else if (key.includes('_gfs_')) model = 'gfs';
            else if (key.includes('_icon_')) model = 'icon';
            
            if (model && result.hourlyComparison) {
                const cleanKey = key.split(`_${model}_`)[0];
                const values = rawHourly[key];
                const targetArray = result.hourlyComparison[model];
                for (let i = 0; i < Math.min(values.length, timeLength); i++) {
                    targetArray[i][cleanKey] = values[i];
                }
            }
        }
    });

    const rawCurrent = data.current as GenericModelData;
    Object.keys(rawCurrent || {}).forEach(key => {
        if (key.includes('_best_match')) {
            const cleanKey = key.split('_best_match')[0];
            (result.current as GenericModelData)[cleanKey] = rawCurrent[key];
        }
    });

    return result;
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