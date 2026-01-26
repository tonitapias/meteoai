// src/services/weatherApi.ts
import * as Sentry from "@sentry/react";
import { ZodType } from "zod"; 
import { WeatherResponseSchema, AirQualitySchema } from "../schemas/weatherSchema";
import { WeatherData } from "../types/weather";

// CONFIGURACIÓ
const BASE_URL = import.meta.env.VITE_API_WEATHER_BASE || "https://api.open-meteo.com/v1/forecast";
const AIR_QUALITY_URL = import.meta.env.VITE_API_AQI_BASE || "https://air-quality-api.open-meteo.com/v1/air-quality";
const TIMEOUT_MS = Number(import.meta.env.VITE_API_TIMEOUT) || 10000;
const MAX_RETRIES = 2;

// --- Utilitat interna: Timeout ---
const fetchWithTimeout = async (url: string): Promise<Response> => {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), TIMEOUT_MS);
    try {
        const response = await fetch(url, { signal: controller.signal });
        clearTimeout(id);
        return response;
    } catch (error) {
        clearTimeout(id);
        throw error;
    }
};

// --- Utilitat interna: Retry Logic ---
const fetchWithRetry = async (url: string, retries = MAX_RETRIES): Promise<Response> => {
    for (let i = 0; i <= retries; i++) {
        try {
            const response = await fetchWithTimeout(url);
            if (!response.ok && response.status >= 500) throw new Error(`Server Error: ${response.status}`);
            if (!response.ok) throw new Error(`API Error: ${response.status} ${response.statusText}`);
            return response;
        } catch (err) {
            if (i === retries) throw err;
            console.warn(`⚠️ Intent ${i + 1} fallit. Reintentant...`, err);
            Sentry.addBreadcrumb({
                category: "network-retry",
                message: `Retry ${i + 1}/${retries} for ${url}`,
                level: "warning",
                data: { error: String(err) }
            });
            await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1)));
        }
    }
    throw new Error("Unexpected retry loop exit");
};

// --- ✨ LA MÀGIA: Normalitzador de Models (Tipatge Segur) ---
const normalizeModelKeys = (data: unknown): unknown => {
    if (!data || typeof data !== 'object') return data;
    
    const processObject = (obj: unknown): unknown => {
        if (!obj || typeof obj !== 'object') return obj;

        const typedObj = obj as Record<string, unknown>;
        const newObj = { ...typedObj };
        
        Object.keys(newObj).forEach(key => {
            if (key.endsWith('_best_match')) {
                const baseKey = key.replace('_best_match', '');
                if (newObj[baseKey] === undefined) {
                    newObj[baseKey] = newObj[key];
                }
            }
        });
        return newObj;
    };

    const weatherData = data as Record<string, unknown>;
    const normalized = { ...weatherData };

    if (normalized.current) normalized.current = processObject(normalized.current);
    if (normalized.hourly) normalized.hourly = processObject(normalized.hourly);
    if (normalized.daily) normalized.daily = processObject(normalized.daily);

    return normalized;
};

// --- Validació Zod ---
const validateData = (schema: ZodType, data: unknown, context: string) => {
    const cleanData = normalizeModelKeys(data);
    const result = schema.safeParse(cleanData);
    
    if (!result.success) {
        console.error(`❌ Zod Validation Error (${context}):`, result.error);
        Sentry.captureException(new Error(`Schema Validation Failed in ${context}`), {
            extra: { zodError: result.error.format() }
        });
        return cleanData; 
    }
    return result.data;
};

