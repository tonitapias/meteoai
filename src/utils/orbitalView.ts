// src/utils/orbitalView.ts
// Càlculs purs del visor orbital d'«Extrems del planeta»: els tres ulls geoestacionaris, on cau cada punt al seu
// disc, quin ull mira cada cosa i on van les etiquetes perquè no es trepitgin. Les tres imatges són la Terra en
// projecció ortogràfica centrada a l'equador, sota el satèl·lit (la del Meteosat ja arriba així d'EUMETSAT; les
// del GOES i l'Himawari es reprojecten a orbitalImage.ts), així que la posició d'un punt és la mateixa fórmula
// per a tots tres.
import type { PlanetExtremes, StationRecord } from '../services/planetExtremesApi';
import type { CycloneSummary, PlanetTab } from './planetExtremes';

export type OrbitEye = 'meteosat' | 'goes' | 'himawari';

export interface EyeInfo {
  id: OrbitEye;
  /** Nom del satèl·lit que fa ara de cada ull. */
  satellite: string;
  /** Longitud del punt de l'equador on mira (graus, positiva a l'est). */
  subLon: number;
}

export const ORBIT_EYES: readonly EyeInfo[] = [
  { id: 'meteosat', satellite: 'Meteosat-12', subLon: 0 },
  { id: 'goes', satellite: 'GOES-19', subLon: -75.2 },
  { id: 'himawari', satellite: 'Himawari-9', subLon: 140.7 },
];

export const eyeInfo = (id: OrbitEye): EyeInfo => ORBIT_EYES.find((eye) => eye.id === id) ?? ORBIT_EYES[0];

const DEG = Math.PI / 180;
// Passat aquest angle des del centre del disc, el punt queda arran del limbe: el satèl·lit el veu de cantó (i
// passats ~81°, gens). No s'hi marca res.
export const MARKER_MAX_VIEW_DEG = 78;
// Per triar l'ull que mira una cosa: on es veu bé de debò.
export const GOOD_VIEW_DEG = 70;

/** Cosinus de la distància angular entre un lloc i el punt de l'equador de longitud `subLon`. */
export const viewCos = (lat: number, lon: number, subLon: number): number =>
  Math.cos(lat * DEG) * Math.cos((lon - subLon) * DEG);

/** Posició al disc en fraccions del radi des del centre: x cap a l'est, y cap al nord. */
export interface DiscPoint {
  x: number;
  y: number;
}

/** On cau un lloc al disc d'un ull; null si queda massa a la vora o a l'altra banda. */
export function discPoint(lat: number, lon: number, subLon: number): DiscPoint | null {
  if (viewCos(lat, lon, subLon) < Math.cos(MARKER_MAX_VIEW_DEG * DEG)) return null;
  return { x: Math.cos(lat * DEG) * Math.sin((lon - subLon) * DEG), y: Math.sin(lat * DEG) };
}

/** L'ull que té el lloc més a prop del centre del seu disc. */
export function nearestEye(lat: number, lon: number): OrbitEye {
  let best = ORBIT_EYES[0];
  for (const eye of ORBIT_EYES) {
    if (viewCos(lat, lon, eye.subLon) > viewCos(lat, lon, best.subLon)) best = eye;
  }
  return best.id;
}

/** L'ull que veu bé més punts; si n'hi ha dos d'iguals, el que els té més a prop del centre. */
export function bestEyeFor(points: { lat: number; lon: number }[], fallback: OrbitEye = 'meteosat'): OrbitEye {
  if (points.length === 0) return fallback;
  const good = Math.cos(GOOD_VIEW_DEG * DEG);
  let best: { id: OrbitEye; count: number; sum: number } | null = null;
  for (const eye of ORBIT_EYES) {
    const cosines = points.map((p) => viewCos(p.lat, p.lon, eye.subLon));
    const count = cosines.filter((c) => c >= good).length;
    const sum = cosines.reduce((total, c) => total + Math.max(0, c), 0);
    if (!best || count > best.count || (count === best.count && sum > best.sum)) best = { id: eye.id, count, sum };
  }
  return best && best.count > 0 ? best.id : fallback;
}

/** Els rècords de les estacions (el primer de cada rànquing), els que la targeta ensenya. */
export const topRecords = (data: PlanetExtremes): StationRecord[] =>
  data.metar
    ? [data.metar.hottest[0], data.metar.coldest[0], data.metar.wetBulb[0], data.metar.gustKmh[0], data.metar.lowPressure[0]]
      .filter((r): r is StationRecord => r !== undefined)
    : [];

/**
 * L'ull amb què s'obre el visor. Des de «Rècords d'ara», on cauen els rècords; des de «Fenòmens actius», on
 * hi ha el fenomen principal: el cicló més intens o, si no n'hi ha cap, l'incendi més extens.
 */
export function initialEye(from: PlanetTab, data: PlanetExtremes, summaries: CycloneSummary[]): OrbitEye {
  if (from === 'records') return bestEyeFor(topRecords(data));
  const main = summaries[0]?.last ?? data.events?.fires.largest ?? null;
  return main ? nearestEye(main.lat, main.lon) : bestEyeFor(topRecords(data));
}

// --- Etiquetes ------------------------------------------------------------------------------------------

export interface LabelRequest {
  /** Centre del marcador (px dins el quadre del disc). */
  x: number;
  y: number;
  /** Mida de l'etiqueta (px). */
  w: number;
  h: number;
  /** Radi del marcador (px): l'etiqueta no el tapa. */
  r: number;
}

interface Rect { l: number; t: number; r: number; b: number }
const overlaps = (a: Rect, b: Rect) => a.l < b.r && b.l < a.r && a.t < b.b && b.t < a.b;

/**
 * Col·loca les etiquetes per ordre (la primera, la més important) al primer lloc lliure al voltant del seu
 * marcador: a la dreta, a l'esquerra, a sobre, a sota i en diagonal. Una etiqueta que no hi cap sense tapar-ne
 * una altra o un altre marcador, o sense sortir del quadre, no es posa (null): el marcador queda sol.
 */
export function placeLabels(requests: LabelRequest[], width: number, height: number, gap = 4): ({ left: number; top: number } | null)[] {
  const markers: Rect[] = requests.map((q) => ({ l: q.x - q.r, t: q.y - q.r, r: q.x + q.r, b: q.y + q.r }));
  const placed: Rect[] = [];
  return requests.map((q, index) => {
    const d = q.r + gap;
    const candidates: [number, number][] = [
      [d, -q.h / 2],
      [-(q.w + d), -q.h / 2],
      [-q.w / 2, -(q.h + d)],
      [-q.w / 2, d],
      [q.r, -(q.h + q.r)],
      [q.r, q.r],
      [-(q.w + q.r), -(q.h + q.r)],
      [-(q.w + q.r), q.r],
    ];
    for (const [dx, dy] of candidates) {
      const rect = { l: q.x + dx, t: q.y + dy, r: q.x + dx + q.w, b: q.y + dy + q.h };
      if (rect.l < 0 || rect.t < 0 || rect.r > width || rect.b > height) continue;
      if (placed.some((p) => overlaps(p, rect))) continue;
      if (markers.some((m, j) => j !== index && overlaps(m, rect))) continue;
      placed.push(rect);
      return { left: rect.l, top: rect.t };
    }
    return null;
  });
}

/** Amplada aproximada d'una etiqueta d'11 px en negreta suau, amb el farciment. */
export const labelWidth = (text: string): number => Math.ceil(text.length * 6.2 + 18);
export const LABEL_HEIGHT = 22;
