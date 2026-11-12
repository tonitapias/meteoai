// src/hooks/useOrbitalImage.ts
// La imatge real del disc de cada ull del visor orbital (vegeu utils/orbitalImage.ts). Només es baixa la de l'ull
// que es mira, quan es mira; cada una es guarda 10 min, de manera que tornar a un ull no la torna a baixar.
// L'ascensor de la benvinguda té la seva (useMeteosatImage) i no en depèn.
import { useEffect, useState } from 'react';
import { fetchWithTimeout } from '../utils/networkUtils';
import { latestImageTime } from '../utils/welcome/skyElevator';
import { SAT_PROXY_HOST } from '../utils/radarPhysics';
import { eyeInfo, type OrbitEye } from '../utils/orbitalView';
import {
  CIRA_DISC_PX, DISC_PX, GIBS_PRODUCTS, MAX_MISSING_SHARE, METEOSAT_CAPS_URL, TILE_PX,
  ciraDiscUrl, discMosaic, discTileUrl, gibsAttempts, hasDarkEastEdge, meteosatImageUrl, missingShare, parseCiraSlots,
  parseGibsSlots, reprojectGeosToDisc, reprojectMercatorToDisc,
  type DiscAttempt, type GibsEye, type GibsProduct,
} from '../utils/orbitalImage';

export type OrbitalImage =
  | { status: 'loading' }
  | {
    status: 'ready';
    src: string;
    /** Hora de la imatge (ms), si se sap. */
    timeMs: number | null;
    product: GibsProduct;
    /** L'Himawari en GeoColor de CIRA (canvia el crèdit). */
    source?: 'cira';
  }
  | { status: 'failed' };

type ReadyImage = Extract<OrbitalImage, { status: 'ready' }>;

const CACHE_MS = 10 * 60 * 1000;
const METEOSAT_META_TIMEOUT_MS = 8000;
const METEOSAT_IMAGE_TIMEOUT_MS = 20000;
// GOES i Himawari: tot plegat, com a molt 20 s (abans, fins a 3 intents de 20 s). La llista de franges, 4 s (el
// radar n'espera 3). Un producte que en té un altre al darrere (el GeoColor del GOES, amb l'infraroig) té 10 s;
// si no arriba a temps, no prova cap altra franja seva (el servei va lent) i es passa al següent. L'últim té tot
// el temps que queda. Una franja amb forats (els taulers han arribat, però incomplets) dona pas a l'anterior.
const GIBS_TOTAL_BUDGET_MS = 20000;
const GIBS_META_TIMEOUT_MS = 4000;
const GIBS_FIRST_PRODUCT_MS = 10000;
const GIBS_MIN_ATTEMPT_MS = 1500;
// L'Himawari en GeoColor de CIRA, dins el mateix pressupost: com el GeoColor del GOES, 10 s i, si no, l'infraroig
// amb el temps que queda. Se'n proven les dues franges més noves (la més nova pot no ser encara al worker).
const CIRA_BUDGET_MS = 10000;
const CIRA_SLOTS = 2;

const cache = new Map<OrbitEye, { at: number; image: ReadyImage }>();
const inFlight = new Map<OrbitEye, Promise<ReadyImage>>();

const freshCached = (eye: OrbitEye): ReadyImage | null => {
  const hit = cache.get(eye);
  return hit && Date.now() - hit.at < CACHE_MS ? hit.image : null;
};

class ImageTimeout extends Error {}

/** Una imatge carregada i descodificada; amb CORS si se n'han de llegir els píxels. */
function loadImage(src: string, crossOrigin: boolean, timeoutMs: number): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const timer = setTimeout(() => {
      img.onload = null;
      img.onerror = null;
      img.src = '';
      reject(new ImageTimeout('timeout'));
    }, timeoutMs);
    if (crossOrigin) img.crossOrigin = 'anonymous';
    img.decoding = 'async';
    img.onload = () => { clearTimeout(timer); resolve(img); };
    img.onerror = () => { clearTimeout(timer); reject(new Error('image error')); };
    img.src = src;
  });
}

