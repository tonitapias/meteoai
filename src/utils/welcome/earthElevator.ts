// src/utils/welcome/earthElevator.ts
// L'ascensor cap avall, el segon secret de la benvinguda: si s'aixafa la columna tres cops seguits, la càmera baixa pel
// forat més profund que s'ha fet mai, el mantell, el nucli de ferro i el centre de la Terra, i surt a les antípodes, a
// 12.742 km, on hi ha la foto real del satèl·lit i el temps d'ara. Aquí hi ha les parades, l'horari del viatge, la regla
// (un testimoni de sondeig a escala real), les temperatures de referència, les antípodes i l'estació, les tessel·les
// de la foto i el lloc habitat més proper. Només el fa servir el tros de l'ascensor cap avall. Pur, sense React ni xarxa.
import type { WeatherUnit } from '../formatters';
import { NBSP } from './skyElevator';

export type DescentStopId = 'kola' | 'mantle' | 'core' | 'centre' | 'antipodes';

export const EARTH_RADIUS_M = 6_371_000;
/** El camí recte fins a les antípodes: el diàmetre de la Terra. */
export const EARTH_DIAMETER_M = 2 * EARTH_RADIUS_M;

/**
 * Les parades i la profunditat a què s'atura la càmera (m): el fons del pou superprofund de Kola (12.262 m, 1989),
 * 100 km de mantell, el límit amb el nucli de ferro, el centre i, a l'altra banda, les antípodes.
 */
export const DESCENT_STOPS: ReadonlyArray<{ id: DescentStopId; depth: number }> = [
  { id: 'kola', depth: 12_262 },
  { id: 'mantle', depth: 100_000 },
  { id: 'core', depth: 2_890_000 },
  { id: 'centre', depth: EARTH_RADIUS_M },
  { id: 'antipodes', depth: EARTH_DIAMETER_M },
];

/** Capes de la Terra al llarg del camí (fins a quina profunditat arriba cadascuna, m), de baixada fins al centre. */
export const EARTH_LAYERS: ReadonlyArray<{ id: 'crust' | 'mantle' | 'outerCore' | 'innerCore'; to: number }> = [
  { id: 'crust', to: 35_000 },
  { id: 'mantle', to: 2_890_000 },
  { id: 'outerCore', to: 5_150_000 },
  { id: 'innerCore', to: EARTH_RADIUS_M },
];

// Durada de cada tram fins a la parada i de cada aturada, en ms. L'últim tram, del centre a l'altra banda, corre.
const LEG_MS = [1400, 1400, 1800, 1600, 2400] as const;
const HOLD_MS = 2600;
/** Durada de la tornada per dins, en ms. */
export const RETURN_MS = 2200;

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
const easeInOutCubic = (t: number) => (t < 0.5 ? 4 * t ** 3 : 1 - (-2 * t + 2) ** 3 / 2);

