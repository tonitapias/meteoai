// src/services/weatherApi.ts
import * as Sentry from "@sentry/react";
import { ZodType, ZodTypeDef } from "zod"; 
import { WeatherResponseSchema, AirQualitySchema } from "../schemas/weatherSchema";
import { WeatherData, AirQualityData } from "../types/weather";
import { fetchWithTimeout } from "../utils/networkUtils";

import {
    API_TIMEOUT_DEFAULT,
    API_FORECAST_TIMEOUT,
    API_RETRY_DELAYS_MS,
    API_FORECAST_DAYS,
    API_MODELS_LIST,
    PARAMS_CURRENT,
    PARAMS_HOURLY,
    PARAMS_DAILY,
    PARAMS_AQI_CURRENT,
    PARAMS_AQI_HOURLY,
    REGIONAL_HD_CURRENT,
    REGIONAL_HD_HOURLY
} from "../constants/apiConfig";
import type { RegionalModel } from "../constants/regionalModels";

const BASE_URL = import.meta.env.VITE_API_WEATHER_BASE || "https://api.open-meteo.com/v1/forecast";
const AIR_QUALITY_URL = import.meta.env.VITE_API_AQI_BASE || "https://air-quality-api.open-meteo.com/v1/air-quality";
const TIMEOUT_MS = Number(import.meta.env.VITE_API_TIMEOUT) || API_TIMEOUT_DEFAULT;
// En producció VITE_API_TIMEOUT surt d'un secret de GitHub (deploy.yml): si mai és més llarg, mana aquell.
const FORECAST_TIMEOUT_MS = Math.max(API_FORECAST_TIMEOUT, TIMEOUT_MS);

// Resposta HTTP no correcta. El missatge és el de sempre ("Server Error: 503", "API Error: 429 ..."); l'estat va a part
// perquè fetchWithRetry decideixi si val la pena reintentar.
class HttpStatusError extends Error {
    readonly status: number;
    constructor(status: number, statusText: string) {
        super(status >= 500 ? `Server Error: ${status}` : `API Error: ${status} ${statusText}`);
        this.status = status;
    }
}

// Temps d'espera esgotat (l'AbortController de fetchWithTimeout). Pel nom i no per `instanceof Error`: el fetch rebutja
// amb un DOMException, que no sempre és un Error del mateix context (a jsdom, per exemple, no ho és).
const isAbortError = (err: unknown): boolean =>
    typeof err === 'object' && err !== null && (err as { name?: unknown }).name === 'AbortError';

// Es reintenta un 5xx (503 = Open-Meteo saturat per a tothom) o una caiguda de xarxa ("Failed to fetch"). No es
// reintenta un 4xx: el 429 és la quota d'Open-Meteo per IP, i reintentar-lo només en gasta més (cada error també hi
// compta); un 400 tornaria igual. Tampoc un intent que s'ha quedat sense temps: el servidor és lent, i tallar-lo per
// tornar-lo a demanar no arriba mai a la resposta (per això cada petició ja té un temps d'espera llarg).
const isRetriable = (err: unknown): boolean => {
    if (err instanceof HttpStatusError) return err.status >= 500;
    return !isAbortError(err);
};

const fetchWithRetry = async (url: string, contextTag: string, timeoutMs = TIMEOUT_MS): Promise<Response> => {
    const retries = API_RETRY_DELAYS_MS.length;
    for (let i = 0; i <= retries; i++) {
        try {
            const response = await fetchWithTimeout(url, timeoutMs);

            if (!response.ok) {
                 Sentry.addBreadcrumb({
                    category: 'http-error',
                    message: `HTTP Error ${response.status} en ${contextTag}`,
                    level: 'error',
                    data: { status: response.status, url: url }
                 });

                 throw new HttpStatusError(response.status, response.statusText);
            }

            return response;
        } catch (err: unknown) {
            if (i === retries || !isRetriable(err)) {
                const isTimeout = isAbortError(err);
                const errorType = isTimeout ? 'network_timeout' : 'network_critical';
                const errorMessage = err instanceof Error ? err.message : String(err);

                console.error(`❌ Error fatal (${contextTag}) després de ${i + 1} intents`, err);

                Sentry.captureException(err instanceof Error ? err : new Error(errorMessage), {
                    tags: {
                        service: 'weather_api',
                        type: errorType,
                        context: contextTag,
                        ...(err instanceof HttpStatusError ? { http_status: String(err.status) } : {})
                    },
                    extra: {
                        full_url: url,
                        attempts: i + 1,
                        is_timeout: isTimeout
                    }
                });
                throw err;
            }

            console.warn(`⚠️ Intent ${i + 1} fallit (${contextTag}). Reintentant...`);
            Sentry.addBreadcrumb({
                category: "network-retry",
                message: `Retry ${i + 1}/${retries} for ${contextTag}`,
                level: "warning",
                data: { error: String(err) }
            });

            await new Promise(resolve => setTimeout(resolve, API_RETRY_DELAYS_MS[i]));
        }
    }
    throw new Error("Unexpected retry loop exit");
};

