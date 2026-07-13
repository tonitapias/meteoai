// src/hooks/useArome.ts
import { useState, useCallback } from 'react';
import { z } from 'zod';
import { getAromeData } from '../services/weatherApi';

// ==========================================
// 1. ESQUEMES DE VALIDACIÓ ZOD (MUR DE CONTENCIÓ)
// ==========================================

// Validem les matrius amb suport total per valors nuls i buits (Doctrina Risc Zero)
const aromeHourlySchema = z.object({
  // Acceptem tant timestamps (números) com strings ISO, i ho unifiquem tot a ISO.
  time: z.array(z.union([z.number(), z.string()])).transform((times) => 
    times.map((t) => typeof t === 'number' ? new Date(t * 1000).toISOString() : t)
  ),
  temperature_2m: z.array(z.number().nullable()).optional(),
  precipitation: z.array(z.number().nullable()).optional(),
  visibility: z.array(z.number().nullable()).optional(),
  wind_speed_10m: z.array(z.number().nullable()).optional(),
  wind_gusts_10m: z.array(z.number().nullable()).optional(),
  relative_humidity_2m: z.array(z.number().nullable()).optional(),
}).passthrough();

const aromeMinutely15Schema = z.object({
  time: z.array(z.union([z.number(), z.string()])).transform((times) => 
    times.map((t) => typeof t === 'number' ? new Date(t * 1000).toISOString() : t)
  ),
  precipitation: z.array(z.number().nullable()).optional(),
}).passthrough().optional();

// L'esquema principal netejat
const aromeDataSchema = z.object({
  hourly: aromeHourlySchema,
  minutely_15: aromeMinutely15Schema,
  hourly_units: z.record(z.string()).optional(),
  elevation: z.number().optional().default(0),
}).passthrough();

// Inferència de tipatge estrictament segur
export type AromeData = z.infer<typeof aromeDataSchema>;

// ==========================================
// 2. HOOK INDEPENDENT FAIL-SAFE
// ==========================================
export function useArome() {
  const [aromeData, setAromeData] = useState<AromeData | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const fetchArome = useCallback(async (lat: number, lon: number) => {
    setLoading(true);
    setError(null);
    
    try {
      const rawData = await getAromeData(lat, lon);
      
      // SANITITZACIÓ ESTRICTA: Eliminem sufixos de l'API de MeteoFrance
      const cleanData = (obj: unknown): Record<string, unknown> => {
        if (!obj || typeof obj !== 'object') return {};
        const cleanObj: Record<string, unknown> = {};
        
        Object.entries(obj as Record<string, unknown>).forEach(([key, value]) => {
          const cleanKey = key.replace(/_meteofrance_arome_france_hd|_best_match|_ecmwf|_gfs|_icon/g, '');
          cleanObj[cleanKey] = value;
        });
        
        return cleanObj;
      };

      // Pre-processament abans de la validació
      const preProcessedData = {
        hourly: cleanData(rawData.hourly),
        minutely_15: cleanData(rawData.minutely_15),
        hourly_units: cleanData(rawData.hourly_units),
        elevation: typeof rawData.elevation === 'number' ? rawData.elevation : 0
      };

      // VALIDACIÓ SEGURA: Passem l'objecte pel sedàs de Zod
      const parsed = aromeDataSchema.safeParse(preProcessedData);

      if (parsed.success) {
        setAromeData(parsed.data);
      } else {
        // Mode Paracaigudes: Si AROME ve corrupte, forcem null perquè el WRF agafi el relleu
        console.warn("AROME validation failed (Out of Bounds or Bad Data):", parsed.error);
        setError("Fallada de telemetria AROME HD: Dades fora de paràmetres.");
        setAromeData(null);
      }

    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error("Error fetching AROME:", msg);
      setError(msg || "Error connectant amb el clúster AROME HD");
      setAromeData(null);
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