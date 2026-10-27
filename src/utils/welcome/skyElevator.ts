// src/utils/welcome/skyElevator.ts
// L'ascensor de la Columna del cel, el secret de la benvinguda: si s'estira la columna cap amunt tres cops seguits,
// la càmera puja pels núvols de l'usuari, el sostre del temps, l'espai i l'Estació Espacial fins al Meteosat, a
// 35.786 km, i en torna amb una reentrada. Aquí hi ha les parades, l'horari del viatge, l'escala de la regla, el
// format de les altituds i on cau l'agulla al disc del Meteosat; el gest, a columnStretch.ts. Només el fa servir el
// tros de l'ascensor, que es baixa quan algú el troba. Pur, sense React ni xarxa.
import type { WeatherUnit } from '../formatters';

export type ElevatorStopId = 'clouds' | 'tropopause' | 'space' | 'station' | 'meteosat';

/** Òrbita geoestacionària: l'alçada del Meteosat sobre l'equador, en metres. */
export const GEO_ALTITUDE_M = 35_786_000;

/** Les parades, de baix a dalt, i l'alçada a què s'atura la càmera (m). */
export const ELEVATOR_STOPS: ReadonlyArray<{ id: ElevatorStopId; altitude: number }> = [
  { id: 'clouds', altitude: 4300 },
  { id: 'tropopause', altitude: 12_000 },
  { id: 'space', altitude: 100_000 },
  { id: 'station', altitude: 400_000 },
  { id: 'meteosat', altitude: GEO_ALTITUDE_M },
];

// Durada de cada tram fins a la parada (el primer surt de terra) i de cada aturada, en ms. L'últim tram és més
// llarg: de 400 km a 35.786 km l'altímetre corre.
const LEG_MS = [1400, 1400, 1600, 1400, 2400] as const;
const HOLD_MS = 2600;
/** Alçada d'on surt la càmera: l'escala és logarítmica i no pot començar a 0. */
const GROUND_M = 10;
/** Durada de la caiguda de la reentrada, en ms. */
export const REENTRY_MS = 2200;

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
const easeInOutCubic = (t: number) => (t < 0.5 ? 4 * t ** 3 : 1 - (-2 * t + 2) ** 3 / 2);
const easeInCubic = (t: number) => t ** 3;
/** Interpolació logarítmica: a la meitat del camí entre 100 m i 10 km hi ha 1 km. */
const logLerp = (from: number, to: number, t: number) => from * (to / from) ** t;

export interface ElevatorFrame {
  /** Alçada de la càmera, en metres. */
  altitude: number;
  /** Parada cap on anem o on som (índex d'ELEVATOR_STOPS). */
  stop: number;
  /** Progrés del tram fins a `stop`, ja suavitzat: 0 a la parada anterior, 1 en arribar. */
  leg: number;
  /** Progrés de l'aturada a `stop` (0 mentre s'hi arriba i a l'última parada). */
  hold: number;
  /** Ha arribat al Meteosat: el viatge s'atura aquí fins que l'usuari torna. */
  arrived: boolean;
}

/** On comença cada tram i cada aturada: [inici del tram, inici de l'aturada] per parada. */
const SCHEDULE: ReadonlyArray<readonly [number, number]> = (() => {
  const out: [number, number][] = [];
  let t = 0;
  LEG_MS.forEach((leg, i) => {
    out.push([t, t + leg]);
    t += leg + (i < LEG_MS.length - 1 ? HOLD_MS : 0);
  });
  return out;
})();

/** Durada total de la pujada, en ms (fins que arriba al Meteosat). */
export const ASCENT_MS = SCHEDULE[SCHEDULE.length - 1][1];

/**
 * Quan es veu una parada: des que s'hi comença a pujar fins que ha desaparegut del tot pel tram següent (la del
 * Meteosat, fins a l'arribada). Per moure-hi el que passa (l'avió, l'Estació Espacial...).
 */
export function stopSpan(stop: number): { start: number; end: number } {
  const start = SCHEDULE[stop][0];
  const end = stop + 1 < SCHEDULE.length ? SCHEDULE[stop + 1][1] : ASCENT_MS;
  return { start, end };
}

