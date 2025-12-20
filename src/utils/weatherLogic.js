import { TRANSLATIONS } from '../constants/translations';

// Calcula la data real segons la zona horària de la ciutat
export const getShiftedDate = (baseDate, timezone) => {
  if (!timezone) return baseDate;
  const targetTimeStr = baseDate.toLocaleString("en-US", { timeZone: timezone });
  return new Date(targetTimeStr);
};

export const calculateDewPoint = (T, RH) => {
  const a = 17.27;
  const b = 237.7;
  const safeRH = Math.max(RH, 1);
  const alpha = ((a * T) / (b + T)) + Math.log(safeRH / 100.0);
  return (b * alpha) / (a - alpha);
};

// FUNCIÓ ACTUALITZADA I MÉS ROBUSTA
export const normalizeModelData = (data) => {
     if (!data || !data.current) return data;
     
     // Inicialitzem l'estructura base
     const result = { 
         current: {}, 
         hourly: {}, 
         daily: {}, 
         hourlyComparison: { gfs: [], icon: [] }, 
         dailyComparison: { gfs: {}, icon: {} } 
     };
     
     const suffixRegex = /_best_match|_ecmwf_ifs4|_ecmwf_ifs025/g;

     // 1. Processar Current, Daily i Hourly (Dades Principals)
     // Copiem directament les dades principals netejant els sufixos ECMWF
     ['current', 'daily', 'hourly'].forEach(section => {
         if (!data[section]) return;
         
         Object.keys(data[section]).forEach(key => {
            // Si és una dada de comparativa (GFS/ICON), la saltem aquí, la processarem després
            if (key.includes('_gfs_seamless') || key.includes('_icon_seamless')) return;

            // Si té sufixos d'ECMWF o Best Match, els traiem
            if (key.match(suffixRegex)) {
                result[section][key.replace(suffixRegex, '')] = data[section][key];
            } else {
                // Si és una clau estàndard (ex: 'time', 'is_day'), la copiem tal qual
                result[section][key] = data[section][key];
            }
         });
     });

     // 2. Processar Comparatives (GFS i ICON)
     // Això evita errors si l'API canvia l'ordre de les claus
     
     // --- DAILY COMPARISON ---
     Object.keys(data.daily || {}).forEach(key => {
        if (key.includes('_gfs_seamless')) {
           result.dailyComparison.gfs[key.replace('_gfs_seamless', '')] = data.daily[key];
        } else if (key.includes('_icon_seamless')) {
           result.dailyComparison.icon[key.replace('_icon_seamless', '')] = data.daily[key];
        }
     });

     // --- HOURLY COMPARISON ---
     const timeLength = data.hourly?.time?.length || 0;
     
     // Inicialitzem arrays amb objectes buits per evitar "undefined"
     result.hourlyComparison.gfs = Array(timeLength).fill(null).map(() => ({}));
     result.hourlyComparison.icon = Array(timeLength).fill(null).map(() => ({}));

     Object.keys(data.hourly || {}).forEach(key => {
        if (key.includes('_gfs_seamless')) {
           const cleanKey = key.replace('_gfs_seamless', '');
           data.hourly[key].forEach((val, index) => {
               if (result.hourlyComparison.gfs[index]) {
                   result.hourlyComparison.gfs[index][cleanKey] = val;
               }
           });
        } 
        else if (key.includes('_icon_seamless')) {
            const cleanKey = key.replace('_icon_seamless', '');
            data.hourly[key].forEach((val, index) => {
               if (result.hourlyComparison.icon[index]) {
                   result.hourlyComparison.icon[index][cleanKey] = val;
               }
           });
        }
     });

     // Si per algun motiu no hem pogut processar res, tornem l'original per no trencar l'app
     if (Object.keys(result.current).length === 0) return data;
     
     // Fusionem amb l'original per seguretat (però prioritzant el nostre processat)
     return { ...data, ...result };
};

