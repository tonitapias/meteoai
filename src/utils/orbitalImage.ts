// src/utils/orbitalImage.ts
// Les imatges del visor orbital, sense React ni xarxa: d'on surten, quina hora es demana i com es passen al disc.
//
// - Meteosat-12: el WMS d'EUMETSAT, com l'última parada de l'ascensor de la benvinguda (MeteosatDisc.tsx), però
//   amb el quadre just al disc de la Terra. EUMETSAT ja la serveix en projecció ortogràfica centrada a 0°, 0°
//   (AUTO:42003): GeoColour, color real de dia i infraroig de nit. Anònima, amb CORS, un JPEG de ~80 KB.
// - GOES i Himawari-9: els taulers HD del worker meteo-sat-proxy, els mateixos de la capa de núvols del radar
//   (/hd/gibs/v1/...): GeoColor de GOES de NOAA/NESDIS (GIBS de reserva) i infraroig de NASA GIBS, en Mercator.
//   Se'n demanen els de nivell 3 que toquen el disc (~30), es fa el mosaic i aquí es reprojecta al disc.
//   CORRECCIÓ (2026-11-12): abans era una sola imatge gran del WMS de GIBS en latitud i longitud (epsg4326), i
//   aquell servei tardava de 8 s a 3 min (fins i tot amb peces petites): el GOES arribava tard i l'Himawari, que
//   en necessitava dues, mai. Els taulers arriben en 1,5–3,5 s (0,1 s si ja són a l'edge) i, a l'edge de
//   Cloudflare, es comparteixen amb tothom i amb el radar.
// - Himawari-9, primer en GeoColor de CIRA SLIDER (pel worker, una sola imatge en la vista del satèl·lit que aquí
//   es passa al disc; vegeu més avall) i, si no arriba, l'infraroig dels taulers HD com abans.
import { eumetsatGetMap } from './eumetsatWms';
import type { OrbitEye } from './orbitalView';

// --- Meteosat (EUMETSAT) --------------------------------------------------------------------------------

export const METEOSAT_LAYER = 'mtg_fd:rgb_geocolour';
export const METEOSAT_CAPS_URL = 'https://view.eumetsat.int/geoserver/mtg_fd/rgb_geocolour/ows?service=WMS&version=1.3.0&request=GetCapabilities';
const EARTH_RADIUS_M = 6_378_137;

/** Costat de la imatge del disc (px), la mateixa que la de l'ascensor. */
export const DISC_PX = 720;

/** La imatge del Meteosat amb el disc tocant les vores (quadre de ±1 radi terrestre). */
export const meteosatImageUrl = (timeMs: number | null): string =>
  `${eumetsatGetMap(METEOSAT_LAYER)}&styles=`
  + `&crs=AUTO:42003,9001,0,0&bbox=-${EARTH_RADIUS_M},-${EARTH_RADIUS_M},${EARTH_RADIUS_M},${EARTH_RADIUS_M}`
  + `&width=${DISC_PX}&height=${DISC_PX}&format=image/jpeg${timeMs === null ? '' : `&time=${new Date(timeMs).toISOString()}`}`;

// --- GOES i Himawari (taulers HD del worker) ------------------------------------------------------------

export type GibsEye = Exclude<OrbitEye, 'meteosat'>;
export type GibsProduct = 'colour' | 'ir';

/** Els productes de cada ull, en l'ordre en què es proven: GOES en color i, si no arriba, infraroig. */
export const GIBS_PRODUCTS: Record<GibsEye, readonly GibsProduct[]> = { goes: ['colour', 'ir'], himawari: ['ir'] };