/** On és la càmera `t` ms després de sortir. */
export function elevatorFrame(t: number): ElevatorFrame {
  const last = ELEVATOR_STOPS.length - 1;
  if (t >= ASCENT_MS) return { altitude: GEO_ALTITUDE_M, stop: last, leg: 1, hold: 0, arrived: true };
  let stop = 0;
  while (stop < last && t >= SCHEDULE[stop + 1][0]) stop++;
  const [legStart, holdStart] = SCHEDULE[stop];
  const from = stop === 0 ? GROUND_M : ELEVATOR_STOPS[stop - 1].altitude;
  const to = ELEVATOR_STOPS[stop].altitude;
  if (t < holdStart) {
    const leg = easeInOutCubic(clamp01((t - legStart) / LEG_MS[stop]));
    return { altitude: logLerp(from, to, leg), stop, leg, hold: 0, arrived: false };
  }
  return { altitude: to, stop, leg: 1, hold: clamp01((t - holdStart) / HOLD_MS), arrived: false };
}

/**
 * Un toc a la pantalla durant la pujada: si la càmera és aturada a una parada, surt cap a la següent; si va de
 * camí, arriba ja a la parada. Torna el nou temps del viatge.
 */
export function elevatorSkip(t: number): number {
  if (t >= ASCENT_MS) return ASCENT_MS;
  const { stop, leg } = elevatorFrame(t);
  if (leg < 1) return SCHEDULE[stop][1];
  return stop + 1 < SCHEDULE.length ? SCHEDULE[stop + 1][0] : ASCENT_MS;
}

/** Alçada durant la reentrada (`t` ms després de prémer "Torna a terra"): cau cada cop més de pressa. */
export function reentryAltitude(t: number): number {
  const p = easeInCubic(clamp01(t / REENTRY_MS));
  return p >= 1 ? 0 : logLerp(GEO_ALTITUDE_M, GROUND_M, p);
}

/** Posició a la regla de l'esquerra (0 = terra, 1 = Meteosat), en escala logarítmica a partir de 100 m. */
export function rulerFraction(altitude: number): number {
  return clamp01(Math.log10(Math.max(altitude, 100) / 100) / Math.log10(GEO_ALTITUDE_M / 100));
}

const FT_PER_M = 3.28084;
/** Entre el número i la unitat, un espai que no es parteix a final de línia. */
export const NBSP = '\u00a0';
const M_PER_MI = 1609.344;
const imperial = (unit: WeatherUnit) => unit === 'F';

/** Marques de la regla: alçada (m) i etiqueta curta, en metres i km o en milles. */
export function rulerTicks(unit: WeatherUnit, locale: string): { altitude: number; label: string }[] {
  const n = new Intl.NumberFormat(locale, { maximumFractionDigits: 0 });
  if (imperial(unit)) {
    return [
      { altitude: 0, label: '0' },
      ...[1, 10, 100, 1000, 10_000].map(mi => ({ altitude: mi * M_PER_MI, label: `${n.format(mi)}${NBSP}mi` })),
      { altitude: GEO_ALTITUDE_M, label: n.format(Math.round(GEO_ALTITUDE_M / M_PER_MI / 1000) * 1000) },
    ];
  }
  return [
    { altitude: 0, label: '0' },
    ...[1, 10, 100].map(km => ({ altitude: km * 1000, label: `${n.format(km)}${NBSP}km` })),
    ...[1000, 10_000].map(km => ({ altitude: km * 1000, label: n.format(km) })),
    { altitude: GEO_ALTITUDE_M, label: n.format(36_000) },
  ];
}

/**
 * L'altímetre: metres (de 10 en 10) fins a 20 km i quilòmetres a partir d'aquí; en peus fins a 50.000 ft i en milles
 * a partir d'aquí si l'usuari fa servir °F.
 */
export function formatAltitude(altitude: number, unit: WeatherUnit, locale: string): string {
  const n = new Intl.NumberFormat(locale, { maximumFractionDigits: 0 });
  const m = Math.max(0, altitude);
  if (imperial(unit)) {
    const ft = m * FT_PER_M;
    return ft < 50_000 ? `${n.format(Math.round(ft / 10) * 10)}${NBSP}ft` : `${n.format(Math.round(m / M_PER_MI))}${NBSP}mi`;
  }
  return m < 20_000 ? `${n.format(Math.round(m / 10) * 10)}${NBSP}m` : `${n.format(Math.round(m / 1000))}${NBSP}km`;
}

