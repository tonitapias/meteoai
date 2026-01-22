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

export const injectHighResModels = (baseData: ExtendedWeatherData, highResData: ExtendedWeatherData | null): ExtendedWeatherData => {
    if (!baseData) return baseData;
    
    // Deep clone segur per evitar mutacions no desitjades a l'estat original
    const target = typeof structuredClone === 'function' 
        ? structuredClone(baseData) 
        : JSON.parse(JSON.stringify(baseData)) as ExtendedWeatherData; 
    
    if (!highResData) return target;
    
    // 1. PREPARACIÓ DE FONTS (Sense càstings 'unknown')
    // Tractem les dades d'entrada com a registres genèrics per poder netejar-ne les claus
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
            const arr = target.hourly[key];
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
             // Només sobreescrivim si el valor és vàlid numèricament
             if (val != null && !isNaN(Number(val))) {
                 targetCurrent[k] = val;
             }
        });
        target.current.source = 'AROME HD'; 
    }

    // 3. INJECCIÓ MINUTELY_15 (Alta resolució de pluja)
    if (source.minutely_15) {
        const srcMin = source.minutely_15;
        // Verificació estructural bàsica abans d'assignar
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
        // Mapeig de temps per sincronitzar els dos models
        const globalTimeIndexMap = new Map<string, number>();
        target.hourly.time.forEach((t, i) => globalTimeIndexMap.set(t, i));

        const sourceTimes = (source.hourly.time || highResData.hourly?.time || []) as string[];

        sourceTimes.forEach((timeValue, sourceIndex) => {
            const globalIndex = globalTimeIndexMap.get(timeValue);
            
            // Si trobem coincidència horària, injectem les dades AROME
            if (globalIndex !== undefined) {
                const tH = target.hourly as Record<string, (number | null)[]>;
                
                HOURLY_FIELDS.forEach(field => {
                    const srcArr = source.hourly[field] as number[] | undefined;
                    
                    if (Array.isArray(srcArr)) {
                         const val = srcArr[sourceIndex];
                         if (val != null && !isNaN(Number(val))) {
                             // Si el camp no existeix al target, el creem
                             if (!tH[field]) {
                                 tH[field] = new Array(masterTimeLength).fill(null);
                             }
                             // Sobreescrivim la dada a l'índex correcte
                             tH[field][globalIndex] = val;
                         }
                    }
                });

                // Lògica de negoci: Reforç de probabilitat de pluja
                // Si AROME veu pluja (>0.1mm), pugem la probabilitat mínima al 70%
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