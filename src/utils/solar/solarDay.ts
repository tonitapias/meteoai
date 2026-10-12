// src/utils/solar/solarDay.ts
// Model d'un dia solar local per al modal Cicle solar: ancoratge del dia (DST i línia de canvi de
// data), sortida/posta resoltes (Open-Meteo si quadra amb l'astronomia), fases de llum, creuaments
// de −4°, esdeveniments i estats de les cel·les d'efemèrides. Pur, sense React.
//
// suncalc 2.0.1: getPosition() dona l'alçada APARENT (amb refracció); els llindars de getTimes()
// són GEOMÈTRICS. Per això tota classificació de fase i tot creuament passa per geometricAltitude().
import * as SunCalc from 'suncalc';
import { daylightSeconds } from '../daylight';
import {
  type ZoneCtx, addDays, clockForLocalMinute, dayDstShift, diffDays, localClock, localClockMinute,
  localDateOf, wallTimeToUtcMs, zonedDayStartMs,
} from './solarTime';

export type LightPhase = 'day' | 'golden' | 'blue' | 'nautical' | 'astro' | 'night';
//  day ≥ 6 | golden [−4,6) | blue [−6,−4) | nautical [−12,−6) | astro [−18,−12) | night < −18  (alçada GEOMÈTRICA)
export type MarkerTone = 'day' | 'golden' | 'below';        // ≥6 | (−0.833,6) | ≤ −0.833
export type EventKey = 'astroDawn' | 'nauticalDawn' | 'civilDawn' | 'goldenStartAM' | 'sunrise' | 'goldenEndAM' | 'noon'
  | 'goldenStartPM' | 'sunset' | 'blueStartPM' | 'civilDusk' | 'nauticalDusk' | 'astroDusk';
export type TextKey = EventKey | 'nadir' | 'minus4AM' | 'minus4PM';
export interface TimeText { text: string; shift: -1 | 0 | 1 }       // shift = dia local respecte de dateStr

export interface SolarDayModel {
  dateStr: string; lat: number; lon: number; zone: ZoneCtx;
  startMs: number; endMs: number; spanMin: number;                   // 1380..1500
  /** Minut del rellotge local a startMs: 0, o 60 el dia que el canvi d'hora és a les 00:00 (Santiago, Beirut...). */
  startLocalMin: number;
  dst: { atMin: number; deltaMin: number } | null;                   // ≤1 canvi d'hora dins del dia
  altApp: Float32Array;                                               // 97 mostres aparents a startMs + i*span/96 (buit en lite)
  hourTicks: { min: number; label: HourLabel }[];                     // buit en lite
  t: Record<EventKey | 'nadir', number | null>;                       // ms; sunrise/sunset = parell RESOLT
  riseSetSource: 'openMeteo' | 'astronomy';
  riseLabel: TimeText | null; setLabel: TimeText | null;              // OM: l'HH:MM del mateix text
  riseAz: number | null; setAz: number | null;
  noonMin: number; noonAltApp: number; noonGeo: number; nadirAltApp: number; nadirGeo: number;
  polar: 'none' | 'day' | 'night';
  dayLengthSec: number | null;      // parell resolt; polar 86400 / 0
  astroLengthSec: number | null;    // només suncalc; polar 86400 / 0 — per a la Δ
  usefulLightSec: number | null;
  text: Partial<Record<TextKey, TimeText>>;                           // preformatat (buit en lite)
  lite: boolean;
}

export type HourLabel = '00' | '03' | '06' | '09' | '12' | '15' | '18' | '21' | '24';
const HOUR_LABELS: readonly HourLabel[] = ['00', '03', '06', '09', '12', '15', '18', '21', '24'];

export const EVENT_KEYS: readonly EventKey[] = [
  'astroDawn', 'nauticalDawn', 'civilDawn', 'goldenStartAM', 'sunrise', 'goldenEndAM', 'noon',
  'goldenStartPM', 'sunset', 'blueStartPM', 'civilDusk', 'nauticalDusk', 'astroDusk',
];

const MIN_MS = 60000;
const HALF_DAY_MS = 43200000;
const SAMPLES = 96;
/** Alçada geomètrica del centre del Sol a la sortida/posta (refracció + semidiàmetre), la de suncalc. */
export const RISE_SET_GEO = -0.833;
const OM_TOLERANCE_MS = 10 * MIN_MS;

