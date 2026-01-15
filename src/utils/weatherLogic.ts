// src/utils/weatherLogic.ts
import { TRANSLATIONS, Language } from '../constants/translations';
import { WEATHER_THRESHOLDS } from '../constants/weatherConfig';
import { WeatherData } from '../services/weatherApi';

const { PRECIPITATION, WIND, TEMP, ALERTS, HUMIDITY } = WEATHER_THRESHOLDS;

export interface ExtendedWeatherData extends WeatherData {
  hourlyComparison?: {
    ecmwf: any[];
    gfs: any[];
    icon: any[];
  };
  dailyComparison?: {
    ecmwf: any;
    gfs: any;
    icon: any;
  };
  [key: string]: any;
}

// --- HELPER SEGUR PER NÚMEROS ---
const safeNum = (val: any, fallback: number = 0): number => {
    if (val === null || val === undefined || Number.isNaN(val)) return fallback;
    return Number(val);
};

// ==========================================
// 1. FUNCIONS AUXILIARS BÀSIQUES
// ==========================================

export const getShiftedDate = (baseDate: Date, timezoneOrOffset: number | string): Date => {
  if (typeof timezoneOrOffset === 'number') {
      const utcTimestamp = baseDate.getTime() + (baseDate.getTimezoneOffset() * 60000);
      return new Date(utcTimestamp + (timezoneOrOffset * 1000));
  }
  if (!timezoneOrOffset) return baseDate;
  try {
      return new Date(baseDate.toLocaleString("en-US", { timeZone: timezoneOrOffset as string }));
  } catch (e) {
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
  let year = date.getFullYear(), month = date.getMonth() + 1, day = date.getDate();
  if (month < 3) { year--; month += 12; }
  const c = 365.25 * year, e = 30.6 * month;
  const jd = c + e + day - 694039.09; 
  let phase = jd / 29.5305882; 
  phase -= Math.floor(phase); 
  return phase; 
};

export const getWeatherLabel = (current: any, language: Language): string => {
  const tr = TRANSLATIONS[language] || TRANSLATIONS['ca'];
  if (!tr || !current) return "";
  const code = safeNum(current.weather_code, 0);
  return (tr.wmo as any)[code] || "---";
};

// ==========================================
// 2. LÒGICA IA I PREDICCIONS (BLINDADA)
// ==========================================

const analyzePrecipitation = (isRaining: boolean, precipInstantanea: number, code: number, precipNext15: number, tr: any) => {
    let parts = [];
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

const analyzeSky = (code: number, isDay: number, currentHour: number, visibility: number, rainProb: number, cloudCover: number, tr: any, alerts: any[]) => {
    let parts = [];
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

const analyzeTemperature = (feelsLike: number, temp: number, humidity: number, dailyMin: number, currentHour: number, unit: string, tr: any) => {
    let parts = [];
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
       const heatText = tr.aiHeatIndex ? tr.aiHeatIndex.replace('{temp}', Math.round(displayFeelsLike)) : "";
       parts.push(heatText);
    }
    return parts.filter(Boolean);
};

const generateAlertsAndTips = (params: any, tr: any) => {
    const { code, windSpeed, temp, rainProb, isRaining, uvMax, isDay, aqiValue, currentCape, precipSum } = params;
    let alerts = [];
    let tips = [];
    const isSnow = (code >= 71 && code <= 77) || code === 85 || code === 86;

    if (code >= 95 || currentCape > ALERTS.CAPE_STORM) alerts.push({ type: tr.storm, msg: tr.alertStorm, level: 'high' });
    else if (isSnow) alerts.push({ type: tr.snow, msg: tr.alertSnow, level: 'warning' });
    else if ((code === 65 || code === 82 || precipSum > ALERTS.PRECIP_SUM_HIGH) && isRaining) alerts.push({ type: tr.rain, msg: tr.alertRain, level: 'warning' });

    if (windSpeed > WIND.STRONG) { alerts.push({ type: tr.wind, msg: tr.alertWindHigh, level: 'warning' }); tips.push(tr.tipWindbreaker); } 
    else if (windSpeed > WIND.EXTREME) alerts.push({ type: tr.wind, msg: tr.alertWindExtreme, level: 'high' });
    
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

export const generateAIPrediction = (current: any, daily: any, hourly: any, aqiValue: number, language: Language = 'ca', effectiveCode: number | null = null, reliability: any = null, unit: string = 'C') => {
    const tr = TRANSLATIONS[language] || TRANSLATIONS['ca'];
    if (!tr || !current || !daily || !hourly) return { text: "...", tips: [], alerts: [], confidence: "Error", confidenceLevel: "low" };
    
    try {
        const code = safeNum(effectiveCode !== null ? effectiveCode : current.weather_code, 0);
        const currentHour = new Date().getHours();
        
        const precipInstantanea = (current as any).minutely15 ? safeNum((current as any).minutely15[0]) : 0;
        const isRaining = (code >= 51 && code <= 67) || (code >= 80 && code <= 82) || precipInstantanea >= 0.1;

        let futureRainProb = 0;
        if (hourly && hourly.precipitation_probability) {
            const safeProbs = (hourly.precipitation_probability || []).slice(currentHour, currentHour + 12).map((v:any) => safeNum(v));
            futureRainProb = Math.max(...safeProbs, 0);
        } else {
            futureRainProb = safeNum(daily.precipitation_probability_max?.[0], 0);
        }
        
        let summaryParts: string[] = [];
        let alertsList: any[] = [];

        if (isRaining) {
            const precipNext15 = (current as any).minutely15 ? safeNum((current as any).minutely15[1]) : 0;
            summaryParts = analyzePrecipitation(isRaining, precipInstantanea, code, precipNext15, tr);
        } else {
            summaryParts = analyzeSky(code, safeNum(current.is_day, 1), currentHour, safeNum(current.visibility, 10000), futureRainProb, safeNum(current.cloud_cover, 0), tr, alertsList);
        }

        if (safeNum(current.wind_speed_10m) > WIND.MODERATE) {
            summaryParts.push(current.wind_speed_10m > WIND.STRONG ? tr.aiWindStrong : tr.aiWindMod);
        }

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
            code, windSpeed: safeNum(current.wind_speed_10m), temp: safeNum(current.temperature_2m), 
            rainProb: futureRainProb, isRaining, uvMax, 
            isDay: safeNum(current.is_day, 1), aqiValue: safeNum(aqiValue), 
            currentCape, precipSum
        }, tr);

        let confidenceText = tr.aiConfidence; 
        let confidenceLevel = 'high';
        if (reliability) {
            if (reliability.level === 'low') { confidenceLevel = 'low'; confidenceText = tr.aiConfidenceLow; } 
            else if (reliability.level === 'medium') { confidenceLevel = 'medium'; confidenceText = tr.aiConfidenceMod; }
        }

        const finalString = summaryParts.filter(Boolean).join("").replace(/\s+/g, ' ');
        return { text: finalString, tips: alertsAndTips.tips, confidence: confidenceText, confidenceLevel, alerts: [...alertsList, ...alertsAndTips.alerts] };

    } catch (error) {
        console.error("AI Generation Error:", error);
        return { text: tr.aiSummaryClear, tips: [], alerts: [], confidence: "Error", confidenceLevel: "low" };
    }
};

// ==========================================
// 3. DETECCIÓ INTEL·LIGENT (TESTS PASSATS)
// ==========================================

export const getRealTimeWeatherCode = (
    current: any, 
    minutelyPrecipData: number[], 
    prob: number = 0, 
    freezingLevel: number = 2500, 
    elevation: number = 0
): number => {
    if (!current) return 0;
    
    // 1. Dades Segures
    let code = safeNum(current.weather_code, 0);
    const temp = safeNum(current.temperature_2m, 15);
    const visibility = safeNum(current.visibility, 10000);
    const humidity = safeNum(current.relative_humidity_2m, 50);

    // 2. Càlcul Precipitació Instantània (Radar)
    const precipInstantanea = minutelyPrecipData && minutelyPrecipData.length > 0 
        ? Math.max(...minutelyPrecipData.slice(0, 2).map(v => safeNum(v, 0))) 
        : 0;

    const freezingDist = freezingLevel - elevation;
    
    // --- LÒGICA DE NEU ---
    const isColdEnoughForSnow = temp <= 1 || (temp <= 4 && freezingDist < 300);

    if (isColdEnoughForSnow) {
        const isRainCode = (code >= 51 && code <= 67) || (code >= 80 && code <= 82) || (code >= 95);
        if (isRainCode) {
            if (code === 65 || code === 82 || code === 67 || code >= 95) return 75; 
            if (code === 63 || code === 81 || code === 55 || code === 57) return 73; 
            return 71; 
        }
        if (precipInstantanea > 0) {
            if (precipInstantanea > PRECIPITATION.HEAVY) return 75; 
            if (precipInstantanea >= 0.5) return 73; 
            return 71; 
        }
        if ((code >= 71 && code <= 77) || code === 85 || code === 86) return code;
    }
    
    // --- LÒGICA DE BOIRA ---
    const isFogCode = code === 45 || code === 48;
    const isLowVisibility = visibility < 2000; 

    if ((isFogCode || isLowVisibility) && precipInstantanea < 0.1) {
        if (visibility < 1000) return 45; 
        if (isFogCode) return code;
    }

    // --- LÒGICA DE PLUJA FORÇADA PEL RADAR ---
    if (precipInstantanea >= PRECIPITATION.LIGHT) { // >0.1mm
        if (code >= 95) return code; 

        if (precipInstantanea > PRECIPITATION.EXTREME) code = 81;
        else if (precipInstantanea > PRECIPITATION.HEAVY) code = 65; 
        else if (precipInstantanea >= 0.7) code = 63; 
        else {
            const isRainCode = (code >= 51 && code <= 67) || (code >= 80 && code <= 82);
            if (!isRainCode) code = precipInstantanea < 0.3 ? 51 : 61; 
        }
    } 
    // --- INFERÈNCIA PER HUMITAT ---
    else {
        if (code < 45 && prob > 60 && humidity > 85) {
            code = isColdEnoughForSnow ? 71 : 51; 
        }
    }

    return code;
};

export const isAromeSupported = (lat: number, lon: number): boolean => {
    if (!lat || !lon) return false;
    const MIN_LAT = 38.0, MAX_LAT = 53.0, MIN_LON = -8.0, MAX_LON = 12.0; 
    return (lat >= MIN_LAT && lat <= MAX_LAT && lon >= MIN_LON && lon <= MAX_LON);
};

export const prepareContextForAI = (current: any, daily: any, hourly: any) => {
    if (!current || !daily || !hourly || !hourly.time) return null;

    const currentIsoTime = current.time; 
    let startIndex = hourly.time.findIndex((t: string) => t === currentIsoTime);

    if (startIndex === -1 && currentIsoTime) {
         const currentHourStr = currentIsoTime.slice(0, 13); 
         startIndex = hourly.time.findIndex((t: string) => t.startsWith(currentHourStr));
    }
    
    startIndex = startIndex === -1 ? 0 : startIndex;

    const getNext4h = (key: string) => {
        const data = hourly[key];
        if (!Array.isArray(data)) return [];
        return data.slice(startIndex, startIndex + 4).map((v:any) => safeNum(v));
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

// ==========================================
// 4. FUSIÓ DE MODELS (NORMALITZACIÓ DEFINITIVA)
// ==========================================

export const injectHighResModels = (baseData: ExtendedWeatherData, highResData: any): ExtendedWeatherData => {
    if (!baseData) return baseData;
    const target = typeof structuredClone === 'function' ? structuredClone(baseData) : JSON.parse(JSON.stringify(baseData)); 
    const source = highResData;
    const masterTimeLength = target.hourly?.time?.length || 0;

    if (target.hourly && masterTimeLength > 0) {
        Object.keys(target.hourly).forEach(key => {
            if (key === 'time') return;
            const arr = target.hourly[key];
            if (Array.isArray(arr)) {
                while (arr.length < masterTimeLength) arr.push(null);
            }
        });
    }

    if (!source) return target;

    const CURRENT_FIELDS_TO_OVERWRITE = [
        'temperature_2m', 'relative_humidity_2m', 'apparent_temperature', 'dew_point_2m',
        'is_day', 'precipitation', 'rain', 'showers', 'snowfall', 'weather_code',
        'cloud_cover', 'cloud_cover_low', 'cloud_cover_mid', 'cloud_cover_high',
        'pressure_msl', 'surface_pressure',
        'wind_speed_10m', 'wind_direction_10m', 'wind_gusts_10m'
    ];

    if (source.current && target.current) {
        CURRENT_FIELDS_TO_OVERWRITE.forEach(k => {
             if (source.current[k] != null && !isNaN(Number(source.current[k]))) {
                 target.current[k] = source.current[k];
             }
        });
        target.current.source = 'AROME HD'; 
    }

    const HOURLY_FIELDS = [
        'temperature_2m', 'relative_humidity_2m', 'dew_point_2m', 'apparent_temperature',
        'precipitation', 'weather_code', 'pressure_msl', 'surface_pressure',
        'cloud_cover', 'cloud_cover_low', 'cloud_cover_mid', 'cloud_cover_high',
        'wind_speed_10m', 'wind_direction_10m', 'wind_gusts_10m',
        'cape', 'freezing_level_height', 'visibility', 'is_day', 'uv_index'
    ];

    if (source.hourly && target.hourly && target.hourly.time) {
        const globalTimeIndexMap = new Map();
        target.hourly.time.forEach((t: string, i: number) => globalTimeIndexMap.set(t, i));

        (source.hourly.time || []).forEach((timeValue: string, sourceIndex: number) => {
            const globalIndex = globalTimeIndexMap.get(timeValue);
            
            if (globalIndex !== undefined) {
                const sH = source.hourly;
                const tH = target.hourly;
                
                HOURLY_FIELDS.forEach(field => {
                    const val = sH[field]?.[sourceIndex];
                    if (val != null && !isNaN(val)) {
                         if (!tH[field]) tH[field] = new Array(masterTimeLength).fill(null);
                         tH[field][globalIndex] = val;
                    }
                });

                const aromePrecip = sH['precipitation']?.[sourceIndex];
                if (aromePrecip >= 0.1) {
                    if (!tH['precipitation_probability']) tH['precipitation_probability'] = new Array(masterTimeLength).fill(0);
                    const currentProb = tH['precipitation_probability'][globalIndex] || 0;
                    if (currentProb < 50) {
                        tH['precipitation_probability'][globalIndex] = Math.max(currentProb, 70);
                    }
                }
            }
        });
    }

    return target;
};

// ==========================================
// 5. NORMALITZADOR DE DADES (RESTAURAT I NECESSARI PER BUILD)
// ==========================================

export const normalizeModelData = (data: any): ExtendedWeatherData => {
    if (!data || !data.current) return data;
    
    const result: any = { 
        current: { ...data.current }, 
        hourly: { ...data.hourly }, 
        daily: { ...data.daily }, 
        hourlyComparison: { ecmwf: [], gfs: [], icon: [] }, 
        dailyComparison: { ecmwf: {}, gfs: {}, icon: {} } 
    };
    
    Object.keys(data.daily || {}).forEach(key => {
        if (key.includes('_best_match')) {
            const cleanKey = key.split('_best_match')[0];
            result.daily[cleanKey] = data.daily[key]; 
        } else {
            let model = null;
            if (key.includes('_ecmwf_')) model = 'ecmwf';
            else if (key.includes('_gfs_')) model = 'gfs';
            else if (key.includes('_icon_')) model = 'icon';

            if (model) {
                const cleanKey = key.split(`_${model}_`)[0];
                result.dailyComparison[model][cleanKey] = data.daily[key];
            }
        }
    });

    const timeLength = data.hourly?.time?.length || 0;
    ['ecmwf', 'gfs', 'icon'].forEach(m => {
        result.hourlyComparison[m] = Array.from({ length: timeLength }, () => ({}));
    });

    Object.keys(data.hourly || {}).forEach(key => {
        if (key.includes('_best_match')) {
            const cleanKey = key.split('_best_match')[0];
            result.hourly[cleanKey] = data.hourly[key];
        } else {
            let model = null;
            if (key.includes('_ecmwf_')) model = 'ecmwf';
            else if (key.includes('_gfs_')) model = 'gfs';
            else if (key.includes('_icon_')) model = 'icon';
            
            if (model) {
                const cleanKey = key.split(`_${model}_`)[0];
                const values = data.hourly[key];
                for (let i = 0; i < Math.min(values.length, timeLength); i++) {
                    result.hourlyComparison[model][i][cleanKey] = values[i];
                }
            }
        }
    });

    Object.keys(data.current || {}).forEach(key => {
        if (key.includes('_best_match')) {
            const cleanKey = key.split('_best_match')[0];
            result.current[cleanKey] = data.current[key];
        }
    });

    return result;
};

// ==========================================
// 6. CÀLCUL DE FIABILITAT (CORREGIT)
// ==========================================

export const calculateReliability = (dailyBest: any, dailyGFS: any, dailyICON: any, dayIndex: number = 0) => {
  // Si falta algun model per comparar, no podem dir que la fiabilitat és alta.
  if (!dailyGFS || !dailyICON || !dailyBest) {
      return { level: 'medium', type: 'general', value: 0 }; 
  }
  
  // 1. Consens de Temperatura
  const t1 = safeNum(dailyBest.temperature_2m_max?.[dayIndex]);
  const t2 = safeNum(dailyGFS.temperature_2m_max?.[dayIndex]);
  const t3 = safeNum(dailyICON.temperature_2m_max?.[dayIndex]);
  const diffTemp = Math.max(t1, t2, t3) - Math.min(t1, t2, t3);
  
  // 2. Consens de Precipitació
  const p1 = safeNum(dailyBest.precipitation_sum?.[dayIndex]);
  const p2 = safeNum(dailyGFS.precipitation_sum?.[dayIndex]);
  const p3 = safeNum(dailyICON.precipitation_sum?.[dayIndex]);
  const diffPrecip = Math.max(p1, p2, p3) - Math.min(p1, p2, p3);

  // LÒGICA DE COLORS (CORREGIDA PER ALS TESTS)
  
  // VERMELL: Molta discrepància
  if (diffTemp > 5) {
      return { level: 'low', type: 'temp', value: diffTemp.toFixed(1) };
  }
  if (diffPrecip > 10) {
      return { level: 'low', type: 'precip', value: diffPrecip.toFixed(1) };
  }
  
  // GROC: Discrepància moderada
  if (diffTemp > 2 || diffPrecip > 3) {
      return { level: 'medium', type: 'divergent', value: 0 };
  }
  
  // VERD: Consens
  return { level: 'high', type: 'ok', value: 0 };
};