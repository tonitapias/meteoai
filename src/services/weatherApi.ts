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

// --- DEFINICIÓ DE VARIABLES (Sanitització) ---
const PARAMS_CURRENT = [
    "temperature_2m", "relative_humidity_2m", "apparent_temperature", "is_day", 
    "precipitation", "rain", "showers", "snowfall", "weather_code", "cloud_cover", 
    "pressure_msl", "surface_pressure", "wind_speed_10m", "wind_direction_10m", 
    "wind_gusts_10m", "cloud_cover_low", "cloud_cover_mid", "cloud_cover_high", "visibility"
];

const PARAMS_HOURLY = [
    "temperature_2m", "relative_humidity_2m", "dew_point_2m", "apparent_temperature", 
    "precipitation_probability", "precipitation", "rain", "showers", "snowfall", "snow_depth", 
    "weather_code", "pressure_msl", "surface_pressure", "cloud_cover", "cloud_cover_low", 
    "cloud_cover_mid", "cloud_cover_high", "visibility", "evapotranspiration", 
    "wind_speed_10m", "wind_direction_10m", "wind_gusts_10m", "uv_index", "uv_index_clear_sky", 
    "is_day", "cape", "freezing_level_height"
];

const PARAMS_DAILY = [
    "weather_code", "temperature_2m_max", "temperature_2m_min", "apparent_temperature_max", 
    "apparent_temperature_min", "sunrise", "sunset", "daylight_duration", "sunshine_duration", 
    "uv_index_max", "uv_index_clear_sky_max", "precipitation_sum", "rain_sum", "showers_sum", 
    "snowfall_sum", "precipitation_hours", "precipitation_probability_max", "wind_speed_10m_max", 
    "wind_gusts_10m_max", "wind_direction_10m_dominant", "shortwave_radiation_sum", 
    "et0_fao_evapotranspiration"
];

const PARAMS_AQI_CURRENT = [
    "european_aqi", "us_aqi", "pm10", "pm2_5", "nitrogen_dioxide", "ozone", 
    "sulphur_dioxide", "dust", "uv_index", "ammonia", "alder_pollen", "birch_pollen", 
    "grass_pollen", "mugwort_pollen", "olive_pollen", "ragweed_pollen"
];

const PARAMS_AQI_HOURLY = [
    "european_aqi", "pm10", "pm2_5", "nitrogen_dioxide", "ozone", "sulphur_dioxide"
];

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

// --- Utilitat interna: Retry Logic (MILLORADA) ---
const fetchWithRetry = async (url: string, retries = MAX_RETRIES): Promise<Response> => {
    for (let i = 0; i <= retries; i++) {
        try {
            const response = await fetchWithTimeout(url);
            
            // Si el servidor respon amb error 500+, llencem error per forçar el reintent
            if (!response.ok && response.status >= 500) throw new Error(`Server Error: ${response.status}`);
            
            // Si és error 4xx (client), no reintentem i tornem resposta tal qual o llencem error segons convingui
            // Aquí assumim que volem capturar-ho com error d'API
            if (!response.ok) throw new Error(`API Error: ${response.status} ${response.statusText}`);
            
            return response;
        } catch (err) {
            // Si és l'últim intent, registrem l'error CRÍTIC a Sentry
            if (i === retries) {
                console.error(`❌ Error fatal després de ${retries + 1} intents:`, err);
                
                Sentry.captureException(err, { 
                    tags: { 
                        service: 'weather_api', 
                        type: 'network_critical',
                        url_short: url.split('?')[0] // Només la base de l'URL per agrupar millor
                    },
                    extra: { full_url: url, attempts: retries + 1 }
                });
                
                throw err; // Propaguem l'error perquè l'UI mostri el missatge pertinent
            }

            // Si no és l'últim, només avisem (Breadcrumb) i esperem
            console.warn(`⚠️ Intent ${i + 1} fallit. Reintentant...`, err);
            Sentry.addBreadcrumb({
                category: "network-retry",
                message: `Retry ${i + 1}/${retries}`,
                level: "warning",
                data: { url: url, error: String(err) }
            });
            await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1)));
        }
    }
    throw new Error("Unexpected retry loop exit");
};

// --- Normalitzador de Models (Tipatge Segur) ---
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
        // Capturem error de schema però no bloquegem l'app (retornem dades "brutes" si cal, o millor null)
        // En aquest cas, seguim l'estratègia original de retornar cleanData però avisant fort a Sentry.
        Sentry.captureException(new Error(`Schema Validation Failed in ${context}`), {
            tags: { type: 'schema_validation' },
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
        current: PARAMS_CURRENT.join(','),
        hourly: PARAMS_HOURLY.join(','),
        daily: PARAMS_DAILY.join(','),
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
        current: PARAMS_AQI_CURRENT.join(','),
        hourly: PARAMS_AQI_HOURLY.join(','),
        timezone: "auto"
    });

    const response = await fetchWithRetry(`${AIR_QUALITY_URL}?${params.toString()}`);
    const rawData = await response.json();

    return validateData(AirQualitySchema, rawData, 'getAirQualityData') as Record<string, unknown>;
};

// 3. Funció AROME
export const getAromeData = async (lat: number, lon: number): Promise<WeatherData> => {
    const AROME_CURRENT = [
        "temperature_2m", "relative_humidity_2m", "apparent_temperature", "is_day", 
        "precipitation", "weather_code", "cloud_cover", "pressure_msl", "surface_pressure", 
        "wind_speed_10m", "wind_direction_10m", "wind_gusts_10m", "cloud_cover_low", 
        "cloud_cover_mid", "cloud_cover_high"
    ];
    
    const AROME_HOURLY = [
        "temperature_2m", "relative_humidity_2m", "dew_point_2m", "apparent_temperature", 
        "precipitation", "weather_code", "pressure_msl", "surface_pressure", "cloud_cover", 
        "cloud_cover_low", "cloud_cover_mid", "cloud_cover_high", "visibility", 
        "wind_speed_10m", "wind_direction_10m", "wind_gusts_10m", "cape", 
        "freezing_level_height", "is_day"
    ];

    const params = new URLSearchParams({
        latitude: lat.toString(),
        longitude: lon.toString(),
        current: AROME_CURRENT.join(','),
        hourly: AROME_HOURLY.join(','),
        minutely_15: "precipitation", 
        timezone: "auto",
        models: "meteofrance_arome_france_hd" 
    });

    const response = await fetchWithRetry(`${BASE_URL}?${params.toString()}`);
    const rawData = await response.json();

    return validateData(WeatherResponseSchema, rawData, 'getAromeData') as WeatherData;
};