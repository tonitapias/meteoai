// src/utils/weatherLogic.js
import { TRANSLATIONS } from '../constants/translations';
import { WEATHER_THRESHOLDS } from '../constants/weatherConfig';

const { PRECIPITATION, WIND, TEMP, RELIABILITY, ALERTS, HUMIDITY } = WEATHER_THRESHOLDS;

// --- FUNCIONS AUXILIARS ---

export const getShiftedDate = (baseDate, timezoneOrOffset) => {
  if (typeof timezoneOrOffset === 'number') {
      const utcTimestamp = baseDate.getTime() + (baseDate.getTimezoneOffset() * 60000);
      const targetTimestamp = utcTimestamp + (timezoneOrOffset * 1000);
      return new Date(targetTimestamp);
  }
  if (!timezoneOrOffset) return baseDate;
  try {
      const targetTimeStr = baseDate.toLocaleString("en-US", { timeZone: timezoneOrOffset });
      return new Date(targetTimeStr);
  } catch (e) {
      console.warn("Timezone invàlid, retornant hora local", e);
      return baseDate;
  }
};

export const calculateDewPoint = (T, RH) => {
  const a = 17.27;
  const b = 237.7;
  const safeRH = Math.max(RH, 1);
  const alpha = ((a * T) / (b + T)) + Math.log(safeRH / 100.0);
  return (b * alpha) / (a - alpha);
};

// --- NORMALITZACIÓ ---
export const normalizeModelData = (data) => {
     if (!data || !data.current) return data;
     
     const result = { 
         current: { ...data.current }, 
         hourly: { ...data.hourly }, 
         daily: { ...data.daily }, 
         hourlyComparison: { gfs: [], icon: [] }, 
         dailyComparison: { gfs: {}, icon: {} } 
     };
     
     const modelSuffixRegex = /(_best_match|_ecmwf\w*|_noaa\w*|_meteofrance\w*|_dwd\w*|_jma\w*|_gem\w*)/g;

     ['current', 'daily', 'hourly'].forEach(section => {
         if (!data[section]) return;
         
         Object.keys(data[section]).forEach(key => {
            if (key.includes('_gfs_') || key.includes('_icon_')) return;
            if (key.match(modelSuffixRegex)) {
                const cleanKey = key.replace(modelSuffixRegex, '');
                if (!result[section][cleanKey]) {
                    result[section][cleanKey] = data[section][key];
                }
            }
         });
     });

     Object.keys(data.daily || {}).forEach(key => {
        if (key.includes('_gfs_')) {
           const cleanKey = key.split('_gfs_')[0]; 
           result.dailyComparison.gfs[cleanKey] = data.daily[key];
        } else if (key.includes('_icon_')) {
           const cleanKey = key.split('_icon_')[0];
           result.dailyComparison.icon[cleanKey] = data.daily[key];
        }
     });

     const timeLength = data.hourly?.time?.length || 0;
     result.hourlyComparison.gfs = Array.from({ length: timeLength }, () => ({}));
     result.hourlyComparison.icon = Array.from({ length: timeLength }, () => ({}));

     Object.keys(data.hourly || {}).forEach(key => {
        let model = null;
        let cleanKey = null;
        if (key.includes('_gfs_')) {
            model = 'gfs';
            cleanKey = key.split('_gfs_')[0];
        } else if (key.includes('_icon_')) {
            model = 'icon';
            cleanKey = key.split('_icon_')[0];
        }
        if (model && cleanKey) {
            const values = data.hourly[key];
            const safeLength = Math.min(values.length, timeLength);
            for (let i = 0; i < safeLength; i++) {
                if (result.hourlyComparison[model][i]) {
                    result.hourlyComparison[model][i][cleanKey] = values[i];
                }
            }
        }
     });

     return { ...data, ...result };
};

