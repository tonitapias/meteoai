// src/hooks/useRegionalModel.ts
import { useState, useCallback } from 'react';
import { z } from 'zod';
import { getRegionalHDData } from '../services/weatherApi';
import { buildModelSuffixRegex, type RegionalModel } from '../constants/regionalModels';

const MODEL_SUFFIX_REGEX = buildModelSuffixRegex();

// ==========================================
// ESQUEMES DE VALIDACIÓ ZOD (MUR DE CONTENCIÓ)
// ==========================================
// Aquest esquema és intencionadament més estricte que HourlyDataSchema
// (weatherSchema.ts): allà CADA camp té `.catch(...)` perquè el forecast
// principal (4 models) no pot fallar mai del tot encara que un camp vingui
// malament. Aquí, en canvi, un `time` absent o trencat ha de tombar TOT
// el parse — és preferible mostrar "Senyal Perduda" que un modal amb
// arrays de mides incoherents. Per això mantenim un esquema propi.

// Validem les matrius amb suport total per valors nuls i buits (Doctrina Risc Zero)
const regionalModelHourlySchema = z.object({
  // Acceptem tant timestamps (números) com strings ISO, i ho unifiquem tot a ISO.
  time: z.array(z.union([z.number(), z.string()])).transform((times) =>
    times.map((t) => typeof t === 'number' ? new Date(t * 1000).toISOString() : t)
  ),
  temperature_2m: z.array(z.number().nullable()).optional(),
  apparent_temperature: z.array(z.number().nullable()).optional(),
  precipitation: z.array(z.number().nullable()).optional(),
  visibility: z.array(z.number().nullable()).optional(),
  wind_speed_10m: z.array(z.number().nullable()).optional(),
  wind_gusts_10m: z.array(z.number().nullable()).optional(),
  wind_direction_10m: z.array(z.number().nullable()).optional(),
  relative_humidity_2m: z.array(z.number().nullable()).optional(),
  weather_code: z.array(z.number().nullable()).optional(),
  cloud_cover_low: z.array(z.number().nullable()).optional(),
  cloud_cover_mid: z.array(z.number().nullable()).optional(),
  cloud_cover_high: z.array(z.number().nullable()).optional(),
  cape: z.array(z.number().nullable()).optional(),
  freezing_level_height: z.array(z.number().nullable()).optional(),
  is_day: z.array(z.number().nullable()).optional(),
}).passthrough();

const minutely15Schema = z.object({
  time: z.array(z.union([z.number(), z.string()])).transform((times) =>
    times.map((t) => typeof t === 'number' ? new Date(t * 1000).toISOString() : t)
  ),
  precipitation: z.array(z.number().nullable()).optional(),
}).passthrough().optional();

// L'esquema principal netejat
const regionalModelDataSchema = z.object({
  hourly: regionalModelHourlySchema,
  minutely_15: minutely15Schema,
  hourly_units: z.record(z.string()).optional(),
  elevation: z.number().optional().default(0),
  // [FIX PRECISIÓ] Calia per saber quines hores són "avui"/"demà" a la ubicació
  // consultada (que no és necessàriament l'hora de qui mira la pantalla).
  utc_offset_seconds: z.number().optional(),
}).passthrough();

// Inferència de tipatge estrictament segur
export type RegionalModelData = z.infer<typeof regionalModelDataSchema>;

// ==========================================
// HOOK INDEPENDENT FAIL-SAFE
// ==========================================
export function useRegionalModel() {
  const [regionalData, setRegionalData] = useState<RegionalModelData | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const fetchRegionalModel = useCallback(async (lat: number, lon: number, model: RegionalModel) => {
    setLoading(true);
    setError(null);

    try {
      const rawData = await getRegionalHDData(lat, lon, model);

      // SANITITZACIÓ ESTRICTA: Eliminem sufixos de model que Open-Meteo afegeix
      const cleanData = (obj: unknown): Record<string, unknown> => {
        if (!obj || typeof obj !== 'object') return {};
        const cleanObj: Record<string, unknown> = {};

        Object.entries(obj as Record<string, unknown>).forEach(([key, value]) => {
          const cleanKey = key.replace(MODEL_SUFFIX_REGEX, '');
          cleanObj[cleanKey] = value;
        });

        return cleanObj;
      };

      // Pre-processament abans de la validació
      const preProcessedData = {
        hourly: cleanData(rawData.hourly),
        minutely_15: cleanData(rawData.minutely_15),
        hourly_units: cleanData(rawData.hourly_units),
        elevation: typeof rawData.elevation === 'number' ? rawData.elevation : 0,
        utc_offset_seconds: typeof rawData.utc_offset_seconds === 'number' ? rawData.utc_offset_seconds : undefined
      };

      // VALIDACIÓ SEGURA: Passem l'objecte pel sedàs de Zod
      const parsed = regionalModelDataSchema.safeParse(preProcessedData);

      if (parsed.success) {
        setRegionalData(parsed.data);
      } else {
        // Mode Paracaigudes: Si el model regional ve corrupte, forcem null perquè la
        // resta de l'app faci servir el model base/global (best_match) com a reserva
        console.warn(`${model.label} validation failed (Out of Bounds or Bad Data):`, parsed.error);
        setError(`Fallada de telemetria ${model.label}: Dades fora de paràmetres.`);
        setRegionalData(null);
      }

    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`Error fetching ${model.label}:`, msg);
      setError(msg || `Error connectant amb el clúster ${model.label}`);
      setRegionalData(null);
    } finally {
      setLoading(false);
    }
  }, []);

  const clearRegionalModel = useCallback(() => {
    setRegionalData(null);
    setError(null);
  }, []);

  return { regionalData, loading, error, fetchRegionalModel, clearRegionalModel };
}
