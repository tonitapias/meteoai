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
 * Calcula la fase lunar (0.0 a 1.0) amb precisió astronòmica.
 * Algoritme basat en Julian Date (JD) i cicle sinòdic mitjà.
 * * 0.00 = Lluna Nova
 * 0.25 = Quart Creixent
 * 0.50 = Lluna Plena
 * 0.75 = Quart Minvant
 */
export const getMoonPhase = (date: Date): number => {
  // 1. Convertim a Julian Date (Dies des de l'època Julian: 1 de gener 4713 aC a les 12:00)
  // getTime() ens dona ms des de 1970-01-01. 1 dia = 86400000 ms.
  // JD a 1970-01-01 00:00 UTC = 2440587.5
  const jd = (date.getTime() / 86400000) + 2440587.5;
  
  // 2. Referència: Lluna Nova coneguda (6 de Gener de 2000 a les 18:14 UTC) -> JD = 2451550.1
  // Cicle Sinòdic Mitjà (Mes Lunar): 29.530588853 dies
  const cycles = (jd - 2451550.1) / 29.530588853;
  
  // 3. Extraiem la part decimal (la fase actual dins del cicle)
  let phase = cycles - Math.floor(cycles);
  
  // Normalització (assegurar 0..1)
  if (phase < 0) phase += 1;
  
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