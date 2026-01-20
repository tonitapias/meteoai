// src/hooks/useArome.ts
import { useState, useCallback } from 'react';
import { getAromeData } from '../services/weatherApi';

interface AromeData {
  hourly: Record<string, unknown>;
  minutely_15: Record<string, unknown>;
  hourly_units: Record<string, string>;
  elevation: number;
}

export function useArome() {
  const [aromeData, setAromeData] = useState<AromeData | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const fetchArome = useCallback(async (lat: number, lon: number) => {
    setLoading(true);
    setError(null);
    
    try {
      const rawData = await getAromeData(lat, lon);
      
      const cleanData = (obj: Record<string, unknown> | undefined) => {
        if (!obj) return {};
        const cleanObj: Record<string, unknown> = {};
        Object.keys(obj).forEach(key => {
          const cleanKey = key.replace(/_meteofrance_arome_france_hd|_best_match|_ecmwf|_gfs|_icon/g, '');
          cleanObj[cleanKey] = obj[key];
        });
        return cleanObj;
      };

      setAromeData({
        hourly: cleanData(rawData.hourly as Record<string, unknown>),
        minutely_15: cleanData(rawData.minutely_15 as Record<string, unknown>),
        hourly_units: cleanData(rawData.hourly_units as Record<string, unknown>) as Record<string, string>,
        elevation: rawData.elevation || 0
      });

    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error("Error fetching AROME:", msg);
      setError(msg || "Error carregant dades AROME HD");
    } finally {
      setLoading(false);
    }
  }, []);

  const clearArome = useCallback(() => {
    setAromeData(null);
    setError(null);
  }, []);

  return { aromeData, loading, error, fetchArome, clearArome };
}