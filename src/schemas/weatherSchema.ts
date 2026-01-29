// src/schemas/weatherSchema.ts
import { z } from 'zod';

// --- DEFINICIONS BASE (ARA EXPORTABLES) ---

// Validador per a dades horàries (arrays)
export const HourlyDataSchema = z.object({
  time: z.array(z.string()),
  temperature_2m: z.array(z.number().nullable()),
  relative_humidity_2m: z.array(z.number().nullable()),
  apparent_temperature: z.array(z.number().nullable()),
  precipitation_probability: z.array(z.number().nullable()).optional(),
  precipitation: z.array(z.number().nullable()),
  weather_code: z.array(z.number().nullable()),
  pressure_msl: z.array(z.number().nullable()).optional(),
  surface_pressure: z.array(z.number().nullable()).optional(),
  cloud_cover: z.array(z.number().nullable()).optional(),
  visibility: z.array(z.number().nullable()).optional(),
  wind_speed_10m: z.array(z.number().nullable()),
  wind_direction_10m: z.array(z.number().nullable()),
  wind_gusts_10m: z.array(z.number().nullable()).optional(),
  uv_index: z.array(z.number().nullable()).optional(),
  is_day: z.array(z.number().nullable()).optional(),
  cape: z.array(z.number().nullable()).optional(),
  freezing_level_height: z.array(z.number().nullable()).optional(),
  dew_point_2m: z.array(z.number().nullable()).optional(),
  // Permetre camps extra sense fallar (future-proof)
}).passthrough();

// Validador per a dades diàries
export const DailyDataSchema = z.object({
  time: z.array(z.string()),
  weather_code: z.array(z.number().nullable()),
  temperature_2m_max: z.array(z.number().nullable()),
  temperature_2m_min: z.array(z.number().nullable()),
  sunrise: z.array(z.string()),
  sunset: z.array(z.string()),
  uv_index_max: z.array(z.number().nullable()).optional(),
  precipitation_sum: z.array(z.number().nullable()).optional(),
  precipitation_probability_max: z.array(z.number().nullable()).optional(),
  wind_speed_10m_max: z.array(z.number().nullable()).optional(),
  // Permetre camps extra
}).passthrough();

// Validador per a dades actuals
export const CurrentDataSchema = z.object({
  time: z.string().optional(),
  temperature_2m: z.number().nullable(),
  relative_humidity_2m: z.number().nullable(),
  apparent_temperature: z.number().nullable().optional(),
  is_day: z.number().nullable().optional(),
  precipitation: z.number().nullable().optional(),
  weather_code: z.number().nullable(),
  cloud_cover: z.number().nullable().optional(),
  pressure_msl: z.number().nullable().optional(),
  wind_speed_10m: z.number().nullable(),
  wind_direction_10m: z.number().nullable(),
  wind_gusts_10m: z.number().nullable().optional(),
  visibility: z.number().nullable().optional(),
  // Permetre camps extra
}).passthrough();

// --- ESQUEMA PRINCIPAL DE RESPOSTA METEOROLÒGICA ---
export const WeatherResponseSchema = z.object({
  latitude: z.number(),
  longitude: z.number(),
  timezone: z.string().optional(),
  current: CurrentDataSchema.optional(), // Opcional per si AROME falla parcialment
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
    european_aqi: z.number().nullable().optional(),
    us_aqi: z.number().nullable().optional(),
    pm10: z.number().nullable().optional(),
    pm2_5: z.number().nullable().optional(),
    nitrogen_dioxide: z.number().nullable().optional(),
    ozone: z.number().nullable().optional(),
    sulphur_dioxide: z.number().nullable().optional(),
  }).passthrough().optional()
}).passthrough();