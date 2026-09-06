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
        hourlyComparison: { ecmwf: [], gfs: [], icon: [], aifs: [] },
        dailyComparison: { ecmwf: {}, gfs: {}, icon: {} }
    } as unknown as ExtendedWeatherData;

    const rawDaily = data.daily as GenericModelData;
    Object.keys(rawDaily || {}).forEach(key => {
        if (key.includes('_best_match')) {
            const cleanKey = key.split('_best_match')[0];
            (result.daily as GenericModelData)[cleanKey] = rawDaily[key];
        } else if (key.includes('_ecmwf_aifs025_single')) {
            // Agregats diaris d'AIFS: no s'usen enlloc (AIFS només s'injecta a
            // hourlyComparison per al meteograma) — s'ignoren explícitament aquí
            // perquè, per compartir la subcadena '_ecmwf_', no caiguin dins de
            // dailyComparison.ecmwf pel check genèric de sota.
            return;
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
        ['ecmwf', 'gfs', 'icon', 'aifs'].forEach(m => {
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
            // [FIX PRECISIÓ] L'ID d'AIFS ('ecmwf_aifs025_single') també conté la
            // subcadena '_ecmwf_' d'IFS — cal detectar-lo primer, amb el seu propi
            // sufix complet, o els seus camps es barrejarien amb els d'IFS (l'últim
            // que s'iterés sobreescriuria l'altre dins del mateix bucket 'ecmwf').
            let model: 'ecmwf' | 'aifs' | 'gfs' | 'icon' | null = null;
            let suffix = '';
            if (key.includes('_ecmwf_aifs025_single')) { model = 'aifs'; suffix = '_ecmwf_aifs025_single'; }
            else if (key.includes('_ecmwf_')) { model = 'ecmwf'; suffix = '_ecmwf_'; }
            else if (key.includes('_gfs_')) { model = 'gfs'; suffix = '_gfs_'; }
            else if (key.includes('_icon_')) { model = 'icon'; suffix = '_icon_'; }

            if (model && result.hourlyComparison) {
                const cleanKey = key.split(suffix)[0];
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