// --- FUNCIÓ MODIFICADA FINAL ---
export const getRealTimeWeatherCode = (current, minutelyPrecipData, prob = 0, freezingLevel = 2500, elevation = 0) => {
    if (!current) return 0;
    
    let code = Number(current.weather_code);
    const temp = Number(current.temperature_2m);
    
    const precipInstantanea = minutelyPrecipData && minutelyPrecipData.length > 0 
        ? Math.max(...minutelyPrecipData.slice(0, 2).filter(v => v != null)) 
        : 0;

    const freezingDist = freezingLevel - elevation;
    
    // 1. NEU
    const isColdEnoughForSnow = temp <= 1 || (temp <= 4 && freezingDist < 300);

    if (isColdEnoughForSnow) {
        const isRainCode = (code >= 51 && code <= 67) || (code >= 80 && code <= 82);
        
        if (isRainCode) {
            if (code === 65 || code === 82 || code === 67) return 75; 
            if (code === 63 || code === 81 || code === 55 || code === 57) return 73; 
            return 71; 
        }

        if (precipInstantanea > 0) {
            if (precipInstantanea > PRECIPITATION.HEAVY) code = 75; 
            else if (precipInstantanea >= 0.5) code = 73; 
            else code = 71; 
            return code; 
        }
        
        if ((code >= 71 && code <= 77) || code === 85 || code === 86) {
            return code;
        }
    }
    
    // --- 2. BOIRA ---
    const visibility = current.visibility; 
    const isFogCode = code === 45 || code === 48;
    const hasVisibilityData = visibility !== undefined && visibility !== null; 
    const isLowVisibility = hasVisibilityData && visibility < 2000; 

    if ((isFogCode || isLowVisibility) && precipInstantanea < 0.5) {
        if (hasVisibilityData && visibility < 1000) return 45;
        if (isFogCode) return code;
    }

    // --- 3. RADAR DIU PLUJA (i no fa fred) ---
    if (precipInstantanea >= PRECIPITATION.LIGHT) {
        
        // CORRECCIÓ CLAU: Si ja era tempesta (95+), la respectem encara que plogui molt.
        // Així no perdem la icona del llamp.
        if (code >= 95) {
             return code; 
        }

        if (precipInstantanea > PRECIPITATION.EXTREME) code = 81; 
        else if (precipInstantanea > PRECIPITATION.HEAVY) code = 65; 
        else if (precipInstantanea >= 0.7) code = 63; 
        else {
            const isRainCode = (code >= 51 && code <= 67) || (code >= 80 && code <= 82);
            if (!isRainCode) {
                code = precipInstantanea < 0.3 ? 51 : 61; 
            }
        }
    } 
    // --- 4. MODEL DIU PLUJA O S'INFEREIX PER HUMITAT ---
    else {
        if ((code >= 51 && code <= 67) || (code >= 80 && code <= 82)) {
            // Mantenim pluja
        }
        else if (code < 45 && prob > 60 && current.relative_humidity_2m > 85) {
            code = isColdEnoughForSnow ? 71 : 51; 
        }
    }

    return code;
};

