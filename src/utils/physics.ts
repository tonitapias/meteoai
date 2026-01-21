// src/utils/physics.ts

/**
 * Utilitat per assegurar que un valor és un número vàlid
 */
export const safeNum = (val: unknown, fallback: number = 0): number => {
    if (val === null || val === undefined || Number.isNaN(Number(val))) return fallback;
    return Number(val);
};

/**
 * Ajusta una data segons la zona horària o l'offset
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
 * Calcula el Punt de Rosada (Dew Point) basat en la temperatura i la humitat
 * Fórmula de Magnus-Tetens
 */
export const calculateDewPoint = (T: number, RH: number): number => {
  const a = 17.27, b = 237.7;
  const safeRH = Math.max(RH, 1);
  const alpha = ((a * T) / (b + T)) + Math.log(safeRH / 100.0);
  return (b * alpha) / (a - alpha);
};

/**
 * Calcula la fase lunar (0.0 a 1.0) per a una data donada
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
 * Comprova si les coordenades són dins de l'àrea de cobertura AROME (Europa Occidental)
 */
export const isAromeSupported = (lat: number, lon: number): boolean => {
    if (!lat || !lon) return false;
    const MIN_LAT = 38.0, MAX_LAT = 53.0, MIN_LON = -8.0, MAX_LON = 12.0; 
    return (lat >= MIN_LAT && lat <= MAX_LAT && lon >= MIN_LON && lon <= MAX_LON);
};