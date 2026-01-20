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

// Funció helper tipada per extreure valors de dades complexes (files o columnes)
const getComparisonVal = (data: unknown, key: string, i: number): number | null => {
    if (!data) return null;
    
    // Cas 1: Dades per columnes (Hourly Object: { temp: [1,2,3], ... })
    if (typeof data === 'object' && !Array.isArray(data)) {
        const col = (data as Record<string, unknown>)[key];
        if (Array.isArray(col)) {
             const val = col[i];
             return (typeof val === 'number') ? val : null;
        }
    }
    
    // Cas 2: Dades per files (Array d'objectes: [{temp: 1}, {temp: 2}])
    if (Array.isArray(data)) {
        const row = data[i] as Record<string, unknown> | undefined;
        if (row) {
            const val = row[key];
            return (typeof val === 'number') ? val : null;
        }
    }
    
    return null;
};

export function useWeatherCalculations(weatherData: ExtendedWeatherData | null, unit: WeatherUnit, now: Date) {
  
  // 1. DATA I HORA
  const shiftedNow = useMemo(() => {
    if (!weatherData) return now;
    return getShiftedDate(now, weatherData.timezone || 'UTC');
  }, [weatherData, now]);

  // 2. ÍNDEX ACTUAL
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
    let preciseData: number[] = [];
    
    if (weatherData?.minutely_15?.precipitation) {
        const currentMs = new Date().getTime(); 
        const timesRaw = weatherData.minutely_15.time as string[];
        let idx = -1;
        for(let i = 0; i < timesRaw.length; i++) {
            if (new Date(timesRaw[i]).getTime() > currentMs) { idx = i; break; }
        }
        const currentIdx = (idx === -1) ? timesRaw.length - 1 : Math.max(0, idx - 1);
        const precipArr = weatherData.minutely_15.precipitation as number[];
        preciseData = precipArr.slice(currentIdx, currentIdx + 4);
    }

    const hasMinutelyRain = preciseData.some(v => v > 0);

    if (hasMinutelyRain) {
        return preciseData;
    }

    const currentHourPrecip = weatherData?.hourly?.precipitation?.[currentHourlyIndex] || 0;
    
    if (currentHourPrecip > 0) {
        const estimatedQuarter = Number((currentHourPrecip / 4).toFixed(2));
        return [estimatedQuarter, estimatedQuarter, estimatedQuarter, estimatedQuarter];
    }

    return preciseData.length > 0 ? preciseData : [0,0,0,0];

  }, [weatherData, currentHourlyIndex]);

  // 4. GENERACIÓ DE DADES MESTRA (168 Hores - 7 Dies)
  const allHourlyData = useMemo(() => {
    if (!weatherData?.hourly?.time) return [];
    
    const startIndex = Math.max(0, currentHourlyIndex);
    const availableTime = weatherData.hourly.time;
    // Type Guard per assegurar que el valor és numèric i vàlid
    const isValid = (val: unknown): val is number => val !== null && val !== undefined && typeof val === 'number' && !Number.isNaN(val);

    let lastTemp = 0, lastWind = 0, lastPressure = 1013, lastHum = 50;

    const getSmartVal = (key: string, idx: number, fallback: number, lastKnown: number) => {
        let val: unknown = weatherData.hourly[key]?.[idx];
        if (isValid(val)) return val;

        if (weatherData.hourlyComparison?.gfs) {
            val = getComparisonVal(weatherData.hourlyComparison.gfs, key, idx);
            if (isValid(val)) return val;
        }
        
        if (weatherData.hourlyComparison?.icon) {
            val = getComparisonVal(weatherData.hourlyComparison.icon, key, idx);
            if (isValid(val)) return val;
        }

        return lastKnown ?? fallback;
    };

    return availableTime.slice(startIndex).map((tRaw: string, i: number) => {
      const realIndex = startIndex + i;

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

      let flVal: unknown = weatherData.hourly.freezing_level_height?.[realIndex];
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

  // 5. DIVISIÓ DE DADES
  const chartData24h = useMemo(() => allHourlyData.slice(0, 24), [allHourlyData]);
  const chartDataFull = useMemo(() => allHourlyData, [allHourlyData]);

  // 6. COMPARATIVES
  const comparisonData = useMemo(() => {
      if (!weatherData?.hourlyComparison) return null;
      const startIndex = Math.max(0, currentHourlyIndex);

      const sliceModel = (modelData: Record<string, unknown>[]) => {
         if(!modelData || !modelData.length) return [];
         return Array.from({ length: 24 }).map((_, i) => { 
             const targetIdx = startIndex + i;
             const d = modelData[targetIdx];
             if (!d || !weatherData.hourly?.time?.[targetIdx]) return null;

             const temp = d.temperature_2m;
             if (typeof temp !== 'number' || isNaN(temp)) return null; 

             const rainP = (typeof d.precipitation_probability === 'number') ? d.precipitation_probability : 0;
             const fl = d.freezing_level_height;

             return {
                 time: weatherData.hourly.time[targetIdx],
                 temp: unit === 'F' ? Math.round((temp * 9/5) + 32) : temp,
                 rain: rainP,
                 pop: rainP,
                 wind: d.wind_speed_10m,
                 cloud: d.cloud_cover,
                 humidity: d.relative_humidity_2m,
                 snowLevel: (typeof fl === 'number') ? Math.max(0, fl - 300) : null
             };
         }).filter(Boolean);
      };

      return {
          ecmwf: sliceModel(weatherData.hourlyComparison.ecmwf),
          gfs: sliceModel(weatherData.hourlyComparison.gfs),
          icon: sliceModel(weatherData.hourlyComparison.icon),
          daily: weatherData.dailyComparison 
      };
  }, [weatherData, unit, currentHourlyIndex]);

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

  const weeklyExtremes = useMemo(() => {
    const minTemps = weatherData?.daily?.temperature_2m_min;
    const maxTemps = weatherData?.daily?.temperature_2m_max;

    if (!Array.isArray(minTemps) || !Array.isArray(maxTemps) || minTemps.length === 0) {
        return { min: 0, max: 40 }; 
    }

    return { 
        min: Math.min(...(minTemps as number[])), 
        max: Math.max(...(maxTemps as number[]))
    };
  }, [weatherData]);

  const currentDewPoint = useMemo(() => calculateDewPoint(weatherData?.current?.temperature_2m || 0, weatherData?.current?.relative_humidity_2m || 0), [weatherData]);
  const reliability = useMemo(() => calculateReliability(weatherData?.daily, weatherData?.dailyComparison?.gfs, weatherData?.dailyComparison?.icon, 0), [weatherData]);
  const moonPhaseVal = useMemo(() => getMoonPhase(new Date()), []); 
  const barometricTrend = useMemo(() => ({ trend: 'steady', val: 0 }), []); 

  return { 
    shiftedNow, minutelyPreciseData, currentRainProbability, currentFreezingLevel, effectiveWeatherCode, currentBg, 
    barometricTrend, currentCape, currentDewPoint, reliability, moonPhaseVal, 
    chartData24h, 
    chartDataFull, 
    comparisonData, weeklyExtremes 
  };
}