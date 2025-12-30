// src/hooks/useArome.js
import { useState, useCallback } from 'react';

export function useArome() {
  const [aromeData, setAromeData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchArome = useCallback(async (lat, lon) => {
    setLoading(true);
    setError(null);
    
    try {
      const params = new URLSearchParams({
        latitude: lat,
        longitude: lon,
        // AFEGIT: 'is_day' per tenir icones nocturnes correctes
        hourly: 'temperature_2m,relative_humidity_2m,precipitation,weather_code,wind_speed_10m,wind_gusts_10m,cape,is_day',
        models: 'arome_france',
        timezone: 'auto',
        forecast_days: 2
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

    } catch (err) {
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