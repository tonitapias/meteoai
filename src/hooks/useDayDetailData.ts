// src/hooks/useDayDetailData.ts
import { useMemo } from 'react';
import { ExtendedWeatherData } from '../types/weatherLogicTypes'; // IMPORT CORREGIT

export const useDayDetailData = (
  weatherData: ExtendedWeatherData | null, 
  selectedDayIndex: number | null
) => {
  
  const dayData = useMemo(() => {
    if (!weatherData || selectedDayIndex === null) return null;
    const i = selectedDayIndex;
    const daily = weatherData.daily;
    if (!daily || !daily.time || !daily.time[i]) return null;

    return {
      date: daily.time[i],
      maxTemp: daily.temperature_2m_max[i],
      minTemp: daily.temperature_2m_min[i],
      precipSum: daily.precipitation_sum?.[i],
      windMax: daily.wind_speed_10m_max?.[i],
      sunrise: daily.sunrise?.[i],
      sunset: daily.sunset?.[i],
      uvMax: daily.uv_index_max?.[i]
    };
  }, [weatherData, selectedDayIndex]);

  const dayIndices = useMemo(() => {
    if (!weatherData || !dayData?.date) return [];
    const targetDate = dayData.date.includes('T') ? dayData.date.split('T')[0] : dayData.date;

    return weatherData.hourly.time
      .map((t: string, idx: number) => ({ 
        datePart: t.includes('T') ? t.split('T')[0] : t, 
        idx 
      }))
      .filter((item: { datePart: string, idx: number }) => item.datePart === targetDate)
      .map((item: { datePart: string, idx: number }) => item.idx);
  }, [weatherData, dayData]);

  const hourlyData = useMemo(() => {
    if (!weatherData || dayIndices.length === 0) return [];

    return dayIndices.map((idx: number) => {
        let fl = weatherData.hourly.freezing_level_height?.[idx];
        if (fl == null) {
             const gfsVal = weatherData.hourlyComparison?.gfs?.[idx]?.freezing_level_height;
             const iconVal = weatherData.hourlyComparison?.icon?.[idx]?.freezing_level_height;
             fl = (typeof gfsVal === 'number' ? gfsVal : typeof iconVal === 'number' ? iconVal : null);
        }
        
        const snowLevel = (fl != null) ? Math.max(0, fl - 300) : null;

        return {
            time: weatherData.hourly.time[idx],
            temp: weatherData.hourly.temperature_2m[idx],
            rain: weatherData.hourly.precipitation_probability?.[idx],
            snowLevel,
            precip: weatherData.hourly.precipitation[idx],
            wind: weatherData.hourly.wind_speed_10m[idx],
            humidity: weatherData.hourly.relative_humidity_2m[idx],
        };
    });
  }, [weatherData, dayIndices]);

  const comparisonData = useMemo(() => {
      if (!weatherData?.hourlyComparison || dayIndices.length === 0) return null;

      const extract = (modelArr: Record<string, unknown>[]) => {
          if (!modelArr?.length) return [];
          return dayIndices.map((idx: number) => {
              const d = modelArr[idx];
              if (!d) return null;
              return {
                  time: weatherData.hourly.time[idx],
                  temp: d.temperature_2m,
                  rain: d.precipitation_probability,
                  wind: d.wind_speed_10m,
                  humidity: d.relative_humidity_2m
              };
          }).filter((item): item is NonNullable<typeof item> => item !== null);
      };

      return {
          gfs: extract(weatherData.hourlyComparison.gfs),
          icon: extract(weatherData.hourlyComparison.icon)
      };
  }, [weatherData, dayIndices]);

  const snowLevelText = useMemo(() => {
     const levels = hourlyData
        .map(d => d.snowLevel)
        .filter((l: number | null): l is number => l != null);
        
     if (levels.length === 0) return "---";
     
     const min = Math.round(Math.min(...levels));
     const max = Math.round(Math.max(...levels));
     
     if (min > 4500) return "> 4500m";
     if (Math.abs(max - min) < 50) return `${min}m`;
     return `${min} - ${max}m`;
  }, [hourlyData]);

  return { dayData, hourlyData, comparisonData, snowLevelText };
};