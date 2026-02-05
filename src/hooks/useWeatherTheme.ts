// src/hooks/useWeatherTheme.ts
import { useMemo } from 'react';
// IMPORT DIRECTE: Tipus
import { ExtendedWeatherData } from '../types/weatherLogicTypes';

export function useWeatherTheme(
  weatherData: ExtendedWeatherData | null, 
  effectiveWeatherCode: number
) {
  
  const currentBg = useMemo(() => {
    if(!weatherData) return "from-slate-900 via-slate-900 to-indigo-950";
    const is_day = weatherData.current?.is_day;
    const isDay = is_day !== undefined ? is_day : 1; 
    
    if (effectiveWeatherCode >= 95) return "from-slate-900 via-slate-950 to-purple-950"; 
    if (effectiveWeatherCode === 0 && isDay) return "from-blue-500 via-blue-400 to-orange-300"; 
    if (effectiveWeatherCode === 0 && !isDay) return "from-slate-950 via-indigo-950 to-purple-950"; 
    return "from-slate-900 to-indigo-950";
  }, [weatherData, effectiveWeatherCode]);

  return { currentBg };
}