// Un disc sencer són ~30 taulers: només franges que arriben en JPEG (10–25 KB cada un). El worker ho diu a
// /hd/{goes|himawari}/latest (`light`): l'IR i el GeoColor de GIBS quan el WMS ja els té sencers (50 i 90 min)
// i el GeoColor de NESDIS de seguida. Les franges més joves de GIBS són PNG del WMTS, 140–180 KB per tauler en
// GeoColor (~5 MB per disc). Sense `light` (worker antic), aquestes mateixes edats.
export const GIBS_SAFE_AGE_SEC: Record<GibsProduct, number> = { ir: 50 * 60, colour: 90 * 60 };
export const GIBS_CADENCE_SEC = 600;
// Franges que es proven de cada producte: la més nova i l'anterior (el worker ja recula per tauler si en falta).
export const SLOTS_PER_PRODUCT = 2;

/** Les franges d'un producte, segons el worker, en segons. */
export interface ProductSlots {
  slots: number[];
  /** La més nova que arriba sencera en JPEG; null si el worker no ho diu. */
  light: number | null;
}

export interface GibsSlots {
  ir: ProductSlots;
  colour: ProductSlots | null;
}

const isSlot = (s: unknown): s is number => Number.isInteger(s) && (s as number) > 0;

const productSlots = (v: unknown): ProductSlots | null => {
  const body = v as { slots?: unknown; light?: unknown } | null;
  if (!Array.isArray(body?.slots)) return null;
  return { slots: body.slots.filter(isSlot), light: isSlot(body.light) ? body.light : null };
};

/** La resposta de /hd/{goes|himawari}/latest; null si no porta l'infraroig. */
export function parseGibsSlots(json: unknown): GibsSlots | null {
  const body = json as { ir?: unknown; colour?: unknown } | null;
  const ir = productSlots(body?.ir);
  return ir ? { ir, colour: productSlots(body?.colour) } : null;
}

export interface DiscAttempt {
  product: GibsProduct;
  slot: number;
}

/**
 * Els discos que es proven, per ordre: per a cada producte de l'ull, les franges lleugeres més noves. Sense la
 * llista del worker, infraroig a hores calculades amb l'edat segura.
 */
export function gibsAttempts(slots: GibsSlots | null, nowSec: number, products: readonly GibsProduct[]): DiscAttempt[] {
  const attempts: DiscAttempt[] = [];
  for (const product of products) {
    const list = product === 'ir' ? slots?.ir : slots?.colour;
    if (!list) continue;
    const limit = list.light ?? nowSec - GIBS_SAFE_AGE_SEC[product];
    list.slots.filter((s) => s <= limit).sort((a, b) => b - a).slice(0, SLOTS_PER_PRODUCT)
      .forEach((slot) => attempts.push({ product, slot }));
  }
  if (products.includes('ir') && !attempts.some((a) => a.product === 'ir')) {
    const newest = Math.floor((nowSec - GIBS_SAFE_AGE_SEC.ir) / GIBS_CADENCE_SEC) * GIBS_CADENCE_SEC;
    for (let i = 0; i < SLOTS_PER_PRODUCT; i++) attempts.push({ product: 'ir', slot: newest - i * GIBS_CADENCE_SEC });
  }
  return attempts;
}

// Nivell 3: 2.048 px per volta, ~0,18° per píxel a l'equador, com el centre del disc de 720 px (~0,16°).
export const DISC_TILE_ZOOM = 3;
export const TILE_PX = 256;
// Fins on arriba el disc (graus des del punt de sota el satèl·lit): el satèl·lit no veu més enllà de ~81° i
// GIBS el retalla a ~80°. Més enllà, negre.
export const VIEW_MAX_DEG = 82;

const DEG = Math.PI / 180;
const COS_VIEW_MAX = Math.cos(VIEW_MAX_DEG * DEG);

const tileLat = (y: number, z: number) => Math.atan(Math.sinh(Math.PI * (1 - (2 * y) / 2 ** z)));

export interface DiscTile {
  x: number;
  y: number;
  /** On va dins el mosaic (px). */
  left: number;
  top: number;
}

/** El mosaic de taulers que cobreix el disc d'un ull: columnes seguides d'oest a est, potser passant per 180°. */
export interface DiscMosaic {
  /** Longitud de la vora oest del mosaic, sense normalitzar (pot ser < -180 o, a l'est, passar de 180). */
  westLon: number;
  /** Primera fila de taulers del mosaic. */
  rowMin: number;
  width: number;
  height: number;
  tiles: DiscTile[];
}