type SunTimes = ReturnType<typeof SunCalc.getTimes>;

// --- Refracció i fases ---

const RAD = Math.PI / 180;
/** Refracció de suncalc (Meeus 16.4) en graus per a una alçada geomètrica en graus (h < 0 => h = 0, com suncalc). */
export const refractionDeg = (hDeg: number): number => {
  const h = Math.max(0, hDeg) * RAD;
  return (0.0002967 / Math.tan(h + 0.00312536 / (h + 0.08901179))) / RAD;
};
/** Refracció a l'horitzó (≈ 0.484°): per sota d'aquí l'alçada aparent és la geomètrica + aquesta constant. */
const R0 = refractionDeg(0);

/** Alçada geomètrica a partir de l'aparent de getPosition (inverteix la refracció de suncalc). */
export function geometricAltitude(apparentDeg: number): number {
  if (apparentDeg <= R0) return apparentDeg - R0;
  let h = apparentDeg;
  for (let i = 0; i < 4; i++) h = apparentDeg - refractionDeg(h);
  return h;
}

/** Fase de llum per alçada geomètrica (llindars inclosos per dalt: 6 => dia, −4 => daurada, −6 => blava). */
export function lightPhase(geoDeg: number): LightPhase {
  if (geoDeg >= 6) return 'day';
  if (geoDeg >= -4) return 'golden';
  if (geoDeg >= -6) return 'blue';
  if (geoDeg >= -12) return 'nautical';
  if (geoDeg >= -18) return 'astro';
  return 'night';
}

/** To del marcador del sol: ple dia, sol baix (daurat) o sota l'horitzó (mateixa definició que la sortida). */
export function markerTone(geoDeg: number): MarkerTone {
  if (geoDeg >= 6) return 'day';
  return geoDeg > RISE_SET_GEO ? 'golden' : 'below';
}

const geoAt = (ms: number, lat: number, lon: number): number =>
  geometricAltitude(SunCalc.getPosition(new Date(ms), lat, lon).altitude);

// --- Ancoratge del dia local ---

/**
 * getTimes() del dia local [start, end): ancora al mig del dia, verifica que el migdia solar hi cau i,
 * si no, reancora ±1 dia (Auckland necessita +1; ancorar a migdia UTC falla a Apia, Kiritimati i Chatham).
 */
export function sunTimesForLocalDay(start: number, end: number, lat: number, lon: number): SunTimes | null {
  for (const k of [0, 1, -1]) {
    const t = SunCalc.getTimes(new Date((start + end) / 2 + k * 86400000), lat, lon);
    const noon = t.solarNoon.getTime();
    if (noon >= start && noon < end) return t;
  }
  return null;
}

const msOf = (d: unknown): number | null =>
  d instanceof Date && Number.isFinite(d.getTime()) ? d.getTime() : null;

const polarOf = (sc: SunTimes): 'none' | 'day' | 'night' =>
  sc.alwaysUp === true ? 'day' : sc.alwaysDown === true ? 'night' : 'none';

/** Mitjanit solar dins del dia: migdia − 12 h si encara és dins, si no migdia + 12 h. */
export function nadirInDay(noonMs: number, startMs: number): number {
  return noonMs - HALF_DAY_MS >= startMs ? noonMs - HALF_DAY_MS : noonMs + HALF_DAY_MS;
}

// --- Sortida i posta: una sola font per dia ---

const OM_RE = /^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2})/;

export interface ResolvedEdges {
  source: 'openMeteo' | 'astronomy';
  rise: number | null;
  set: number | null;
  /** Només Open-Meteo: l'HH:MM tal com ve al text (paritat exacta amb la targeta). */
  riseText: string | null;
  setText: string | null;
  /** Només Open-Meteo: la data del text, per calcular l'etiqueta ±1. */
  riseDate: string | null;
  setDate: string | null;
  dayLengthSec: number | null;
}

/**
 * Parell sortida/posta d'Open-Meteo si tots dos textos són vàlids, sortida < posta, el dia no és
 * polar i cadascun cau a ≤ 10 min de suncalc; si no, suncalc per a tots dos.
 */
