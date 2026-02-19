// src/utils/aiContext.ts
import { TRANSLATIONS, Language } from '../translations';
import { WEATHER_THRESHOLDS } from '../constants/weatherConfig';
import { 
    TranslationMap, 
    Alert, 
    StrictCurrentWeather, 
    StrictDailyWeather, 
    StrictHourlyWeather, 
    AIPredictionResult, 
    ReliabilityResult 
} from '../types/weatherLogicTypes';
import { safeNum } from './physics';

const { PRECIPITATION, WIND, TEMP, ALERTS, HUMIDITY } = WEATHER_THRESHOLDS;

// ==========================================
// HELPERS
// ==========================================

// 1. CORRECCIÓ PLUJA: Lògica centralitzada i llindar a 0.2mm
const calculateIsRaining = (code: number, precipAmount: number) => {
    const isRainCode = (code >= 51 && code <= 67) || (code >= 80 && code <= 82) || (code >= 95 && precipAmount > 0);
    return isRainCode || precipAmount >= 0.2;
};

// 2. CORRECCIÓ HORÀRIA: Obtenir l'hora real de la ubicació (no del sistema)
const getLocationHour = (timeIso: string): number => {
    if (!timeIso) return new Date().getHours();
    try {
        return new Date(timeIso).getHours();
    } catch {
        return new Date().getHours();
    }
};

// ==========================================
// LOGICA IA I PREDICCIONS
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
        // CORRECCIÓ: Usem l'hora de la ubicació, no la del sistema
        const currentHour = getLocationHour(current.time);
        const code = safeNum(effectiveCode !== null ? effectiveCode : current.weather_code, 0);
        
        const minutely15 = current.minutely15 || [];
        const precipInstantanea = safeNum(minutely15[0]);
        const precipNext15 = safeNum(minutely15[1]);
        
        // CORRECCIÓ: Usem la funció centralitzada (amb llindar 0.2mm)
        const isRaining = calculateIsRaining(code, precipInstantanea);

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
        // [FIX] Especifiquem el tipus estrictament per complir amb l'AIPredictionResult
        let confidenceLevel: 'low' | 'medium' | 'high' = 'high';
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

    // CORRECCIÓ: Usem la lògica UNIFICADA també per a Gemini (0.2mm)
    const code = safeNum(current.weather_code);
    const precipAmount = safeNum(current.precipitation) + safeNum(current.rain) + safeNum(current.showers);
    const isActuallyRaining = calculateIsRaining(code, precipAmount);

    return {
        timestamp: current.time,
        location: { 
            elevation: safeNum(current.elevation || daily.elevation, 0)
        },
        current: {
            temp: safeNum(current.temperature_2m),
            feels_like: safeNum(current.apparent_temperature),
            is_raining: isActuallyRaining, 
            wind_speed: safeNum(current.wind_speed_10m),
            // CORRECCIÓ: Afegim ràfegues de vent
            wind_gusts: safeNum(current.wind_gusts_10m),
            weather_code: safeNum(current.weather_code),
            humidity: safeNum(current.relative_humidity_2m),
            // CORRECCIÓ: Afegim is_day
            is_day: safeNum(current.is_day, 1) === 1
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
            max_rain_prob_4h: Math.max(...getNext4h('precipitation_probability')),
            rain_prob: getNext4h('precipitation_probability'),
            precip_vol: getNext4h('precipitation'), 
            wind: getNext4h('wind_speed_10m'),
            gusts: getNext4h('wind_gusts_10m'),
            snow_depth: getNext4h('snow_depth') 
        }
    };
};