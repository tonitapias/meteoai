import { useState, useCallback, useEffect, useRef } from 'react';
import { z } from 'zod';
import { RainViewerResponseSchema } from '../utils/radarPhysics';

type RadarData = z.infer<typeof RainViewerResponseSchema>;

// Memòria global per evitar fetches duplicats si el component es desmunta/munta ràpid
let globalRadarCache: { data: RadarData; timestamp: number } | null = null;
let globalRadarFetchPromise: Promise<RadarData> | null = null;
const CACHE_TTL = 5 * 60 * 1000; // 5 minuts

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
      
      // Retornem memòria cau si és vàlida
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
          const response = await fetch('https://api.librewxr.net/public/weather-maps.json');
          if (!response.ok) throw new Error(`Error HTTP: ${response.status}`);
          const rawData = await response.json();
          const parsed = RainViewerResponseSchema.safeParse(rawData);
          
          if (!parsed.success) throw new Error("Error de validació de l'API Zod");
          return parsed.data;
        })();
      }
      
      const data = await globalRadarFetchPromise;
      globalRadarCache = { data, timestamp: now };
      
      if (isMountedRef.current) {
        setRadarData(data);
        setError(false);
      }
      
    } catch (err) {
      console.error("[useRadarData] Error obtenint dades de radar:", err);
      if (isMountedRef.current) setError(true);
    } finally {
      globalRadarFetchPromise = null;
      if (isMountedRef.current) setLoading(false);
    }
  }, []);

  return { loading, error, radarData, fetchRadarData };
}