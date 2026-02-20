// src/hooks/useChartData.ts
import { useMemo } from 'react';
import { ExtendedWeatherData } from '../types/weatherLogicTypes';
import { WeatherUnit } from '../utils/formatters';
import { generateHourlyChartData } from '../utils/weatherMappers';

export function useChartData(weatherData: ExtendedWeatherData | null, currentHourlyIndex: number, unit: WeatherUnit) {
  
  const allHourlyData = useMemo(() => {
    if (!weatherData) return [];
    return generateHourlyChartData(weatherData, currentHourlyIndex, unit);
  }, [weatherData, currentHourlyIndex, unit]);

  const chartData24h = useMemo(() => allHourlyData.slice(0, 24), [allHourlyData]);
  const chartDataFull = useMemo(() => allHourlyData, [allHourlyData]);

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
             const precipVal = (typeof d.precipitation === 'number') ? d.precipitation : null;
             const fl = d.freezing_level_height;

             return {
                 time: weatherData.hourly.time[targetIdx],
                 temp: unit === 'F' ? Math.round((temp * 9/5) + 32) : temp,
                 rain: rainP,
                 pop: rainP,
                 precip: precipVal, 
                 wind: d.wind_speed_10m,
                 cloud: d.cloud_cover,
                 humidity: d.relative_humidity_2m,
                 snowLevel: (typeof fl === 'number') ? Math.max(0, fl - 300) : null
             };
         }).filter((item): item is NonNullable<typeof item> => item !== null);
      };

      return {
          ecmwf: sliceModel(weatherData.hourlyComparison.ecmwf),
          gfs: sliceModel(weatherData.hourlyComparison.gfs),
          icon: sliceModel(weatherData.hourlyComparison.icon),
          daily: weatherData.dailyComparison 
      };
  }, [weatherData, unit, currentHourlyIndex]);

  return { allHourlyData, chartData24h, chartDataFull, comparisonData };
}