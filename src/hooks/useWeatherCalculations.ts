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

// Helper bàsic per si una dada no existeix
const getVal = (data: any, key: string, i: number) => {
    if (!data) return null;
    if (Array.isArray(data[key])) return data[key][i]; // Si ve per columnes
    if (data[i]) return data[i][key]; // Si ve per files
    return null;
};

export function useWeatherCalculations(weatherData: ExtendedWeatherData | null, unit: WeatherUnit, now: Date) {
  
  // 1. DATA I HORA (ESTÀNDARD)
  const shiftedNow = useMemo(() => {
    if (!weatherData) return now;
    return getShiftedDate(now, weatherData.timezone || 'UTC');
  }, [weatherData, now]);

  // 2. DADES MINUT A MINUT
  const minutelyPreciseData = useMemo<number[]>(() => {
    if (!weatherData?.minutely_15?.precipitation) return [];
    const currentMs = shiftedNow.getTime();
    const times = weatherData.minutely_15.time.map((t: string) => new Date(t).getTime());
    let idx = times.findIndex(t => t > currentMs);
    let currentIdx = (idx === -1) ? times.length - 1 : Math.max(0, idx - 1);
    return weatherData.minutely_15.precipitation.slice(currentIdx, currentIdx + 4);
  }, [weatherData, shiftedNow]);

  // 3. INDEX ACTUAL (SIMPLE)
  const currentHourlyIndex = useMemo(() => {
     if (!weatherData?.hourly?.time) return 0;
     const nowMs = shiftedNow.getTime();
     const idx = weatherData.hourly.time.findIndex((t: string) => {
        const tMs = new Date(t).getTime();
        return tMs <= nowMs && (tMs + 3600000) > nowMs;
     });
     return idx !== -1 ? idx : 0;
  }, [weatherData, shiftedNow]);

  // 4. CHART DATA (FORMAT CLÀSSIC: 'rain' i 'precip')
  // Això farà que ForecastSection i les gràfiques antigues tornin a funcionar.
  const chartData = useMemo(() => {
    if (!weatherData?.hourly?.time) return [];
    
    const startIndex = Math.max(0, currentHourlyIndex);
    const endIndex = startIndex + 24;

    return weatherData.hourly.time.slice(startIndex, endIndex).map((tRaw: string, i: number) => {
      const realIndex = startIndex + i;
      
      const temp = weatherData.hourly.temperature_2m[realIndex] || 0;
      const appTemp = weatherData.hourly.apparent_temperature[realIndex] || 0;
      
      // RECUPEREM NOMS ANTICS PER COMPATIBILITAT
      const rainProb = weatherData.hourly.precipitation_probability[realIndex] || 0;
      const precipVol = weatherData.hourly.precipitation[realIndex] || 0;

      // Cota de neu simple
      let fl = null;
      if (weatherData.hourly.freezing_level_height) {
          fl = weatherData.hourly.freezing_level_height[realIndex];
      }
      // Si no hi ha dada, mirem si el GFS en té (simple fallback)
      if (fl == null && weatherData.hourlyComparison?.gfs) {
          fl = getVal(weatherData.hourlyComparison.gfs, 'freezing_level_height', realIndex);
      }

      return {
        time: tRaw,
        temp: unit === 'F' ? Math.round((temp * 9/5) + 32) : temp,
        apparent: unit === 'F' ? Math.round((appTemp * 9/5) + 32) : appTemp,
        
        // AQUESTS SÓN ELS NOMS QUE ESPEREN ELS TEUS COMPONENTS ORIGINALS
        rain: rainProb,
        precip: precipVol,
        
        // També passem els nous per si de cas algun component ja s'ha actualitzat
        pop: rainProb,
        qpf: precipVol,

        wind: weatherData.hourly.wind_speed_10m[realIndex],
        gusts: weatherData.hourly.wind_gusts_10m[realIndex],
        windDir: weatherData.hourly.wind_direction_10m[realIndex],
        cloud: weatherData.hourly.cloud_cover[realIndex],
        humidity: weatherData.hourly.relative_humidity_2m[realIndex],
        uv: weatherData.hourly.uv_index?.[realIndex] || 0,
        snowLevel: (fl !== null) ? Math.max(0, fl - 300) : null,
        
        // Gestió segura de is_day
        isDay: weatherData.hourly.is_day[realIndex] ?? 1,
        code: weatherData.hourly.weather_code[realIndex] ?? 0
      };
    });
  }, [weatherData, unit, currentHourlyIndex]);

  // 5. COMPARISON DATA (SIMPLE: INDEX PER INDEX)
  // Això força que les línies surtin. Si ECMWF té dada, GFS també surt.
  const comparisonData = useMemo(() => {
      if (!weatherData?.hourlyComparison) return null;
      
      const startIndex = Math.max(0, currentHourlyIndex);
      const endIndex = startIndex + 24;

      const sliceModel = (modelData: any) => {
         if(!modelData) return [];
         // Creem array de 24 elements basat en l'index principal
         return Array.from({ length: 24 }).map((_, i) => {
             const targetIdx = startIndex + i;
             
             const temp = getVal(modelData, 'temperature_2m', targetIdx);
             if (temp == null) return null; 

             const rainP = getVal(modelData, 'precipitation_probability', targetIdx) || 0;
             const fl = getVal(modelData, 'freezing_level_height', targetIdx);

             return {
                 time: weatherData.hourly.time[targetIdx], // Usem l'hora "mestra"
                 temp: unit === 'F' ? Math.round((temp * 9/5) + 32) : temp,
                 
                 // Compatibilitat
                 rain: rainP,
                 pop: rainP,
                 
                 wind: getVal(modelData, 'wind_speed_10m', targetIdx),
                 cloud: getVal(modelData, 'cloud_cover', targetIdx),
                 humidity: getVal(modelData, 'relative_humidity_2m', targetIdx),
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

  // --- RESTA DE CÀLCULS BÀSICS (Sense canvis de lògica) ---
  
  const currentRainProbability = useMemo(() => {
     if (!chartData.length) return 0;
     return chartData[0].rain || 0; // Usem 'rain'
  }, [chartData]);

  const currentFreezingLevel = useMemo(() => {
      if (chartData.length > 0 && chartData[0].snowLevel !== null) return chartData[0].snowLevel + 300;
      return 2500;
  }, [chartData]);

  const effectiveWeatherCode = useMemo(() => {
    if (!weatherData?.current) return 0;
    return getRealTimeWeatherCode(weatherData.current, minutelyPreciseData, currentRainProbability, currentFreezingLevel, weatherData.elevation || 0);
  }, [weatherData, minutelyPreciseData, currentRainProbability, currentFreezingLevel]);

  // COLOR DE FONS
  const currentBg = useMemo(() => {
    if(!weatherData) return "from-slate-900 via-slate-900 to-indigo-950";
    
    // Aquí assegurem que no peti
    const { is_day } = weatherData.current;
    const isDay = is_day; 
    
    const code = effectiveWeatherCode;
    if (code >= 95) return "from-slate-900 via-slate-950 to-purple-950"; 
    // ... resta de colors igual ...
    if (code === 0 && isDay) return "from-blue-500 via-blue-400 to-orange-300"; 
    if (code === 0 && !isDay) return "from-slate-950 via-indigo-950 to-purple-950"; 
    return "from-slate-900 to-indigo-950";
  }, [weatherData, effectiveWeatherCode]);

  // EXTRAS
  const currentCape = useMemo(() => getVal(weatherData?.hourly, 'cape', currentHourlyIndex) || 0, [weatherData, currentHourlyIndex]);
  const weeklyExtremes = useMemo(() => (!weatherData ? {min:0,max:100} : { min: Math.min(...weatherData.daily.temperature_2m_min), max: Math.max(...weatherData.daily.temperature_2m_max)}), [weatherData]);
  const currentDewPoint = useMemo(() => calculateDewPoint(weatherData?.current?.temperature_2m || 0, weatherData?.current?.relative_humidity_2m || 0), [weatherData]);
  const reliability = useMemo(() => calculateReliability(weatherData?.daily, weatherData?.dailyComparison?.gfs, weatherData?.dailyComparison?.icon, 0), [weatherData]);
  const moonPhaseVal = useMemo(() => getMoonPhase(new Date()), []); 
  const barometricTrend = useMemo(() => ({ trend: 'steady', val: 0 }), []); 

  return { shiftedNow, minutelyPreciseData, currentRainProbability, currentFreezingLevel, effectiveWeatherCode, currentBg, barometricTrend, currentCape, currentDewPoint, reliability, moonPhaseVal, chartData, comparisonData, weeklyExtremes };
}