// src/hooks/useLightningNearby.ts
//
// Llamps observats a prop de la ubicació (lightningService). El fan servir
// l'avís del tauler i la IA.
import { useEffect, useState } from 'react';
import { getLightningNearby, type LightningNearby } from '../services/lightningService';

// El Lightning Imager publica una franja cada 5 min i el servei comparteix cada consulta 4 min: mirar-ho cada minut
// no fa més peticions, però si una consulta falla (worker lent) es torna a provar al cap d'1 min i no de 5.
const REFRESH_MS = 60 * 1000;
// Una consulta que falla no esborra els llamps que ja se sabien: sense això, una sola fallada amagava l'avís i
// tornava la IA a la clau "sense llamps" durant un minut (parpelleig del bàner i del semàfor). Però si les fallades
// duren més d'això, l'observació ja és massa vella per dir "ara".
const KEEP_ON_FAILURE_MS = 10 * 60 * 1000;

interface Result {
  key: string;
  value: LightningNearby | null;
  // Quan es va obtenir `value` (no quan va fallar l'última consulta).
  at: number;
}

export interface LightningNearbyState {
  lightning: LightningNearby | null;
  // La primera consulta d'aquesta ubicació ja ha acabat (bé o malament): la IA hi pot esperar uns segons.
  settled: boolean;
}

export function useLightningNearby(lat: number | undefined, lon: number | undefined): LightningNearbyState {
  const [result, setResult] = useState<Result | null>(null);
  const key = lat !== undefined && lon !== undefined ? `${lat.toFixed(2)},${lon.toFixed(2)}` : null;

  useEffect(() => {
    if (lat === undefined || lon === undefined || key === null) return;
    let cancelled = false;
    const load = () => {
      getLightningNearby(lat, lon).then((value) => {
        if (cancelled) return;
        setResult((prev) => {
          const samePlace = prev !== null && prev.key === key;
          if (value === undefined) {
            if (samePlace && (prev.value === null || Date.now() - prev.at < KEEP_ON_FAILURE_MS)) return prev;
            return { key, value: null, at: Date.now() };
          }
          // Mentre dura la consulta compartida torna el mateix objecte: sense canvis, cap render.
          if (samePlace && prev.value === value) return prev;
          return { key, value, at: Date.now() };
        });
      });
    };
    load();
    const id = setInterval(load, REFRESH_MS);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [lat, lon, key]);

  // Només el resultat de la ubicació actual: en canviar de lloc no es mostren els llamps de l'anterior.
  const current = result !== null && result.key === key ? result : null;
  return { lightning: current?.value ?? null, settled: current !== null };
}