async function loadMeteosat(): Promise<ReadyImage> {
  let timeMs: number | null = null;
  try {
    const response = await fetchWithTimeout(METEOSAT_CAPS_URL, METEOSAT_META_TIMEOUT_MS);
    if (response.ok) timeMs = latestImageTime(await response.text());
  } catch { /* sense l'hora: es demana la imatge per defecte, que també és la més nova */ }
  const src = meteosatImageUrl(timeMs);
  await loadImage(src, false, METEOSAT_IMAGE_TIMEOUT_MS);
  return { status: 'ready', src, timeMs, product: 'colour' };
}

/** 'slow': algun tauler no ha arribat a temps; 'holes': han arribat, però el disc té forats. */
type DiscResult = { src: string } | 'slow' | 'holes';

/** Fa el disc d'una franja amb els taulers del worker: mosaic, reprojecció i JPEG. */
async function gibsDisc(eye: GibsEye, attempt: DiscAttempt, timeoutMs: number): Promise<DiscResult> {
  const { subLon } = eyeInfo(eye);
  const mosaic = discMosaic(subLon);
  let slow = false;
  const images = await Promise.all(mosaic.tiles.map((tile) =>
    loadImage(discTileUrl(SAT_PROXY_HOST, eye, attempt, tile), true, timeoutMs).catch((error: unknown) => {
      if (error instanceof ImageTimeout) slow = true;
      return null;
    })));

  const source = document.createElement('canvas');
  source.width = mosaic.width;
  source.height = mosaic.height;
  const sourceCtx = source.getContext('2d', { willReadFrequently: true });
  if (!sourceCtx) throw new Error('no canvas');
  images.forEach((img, i) => {
    if (!img) return;
    const { left, top } = mosaic.tiles[i];
    sourceCtx.drawImage(img, left, top);
    if (hasDarkEastEdge(mosaic.tiles[i])) sourceCtx.drawImage(img, TILE_PX - 2, 0, 1, TILE_PX, left + TILE_PX - 1, top, 1, TILE_PX);
  });
  const pixels = new Uint32Array(sourceCtx.getImageData(0, 0, mosaic.width, mosaic.height).data.buffer);
  // El mosaic fa ~10 MB: fora tan aviat com es pugui (mòbils modestos).
  source.width = 0;
  source.height = 0;

  const disc = reprojectMercatorToDisc(pixels, mosaic, subLon, DISC_PX);
  if (missingShare(disc, DISC_PX, attempt.product === 'ir') > MAX_MISSING_SHARE) return slow ? 'slow' : 'holes';
  return { src: await discToJpeg(disc) };
}

/** El disc reprojectat (DISC_PX × DISC_PX, RGBA) en un JPEG per a l'<img>. */
async function discToJpeg(disc: Uint32Array): Promise<string> {
  const out = document.createElement('canvas');
  out.width = DISC_PX;
  out.height = DISC_PX;
  const outCtx = out.getContext('2d');
  if (!outCtx) throw new Error('no canvas');
  const imageData = outCtx.createImageData(DISC_PX, DISC_PX);
  imageData.data.set(new Uint8ClampedArray(disc.buffer));
  outCtx.putImageData(imageData, 0, 0);
  const blob = await new Promise<Blob | null>((resolve) => out.toBlob(resolve, 'image/jpeg', 0.88));
  if (!blob) throw new Error('no blob');
  return URL.createObjectURL(blob);
}

