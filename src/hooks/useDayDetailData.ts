// src/hooks/useDayDetailData.ts
import { useMemo } from 'react';
import { ExtendedWeatherData } from '../utils/weatherLogic';

export const useDayDetailData = (
  weatherData: ExtendedWeatherData | null, 
  selectedDayIndex: number | null
) => {
  
  // 1. Dades Diàries (Hook incondicional)
  const dayData = useMemo(() => {
    // Gestió segura de nulls DINS del hook
    if (!weatherData || selectedDayIndex === null) return null;
    
    const i = selectedDayIndex;
    const daily = weatherData.daily;
    
    // Verificació extra per evitar crash si l'índex no existeix
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

  // 2. Índexs Horaris del dia
  const dayIndices = useMemo(() => {
    if (!weatherData || !dayData?.date) return [];
    
    // Assegurem format YYYY-MM-DD
    const targetDate = dayData.date.includes('T') 
      ? dayData.date.split('T')[0] 
      : dayData.date;

    return weatherData.hourly.time
      .map((t, idx) => ({ 
        datePart: t.includes('T') ? t.split('T')[0] : t, 
        idx 
      }))
      .filter(item => item.datePart === targetDate)
      .map(item => item.idx);
  }, [weatherData, dayData]);

  // 3. Dades Horàries (amb lògica de neu i fallback)
  const hourlyData = useMemo(() => {
    if (!weatherData || dayIndices.length === 0) return [];

    return dayIndices.map(idx => {
        let fl = weatherData.hourly.freezing_level_height?.[idx];
        
        // Fallback: Si no tenim cota de neu a l'Open-Meteo, busquem als models
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

  // 4. Dades Comparatives (GFS / ICON)
  const comparisonData = useMemo(() => {
      if (!weatherData?.hourlyComparison || dayIndices.length === 0) return null;

      const extract = (modelArr: Record<string, unknown>[]) => {
          if (!modelArr?.length) return [];
          return dayIndices.map(idx => {
              const d = modelArr[idx];
              if (!d) return null;
              return {
                  time: weatherData.hourly.time[idx],
                  temp: d.temperature_2m,
                  rain: d.precipitation_probability,
                  wind: d.wind_speed_10m,
                  humidity: d.relative_humidity_2m
              };
          }).filter(Boolean);
      };

      return {
          gfs: extract(weatherData.hourlyComparison.gfs),
          icon: extract(weatherData.hourlyComparison.icon)
      };
  }, [weatherData, dayIndices]);

  // 5. Text Resum Cota de Neu
  const snowLevelText = useMemo(() => {
     const levels = hourlyData
        .map(d => d.snowLevel)
        .filter((l): l is number => l != null);
        
     if (levels.length === 0) return "---";
     
     const min = Math.round(Math.min(...levels));
     const max = Math.round(Math.max(...levels));
     
     if (min > 4500) return "> 4500m";
     if (Math.abs(max - min) < 50) return `${min}m`;
     return `${min} - ${max}m`;
  }, [hourlyData]);

  return { dayData, hourlyData, comparisonData, snowLevelText };
};