export function resolveSunEdges(
  sc: SunTimes, omRise: string | null | undefined, omSet: string | null | undefined, z: ZoneCtx
): ResolvedEdges {
  const scRise = msOf(sc.sunrise);
  const scSet = msOf(sc.sunset);
  const polar = polarOf(sc);
  const mr = typeof omRise === 'string' ? OM_RE.exec(omRise) : null;
  const msOm = typeof omSet === 'string' ? OM_RE.exec(omSet) : null;
  if (mr && msOm && polar === 'none' && scRise !== null && scSet !== null) {
    const r = wallTimeToUtcMs(omRise, z);
    const s = wallTimeToUtcMs(omSet, z);
    if (r !== null && s !== null && r < s
      && Math.abs(r - scRise) <= OM_TOLERANCE_MS && Math.abs(s - scSet) <= OM_TOLERANCE_MS) {
      return {
        source: 'openMeteo', rise: r, set: s,
        riseText: `${mr[2]}:${mr[3]}`, setText: `${msOm[2]}:${msOm[3]}`,
        riseDate: mr[1], setDate: msOm[1],
        dayLengthSec: daylightSeconds(omRise, omSet) ?? (s - r) / 1000,
      };
    }
  }
  return {
    source: 'astronomy', rise: scRise, set: scSet,
    riseText: null, setText: null, riseDate: null, setDate: null,
    dayLengthSec: scRise !== null && scSet !== null ? (scSet - scRise) / 1000
      : polar === 'day' ? 86400 : polar === 'night' ? 0 : null,
  };
}

/** Durada astronòmica (suncalc) d'un getTimes: polar 86400 / 0. */
const astroLengthOf = (sc: SunTimes): number | null => {
  const r = msOf(sc.sunrise), s = msOf(sc.sunset);
  if (r !== null && s !== null) return (s - r) / 1000;
  const p = polarOf(sc);
  return p === 'day' ? 86400 : p === 'night' ? 0 : null;
};

/** Llum útil: del crepuscle civil del matí al del vespre; sense cap dels dos, tot el dia o res. */
export function usefulLightSec(civilDawn: number | null, civilDusk: number | null, noonGeo: number, nadirGeo: number): number | null {
  if (civilDawn !== null && civilDusk !== null) return (civilDusk - civilDawn) / 1000;
  if (civilDawn === null && civilDusk === null) {
    if (nadirGeo > -6) return 86400;
    if (noonGeo < -6) return 0;
  }
  return null;
}

// --- Creuaments d'un llindar ---

/**
 * Bisecció d'un creuament de `thr` (alçada geomètrica) dins de [lo, hi], on f(lo) i f(hi) han de quedar a
 * banda i banda. Precisió ~1 s. Null si l'interval no conté el creuament.
 */
const bisect = (lat: number, lon: number, thr: number, lo: number, hi: number, rising: boolean): number | null => {
  if (!(hi > lo)) return null;
  const below = (ms: number) => geoAt(ms, lat, lon) < thr;
  if (below(lo) !== rising || below(hi) === rising) return null;
  let a = lo, b = hi;
  for (let i = 0; i < 24 && b - a > 1000; i++) {
    const m = (a + b) / 2;
    if (below(m) === rising) a = m; else b = m;
  }
  return Math.round((a + b) / 2);
};

// Esdeveniments de getTimes() amb el seu llindar geomètric exacte: serveixen per estrènyer l'interval.
const AM_MARKS: readonly [EventKey, number][] = [['astroDawn', -18], ['nauticalDawn', -12], ['civilDawn', -6], ['goldenEndAM', 6]];
const PM_MARKS: readonly [EventKey, number][] = [['goldenStartPM', 6], ['civilDusk', -6], ['nauticalDusk', -12], ['astroDusk', -18]];

/**
 * Creuament ascendent (abans del migdia) i descendent (després) d'un llindar geomètric. Entre la mitjanit
 * i el migdia solars l'alçada és monòtona: el creuament es busca a [migdia − 12 h, migdia] i
 * [migdia, migdia + 12 h], de manera que, igual que getTimes(), pot caure fora del dia local (etiqueta ±1).
 * L'interval s'estreny amb els esdeveniments coneguts (crepuscles, ±6°) i, si n'hi ha, amb les mostres.
 */
