// src/hooks/useArome.ts
import { useState, useCallback } from 'react';
import { getAromeData } from '../services/weatherApi';

interface AromeData {
  hourly: Record<string, any>;
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
      
      // --- NORMALITZADOR DE MODEL (ROBUST) ---
      // L'API retorna claus com "cloud_cover_meteofrance_arome_france_hd".
      // Aquesta funció detecta i elimina qualsevol sufix de proveïdor per estandarditzar-ho.
      const cleanData = (obj: any) => {
        if (!obj) return {};
        const cleanObj: any = {};
        Object.keys(obj).forEach(key => {
          // Tallem la clau just abans del sufix del proveïdor
          const cleanKey = key.includes('_meteofrance') 
            ? key.split('_meteofrance')[0] 
            : key;
          cleanObj[cleanKey] = obj[key];
        });
        return cleanObj;
      };

      setAromeData({
        hourly: cleanData(rawData.hourly),
        hourly_units: cleanData(rawData.hourly_units),
        elevation: rawData.elevation || 0
      });

    } catch (err: any) {
      console.error("Error fetching AROME:", err);
      setError(err.message || "Error carregant dades AROME HD");
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