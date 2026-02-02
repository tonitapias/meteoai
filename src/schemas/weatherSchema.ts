// src/schemas/weatherSchema.ts
import { z } from 'zod';

// --- HELPERS DE ROBUSTESA ---
const safeNumber = z.coerce.number().nullable().catch(null);
const safeArray = z.array(safeNumber).catch([]);
const safeStringArray = z.array(z.string()).catch([]);

// --- DEFINICIONS BASE ---

// Validador per a dades horàries
export const HourlyDataSchema = z.object({
  time: safeStringArray,
  temperature_2m: safeArray,
  relative_humidity_2m: safeArray,
  apparent_temperature: safeArray,
  precipitation_probability: safeArray.optional(),
  precipitation: safeArray,
  weather_code: safeArray,
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
  
  // Camps opcionals addicionals per seguretat
  rain: safeArray.optional(),
  showers: safeArray.optional(),
  snowfall: safeArray.optional(),
  cloud_cover_low: safeArray.optional(),
  cloud_cover_mid: safeArray.optional(),
  cloud_cover_high: safeArray.optional(),
}).passthrough();

// Validador per a dades diàries
export const DailyDataSchema = z.object({
  time: safeStringArray,
  weather_code: safeArray,
  temperature_2m_max: safeArray,
  temperature_2m_min: safeArray,
  sunrise: safeStringArray,
  sunset: safeStringArray,
  uv_index_max: safeArray.optional(),
  precipitation_sum: safeArray.optional(),
  precipitation_probability_max: safeArray.optional(),
  wind_speed_10m_max: safeArray.optional(),
  wind_gusts_10m_max: safeArray.optional(),
  wind_direction_10m_dominant: safeArray.optional(),
  apparent_temperature_max: safeArray.optional(),
  apparent_temperature_min: safeArray.optional(),
  
  // Addicionals
  rain_sum: safeArray.optional(),
  showers_sum: safeArray.optional(),
  snowfall_sum: safeArray.optional(),
  precipitation_hours: safeArray.optional(),
}).passthrough();

// Validador per a dades actuals
export const CurrentDataSchema = z.object({
  time: z.string().optional(),
  interval: safeNumber.optional(),
  temperature_2m: safeNumber,
  relative_humidity_2m: safeNumber,
  apparent_temperature: safeNumber.optional(),
  is_day: safeNumber.optional(),
  precipitation: safeNumber.optional(),
  weather_code: safeNumber,
  cloud_cover: safeNumber.optional(),
  pressure_msl: safeNumber.optional(),
  surface_pressure: safeNumber.optional(),
  wind_speed_10m: safeNumber,
  wind_direction_10m: safeNumber,
  wind_gusts_10m: safeNumber.optional(),
  visibility: safeNumber.optional(),
  
  // Addicionals
  cloud_cover_low: safeNumber.optional(),
  cloud_cover_mid: safeNumber.optional(),
  cloud_cover_high: safeNumber.optional(),
}).passthrough();

// Validador Minut a Minut (AROME) - AFEGIT
export const Minutely15Schema = z.object({
    time: safeStringArray,
    precipitation: safeArray
}).optional();

// --- ESQUEMA PRINCIPAL DE RESPOSTA METEOROLÒGICA ---
export const WeatherResponseSchema = z.object({
  latitude: z.number(),
  longitude: z.number(),
  timezone: z.string().optional(),
  timezone_abbreviation: z.string().optional(), // Afegit
  generationtime_ms: z.number().optional(),     // Afegit
  utc_offset_seconds: z.number().optional(),    // Afegit
  elevation: z.number().optional(),             // Afegit

  current: CurrentDataSchema.optional(),
  hourly: HourlyDataSchema.optional(),
  daily: DailyDataSchema.optional(),
  minutely_15: Minutely15Schema,                // Afegit
  
  current_units: z.record(z.string()).optional(),
  hourly_units: z.record(z.string()).optional(),
  daily_units: z.record(z.string()).optional(),
}).passthrough();

// --- ESQUEMA QUALITAT DE L'AIRE ---
export const AirQualitySchema = z.object({
  latitude: z.number(),
  longitude: z.number(),
  current: z.object({
    time: z.string().optional(),
    european_aqi: safeNumber.optional(),
    us_aqi: safeNumber.optional(),
    pm10: safeNumber.optional(),
    pm2_5: safeNumber.optional(),
    nitrogen_dioxide: safeNumber.optional(),
    ozone: safeNumber.optional(),
    sulphur_dioxide: safeNumber.optional(),
  }).passthrough().optional() // Fem el bloc sencer opcional per si falla
}).passthrough();

// EXPORTEM ELS TIPUS INFERITS (La màgia de Zod)
export type WeatherCurrent = z.infer<typeof CurrentDataSchema>;
export type WeatherHourly = z.infer<typeof HourlyDataSchema>;
export type WeatherDaily = z.infer<typeof DailyDataSchema>;
export type AirQualityData = z.infer<typeof AirQualitySchema>;
export type WeatherApiResponse = z.infer<typeof WeatherResponseSchema>;