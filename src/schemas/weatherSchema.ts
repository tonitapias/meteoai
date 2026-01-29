// src/schemas/weatherSchema.ts
import { z } from 'zod';

// --- HELPERS DE ROBUSTESA (NOU) ---
// Aquests helpers asseguren que l'app mai es trenqui per un error de tipus a l'API.

// 1. safeNumber: Intenta convertir a número. Si falla o és invàlid, retorna null en lloc de llançar error.
const safeNumber = z.coerce.number().nullable().catch(null);

// 2. safeArray: Assegura que sempre rebem un array. Si l'API envia null o error, retorna array buit [].
const safeArray = z.array(safeNumber).catch([]);

// 3. safeStringArray: Per a arrays de text (com les hores)
const safeStringArray = z.array(z.string()).catch([]);

// --- DEFINICIONS BASE ---

// Validador per a dades horàries (arrays)
export const HourlyDataSchema = z.object({
  time: safeStringArray, // Si falla el temps, array buit (seguretat màxima)
  
  // Variables Principals (Robustes)
  temperature_2m: safeArray,
  relative_humidity_2m: safeArray,
  apparent_temperature: safeArray,
  precipitation_probability: safeArray.optional(),
  precipitation: safeArray,
  weather_code: safeArray,
  
  // Variables Secundàries
  pressure_msl: safeArray.optional(),
  surface_pressure: safeArray.optional(),
  cloud_cover: safeArray.optional(),
  visibility: safeArray.optional(),
  wind_speed_10m: safeArray,
  wind_direction_10m: safeArray,
  wind_gusts_10m: safeArray.optional(),
  uv_index: safeArray.optional(),
  is_day: safeArray.optional(),
  cape: safeArray.optional(),
  freezing_level_height: safeArray.optional(),
  dew_point_2m: safeArray.optional(),
  
  // Permetre camps extra sense fallar (future-proof)
}).passthrough();

// Validador per a dades diàries
export const DailyDataSchema = z.object({
  time: safeStringArray,
  weather_code: safeArray,
  temperature_2m_max: safeArray,
  temperature_2m_min: safeArray,
  sunrise: safeStringArray, // Hores de sortida són strings
  sunset: safeStringArray,
  
  uv_index_max: safeArray.optional(),
  precipitation_sum: safeArray.optional(),
  precipitation_probability_max: safeArray.optional(),
  wind_speed_10m_max: safeArray.optional(),
}).passthrough();

// Validador per a dades actuals
export const CurrentDataSchema = z.object({
  time: z.string().optional(),
  
  // Primitives robustes (safeNumber gestiona nulls i conversions)
  temperature_2m: safeNumber,
  relative_humidity_2m: safeNumber,
  apparent_temperature: safeNumber.optional(),
  is_day: safeNumber.optional(),
  precipitation: safeNumber.optional(),
  weather_code: safeNumber,
  cloud_cover: safeNumber.optional(),
  pressure_msl: safeNumber.optional(),
  wind_speed_10m: safeNumber,
  wind_direction_10m: safeNumber,
  wind_gusts_10m: safeNumber.optional(),
  visibility: safeNumber.optional(),
}).passthrough();

// --- ESQUEMA PRINCIPAL DE RESPOSTA METEOROLÒGICA ---
export const WeatherResponseSchema = z.object({
  latitude: z.number(),
  longitude: z.number(),
  timezone: z.string().optional(),
  
  // Les seccions senceres també són opcionals per si falla un bloc complet
  current: CurrentDataSchema.optional(),
  hourly: HourlyDataSchema.optional(),
  daily: DailyDataSchema.optional(),
  
  current_units: z.record(z.string()).optional(),
  hourly_units: z.record(z.string()).optional(),
  daily_units: z.record(z.string()).optional(),
}).passthrough();

// --- ESQUEMA QUALITAT DE L'AIRE ---
export const AirQualitySchema = z.object({
  latitude: z.number(),
  longitude: z.number(),
  current: z.object({
    european_aqi: safeNumber.optional(),
    us_aqi: safeNumber.optional(),
    pm10: safeNumber.optional(),
    pm2_5: safeNumber.optional(),
    nitrogen_dioxide: safeNumber.optional(),
    ozone: safeNumber.optional(),
    sulphur_dioxide: safeNumber.optional(),
  }).passthrough().optional()
}).passthrough();