export function findCrossings(
  model: Pick<SolarDayModel, 'lat' | 'lon' | 'startMs' | 'endMs' | 'altApp' | 't'>, thr: number
): { up: number | null; down: number | null } {
  const { t, lat, lon } = model;
  const noon = t.noon;
  if (noon === null) return { up: null, down: null };
  let upLo = noon - HALF_DAY_MS, upHi = noon, dnLo = noon, dnHi = noon + HALF_DAY_MS;
  for (const [k, h] of AM_MARKS) {
    const ms = t[k];
    if (ms === null || ms < upLo || ms > upHi || h === thr) continue;
    if (h < thr) upLo = Math.max(upLo, ms); else upHi = Math.min(upHi, ms);
  }
  for (const [k, h] of PM_MARKS) {
    const ms = t[k];
    if (ms === null || ms < dnLo || ms > dnHi || h === thr) continue;
    if (h > thr) dnLo = Math.max(dnLo, ms); else dnHi = Math.min(dnHi, ms);
  }
  const n = model.altApp.length;
  if (n > 1) {
    const step = (model.endMs - model.startMs) / (n - 1);
    let upSet = false, dnSet = false;
    for (let i = 0; i < n - 1; i++) {
      const a = geometricAltitude(model.altApp[i]) - thr;
      const b = geometricAltitude(model.altApp[i + 1]) - thr;
      const t0 = model.startMs + i * step, t1 = t0 + step;
      if (!upSet && a < 0 && b >= 0 && t0 >= upLo && t1 <= upHi) { upLo = t0; upHi = t1; upSet = true; }
      if (!dnSet && a >= 0 && b < 0 && t0 >= dnLo && t1 <= dnHi) { dnLo = t0; dnHi = t1; dnSet = true; }
    }
  }
  const up = bisect(lat, lon, thr, upLo, upHi, true) ?? bisect(lat, lon, thr, noon - HALF_DAY_MS, noon, true);
  const down = bisect(lat, lon, thr, dnLo, dnHi, false) ?? bisect(lat, lon, thr, noon, noon + HALF_DAY_MS, false);
  return { up, down };
}

// --- Construcció del model (amb memòria cau LRU de mòdul) ---

export interface SolarDayInput {
  dateStr: string; lat: number; lon: number; zone: ZoneCtx;
  omRise?: string | null; omSet?: string | null;
}

const CACHE_MAX = 20;
const cache = new Map<string, SolarDayModel>();

/** Buida la memòria cau de models (proves). */
export function clearSolarDayCache(): void { cache.clear(); }

const clampShift = (n: number): -1 | 0 | 1 => (n > 0 ? 1 : n < 0 ? -1 : 0);

const timeText = (ms: number, dateStr: string, z: ZoneCtx): TimeText =>
  ({ text: localClock(ms, z), shift: clampShift(diffDays(dateStr, localDateOf(ms, z))) });

/**
 * Model del dia local `dateStr`. `lite`: només hores (sense les 97 mostres, les marques horàries ni els
 * textos preformatats), per al calendari i el "demà" del compte enrere. Els models són compartits per
 * la memòria cau: no s'han de mutar. Null si la data o les coordenades no són vàlides.
 */
export function buildSolarDay(input: SolarDayInput, opts: { lite?: boolean } = {}): SolarDayModel | null {
  const { dateStr, lat, lon, zone } = input;
  const lite = opts.lite === true;
  const omRise = input.omRise ?? null, omSet = input.omSet ?? null;
  const key = `${lat}|${lon}|${zone.tz ?? ''}|${zone.fixedOffsetSec}|${dateStr}|${omRise ?? ''}|${omSet ?? ''}`;
  const hit = cache.get(key);
  if (hit && (lite || !hit.lite)) {
    cache.delete(key);
    cache.set(key, hit);
    return hit;
  }
  const model = computeSolarDay(dateStr, lat, lon, zone, omRise, omSet, lite);
  if (!model) return null;
  cache.delete(key);
  cache.set(key, model);
  while (cache.size > CACHE_MAX) {
    const oldest = cache.keys().next().value;
    if (oldest === undefined) break;
    cache.delete(oldest);
  }
  return model;
}

