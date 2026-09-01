import { useState, useCallback, useEffect, useRef } from 'react';
import { z } from 'zod';
import { RainViewerResponseSchema } from '../utils/radarPhysics';
import { fetchWithTimeout } from '../utils/networkUtils';

type RadarData = z.infer<typeof RainViewerResponseSchema>;

// Memòria global per evitar fetches duplicats si el component es desmunta/munta ràpid
let globalRadarCache: { data: RadarData; timestamp: number } | null = null;
let globalRadarFetchPromise: Promise<RadarData> | null = null;
const CACHE_TTL = 5 * 60 * 1000; // 5 minuts
const FETCH_TIMEOUT_MS = 12000; // 12 segons de màxim d'espera (Timeout de Muntanya)

// Llista de servidors (Alta Disponibilitat)
const ENDPOINTS = [
  'https://api.librewxr.net/public/weather-maps.json', // Principal
  'https://api.rainviewer.com/public/weather-maps.json' // Fallback d'emergència
];

export function useRadarData() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [radarData, setRadarData] = useState<RadarData | null>(null);
  
  // Ref de seguretat per evitar actualitzacions d'estat si el mapa es tanca abans d'acabar el fetch
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    return () => { isMountedRef.current = false; };
  }, []);

  const fetchRadarData = useCallback(async (forceFetch = false) => {
    if (!isMountedRef.current) return;
    setLoading(true);
    
    try {
      const now = Date.now();
      
      // Retornem memòria cau si és vàlida i no s'ha forçat l'actualització
      if (!forceFetch && globalRadarCache && (now - globalRadarCache.timestamp < CACHE_TTL)) {
        setRadarData(globalRadarCache.data);
        if (isMountedRef.current) {
          setError(false);
          setLoading(false);
        }
        return;
      }
      
      // Control de condicions de cursa (evita 2 peticions simultànies)
      if (!globalRadarFetchPromise || forceFetch) {
        globalRadarFetchPromise = (async () => {
          let rawData = null;
          let fetchError: unknown = null;

          // Bucle de resiliència: Si falla un endpoint, provar el següent
          for (const url of ENDPOINTS) {
            try {
              const response = await fetchWithTimeout(url, FETCH_TIMEOUT_MS);
              if (!response.ok) throw new Error(`HTTP ${response.status} en ${url}`);
              rawData = await response.json();
              break; // Si funciona sortim del bucle de Fallback
            } catch (err: unknown) {
              console.warn(`[Network] Fallada contactant ${url}, provant fallback...`, err);
              fetchError = err;
            }
          }

          // Si després de provar tots els servidors no tenim dades, llencem error fatal
          if (!rawData) {
            throw fetchError instanceof Error ? fetchError : new Error("Tots els servidors de radar estan caiguts o inaccessibles.");
          }

          const parsed = RainViewerResponseSchema.safeParse(rawData);
          
          if (!parsed.success) {
            console.error("[Zod Validation Error] L'API externa ha canviat el format:", parsed.error.format());
            throw new Error("L'estructura de dades de l'API és invàlida o ha canviat.");
          }
          
          return parsed.data;
        })();
      }
      
      const data = await globalRadarFetchPromise;
      globalRadarCache = { data, timestamp: now };
      
      if (isMountedRef.current) {
        setRadarData(data);
        setError(false);
      }
      
    } catch (err: unknown) {
      if (err instanceof Error && err.name === 'AbortError') {
        console.error("[useRadarData] Timeout: La xarxa és massa lenta (possibe entorn GSM dolent).");
      } else {
        console.error("[useRadarData] Error obtenint dades de radar:", err instanceof Error ? err.message : err);
      }
      
      if (isMountedRef.current) {
        setError(true);
      }
    } finally {
      globalRadarFetchPromise = null;
      if (isMountedRef.current) {
        setLoading(false);
      }
    }
  }, []);

  return { loading, error, radarData, fetchRadarData };
}