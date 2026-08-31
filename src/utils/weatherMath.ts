// src/utils/weatherMath.ts

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
 * Converteix un timestamp horari d'una sèrie meteorològica (naive local, o ja absolut
 * amb 'Z'/offset) en epoch UTC real, donat el desplaçament horari (en segons) de la
 * població consultada. Centralitzat aquí perquè abans hi havia dues còpies idèntiques
 * i independents d'aquesta mateixa lògica a ConsensusModal.tsx i a ExpertWidgets.tsx
 * (isGlobalFallback) — amb el risc que un dia es corregís una i no l'altra.
 */
export const resolveHourlyEpoch = (timeStr: string, utcOffsetSeconds: number): number => {
    if (!timeStr) return NaN;
    if (timeStr.includes('Z') || timeStr.match(/[+-]\d{2}:?\d{2}$/)) {
        return new Date(timeStr).getTime();
    }
    return new Date(timeStr + 'Z').getTime() - (utcOffsetSeconds * 1000);
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

// [NETEJA] calculateReliability s'ha retirat d'aquí: la comparació ECMWF/GFS/ICON
// viu ara a utils/rules/reliabilityRules.ts, que és la que fan servir
// useAIAnalysis.ts i useCurrentConditions.ts. Aquesta còpia no tenia cap referència
// real (confirmat via weatherLogic.test.ts, que ja importa la de rules/).