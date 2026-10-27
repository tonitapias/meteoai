// src/hooks/welcome/useElevatorClouds.ts
// Els núvols de la primera parada de l'ascensor: la cobertura baixa, mitjana i alta d'ara mateix i la cota de neu
// on és el dispositiu. La benvinguda no consulta cap dada; només aquest secret, quan algú el troba, fa una consulta
// mínima a Open-Meteo (coordenades arrodonides a 0,01°). Si tarda o falla, l'ascensor puja igual, sense percentatges.
import { useEffect, useState } from 'react';
import { OPEN_METEO_FORECAST_URL } from '../../constants/apiConfig';
import { fetchWithTimeout } from '../../utils/networkUtils';
import { calculateSnowLevel } from '../../utils/rules/winterRules';
import type { SkyPlace } from '../../utils/welcome/welcomeSky';

export interface ElevatorClouds {
  /** Cobertura de núvols baixos, mitjans i alts (%). */
  low: number;
  mid: number;
  high: number;
  /** Cota de neu (m), o null si el model no dona la isoterma de 0 °C. */
  snowLevel: number | null;
}

const TIMEOUT_MS = 9000;
const pct = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? Math.min(100, Math.max(0, v)) : null);

/** Llegeix la resposta de `current`; null si hi falta alguna cobertura. */
export function parseElevatorClouds(json: unknown): ElevatorClouds | null {
  const current = (json as { current?: Record<string, unknown> } | null)?.current;
  if (!current) return null;
  const low = pct(current.cloud_cover_low), mid = pct(current.cloud_cover_mid), high = pct(current.cloud_cover_high);
  if (low === null || mid === null || high === null) return null;
  return { low, mid, high, snowLevel: calculateSnowLevel(current.freezing_level_height) };
}

export function useElevatorClouds(place: SkyPlace): ElevatorClouds | null {
  const [clouds, setClouds] = useState<ElevatorClouds | null>(null);
  const { lat, lon } = place;

  useEffect(() => {
    let alive = true;
    const params = new URLSearchParams({
      latitude: lat.toFixed(2),
      longitude: lon.toFixed(2),
      current: 'cloud_cover_low,cloud_cover_mid,cloud_cover_high,freezing_level_height',
      timezone: 'GMT',
    });
    fetchWithTimeout(`${OPEN_METEO_FORECAST_URL}?${params.toString()}`, TIMEOUT_MS)
      .then(response => (response.ok ? response.json() : null))
      .then(json => { if (alive) setClouds(parseElevatorClouds(json)); })
      .catch(() => { /* sense dades: l'ascensor mostra les capes sense percentatges */ });
    return () => { alive = false; };
  }, [lat, lon]);

  return clouds;
}
