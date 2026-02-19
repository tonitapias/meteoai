// src/utils/aromeEngineV2.ts
import { z } from 'zod';
import type { ExtendedWeatherData, StrictHourlyWeather, StrictCurrentWeather } from '../types/weatherLogicTypes';
import { HourlyDataSchema, CurrentDataSchema } from '../schemas/weatherSchema';

// --- 1. SCHEMAS & TIPUS INTERNS (Idèntic a l'original per seguretat) ---
const AromeCleanedSchema = z.object({
    current: CurrentDataSchema.optional(),
    hourly: HourlyDataSchema.optional(),
    minutely_15: z.object({
        time: z.array(z.string()),
        precipitation: z.array(z.number().nullable())
    }).passthrough().optional()
});

type CleanedSource = z.infer<typeof AromeCleanedSchema>;

// --- 2. HELPERS UTILS (Funcions pures) ---

const cleanKeys = (obj: Record<string, unknown> | undefined): Record<string, unknown> => {
    if (!obj) return {};
    const clean: Record<string, unknown> = {};
    Object.keys(obj).forEach(key => {
        const cleanKey = key.replace(/_meteofrance_arome_france_hd|_best_match|_ecmwf|_gfs|_icon/g, '');
        clean[cleanKey] = obj[key];
    });
    return clean;
};

const normalizeTime = (t: unknown): number => {
    if (!t) return 0;
    const date = new Date(String(t));
    if (isNaN(date.getTime())) return 0;
    date.setMinutes(0, 0, 0); 
    return date.getTime();
};

// --- 3. SUB-INJECTORS (Modularització de la lògica) ---

const injectCurrent = (target: ExtendedWeatherData, source: CleanedSource) => {
    if (!source.current || !target.current) return;

    const CURRENT_FIELDS_TO_OVERWRITE: (keyof StrictCurrentWeather)[] = [
        'temperature_2m', 'relative_humidity_2m', 'apparent_temperature', 
        'is_day', 'precipitation', 'rain', 'showers', 
        'weather_code', 'cloud_cover', 'cloud_cover_low', 
        'cloud_cover_mid', 'cloud_cover_high', 
        'wind_speed_10m', 'wind_gusts_10m', 'visibility'
    ];

    const targetCurrent = target.current as Record<string, unknown>;
    
    CURRENT_FIELDS_TO_OVERWRITE.forEach(k => {
            const val = (source.current as Record<string, unknown>)[k];
            if (val != null && !isNaN(Number(val))) {
                targetCurrent[k] = val;
            }
    });
    target.current.source = 'AROME HD'; 
};

const injectMinutely = (target: ExtendedWeatherData, source: CleanedSource) => {
    if (!source.minutely_15) return;
    
    if (source.minutely_15.time.length > 0) {
        target.minutely_15 = source.minutely_15 as unknown as { time: string[]; precipitation: number[]; [key: string]: unknown };
    }
};

const injectHourly = (target: ExtendedWeatherData, source: CleanedSource, masterTimeLength: number) => {
    if (!source.hourly || !target.hourly || !target.hourly.time) return;

    const HOURLY_FIELDS: (keyof StrictHourlyWeather)[] = [
        'temperature_2m', 'relative_humidity_2m', 'apparent_temperature',
        'precipitation', 'weather_code',
        'cloud_cover', 'cloud_cover_low', 'cloud_cover_mid', 'cloud_cover_high',
        'wind_speed_10m', 'wind_gusts_10m',
        'cape', 'freezing_level_height', 'visibility'
    ];

    const globalTimeIndexMap = new Map<number, number>();
    target.hourly.time.forEach((t, i) => globalTimeIndexMap.set(normalizeTime(t), i));
    const sourceTimes = source.hourly.time; 

    sourceTimes.forEach((timeValue, sourceIndex) => {
        const timeKey = normalizeTime(timeValue);
        const globalIndex = globalTimeIndexMap.get(timeKey);
        
        if (globalIndex !== undefined) {
            const tH = target.hourly as Record<string, (number | null)[]>;
            
            HOURLY_FIELDS.forEach(field => {
                // Accés segur
                const srcArr = (source.hourly as Record<string, number[] | undefined>)[field];
                if (Array.isArray(srcArr)) {
                        const val = srcArr[sourceIndex];
                        if (val != null && !isNaN(Number(val))) {
                            if (!tH[field]) tH[field] = new Array(masterTimeLength).fill(null);
                            tH[field][globalIndex] = val;
                        }
                }
            });

            // Reforç de probabilitat de pluja
            const precipArr = source.hourly?.precipitation as number[] | undefined; 
            const aromePrecip = precipArr?.[sourceIndex];
            
            if (aromePrecip != null && aromePrecip >= 0.1) {
                if (!tH.precipitation_probability) tH.precipitation_probability = new Array(masterTimeLength).fill(0);
                const currentProb = tH.precipitation_probability[globalIndex] || 0;
                if (currentProb < 50) {
                    tH.precipitation_probability[globalIndex] = Math.max(currentProb, 70);
                }
            }
        }
    });
};

// --- 4. FUNCIÓ PRINCIPAL (Clean Code) ---

export const injectHighResModelsV2 = (baseData: ExtendedWeatherData, highResData: ExtendedWeatherData | null): ExtendedWeatherData => {
    if (!baseData) return baseData;
    if (!highResData) return baseData;

    // 1. Shallow Copy (Seguretat)
    const target: ExtendedWeatherData = { ...baseData };
    if (baseData.current) target.current = { ...baseData.current };
    if (baseData.hourly) {
        target.hourly = { ...baseData.hourly };
        Object.keys(target.hourly).forEach((k) => {
            const key = k as keyof StrictHourlyWeather;
            const val = target.hourly![key];
            if (Array.isArray(val)) {
                (target.hourly as Record<string, unknown[]>)[key] = [...val];
            }
        });
    }

    // 2. Neteja i Validació
    const rawCleaned = {
        current: cleanKeys(highResData.current as Record<string, unknown>),
        hourly: { ...cleanKeys(highResData.hourly as Record<string, unknown>), time: highResData.hourly?.time },
        minutely_15: highResData.minutely_15 ? cleanKeys(highResData.minutely_15 as Record<string, unknown>) : undefined
    };

    const validation = AromeCleanedSchema.safeParse(rawCleaned);
    
    if (!validation.success) {
        console.warn(`⚠️ AROME Engine V2: Invalid structure.`);
        return baseData;
    }

    const source: CleanedSource = validation.data;
    const masterTimeLength = target.hourly?.time?.length || 0;

    // 3. Emplenar buits estructurals
    if (target.hourly && masterTimeLength > 0) {
        (Object.keys(target.hourly) as Array<keyof StrictHourlyWeather>).forEach(key => {
            if (key === 'time') return;
            const arr = target.hourly![key];
            if (Array.isArray(arr)) {
                while (arr.length < masterTimeLength) arr.push(null);
            }
        });
    }

    // 4. Execució modular
    injectCurrent(target, source);
    injectMinutely(target, source);
    injectHourly(target, source, masterTimeLength);

    return target;
};