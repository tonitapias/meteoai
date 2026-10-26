// src/hooks/useRadarNowcastTiming.ts
//
// Estima QUAN començarà o acabarà la pluja a la ubicació de l'usuari,
// mostrejant els frames de "nowcast" del radar (projecció de moviment de
// l'eco, no un model físic) que LibreWXR ja envia i que fins ara no es
// feien servir enlloc (RainViewerResponseSchema.radar.nowcast). Reaprofita
// useRadarData() i les utilitats de radarSampling.ts sense modificar-les.
//
// Limitacions: el nowcast és una extrapolació lineal, fiable per pluja que
// ja existeix i es desplaça, molt menys per cèl·lules convectives que
// apareixen sobtadament. Horitzó limitat als frames disponibles (~55 min);
// més enllà no hi ha informació. Només es reporta la PRIMERA transició
// trobada, no cicles humit-sec-humit dins la mateixa hora.
import { useEffect, useState } from 'react';
import { useRadarData } from './useRadarData';
import { lonLatToTile, rgbaToClosestDbz, dbzToMmPerHour, fetchTilePixel, radarTileUrl, sampleZoomForHost } from '../utils/radarSampling';

const REFRESH_MS = 5 * 60 * 1000; // Igual que useRadarData.ts CACHE_TTL.

// Mateix llindar que useRadarRealityCheck.ts per considerar "hi ha pluja" en un frame.
const PRECIP_MM_H_THRESHOLD = 0.5;

export type NowcastTransition = { type: 'start' | 'end'; inMinutes: number };

// null = la tessel·la no s'ha pogut llegir (xarxa, CORS, error del servidor). Abans comptava com a "sec": amb la imatge
// d'ara plujosa i una de les següents fallida, el bàner anunciava que la pluja s'acabava.
const isWet = async (tileUrl: string, px: number, py: number): Promise<boolean | null> => {
  const pixel = await fetchTilePixel(tileUrl, px, py);
  if (!pixel) return null;
  const [r, g, b, a] = pixel;
  const dbz = rgbaToClosestDbz(r, g, b, a);
  return dbz !== null && dbzToMmPerHour(dbz) >= PRECIP_MM_H_THRESHOLD;
};

export function useRadarNowcastTiming(
  lat: number | undefined,
  lon: number | undefined
): { transition: NowcastTransition | null } {
  const { radarData, fetchRadarData } = useRadarData();
  const [transition, setTransition] = useState<NowcastTransition | null>(null);

  useEffect(() => {
    fetchRadarData();
    const id = setInterval(() => fetchRadarData(), REFRESH_MS);
    return () => clearInterval(id);
  }, [fetchRadarData]);

  // [FIX] Mateix problema que useRadarRealityCheck.ts: `setTransition` no es
  // pot cridar síncronament dins del cos de l'efecte (react-hooks/set-state-in-effect).
  // Derivem el valor efectiu a `hasValidInputs` més avall.
  const hasValidInputs = lat !== undefined && lon !== undefined
    && !!radarData?.radar?.past?.length && !!radarData?.radar?.nowcast?.length;

  useEffect(() => {
    const pastFrames = radarData?.radar?.past;
    const nowcastFrames = radarData?.radar?.nowcast;

    if (lat === undefined || lon === undefined || !pastFrames?.length || !nowcastFrames?.length || !radarData) {
      return;
    }

    let cancelled = false;
    const tile = lonLatToTile(lon, lat, sampleZoomForHost(radarData.host));
    const latestFrame = pastFrames[pastFrames.length - 1];
    const currentTileUrl = radarTileUrl(radarData.host, latestFrame.path, tile);

    (async () => {
      const currentlyWet = await isWet(currentTileUrl, tile.px, tile.py);
      if (cancelled) return;
      // Sense saber si ara plou, no es pot anunciar cap canvi.
      if (currentlyWet === null) { setTransition(null); return; }

      for (const frame of nowcastFrames) {
        if (frame.time === null) continue;
        const tileUrl = radarTileUrl(radarData.host, frame.path, tile);
        const wetHere = await isWet(tileUrl, tile.px, tile.py);
        if (cancelled) return;
        // Una imatge il·legible talla la seqüència: el canvi que es trobés després tindria l'hora equivocada.
        if (wetHere === null) { setTransition(null); return; }

        if (wetHere !== currentlyWet) {
          const inMinutes = Math.round((frame.time * 1000 - Date.now()) / 60000);
          setTransition({ type: currentlyWet ? 'end' : 'start', inMinutes: Math.max(0, inMinutes) });
          return;
        }
      }
      setTransition(null);
    })();

    return () => { cancelled = true; };
  }, [radarData, lat, lon]);

  return { transition: hasValidInputs ? transition : null };
}
