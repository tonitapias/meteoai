// src/utils/regionalModelEngine.ts
import { z } from 'zod';
import type { ExtendedWeatherData, StrictHourlyWeather, StrictCurrentWeather } from '../types/weatherLogicTypes';
import { HourlyDataSchema, CurrentDataSchema } from '../schemas/weatherSchema';
import { buildModelSuffixRegex, type RegionalModel } from '../constants/regionalModels';

// --- 1. SCHEMAS & TIPUS INTERNS (Idèntic a l'original per seguretat) ---
const RegionalModelCleanedSchema = z.object({
    current: CurrentDataSchema.optional(),
    hourly: HourlyDataSchema.optional(),
    minutely_15: z.object({
        time: z.array(z.string()),
        precipitation: z.array(z.number().nullable())
    }).passthrough().optional()
});

type CleanedSource = z.infer<typeof RegionalModelCleanedSchema>;

// --- 2. HELPERS UTILS (Funcions pures) ---

// [NETEJA] Abans hardcodejava només el sufix d'AROME; ara la regex es genera
// a partir del registre de models regionals (regionalModels.ts) perquè cobreixi
// també ICON-D2/HRRR/HRDPS sense mantenir una còpia local de la llista.
const MODEL_SUFFIX_REGEX = buildModelSuffixRegex();

const cleanKeys = (obj: Record<string, unknown> | undefined): Record<string, unknown> => {
    if (!obj) return {};
    const clean: Record<string, unknown> = {};
    Object.keys(obj).forEach(key => {
        const cleanKey = key.replace(MODEL_SUFFIX_REGEX, '');
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

const injectCurrent = (target: ExtendedWeatherData, source: CleanedSource, model: RegionalModel) => {
    if (!source.current || !target.current) return;

    const CURRENT_FIELDS_TO_OVERWRITE: (keyof StrictCurrentWeather)[] = [
        'temperature_2m', 'relative_humidity_2m', 'apparent_temperature', 
        'is_day', 'precipitation', 'rain', 'showers', 
        'weather_code', 'cloud_cover', 'cloud_cover_low', 
        'cloud_cover_mid', 'cloud_cover_high', 
        'wind_speed_10m', 'wind_gusts_10m', 'visibility'
    ];

    const targetCurrent = target.current as Record<string, unknown>;

    // [FIX PRECISIÓ] Abans es marcava 'AROME HD' encara que cap camp de sota
    // fos vàlid (p.ex. AROME retorna 'current' estructuralment però amb tots
    // els valors nuls per una fallada parcial puntual). Això feia que la UI
    // mostrés la insígnia d'alta resolució amb dades que en realitat venien
    // íntegrament del model global de reserva — procedència enganyosa que
    // contradiu la doctrina Risc Zero. Ara només marquem la font com a model
    // regional si com a mínim un camp real s'ha sobreescrit de debò.
    let anyFieldOverwritten = false;
    CURRENT_FIELDS_TO_OVERWRITE.forEach(k => {
            const val = (source.current as Record<string, unknown>)[k];
            if (val != null && !isNaN(Number(val))) {
                targetCurrent[k] = val;
                anyFieldOverwritten = true;
            }
    });
    if (anyFieldOverwritten) {
        target.current.source = model.label;
    }
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
            const regionalPrecip = precipArr?.[sourceIndex];

            if (regionalPrecip != null && regionalPrecip >= 0.1) {
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

export const injectHighResModels = (baseData: ExtendedWeatherData, highResData: ExtendedWeatherData | null, model: RegionalModel): ExtendedWeatherData => {
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

    const validation = RegionalModelCleanedSchema.safeParse(rawCleaned);

    if (!validation.success) {
        console.warn(`⚠️ Regional Model Engine: Invalid structure.`);
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
    injectCurrent(target, source, model);
    injectMinutely(target, source);
    injectHourly(target, source, masterTimeLength);

    return target;
};