// src/utils/orbitalImage.ts
// Les imatges del visor orbital, sense React ni xarxa: d'on surten, quina hora es demana i com es passen al disc.
//
// - Meteosat-12: el WMS d'EUMETSAT, com l'última parada de l'ascensor de la benvinguda (MeteosatDisc.tsx), però
//   amb el quadre just al disc de la Terra. EUMETSAT ja la serveix en projecció ortogràfica centrada a 0°, 0°
//   (AUTO:42003): GeoColour, color real de dia i infraroig de nit. Anònima, amb CORS, un JPEG de ~70 KB.
// - GOES-19 i Himawari-9: NASA GIBS, la mateixa font que la capa HD del radar (dades obertes de la NASA, amb CORS,
//   sense clau). GIBS només les dona en latitud i longitud: es demana la finestra que veu el satèl·lit i aquí es
//   reprojecta al disc. GOES en GeoColor (si en falta, infraroig); Himawari, en infraroig, com a la capa HD.
import type { OrbitEye } from './orbitalView';

// --- Meteosat (EUMETSAT) --------------------------------------------------------------------------------

export const METEOSAT_LAYER = 'mtg_fd:rgb_geocolour';
export const METEOSAT_CAPS_URL = 'https://view.eumetsat.int/geoserver/mtg_fd/rgb_geocolour/ows?service=WMS&version=1.3.0&request=GetCapabilities';
const EARTH_RADIUS_M = 6_378_137;

/** Costat de la imatge del disc (px), la mateixa que la de l'ascensor. */
export const DISC_PX = 720;

/** La imatge del Meteosat amb el disc tocant les vores (quadre de ±1 radi terrestre). */
export const meteosatImageUrl = (timeMs: number | null): string =>
  `https://view.eumetsat.int/geoserver/wms?service=WMS&version=1.3.0&request=GetMap&layers=${METEOSAT_LAYER}&styles=`
  + `&crs=AUTO:42003,9001,0,0&bbox=-${EARTH_RADIUS_M},-${EARTH_RADIUS_M},${EARTH_RADIUS_M},${EARTH_RADIUS_M}`
  + `&width=${DISC_PX}&height=${DISC_PX}&format=image/jpeg${timeMs === null ? '' : `&time=${new Date(timeMs).toISOString()}`}`;

// --- GOES i Himawari (NASA GIBS) ------------------------------------------------------------------------

export type GibsEye = Exclude<OrbitEye, 'meteosat'>;
export type GibsProduct = 'colour' | 'ir';

export const GIBS_LAYERS: Record<GibsEye, Partial<Record<GibsProduct, string>>> = {
  goes: { colour: 'GOES-East_ABI_GeoColor', ir: 'GOES-East_ABI_Band13_Clean_Infrared' },
  himawari: { ir: 'Himawari_AHI_Band13_Clean_Infrared' },
};

// El WMS de GIBS dona JPEG (6-8 cops més lleuger que les tessel·les PNG), però va per darrere del WMTS i, mentre
// una franja encara s'omple, la torna amb blocs negres. Només es demanen franges amb l'edat que el worker
// meteo-sat-proxy considera segura per al WMS (GIBS_WMS_SAFE_AGE): 50 min l'infraroig i 90 el GeoColor.
export const GIBS_SAFE_AGE_SEC: Record<GibsProduct, number> = { ir: 50 * 60, colour: 90 * 60 };
export const GIBS_CADENCE_SEC = 600;
// Si una franja surt buida, se'n proven com a molt dues de més velles.
export const GIBS_MAX_CANDIDATES = 3;

/** Les franges que GIBS té de les últimes hores, segons el worker (/hd/{goes|himawari}/latest), en segons. */
export interface GibsSlots {
  ir: number[];
  colour: number[] | null;
}

const slotList = (v: unknown): number[] | null => {
  const slots = (v as { slots?: unknown } | null)?.slots;
  return Array.isArray(slots) ? slots.filter((s): s is number => Number.isInteger(s) && s > 0) : null;
};

