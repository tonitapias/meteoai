// src/utils/rules/aerosolRules.ts
// Avís de pols en suspensió / partícules a partir de les dades d'aerosols del CAMS.
//
// És un AVÍS D'AEROSOLS, no una previsió de visibilitat: vegeu WEATHER_THRESHOLDS.AEROSOL per a la
// verificació contra METAR. La visibilitat del model no veu la calitja d'aerosols i la pols del CAMS
// només prediu fluixament la visibilitat observada; el que sí que diu bé és que hi ha molta pols a l'aire.
import { WEATHER_THRESHOLDS } from '../../constants/weatherConfig';
import { extractValidNum } from '../weatherMath';

const { AEROSOL, PRECIPITATION } = WEATHER_THRESHOLDS;

/** 'dust': pols (calima); 'particles': PM10 alt sense pols identificada (fum, contaminació...). */
export type DustKind = 'dust' | 'particles' | null;

export interface DustAdvisory {
    kind: DustKind;
    /** µg/m³ (CAMS); null si no n'hi ha dada. Es guarden per poder mostrar la xifra que ha disparat l'avís. */
    dust: number | null;
    pm10: number | null;
}

/**
 * @param aqiCurrent bloc `current` de l'API de Qualitat de l'Aire (només se'n llegeixen `dust` i `pm10`)
 * @param humidity   HR (%) del mateix moment: l'avís només compta amb aire sec (< AEROSOL.MAX_HUMIDITY).
 *                   Sense HR no es pot validar i no s'avisa (mai un avís sobre una dada absent).
 * @param precipAmount precipitació (mm): la pluja renta l'aire. Sense dada es compta com a "no plou":
 *                   l'avís es fonamenta en el CAMS, no en la pluja.
 */
export const resolveDustAdvisory = (
    aqiCurrent: Record<string, unknown> | null | undefined,
    humidity: number | null | undefined,
    precipAmount: number | null | undefined
): DustAdvisory => {
    const dust = extractValidNum(aqiCurrent?.dust);
    const pm10 = extractValidNum(aqiCurrent?.pm10);
    const rh = extractValidNum(humidity);
    const precip = extractValidNum(precipAmount) ?? 0;

    const none: DustAdvisory = { kind: null, dust, pm10 };
    if (rh === null || rh >= AEROSOL.MAX_HUMIDITY) return none;
    if (precip >= PRECIPITATION.TRACE) return none;

    if (dust !== null && dust >= AEROSOL.DUST_MIN) return { kind: 'dust', dust, pm10 };
    if (pm10 !== null && pm10 >= AEROSOL.PM10_MIN) return { kind: 'particles', dust, pm10 };
    return none;
};