/**
 * Els taulers de nivell `z` que el satèl·lit veu (alguna part a menys de VIEW_MAX_DEG del punt de sota): el punt
 * més proper d'un tauler és el de la latitud i la diferència de longitud més petites, així que cos φ · cos Δλ hi
 * és màxim. Els altres no es demanen.
 */
export function discMosaic(subLon: number, z: number = DISC_TILE_ZOOM): DiscMosaic {
  const n = 2 ** z;
  const colDeg = 360 / n;
  const first = Math.floor((subLon - VIEW_MAX_DEG + 180) / colDeg);
  const last = Math.floor((subLon + VIEW_MAX_DEG + 180) / colDeg);
  const visible: { col: number; y: number }[] = [];
  for (let col = first; col <= last; col++) {
    const west = col * colDeg - 180 - subLon;
    const east = west + colDeg;
    const nearLon = west <= 0 && east >= 0 ? 0 : Math.min(Math.abs(west), Math.abs(east));
    if (nearLon >= 90) continue;
    for (let y = 0; y < n; y++) {
      const north = tileLat(y, z);
      const south = tileLat(y + 1, z);
      const nearLat = south <= 0 && north >= 0 ? 0 : Math.min(Math.abs(south), Math.abs(north));
      if (Math.cos(nearLat) * Math.cos(nearLon * DEG) >= COS_VIEW_MAX) visible.push({ col, y });
    }
  }
  const rowMin = Math.min(...visible.map((t) => t.y));
  const rowMax = Math.max(...visible.map((t) => t.y));
  return {
    westLon: first * colDeg - 180,
    rowMin,
    width: (last - first + 1) * TILE_PX,
    height: (rowMax - rowMin + 1) * TILE_PX,
    tiles: visible.map(({ col, y }) => ({ x: ((col % n) + n) % n, y, left: (col - first) * TILE_PX, top: (y - rowMin) * TILE_PX })),
  };
}

/**
 * GIBS deixa fosca (a mitja intensitat) l'última columna de píxels d'una imatge que acaba just a 180°: els taulers
 * de la darrera columna en tenen. Al disc de l'Himawari faria una ratlla d'un píxel; es tapa amb la del costat.
 */
export const hasDarkEastEdge = (tile: DiscTile): boolean => tile.x === 2 ** DISC_TILE_ZOOM - 1;

/** Un tauler del worker (el mateix URL que la capa HD del radar, i per tant la mateixa memòria cau). */
export const discTileUrl = (host: string, eye: GibsEye, attempt: DiscAttempt, tile: DiscTile, z: number = DISC_TILE_ZOOM): string =>
  `${host}/hd/gibs/v1/${eye}/${attempt.product}/${attempt.slot}/${z}/${tile.x}/${tile.y}.png`;

// Negre opac en un Uint32Array sobre ImageData (RGBA en ordre de bytes, little-endian: A a dalt).
const OPAQUE_BLACK = 0xff000000;

/**
 * Passa el mosaic (Mercator) al disc que veu el satèl·lit: `size` × `size` píxels, el disc tocant les vores, nord
 * a dalt. En la projecció ortogràfica centrada a l'equador cada fila té una sola latitud (y = sin φ) i, per tant,
 * una sola fila del mosaic; la longitud surt de x = cos φ · sin Δλ i de la profunditat cos φ · cos Δλ. Fora del
 * disc, transparent; dins del disc però més enllà de VIEW_MAX_DEG, negre (el limbe que el satèl·lit no veu).
 */