function computeSolarDay(
  dateStr: string, lat: number, lon: number, zone: ZoneCtx,
  omRise: string | null, omSet: string | null, lite: boolean
): SolarDayModel | null {
  if (!Number.isFinite(lat) || !Number.isFinite(lon) || Math.abs(lat) > 90) return null;
  const startMs = zonedDayStartMs(dateStr, zone);
  const endMs = zonedDayStartMs(addDays(dateStr, 1), zone);
  if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || endMs <= startMs) return null;
  const spanMin = Math.round((endMs - startMs) / MIN_MS);

  let sc: SunTimes;
  try {
    sc = sunTimesForLocalDay(startMs, endMs, lat, lon) ?? SunCalc.getTimes(new Date((startMs + endMs) / 2), lat, lon);
  } catch {
    return null;
  }
  const noonMs = sc.solarNoon.getTime();
  if (!Number.isFinite(noonMs)) return null;

  const edges = resolveSunEdges(sc, omRise, omSet, zone);
  const polar = polarOf(sc);
  const nadirMs = nadirInDay(noonMs, startMs);
  const noonAltApp = SunCalc.getPosition(new Date(noonMs), lat, lon).altitude;
  const nadirAltApp = SunCalc.getPosition(new Date(nadirMs), lat, lon).altitude;
  const noonGeo = geometricAltitude(noonAltApp);
  const nadirGeo = geometricAltitude(nadirAltApp);

  const dst = dayDstShift(startMs, endMs, zone);
  const startLocalMin = localClockMinute(startMs, zone);

  const altApp = new Float32Array(lite ? 0 : SAMPLES + 1);
  for (let i = 0; i < altApp.length; i++) {
    altApp[i] = SunCalc.getPosition(new Date(startMs + (i * (endMs - startMs)) / SAMPLES), lat, lon).altitude;
  }

  const civilDawn = msOf(sc.dawn), civilDusk = msOf(sc.dusk);
  const t: Record<EventKey | 'nadir', number | null> = {
    astroDawn: msOf(sc.nightEnd), nauticalDawn: msOf(sc.nauticalDawn), civilDawn,
    goldenStartAM: null, sunrise: edges.rise, goldenEndAM: msOf(sc.goldenHourEnd), noon: noonMs,
    goldenStartPM: msOf(sc.goldenHour), sunset: edges.set, blueStartPM: null,
    civilDusk, nauticalDusk: msOf(sc.nauticalDusk), astroDusk: msOf(sc.night), nadir: nadirMs,
  };
  const minus4 = findCrossings({ lat, lon, startMs, endMs, altApp, t }, -4);
  t.goldenStartAM = minus4.up;
  t.blueStartPM = minus4.down;

  const edgeLabel = (ms: number | null, omText: string | null, omDate: string | null): TimeText | null => {
    if (ms === null) return null;
    if (omText !== null && omDate !== null) return { text: omText, shift: clampShift(diffDays(dateStr, omDate)) };
    return timeText(ms, dateStr, zone);
  };
  const riseLabel = edgeLabel(edges.rise, edges.riseText, edges.riseDate);
  const setLabel = edgeLabel(edges.set, edges.setText, edges.setDate);

  const text: Partial<Record<TextKey, TimeText>> = {};
  if (!lite) {
    for (const k of EVENT_KEYS) {
      const ms = t[k];
      if (ms !== null) text[k] = k === 'sunrise' ? riseLabel! : k === 'sunset' ? setLabel! : timeText(ms, dateStr, zone);
    }
    text.nadir = timeText(nadirMs, dateStr, zone);
    if (t.goldenStartAM !== null) text.minus4AM = text.goldenStartAM;
    if (t.blueStartPM !== null) text.minus4PM = text.blueStartPM;
  }

  const hourTicks: { min: number; label: HourLabel }[] = [];
  if (!lite) {
    for (let i = 0; i < HOUR_LABELS.length; i++) {
      const label = HOUR_LABELS[i];
      let min: number;
      if (label === '24') min = spanMin;
      else if (dst === null && startLocalMin === 0) min = i * 180;
      else {
        const at = wallTimeToUtcMs(`${dateStr}T${label}:00`, zone);
        min = at === null ? i * 180 : Math.round((at - startMs) / MIN_MS);
      }
      hourTicks.push({ min: Math.max(0, Math.min(spanMin, min)), label });
    }
  }

  const azOf = (ms: number | null) => (ms === null ? null : SunCalc.getPosition(new Date(ms), lat, lon).azimuth);

  return {
    dateStr, lat, lon, zone, startMs, endMs, spanMin, startLocalMin, dst, altApp, hourTicks, t,
    riseSetSource: edges.source, riseLabel, setLabel,
    riseAz: azOf(edges.rise), setAz: azOf(edges.set),
    // Truncat, com totes les hores que es mostren (localClock): si s'arrodonís, el "MIGDIA" del gràfic i el
    // migdia de l'heroi i de les efemèrides dirien minuts diferents quan el migdia cau a :30 s o més.
    noonMin: Math.max(0, Math.min(spanMin, Math.floor((noonMs - startMs) / MIN_MS))),
    noonAltApp, noonGeo, nadirAltApp, nadirGeo, polar,
    dayLengthSec: edges.dayLengthSec,
    astroLengthSec: astroLengthOf(sc),
    usefulLightSec: usefulLightSec(civilDawn, civilDusk, noonGeo, nadirGeo),
    text, lite,
  };
}