// 1. Funció Principal
export const getWeatherData = async (lat: number, lon: number, unit: 'C' | 'F'): Promise<WeatherData> => {
    const tempUnit = unit === 'F' ? 'fahrenheit' : 'celsius';
    
    const params = new URLSearchParams({
        latitude: lat.toString(),
        longitude: lon.toString(),
        current: "temperature_2m,relative_humidity_2m,apparent_temperature,is_day,precipitation,rain,showers,snowfall,weather_code,cloud_cover,pressure_msl,surface_pressure,wind_speed_10m,wind_direction_10m,wind_gusts_10m,cloud_cover_low,cloud_cover_mid,cloud_cover_high,visibility",
        hourly: "temperature_2m,relative_humidity_2m,dew_point_2m,apparent_temperature,precipitation_probability,precipitation,rain,showers,snowfall,snow_depth,weather_code,pressure_msl,surface_pressure,cloud_cover,cloud_cover_low,cloud_cover_mid,cloud_cover_high,visibility,evapotranspiration,wind_speed_10m,wind_direction_10m,wind_gusts_10m,uv_index,uv_index_clear_sky,is_day,cape,freezing_level_height",
        daily: "weather_code,temperature_2m_max,temperature_2m_min,apparent_temperature_max,apparent_temperature_min,sunrise,sunset,daylight_duration,sunshine_duration,uv_index_max,uv_index_clear_sky_max,precipitation_sum,rain_sum,showers_sum,snowfall_sum,precipitation_hours,precipitation_probability_max,wind_speed_10m_max,wind_gusts_10m_max,wind_direction_10m_dominant,shortwave_radiation_sum,et0_fao_evapotranspiration",
        models: "best_match,ecmwf_ifs04,gfs_seamless,icon_seamless",
        timezone: "auto",
        temperature_unit: tempUnit,
        wind_speed_unit: "kmh",
        precipitation_unit: "mm",
        forecast_days: "8" 
    });

    const response = await fetchWithRetry(`${BASE_URL}?${params.toString()}`);
    const rawData = await response.json();
    
    return validateData(WeatherResponseSchema, rawData, 'getWeatherData') as WeatherData;
};

// 2. Funció Qualitat Aire
export const getAirQualityData = async (lat: number, lon: number): Promise<Record<string, unknown>> => {
    const params = new URLSearchParams({
        latitude: lat.toString(),
        longitude: lon.toString(),
        current: "european_aqi,us_aqi,pm10,pm2_5,nitrogen_dioxide,ozone,sulphur_dioxide,dust,uv_index,ammonia,alder_pollen,birch_pollen,grass_pollen,mugwort_pollen,olive_pollen,ragweed_pollen",
        hourly: "european_aqi,pm10,pm2_5,nitrogen_dioxide,ozone,sulphur_dioxide",
        timezone: "auto"
    });

    const response = await fetchWithRetry(`${AIR_QUALITY_URL}?${params.toString()}`);
    const rawData = await response.json();

    return validateData(AirQualitySchema, rawData, 'getAirQualityData');
};

// 3. Funció AROME (CORREGIT: Sense duplicats)
export const getAromeData = async (lat: number, lon: number): Promise<WeatherData> => {
    const params = new URLSearchParams({
        latitude: lat.toString(),
        longitude: lon.toString(),
        // CORRECCIÓ: Eliminada la línia duplicada de longitude que hi havia aquí
        current: "temperature_2m,relative_humidity_2m,apparent_temperature,is_day,precipitation,weather_code,cloud_cover,pressure_msl,surface_pressure,wind_speed_10m,wind_direction_10m,wind_gusts_10m,cloud_cover_low,cloud_cover_mid,cloud_cover_high",
        hourly: "temperature_2m,relative_humidity_2m,dew_point_2m,apparent_temperature,precipitation,weather_code,pressure_msl,surface_pressure,cloud_cover,cloud_cover_low,cloud_cover_mid,cloud_cover_high,visibility,wind_speed_10m,wind_direction_10m,wind_gusts_10m,cape,freezing_level_height,is_day",
        minutely_15: "precipitation", 
        timezone: "auto",
        models: "meteofrance_arome_france_hd" 
    });

    const response = await fetchWithRetry(`${BASE_URL}?${params.toString()}`);
    const rawData = await response.json();

    return validateData(WeatherResponseSchema, rawData, 'getAromeData') as WeatherData;
};