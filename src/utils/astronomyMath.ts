// src/utils/astronomyMath.ts
// Càlculs astronòmics purs per al modal Lunar (i el formatador d'hora i els punts cardinals que també fa
// servir el modal Cicle solar, que té els seus propis càlculs del sol a utils/solar/). Sense React ni i18n runtime.
//
// NOTA CRÍTICA DE VERSIÓ: el `suncalc` instal·lat (2.0.1) ja retorna azimut/altitud en GRAUS,
// amb azimut ja orientat des del NORD en sentit horari (0=N, 90=E, 180=S, 270=O) — vegeu
// node_modules/suncalc/index.d.ts. Aquesta és una convenció diferent de l'antiga v1 (radians,
// mesurats des del sud) que documenten moltes guies antigues. NO cal cap conversió: els valors
// de `getPosition`/`getMoonPosition` es fan servir directes. `getMoonIllumination().angle` també
// ja ve en graus a la v2 (no radians).
import * as SunCalc from 'suncalc';
import { getMoonPhase } from './weatherMath';
import { Language } from '../translations';

// --- Aritmètica de dates locals ("YYYY-MM-DD" -> "YYYY-MM-DD" + N dies) ---
// Ancoratge a migdia UTC (mateixa tècnica que la resta del fitxer) per evitar que sumar
// dies caigui just a la vora d'un canvi de dia per l'efecte d'un desplaçament horari.
export function addDaysToDateStr(dateStr: string | undefined, days: number): string | undefined {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(dateStr || '');
  if (!m) return undefined;
  const anchor = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 12, 0, 0));
  const shifted = new Date(anchor.getTime() + days * 86400000);
  const yyyy = shifted.getUTCFullYear();
  const mm = String(shifted.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(shifted.getUTCDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

// --- Posició (azimut/altitud) ---

export interface CompassReading {
  azimuthDeg: number;   // 0-360, des del Nord, sentit horari
  altitudeDeg: number;  // -90..90, positiu = sobre l'horitzó
}

export interface MoonCompassReading extends CompassReading {
  distanceKm: number;
}

const isValidCoord = (lat: number, lon: number) =>
  typeof lat === 'number' && !isNaN(lat) && typeof lon === 'number' && !isNaN(lon);

export function getMoonCompassPosition(instant: Date, lat: number, lon: number): MoonCompassReading | null {
  if (!isValidCoord(lat, lon) || isNaN(instant.getTime())) return null;
  try {
    const p = SunCalc.getMoonPosition(instant, lat, lon);
    return { azimuthDeg: p.azimuth, altitudeDeg: p.altitude, distanceKm: p.distance };
  } catch {
    return null;
  }
}

// --- Etiqueta cardinal de 16 punts ---

const CARDINAL_16: Record<Language, string[]> = {
  ca: ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSO', 'SO', 'OSO', 'O', 'ONO', 'NO', 'NNO'],
  es: ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSO', 'SO', 'OSO', 'O', 'ONO', 'NO', 'NNO'],
  en: ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'],
  fr: ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSO', 'SO', 'OSO', 'O', 'ONO', 'NO', 'NNO'],
};

export function getCardinalLabel(azimuthDeg: number, lang: Language): string {
  const dict = CARDINAL_16[lang] || CARDINAL_16.ca;
  if (typeof azimuthDeg !== 'number' || isNaN(azimuthDeg)) return '--';
  const normalized = ((azimuthDeg % 360) + 360) % 360;
  const idx = Math.round(normalized / 22.5) % 16;
  return dict[idx];
}

// --- Formatador d'hora (Date -> "HH:MM" en un fus horari concret) ---

export function formatClockTime(date: Date | null | undefined, timezone?: string): string | null {
  if (!date || isNaN(date.getTime())) return null;
  try {
    const tz = typeof timezone === 'string' && timezone.trim() !== ''
      ? timezone
      : Intl.DateTimeFormat().resolvedOptions().timeZone;
    return new Intl.DateTimeFormat('ca-ES', { timeZone: tz, hour: '2-digit', minute: '2-digit', hour12: false }).format(date);
  } catch {
    return null;
  }
}

// --- Sortida/posta de lluna per a un dia local concret, amb detecció "+1d" ---
// Reimplementa (mateixa tècnica, no compartida per no arriscar una regressió a MoonWidget.tsx)
// la finestra de 3 dies + comparació via Intl.DateTimeFormat de MoonWidget.tsx:73-125.

export interface RiseSetEvent {
  date: Date | null;       // Instant exacte — cal per calcular l'azimut en aquell moment
  formatted: string | null; // "HH:MM" en el fus horari destí
  isNextDay: boolean;
}

const EMPTY_EVENT: RiseSetEvent = { date: null, formatted: null, isNextDay: false };

export function getMoonRiseSetForDate(
  localDateStr: string | undefined, lat: number, lon: number, timezone?: string
): { rise: RiseSetEvent; set: RiseSetEvent } {
  const result = { rise: { ...EMPTY_EVENT }, set: { ...EMPTY_EVENT } };
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(localDateStr || '');
  if (!isValidCoord(lat, lon) || !m) return result;

  try {
    const tz = typeof timezone === 'string' && timezone.trim() !== ''
      ? timezone
      : Intl.DateTimeFormat().resolvedOptions().timeZone;
    const targetDateStr = `${m[1]}-${m[2]}-${m[3]}`;
    const anchor = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 12, 0, 0));
    const yesterday = new Date(anchor.getTime() - 86400000);
    const tomorrow = new Date(anchor.getTime() + 86400000);

    const dateFormatter = new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' });

    const getTimes = (d: Date) => SunCalc.getMoonTimes(d, lat, lon);
    const isDate = (d: unknown): d is Date => d instanceof Date && !isNaN(d.getTime());

    const allRises = [getTimes(yesterday).rise, getTimes(anchor).rise, getTimes(tomorrow).rise].filter(isDate);
    const allSets = [getTimes(yesterday).set, getTimes(anchor).set, getTimes(tomorrow).set].filter(isDate);

    let localRise = allRises.find(d => dateFormatter.format(d) === targetDateStr);
    let localSet = allSets.find(d => dateFormatter.format(d) === targetDateStr);
    let isNextDayRise = false;
    let isNextDaySet = false;

    if (!localRise) {
      localRise = allRises.find(d => dateFormatter.format(d) > targetDateStr);
      if (localRise) isNextDayRise = true;
    }
    if (!localSet) {
      localSet = allSets.find(d => dateFormatter.format(d) > targetDateStr);
      if (localSet) isNextDaySet = true;
    }

    if (localRise) result.rise = { date: localRise, formatted: formatClockTime(localRise, tz), isNextDay: isNextDayRise };
    if (localSet) result.set = { date: localSet, formatted: formatClockTime(localSet, tz), isNextDay: isNextDaySet };
  } catch {
    // Deixem el resultat buit (fallback Risc Zero)
  }

  return result;
}

