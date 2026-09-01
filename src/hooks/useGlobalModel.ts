// src/hooks/useGlobalModel.ts
import { useState, useCallback, useRef } from 'react';
import { z } from 'zod';

// 1. ESQUEMES DE VALIDACIÓ ZOD (MUR DE CONTENCIÓ)
const globalModelHourlySchema = z.object({
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

const globalModelResponseSchema = z.object({
  latitude: z.number(),
  longitude: z.number(),
  hourly: globalModelHourlySchema,
}).passthrough();

// Extreure el tipus inferit per a TypeScript.
// Gràcies al .transform(), TypeScript sap que `time` acabarà sent un string[] per la UI.
export type GlobalModelData = z.infer<typeof globalModelResponseSchema>;

// [NOTA HISTÒRICA] Aquest hook es deia useWRF.ts / WRFData. Renombrat perquè la font real és
// el "best_match" d'Open-Meteo (el mateix seleccionador automàtic de model que ja fem servir
// a weatherApi.ts), NO cap model WRF — el nom anterior era enganyós. La UI ja mostra aquesta
// dada com "GLO"/"GLOBAL", d'aquí el nou nom.
// 2. HOOK INDEPENDENT FAIL-SAFE
export function useGlobalModel() {
  const [globalData, setGlobalData] = useState<GlobalModelData | null>(null);
  const [loadingGlobalModel, setLoadingGlobalModel] = useState<boolean>(false);

  // [FIX PRECISIÓ] Mateix "últim guanyador" que useWeather.ts: sense això, canviar
  // ràpid entre dues ubicacions AROME podia deixar el widget de consens comparant
  // amb el model global d'una ciutat diferent de la que es mostra al tauler.
  const requestIdRef = useRef(0);

  const fetchGlobalModelByCoords = useCallback(async (lat: number, lon: number) => {
    const requestId = ++requestIdRef.current;
    const isStale = () => requestIdRef.current !== requestId;

    setLoadingGlobalModel(true);

    try {
      // SOLUCIÓ TÀCTICA: Hem afegit 'wind_gusts_10m' a la query de l'API
      const GLOBAL_MODEL_URL = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&hourly=temperature_2m,precipitation,wind_speed_10m,wind_gusts_10m&models=best_match&timeformat=unixtime`;
      
      const response = await fetch(GLOBAL_MODEL_URL);

      if (!response.ok) {
        // Fallada de xarxa o HTTP
        if (!isStale()) setGlobalData(null);
        return;
      }

      const rawJson = await response.json();

      // VALIDACIÓ SEGURA: Risc Zero
      const parsed = globalModelResponseSchema.safeParse(rawJson);

      // Una petició més nova ja ha començat: descartem aquest resultat obsolet
      // en lloc de mostrar la comparativa de model global d'una altra ubicació.
      if (isStale()) return;

      if (parsed.success) {
        setGlobalData(parsed.data);
      } else {
        // Dades corruptes o format inesperat.
        console.warn("Global model fetch ignored due to schema validation failure:", parsed.error);
        setGlobalData(null);
      }

    } catch  {
      // Qualsevol altre error inesperat es captura i se silencia
      if (!isStale()) setGlobalData(null);
    } finally {
      if (!isStale()) setLoadingGlobalModel(false);
    }
  }, []);

  const clearGlobalModel = useCallback(() => {
    setGlobalData(null);
  }, []);

  return {
    globalData,
    loadingGlobalModel,
    fetchGlobalModelByCoords,
    clearGlobalModel
  };
}