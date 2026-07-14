// src/utils/weatherMath.ts
import { StrictDailyWeather, ReliabilityResult } from '../types/weatherModels';

// --- UTILITATS MATEMÀTIQUES I FÍSIQUES (DOCTRINA RISC ZERO) ---

/**
 * Extreu un número vàlid o retorna null. 
 * MAI forcem un '0' davant d'una dada perduda, ja que en meteo el '0' és un valor real (0ºC, 0mm).
 */
export const extractValidNum = (val: unknown): number | null => {
    if (val === null || val === undefined || val === '') return null;
    const num = Number(val);
    if (Number.isNaN(num)) return null;
    return num;
};

/**
 * @deprecated Utilitzeu extractValidNum per a nous desenvolupaments.
 * PONT TÀCTIC: Es manté per evitar la caiguda dels 14 arxius del motor de regles antic.
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
  const safeRH = Math.max(RH, 1); // Evita divisions per zero o logaritmes de negatius
  const alpha = ((a * T) / (b + T)) + Math.log(safeRH / 100.0);
  return (b * alpha) / (a - alpha);
};

/**
 * Calcula la fase lunar (0.0 a 1.0) amb precisió astronòmica.
 * Algoritme basat en Julian Date (JD) i cicle sinòdic mitjà.
 */
export const getMoonPhase = (date: Date): number => {
  const jd = (date.getTime() / 86400000) + 2440587.5;
  const cycles = (jd - 2451550.1) / 29.530588853;
  let phase = cycles - Math.floor(cycles);
  if (phase < 0) phase += 1;
  return phase; 
};

/**
 * Comprova si les coordenades són dins de l'àrea de cobertura AROME (Europa Occidental)
 */
export const isAromeSupported = (lat: number | null | undefined, lon: number | null | undefined): boolean => {
    if (!lat || !lon) return false;
    const MIN_LAT = 38.0, MAX_LAT = 53.0, MIN_LON = -8.0, MAX_LON = 12.0; 
    return (lat >= MIN_LAT && lat <= MAX_LAT && lon >= MIN_LON && lon <= MAX_LON);
};

/**
 * Compara els 3 grans models (ECMWF, GFS, ICON) per determinar la fiabilitat.
 * Protegit contra matrius buides i errors de model (forats de dades).
 */
export const calculateReliability = (
    dailyBest?: StrictDailyWeather | null, 
    dailyGFS?: StrictDailyWeather | null, 
    dailyICON?: StrictDailyWeather | null, 
    dayIndex: number = 0
): ReliabilityResult => {
    
    // 1. Extracció segura de dades per al dia sol·licitat, filtrant els nulls
    const validTemps = [
        extractValidNum(dailyBest?.temperature_2m_max?.[dayIndex]),
        extractValidNum(dailyGFS?.temperature_2m_max?.[dayIndex]),
        extractValidNum(dailyICON?.temperature_2m_max?.[dayIndex])
    ].filter((t): t is number => t !== null);

    const validPrecips = [
        extractValidNum(dailyBest?.precipitation_sum?.[dayIndex]),
        extractValidNum(dailyGFS?.precipitation_sum?.[dayIndex]),
        extractValidNum(dailyICON?.precipitation_sum?.[dayIndex])
    ].filter((p): p is number => p !== null);

    // 2. Si no tenim dades suficients per comparar com a mínim 2 models, declarem incertesa
    if (validTemps.length < 2 && validPrecips.length < 2) {
        return { level: 'medium', type: 'general', value: 0 }; 
    }
    
    // 3. Càlcul de divergències protegit contra Infinity (Math.max amb matrius buides)
    const diffTemp = validTemps.length >= 2 
        ? Math.max(...validTemps) - Math.min(...validTemps) 
        : 0;
        
    const diffPrecip = validPrecips.length >= 2 
        ? Math.max(...validPrecips) - Math.min(...validPrecips) 
        : 0;

    // 4. Avaluació dels llindars
    if (diffTemp > 5) {
        return { level: 'low', type: 'temp', value: Number(diffTemp.toFixed(1)) };
    }
    if (diffPrecip > 10) {
        return { level: 'low', type: 'precip', value: Number(diffPrecip.toFixed(1)) };
    }
    
    if (diffTemp > 2 || diffPrecip > 3) {
        return { level: 'medium', type: 'divergent', value: 0 };
    }
    
    return { level: 'high', type: 'ok', value: 0 };
};