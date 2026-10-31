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
  DISC_PX, GIBS_LAYERS, IR_MAX_DARK_SHARE, METEOSAT_CAPS_URL, SOURCE_PX,
  darkShare, gibsWmsUrl, meteosatImageUrl, parseGibsSlots, pickGibsSlots, reprojectToDisc, sourceParts,
  type GibsEye, type GibsProduct,
} from '../utils/orbitalImage';

export type OrbitalImage =
  | { status: 'loading' }
  | { status: 'ready'; src: string; /** Hora de la imatge (ms), si se sap. */ timeMs: number | null; product: GibsProduct }
  | { status: 'failed' };

type ReadyImage = Extract<OrbitalImage, { status: 'ready' }>;

const CACHE_MS = 10 * 60 * 1000;
const META_TIMEOUT_MS = 8000;
const IMAGE_TIMEOUT_MS = 20000;

const cache = new Map<OrbitEye, { at: number; image: ReadyImage }>();
const inFlight = new Map<OrbitEye, Promise<ReadyImage>>();

const freshCached = (eye: OrbitEye): ReadyImage | null => {
  const hit = cache.get(eye);
  return hit && Date.now() - hit.at < CACHE_MS ? hit.image : null;
};

/** Una imatge carregada i descodificada; amb CORS si se n'han de llegir els píxels. */
function loadImage(src: string, crossOrigin: boolean): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const timer = setTimeout(() => {
      img.onload = null;
      img.onerror = null;
      img.src = '';
      reject(new Error('timeout'));
    }, IMAGE_TIMEOUT_MS);
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
    const response = await fetchWithTimeout(METEOSAT_CAPS_URL, META_TIMEOUT_MS);
    if (response.ok) timeMs = latestImageTime(await response.text());
  } catch { /* sense l'hora: es demana la imatge per defecte, que també és la més nova */ }
  const src = meteosatImageUrl(timeMs);
  await loadImage(src, false);
  return { status: 'ready', src, timeMs, product: 'colour' };
}

/** Reprojecta una franja de GIBS al disc i en fa un JPEG; null si la franja surt buida. */
async function gibsDisc(eye: GibsEye, layer: string, slotSec: number, product: GibsProduct): Promise<string | null> {
  const parts = sourceParts(eyeInfo(eye).subLon);
  const images = await Promise.all(parts.map((part) => loadImage(gibsWmsUrl(layer, slotSec, part), true)));

  const source = document.createElement('canvas');
  source.width = SOURCE_PX;
  source.height = SOURCE_PX;
  const sourceCtx = source.getContext('2d', { willReadFrequently: true });
  if (!sourceCtx) throw new Error('no canvas');
  // GIBS deixa fosca l'última columna d'una imatge que acaba just a 180°: la peça següent la tapa (1 px, 0,16°).
  images.forEach((img, i) => {
    const overlap = i > 0 ? 1 : 0;
    sourceCtx.drawImage(img, parts[i].x - overlap, 0, parts[i].width + overlap, SOURCE_PX);
  });
  const pixels = new Uint32Array(sourceCtx.getImageData(0, 0, SOURCE_PX, SOURCE_PX).data.buffer);

  const disc = reprojectToDisc(pixels, SOURCE_PX, SOURCE_PX, DISC_PX);
  if (product === 'ir' && darkShare(disc, DISC_PX) > IR_MAX_DARK_SHARE) return null;

  const out = document.createElement('canvas');
  out.width = DISC_PX;
  out.height = DISC_PX;
  const outCtx = out.getContext('2d');
  if (!outCtx) throw new Error('no canvas');
  const imageData = outCtx.createImageData(DISC_PX, DISC_PX);
  imageData.data.set(new Uint8ClampedArray(disc.buffer));
  outCtx.putImageData(imageData, 0, 0);
  const blob = await new Promise<Blob | null>((resolve) => out.toBlob(resolve, 'image/jpeg', 0.88));
  return blob ? URL.createObjectURL(blob) : null;
}

async function loadGibs(eye: GibsEye): Promise<ReadyImage> {
  let slots = null;
  try {
    const response = await fetchWithTimeout(`${SAT_PROXY_HOST}/hd/${eye}/latest`, META_TIMEOUT_MS);
    if (response.ok) slots = parseGibsSlots(await response.json());
  } catch { /* sense la llista: hores calculades */ }
  const { product, candidates } = pickGibsSlots(slots, Math.floor(Date.now() / 1000), !!GIBS_LAYERS[eye].colour);
  const layer = GIBS_LAYERS[eye][product];
  if (!layer) throw new Error('no layer');
  for (const slotSec of candidates) {
    try {
      const src = await gibsDisc(eye, layer, slotSec, product);
      if (src) return { status: 'ready', src, timeMs: slotSec * 1000, product };
    } catch { /* la franja anterior */ }
  }
  throw new Error('no GIBS image');
}

function loadEye(eye: OrbitEye): Promise<ReadyImage> {
  const pending = inFlight.get(eye);
  if (pending) return pending;
  const promise = (eye === 'meteosat' ? loadMeteosat() : loadGibs(eye))
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
