import { useState, useCallback, useEffect, useRef } from 'react';
import { z } from 'zod';
import { RainViewerResponseSchema } from '../utils/radarPhysics';
import { fetchWithTimeout } from '../utils/networkUtils';
import { isLibreWxrStuck, lonLatToTile, measureFrameChange, STUCK_CHECK_ZOOM } from '../utils/radarSampling';

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

// Es consulten els dos proveïdors en paral·lel (si LibreWXR no respon, no cal
// esperar el seu temps d'espera per demanar RainViewer), però el mapa en
// dibuixa UN de sol (vegeu useRadarSources): LibreWXR, que arriba a més llocs
// del món (Àfrica, Rússia, el Canadà, els oceans), i RainViewer només si
// LibreWXR no ha donat dades o hi és encallat al lloc.
//
// CORRECCIÓ (2026-11-12, "l'animació es veu sobreposada"): abans RainViewer
// anava com a capa "prioritària" per sobre de LibreWXR a cada fotograma.
// RainViewer ja no fa cas de l'esquema de colors de l'URL (els esquemes 0 a 8
// donen la mateixa imatge byte a byte: la seva paleta "Universal Blue", amb
// la plugim beix i mig transparent) i les seves zones de pluja no coincideixen
// amb les de LibreWXR a la mateixa hora; totes dues juntes eren dues paletes i
// dues formes de pluja barrejades. A més, la taula NEXRAD de radarSampling
// llegeix aquesta plugim beix com a 70-73 dBZ (centenars de mm/h): els avisos
// (useRadarRealityCheck, useRadarNowcastTiming) només mostregen LibreWXR.
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
  const [librewxrData, setLibrewxrData] = useState<RadarData | null>(null);
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
          setLibrewxrData(librewxr);
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
        setLibrewxrData(data.librewxr);
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

  return { loading, error, radarData, librewxrData, rainviewerData, fetchRadarData };
}

// Una sola comprovació per lloc i parella de línies temporals, compartida pel
// mapa i els dos avisos (el tauler la fa en carregar i el mapa la troba feta).
const stuckChecks = new Map<string, Promise<boolean>>();
const MAX_STUCK_CHECKS = 8;
const frameSpan = (d: RadarData | null) => {
  const past = d?.radar?.past;
  return past?.length ? `${past[0].time}-${past[past.length - 1].time}` : '-';
};

function checkLibreWxrStuck(key: string, lw: RadarData, rv: RadarData | null, lat: number, lon: number): Promise<boolean> {
  let check = stuckChecks.get(key);
  if (!check) {
    check = Promise.all([measureFrameChange(lw, lat, lon), rv ? measureFrameChange(rv, lat, lon) : null])
      .then(([lwChange, rvChange]) => isLibreWxrStuck(lwChange, rvChange))
      .catch(() => false);
    stuckChecks.set(key, check);
    if (stuckChecks.size > MAX_STUCK_CHECKS) stuckChecks.delete(stuckChecks.keys().next().value as string);
  }
  return check;
}

/**
 * Quina font fa servir cada consumidor al lloc (lat, lon):
 * - `mapData`: l'única que dibuixa el mapa. LibreWXR; RainViewer si LibreWXR
 *   no ha donat dades o hi és encallat (radarSampling.isLibreWxrStuck).
 * - `samplingData`: la que poden llegir els avisos. Només LibreWXR, i cap si
 *   és encallat (llegirien pluja antiga).
 * Mentre no s'ha fet la primera comprovació, totes dues són null; després,
 * en arribar dades noves, es manté la decisió anterior fins que hi ha la nova
 * (sense parpelleig del mapa ni dels avisos).
 */
export function useRadarSources(lat?: number, lon?: number) {
  const { loading, error, radarData, librewxrData, rainviewerData, fetchRadarData } = useRadarData();
  const hasPoint = lat !== undefined && lon !== undefined;
  const tile = hasPoint ? lonLatToTile(lon, lat, STUCK_CHECK_ZOOM) : null;
  const key = librewxrData?.radar?.past?.length && tile
    ? `${tile.x}/${tile.y}|${frameSpan(librewxrData)}|${frameSpan(rainviewerData)}`
    : null;
  const [checked, setChecked] = useState<{ key: string; stuck: boolean } | null>(null);

  useEffect(() => {
    if (!key || !librewxrData || lat === undefined || lon === undefined) return;
    let cancelled = false;
    checkLibreWxrStuck(key, librewxrData, rainviewerData, lat, lon).then((stuck) => {
      if (!cancelled) setChecked({ key, stuck });
    });
    return () => { cancelled = true; };
  }, [key, librewxrData, rainviewerData, lat, lon]);

  const firstCheckPending = key !== null && checked === null;
  const stuck = key !== null && !!checked?.stuck && !!rainviewerData?.radar?.past?.length;
  return {
    loading: loading || firstCheckPending,
    error,
    fetchRadarData,
    mapData: firstCheckPending ? null : stuck ? rainviewerData : radarData,
    samplingData: firstCheckPending || (key !== null && !!checked?.stuck) ? null : librewxrData,
  };
}
