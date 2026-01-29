// src/utils/aromeEngine.ts
import { z } from 'zod';
import { ExtendedWeatherData, StrictHourlyWeather, StrictCurrentWeather } from '../types/weatherLogicTypes';
import { HourlyDataSchema, CurrentDataSchema } from '../schemas/weatherSchema';

// --- VALIDACIÓ INTERNA (NOU) ---
// Validem que, després de netejar les claus, l'estructura sigui coherent.
const AromeCleanedSchema = z.object({
    current: CurrentDataSchema.optional(),
    hourly: HourlyDataSchema.optional(),
    minutely_15: z.object({
        time: z.array(z.string()),
        precipitation: z.array(z.number().nullable())
    }).passthrough().optional()
});

// Tipus inferit automàticament de l'esquema (Seguretat total de tipus)
type CleanedSource = z.infer<typeof AromeCleanedSchema>;

// Funció helper genèrica per netejar claus
const cleanKeys = (obj: Record<string, unknown> | undefined): Record<string, unknown> => {
    if (!obj) return {};
    const clean: Record<string, unknown> = {};
    Object.keys(obj).forEach(key => {
        // Elimina sufixos de models específics per normalitzar les claus
        const cleanKey = key.replace(/_meteofrance_arome_france_hd|_best_match|_ecmwf|_gfs|_icon/g, '');
        clean[cleanKey] = obj[key];
    });
    return clean;
};

// Normalitza qualsevol format de data a un Timestamp numèric (ms) alineat a l'hora.
const normalizeTime = (t: unknown): number => {
    if (!t) return 0;
    const date = new Date(String(t));
    if (isNaN(date.getTime())) return 0;

    // Forcem l'alineació a l'inici de l'hora (XX:00:00)
    date.setMinutes(0, 0, 0); 
    
    return date.getTime();
};