/** "HH:MM" local del minut `m` del dia (taula + canvi d'hora, sense Intl: apte per a cada fotograma); m = spanMin => "24:00". */
export function clockAtMinute(model: Pick<SolarDayModel, 'spanMin' | 'startLocalMin' | 'dst'>, m: number): string {
  const r = Math.round(m);
  if (r >= model.spanMin) return '24:00';
  const shift = model.dst && r >= model.dst.atMin ? model.dst.deltaMin : 0;
  return clockForLocalMinute(model.startLocalMin + Math.max(0, r) + shift);
}

// --- Dades d'altres dies (una sola crida a getTimes) ---

const dayTimes = (dateStr: string, lat: number, lon: number, zone: ZoneCtx): SunTimes | null => {
  const s = zonedDayStartMs(dateStr, zone);
  const e = zonedDayStartMs(addDays(dateStr, 1), zone);
  if (!Number.isFinite(s) || !Number.isFinite(e) || !Number.isFinite(lat) || !Number.isFinite(lon)) return null;
  try {
    return sunTimesForLocalDay(s, e, lat, lon) ?? SunCalc.getTimes(new Date((s + e) / 2), lat, lon);
  } catch {
    return null;
  }
};

/** Durada astronòmica (s) del dia local; polar 86400 / 0. Per a la Δ respecte del dia anterior. */
export function astroLengthFor(dateStr: string, lat: number, lon: number, zone: ZoneCtx): number | null {
  const sc = dayTimes(dateStr, lat, lon, zone);
  return sc ? astroLengthOf(sc) : null;
}

/** Alçada aparent del sol al migdia solar del dia local. */
export function noonAltFor(dateStr: string, lat: number, lon: number, zone: ZoneCtx): number | null {
  const sc = dayTimes(dateStr, lat, lon, zone);
  return sc ? SunCalc.getPosition(sc.solarNoon, lat, lon).altitude : null;
}

/** Sostre de l'eix Y per a tota la finestra de 15 dies: múltiple de 10 per sobre del migdia més alt + 8°, entre 30 i 90. */
export function rangeAltMax(noonAlts: ReadonlyArray<number | null | undefined>): number {
  let max = 0;
  for (const a of noonAlts) if (typeof a === 'number' && Number.isFinite(a) && a > max) max = a;
  return Math.max(30, Math.min(90, Math.ceil((max + 8) / 10) * 10));
}

// --- Esdeveniments, compte enrere i estats ---

export interface SolarEvent { key: EventKey; ms: number }

/** Els 13 esdeveniments existents del dia, per ordre cronològic. */
export function eventList(model: Pick<SolarDayModel, 't'>): SolarEvent[] {
  const out: SolarEvent[] = [];
  for (const key of EVENT_KEYS) {
    const ms = model.t[key];
    if (ms !== null) out.push({ key, ms });
  }
  return out.sort((a, b) => a.ms - b.ms);
}

/**
 * Pròxim esdeveniment després de `nowMs` (el primer en el temps) entre els d'ahir, avui i demà. Ahir hi és
 * perquè a latituds altes a l'estiu la posta o els crepuscles del dia anterior cauen passada la mitjanit.
 */
export function nextEvent(
  nowMs: number, today: Pick<SolarDayModel, 't'>, tomorrow: Pick<SolarDayModel, 't'> | null,
  yesterday: Pick<SolarDayModel, 't'> | null = null
): (SolarEvent & { isTomorrow: boolean }) | null {
  let best: (SolarEvent & { isTomorrow: boolean }) | null = null;
  for (const [model, isTomorrow] of [[yesterday, false], [today, false], [tomorrow, true]] as const) {
    if (!model) continue;
    for (const e of eventList(model)) {
      if (e.ms > nowMs && (best === null || e.ms < best.ms)) best = { ...e, isTomorrow };
    }
  }
  return best;
}

