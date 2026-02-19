// src/utils/weatherNormalizers.ts
import type { WeatherData } from '../types/weather';
import type { 
    ExtendedWeatherData, 
    StrictCurrentWeather, 
    StrictHourlyWeather 
} from '../types/weatherLogicTypes';

// Tipus helper intern per manipular objectes genèrics
type GenericModelData = Record<string, unknown>;

// --- FUNCIONS AUXILIARS DE NETEJA ---

/**
 * Elimina els sufixes molestos de l'API (ex: "_best_match", "_ecmwf") per tenir claus netes.
 */
const cleanKeys = (obj: Record<string, unknown>): Record<string, unknown> => {
    if (!obj) return {};
    const clean: Record<string, unknown> = {};
    Object.keys(obj).forEach(key => {
        const cleanKey = key.replace(/_meteofrance_arome_france_hd|_best_match|_ecmwf|_gfs|_icon/g, '');
        clean[cleanKey] = obj[key];
    });
    return clean;
};

// --- INJECCIÓ DE MODELS D'ALTA RESOLUCIÓ (AROME) ---

/**
 * Fusiona les dades del model base (ECMWF/Global) amb les dades d'alta resolució (AROME).
 * Prioritza AROME per a les primeres hores/dies si està disponible.
 */
export const injectHighResModels = (
    baseData: ExtendedWeatherData, 
    highResData: ExtendedWeatherData | null
): ExtendedWeatherData => {
    if (!baseData) return baseData;
    
    // Clonem l'objecte per evitar mutacions indesitjades
    const target = typeof structuredClone === 'function' 
        ? structuredClone(baseData) 
        : JSON.parse(JSON.stringify(baseData)) as ExtendedWeatherData; 
    
    if (!highResData) return target;
    
    const rawHighRes = highResData as unknown as Record<string, unknown>;
    
    // 1. Preparem la font de dades neta
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

    // Assegurem que els arrays tinguin la longitud correcta
    if (target.hourly && masterTimeLength > 0) {
        Object.keys(target.hourly).forEach(key => {
            if (key === 'time') return;
            const arr = target.hourly[key as keyof StrictHourlyWeather];
            if (Array.isArray(arr)) {
                while (arr.length < masterTimeLength) arr.push(null);
            }
        });
    }

    // 2. INJECCIÓ CURRENT (Sobreescrivim dades actuals)
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

    // 4. INJECCIÓ HOURLY (Fusionem línies de temps)
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

                // Lògica específica per reforçar la probabilitat de pluja si AROME detecta aigua
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

// --- NORMALITZACIÓ BASE ---

/**
 * Converteix la resposta "raw" de l'API (que pot tenir claus rares com "temperature_2m_best_match")
 * en una estructura estandarditzada i neta.
 */
export const normalizeModelData = (data: WeatherData): ExtendedWeatherData => {
    if (!data || !data.current) return data as unknown as ExtendedWeatherData;
    
    // Inicialitzem l'estructura base
    const result: ExtendedWeatherData = { 
        ...data, 
        current: { ...data.current }, 
        hourly: { ...data.hourly }, 
        daily: { ...data.daily }, 
        hourlyComparison: { ecmwf: [], gfs: [], icon: [] }, 
        dailyComparison: { ecmwf: {}, gfs: {}, icon: {} } 
    } as unknown as ExtendedWeatherData;
    
    // 1. Normalitzar DAILY (Gestionar comparatives)
    const rawDaily = data.daily as GenericModelData;
    Object.keys(rawDaily || {}).forEach(key => {
        if (key.includes('_best_match')) {
            const cleanKey = key.split('_best_match')[0];
            (result.daily as GenericModelData)[cleanKey] = rawDaily[key]; 
        } else {
            let model: 'ecmwf' | 'gfs' | 'icon' | null = null;
            if (key.includes('_ecmwf_')) model = 'ecmwf';
            else if (key.includes('_gfs_')) model = 'gfs';
            else if (key.includes('_icon_')) model = 'icon';

            if (model && result.dailyComparison) {
                const cleanKey = key.split(`_${model}_`)[0];
                result.dailyComparison[model][cleanKey] = rawDaily[key];
            }
        }
    });

    // 2. Normalitzar HOURLY (Gestionar comparatives array a array)
    const timeLength = result.hourly?.time?.length || 0;
    if (result.hourlyComparison) {
        ['ecmwf', 'gfs', 'icon'].forEach(m => {
            const modelKey = m as keyof typeof result.hourlyComparison; 
            if(result.hourlyComparison) {
                 result.hourlyComparison[modelKey] = Array.from({ length: timeLength }, () => ({}));
            }
        });
    }

    const rawHourly = data.hourly as Record<string, unknown[]>;
    Object.keys(rawHourly || {}).forEach(key => {
        if (key.includes('_best_match')) {
            const cleanKey = key.split('_best_match')[0];
            (result.hourly as GenericModelData)[cleanKey] = rawHourly[key];
        } else {
            let model: 'ecmwf' | 'gfs' | 'icon' | null = null;
            if (key.includes('_ecmwf_')) model = 'ecmwf';
            else if (key.includes('_gfs_')) model = 'gfs';
            else if (key.includes('_icon_')) model = 'icon';
            
            if (model && result.hourlyComparison) {
                const cleanKey = key.split(`_${model}_`)[0];
                const values = rawHourly[key];
                const targetArray = result.hourlyComparison[model];
                // Omplim les dades comparatives hora a hora
                for (let i = 0; i < Math.min(values.length, timeLength); i++) {
                    targetArray[i][cleanKey] = values[i];
                }
            }
        }
    });

    // 3. Normalitzar CURRENT
    const rawCurrent = data.current as GenericModelData;
    Object.keys(rawCurrent || {}).forEach(key => {
        if (key.includes('_best_match')) {
            const cleanKey = key.split('_best_match')[0];
            (result.current as GenericModelData)[cleanKey] = rawCurrent[key];
        }
    });

    return result;
};