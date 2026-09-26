// src/utils/tropicalRainGate.ts
// On s'aplica el FILTRE DE PLUJA TROPICAL del motor (rules/precipitationRules.applyTropicalRainGate): al tròpic i sense
// model regional, on la sèrie principal és l'ECMWF IFS 9 km i "plovisqueja" contínuament (vegeu
// WEATHER_THRESHOLDS.TROPICAL_RAIN per a la verificació). El repositori marca les hores de la sèrie combinada i el motor
// (getHourlyWeatherCode i l'"ara" de useCurrentConditions) llegeix la marca: així totes les pantalles que en treuen una
// icona apliquen el filtre igual sense haver de saber on és el punt.
import { WEATHER_THRESHOLDS } from '../constants/weatherConfig';
import { selectRegionalModel } from '../constants/regionalModels';
import type { ExtendedWeatherData } from '../types/weatherLogicTypes';
import { extractValidArrayNum } from './weatherMath';

/** Clau sintètica de `hourly` (1 = sí, null = no): l'hora passa pel filtre de pluja tropical. */
export const TROPICAL_RAIN_GATE_KEY = 'tropical_rain_gate';

/** El punt és al tròpic i fora de tots els models regionals (on n'hi ha un, el filtre no s'ha verificat). */
export const isTropicalRainGateZone = (lat: number | null | undefined, lon: number | null | undefined): boolean => {
    if (typeof lat !== 'number' || typeof lon !== 'number' || isNaN(lat) || isNaN(lon)) return false;
    if (Math.abs(lat) > WEATHER_THRESHOLDS.TROPICAL_RAIN.MAX_ABS_LATITUDE) return false;
    return selectRegionalModel(lat, lon) === null;
};

/** L'hora `idx` de la sèrie porta la marca del filtre. */
export const isTropicalRainGateHour = (hourly: Record<string, unknown> | null | undefined, idx: number): boolean =>
    extractValidArrayNum(hourly?.[TROPICAL_RAIN_GATE_KEY], idx) === 1;

/** Marca totes les hores de la sèrie si el punt és a la zona del filtre. No muta les dades d'entrada. */
export const injectTropicalRainGate = (
    data: ExtendedWeatherData,
    lat: number | null | undefined,
    lon: number | null | undefined
): ExtendedWeatherData => {
    const times = data?.hourly?.time;
    if (!Array.isArray(times) || !isTropicalRainGateZone(lat, lon)) return data;
    return {
        ...data,
        hourly: { ...data.hourly, [TROPICAL_RAIN_GATE_KEY]: times.map(() => 1) } as ExtendedWeatherData['hourly']
    };
};
