// src/utils/normData.ts
import type { WeatherData } from '../types/weather';
import type { ExtendedWeatherData } from '../types/weatherLogicTypes';

type GenericModelData = Record<string, unknown>;

export const normalizeModelData = (data: WeatherData): ExtendedWeatherData => {
    // Cast inicial per transformar l'objecte lax en l'estructura estricta
    if (!data || !data.current) return data as unknown as ExtendedWeatherData;
    
    // Creem la base copiant dades
    const result: ExtendedWeatherData = { 
        ...data, 
        current: { ...data.current }, 
        hourly: { ...data.hourly }, 
        daily: { ...data.daily }, 
        hourlyComparison: { ecmwf: [], gfs: [], icon: [] }, 
        dailyComparison: { ecmwf: {}, gfs: {}, icon: {} } 
    } as unknown as ExtendedWeatherData;
    
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
                for (let i = 0; i < Math.min(values.length, timeLength); i++) {
                    targetArray[i][cleanKey] = values[i];
                }
            }
        }
    });

    const rawCurrent = data.current as GenericModelData;
    Object.keys(rawCurrent || {}).forEach(key => {
        if (key.includes('_best_match')) {
            const cleanKey = key.split('_best_match')[0];
            (result.current as GenericModelData)[cleanKey] = rawCurrent[key];
        }
    });

    return result;
};