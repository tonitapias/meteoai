// src/utils/aromeEngine.ts
import { ExtendedWeatherData, StrictHourlyWeather, StrictCurrentWeather } from '../types/weatherLogicTypes';

// Funció helper per netejar els sufixes molestos de l'API
const cleanKeys = (obj: Record<string, unknown>): Record<string, unknown> => {
    if (!obj) return {};
    const clean: Record<string, unknown> = {};
    Object.keys(obj).forEach(key => {
        // Elimina qualsevol sufix de model conegut
        const cleanKey = key.replace(/_meteofrance_arome_france_hd|_best_match|_ecmwf|_gfs|_icon/g, '');
        clean[cleanKey] = obj[key];
    });
    return clean;
};

export const injectHighResModels = (baseData: ExtendedWeatherData, highResData: ExtendedWeatherData | null): ExtendedWeatherData => {
    if (!baseData) return baseData;
    const target = typeof structuredClone === 'function' ? structuredClone(baseData) : JSON.parse(JSON.stringify(baseData)) as ExtendedWeatherData; 
    
    // 1. NETEJA PREVIA
    if (!highResData) return target;
    
    const rawHighRes = highResData as unknown as Record<string, unknown>;
    
    // Creem un objecte font netejat
    const source = {
        current: cleanKeys(rawHighRes.current as Record<string, unknown>),
        hourly: {
            ...cleanKeys(rawHighRes.hourly as Record<string, unknown>),
            time: highResData.hourly?.time 
        },
        minutely_15: rawHighRes.minutely_15 
            ? cleanKeys(rawHighRes.minutely_15 as Record<string, unknown>) 
            : undefined
    };

    const masterTimeLength = target.hourly?.time?.length || 0;

    // Assegurem estructura del target
    if (target.hourly && masterTimeLength > 0) {
        Object.keys(target.hourly).forEach(key => {
            if (key === 'time') return;
            const arr = target.hourly[key as keyof StrictHourlyWeather];
            if (Array.isArray(arr)) {
                while (arr.length < masterTimeLength) arr.push(null);
            }
        });
    }

    // 2. INJECCIÓ CURRENT
    const CURRENT_FIELDS_TO_OVERWRITE: (keyof StrictCurrentWeather)[] = [
        'temperature_2m', 'relative_humidity_2m', 'apparent_temperature', 
        'is_day', 'precipitation', 'rain', 'showers', 
        'weather_code', 'cloud_cover', 'cloud_cover_low', 
        'cloud_cover_mid', 'cloud_cover_high', 
        'wind_speed_10m', 'wind_gusts_10m', 'visibility'
    ];

    if (source.current && target.current) {
        CURRENT_FIELDS_TO_OVERWRITE.forEach(k => {
             const val = (source.current as Record<string, unknown>)[k];
             if (val != null && !isNaN(Number(val))) {
                 (target.current as Record<string, unknown>)[k] = val;
             }
        });
        target.current.source = 'AROME HD'; 
    }

    // 3. INJECCIÓ MINUTELY_15
    const srcMin = source.minutely_15 as Record<string, unknown> | undefined;
    if (srcMin && Array.isArray(srcMin.time) && Array.isArray(srcMin.precipitation)) {
        target.minutely_15 = srcMin as unknown as { time: string[]; precipitation: number[]; [key: string]: unknown };
    }

    // 4. INJECCIÓ HOURLY
    const HOURLY_FIELDS: (keyof StrictHourlyWeather)[] = [
        'temperature_2m', 'relative_humidity_2m', 'apparent_temperature',
        'precipitation', 'weather_code',
        'cloud_cover', 'cloud_cover_low', 'cloud_cover_mid', 'cloud_cover_high',
        'wind_speed_10m', 'wind_gusts_10m',
        'cape', 'freezing_level_height', 'visibility'
    ];

    if (source.hourly && target.hourly && target.hourly.time) {
        const globalTimeIndexMap = new Map<string, number>();
        target.hourly.time.forEach((t, i) => globalTimeIndexMap.set(t, i));

        const sourceTimes = source.hourly.time || highResData.hourly?.time || [];

        (sourceTimes as string[]).forEach((timeValue: string, sourceIndex: number) => {
            const globalIndex = globalTimeIndexMap.get(timeValue);
            
            if (globalIndex !== undefined) {
                const sH = source.hourly as Record<string, unknown>; 
                const tH = target.hourly;
                
                HOURLY_FIELDS.forEach(field => {
                    const srcArr = sH[field];
                    
                    if (Array.isArray(srcArr)) {
                         const val = srcArr[sourceIndex];
                         if (val != null && !isNaN(Number(val))) {
                             if (!tH[field]) {
                                 (tH as Record<string, unknown>)[field] = new Array(masterTimeLength).fill(null);
                             }

                             const tgtArr = tH[field] as (number | null)[];
                             if (Array.isArray(tgtArr)) {
                                 tgtArr[globalIndex] = val;
                             }
                         }
                    }
                });

                // Reforç de probabilitat de pluja si AROME detecta precipitació
                const precipArr = sH.precipitation as number[] | undefined;
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
    }

    return target;
};