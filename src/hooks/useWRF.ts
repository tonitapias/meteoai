// src/hooks/useWRF.ts
import { useState, useCallback } from 'react';
import { z } from 'zod';

// 1. ESQUEMES DE VALIDACIÓ ZOD (MUR DE CONTENCIÓ)
const wrfHourlySchema = z.object({
  // EXTREMA SEGURETAT: Demanem 'unixtime' (números). 
  // Zod els converteix a mil·lisegons (* 1000) i en fa un string ISO absolut acabat en 'Z' (UTC).
  // D'aquesta manera matem qualsevol desajust de fús horari sense trencar la resta de l'App.
  time: z.array(z.number()).transform((times) => 
    times.map((t) => new Date(t * 1000).toISOString())
  ),
  temperature_2m: z.array(z.number().nullable()),
  precipitation: z.array(z.number().nullable()),
  wind_speed_10m: z.array(z.number().nullable()).optional(),
  // Afegim la matriu de ratxes de vent (Gusts) com a array de números o nuls per suportar forats de dades
  wind_gusts_10m: z.array(z.number().nullable()).optional(),
}).passthrough();

const wrfResponseSchema = z.object({
  latitude: z.number(),
  longitude: z.number(),
  hourly: wrfHourlySchema,
}).passthrough();

// Extreure el tipus inferit per a TypeScript.
// Gràcies al .transform(), TypeScript sap que `time` acabarà sent un string[] per la UI.
export type WRFData = z.infer<typeof wrfResponseSchema>;

// 2. HOOK INDEPENDENT FAIL-SAFE
export function useWRF() {
  const [wrfData, setWrfData] = useState<WRFData | null>(null);
  const [loadingWRF, setLoadingWRF] = useState<boolean>(false);

  const fetchWRFByCoords = useCallback(async (lat: number, lon: number) => {
    setLoadingWRF(true);
    
    try {
      // SOLUCIÓ TÀCTICA: Hem afegit 'wind_gusts_10m' a la query de l'API
      const WRF_URL = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&hourly=temperature_2m,precipitation,wind_speed_10m,wind_gusts_10m&models=best_match&timeformat=unixtime`;
      
      const response = await fetch(WRF_URL);
      
      if (!response.ok) {
        // Fallada de xarxa o HTTP
        setWrfData(null);
        return; 
      }

      const rawJson = await response.json();

      // VALIDACIÓ SEGURA: Risc Zero
      const parsed = wrfResponseSchema.safeParse(rawJson);

      if (parsed.success) {
        setWrfData(parsed.data);
      } else {
        // Dades corruptes o format inesperat.
        console.warn("WRF fetch ignored due to schema validation failure:", parsed.error);
        setWrfData(null);
      }

    } catch  {
      // Qualsevol altre error inesperat es captura i se silencia
      setWrfData(null);
    } finally {
      setLoadingWRF(false);
    }
  }, []);

  const clearWRFData = useCallback(() => {
    setWrfData(null);
  }, []);

  return {
    wrfData,
    loadingWRF,
    fetchWRFByCoords,
    clearWRFData
  };
}