export function reprojectMercatorToDisc(
  src: Uint32Array,
  mosaic: Pick<DiscMosaic, 'westLon' | 'rowMin' | 'width' | 'height'>,
  subLon: number,
  size: number,
  z: number = DISC_TILE_ZOOM,
): Uint32Array {
  const out = new Uint32Array(size * size);
  const worldPx = TILE_PX * 2 ** z;
  const top = mosaic.rowMin * TILE_PX;
  const lonToCol = worldPx / 360;
  for (let j = 0; j < size; j++) {
    const y = 1 - (2 * j + 1) / size;
    const lat = Math.asin(y);
    const mercY = ((1 - Math.log(Math.tan(Math.PI / 4 + lat / 2)) / Math.PI) / 2) * worldPx - top;
    const srcRow = Math.max(0, Math.min(mosaic.height - 1, Math.floor(mercY))) * mosaic.width;
    const rowStart = j * size;
    for (let i = 0; i < size; i++) {
      const x = (2 * i + 1) / size - 1;
      const r2 = x * x + y * y;
      if (r2 > 1) continue;
      const depth = Math.sqrt(1 - r2);
      if (depth < COS_VIEW_MAX) {
        out[rowStart + i] = OPAQUE_BLACK;
        continue;
      }
      const lon = subLon + Math.atan2(x, depth) / DEG;
      const col = Math.max(0, Math.min(mosaic.width - 1, Math.floor((lon - mosaic.westLon) * lonToCol)));
      out[rowStart + i] = src[srcRow + col];
    }
  }
  return out;
}

/**
 * Part del disc que el satèl·lit veu bé (fins a 0,95 radis) sense imatge: transparent (un tauler que no ha
 * arribat, o que el worker no ha pogut resoldre) i, a l'infraroig, també negre del tot. Un infraroig de debò no en
 * té gens (tot és núvol o terra a una temperatura); el negre és una franja que encara no és sencera. El GeoColor,
 * en canvi, és negre de nit sobre el mar (1, 1, 1): només hi compta el transparent.
 */
export function missingShare(disc: Uint32Array, size: number, countBlack: boolean, step = 6): number {
  let total = 0;
  let missing = 0;
  for (let j = 0; j < size; j += step) {
    const y = 1 - (2 * j + 1) / size;
    for (let i = 0; i < size; i += step) {
      const x = (2 * i + 1) / size - 1;
      if (x * x + y * y > 0.9) continue;
      total++;
      const px = disc[j * size + i];
      const transparent = px >>> 24 < 128;
      const black = (px & 0xff) < 6 && ((px >>> 8) & 0xff) < 6 && ((px >>> 16) & 0xff) < 6;
      if (transparent || (countBlack && black)) missing++;
    }
  }
  return total === 0 ? 0 : missing / total;
}

// Un marge per a la compressió JPEG. Un tauler que falta prop del centre en fa molt més; un de la vora, potser
// menys, però allà ja és limbe fosc i no es nota.
export const MAX_MISSING_SHARE = 0.02;

// --- Himawari en GeoColor (CIRA SLIDER, pel worker) ------------------------------------------------------
// Cap servei oficial dona l'Himawari en GeoColor; CIRA (Colorado State University, institut cooperatiu de la NOAA)
// sí, amb el mateix algorisme que el GeoColor de GOES: dia en color real, nit amb llums i núvols per infraroig.
// És una web de recerca, així que el worker la valida i, si falla, el disc torna a l'infraroig de GIBS. Es
// demana pel worker (/hd/himawari/disc/...): CIRA no té CORS, i així es baixa un cop per franja per a tothom.

/**
 * La imatge de CIRA és la vista del satèl·lit (projecció geoestacionària), no l'ortogràfica dels altres discs: la
 * graella de 2 km de l'Himawari (5.500 px, CFAC 20.466.275, 2^16/CFAC graus d'escombrat per píxel) reduïda a 688 px.
 * Mesurat el 2026-11-12: el disc va dels píxels 4 a 683 a l'equador (680 px, el que dona el radi equatorial vist des
 * de 42.164 km) i del 5 al 682 de pol a pol; centre a 344.
 */
