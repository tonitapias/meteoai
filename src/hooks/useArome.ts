// src/hooks/useArome.ts
import { useState, useCallback } from 'react';
import { getAromeData } from '../services/weatherApi';
import { normalizeModelData } from '../utils/weatherLogic';

interface AromeData {
  hourly: any;
  hourly_units: any;
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
      // Normalitzem per netejar claus com temperature_2m_meteofrance...
      const normalized = normalizeModelData(rawData);
      
      setAromeData({
        hourly: normalized.hourly,
        hourly_units: normalized.hourly_units,
        elevation: normalized.elevation
      });

    } catch (err: any) {
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