/** Una distància dels textos (en km): "100 km" o, amb °F, "62 mi" (amb un decimal per sota de 20). */
export function formatDistance(km: number, unit: WeatherUnit, locale: string): string {
  const value = imperial(unit) ? (km * 1000) / M_PER_MI : km;
  const n = new Intl.NumberFormat(locale, { maximumFractionDigits: value < 20 ? 1 : 0 });
  return `${n.format(value)}${NBSP}${imperial(unit) ? 'mi' : 'km'}`;
}

/** Una velocitat (en km/h), arrodonida a la centena: "28.000 km/h" o "17,400 mph". */
export function formatSpeed(kmh: number, unit: WeatherUnit, locale: string): string {
  const n = new Intl.NumberFormat(locale, { maximumFractionDigits: 0 });
  const value = imperial(unit) ? (kmh * 1000) / M_PER_MI : kmh;
  return `${n.format(Math.round(value / 100) * 100)}${NBSP}${imperial(unit) ? 'mph' : 'km/h'}`;
}

// --- On cau l'agulla al disc del Meteosat ---

export type GeoSatellite = 'meteosat' | 'goesEast' | 'goesWest' | 'himawari';

/** Longitud sobre l'equador de cada satèl·lit geoestacionari que fa servir l'app (Meteosat-12, GOES-19/18, Himawari-9). */
const SUB_LONGITUDE: Readonly<Record<GeoSatellite, number>> = { meteosat: 0, goesEast: -75.2, goesWest: -137.2, himawari: 140.7 };
/** Més enllà d'aquesta distància angular del punt de sota el satèl·lit, el lloc queda arran del limbe. */
const MAX_VIEW_DEG = 75;
const DEG = Math.PI / 180;

/** Cosinus de la distància angular entre un lloc i el punt de l'equador de longitud `subLon`. */
const viewCos = (lat: number, lon: number, subLon: number) => Math.cos(lat * DEG) * Math.cos((lon - subLon) * DEG);

/**
 * Qui veu el lloc: el satèl·lit geoestacionari que el té més a prop del centre del seu disc, i si el veu prou bé
 * (a menys de 75° del centre). Prop dels pols, cap.
 */
export function viewingSatellite(lat: number, lon: number): { satellite: GeoSatellite; visible: boolean } {
  let best: GeoSatellite = 'meteosat';
  for (const sat of Object.keys(SUB_LONGITUDE) as GeoSatellite[]) {
    if (viewCos(lat, lon, SUB_LONGITUDE[sat]) > viewCos(lat, lon, SUB_LONGITUDE[best])) best = sat;
  }
  return { satellite: best, visible: viewCos(lat, lon, SUB_LONGITUDE[best]) >= Math.cos(MAX_VIEW_DEG * DEG) };
}

/**
 * Posició d'un lloc al disc del Meteosat (projecció ortogràfica centrada a 0°, 0°, la de la imatge), en fraccions
 * del radi des del centre: x cap a l'est i y cap al nord. Null si el Meteosat no el veu bé.
 */
export function meteosatDiscPoint(lat: number, lon: number): { x: number; y: number } | null {
  if (viewCos(lat, lon, 0) < Math.cos(MAX_VIEW_DEG * DEG)) return null;
  return { x: Math.cos(lat * DEG) * Math.sin(lon * DEG), y: Math.sin(lat * DEG) };
}

/** Hora de la imatge més nova d'una capa, llegida de les capacitats WMS de la capa (`default` de la dimensió time). */
export function latestImageTime(capabilitiesXml: string): number | null {
  const tag = capabilitiesXml.match(/<Dimension\b[^>]*\bname="time"[^>]*>/)?.[0];
  const iso = tag?.match(/\bdefault="([^"]+)"/)?.[1];
  const ms = iso ? Date.parse(iso) : NaN;
  return Number.isFinite(ms) ? ms : null;
}

// --- El llenç de les escenes ---

/** Les escenes es dibuixen en un llenç de 390 × 844 (un mòbil dret). */
export const ART_W = 390;
export const ART_H = 844;

/** Tros horitzontal del llenç que es veu: x d'on comença i amplada, en unitats del llenç. */
export interface ViewBox { x: number; w: number }

/**
 * El tros que omple una pantalla de `width` × `height` sense deformar: l'alçada del llenç sempre sencera, i en
 * pantalles més amples que un mòbil s'eixampla pels costats (en més estretes, se'n retallen els costats).
 */
export function viewBoxFor(width: number, height: number): ViewBox {
  const w = width > 0 && height > 0 ? (ART_H * width) / height : ART_W;
  return { x: (ART_W - w) / 2, w };
}