export function parseGibsSlots(json: unknown): GibsSlots | null {
  const body = json as { ir?: unknown; colour?: unknown } | null;
  const ir = slotList(body?.ir);
  return ir ? { ir, colour: slotList(body?.colour) } : null;
}

/**
 * Les franges que es provaran, de la més nova a la més vella. GeoColor si se'n vol i n'hi ha de prou velles; si
 * no, infraroig. Sense la llista del worker, hores calculades amb la mateixa edat segura.
 */
export function pickGibsSlots(slots: GibsSlots | null, nowSec: number, wantColour: boolean): { product: GibsProduct; candidates: number[] } {
  const usable = (list: number[], product: GibsProduct) =>
    list.filter((s) => s <= nowSec - GIBS_SAFE_AGE_SEC[product]).sort((a, b) => b - a).slice(0, GIBS_MAX_CANDIDATES);
  if (wantColour && slots?.colour) {
    const colour = usable(slots.colour, 'colour');
    if (colour.length > 0) return { product: 'colour', candidates: colour };
  }
  const ir = slots ? usable(slots.ir, 'ir') : [];
  if (ir.length > 0) return { product: 'ir', candidates: ir };
  const newest = Math.floor((nowSec - GIBS_SAFE_AGE_SEC.ir) / GIBS_CADENCE_SEC) * GIBS_CADENCE_SEC;
  return { product: 'ir', candidates: Array.from({ length: GIBS_MAX_CANDIDATES }, (_, i) => newest - i * GIBS_CADENCE_SEC) };
}

// La finestra que es demana: 82° al voltant del punt de sota el satèl·lit, en latitud i en longitud (el satèl·lit
// no veu més enllà de ~81°). Píxels quadrats: 164° en 1024 px, ~18 km per píxel a l'equador, com el centre del disc.
export const SOURCE_HALF_DEG = 82;
export const SOURCE_PX = 1024;

/** Un tros de la finestra: GIBS no passa de ±180°, i la de l'Himawari travessa l'antimeridià. */
export interface SourcePart {
  lonMin: number;
  lonMax: number;
  /** On va dins la imatge de la finestra (px). */
  x: number;
  width: number;
}

export function sourceParts(subLon: number): SourcePart[] {
  const span = 2 * SOURCE_HALF_DEG;
  // Arrodonit perquè l'URL no porti 58.69999999999999.
  const round = (lon: number) => Math.round(lon * 1e4) / 1e4;
  const west = round(subLon - SOURCE_HALF_DEG);
  const east = round(subLon + SOURCE_HALF_DEG);
  if (east > 180) {
    const width = Math.round(((180 - west) / span) * SOURCE_PX);
    return [{ lonMin: west, lonMax: 180, x: 0, width }, { lonMin: -180, lonMax: round(east - 360), x: width, width: SOURCE_PX - width }];
  }
  if (west < -180) {
    const width = Math.round(((-180 - west) / span) * SOURCE_PX);
    return [{ lonMin: round(west + 360), lonMax: 180, x: 0, width }, { lonMin: -180, lonMax: east, x: width, width: SOURCE_PX - width }];
  }
  return [{ lonMin: west, lonMax: east, x: 0, width: SOURCE_PX }];
}

const gibsTime = (sec: number) => new Date(sec * 1000).toISOString().replace('.000Z', 'Z');

/** WMS 1.3.0 en EPSG:4326: el quadre va en latitud, longitud. */
export const gibsWmsUrl = (layer: string, slotSec: number, part: SourcePart): string =>
  'https://gibs.earthdata.nasa.gov/wms/epsg4326/best/wms.cgi?SERVICE=WMS&REQUEST=GetMap&VERSION=1.3.0'
  + `&LAYERS=${layer}&STYLES=&FORMAT=image/jpeg&CRS=EPSG:4326`
  + `&BBOX=${-SOURCE_HALF_DEG},${part.lonMin},${SOURCE_HALF_DEG},${part.lonMax}`
  + `&WIDTH=${part.width}&HEIGHT=${SOURCE_PX}&TIME=${gibsTime(slotSec)}`;

