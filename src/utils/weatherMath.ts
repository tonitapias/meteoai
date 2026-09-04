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
 * Com extractValidNum, però per a un índex d'un array: null si l'array no
 * existeix, l'índex és fora de rang, o el valor no és un número vàlid.
 */
export const extractValidArrayNum = (arr: unknown, index: number): number | null => {
    if (!Array.isArray(arr)) return null;
    return extractValidNum(arr[index]);
};

/**
 * Extreu un número vàlid d'un array en un índex donat, o retorna el fallback.
 * [NETEJA] Abans hi havia 3 còpies locals idèntiques d'aquesta mateixa funció
 * (ForecastSection.tsx, DayDetailModal.tsx, Forecast24h.tsx) amb noms diferents
 * (getSafeArrayNum/getSafeArrNum/getSafeNum).
 */
export const getSafeArrayNum = (arr: unknown, index: number, fallback: number = 0): number => {
    if (!Array.isArray(arr)) return fallback;
    const val = arr[index];
    return (typeof val === 'number' && !isNaN(val)) ? val : fallback;
};

/**
 * Extreu el mes (0-indexat, com Date.getMonth()) directament d'un string ISO
 * per slicing, sense passar per `new Date()` i el fus horari del navegador.
 * [NETEJA] Abans hi havia 3 còpies locals idèntiques (ForecastSection.tsx,
 * DayDetailModal.tsx, useDayDetailData.ts).
 */
export const getSafeMonthFromIso = (isoString: string | undefined): number => {
    if (!isoString || isoString.length < 7) return new Date().getMonth();
    const monthNum = parseInt(isoString.slice(5, 7), 10);
    return (!isNaN(monthNum) && monthNum >= 1 && monthNum <= 12) ? monthNum - 1 : new Date().getMonth();
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
/**
 * [FIX PRECISIÓ] Aquesta funció acceptava antigament un offset numèric (segons)
 * a més d'un nom de fus IANA, però cap crida real n'ha fet mai ús — l'únic
 * consumidor (useWeatherCalculations.ts) sempre passa un string. S'ha retirat
 * la branca numèrica perquè era una trampa llatent: el resultat de la branca
 * de string està pensat per llegir-se amb getters *locals* (getHours...), però
 * el de la branca numèrica (basat en sumar l'offset a l'època UTC) només és
 * correcte llegit amb getters *UTC* (getUTCHours...) — si algú l'hagués cridat
 * i llegit igual que l'altra branca (com fa tot el codi existent), l'hora
 * hauria sortit desplaçada.
 */
export const getShiftedDate = (baseDate: Date, timezone: string): Date => {
  if (!timezone) return baseDate;
  try {
      return new Date(baseDate.toLocaleString("en-US", { timeZone: timezone }));
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
 * Extreu la latitud d'un objecte 'location' de tipatge feble. Necessari perquè
 * `ExtendedWeatherData['location']` es perd com a `{}` en algun punt de la
 * cadena de tipus (Omit/mapped types), com ja evidenciaven els casts locals
 * a `as LocationMeta`/`as Record<string, unknown>` repetits a diversos
 * components abans d'aquest helper.
 */
export const getSafeLatitude = (location: unknown): number | undefined => {
    if (!location || typeof location !== 'object') return undefined;
    const lat = (location as Record<string, unknown>).latitude;
    return typeof lat === 'number' && !isNaN(lat) ? lat : undefined;
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
// viu ara a utils/rules/reliabilityRules.ts, que és la que fa servir
// useCurrentConditions.ts. Aquesta còpia no tenia cap referència
// real (confirmat via weatherLogic.test.ts, que ja importa la de rules/).