// --- Fase / il·luminació lunar (font única: getMoonPhase, no SunCalc.getMoonIllumination) ---
// El giny compacte (ExpertWidgets.tsx) fa servir la mateixa funció i la mateixa edat
// (getMoonAgeDays de lunarPhases.ts): giny i modal no poden mostrar dues fases diferents.

export function getMoonIlluminationPercent(phase: number): number {
  if (typeof phase !== 'number' || isNaN(phase)) return 0;
  return Math.round(((1 - Math.cos(phase * 2 * Math.PI)) / 2) * 100);
}

// --- Pròxima lluna plena / nova (escaneig dia a dia, granularitat diària només) ---

export interface NextMoonEvent { type: 'full' | 'new'; date: Date; daysAhead: number; }

export function getNextMoonEvent(type: 'full' | 'new', fromDate: Date = new Date(), maxDays = 45): NextMoonEvent | null {
  if (isNaN(fromDate.getTime())) return null;
  const dayMs = 86400000;
  const day0 = new Date(Date.UTC(fromDate.getUTCFullYear(), fromDate.getUTCMonth(), fromDate.getUTCDate(), 12, 0, 0));

  // Es comença comparant amb el migdia d'AHIR: un esdeveniment d'avui abans de les 12 UTC (més a prop del
  // migdia d'avui que del d'ahir) és "avui". Abans el primer tram era avui→demà i aquell cas saltava a la
  // lunació següent (p. ex. el 26-10-2026, plena a les 04:12 UTC, deia "en 29 dies").
  let prevPhase = getMoonPhase(new Date(day0.getTime() - dayMs));
  for (let i = 0; i <= maxDays; i++) {
    const d = new Date(day0.getTime() + i * dayMs);
    const phase = getMoonPhase(d);

    const crossed = type === 'full'
      ? (prevPhase < 0.5 && phase >= 0.5)
      : (prevPhase - phase > 0.5); // salt de ~0.97 a ~0.02 (embolcall 1->0)

    if (crossed) {
      const distTo = (p: number) => type === 'full' ? Math.abs(p - 0.5) : Math.min(p, 1 - p);
      const chosenDay = distTo(phase) <= distTo(prevPhase) ? i : i - 1;
      // chosenDay = -1: l'esdeveniment va ser ahir, ja ha passat; es continua cap al següent.
      if (chosenDay >= 0) return { type, date: new Date(day0.getTime() + chosenDay * dayMs), daysAhead: chosenDay };
    }
    prevPhase = phase;
  }
  return null;
}

