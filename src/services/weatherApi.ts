// src/services/weatherApi.ts
import * as Sentry from "@sentry/react";
import { ZodType } from "zod"; 
import { WeatherResponseSchema, AirQualitySchema } from "../schemas/weatherSchema";
// IMPORTACIÓ ACTUALITZADA: Afegim AirQualityData
import { WeatherData, AirQualityData } from "../types/weather";

// IMPORTS DE LA CONFIGURACIÓ
import { 
    API_TIMEOUT_DEFAULT, 
    API_MAX_RETRIES,
    API_FORECAST_DAYS, 
    API_MODELS_LIST,   
    AROME_MODELS_LIST, 
    PARAMS_CURRENT,
    PARAMS_HOURLY,
    PARAMS_DAILY,
    PARAMS_AQI_CURRENT,
    PARAMS_AQI_HOURLY,
    AROME_CURRENT,
    AROME_HOURLY
} from "../constants/apiConfig";

// CONFIGURACIÓ DE L'ENTORN
const BASE_URL = import.meta.env.VITE_API_WEATHER_BASE || "https://api.open-meteo.com/v1/forecast";
const AIR_QUALITY_URL = import.meta.env.VITE_API_AQI_BASE || "https://air-quality-api.open-meteo.com/v1/air-quality";
const TIMEOUT_MS = Number(import.meta.env.VITE_API_TIMEOUT) || API_TIMEOUT_DEFAULT;
const MAX_RETRIES = API_MAX_RETRIES;

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
const fetchWithRetry = async (url: string, contextTag: string, retries = MAX_RETRIES): Promise<Response> => {
    for (let i = 0; i <= retries; i++) {
        try {
            const response = await fetchWithTimeout(url);
            
            if (!response.ok) {
                 // Log d'error HTTP (404, 500, etc)
                 Sentry.addBreadcrumb({
                    category: 'http-error',
                    message: `HTTP Error ${response.status} en ${contextTag}`,
                    level: 'error',
                    data: { status: response.status, url: url }
                 });

                 if (response.status >= 500) throw new Error(`Server Error: ${response.status}`);
                 throw new Error(`API Error: ${response.status} ${response.statusText}`);
            }
            
            return response;
        } catch (err) {
            if (i === retries) {
                const isTimeout = err instanceof Error && err.name === 'AbortError';
                const errorType = isTimeout ? 'network_timeout' : 'network_critical';
                
                // Log final abans de llançar l'excepció
                console.error(`❌ Error fatal (${contextTag}) després de ${retries + 1} intents`, err);
                
                Sentry.captureException(err, { 
                    tags: { 
                        service: 'weather_api', 
                        type: errorType, 
                        context: contextTag
                    },
                    extra: { 
                        full_url: url, 
                        attempts: retries + 1,
                        is_timeout: isTimeout
                    }
                });
                throw err; 
            }
            
            // Log de reintent (Warning) - Molt útil per veure si la connexió és inestable
            console.warn(`⚠️ Intent ${i + 1} fallit (${contextTag}). Reintentant...`);
            Sentry.addBreadcrumb({
                category: "network-retry", 
                message: `Retry ${i + 1}/${retries} for ${contextTag}`, 
                level: "warning",
                data: { error: String(err) }
            });
            
            await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1)));
        }
    }
    throw new Error("Unexpected retry loop exit");
};

// --- Normalitzador de Models ---
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
        
        // MILLORA DE SEGURETAT (PAS 4):
        // En lloc de retornar dades corruptes (cleanData), llancem error per activar l'ErrorBoundary.
        // Amb el nou 'weatherSchema.ts' robust, si fallem aquí és que les dades són inservibles.
        
        const validationError = new Error(`Critical Schema Validation Failed in ${context}`);
        Sentry.captureException(validationError, {
            tags: { type: 'schema_validation_fatal' },
            extra: { 
                zodError: result.error.format(),
                rawKeys: typeof data === 'object' ? Object.keys(data as object) : 'not-object'
            }
        });
        
        throw validationError; // Atura l'execució. useWeather capturarà això i mostrarà l'estat d'error UI.
    }
    return result.data;
};

// 1. Funció Principal
export const getWeatherData = async (lat: number, lon: number, unit: 'C' | 'F'): Promise<WeatherData> => {
    // BREADCRUMB 1: Inici de la petició principal
    Sentry.addBreadcrumb({
        category: 'api-call',
        message: 'Requesting MAIN Weather Data',
        level: 'info',
        data: { lat, lon, unit }
    });

    const tempUnit = unit === 'F' ? 'fahrenheit' : 'celsius';
    
    const params = new URLSearchParams({
        latitude: lat.toString(),
        longitude: lon.toString(),
        current: PARAMS_CURRENT.join(','),
        hourly: PARAMS_HOURLY.join(','),
        daily: PARAMS_DAILY.join(','),
        models: API_MODELS_LIST, 
        timezone: "auto",
        temperature_unit: tempUnit,
        wind_speed_unit: "kmh",
        precipitation_unit: "mm",
        forecast_days: API_FORECAST_DAYS 
    });

    const response = await fetchWithRetry(`${BASE_URL}?${params.toString()}`, 'getWeatherData');
    const rawData = await response.json();
    
    return validateData(WeatherResponseSchema, rawData, 'getWeatherData') as WeatherData;
};

// 2. Funció Qualitat Aire
// UPDATED: Retorna AirQualityData estrictament tipat
export const getAirQualityData = async (lat: number, lon: number): Promise<AirQualityData> => {
    // BREADCRUMB 2: Inici AQI
    Sentry.addBreadcrumb({
        category: 'api-call',
        message: 'Requesting AIR QUALITY Data',
        level: 'info',
        data: { lat, lon }
    });

    const params = new URLSearchParams({
        latitude: lat.toString(),
        longitude: lon.toString(),
        current: PARAMS_AQI_CURRENT.join(','),
        hourly: PARAMS_AQI_HOURLY.join(','),
        timezone: "auto"
    });

    const response = await fetchWithRetry(`${AIR_QUALITY_URL}?${params.toString()}`, 'getAirQualityData');
    const rawData = await response.json();

    return validateData(AirQualitySchema, rawData, 'getAirQualityData') as AirQualityData;
};

// 3. Funció AROME
export const getAromeData = async (lat: number, lon: number): Promise<WeatherData> => {
    // BREADCRUMB 3: Inici AROME
    Sentry.addBreadcrumb({
        category: 'api-call',
        message: 'Requesting AROME HD Data',
        level: 'info',
        data: { lat, lon }
    });

    const params = new URLSearchParams({
        latitude: lat.toString(),
        longitude: lon.toString(),
        current: AROME_CURRENT.join(','),
        hourly: AROME_HOURLY.join(','),
        minutely_15: "precipitation", 
        timezone: "auto",
        models: AROME_MODELS_LIST 
    });

    const response = await fetchWithRetry(`${BASE_URL}?${params.toString()}`, 'getAromeData');
    const rawData = await response.json();

    return validateData(WeatherResponseSchema, rawData, 'getAromeData') as WeatherData;
};