// src/utils/weatherMappers.ts
import { ExtendedWeatherData } from '../types/weatherLogicTypes';
import { WeatherUnit } from '../utils/formatters';

/**
 * Helper pur per extreure valors de comparació de models de forma segura
 */
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

/**
 * Funció pura que transforma les dades crues de l'API en l'array d'objectes
 * que necessiten els gràfics, resolent buits d'informació (fallbacks).
 */
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

    const getSmartVal = (key: string, idx: number, fallback: number, lastKnown: number) => {
        let val: unknown = hourlyDataSafe[key]?.[idx];
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

      let flVal: unknown = hourlyDataSafe.freezing_level_height?.[realIndex];
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
};