// --- Distància Terra-Lluna: categorització amb llindars populars (no astronomia de precisió) ---

export const MOON_DISTANCE_REF = {
  PERIGEE_EXTREME_KM: 356500,
  SUPERMOON_KM: 360000,
  MICROMOON_KM: 405000,
  APOGEE_EXTREME_KM: 406700,
} as const;

export type MoonDistanceCategory = 'supermoon' | 'micromoon' | 'normal';

export function getMoonDistanceCategory(distanceKm: number): MoonDistanceCategory {
  if (typeof distanceKm !== 'number' || isNaN(distanceKm)) return 'normal';
  if (distanceKm <= MOON_DISTANCE_REF.SUPERMOON_KM) return 'supermoon';
  if (distanceKm >= MOON_DISTANCE_REF.MICROMOON_KM) return 'micromoon';
  return 'normal';
}

// 0 = perigeu (més a prop), 100 = apogeu (més lluny) — per a la barra de rang.
export function getMoonDistanceGaugePercent(distanceKm: number): number {
  if (typeof distanceKm !== 'number' || isNaN(distanceKm)) return 50;
  const { PERIGEE_EXTREME_KM, APOGEE_EXTREME_KM } = MOON_DISTANCE_REF;
  const pct = ((distanceKm - PERIGEE_EXTREME_KM) / (APOGEE_EXTREME_KM - PERIGEE_EXTREME_KM)) * 100;
  return Math.max(0, Math.min(100, pct));
}

// --- Heurística experimental de "qualitat de posta" (mai un fet, sempre un estimat) ---
// Doctrina Risc Zero: retorna null si falta qualsevol dada d'entrada — mai un número fabricat.

export function estimateSunsetQuality(
  midCloudPct: number | null | undefined,
  highCloudPct: number | null | undefined,
  humidityPct: number | null | undefined
): number | null {
  if (typeof midCloudPct !== 'number' || isNaN(midCloudPct)) return null;
  if (typeof highCloudPct !== 'number' || isNaN(highCloudPct)) return null;
  if (typeof humidityPct !== 'number' || isNaN(humidityPct)) return null;

  // Heurística: una mica de núvol mitjà/alt dispersa i acoloreix la llum (ideal ~45% de mitjana);
  // ni un cel completament tapat ni completament net donen postes espectaculars. La humitat alta
  // (boirina) apaga els colors.
  const avgCloud = (midCloudPct + highCloudPct) / 2;
  const cloudScore = 100 - Math.abs(45 - avgCloud) * (100 / 55);
  const humidityPenalty = Math.max(0, humidityPct - 60) * 0.5;
  return Math.round(Math.max(0, Math.min(100, cloudScore - humidityPenalty)));
}
