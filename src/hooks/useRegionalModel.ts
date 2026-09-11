// src/hooks/useRegionalModel.ts
import { useState, useCallback, useRef } from 'react';
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
  // No tots els 13 models retornen minutely_15 (és nowcasting d'AROME, no
  // pas de tots) — un `time` absent o corrupte aquí NOMÉS ha de buidar
  // aquest bloc secundari, mai tombar tot el modal (a diferència de
  // `regionalModelHourlySchema`, on `time` sí és crític).
  time: z.array(z.union([z.number(), z.string()])).transform((times) =>
    times.map((t) => typeof t === 'number' ? new Date(t * 1000).toISOString() : t)
  ).catch(() => []),
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

  // Ref d'"últim guanyador" (mateix patró que useWeather.ts/useGlobalModel.ts):
  // si l'usuari canvia d'ubicació o de model abans que respongui la petició
  // anterior, aquesta pot arribar més tard i sobreescriure en silenci el
  // panell amb dades d'un altre lloc/model. Cada crida es numera; només
  // s'aplica el resultat si encara és la petició més recent en arribar.
  const requestIdRef = useRef(0);

  const fetchRegionalModel = useCallback(async (lat: number, lon: number, model: RegionalModel) => {
    const requestId = ++requestIdRef.current;
    const isStale = () => requestIdRef.current !== requestId;

    setLoading(true);
    setError(null);

    try {
      const rawData = await getRegionalHDData(lat, lon, model);

      if (isStale()) return;

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
      // [FIX] `minutely_15` és opcional (no tots els models el retornen): si
      // rawData no el porta, cal deixar `undefined` perquè l'esquema
      // `.optional()` l'accepti. Abans `cleanData(undefined)` retornava `{}`,
      // que sí xoca contra el `time` de dins i tombava TOT el parse — el
      // modal sencer marcava "Senyal Perduda" encara que `hourly` fos vàlid.
      const preProcessedData = {
        hourly: cleanData(rawData.hourly),
        minutely_15: rawData.minutely_15 ? cleanData(rawData.minutely_15) : undefined,
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
      if (isStale()) return;

      const msg = err instanceof Error ? err.message : String(err);
      console.error(`Error fetching ${model.label}:`, msg);
      setError(msg || `Error connectant amb el clúster ${model.label}`);
      setRegionalData(null);
    } finally {
      if (!isStale()) setLoading(false);
    }
  }, []);

  const clearRegionalModel = useCallback(() => {
    setRegionalData(null);
    setError(null);
  }, []);

  return { regionalData, loading, error, fetchRegionalModel, clearRegionalModel };
}
