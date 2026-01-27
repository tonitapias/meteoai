// src/utils/aromeEngine.ts
import { ExtendedWeatherData, StrictHourlyWeather, StrictCurrentWeather } from '../types/weatherLogicTypes';

// Definició de tipus auxiliar per a les dades netejades
interface CleanedSource {
    current: Record<string, unknown>;
    hourly: Record<string, unknown> & { time?: unknown[] };
    minutely_15?: Record<string, unknown>;
}

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

// --- NOVA FUNCIÓ DE SEGURETAT (ACTUALITZADA PAS 2) ---
// Normalitza qualsevol format de data a un Timestamp numèric (ms) alineat a l'hora.
const normalizeTime = (t: unknown): number => {
    if (!t) return 0;
    const date = new Date(String(t));
    if (isNaN(date.getTime())) return 0;

    // MILLORA CRÍTICA: Forcem l'alineació a l'inici de l'hora (XX:00:00)
    // Això evita que petites desviacions de segons entre models (OpenMeteo vs Arome)
    // creïn entrades duplicades o desalineades a les gràfiques.
    date.setMinutes(0, 0, 0); 
    
    return date.getTime();
};

export const injectHighResModels = (baseData: ExtendedWeatherData, highResData: ExtendedWeatherData | null): ExtendedWeatherData => {
    if (!baseData) return baseData;
    if (!highResData) return baseData;

    // --- OPTIMITZACIÓ: Còpia Manual Superficial (Shallow Copy) ---
    // En lloc de clonar-ho tot amb structuredClone (lent), copiem només el que mutarem.
    // Això millora dràsticament el rendiment en dispositius mòbils.
    
    const target: ExtendedWeatherData = { ...baseData };

    // 1. Preparem 'current' per ser mutable
    if (baseData.current) {
        target.current = { ...baseData.current };
    }

    // 2. Preparem 'hourly' i els seus arrays per ser mutables
    if (baseData.hourly) {
        target.hourly = { ...baseData.hourly };
        // Important: Els arrays interns també s'han de clonar si els modifiquem
        Object.keys(target.hourly).forEach((k) => {
            const key = k as keyof StrictHourlyWeather;
            const val = target.hourly![key];
            if (Array.isArray(val)) {
                // @ts-expect-error - Sabem que és un array, fem còpia segura
                target.hourly![key] = [...val];
            }
        });
    }

    // 1. PREPARACIÓ DE FONTS (Sense càstings 'unknown')
    const source: CleanedSource = {
        current: cleanKeys(highResData.current as Record<string, unknown>),
        hourly: {
            ...cleanKeys(highResData.hourly as Record<string, unknown>),
            time: highResData.hourly?.time 
        },
        minutely_15: highResData.minutely_15 
            ? cleanKeys(highResData.minutely_15 as Record<string, unknown>) 
            : undefined
    };

    const masterTimeLength = target.hourly?.time?.length || 0;

    // Assegurar estructura del target (emplenar buits si cal)
    if (target.hourly && masterTimeLength > 0) {
        (Object.keys(target.hourly) as Array<keyof StrictHourlyWeather>).forEach(key => {
            if (key === 'time') return;
            const arr = target.hourly![key];
            // Si l'array existeix però és curt, l'omplim amb nulls
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
             const val = source.current[k];
             if (val != null && !isNaN(Number(val))) {
                 targetCurrent[k] = val;
             }
        });
        target.current.source = 'AROME HD'; 
    }

    // 3. INJECCIÓ MINUTELY_15 (Alta resolució de pluja)
    if (source.minutely_15) {
        const srcMin = source.minutely_15;
        if (Array.isArray(srcMin.time) && Array.isArray(srcMin.precipitation)) {
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
        
        // Creem el mapa d'índexs base normalitzats
        target.hourly.time.forEach((t, i) => {
            globalTimeIndexMap.set(normalizeTime(t), i);
        });

        const sourceTimes = (source.hourly.time || highResData.hourly?.time || []) as string[];

        sourceTimes.forEach((timeValue, sourceIndex) => {
            // Normalitzem també l'hora d'origen per buscar la coincidència exacta
            const timeKey = normalizeTime(timeValue);
            const globalIndex = globalTimeIndexMap.get(timeKey);
            
            if (globalIndex !== undefined) {
                const tH = target.hourly as Record<string, (number | null)[]>;
                
                HOURLY_FIELDS.forEach(field => {
                    const srcArr = source.hourly[field] as number[] | undefined;
                    
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

                // Lògica de negoci: Reforç de probabilitat de pluja
                const precipArr = source.hourly.precipitation as number[] | undefined;
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