export const injectHighResModels = (baseData: ExtendedWeatherData, highResData: ExtendedWeatherData | null): ExtendedWeatherData => {
    if (!baseData) return baseData;
    if (!highResData) return baseData;

    // --- OPTIMITZACIÓ: Còpia Manual Superficial (Shallow Copy) ---
    const target: ExtendedWeatherData = { ...baseData };

    if (baseData.current) {
        target.current = { ...baseData.current };
    }

    if (baseData.hourly) {
        target.hourly = { ...baseData.hourly };
        Object.keys(target.hourly).forEach((k) => {
            const key = k as keyof StrictHourlyWeather;
            const val = target.hourly![key];
            if (Array.isArray(val)) {
                // @ts-expect-error - Sabem que és un array, fem còpia segura
                target.hourly![key] = [...val];
            }
        });
    }

    // 1. PREPARACIÓ I VALIDACIÓ DE FONTS
    // Construïm l'objecte "raw" netejat
    const rawCleaned = {
        current: cleanKeys(highResData.current as Record<string, unknown>),
        hourly: {
            ...cleanKeys(highResData.hourly as Record<string, unknown>),
            time: highResData.hourly?.time 
        },
        minutely_15: highResData.minutely_15 
            ? cleanKeys(highResData.minutely_15 as Record<string, unknown>) 
            : undefined
    };

    // --- PUNT DE CONTROL DE SEGURETAT (NOU) ---
    // Verifiquem que l'objecte netejat compleix l'estàndard
    const validation = AromeCleanedSchema.safeParse(rawCleaned);
    
    if (!validation.success) {
        // MILLORA DE SEGURETAT: Logging simplificat per evitar errors de serialització en tests/producció
        console.warn(`⚠️ AROME Engine Safety: Invalid data structure. Issues: ${validation.error.issues.length}`);
        return baseData; // Retornem baseData intacte, sense arriscar errors de runtime
    }

    const source: CleanedSource = validation.data;
    // Ara 'source' és de tipus CleanedSource, no 'any' ni 'unknown'. 
    // TypeScript ens protegirà a partir d'aquí.

    const masterTimeLength = target.hourly?.time?.length || 0;

    // Assegurar estructura del target (emplenar buits si cal)
    if (target.hourly && masterTimeLength > 0) {
        (Object.keys(target.hourly) as Array<keyof StrictHourlyWeather>).forEach(key => {
            if (key === 'time') return;
            const arr = target.hourly![key];
            if (Array.isArray(arr)) {
                while (arr.length < masterTimeLength) arr.push(null);
            }
        });
    }

    // 2. INJECCIÓ DE DADES ACTUALS (CURRENT)
    const CURRENT_FIELDS_TO_OVERWRITE: (keyof StrictCurrentWeather)[] = [
        'temperature_2m', 'relative_humidity_2m', 'apparent_temperature', 
        'is_day', 'precipitation', 'rain', 'showers', 
        'weather_code', 'cloud_cover', 'cloud_cover_low', 
        'cloud_cover_mid', 'cloud_cover_high', 
        'wind_speed_10m', 'wind_gusts_10m', 'visibility'
    ];

    if (source.current && target.current) {
        const targetCurrent = target.current as Record<string, unknown>;
        
        CURRENT_FIELDS_TO_OVERWRITE.forEach(k => {
             // TypeScript sap que source.current existeix i té tipus correctes
             // però per iteració dinàmica, fem un petit cast controlat o accés segur
             const val = (source.current as Record<string, unknown>)[k];
             
             if (val != null && !isNaN(Number(val))) {
                 targetCurrent[k] = val;
             }
        });
        target.current.source = 'AROME HD'; 
    }

    // 3. INJECCIÓ MINUTELY_15 (Alta resolució de pluja)
    if (source.minutely_15) {
        const srcMin = source.minutely_15;
        // Ja sabem que time i precipitation són arrays pel Schema Zod
        if (srcMin.time.length > 0) {
             target.minutely_15 = srcMin as unknown as { time: string[]; precipitation: number[]; [key: string]: unknown };
        }
    }

    // 4. INJECCIÓ HOURLY (Dades horàries)
    const HOURLY_FIELDS: (keyof StrictHourlyWeather)[] = [
        'temperature_2m', 'relative_humidity_2m', 'apparent_temperature',
        'precipitation', 'weather_code',
        'cloud_cover', 'cloud_cover_low', 'cloud_cover_mid', 'cloud_cover_high',
        'wind_speed_10m', 'wind_gusts_10m',
        'cape', 'freezing_level_height', 'visibility'
    ];

    if (source.hourly && target.hourly && target.hourly.time) {
        const globalTimeIndexMap = new Map<number, number>();
        
        target.hourly.time.forEach((t, i) => {
            globalTimeIndexMap.set(normalizeTime(t), i);
        });

        const sourceTimes = source.hourly.time; // TypeScript sap que és string[]

        sourceTimes.forEach((timeValue, sourceIndex) => {
            const timeKey = normalizeTime(timeValue);
            const globalIndex = globalTimeIndexMap.get(timeKey);
            
            if (globalIndex !== undefined) {
                const tH = target.hourly as Record<string, (number | null)[]>;
                
                HOURLY_FIELDS.forEach(field => {
                    const srcArr = (source.hourly as Record<string, number[]>)[field];
                    
                    if (Array.isArray(srcArr)) {
                         const val = srcArr[sourceIndex];
                         if (val != null && !isNaN(Number(val))) {
                             if (!tH[field]) {
                                 tH[field] = new Array(masterTimeLength).fill(null);
                             }
                             tH[field][globalIndex] = val;
                         }
                    }
                });

                // Reforç de probabilitat de pluja
                const precipArr = source.hourly.precipitation; // Ja validat com number[]
                const aromePrecip = precipArr?.[sourceIndex];
                
                if (aromePrecip != null && aromePrecip >= 0.1) {
                    if (!tH.precipitation_probability) {
                        tH.precipitation_probability = new Array(masterTimeLength).fill(0);
                    }
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