// src/hooks/welcome/useAntipodesPhoto.ts
// La foto de l'arribada de l'ascensor cap avall: les antípodes vistes pel satèl·lit NOAA-20 a la passada de dia més
// recent (color real, el mosaic diari de la NASA, GIBS). Les tessel·les es baixen d'amagat durant la baixada, amb CORS i
// directament de la NASA: el mateix servidor que la capa "Imatge satèl·lit" del radar, però aquí cal triar la data de
// cada tessel·la (el meridià 180 parteix el dia, vegeu tileDate) i això el worker no ho fa.
// GIBS no dona error per a una data a mig processar: torna una tessel·la negra, sense la capçalera Layer-Time-Actual.
// Per això es comprova cada tessel·la i, si n'hi ha de buides o massa negres, es prova la passada del dia abans.
import { useEffect, useState } from 'react';
import {
  gibsTileUrl, latestPassDay, photoTiles, photoZoom, tileDate, type PhotoScale,
} from '../../utils/welcome/earthElevator';

const TILE_TIMEOUT_MS = 8000;
/** Passades que es proven, de la més recent enrere. */
const MAX_ATTEMPTS = 4;
/** Una tessel·la de veritat, fins i tot de mar obert, en fa més; la buida de GIBS en fa 1.665. */
const MIN_TILE_BYTES = 2500;
/** Fracció de píxels negres a partir de la qual la passada es considera incompleta (calibrat al worker: 3 %). */
const MAX_BLACK = 0.05;
/** Lluminositat (BT.601, 0–255) per sota de la qual un píxel és negre: el mar obert fa més de 14. */
const BLACK_LUMA = 10;

export interface PhotoFrame { width: number; height: number }

export type AntipodesPhoto =
  | { status: 'loading' }
  | { status: 'ready'; tiles: { src: string; left: number; top: number }[]; zoom: number; tilePx: number; passDay: number }
  | { status: 'failed' };

async function fetchTile(url: string, signal: AbortSignal): Promise<Blob | null> {
  const controller = new AbortController();
  const abort = () => controller.abort();
  const timer = window.setTimeout(abort, TILE_TIMEOUT_MS);
  signal.addEventListener('abort', abort);
  try {
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok || !response.headers.get('layer-time-actual')) return null;
    const blob = await response.blob();
    return blob.size >= MIN_TILE_BYTES ? blob : null;
  } catch {
    return null;
  } finally {
    window.clearTimeout(timer);
    signal.removeEventListener('abort', abort);
  }
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('imatge il·legible'));
    img.src = src;
  });
}

/** Fracció de píxels negres de la foto sencera, mirada a 1/8 de la mida (prou per veure-hi franges sense dades). */
async function blackFraction(tiles: { src: string; left: number; top: number }[], tilePx: number, frame: PhotoFrame): Promise<number> {
  const scale = 1 / 8;
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(frame.width * scale));
  canvas.height = Math.max(1, Math.round(frame.height * scale));
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return 0;
  const images = await Promise.all(tiles.map(t => loadImage(t.src)));
  images.forEach((img, i) => ctx.drawImage(img, tiles[i].left * scale, tiles[i].top * scale, tilePx * scale, tilePx * scale));
  const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height);
  let black = 0;
  for (let i = 0; i < data.length; i += 4) {
    if (data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114 < BLACK_LUMA) black++;
  }
  return black / (data.length / 4);
}

/**
 * `scale` null: encara no se sap si les antípodes són a prop de terra (la foto espera, la baixada dura prou).
 * `frame`: mida de la foto en px de pantalla, fixada en obrir l'ascensor.
 */
export function useAntipodesPhoto(lat: number, lon: number, scale: PhotoScale | null, frame: PhotoFrame): AntipodesPhoto {
  const [state, setState] = useState<AntipodesPhoto>({ status: 'loading' });
  const { width, height } = frame;

  useEffect(() => {
    if (!scale) return;
    const controller = new AbortController();
    let urls: string[] = [];
    const release = () => { urls.forEach(u => URL.revokeObjectURL(u)); urls = []; };
    (async () => {
      const { zoom, tilePx } = photoZoom(scale, window.devicePixelRatio || 1);
      const plan = photoTiles(lat, lon, zoom, tilePx, width, height);
      const newest = latestPassDay(Date.now(), lon);
      for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
        const passDay = newest - attempt;
        const blobs = await Promise.all(plan.map(t => fetchTile(gibsTileUrl(tileDate(passDay, lon, t.lon), zoom, t.x, t.y), controller.signal)));
        if (controller.signal.aborted) return;
        if (blobs.some(b => b === null)) continue;
        release();
        urls = blobs.map(b => URL.createObjectURL(b as Blob));
        const tiles = plan.map((t, i) => ({ src: urls[i], left: t.left, top: t.top }));
        let black = 0;
        try { black = await blackFraction(tiles, tilePx, frame); } catch { /* sense comprovació: es dona per bona */ }
        if (controller.signal.aborted) return;
        if (black > MAX_BLACK) continue;
        setState({ status: 'ready', tiles, zoom, tilePx, passDay });
        return;
      }
      release();
      setState({ status: 'failed' });
    })();
    return () => {
      controller.abort();
      release();
    };
    // `frame` es fixa en obrir l'ascensor: només en compten les mides.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lat, lon, scale, width, height]);

  return state;
}
