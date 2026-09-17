import { useState, useCallback, useEffect, useRef } from 'react';
import { z } from 'zod';
import { RainViewerResponseSchema } from '../utils/radarPhysics';
import { fetchWithTimeout } from '../utils/networkUtils';

type RadarData = z.infer<typeof RainViewerResponseSchema>;

interface RadarSources {
  librewxr: RadarData | null;
  rainviewer: RadarData | null;
}

// Memòria global per evitar fetches duplicats si el component es desmunta/munta ràpid
let globalRadarCache: { data: RadarSources; timestamp: number } | null = null;
let globalRadarFetchPromise: Promise<RadarSources> | null = null;
const CACHE_TTL = 5 * 60 * 1000; // 5 minuts
const FETCH_TIMEOUT_MS = 12000; // 12 segons de màxim d'espera (Timeout de Muntanya)

// Ara es consulten SEMPRE els dos proveïdors en paral·lel (no failover
// seqüencial): LibreWXR té cobertura global però RainViewer és qui alimenta
// la capa "prioritària" del mapa allà on té radar real (vegeu RadarMap /
// useRadarAnimation). `radarData` manté el contracte antic (LibreWXR amb
// RainViewer com a fallback d'emergència) perquè useRadarRealityCheck i
// useRadarNowcastTiming en depenen sense canvis.
const LIBREWXR_URL = 'https://api.librewxr.net/public/weather-maps.json';
const RAINVIEWER_URL = 'https://api.rainviewer.com/public/weather-maps.json';

async function fetchRadarSource(url: string): Promise<RadarData | null> {
  try {
    const response = await fetchWithTimeout(url, FETCH_TIMEOUT_MS);
    if (!response.ok) throw new Error(`HTTP ${response.status} en ${url}`);
    const rawData = await response.json();

    const parsed = RainViewerResponseSchema.safeParse(rawData);
    if (!parsed.success) {
      console.error(`[Zod Validation Error] L'API ${url} ha canviat el format:`, parsed.error.format());
      return null;
    }
    return parsed.data;
  } catch (err: unknown) {
    if (err instanceof Error && err.name === 'AbortError') {
      console.warn(`[Network] Timeout contactant ${url} (possible entorn GSM dolent).`);
    } else {
      console.warn(`[Network] Fallada contactant ${url}:`, err);
    }
    return null;
  }
}

export function useRadarData() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [radarData, setRadarData] = useState<RadarData | null>(null);
  const [rainviewerData, setRainviewerData] = useState<RadarData | null>(null);

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
        const { librewxr, rainviewer } = globalRadarCache.data;
        if (isMountedRef.current) {
          setRadarData(librewxr ?? rainviewer);
          setRainviewerData(rainviewer);
          setError(!librewxr && !rainviewer);
          setLoading(false);
        }
        return;
      }

      // Control de condicions de cursa (evita 2 peticions simultànies)
      if (!globalRadarFetchPromise || forceFetch) {
        globalRadarFetchPromise = (async () => {
          const [librewxr, rainviewer] = await Promise.all([
            fetchRadarSource(LIBREWXR_URL),
            fetchRadarSource(RAINVIEWER_URL)
          ]);
          return { librewxr, rainviewer };
        })();
      }

      const data = await globalRadarFetchPromise;
      globalRadarCache = { data, timestamp: now };

      if (isMountedRef.current) {
        setRadarData(data.librewxr ?? data.rainviewer);
        setRainviewerData(data.rainviewer);
        setError(!data.librewxr && !data.rainviewer);
      }

    } catch (err: unknown) {
      console.error("[useRadarData] Error obtenint dades de radar:", err instanceof Error ? err.message : err);
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

  return { loading, error, radarData, rainviewerData, fetchRadarData };
}