export const CIRA_DISC_PX = 688;
const CIRA_CENTER_PX = 344;
const CIRA_DEG_PER_PX = (65536 / 20466275) * (5500 / CIRA_DISC_PX);
const GEO_RADIUS_KM = 42164;
const WGS84_A_KM = 6378.137;
const WGS84_B_KM = 6356.7523;
const WGS84_E2 = 1 - (WGS84_B_KM * WGS84_B_KM) / (WGS84_A_KM * WGS84_A_KM);
// El satèl·lit veu fins a ~81,3° (l'horitzó des de 42.164 km); més enllà, i a tocar del limbe, negre.
const CIRA_VIEW_MAX_DEG = 81;
const COS_CIRA_VIEW_MAX = Math.cos(CIRA_VIEW_MAX_DEG * DEG);

export const ciraDiscUrl = (host: string, slot: number): string => `${host}/hd/himawari/disc/${slot}.png`;

/** Les franges de /hd/himawari/disc/latest (de la més nova a la més vella); null si la resposta no és la que toca. */
export function parseCiraSlots(json: unknown): number[] | null {
  const slots = (json as { slots?: unknown } | null)?.slots;
  return Array.isArray(slots) ? slots.filter(isSlot).sort((a, b) => b - a) : null;
}

/**
 * On cau un lloc a la imatge de CIRA (en vores de píxel: el disc va de 4 a 684), amb la fórmula de la projecció
 * geoestacionària de la CGMS (latitud geodèsica → geocèntrica, el·lipsoide WGS84). x creix cap a l'est i y cap al sud.
 */
export function geosImagePoint(latDeg: number, lonDeg: number, subLon: number): { u: number; v: number } {
  const cLat = Math.atan((1 - WGS84_E2) * Math.tan(latDeg * DEG));
  const cosC = Math.cos(cLat);
  const rl = WGS84_B_KM / Math.sqrt(1 - WGS84_E2 * cosC * cosC);
  const dLon = (lonDeg - subLon) * DEG;
  const r1 = GEO_RADIUS_KM - rl * cosC * Math.cos(dLon);
  const r2 = -rl * cosC * Math.sin(dLon);
  const r3 = rl * Math.sin(cLat);
  const rn = Math.sqrt(r1 * r1 + r2 * r2 + r3 * r3);
  const x = Math.atan(-r2 / r1) / DEG;
  const y = Math.asin(-r3 / rn) / DEG;
  return { u: CIRA_CENTER_PX + x / CIRA_DEG_PER_PX, v: CIRA_CENTER_PX + y / CIRA_DEG_PER_PX };
}

/**
 * Passa el disc de CIRA a l'ortogràfic dels altres dos ulls (els marcadors fan servir la mateixa fórmula per a tots
 * tres): per a cada píxel del disc de sortida, la latitud i la longitud, i d'aquí el píxel de la vista del satèl·lit.
 * Fora del disc, transparent; més enllà de l'horitzó del satèl·lit, negre.
 */
export function reprojectGeosToDisc(src: Uint32Array, srcSize: number, subLon: number, size: number): Uint32Array {
  const out = new Uint32Array(size * size);
  for (let j = 0; j < size; j++) {
    const y = 1 - (2 * j + 1) / size;
    const latDeg = Math.asin(y) / DEG;
    const rowStart = j * size;
    for (let i = 0; i < size; i++) {
      const x = (2 * i + 1) / size - 1;
      const r2 = x * x + y * y;
      if (r2 > 1) continue;
      const depth = Math.sqrt(1 - r2);
      if (depth < COS_CIRA_VIEW_MAX) {
        out[rowStart + i] = OPAQUE_BLACK;
        continue;
      }
      const { u, v } = geosImagePoint(latDeg, subLon + Math.atan2(x, depth) / DEG, subLon);
      const col = Math.max(0, Math.min(srcSize - 1, Math.floor(u)));
      const row = Math.max(0, Math.min(srcSize - 1, Math.floor(v)));
      out[rowStart + i] = src[row * srcSize + col];
    }
  }
  return out;
}
