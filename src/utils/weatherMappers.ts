// src/utils/weatherMappers.ts
import { ExtendedWeatherData } from '../types/weatherLogicTypes';
import { WeatherUnit } from '../utils/formatters';
import { calculateSnowLevel } from './rules/winterRules';

export const getComparisonVal = (data: unknown, key: string, i: number): number | null => {
    if (!data) return null;
    if (typeof data === 'object' && !Array.isArray(data)) {
        const col = (data as Record<string, unknown>)[key];
        if (Array.isArray(col)) {
             const val = col[i];
             return (typeof val === 'number') ? val : null;
        }
    }
    if (Array.isArray(data)) {
        const row = data[i] as Record<string, unknown> | undefined;
        if (row) {
            const val = row[key];
            return (typeof val === 'number') ? val : null;
        }
    }
    return null;
};

export type SmartSource = 'primary' | 'ecmwf' | 'gfs' | 'icon' | 'estimated';

export const generateHourlyChartData = (
    weatherData: ExtendedWeatherData,
    currentHourlyIndex: number,
    unit: WeatherUnit
) => {
    if (!weatherData?.hourly?.time) return [];
    
    const startIndex = Math.max(0, currentHourlyIndex);
    const availableTime = weatherData.hourly.time;
    const isValid = (val: unknown): val is number => val !== null && val !== undefined && typeof val === 'number' && !Number.isNaN(val);

    let lastTemp = 0, lastWind = 0, lastPressure = 1013, lastHum = 50;
    const hourlyDataSafe = weatherData.hourly as Record<string, unknown[]>;

    const getSmartVal = (key: string, idx: number, fallback: number, lastKnown: number): { value: number; source: SmartSource } => {
        const primaryVal = hourlyDataSafe[key]?.[idx];
        if (isValid(primaryVal)) return { value: primaryVal, source: 'primary' };

        if (weatherData.hourlyComparison?.ecmwf) {
            const val = getComparisonVal(weatherData.hourlyComparison.ecmwf, key, idx);
            if (isValid(val)) return { value: val, source: 'ecmwf' };
        }
        if (weatherData.hourlyComparison?.gfs) {
            const val = getComparisonVal(weatherData.hourlyComparison.gfs, key, idx);
            if (isValid(val)) return { value: val, source: 'gfs' };
        }
        if (weatherData.hourlyComparison?.icon) {
            const val = getComparisonVal(weatherData.hourlyComparison.icon, key, idx);
            if (isValid(val)) return { value: val, source: 'icon' };
        }
        return { value: lastKnown ?? fallback, source: 'estimated' };
    };

    return availableTime.slice(startIndex).map((tRaw: string, i: number) => {
      const realIndex = startIndex + i;

      const tempResult = getSmartVal('temperature_2m', realIndex, 0, lastTemp);
      const tempVal = tempResult.value;
      if (isValid(tempVal)) lastTemp = tempVal; 

      const appTempVal = getSmartVal('apparent_temperature', realIndex, tempVal, tempVal).value;
      const rainProbVal = getSmartVal('precipitation_probability', realIndex, 0, 0).value; 
      const precipVolVal = getSmartVal('precipitation', realIndex, 0, 0).value;
      
      const windResult = getSmartVal('wind_speed_10m', realIndex, 0, lastWind);
      const windVal = windResult.value;
      if (isValid(windVal)) lastWind = windVal;
      const gustsVal = getSmartVal('wind_gusts_10m', realIndex, windVal, windVal).value;
      const windDirVal = getSmartVal('wind_direction_10m', realIndex, 0, 0).value;

      const cloudResult = getSmartVal('cloud_cover', realIndex, 0, 0);
      const cloudVal = cloudResult.value;

      const cloudLowVal = getSmartVal('cloud_cover_low', realIndex, 0, 0).value;
      const cloudMidVal = getSmartVal('cloud_cover_mid', realIndex, 0, 0).value;
      const cloudHighVal = getSmartVal('cloud_cover_high', realIndex, 0, 0).value;
      
      const humidityResult = getSmartVal('relative_humidity_2m', realIndex, 50, lastHum);
      const humidityVal = humidityResult.value;
      if (isValid(humidityVal)) lastHum = humidityVal;
      const uvVal = getSmartVal('uv_index', realIndex, 0, 0).value;
      const pressureResult = getSmartVal('surface_pressure', realIndex, 1013, lastPressure);
      const pressureVal = pressureResult.value;
      if (isValid(pressureVal)) lastPressure = pressureVal;
      
      const isDayVal = getSmartVal('is_day', realIndex, 1, 1).value;
      const codeVal = getSmartVal('weather_code', realIndex, 0, 0).value;

      // [FIX PRECISIÓ] Abans queia gfs -> icon, sense provar mai ecmwf (tot i que
      // ja arriba a hourlyComparison.ecmwf) — mateixa mancança que vam corregir
      // al hallazgo (2) per a la resta de camps.
      let flVal: unknown = hourlyDataSafe.freezing_level_height?.[realIndex];
      if (!isValid(flVal) && weatherData.hourlyComparison?.ecmwf) {
         flVal = getComparisonVal(weatherData.hourlyComparison.ecmwf, 'freezing_level_height', realIndex);
      }
      if (!isValid(flVal) && weatherData.hourlyComparison?.gfs) {
         flVal = getComparisonVal(weatherData.hourlyComparison.gfs, 'freezing_level_height', realIndex);
      }
      if (!isValid(flVal) && weatherData.hourlyComparison?.icon) {
         flVal = getComparisonVal(weatherData.hourlyComparison.icon, 'freezing_level_height', realIndex);
      }

      const tempFinal = unit === 'F' ? Math.round((tempVal * 9/5) + 32) : tempVal;
      const appTempFinal = unit === 'F' ? Math.round((appTempVal * 9/5) + 32) : appTempVal;

      return {
        time: tRaw,
        timestamp: new Date(tRaw).getTime(),
        temp: tempFinal,
        tempSource: tempResult.source,
        apparent: appTempFinal,
        rain: rainProbVal, 
        pop: rainProbVal, 
        precip: precipVolVal,
        qpf: precipVolVal,
        wind: windVal,
        gusts: gustsVal,
        windDir: windDirVal,
        cloud: cloudVal,
        cloudSource: cloudResult.source,
        cloudLow: cloudLowVal,
        cloudMid: cloudMidVal,
        cloudHigh: cloudHighVal,
        humidity: humidityVal,
        uv: uvVal,
        pressure: pressureVal,
        snowLevel: calculateSnowLevel(flVal),
        isDay: isDayVal,
        code: codeVal
      };
    });
};