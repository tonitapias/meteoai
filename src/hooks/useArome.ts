// src/hooks/useArome.ts
import { useState, useCallback } from 'react';
import { getAromeData } from '../services/weatherApi';

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
      
      // --- PAS CRÍTIC: NETEJA DE CLAUS ---
      // L'API AROME retorna claus amb sufix (ex: "temperature_2m_meteofrance_arome_france_hd")
      // Les convertim a format estàndard (ex: "temperature_2m")
      const cleanHourly: any = {};
      const suffix = "_meteofrance_arome_france_hd";

      if (rawData.hourly) {
        Object.keys(rawData.hourly).forEach(key => {
          const cleanKey = key.replace(suffix, '');
          cleanHourly[cleanKey] = rawData.hourly[key];
        });
      }

      setAromeData({
        hourly: cleanHourly, // Ara el component rep claus netes
        hourly_units: rawData.hourly_units,
        elevation: rawData.elevation
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