const DEG = Math.PI / 180;
// Negre opac en un Uint32Array sobre ImageData (RGBA en ordre de bytes, little-endian: A a dalt).
const OPAQUE_BLACK = 0xff000000;

/**
 * Passa la finestra (equirectangular, SOURCE_HALF_DEG al voltant del punt de sota el satèl·lit) al disc que veu el
 * satèl·lit: `size` × `size` píxels, el disc tocant les vores, nord a dalt. En aquesta projecció ortogràfica
 * centrada a l'equador cada fila té una sola latitud (y = sin φ), i la longitud surt d'un arcsinus per píxel
 * (x = cos φ · sin Δλ). Fora del disc, transparent; dins del disc però fora de la finestra, negre (és el limbe que
 * el satèl·lit no veu).
 */
export function reprojectToDisc(src: Uint32Array, srcW: number, srcH: number, size: number): Uint32Array {
  const out = new Uint32Array(size * size);
  const span = 2 * SOURCE_HALF_DEG;
  for (let j = 0; j < size; j++) {
    const y = 1 - (2 * j + 1) / size;
    const cosLat = Math.sqrt(Math.max(0, 1 - y * y));
    const latDeg = Math.asin(y) / DEG;
    const rowInside = Math.abs(latDeg) <= SOURCE_HALF_DEG;
    const srcRow = Math.min(srcH - 1, Math.floor(((SOURCE_HALF_DEG - latDeg) / span) * srcH)) * srcW;
    const rowStart = j * size;
    for (let i = 0; i < size; i++) {
      const x = (2 * i + 1) / size - 1;
      if (x * x + y * y > 1) continue;
      if (!rowInside) {
        out[rowStart + i] = OPAQUE_BLACK;
        continue;
      }
      const dLon = Math.asin(Math.max(-1, Math.min(1, x / cosLat))) / DEG;
      if (Math.abs(dLon) > SOURCE_HALF_DEG) {
        out[rowStart + i] = OPAQUE_BLACK;
        continue;
      }
      out[rowStart + i] = src[srcRow + Math.min(srcW - 1, Math.floor(((dLon + SOURCE_HALF_DEG) / span) * srcW))];
    }
  }
  return out;
}

/**
 * Part del disc que el satèl·lit veu bé (fins a 0,95 radis) que és negra del tot. Un infraroig de debò no en té
 * gens (tot és núvol o terra a una temperatura); el negre és una franja que el WMS de GIBS encara no té sencera,
 * sovint només un tros (el 31-10 a les 03:14 UTC, la de les 02:20 de l'Himawari no tenia res a l'est de 180°). El
 * GeoColor, en canvi, és negre de nit sobre el mar (1, 1, 1, com els forats): no es pot mirar, i només l'edat
 * segura de 90 min el protegeix.
 */
export function darkShare(disc: Uint32Array, size: number, step = 6): number {
  let total = 0;
  let dark = 0;
  for (let j = 0; j < size; j += step) {
    const y = 1 - (2 * j + 1) / size;
    for (let i = 0; i < size; i += step) {
      const x = (2 * i + 1) / size - 1;
      if (x * x + y * y > 0.9) continue;
      total++;
      const px = disc[j * size + i];
      if ((px & 0xff) < 6 && ((px >>> 8) & 0xff) < 6 && ((px >>> 16) & 0xff) < 6) dark++;
    }
  }
  return total === 0 ? 0 : dark / total;
}

// Un marge per a la compressió JPEG i la costura de 180°: un forat de debò en fa molt més.
export const IR_MAX_DARK_SHARE = 0.02;