/**
 * Objectiu del compte enrere (paritat amb la targeta): abans de sortir el sol, la sortida; de dia, la
 * posta; després de la posta, la sortida REAL de demà. Dies polars: null. Si la posta d'ahir cau passada la
 * mitjanit (latituds altes a l'estiu) i encara no ha arribat, el sol encara és fora: compte enrere a la posta.
 */
export function upcomingRiseSet(
  nowMs: number,
  today: Pick<SolarDayModel, 't' | 'polar'>,
  tomorrow: Pick<SolarDayModel, 't' | 'polar'> | null,
  yesterday: Pick<SolarDayModel, 't' | 'polar'> | null = null
): { kind: 'sunrise' | 'sunset'; ms: number } | null {
  const lateSunset = yesterday && yesterday.polar === 'none' ? yesterday.t.sunset : null;
  if (lateSunset !== null && nowMs < lateSunset) return { kind: 'sunset', ms: lateSunset };
  if (today.polar !== 'none') return null;
  const { sunrise, sunset } = today.t;
  if (sunrise !== null && nowMs < sunrise) return { kind: 'sunrise', ms: sunrise };
  if (sunset !== null && nowMs < sunset) return { kind: 'sunset', ms: sunset };
  const next = tomorrow && tomorrow.polar === 'none' ? tomorrow.t.sunrise : null;
  return next !== null && next > nowMs ? { kind: 'sunrise', ms: next } : null;
}

export type CellId = 'astroAM' | 'nauticalAM' | 'civilAM' | 'blueAM' | 'goldenAM' | 'sunrise' | 'noon'
  | 'goldenPM' | 'sunset' | 'bluePM' | 'civilPM' | 'nauticalPM' | 'astroPM' | 'nadir';
export type CellState = 'past' | 'cur' | 'next';

/**
 * Estat de cada cel·la de les efemèrides (només avui): 'past' si ja ha passat, 'cur' si ara és dins d'un
 * interval (hora daurada/blava) i 'next' per a la primera que ha d'arribar. Les cel·les futures que no són
 * la pròxima no hi surten. Hora daurada sense +6° però amb els dos −4° (fusionada): l'estat va a 'goldenAM'.
 */
export function ephemerisCellStates(model: Pick<SolarDayModel, 't'>, nowMs: number): Partial<Record<CellId, CellState>> {
  const t = model.t;
  const merged = t.goldenEndAM === null && t.goldenStartPM === null && t.goldenStartAM !== null && t.blueStartPM !== null;
  const points: [CellId, number | null][] = [
    ['astroAM', t.astroDawn], ['nauticalAM', t.nauticalDawn], ['civilAM', t.civilDawn], ['sunrise', t.sunrise],
    ['noon', t.noon], ['sunset', t.sunset], ['civilPM', t.civilDusk], ['nauticalPM', t.nauticalDusk],
    ['astroPM', t.astroDusk], ['nadir', t.nadir],
  ];
  const ranges: [CellId, number | null, number | null][] = merged
    ? [['goldenAM', t.goldenStartAM, t.blueStartPM]]
    : [['goldenAM', t.goldenStartAM, t.goldenEndAM], ['goldenPM', t.goldenStartPM, t.blueStartPM]];
  ranges.push(['blueAM', t.civilDawn, t.goldenStartAM], ['bluePM', t.blueStartPM, t.civilDusk]);

  const out: Partial<Record<CellId, CellState>> = {};
  let next: CellId | null = null;
  let nextAt = Infinity;
  for (const [id, ms] of points) {
    if (ms === null) continue;
    if (ms <= nowMs) out[id] = 'past';
    else if (ms < nextAt) { next = id; nextAt = ms; }
  }
  for (const [id, a, b] of ranges) {
    if (a === null && b === null) continue;
    const start = a ?? -Infinity, end = b ?? Infinity;
    if (end <= nowMs) out[id] = 'past';
    else if (start <= nowMs) out[id] = 'cur';
    else if (start < nextAt) { next = id; nextAt = start; }
  }
  if (next !== null) out[next] = 'next';
  return out;
}