export interface DescentFrame {
  /** Distància recorreguda des de la superfície, en metres (passat el centre, segueix comptant fins al diàmetre). */
  depth: number;
  /** Parada cap on anem o on som (índex de DESCENT_STOPS). */
  stop: number;
  /** Progrés del tram fins a `stop`, ja suavitzat: 0 a la parada anterior, 1 en arribar. */
  leg: number;
  /** Progrés de l'aturada a `stop` (0 mentre s'hi arriba i a l'última parada). */
  hold: number;
  /** Ha arribat a les antípodes: el viatge s'atura aquí fins que l'usuari torna. */
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

/** Durada total de la baixada, en ms (fins que surt a les antípodes). */
export const DESCENT_MS = SCHEDULE[SCHEDULE.length - 1][1];

/** Quan es veu una parada: des que s'hi comença a baixar fins que ha desaparegut del tot pel tram següent. */
export function descentStopSpan(stop: number): { start: number; end: number } {
  const start = SCHEDULE[stop][0];
  const end = stop + 1 < SCHEDULE.length ? SCHEDULE[stop + 1][1] : DESCENT_MS;
  return { start, end };
}

/** On és la càmera `t` ms després de sortir. La profunditat avança en línia recta dins de cada tram. */
export function descentFrame(t: number): DescentFrame {
  const last = DESCENT_STOPS.length - 1;
  if (t >= DESCENT_MS) return { depth: EARTH_DIAMETER_M, stop: last, leg: 1, hold: 0, arrived: true };
  let stop = 0;
  while (stop < last && t >= SCHEDULE[stop + 1][0]) stop++;
  const [legStart, holdStart] = SCHEDULE[stop];
  const from = stop === 0 ? 0 : DESCENT_STOPS[stop - 1].depth;
  const to = DESCENT_STOPS[stop].depth;
  if (t < holdStart) {
    const leg = easeInOutCubic(clamp01((t - legStart) / LEG_MS[stop]));
    return { depth: from + (to - from) * leg, stop, leg, hold: 0, arrived: false };
  }
  return { depth: to, stop, leg: 1, hold: clamp01((t - holdStart) / HOLD_MS), arrived: false };
}

/** Un toc durant la baixada: si la càmera és aturada surt cap a la parada següent; si va de camí, hi arriba ja. */
export function descentSkip(t: number): number {
  if (t >= DESCENT_MS) return DESCENT_MS;
  const { stop, leg } = descentFrame(t);
  if (leg < 1) return SCHEDULE[stop][1];
  return stop + 1 < SCHEDULE.length ? SCHEDULE[stop + 1][0] : DESCENT_MS;
}

/** Distància que falta per tornar a casa `t` ms després de prémer "Torna per dins". */
export function returnRemaining(t: number): number {
  return EARTH_DIAMETER_M * (1 - easeInOutCubic(clamp01(t / RETURN_MS)));
}

/** Posició a la regla (0 = la superfície d'on surts, 1 = les antípodes): escala real, lineal. */
export function rulerFraction(depth: number): number {
  return clamp01(depth / EARTH_DIAMETER_M);
}

const M_PER_MI = 1609.344;
const imperial = (unit: WeatherUnit) => unit === 'F';

/** Marques de la regla: on canvia de capa, el centre i l'altra banda, en km o en milles (sense unitat). */
export function rulerTicks(unit: WeatherUnit, locale: string): { depth: number; label: string }[] {
  const n = new Intl.NumberFormat(locale, { maximumFractionDigits: 0 });
  return [0, 2_890_000, 5_150_000, EARTH_RADIUS_M, EARTH_DIAMETER_M].map(depth => ({
    depth,
    label: n.format(imperial(unit) ? Math.round(depth / M_PER_MI) : depth / 1000),
  }));
}

// --- Temperatures de dins la Terra ---

/**
 * Temperatures de referència (profunditat en m, °C), arrodonides: a la superfície ~15 °C; al fons del pou de Kola,
 * 180 °C (mesurat, 1989); a la base de la litosfera, ~1.300 °C; al límit entre el mantell i el nucli, ~4.000 °C; al
 * límit del nucli intern, ~5.300 °C, i al centre, ~5.400 °C (~5.700 K, l'estimació habitual). Entre punts, en línia
 * recta: només serveix perquè el termòmetre s'enfili durant el viatge, no com a perfil geofísic.
 */
const GEOTHERM: ReadonlyArray<readonly [number, number]> = [
  [0, 15], [12_262, 180], [100_000, 1300], [2_890_000, 4000], [5_150_000, 5300], [EARTH_RADIUS_M, 5400],
];
/** Fins on hi ha mesures directes (el fons del pou de Kola): més avall, els valors són estimacions. */
export const MEASURED_DEPTH_M = 12_262;

/** Temperatura de referència a una distància recorreguda `depth` (passat el centre, la de l'altra banda). */
export function earthTemperature(depth: number): number {
  const d = Math.min(Math.max(depth, 0), EARTH_DIAMETER_M);
  const fromSurface = d > EARTH_RADIUS_M ? EARTH_DIAMETER_M - d : d;
  for (let i = 1; i < GEOTHERM.length; i++) {
    const [d1, t1] = GEOTHERM[i];
    if (fromSurface <= d1) {
      const [d0, t0] = GEOTHERM[i - 1];
      return t0 + ((t1 - t0) * (fromSurface - d0)) / (d1 - d0);
    }
  }
  return GEOTHERM[GEOTHERM.length - 1][1];
}

/**
 * "180 °C" (mesurat) o "≈ 4.000 °C" (estimat, de 10 en 10 i, a partir de 1.000, de 100 en 100). `mark`: si l'estimat
 * porta el signe ≈ (un text que ja diu "uns" no el vol).
 */
export function formatEarthTemperature(celsius: number, approx: boolean, unit: WeatherUnit, locale: string, mark = approx): string {
  const value = imperial(unit) ? (celsius * 9) / 5 + 32 : celsius;
  const step = !approx ? 1 : Math.abs(value) >= 1000 ? 100 : 10;
  const n = new Intl.NumberFormat(locale, { maximumFractionDigits: 0 });
  return `${mark ? `≈${NBSP}` : ''}${n.format(Math.round(value / step) * step)}${NBSP}°${unit}`;
}

/** Un interval petit en centímetres ("2-5 cm") o, amb °F, en polzades ("1-2 in"). */
export function formatCmRange(from: number, to: number, unit: WeatherUnit, locale: string): string {
  const n = new Intl.NumberFormat(locale, { maximumFractionDigits: 0 });
  if (imperial(unit)) return `${n.format(Math.max(1, Math.round(from / 2.54)))}-${n.format(Math.round(to / 2.54))}${NBSP}in`;
  return `${n.format(from)}-${n.format(to)}${NBSP}cm`;
}

// --- Les antípodes ---

/** El punt de l'altra banda de la Terra. */
export function antipode(lat: number, lon: number): { lat: number; lon: number } {
  return { lat: -lat, lon: lon > 0 ? lon - 180 : lon + 180 };
}

export type Season = 'spring' | 'summer' | 'autumn' | 'winter';
/** Als tròpics no hi ha estacions com les d'aquí: no se'n diu cap. */
const TROPIC_LAT = 23.44;
const OPPOSITE: Readonly<Record<Season, Season>> = { spring: 'autumn', summer: 'winter', autumn: 'spring', winter: 'summer' };

/**
 * L'estació astronòmica d'un dia (`day`: el dia del calendari en UTC, el del lloc) a una latitud: equinoccis i
 * solsticis el 20 de març, el 21 de juny, el 23 de setembre i el 21 de desembre. A l'hemisferi sud, la contrària.
 */
export function seasonAt(day: Date, lat: number): Season | null {
  if (!Number.isFinite(lat) || Math.abs(lat) < TROPIC_LAT) return null;
  const md = day.getUTCMonth() * 100 + day.getUTCDate();
  const north: Season = md < 220 ? 'winter' : md < 521 ? 'spring' : md < 823 ? 'summer' : md < 1121 ? 'autumn' : 'winter';
  return lat >= 0 ? north : OPPOSITE[north];
}

/** "41,39° S · 177,83° O": coordenades amb dos decimals i les lletres dels punts cardinals de l'idioma. */
export function formatCoords(lat: number, lon: number, locale: string, letters: { north: string; south: string; east: string; west: string }): string {
  const n = new Intl.NumberFormat(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return `${n.format(Math.abs(lat))}°${NBSP}${lat >= 0 ? letters.north : letters.south} · ${n.format(Math.abs(lon))}°${NBSP}${lon >= 0 ? letters.east : letters.west}`;
}

// --- La foto: el mosaic diari en color real del NOAA-20 (VIIRS), servit per la NASA (GIBS) ---

export const PHOTO_LAYER = 'VIIRS_NOAA20_CorrectedReflectance_TrueColor';
const HOUR = 3_600_000;
const DAY = 86_400_000;
/** El NOAA-20 hi passa de dia cap a les 13:30, hora solar. */
const PASS_SOLAR_HOUR = 13.5;
/** Marge perquè la passada ja sigui al mosaic diari de GIBS. */
const PASS_LATENCY_HOURS = 6;

export type PhotoScale = 'sea' | 'land';

/**
 * Zoom de les tessel·les i mida a què es pinten. Al mar, uns 1.400 km d'ample en un mòbil; prop de terra, la meitat.
 * En pantalles de densitat alta, un nivell més de zoom pintat a 128 px (més nitidesa amb la mateixa escala).
 */
export function photoZoom(scale: PhotoScale, devicePixelRatio: number): { zoom: number; tilePx: number } {
  const zoom = scale === 'sea' ? 6 : 7;
  return devicePixelRatio >= 1.5 ? { zoom, tilePx: 128 } : { zoom: zoom - 1, tilePx: 256 };
}

const DEG = Math.PI / 180;
const MAX_MERCATOR_LAT = 85.0511;

/** Posició d'un punt al mapa del món (Web Mercator), en píxels, amb tessel·les de `tilePx`. */
function worldPx(lat: number, lon: number, zoom: number, tilePx: number): { x: number; y: number } {
  const size = 2 ** zoom * tilePx;
  const s = Math.sin(Math.min(MAX_MERCATOR_LAT, Math.max(-MAX_MERCATOR_LAT, lat)) * DEG);
  return { x: ((lon + 180) / 360) * size, y: (0.5 - Math.log((1 + s) / (1 - s)) / (4 * Math.PI)) * size };
}

/** Longitud del centre d'una tessel·la. */
const tileCenterLon = (x: number, zoom: number) => ((x + 0.5) / 2 ** zoom) * 360 - 180;

export interface PhotoTile {
  /** Columna i fila de la tessel·la (la columna ja tornada al rang del món: la foto pot passar el meridià 180). */
  x: number;
  y: number;
  /** On es pinta dins la foto, en px des de la cantonada de dalt a l'esquerra. */
  left: number;
  top: number;
  /** Longitud del centre de la tessel·la. */
  lon: number;
}

/** Les tessel·les que omplen una foto de `width` × `height` px centrada al punt. */
export function photoTiles(lat: number, lon: number, zoom: number, tilePx: number, width: number, height: number): PhotoTile[] {
  const n = 2 ** zoom;
  const c = worldPx(lat, lon, zoom, tilePx);
  const x0 = Math.round(c.x - width / 2);
  const y0 = Math.round(c.y - height / 2);
  const tiles: PhotoTile[] = [];
  for (let ty = Math.floor(y0 / tilePx); ty <= Math.floor((y0 + height - 1) / tilePx); ty++) {
    if (ty < 0 || ty >= n) continue;
    for (let tx = Math.floor(x0 / tilePx); tx <= Math.floor((x0 + width - 1) / tilePx); tx++) {
      const x = ((tx % n) + n) % n;
      tiles.push({ x, y: ty, left: tx * tilePx - x0, top: ty * tilePx - y0, lon: tileCenterLon(x, zoom) });
    }
  }
  return tiles;
}

/**
 * L'escala de la foto: la distància rodona més llarga que hi cap en `maxPx` px (en km, o en milles amb °F) i quants px
 * fa a la latitud del centre.
 */
export function scaleBar(lat: number, zoom: number, tilePx: number, unit: WeatherUnit, maxPx = 90): { px: number; value: number } {
  const metresPerPx = (40_075_016.686 * Math.cos(lat * DEG)) / (2 ** zoom * tilePx);
  const unitM = imperial(unit) ? M_PER_MI : 1000;
  const steps = [10, 20, 50, 100, 200, 500, 1000, 2000];
  let value = steps[0];
  for (const s of steps) if ((s * unitM) / metresPerPx <= maxPx) value = s;
  return { px: (value * unitM) / metresPerPx, value };
}

/** On cau un lloc dins la foto, en px des del centre (el punt de les antípodes). */
export function photoPoint(lat: number, lon: number, centerLat: number, centerLon: number, zoom: number, tilePx: number): { x: number; y: number } {
  const size = 2 ** zoom * tilePx;
  const dLon = ((((lon - centerLon) % 360) + 540) % 360) - 180;
  return { x: (dLon / 360) * size, y: worldPx(lat, lon, zoom, tilePx).y - worldPx(centerLat, centerLon, zoom, tilePx).y };
}

/**
 * La passada més recent que ja hauria de ser al mosaic: el dia (en dies des de 1970) de la data local del lloc en què
 * el satèl·lit hi va passar a les 13:30 hora solar, amb sis hores de marge.
 */
export function latestPassDay(now: number, lon: number): number {
  return Math.floor((now + (lon / 15) * HOUR - (PASS_SOLAR_HOUR + PASS_LATENCY_HOURS) * HOUR) / DAY);
}

/**
 * Data de GIBS de cada tessel·la per a la passada del dia `passDay` a la longitud `targetLon`. GIBS desa el mosaic
 * diari amb la data local de cada lloc: la mateixa òrbita queda amb un dia a l'oest del meridià 180 i amb el dia
 * anterior a l'est. Amb la mateixa data per a tota la foto, a cada banda de la línia hi hauria passades separades per
 * 24 hores i els núvols no hi lligarien.
 */
export function tileDate(passDay: number, targetLon: number, tileLon: number): string {
  const passUtc = passDay * DAY + PASS_SOLAR_HOUR * HOUR - (targetLon / 15) * HOUR;
  return new Date(Math.floor((passUtc + (tileLon / 15) * HOUR) / DAY) * DAY).toISOString().slice(0, 10);
}

export function gibsTileUrl(date: string, zoom: number, x: number, y: number): string {
  return `https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/${PHOTO_LAYER}/default/${date}/GoogleMapsCompatible_Level9/${zoom}/${y}/${x}.jpg`;
}

/** Dies que fa de la foto: de la passada al dia d'avui del lloc (hora solar). */
export function photoAgeDays(now: number, lon: number, passDay: number): number {
  return Math.max(0, Math.floor((now + (lon / 15) * HOUR) / DAY) - passDay);
}

// --- El lloc habitat més proper (poblacions de Natural Earth, public/world-places.tsv) ---

export interface WorldPlace { lat: number; lon: number; /** Mida de la població, de 0 a 14 (Natural Earth rank_max). */ rank: number; cc: string; name: string }

/** Llegeix la llista: una línia per lloc, "lat\tlon\trang\tcodi de país\tnom", i comentaris amb #. */
export function parseWorldPlaces(tsv: string): WorldPlace[] {
  const out: WorldPlace[] = [];
  for (const line of tsv.split('\n')) {
    if (!line || line.startsWith('#')) continue;
    const [lat, lon, rank, cc, name] = line.split('\t');
    const place = { lat: Number(lat), lon: Number(lon), rank: Number(rank), cc: cc ?? '', name: name?.trim() ?? '' };
    if (Number.isFinite(place.lat) && Number.isFinite(place.lon) && place.name) out.push(place);
  }
  return out;
}

/** Distància per la superfície (km). */
export function distanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const a = Math.sin(((lat2 - lat1) * DEG) / 2) ** 2 + Math.cos(lat1 * DEG) * Math.cos(lat2 * DEG) * Math.sin(((lon2 - lon1) * DEG) / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.min(1, Math.sqrt(a)));
}

export function nearestPlace(places: readonly WorldPlace[], lat: number, lon: number): { place: WorldPlace; km: number } | null {
  let best: { place: WorldPlace; km: number } | null = null;
  for (const place of places) {
    const km = distanceKm(lat, lon, place.lat, place.lon);
    if (!best || km < best.km) best = { place, km };
  }
  return best;
}

/** A menys d'aquesta distància d'un poble, la foto s'acosta (escala "land"). */
export const NEAR_LAND_KM = 150;

/**
 * Els noms que es posen damunt la foto: com a molt `max` llocs dins la foto, els més poblats primer, sense trepitjar
 * l'agulla del centre, les lectures de dalt ni els uns als altres. `x`, `y`: px des del centre de la foto.
 */
export function photoLabels(
  places: readonly WorldPlace[], centerLat: number, centerLon: number, zoom: number, tilePx: number, width: number, height: number, max = 3,
): { place: WorldPlace; x: number; y: number }[] {
  const halfW = width / 2, halfH = height / 2;
  const candidates = places
    .map(place => ({ place, ...photoPoint(place.lat, place.lon, centerLat, centerLon, zoom, tilePx) }))
    .filter(({ x, y }) => Math.abs(x) < halfW - 70 && y > -halfH + 120 && y < halfH - 70 && Math.hypot(x, y) > 70)
    .sort((a, b) => b.place.rank - a.place.rank);
  const chosen: { place: WorldPlace; x: number; y: number }[] = [];
  for (const c of candidates) {
    if (chosen.length >= max) break;
    if (chosen.every(o => Math.abs(o.x - c.x) > 130 || Math.abs(o.y - c.y) > 34)) chosen.push(c);
  }
  return chosen;
}
