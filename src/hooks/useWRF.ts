// src/hooks/useWRF.ts
import { useState, useCallback } from 'react';
import { z } from 'zod';

// 1. ESQUEMES DE VALIDACIÓ ZOD (MUR DE CONTENCIÓ)
// Definim només allò que necessitem de manera laxa (passthrough) perquè l'API pugui afegir camps sense trencar-nos l'esquema.
const wrfHourlySchema = z.object({
  time: z.array(z.string()),
  temperature_2m: z.array(z.number().nullable()),
  precipitation: z.array(z.number().nullable()),
  // Pots afegir més camps aquí si els necessites pel consens (ex: wind_speed_10m)
}).passthrough();

const wrfResponseSchema = z.object({
  latitude: z.number(),
  longitude: z.number(),
  hourly: wrfHourlySchema,
}).passthrough();

// Extreure el tipus inferit per a TypeScript
export type WRFData = z.infer<typeof wrfResponseSchema>;

// 2. HOOK INDEPENDENT FAIL-SAFE
export function useWRF() {
  const [wrfData, setWrfData] = useState<WRFData | null>(null);
  const [loadingWRF, setLoadingWRF] = useState<boolean>(false);

  const fetchWRFByCoords = useCallback(async (lat: number, lon: number) => {
    setLoadingWRF(true);
    
    try {
      // Ajusta la URL i els paràmetres segons l'endpoint exacte del WRF que facis servir a Open-Meteo
      // Nota: Si WRF no està al root default, potser necessites el domini regional d'Open-Meteo.
      // Exemple de com hauria de ser la teva URL dins de useWRF.ts
const WRF_URL = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&hourly=temperature_2m,precipitation,wind_speed_10m&models=best_match&timezone=auto`;

const response = await fetch(WRF_URL);
      
      if (!response.ok) {
        // Fallada de xarxa o HTTP
        setWrfData(null);
        return; 
      }

      const rawJson = await response.json();

      // VALIDACIÓ SEGURA: Risc Zero
      // safeParse comprova l'esquema sense llençar errors letals (throw)
      const parsed = wrfResponseSchema.safeParse(rawJson);

      if (parsed.success) {
        setWrfData(parsed.data);
      } else {
        // Dades corruptes o format inesperat. Ho ignorem silenciosament.
        // Opcionalment podries afegir un Sentry.captureMessage aquí sense alertar l'usuari.
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

  // Exposem un mètode per netejar l'estat si fos necessari
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