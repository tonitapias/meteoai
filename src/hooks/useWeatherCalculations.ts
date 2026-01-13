// src/hooks/useWeatherCalculations.ts
import { useMemo } from 'react';
import { 
  getShiftedDate, 
  calculateDewPoint, 
  getMoonPhase, 
  calculateReliability,
  getRealTimeWeatherCode,
  ExtendedWeatherData
} from '../utils/weatherLogic';
import { WeatherUnit } from '../utils/formatters';

const getComparisonVal = (data: any, key: string, i: number) => {
    if (!data) return null;
    if (Array.isArray(data[key])) return data[key][i]; 
    if (data[i]) return data[i][key]; 
    return null;
};

export function useWeatherCalculations(weatherData: ExtendedWeatherData | null, unit: WeatherUnit, now: Date) {
  
  // 1. DATA I HORA
  const shiftedNow = useMemo(() => {
    if (!weatherData) return now;
    return getShiftedDate(now, weatherData.timezone || 'UTC');
  }, [weatherData, now]);

  // 2. ÍNDEX ACTUAL (Mogut a dalt perquè el necessitem per al Fallback de pluja)
  const currentHourlyIndex = useMemo(() => {
     if (!weatherData?.hourly?.time || !weatherData?.current?.time) return 0;
     const apiCurrentTimeStr = weatherData.current.time; 
     const exactIdx = weatherData.hourly.time.findIndex((t: string) => t === apiCurrentTimeStr);
     if (exactIdx !== -1) return exactIdx;
     const currentHourStr = apiCurrentTimeStr.slice(0, 13);
     const partialIdx = weatherData.hourly.time.findIndex((t: string) => t.startsWith(currentHourStr));
     return partialIdx !== -1 ? partialIdx : 0;
  }, [weatherData]);

  // 3. MINUT A MINUT (AMB FALLBACK AROME/HORARI)
  const minutelyPreciseData = useMemo<number[]>(() => {
    // A. Intentem obtenir dades reals de minutely_15
    let preciseData: number[] = [];
    
    if (weatherData?.minutely_15?.precipitation) {
        const currentMs = new Date().getTime(); 
        const timesRaw = weatherData.minutely_15.time;
        let idx = -1;
        for(let i = 0; i < timesRaw.length; i++) {
            if (new Date(timesRaw[i]).getTime() > currentMs) { idx = i; break; }
        }
        // Ajustem per agafar el tram actual (aprox. pròxima hora)
        let currentIdx = (idx === -1) ? timesRaw.length - 1 : Math.max(0, idx - 1);
        preciseData = weatherData.minutely_15.precipitation.slice(currentIdx, currentIdx + 4);
    }

    // B. Comprovació: Tenim pluja real al minut a minut?
    const hasMinutelyRain = preciseData.some(v => v > 0);

    if (hasMinutelyRain) {
        return preciseData;
    }

    // C. ESTRATÈGIA FALLBACK: Si minutely és 0 però AROME (Hourly) diu que plou
    // Busquem la pluja de l'hora actual utilitzant l'índex que hem calculat abans
    const currentHourPrecip = weatherData?.hourly?.precipitation?.[currentHourlyIndex] || 0;
    
    if (currentHourPrecip > 0) {
        // Si plou a l'hora actual (ex: 1.9mm com a la foto), repartim visualment en 4 quarts
        // Això garanteix que el giny surti coincidint amb la realitat del model
        const estimatedQuarter = Number((currentHourPrecip / 4).toFixed(2));
        return [estimatedQuarter, estimatedQuarter, estimatedQuarter, estimatedQuarter];
    }

    // Si no hi ha res enlloc, retornem array de zeros (o el que tinguéssim)
    return preciseData.length > 0 ? preciseData : [0,0,0,0];

  }, [weatherData, currentHourlyIndex]);

  // 4. GENERACIÓ DE DADES MESTRA (168 Hores - 7 Dies)
  const allHourlyData = useMemo(() => {
    if (!weatherData?.hourly?.time) return [];
    
    // Comencem des de l'hora actual, però capturem TOTA la setmana disponible
    const startIndex = Math.max(0, currentHourlyIndex);
    const availableTime = weatherData.hourly.time;
    
    // Helper: Validació estricta
    const isValid = (val: any) => val !== null && val !== undefined && !Number.isNaN(val);

    // Variables per mantenir l'últim valor conegut (Persistència)
    let lastTemp = 0, lastWind = 0, lastPressure = 1013, lastHum = 50;

    const getSmartVal = (key: string, idx: number, fallback: number, lastKnown: number) => {
        // 1. Primari
        let val = weatherData.hourly[key]?.[idx];
        if (isValid(val)) return val;

        // 2. GFS
        if (weatherData.hourlyComparison?.gfs) {
            val = getComparisonVal(weatherData.hourlyComparison.gfs, key, idx);
            if (isValid(val)) return val;
        }
        
        // 3. ICON
        if (weatherData.hourlyComparison?.icon) {
            val = getComparisonVal(weatherData.hourlyComparison.icon, key, idx);
            if (isValid(val)) return val;
        }

        // 4. Últim conegut o Defecte
        return lastKnown ?? fallback;
    };

    return availableTime.slice(startIndex).map((tRaw: string, i: number) => {
      const realIndex = startIndex + i;

      // Recuperació amb persistència
      const tempVal = getSmartVal('temperature_2m', realIndex, 0, lastTemp);
      if (isValid(tempVal)) lastTemp = tempVal; 

      const appTempVal = getSmartVal('apparent_temperature', realIndex, tempVal, tempVal);
      
      const rainProbVal = getSmartVal('precipitation_probability', realIndex, 0, 0); 
      const precipVolVal = getSmartVal('precipitation', realIndex, 0, 0);
      
      const windVal = getSmartVal('wind_speed_10m', realIndex, 0, lastWind);
      if (isValid(windVal)) lastWind = windVal;

      const gustsVal = getSmartVal('wind_gusts_10m', realIndex, windVal, windVal);
      const windDirVal = getSmartVal('wind_direction_10m', realIndex, 0, 0);
      
      const cloudVal = getSmartVal('cloud_cover', realIndex, 0, 0);
      
      const humidityVal = getSmartVal('relative_humidity_2m', realIndex, 50, lastHum);
      if (isValid(humidityVal)) lastHum = humidityVal;

      const uvVal = getSmartVal('uv_index', realIndex, 0, 0);
      
      const pressureVal = getSmartVal('surface_pressure', realIndex, 1013, lastPressure);
      if (isValid(pressureVal)) lastPressure = pressureVal;
      
      const isDayVal = getSmartVal('is_day', realIndex, 1, 1);
      const codeVal = getSmartVal('weather_code', realIndex, 0, 0);

      // Cota de neu
      let flVal = weatherData.hourly.freezing_level_height?.[realIndex];
      if (!isValid(flVal)) {
         if (weatherData.hourlyComparison?.gfs) flVal = getComparisonVal(weatherData.hourlyComparison.gfs, 'freezing_level_height', realIndex);
         if (!isValid(flVal) && weatherData.hourlyComparison?.icon) flVal = getComparisonVal(weatherData.hourlyComparison.icon, 'freezing_level_height', realIndex);
      }

      const tempFinal = unit === 'F' ? Math.round((tempVal * 9/5) + 32) : tempVal;
      const appTempFinal = unit === 'F' ? Math.round((appTempVal * 9/5) + 32) : appTempVal;

      return {
        time: tRaw,
        timestamp: new Date(tRaw).getTime(),
        temp: tempFinal,
        apparent: appTempFinal,
        rain: rainProbVal, 
        pop: rainProbVal, 
        precip: precipVolVal,
        qpf: precipVolVal,
        wind: windVal,
        gusts: gustsVal,
        windDir: windDirVal,
        cloud: cloudVal,
        humidity: humidityVal,
        uv: uvVal,
        pressure: pressureVal,
        snowLevel: isValid(flVal) ? Math.max(0, flVal - 300) : null,
        isDay: isDayVal,
        code: codeVal
      };
    });
  }, [weatherData, unit, currentHourlyIndex]);

  // 5. DIVISIÓ DE DADES (FIX PANTALLA PRINCIPAL)
  const chartData24h = useMemo(() => allHourlyData.slice(0, 24), [allHourlyData]);
  const chartDataFull = useMemo(() => allHourlyData, [allHourlyData]);

  // 6. COMPARATIVES (LIMITAT A 24h PER PERFORMANCE UI)
  const comparisonData = useMemo(() => {
      if (!weatherData?.hourlyComparison) return null;
      const startIndex = Math.max(0, currentHourlyIndex);

      const sliceModel = (modelData: any) => {
         if(!modelData) return [];
         return Array.from({ length: 24 }).map((_, i) => { 
             const targetIdx = startIndex + i;
             if (targetIdx >= (weatherData.hourly?.time?.length || 0)) return null;

             const temp = getComparisonVal(modelData, 'temperature_2m', targetIdx);
             if (temp == null || isNaN(temp)) return null; 

             const rainP = getComparisonVal(modelData, 'precipitation_probability', targetIdx) || 0;
             const fl = getComparisonVal(modelData, 'freezing_level_height', targetIdx);

             return {
                 time: weatherData.hourly.time[targetIdx],
                 temp: unit === 'F' ? Math.round((temp * 9/5) + 32) : temp,
                 rain: rainP,
                 pop: rainP,
                 wind: getComparisonVal(modelData, 'wind_speed_10m', targetIdx),
                 cloud: getComparisonVal(modelData, 'cloud_cover', targetIdx),
                 humidity: getComparisonVal(modelData, 'relative_humidity_2m', targetIdx),
                 snowLevel: (fl != null) ? Math.max(0, fl - 300) : null
             };
         }).filter(Boolean);
      };

      return {
          gfs: sliceModel(weatherData.hourlyComparison.gfs),
          icon: sliceModel(weatherData.hourlyComparison.icon),
          daily: weatherData.dailyComparison 
      };
  }, [weatherData, unit, currentHourlyIndex]);

  // ALTRES CÀLCULS
  const currentRainProbability = useMemo(() => chartData24h[0]?.rain || 0, [chartData24h]);
  const currentFreezingLevel = useMemo(() => (chartData24h.length > 0 && chartData24h[0].snowLevel !== null) ? chartData24h[0].snowLevel + 300 : 2500, [chartData24h]);
  const effectiveWeatherCode = useMemo(() => (!weatherData?.current ? 0 : getRealTimeWeatherCode(weatherData.current, minutelyPreciseData, currentRainProbability, currentFreezingLevel, weatherData.elevation || 0)), [weatherData, minutelyPreciseData, currentRainProbability, currentFreezingLevel]);
  
  const currentBg = useMemo(() => {
    if(!weatherData) return "from-slate-900 via-slate-900 to-indigo-950";
    const { is_day } = weatherData.current;
    const isDay = is_day !== undefined ? is_day : 1; 
    const code = effectiveWeatherCode;
    if (code >= 95) return "from-slate-900 via-slate-950 to-purple-950"; 
    if (code === 0 && isDay) return "from-blue-500 via-blue-400 to-orange-300"; 
    if (code === 0 && !isDay) return "from-slate-950 via-indigo-950 to-purple-950"; 
    return "from-slate-900 to-indigo-950";
  }, [weatherData, effectiveWeatherCode]);

  const currentCape = useMemo(() => getComparisonVal(weatherData?.hourly, 'cape', currentHourlyIndex) || 0, [weatherData, currentHourlyIndex]);
  const weeklyExtremes = useMemo(() => (!weatherData ? {min:0,max:100} : { min: Math.min(...weatherData.daily.temperature_2m_min), max: Math.max(...weatherData.daily.temperature_2m_max)}), [weatherData]);
  const currentDewPoint = useMemo(() => calculateDewPoint(weatherData?.current?.temperature_2m || 0, weatherData?.current?.relative_humidity_2m || 0), [weatherData]);
  const reliability = useMemo(() => calculateReliability(weatherData?.daily, weatherData?.dailyComparison?.gfs, weatherData?.dailyComparison?.icon, 0), [weatherData]);
  const moonPhaseVal = useMemo(() => getMoonPhase(new Date()), []); 
  const barometricTrend = useMemo(() => ({ trend: 'steady', val: 0 }), []); 

  // RETORNEM DUES VERSIONS DE LES DADES
  return { 
    shiftedNow, minutelyPreciseData, currentRainProbability, currentFreezingLevel, effectiveWeatherCode, currentBg, 
    barometricTrend, currentCape, currentDewPoint, reliability, moonPhaseVal, 
    chartData24h, 
    chartDataFull, 
    comparisonData, weeklyExtremes 
  };
}