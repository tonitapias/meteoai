// src/utils/rules/shearRules.ts
// Cisallament del vent en capa profunda per al modal de tempesta: com s'ORGANITZARIA una tempesta si n'hi ha (vegeu
// WEATHER_THRESHOLDS.SHEAR per als llindars i els seus límits). No toca cap icona ni el risc: només informa.
import { WEATHER_THRESHOLDS } from '../../constants/weatherConfig';
import type { ExtendedWeatherData } from '../../types/weatherLogicTypes';
import { extractValidNum } from '../weatherMath';

const { SHEAR } = WEATHER_THRESHOLDS;

export type ShearClass = 'weak' | 'moderate' | 'strong';

/** Components (u, v) d'un vent donat com a velocitat i direcció meteorològica (d'on bufa, en graus). */
const toUV = (speed: number, directionDeg: number): [number, number] => {
    const rad = (directionDeg * Math.PI) / 180;
    return [-speed * Math.sin(rad), -speed * Math.cos(rad)];
};

/** Mòdul de la diferència vectorial entre el vent de dalt i el de baix (mateixa unitat que les velocitats). */
export const bulkShear = (lowSpeed: number, lowDir: number, highSpeed: number, highDir: number): number => {
    const [u0, v0] = toUV(lowSpeed, lowDir);
    const [u1, v1] = toUV(highSpeed, highDir);
    return Math.hypot(u1 - u0, v1 - v0);
};

export const classifyShear = (kmh: number): ShearClass =>
    kmh >= SHEAR.STRONG ? 'strong' : kmh >= SHEAR.MODERATE ? 'moderate' : 'weak';

// Ordre de preferència. Els dos vents surten sempre del MATEIX model: el de 10 m de la sèrie principal pot ser el del
// model regional (AROME...), que no publica el de 500 hPa, i barrejar-los donaria un cisallament de dos models.
const MODELS = ['ecmwf', 'gfs', 'icon'] as const;

/** Cisallament (km/h) d'una hora amb el primer model que porti els quatre valors, o null si cap no els porta. */
export const getBulkShearKmh = (
    comparison: ExtendedWeatherData['hourlyComparison'] | null | undefined,
    idx: number
): number | null => {
    for (const model of MODELS) {
        const row = comparison?.[model]?.[idx];
        if (!row) continue;
        const s0 = extractValidNum(row.wind_speed_10m);
        const d0 = extractValidNum(row.wind_direction_10m);
        const s1 = extractValidNum(row.wind_speed_500hPa);
        const d1 = extractValidNum(row.wind_direction_500hPa);
        if (s0 === null || d0 === null || s1 === null || d1 === null) continue;
        return bulkShear(s0, d0, s1, d1);
    }
    return null;
};
