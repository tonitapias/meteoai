// src/utils/nowcastKind.ts
// Què caurà quan el radar diu que comença o s'acaba (RadarNowcastBanner): pluja, neu o totes dues.
//
// ABANS el banner sempre deia "la pluja": a la Pica d'Estats (23/11/2026, -8 °C, "Nevada moderada") deia "la pluja podria
// començar d'aquí a uns 37 min". El radar no distingeix la pluja de la neu; ho diu el cel que el motor preveu per a aquestes
// hores (daySky, els mateixos codis que la franja de la Previsió i les icones).
import type { SkyHour } from './daySky';
import { MIXED_WORD_MAX_TEMP_C, SNOW_WORD_MAX_TEMP_C, type PrecipWord } from './precipKind';

export type NowcastKind = PrecipWord;

/** Quantes hores es miren a partir de l'hora d'ara (el nowcast del radar arriba a un parell d'hores). */
const HOURS_AHEAD = 2;
/** Sense precipitació a la previsió (el radar la veu igualment), la temperatura d'ara decideix (precipKind.ts). */
const SNOW_MAX_TEMP = SNOW_WORD_MAX_TEMP_C;
const MIXED_MAX_TEMP = MIXED_WORD_MAX_TEMP_C;

const pad2 = (n: number) => String(n).padStart(2, '0');
const dateKeyOf = (d: Date) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;

/**
 * `localNow` és l'hora del lloc (calculations.shiftedNow): els seus camps locals són els del lloc, com les claus de daySky.
 */
export const nowcastPrecipKind = (
    daySky: Readonly<Record<string, ReadonlyArray<SkyHour>>> | null | undefined,
    localNow: Date | null | undefined,
    currentTemp: number | null | undefined
): NowcastKind => {
    let snow = false;
    let rain = false;
    if (daySky && localNow instanceof Date && !Number.isNaN(localNow.getTime())) {
        for (let k = 0; k <= HOURS_AHEAD; k++) {
            const at = new Date(localNow.getTime() + k * 3_600_000);
            const hour = daySky[dateKeyOf(at)]?.find(h => h.hour === at.getHours());
            if (hour?.kind === 'snow') snow = true;
            if (hour?.kind === 'rain' || hour?.kind === 'storm') rain = true;
        }
    }
    if (snow) return rain ? 'mixed' : 'snow';
    if (rain) return 'rain';
    if (typeof currentTemp === 'number' && Number.isFinite(currentTemp)) {
        if (currentTemp <= SNOW_MAX_TEMP) return 'snow';
        if (currentTemp <= MIXED_MAX_TEMP) return 'mixed';
    }
    return 'rain';
};
