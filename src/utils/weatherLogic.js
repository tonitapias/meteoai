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


export const normalizeModelData = (data) => {
     if (!data || !data.current) return data;
     
     // 1. Estructura base segura clonant les dades originals
     const result = { 
         current: { ...data.current }, 
         hourly: { ...data.hourly }, 
         daily: { ...data.daily }, 
         hourlyComparison: { gfs: [], icon: [] }, 
         dailyComparison: { gfs: {}, icon: {} } 
     };
     
     // Regex per netejar els sufixos del model principal
     const mainSuffixRegex = /(_best_match|_ecmwf_ifs4|_ecmwf_ifs025|_ecmwf_aifs04)/g;

     // 2. Processar Dades Principals (Neteja de noms)
     ['current', 'daily', 'hourly'].forEach(section => {
         if (!data[section]) return;
         
         Object.keys(data[section]).forEach(key => {
            if (key.includes('_gfs_') || key.includes('_icon_')) return;

            if (key.match(mainSuffixRegex)) {
                const cleanKey = key.replace(mainSuffixRegex, '');
                result[section][cleanKey] = data[section][key];
            }
         });
     });

     // 3. Processar Comparatives (GFS i ICON)
     
     // --- DAILY COMPARISON ---
     Object.keys(data.daily || {}).forEach(key => {
        if (key.includes('_gfs_')) {
           const cleanKey = key.split('_gfs_')[0]; 
           result.dailyComparison.gfs[cleanKey] = data.daily[key];
        } else if (key.includes('_icon_')) {
           const cleanKey = key.split('_icon_')[0];
           result.dailyComparison.icon[cleanKey] = data.daily[key];
        }
     });

     // --- HOURLY COMPARISON ---
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

// Genera el text predictiu basat en regles expertes i TENDÈNCIA DE RADAR
export const generateAIPrediction = (current, daily, hourly, aqiValue, language = 'ca', forcedCode = null, reliability = null) => {
    const tr = TRANSLATIONS[language];
    
    // Dades bàsiques
    const feelsLike = current.apparent_temperature;
    const temp = current.temperature_2m;
    const humidity = current.relative_humidity_2m;
    const windSpeed = current.wind_speed_10m;
    const code = forcedCode !== null ? forcedCode : current.weather_code;
    
    // Dades avançades
    const precipSum = daily.precipitation_sum && daily.precipitation_sum[0];
    const uvMax = daily.uv_index_max[0];
    const isDay = current.is_day;
    const currentHour = new Date().getHours();
    const minTempToday = daily.temperature_2m_min ? daily.temperature_2m_min[0] : 10;
    
    // Dades de "Finestra" (Radar immediat)
    const precipInstantanea = current.minutely15 ? current.minutely15[0] : 0;
    const precipNext15 = current.minutely15 ? current.minutely15[1] : 0; // TENDÈNCIA

    // Suma dels pròxims 60 minuts (4 quarts d'hora)
    const precip1hSum = current.minutely15 ? current.minutely15.slice(0, 4).reduce((a, b) => a + (b || 0), 0) : 0;

    // Càlcul de probabilitat futura (Models)
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
    
    // --- 1. FIABILITAT ---
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
            confidenceText = tr.aiConsensus || "Consens de Models"; 
        }
    }

    // --- 2. SALUTACIÓ ---
    if (isDay) {
        if (currentHour < 12) summaryParts.push(tr.aiIntroMorning);
        else summaryParts.push(tr.aiIntroAfternoon);
    } else {
        if (currentHour >= 6 && currentHour < 10) summaryParts.push(tr.aiIntroMorning); 
        else if (currentHour >= 18 && currentHour < 22) summaryParts.push(tr.aiIntroEvening);
        else summaryParts.push(tr.aiIntroNight);
    }

    const isSnow = (code >= 71 && code <= 77) || code === 85 || code === 86;
    const isRainCode = (code >= 51 && code <= 67) || (code >= 80 && code <= 82);

    // --- 3. ESTAT DEL CEL I PRECIPITACIÓ (Amb Lògica Predictiva) ---
    
    // CAS A: PLUJA REAL DETECTADA PEL RADAR ARA MATEIX
    if (precipInstantanea > 0) {
        // Intensitat actual
        if (precipInstantanea < 0.2) {
            summaryParts.push(tr.aiRainLight); 
        } else if (precipInstantanea > 2.0) {
            summaryParts.push(tr.aiRainHeavy); 
        } else {
            if (code === 45 || code === 48) {
                summaryParts.push(tr.aiSummaryRainFog || tr.aiSummaryRain);
            } else {
                summaryParts.push(tr.aiSummaryRain);
            }
        }

        // TENDÈNCIA (NOWCASTING): Què passarà en 15 minuts?
        if (precipNext15 === 0) {
            summaryParts.push(tr.aiRainStopping); // "La pluja hauria d'aturar-se aviat."
        } else if (precipNext15 > precipInstantanea * 1.5) {
            summaryParts.push(tr.aiRainMore); // "S'intensificarà."
        } else if (precipNext15 < precipInstantanea * 0.5) {
            summaryParts.push(tr.aiRainLess); // "Anirà minvant."
        }

        if (code <= 2 && isDay) {
            summaryParts.push(tr.aiSunRain);
        }
    }
    // CAS B: NO PLOU ARA, PERÒ EL MODEL DEIA PLUJA (Correcció Coherent)
    else if (isRainCode) {
        if (precip1hSum > 0.1) {
            // El radar veu pluja en breu, encara que ara sigui 0
            summaryParts.push(tr.aiRainExp); // "Precipitació imminent"
        } else {
            // El model diu pluja, el radar diu no.
            summaryParts.push(tr.aiThreatening); // "Cel amenaçador..."
        }
    }
    // CAS C: NEU O TEMPESTA
    else if (code >= 95) summaryParts.push(tr.aiSummaryStorm);
    else if (isSnow) summaryParts.push(tr.aiSummarySnow);
    
    // CAS D: TEMPS ESTABLE
    else {
        if (code === 45 || code === 48) summaryParts.push(tr.aiSummaryCloudy); 
        else if (code === 0 || code === 1) summaryParts.push(tr.aiSummaryClear);
        else if (code === 2) summaryParts.push(isDay ? tr.aiSummaryVariable : tr.aiSummaryVariableNight);
        else if (code === 3) summaryParts.push(tr.aiSummaryOvercast); 
        else summaryParts.push(tr.aiSummaryCloudy); 
        
        // Matís final si s'espera pluja més tard
        if (rainProb > 40 && precip1hSum === 0) {
             summaryParts.push(tr.aiRainChance);
        } else if (current.cloud_cover < 30 && code <= 2) {
             summaryParts.push(tr.aiRainNone);
        }
    }

    // --- 4. VENT I TEMPERATURA ---
    if (windSpeed > 20) summaryParts.push(tr.aiWindMod);
    if (windSpeed > 50) summaryParts.push(tr.aiWindStrong); 
    
    if (feelsLike <= 0) summaryParts.push(tr.aiTempFreezing);
    else if (feelsLike > 0 && feelsLike < 10) summaryParts.push(tr.aiTempCold);
    else if (feelsLike >= 10 && feelsLike < 18) {
        if (currentHour >= 15 && minTempToday < 10) summaryParts.push(tr.aiTempCold); 
        else summaryParts.push(tr.aiTempCool); 
    }
    else if (feelsLike >= 18 && feelsLike < 25) summaryParts.push(tr.aiTempMild);
    else if (feelsLike >= 25 && feelsLike < 32) summaryParts.push(tr.aiTempWarm);
    else if (feelsLike >= 32) summaryParts.push(tr.aiTempHot);

    if (temp > 25 && humidity > 65) {
       const heatText = tr.aiHeatIndex ? tr.aiHeatIndex.replace('{temp}', Math.round(feelsLike)) : "";
       summaryParts.push(heatText);
    }

    // --- 5. ALERTES I TIPS ---
    if (code >= 95 || currentCape > 2000) alerts.push({ type: tr.storm, msg: tr.alertStorm, level: 'high' });
    else if (isSnow) alerts.push({ type: tr.snow, msg: tr.alertSnow, level: 'warning' });
    else if ((code === 65 || code === 82 || precipSum > 30) && precipInstantanea > 0) alerts.push({ type: tr.rain, msg: tr.alertRain, level: 'warning' });

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
      if (currentHour >= 15 && minTempToday < 8) tips.push(tr.tipCoat, tr.tipLayers);
      else tips.push(tr.tipLayers);
    }
    
    if (temp > 35) {
       alerts.push({ type: tr.heat, msg: tr.alertHeatExtreme, level: 'high' });
       tips.push(tr.tipHydration, tr.tipSunscreen);
    } else if (temp > 30) {
       alerts.push({ type: tr.heat, msg: tr.alertHeatHigh, level: 'warning' });
       tips.push(tr.tipHydration);
    }

    if (rainProb > 40 || precip1hSum > 0.1) tips.push(tr.tipUmbrella);
    if (uvMax > 7 && isDay) {
       if(uvMax >= 10) alerts.push({ type: tr.sun, msg: tr.alertUV, level: 'high' });
       tips.push(tr.tipSunscreen);
    }
    if (aqiValue > 100) alerts.push({ type: tr.aqi, msg: tr.alertAir, level: 'warning' });

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

export const getWeatherLabel = (current, language) => {
  const tr = TRANSLATIONS[language];
  if (!tr || !current) return "";

  const code = Number(current.weather_code);
  const precipInstantanea = current.minutely15 && current.minutely15.length > 0
      ? current.minutely15[0] 
      : 0;
  
  if (precipInstantanea > 0.1) {
      if (code === 45 || code === 48) return tr.rainFog || "Pluja i Boira";
      return tr.rainy; 
  }

  // --- CORRECCIÓ FINAL ---
  // Ja no retornem tr.cloudy si és pluja fantasma.
  // Deixem que el WMO decideixi el títol, però el text de l'IA (generateAIPrediction)
  // s'encarregarà d'explicar que "ara no plou" (aiThreatening).
  return tr.wmo[code] || "---";
};