// --- GENERACIÓ DE TEXT IA ---
export const generateAIPrediction = (current, daily, hourly, aqiValue, language = 'ca', effectiveCode = null, reliability = null, unit = 'C') => {
    const tr = TRANSLATIONS[language] || TRANSLATIONS['ca'];
    if (!tr) return { text: "", tips: [], alerts: [], confidence: "Error", confidenceLevel: "low" };
    
    const code = effectiveCode !== null ? effectiveCode : current.weather_code;
    
    const feelsLike = current.apparent_temperature;
    const temp = current.temperature_2m;
    const humidity = current.relative_humidity_2m;
    const windSpeed = current.wind_speed_10m;
    const isDay = current.is_day;
    const visibility = current.visibility; 
    const currentHour = new Date().getHours();
    
    const precipInstantanea = current.minutely15 ? current.minutely15[0] : 0;
    const precipNext15 = current.minutely15 ? current.minutely15[1] : 0; 

    let futureRainProb = 0;
    if (hourly && hourly.precipitation_probability) {
        const nextHours = hourly.precipitation_probability.slice(currentHour, currentHour + 12);
        futureRainProb = Math.max(...nextHours, 0);
    } else {
        futureRainProb = daily.precipitation_probability_max[0];
    }
    const rainProb = futureRainProb;
    const precipSum = daily.precipitation_sum && daily.precipitation_sum[0];
    const uvMax = daily.uv_index_max[0];
    const currentCape = hourly.cape ? hourly.cape[currentHour] || 0 : 0;
    
    let summaryParts = [];
    let tips = [];
    let alerts = []; 
    let confidenceText = tr.aiConfidence; 
    let confidenceLevel = 'high';

    if (reliability) {
        if (reliability.level === 'low') {
            confidenceLevel = 'low';
            confidenceText = tr.aiConfidenceLow || "Divergència Alta";
        } else if (reliability.level === 'medium') {
            confidenceLevel = 'medium';
            confidenceText = tr.aiConfidenceMod || "Divergència Moderada";
        }
    }

    const isRaining = (code >= 51 && code <= 67) || (code >= 80 && code <= 82) || precipInstantanea >= 0.1;

    if (isRaining) {
        if (precipInstantanea > PRECIPITATION.HEAVY || code === 65 || code === 67 || code === 82) {
             summaryParts.push(tr.aiRainHeavy || "Cau un bon xàfec."); 
        } 
        else if (precipInstantanea >= 0.7 || code === 63 || code === 81 || code === 53 || code === 55) {
             summaryParts.push(tr.aiRainMod || "Està plovent."); 
        }
        else {
             summaryParts.push(tr.aiRainLight || "Està plovent feblement.");
        }

        if (precipInstantanea > 0) {
            if (precipNext15 < PRECIPITATION.LIGHT) summaryParts.push(" " + (tr.aiRainStopping || "Pararà aviat."));
            else if (precipNext15 > precipInstantanea * PRECIPITATION.INTENSIFY_FACTOR) summaryParts.push(" " + (tr.aiRainMore || "S'intensificarà."));
        }
    } else {
        if (isDay) summaryParts.push(currentHour < 12 ? tr.aiIntroMorning : tr.aiIntroAfternoon);
        else summaryParts.push(tr.aiIntroNight);

        if (code === 0 || code === 1) summaryParts.push(tr.aiSummaryClear);
        else if (code === 2) summaryParts.push(isDay ? tr.aiSummaryVariable : tr.aiSummaryVariableNight);
        else if (code === 3) summaryParts.push(tr.aiSummaryOvercast); 
        else if (code === 45 || code === 48) {
            summaryParts.push(tr.aiSummaryFog || "Hi ha boira."); 
            if (visibility !== undefined && visibility !== null && visibility < 500) {
                 alerts.push({ type: "VIS", msg: tr.alertVisibility, level: 'warning' });
            }
        }
        else if ((code >= 71 && code <= 77) || code === 85 || code === 86) {
             summaryParts.push(tr.aiSummarySnow || "S'esperen nevades.");
        }
        else if (code > 48) summaryParts.push(tr.aiSummaryCloudy);
        
        if (rainProb > 40 && !isRaining) summaryParts.push(tr.aiRainChance);
        else if (current.cloud_cover < 30 && code <= 2) summaryParts.push(tr.aiRainNone);
    }

    if (windSpeed > WIND.STRONG) summaryParts.push(tr.aiWindStrong); 
    else if (windSpeed > WIND.MODERATE) summaryParts.push(tr.aiWindMod);
    
    if (feelsLike <= TEMP.FREEZING) summaryParts.push(tr.aiTempFreezing);
    else if (feelsLike > TEMP.FREEZING && feelsLike < TEMP.COLD) summaryParts.push(tr.aiTempCold);
    else if (feelsLike >= TEMP.COLD && feelsLike < TEMP.MILD) {
        if (currentHour >= 15 && daily.temperature_2m_min[0] < TEMP.COLD) summaryParts.push(tr.aiTempCold); 
        else summaryParts.push(tr.aiTempCool); 
    }
    else if (feelsLike >= TEMP.MILD && feelsLike < TEMP.WARM) summaryParts.push(tr.aiTempMild);
    else if (feelsLike >= TEMP.WARM && feelsLike < TEMP.HOT) summaryParts.push(tr.aiTempWarm);
    else if (feelsLike >= TEMP.HOT) summaryParts.push(tr.aiTempHot);

    if (temp > TEMP.WARM && humidity > HUMIDITY.HIGH) {
       let displayFeelsLike = feelsLike;
       if (unit === 'F' || unit === 'imperial') {
           displayFeelsLike = (feelsLike * 9/5) + 32;
       }
       const heatText = tr.aiHeatIndex ? tr.aiHeatIndex.replace('{temp}', Math.round(displayFeelsLike)) : "";
       summaryParts.push(heatText);
    }

    const isSnow = (code >= 71 && code <= 77) || code === 85 || code === 86;
    if (code >= 95 || currentCape > ALERTS.CAPE_STORM) alerts.push({ type: tr.storm, msg: tr.alertStorm, level: 'high' });
    else if (isSnow) alerts.push({ type: tr.snow, msg: tr.alertSnow, level: 'warning' });
    else if ((code === 65 || code === 82 || precipSum > ALERTS.PRECIP_SUM_HIGH) && isRaining) alerts.push({ type: tr.rain, msg: tr.alertRain, level: 'warning' });

    if (windSpeed > WIND.STRONG) { alerts.push({ type: tr.wind, msg: tr.alertWindHigh, level: 'warning' }); tips.push(tr.tipWindbreaker); } 
    else if (windSpeed > WIND.EXTREME) alerts.push({ type: tr.wind, msg: tr.alertWindExtreme, level: 'high' });
    
    if (temp < TEMP.FREEZING) { alerts.push({ type: tr.cold, msg: tr.alertColdExtreme, level: 'high' }); tips.push(tr.tipCoat, tr.tipThermal); } 
    else if (temp < TEMP.COLD) { tips.push(tr.tipCoat); if (temp < 5) tips.push(tr.tipLayers); } 
    else if (temp >= TEMP.COLD && temp < 16) { tips.push(tr.tipLayers); }
    
    if (temp > TEMP.EXTREME_HEAT) { alerts.push({ type: tr.heat, msg: tr.alertHeatExtreme, level: 'high' }); tips.push(tr.tipHydration, tr.tipSunscreen); } 
    else if (temp > 30) { alerts.push({ type: tr.heat, msg: tr.alertHeatHigh, level: 'warning' }); tips.push(tr.tipHydration); }

    if (rainProb > 40 || isRaining) tips.push(tr.tipUmbrella);
    if (uvMax > ALERTS.UV_HIGH && isDay) { if(uvMax >= ALERTS.UV_EXTREME) alerts.push({ type: tr.sun, msg: tr.alertUV, level: 'high' }); tips.push(tr.tipSunscreen); }
    if (aqiValue > ALERTS.AQI_BAD) alerts.push({ type: tr.aqi, msg: tr.alertAir, level: 'warning' });

    if (tips.length === 0) tips.push(tr.tipCalm);
    tips = [...new Set(tips)].slice(0, 4);

    const finalString = summaryParts.join("").replace(/\s+/g, ' ');

    return { text: finalString, tips, confidence: confidenceText, confidenceLevel, alerts };
 };