// Genera el text predictiu basat en regles expertes
export const generateAIPrediction = (current, daily, hourly, aqiValue, language = 'ca', forcedCode = null, reliability = null) => {
    const tr = TRANSLATIONS[language];
    const feelsLike = current.apparent_temperature;
    const temp = current.temperature_2m;
    const humidity = current.relative_humidity_2m;
    const windSpeed = current.wind_speed_10m;
    const code = forcedCode !== null ? forcedCode : current.weather_code;
    const precipSum = daily.precipitation_sum && daily.precipitation_sum[0];
    
    // Càlcul segur de precipitació minutal
    const precip15 = current.minutely15 ? current.minutely15.slice(0, 4).reduce((a, b) => a + (b || 0), 0) : 0;
    
    const uvMax = daily.uv_index_max[0];
    const isDay = current.is_day;
    const currentHour = new Date().getHours();
    
    const minTempToday = daily.temperature_2m_min ? daily.temperature_2m_min[0] : 10;

    let futureRainProb = 0;
    if (hourly && hourly.precipitation_probability) {
        const nextHours = hourly.precipitation_probability.slice(currentHour, currentHour + 12);
        futureRainProb = Math.max(...nextHours, 0);
    } else {
        futureRainProb = daily.precipitation_probability_max[0];
    }

    const rainProb = futureRainProb; 
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
        } else {
            // UPDATED: Usant nova clau de traducció
            confidenceText = tr.aiConsensus || "Consens de Models"; 
        }
    }

    if (currentHour >= 6 && currentHour < 12) summaryParts.push(tr.aiIntroMorning);
    else if (currentHour >= 12 && currentHour < 19) summaryParts.push(tr.aiIntroAfternoon);
    else if (currentHour >= 19 && currentHour < 22) summaryParts.push(tr.aiIntroEvening);
    else summaryParts.push(tr.aiIntroNight);

    const isSnow = (code >= 71 && code <= 77) || code === 85 || code === 86;
    
    // MODIFICAT: Prioritat total a la pluja al text de l'IA
    if (code >= 95) summaryParts.push(tr.aiSummaryStorm);
    else if (isSnow) summaryParts.push(tr.aiSummarySnow);
    else if (code >= 51 || precip15 > 0) { 
        summaryParts.push(tr.aiSummaryRain); 
    }
    else if (code === 0 || code === 1) summaryParts.push(tr.aiSummaryClear);
    else if (code === 2) summaryParts.push(isDay ? tr.aiSummaryVariable : tr.aiSummaryVariableNight);
    else if (code === 3) summaryParts.push(tr.aiSummaryOvercast); 
    else summaryParts.push(tr.aiSummaryCloudy); 

    if (windSpeed > 20) summaryParts.push(tr.aiWindMod);
    
    if (feelsLike <= 0) summaryParts.push(tr.aiTempFreezing);
    else if (feelsLike > 0 && feelsLike < 10) summaryParts.push(tr.aiTempCold);
    else if (feelsLike >= 10 && feelsLike < 18) {
        if (currentHour >= 15 && minTempToday < 10) {
            summaryParts.push(tr.aiTempCold); 
        } else {
            summaryParts.push(tr.aiTempCool); 
        }
    }
    else if (feelsLike >= 18 && feelsLike < 25) summaryParts.push(tr.aiTempMild);
    else if (feelsLike >= 25 && feelsLike < 32) summaryParts.push(tr.aiTempWarm);
    else if (feelsLike >= 32) summaryParts.push(tr.aiTempHot);

    if (temp > 25 && humidity > 65) {
       const heatText = tr.aiHeatIndex ? tr.aiHeatIndex.replace('{temp}', Math.round(feelsLike)) : "";
       summaryParts.push(heatText);
    }

    if (precip15 > 0.1) summaryParts.push(tr.aiRainExp);
    else if (rainProb < 20 && code < 50) {
        if (humidity >= 90) {
             summaryParts.push(tr.aiRainHumid);
        } else {
             if (current.cloud_cover > 70) {
                 // UPDATED: Usant nova clau de traducció
                 summaryParts.push(tr.aiCloudyNoRain || " No s'espera pluja.");
             } else {
                 summaryParts.push(tr.aiRainNone); 
             }
        }
    }
    else if (code < 50) {
        if (rainProb > 60) summaryParts.push(tr.aiRainChanceHigh);
        else summaryParts.push(tr.aiRainChance);
    }

    if (code >= 95 || currentCape > 2000) alerts.push({ type: tr.storm, msg: tr.alertStorm, level: 'high' });
    else if (isSnow) alerts.push({ type: tr.snow, msg: tr.alertSnow, level: 'warning' });
    else if (code === 65 || code === 82 || precipSum > 30) alerts.push({ type: tr.rain, msg: tr.alertRain, level: 'warning' });

    if (windSpeed > 50) {
      alerts.push({ type: tr.wind, msg: tr.alertWindHigh, level: 'warning' });
      tips.push(tr.tipWindbreaker);
    } else if (windSpeed > 80) alerts.push({ type: tr.wind, msg: tr.alertWindExtreme, level: 'high' });
    
    if (temp < 0) {
      alerts.push({ type: tr.cold, msg: tr.alertColdExtreme, level: 'high' });
      tips.push(tr.tipCoat, tr.tipThermal);
    } else if (temp < 10) { 
      tips.push(tr.tipCoat); 
      if (temp < 5) tips.push(tr.tipLayers);
    } else if (temp >= 10 && temp < 16) {
      if (currentHour >= 15 && minTempToday < 8) {
         tips.push(tr.tipCoat, tr.tipLayers);
      } else {
         tips.push(tr.tipLayers);
      }
    }
    
    if (temp > 35) {
       alerts.push({ type: tr.heat, msg: tr.alertHeatExtreme, level: 'high' });
       tips.push(tr.tipHydration, tr.tipSunscreen);
    } else if (temp > 30) {
       alerts.push({ type: tr.heat, msg: tr.alertHeatHigh, level: 'warning' });
       tips.push(tr.tipHydration);
    }

    if (rainProb > 40 || precip15 > 0.1) tips.push(tr.tipUmbrella);
    if (uvMax > 7 && isDay) {
       if(uvMax >= 10) alerts.push({ type: tr.sun, msg: tr.alertUV, level: 'high' });
       tips.push(tr.tipSunscreen);
    }
    if (aqiValue > 100) alerts.push({ type: tr.aqi, msg: tr.alertAir, level: 'warning' });

    if (tips.length === 0) tips.push(tr.tipCalm);
    tips = [...new Set(tips)].slice(0, 4);

    return { text: summaryParts.join(""), tips, confidence: confidenceText, confidenceLevel, alerts };
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

  const t1 = dailyBest.temperature_2m_max[dayIndex];
  const t2 = dailyGFS.temperature_2m_max[dayIndex];
  const t3 = dailyICON.temperature_2m_max[dayIndex];

  const getRain = (source) => source?.precipitation_probability_max?.[dayIndex] ?? 0;
  const r1 = getRain(dailyBest);
  const r2 = getRain(dailyGFS);
  const r3 = getRain(dailyICON);

  const temps = [t1, t2, t3].filter(v => v !== undefined && v !== null);
  const rains = [r1, r2, r3];

  const diffTemp = Math.max(...temps) - Math.min(...temps);
  const diffRain = Math.max(...rains) - Math.min(...rains);

  let level = 'high';
  let type = 'ok';
  let value = 0;

  if (diffTemp >= 4 || diffRain >= 40) {
    level = 'low';
    if (diffRain >= 40) { type = 'rain'; value = Math.round(diffRain); }
    else { type = 'temp'; value = diffTemp.toFixed(1); }
  } 
  else if (diffTemp >= 2.5 || diffRain >= 25) {
    level = 'medium';
    type = 'general';
  }

  return { level, type, value };
};

// --- ETIQUETA PRINCIPAL DEFINITIVA I SIMPLIFICADA ---
export const getWeatherLabel = (current, language) => {
  const tr = TRANSLATIONS[language];
  if (!tr || !current) return "";

  const code = Number(current.weather_code);
  const precip15 = current.minutely15 ? current.minutely15.slice(0, 4).reduce((a, b) => a + (b || 0), 0) : 0;
  
  // 1. PRIORITAT PLUJA SOBRE BOIRA:
  // Si cau aigua (>0), ignorem la boira i mostrem text de pluja.
  if ((code === 45 || code === 48) && precip15 > 0) {
      return tr.rainy; 
  }

  // 2. SIMPLIFICACIÓ:
  // Agrupem "Plugim feble/moderat/dens" (51, 53, 55) i "Pluja feble" (61) sota l'etiqueta única "Pluja".
  // Això fa l'app molt més clara per a l'usuari.
  if (code === 51 || code === 53 || code === 55 || code === 61) {
      return tr.rainy; 
  }

  return tr.wmo[code] || "---";
};