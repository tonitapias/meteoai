// src/hooks/useArome.ts
import { useState, useCallback } from 'react';
import { getAromeData } from '../services/weatherApi';

interface AromeData {
  hourly: Record<string, any>;
  minutely_15: Record<string, any>; // NOVA CAPTURA: Física de 15 minuts
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
      // Aquesta funció elimina qualsevol sufix de proveïdor (arome, ecmwf, best_match...)
      // per garantir que sempre treballem amb claus netes com 'temperature_2m' o 'precipitation'.
      const cleanData = (obj: any) => {
        if (!obj) return {};
        const cleanObj: any = {};
        Object.keys(obj).forEach(key => {
          const cleanKey = key.replace(/_meteofrance_arome_france_hd|_best_match|_ecmwf|_gfs|_icon/g, '');
          cleanObj[cleanKey] = obj[key];
        });
        return cleanObj;
      };

      setAromeData({
        hourly: cleanData(rawData.hourly),
        minutely_15: cleanData(rawData.minutely_15), // Ara capturem la física d'alta freqüència
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