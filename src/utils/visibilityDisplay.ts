// src/utils/visibilityDisplay.ts
// Visibilitat que ES MOSTRA (VisibilityWidget i VisibilityModal), alineada amb la política de
// boira de la resta de l'app (visibilityRules.resolveFog): una hora és "boira" per al giny si i
// només si la icona/la IA la marquen com a boira.
//
// El número crua ve d'ICON (AROME HD no publica visibility) i no es pot creure sense més: contra
// 12.080 hores de METAR (12 nov–29 des 2025, 11 aeroports de la zona AROME), quan ICON diu < 1 km
// però la saturació de superfície no ho confirma, la visibilitat REAL va tenir mediana de 9 km i
// només un 7 % de boira (<1 km). Pintar "0,8 km · Boira" allà és desinformar — i contradiu la
// icona i la IA, que ja no marquen boira. A l'inrevés, el 16 % de les hores amb boira confirmada
// tenen visibilitat d'ICON >= 2 km, i el giny hi diria "Calitja" amb la icona de boira.
//
// No s'inventa cap xifra: es fixa un límit i es marca amb `bound` perquè la UI mostri "≥" / "≤".
import { WEATHER_THRESHOLDS } from '../constants/weatherConfig';

const { VISIBILITY, PRECIPITATION } = WEATHER_THRESHOLDS;

/** 'min': el valor real és >= meters ("≥") · 'max': és <= meters ("≤") · null: valor del model tal qual. */
export type VisibilityBound = 'min' | 'max' | null;

export interface DisplayVisibility {
    meters: number | null;
    bound: VisibilityBound;
}

/**
 * @param rawVisibility visibilitat del model (m) o null si no n'hi ha
 * @param weatherCode   codi de temps FINAL de la mateixa hora/moment (el que passa per la política de
 *                      boira: getHourlyWeatherCode / effectiveWeatherCode). 45/48 = boira confirmada.
 * @param precipAmount  precipitació (mm) — amb pluja/neu, una visibilitat baixa és física, no boira
 *                      (ICON ja la ha calculada tenint-la en compte), així que no es toca.
 */
export const resolveDisplayVisibility = (
    rawVisibility: number | null | undefined,
    weatherCode: number | null | undefined,
    precipAmount: number
): DisplayVisibility => {
    if (typeof rawVisibility !== 'number' || isNaN(rawVisibility)) return { meters: null, bound: null };

    const isFog = weatherCode === 45 || weatherCode === 48;

    if (isFog) {
        // Boira confirmada: per definició visibilitat <= 1 km. Només es corregeix si el model era més optimista.
        return rawVisibility >= VISIBILITY.FOG
            ? { meters: VISIBILITY.POOR, bound: 'max' }
            : { meters: rawVisibility, bound: null };
    }

    // Sense boira confirmada (i sense pluja): la visibilitat no baixa de la banda de boira.
    if (rawVisibility < VISIBILITY.FOG && precipAmount < PRECIPITATION.TRACE) {
        return { meters: VISIBILITY.FOG, bound: 'min' };
    }

    return { meters: rawVisibility, bound: null };
};

/**
 * Valor "ara" del bloc `current` — UNA sola resolució compartida pel giny i pel modal (un modal de
 * detall ha de llegir exactament la mateixa font "ara" que el giny des d'on s'obre).
 */
export const resolveCurrentDisplayVisibility = (
    current: { visibility?: unknown; precipitation?: unknown } | null | undefined,
    effectiveCode: number | null | undefined
): DisplayVisibility => {
    const raw = typeof current?.visibility === 'number' ? current.visibility : null;
    const precip = typeof current?.precipitation === 'number' && !isNaN(current.precipitation) ? current.precipitation : 0;
    return resolveDisplayVisibility(raw, effectiveCode, precip);
};

/** "2", "0.8" — km amb un decimal sense ".0". Amb límit: "≥2" / "≤1". */
export const formatVisibilityKm = (meters: number | null, bound: VisibilityBound = null): string => {
    if (meters === null) return '--';
    const km = (meters / 1000).toFixed(1).replace('.0', '');
    return `${bound === 'min' ? '≥' : bound === 'max' ? '≤' : ''}${km}`;
};