/** L'Himawari en GeoColor de CIRA: la franja més nova que el worker serveixi, passada al disc; null si cap. */
async function loadCira(deadline: number): Promise<ReadyImage | null> {
  let slots: number[] | null = null;
  try {
    const response = await fetchWithTimeout(`${SAT_PROXY_HOST}/hd/himawari/disc/latest`, Math.min(GIBS_META_TIMEOUT_MS, deadline - Date.now()));
    if (response.ok) slots = parseCiraSlots(await response.json());
  } catch { /* sense la llista: l'infraroig */ }

  for (const slot of (slots ?? []).slice(0, CIRA_SLOTS)) {
    const left = deadline - Date.now();
    if (left < GIBS_MIN_ATTEMPT_MS) break;
    try {
      const img = await loadImage(ciraDiscUrl(SAT_PROXY_HOST, slot), true, left);
      const source = document.createElement('canvas');
      source.width = CIRA_DISC_PX;
      source.height = CIRA_DISC_PX;
      const sourceCtx = source.getContext('2d', { willReadFrequently: true });
      if (!sourceCtx) throw new Error('no canvas');
      sourceCtx.drawImage(img, 0, 0, CIRA_DISC_PX, CIRA_DISC_PX);
      const pixels = new Uint32Array(sourceCtx.getImageData(0, 0, CIRA_DISC_PX, CIRA_DISC_PX).data.buffer);
      const disc = reprojectGeosToDisc(pixels, CIRA_DISC_PX, eyeInfo('himawari').subLon, DISC_PX);
      return { status: 'ready', src: await discToJpeg(disc), timeMs: slot * 1000, product: 'colour', source: 'cira' };
    } catch (error) {
      // Lenta: l'anterior tampoc arribaria a temps.
      if (error instanceof ImageTimeout) break;
    }
  }
  return null;
}

/** Himawari: GeoColor de CIRA i, si no arriba, l'infraroig dels taulers HD amb el temps que queda. */
async function loadHimawari(): Promise<ReadyImage> {
  const deadline = Date.now() + GIBS_TOTAL_BUDGET_MS;
  const colour = await loadCira(Math.min(deadline, Date.now() + CIRA_BUDGET_MS)).catch(() => null);
  return colour ?? loadGibs('himawari', deadline);
}

async function loadGibs(eye: GibsEye, deadline: number = Date.now() + GIBS_TOTAL_BUDGET_MS): Promise<ReadyImage> {
  let slots = null;
  try {
    const response = await fetchWithTimeout(`${SAT_PROXY_HOST}/hd/${eye}/latest`, Math.min(GIBS_META_TIMEOUT_MS, deadline - Date.now()));
    if (response.ok) slots = parseGibsSlots(await response.json());
  } catch { /* sense la llista: hores calculades */ }

  const attempts = gibsAttempts(slots, Math.floor(Date.now() / 1000), GIBS_PRODUCTS[eye]);
  const slowProducts = new Set<GibsProduct>();
  for (const [index, attempt] of attempts.entries()) {
    if (slowProducts.has(attempt.product)) continue;
    const left = deadline - Date.now();
    if (left < GIBS_MIN_ATTEMPT_MS) break;
    const hasFallback = attempts.slice(index + 1).some((a) => a.product !== attempt.product);
    try {
      const result = await gibsDisc(eye, attempt, hasFallback ? Math.min(GIBS_FIRST_PRODUCT_MS, left) : left);
      if (typeof result === 'object') return { status: 'ready', src: result.src, timeMs: attempt.slot * 1000, product: attempt.product };
      if (result === 'slow') slowProducts.add(attempt.product);
    } catch { /* la franja següent */ }
  }
  throw new Error('no GOES/Himawari image');
}

function loadEye(eye: OrbitEye): Promise<ReadyImage> {
  const pending = inFlight.get(eye);
  if (pending) return pending;
  const promise = (eye === 'meteosat' ? loadMeteosat() : eye === 'himawari' ? loadHimawari() : loadGibs(eye))
    .then((image) => {
      const previous = cache.get(eye)?.image.src;
      if (previous?.startsWith('blob:')) URL.revokeObjectURL(previous);
      cache.set(eye, { at: Date.now(), image });
      return image;
    })
    .finally(() => inFlight.delete(eye));
  inFlight.set(eye, promise);
  return promise;
}

export function useOrbitalImage(eye: OrbitEye): OrbitalImage {
  const [results, setResults] = useState<Partial<Record<OrbitEye, OrbitalImage>>>({});

  useEffect(() => {
    if (freshCached(eye)) return;
    let alive = true;
    loadEye(eye)
      .then((image) => { if (alive) setResults((prev) => ({ ...prev, [eye]: image })); })
      .catch(() => { if (alive) setResults((prev) => ({ ...prev, [eye]: { status: 'failed' } })); });
    return () => { alive = false; };
  }, [eye]);

  return freshCached(eye) ?? results[eye] ?? { status: 'loading' };
}

/** Només per a les proves. */
export const resetOrbitalImageCache = (): void => {
  cache.clear();
  inFlight.clear();
};