export const getMoonPhase = (date) => {
  let year = date.getFullYear();
  let month = date.getMonth() + 1;
  let day = date.getDate();
  if (month < 3) { year--; month += 12; }
  const c = 365.25 * year;
  const e = 30.6 * month;
  const jd = c + e + day - 694039.09; 
  let phase = jd / 29.5305882; 
  phase -= Math.floor(phase); 
  return phase; 
};

export const calculateReliability = (dailyBest, dailyGFS, dailyICON, dayIndex = 0) => {
  if (!dailyGFS || !dailyICON || !dailyBest) return null;
  const t1 = dailyBest.temperature_2m_max?.[dayIndex];
  const t2 = dailyGFS.temperature_2m_max?.[dayIndex];
  const t3 = dailyICON.temperature_2m_max?.[dayIndex];
  const getRain = (source) => source?.precipitation_probability_max?.[dayIndex] ?? 0;
  const r1 = getRain(dailyBest);
  const r2 = getRain(dailyGFS);
  const r3 = getRain(dailyICON);
  const temps = [t1, t2, t3].filter(v => v !== undefined && v !== null && !isNaN(v));
  const rains = [r1, r2, r3];
  
  if (temps.length < 2) return { level: 'high', type: 'ok', value: 0 };

  const diffTemp = Math.max(...temps) - Math.min(...temps);
  const diffRain = Math.max(...rains) - Math.min(...rains);
  let level = 'high'; let type = 'ok'; let value = 0;
  if (diffTemp >= RELIABILITY.TEMP_DIFF_HIGH || diffRain >= RELIABILITY.RAIN_DIFF_HIGH) {
    level = 'low'; if (diffRain >= RELIABILITY.RAIN_DIFF_HIGH) { type = 'rain'; value = Math.round(diffRain); } else { type = 'temp'; value = diffTemp.toFixed(1); }
  } else if (diffTemp >= RELIABILITY.TEMP_DIFF_MED || diffRain >= RELIABILITY.RAIN_DIFF_MED) {
    level = 'medium'; type = 'general';
  }
  return { level, type, value };
};

export const getWeatherLabel = (current, language) => {
  const tr = TRANSLATIONS[language] || TRANSLATIONS['ca'];
  if (!tr || !current) return "";
  const code = Number(current.weather_code);
  return tr.wmo[code] || "---";
};

// --- FUNCIÓ OBLIGATÒRIA PER AL MODE HÍBRID ---
export const isAromeSupported = (lat, lon) => {
    if (!lat || !lon) return false;
    
    // Rectangle aproximat Europa Occidental
    const MIN_LAT = 38.0; 
    const MAX_LAT = 53.0; 
    const MIN_LON = -8.0; 
    const MAX_LON = 12.0; 

    return (lat >= MIN_LAT && lat <= MAX_LAT && lon >= MIN_LON && lon <= MAX_LON);
};