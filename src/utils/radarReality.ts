// src/utils/radarReality.ts
//
// Les decisions de l'avís "el radar veu pluja que la previsió no té" (RadarRealityBanner, useRadarRealityCheck):
// quan avisar, com de forta és la pluja, si és un ruixat aïllat o una zona àmplia i si la previsió l'esperava una
// mica més tard (la pluja s'ha avançat) o gens.
import { WEATHER_THRESHOLDS } from '../constants/weatherConfig';

// Llindars conservadors: només avisem quan el radar detecta un eco clar (per sobre del soroll de fons) i el model
// prediu pràcticament zero. Evita falsos positius per petites diferències residuals entre fonts.
export const RADAR_MM_H_THRESHOLD = 0.5;
export const MODEL_MM_H_THRESHOLD = 0.2;

/** Radi on es mira si la pluja és un ruixat aïllat o una zona àmplia. */
export const RAIN_EXTENT_RADIUS_KM = 10;
/** Per sota d'aquesta fracció del cercle amb pluja, és un ruixat aïllat; a partir de la segona, una zona àmplia. */
const LOCAL_MAX_FRACTION = 0.3;
const WIDE_MIN_FRACTION = 0.6;

/** Hores de previsió (després de l'actual) on es busca la pluja que s'hauria avançat. */
export const RAIN_LOOKAHEAD_HOURS = 3;

export type RadarRainIntensity = 'light' | 'moderate' | 'heavy';
export type RainExtent = 'local' | 'wide';

/** Amb els mateixos llindars que el codi del temps (precipitationRules: forta per sobre de 4 mm/h, moderada des d'1,5). */
export const radarRainIntensity = (mmPerHour: number): RadarRainIntensity => {
    const { MODERATE, HEAVY } = WEATHER_THRESHOLDS.PRECIPITATION;
    if (mmPerHour > HEAVY) return 'heavy';
    if (mmPerHour >= MODERATE) return 'moderate';
    return 'light';
};

/** Null entre els dos llindars (o sense dada): no diem res de l'extensió. */
export const rainExtent = (rainFraction: number | null): RainExtent | null => {
    if (rainFraction === null) return null;
    if (rainFraction < LOCAL_MAX_FRACTION) return 'local';
    if (rainFraction >= WIDE_MIN_FRACTION) return 'wide';
    return null;
};

/**
 * La primera de les properes RAIN_LOOKAHEAD_HOURS hores en què la previsió porta pluja ("01:00"), o null. `hours` és
 * la sèrie horària de l'app a partir de l'hora actual (chartData24h: la primera és "ara", com a l'evolució horària),
 * amb l'hora local del lloc al text; la pluja de cada hora en mm (= mm/h).
 */
export const firstForecastRainHour = (
    hours: ReadonlyArray<{ time: string; precip: number | null }> | null | undefined
): string | null => {
    const next = hours?.slice(1, 1 + RAIN_LOOKAHEAD_HOURS) ?? [];
    const hit = next.find((h) => typeof h.precip === 'number' && h.precip >= MODEL_MM_H_THRESHOLD);
    return hit && hit.time.length >= 16 ? hit.time.slice(11, 16) : null;
};