const normalizeModelKeys = <T = unknown>(data: unknown): T => {
    if (!data || typeof data !== 'object') return data as T;
    
    const processObject = (obj: unknown): unknown => {
        if (!obj || typeof obj !== 'object') return obj;
        const typedObj = obj as Record<string, unknown>;
        const newObj: Record<string, unknown> = {};
        
        Object.keys(typedObj).forEach(key => {
            const value = typedObj[key];
            if (Array.isArray(value)) {
                newObj[key] = value.map(v => 
                    (v === null || v === undefined || Number.isNaN(v) || v === "") ? null : v
                );
            } else {
                newObj[key] = value;
            }
        });

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

    return normalized as T;
};

const validateData = <T>(schema: ZodType<T, ZodTypeDef, unknown>, data: unknown, context: string): T => {
    const cleanData = normalizeModelKeys<unknown>(data);
    const result = schema.safeParse(cleanData);
    
    if (!result.success) {
        console.error(`❌ Zod Validation Error (${context}):`, result.error);
        
        const validationError = new Error(`Critical Schema Validation Failed in ${context}`);
        Sentry.captureException(validationError, {
            tags: { type: 'schema_validation_fatal' },
            extra: { 
                zodError: result.error.format(),
                rawKeys: typeof data === 'object' && data !== null ? Object.keys(data as object) : 'not-object'
            }
        });
        
        throw validationError;
    }
    
    return result.data;
};

// 1. Funció Principal
// [FIX PRECISIÓ] Ja NO demanem temperature_unit a l'API: sempre Celsius (com AROME, i com
// el valor per defecte d'Open-Meteo). La conversió C→F es fa NOMÉS a formatTemp(), en un sol
// lloc, per a totes les fonts (base i AROME) i tots els camps (main/max/min/apparent).
// `unit` es manté al paràmetre només per traçabilitat al breadcrumb de Sentry.
export const getWeatherData = async (lat: number, lon: number, unit: 'C' | 'F'): Promise<WeatherData> => {
    Sentry.addBreadcrumb({
        category: 'api-call',
        message: 'Requesting MAIN Weather Data',
        level: 'info',
        data: { lat, lon, unit }
    });

    const params = new URLSearchParams({
        latitude: lat.toString(),
        longitude: lon.toString(),
        current: PARAMS_CURRENT.join(','),
        hourly: PARAMS_HOURLY.join(','),
        daily: PARAMS_DAILY.join(','),
        models: API_MODELS_LIST, 
        timezone: "auto",
        wind_speed_unit: "kmh",
        precipitation_unit: "mm",
        forecast_days: API_FORECAST_DAYS 
    });

    const response = await fetchWithRetry(`${BASE_URL}?${params.toString()}`, 'getWeatherData', FORECAST_TIMEOUT_MS);
    const rawData: unknown = await response.json();
    
    return validateData<WeatherData>(WeatherResponseSchema, rawData, 'getWeatherData');
};

// 2. Funció Qualitat Aire
export const getAirQualityData = async (lat: number, lon: number): Promise<AirQualityData> => {
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
    const rawData: unknown = await response.json();

    return validateData<AirQualityData>(AirQualitySchema, rawData, 'getAirQualityData');
};

// 3. Funció Model Regional d'Alta Resolució (AROME / ICON-D2 / HRRR / HRDPS)
// [NETEJA] Abans nomia's getAromeData i cridava sempre AROME_MODELS_LIST: generalitzat
// per acceptar qualsevol RegionalModel del registre (constants/regionalModels.ts).
// [FIX PRECISIÓ] Abans confiàvem en els valors per defecte d'Open-Meteo per a
// wind_speed_unit/precipitation_unit (que avui coincideixen amb "kmh"/"mm"). Ara els
// fixem explícitament, igual que a getWeatherData, perquè si Open-Meteo canvia mai el seu
// valor per defecte, el model regional ("local") no acabi en unitats diferents de la resta
// de fonts sense que cap tipus ni Zod ho detecti. Temperatura ja era Celsius per defecte.
export const getRegionalHDData = async (lat: number, lon: number, model: RegionalModel): Promise<WeatherData> => {
    Sentry.addBreadcrumb({
        category: 'api-call',
        message: `Requesting Regional HD Data (${model.label})`,
        level: 'info',
        data: { lat, lon, model: model.id }
    });

    const params = new URLSearchParams({
        latitude: lat.toString(),
        longitude: lon.toString(),
        current: REGIONAL_HD_CURRENT.join(','),
        hourly: REGIONAL_HD_HOURLY.join(','),
        minutely_15: "precipitation",
        timezone: "auto",
        wind_speed_unit: "kmh",
        precipitation_unit: "mm",
        models: model.apiModelId
    });

    const response = await fetchWithRetry(`${BASE_URL}?${params.toString()}`, `getRegionalHDData:${model.id}`, FORECAST_TIMEOUT_MS);
    const rawData: unknown = await response.json();

    return validateData<WeatherData>(WeatherResponseSchema, rawData, 'getRegionalHDData');
};