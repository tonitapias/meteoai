// src/utils/weatherMath.ts
import { StrictDailyWeather, ReliabilityResult } from '../types/weatherModels';

// --- UTILITATS MATEMÀTIQUES I FÍSIQUES ---

/**
 * Converteix qualsevol valor desconegut en un número segur.
 * Útil per evitar NaN en càlculs crítics.
 */
export const safeNum = (val: unknown, fallback: number = 0): number => {
    if (val === null || val === undefined || Number.isNaN(Number(val))) return fallback;
    return Number(val);
};

/**
 * Calcula la data/hora real aplicant el desplaçament horari (timezone).
 */
export const getShiftedDate = (baseDate: Date, timezoneOrOffset: number | string): Date => {
  if (typeof timezoneOrOffset === 'number') {
      const utcTimestamp = baseDate.getTime(); 
      return new Date(utcTimestamp + (timezoneOrOffset * 1000));
  }
  if (!timezoneOrOffset) return baseDate;
  try {
      return new Date(baseDate.toLocaleString("en-US", { timeZone: timezoneOrOffset as string }));
  } catch {
      return baseDate;
  }
};

/**
 * Fórmula de Magnus-Tetens per calcular el Punt de Rosada.
 * T = Temperatura (ºC), RH = Humitat Relativa (%)
 */
export const calculateDewPoint = (T: number, RH: number): number => {
  const a = 17.27, b = 237.7;
  const safeRH = Math.max(RH, 1);
  const alpha = ((a * T) / (b + T)) + Math.log(safeRH / 100.0);
  return (b * alpha) / (a - alpha);
};

/**
 * Algorisme simple per calcular la fase lunar (0.0 a 1.0).
 */
export const getMoonPhase = (date: Date): number => {
  let year = date.getFullYear();
  let month = date.getMonth() + 1;
  // eslint-disable-next-line prefer-const
  let day = date.getDate(); 
  
  if (month < 3) { year--; month += 12; }
  const c = 365.25 * year, e = 30.6 * month;
  const jd = c + e + day - 694039.09; 
  let phase = jd / 29.5305882; 
  phase -= Math.floor(phase); 
  return phase; 
};

/**
 * Compara els 3 grans models (ECMWF, GFS, ICON) per determinar la fiabilitat.
 * Retorna 'high', 'medium' o 'low' basant-se en la divergència.
 */
export const calculateReliability = (
    dailyBest: StrictDailyWeather, 
    dailyGFS: StrictDailyWeather, 
    dailyICON: StrictDailyWeather, 
    dayIndex: number = 0
): ReliabilityResult => {
  if (!dailyGFS || !dailyICON || !dailyBest) {
      return { level: 'medium', type: 'general', value: 0 }; 
  }
  
  const t1 = safeNum(dailyBest.temperature_2m_max?.[dayIndex]);
  const t2 = safeNum(dailyGFS.temperature_2m_max?.[dayIndex]);
  const t3 = safeNum(dailyICON.temperature_2m_max?.[dayIndex]);
  const diffTemp = Math.max(t1, t2, t3) - Math.min(t1, t2, t3);
  
  const p1 = safeNum(dailyBest.precipitation_sum?.[dayIndex]);
  const p2 = safeNum(dailyGFS.precipitation_sum?.[dayIndex]);
  const p3 = safeNum(dailyICON.precipitation_sum?.[dayIndex]);
  const diffPrecip = Math.max(p1, p2, p3) - Math.min(p1, p2, p3);

  if (diffTemp > 5) {
      return { level: 'low', type: 'temp', value: diffTemp.toFixed(1) };
  }
  if (diffPrecip > 10) {
      return { level: 'low', type: 'precip', value: diffPrecip.toFixed(1) };
  }
  
  if (diffTemp > 2 || diffPrecip > 3) {
      return { level: 'medium', type: 'divergent', value: 0 };
  }
  
  return { level: 'high', type: 'ok', value: 0 };
};