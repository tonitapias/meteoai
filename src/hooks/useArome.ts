// src/hooks/useArome.ts
import { useState, useCallback } from 'react';

// Definim una interfície simple pel retorn de l'API AROME
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
      const params = new URLSearchParams({
        latitude: lat.toString(),
        longitude: lon.toString(),
        hourly: 'temperature_2m,relative_humidity_2m,precipitation,weather_code,wind_speed_10m,wind_gusts_10m,cape,is_day',
        models: 'arome_france',
        timezone: 'auto',
        forecast_days: '2'
      });

      const url = `https://api.open-meteo.com/v1/forecast?${params.toString()}`;
      
      const res = await fetch(url);
      
      if (!res.ok) {
        if (res.status === 400) {
           throw new Error("Ubicació fora del rang del model AROME (Només Europa Occidental/Pirineus).");
        }
        throw new Error(`Error connectant amb MeteoFrance: ${res.status}`);
      }
      
      const rawData = await res.json();
      
      setAromeData({
        hourly: rawData.hourly,
        hourly_units: rawData.hourly_units,
        elevation: rawData.elevation
      });

    } catch (err: any) {
      console.error(err);
      setError(err.message || "Error desconegut carregant AROME");
    } finally {
      setLoading(false);
    }
  }, []);

  const clearArome = useCallback(() => {
    setAromeData(null);
    setError(null);
  }, []);

  return { 
    aromeData, 
    loading, 
    error, 
    fetchArome,
    clearArome 
  };
}