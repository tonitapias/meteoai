// src/hooks/useRadarRealityCheck.ts
//
// Compara la precipitació que el model preveu ARA MATEIX amb el que el radar
// Doppler detecta realment a la mateixa ubicació. Reaprofita useRadarData()
// (cache de 5 min i fallback librewxr->rainviewer ja existents) i mostreja
// un únic píxel de la darrera tessel·la de radar via radarSampling.ts —
// no cal muntar cap mapa.
import { useEffect, useState } from 'react';
import { useRadarData } from './useRadarData';
import { lonLatToTile, rgbaToClosestDbz, dbzToMmPerHour, fetchTilePixel } from '../utils/radarSampling';

// Mateix zoom fix que la capa principal de radar a useRadarAnimation.ts (maxzoom: 8).
const SAMPLE_ZOOM = 8;
const REFRESH_MS = 5 * 60 * 1000; // Igual que useRadarData.ts CACHE_TTL.

// Llindars conservadors: només avisem quan el radar detecta un eco clar
// (per sobre del soroll de fons) i el model prediu pràcticament zero.
// Evita falsos positius per petites diferències residuals entre fonts.
const RADAR_MM_H_THRESHOLD = 0.5;
const MODEL_MM_H_THRESHOLD = 0.2;

export interface RadarRealityStatus {
  radarDbz: number | null;
  radarMmPerHour: number;
  hasDiscrepancy: boolean;
}

interface RadarSample {
  radarDbz: number | null;
  radarMmPerHour: number;
}

const IDLE_SAMPLE: RadarSample = { radarDbz: null, radarMmPerHour: 0 };

export function useRadarRealityCheck(
  lat: number | undefined,
  lon: number | undefined,
  modelMmPerHourNow: number
): RadarRealityStatus {
  const { radarData, fetchRadarData } = useRadarData();
  const [sample, setSample] = useState<RadarSample>(IDLE_SAMPLE);

  // Refresc periòdic: useRadarData ja no torna a demanar dades si la cache
  // interna encara és vàlida, així que cridar-ho sovint és segur.
  useEffect(() => {
    fetchRadarData();
    const id = setInterval(() => fetchRadarData(), REFRESH_MS);
    return () => clearInterval(id);
  }, [fetchRadarData]);

  useEffect(() => {
    if (lat === undefined || lon === undefined || !radarData?.radar?.past?.length) {
      setSample(IDLE_SAMPLE);
      return;
    }

    let cancelled = false;
    const pastFrames = radarData.radar.past;
    const latestFrame = pastFrames[pastFrames.length - 1];
    const tile = lonLatToTile(lon, lat, SAMPLE_ZOOM);
    const tileUrl = `${radarData.host}${latestFrame.path}/512/${tile.z}/${tile.x}/${tile.y}/6/1_1.png`;

    fetchTilePixel(tileUrl, tile.px, tile.py).then((pixel) => {
      if (cancelled) return;
      if (!pixel) {
        setSample(IDLE_SAMPLE);
        return;
      }
      const [r, g, b, a] = pixel;
      const dbz = rgbaToClosestDbz(r, g, b, a);
      const mmPerHour = dbz === null ? 0 : dbzToMmPerHour(dbz);
      setSample({ radarDbz: dbz, radarMmPerHour: mmPerHour });
    });

    return () => { cancelled = true; };
  }, [radarData, lat, lon]);

  const hasDiscrepancy = sample.radarMmPerHour >= RADAR_MM_H_THRESHOLD && modelMmPerHourNow < MODEL_MM_H_THRESHOLD;
  return { ...sample, hasDiscrepancy };
}
