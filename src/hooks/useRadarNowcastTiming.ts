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
import { lonLatToTile, rgbaToClosestDbz, dbzToMmPerHour, fetchTilePixel } from '../utils/radarSampling';

// Mateix zoom fix que la capa principal de radar a useRadarAnimation.ts (maxzoom: 8).
const SAMPLE_ZOOM = 8;
const REFRESH_MS = 5 * 60 * 1000; // Igual que useRadarData.ts CACHE_TTL.

// Mateix llindar que useRadarRealityCheck.ts per considerar "hi ha pluja" en un frame.
const PRECIP_MM_H_THRESHOLD = 0.5;

export type NowcastTransition = { type: 'start' | 'end'; inMinutes: number };

const buildTileUrl = (host: string, path: string, tile: { z: number; x: number; y: number }) =>
  `${host}${path}/512/${tile.z}/${tile.x}/${tile.y}/6/1_1.png`;

const isWet = async (tileUrl: string, px: number, py: number): Promise<boolean> => {
  const pixel = await fetchTilePixel(tileUrl, px, py);
  if (!pixel) return false;
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

  useEffect(() => {
    const pastFrames = radarData?.radar?.past;
    const nowcastFrames = radarData?.radar?.nowcast;

    if (lat === undefined || lon === undefined || !pastFrames?.length || !nowcastFrames?.length || !radarData) {
      setTransition(null);
      return;
    }

    let cancelled = false;
    const tile = lonLatToTile(lon, lat, SAMPLE_ZOOM);
    const latestFrame = pastFrames[pastFrames.length - 1];
    const currentTileUrl = buildTileUrl(radarData.host, latestFrame.path, tile);

    (async () => {
      const currentlyWet = await isWet(currentTileUrl, tile.px, tile.py);
      if (cancelled) return;

      for (const frame of nowcastFrames) {
        if (frame.time === null) continue;
        const tileUrl = buildTileUrl(radarData.host, frame.path, tile);
        const wetHere = await isWet(tileUrl, tile.px, tile.py);
        if (cancelled) return;

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

  return { transition };
}
