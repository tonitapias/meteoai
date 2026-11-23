// src/utils/precipKind.ts
// Pluja en mm, neu en cm: la regla única que decideix en quina unitat surt una quantitat de precipitació a tota l'app
// (llista de 7 dies, gràfic de tendència, tira de 24 h, detall del dia, gràfic de les pròximes 24 h, AROME contra el global,
// previsió immediata, modal del model regional i el resum que rep la IA).
//
// ABANS: només es deia "cm" a partir de 0,2 cm de neu, sense mirar la pluja. Al Pas de la Casa (23/11/2026), en plena
// "Nevada feble", la tira de 24 h deia "0,1 mm" i el detall "neu, 0,2 mm"; i un dia de 20 mm de pluja amb 0,3 cm de neu
// a la nit hauria sortit com a "0,3 cm".
// ARA: mana el que cau més. La neu es compara en aigua (7 cm de neu = 10 mm d'aigua, la relació d'Open-Meteo i del motor,
// vegeu engineSnowfall.ts): si la seva aigua és almenys la meitat del total, la xifra és de neu (cm); si no, de pluja (mm).
//
// Fulla sense dependències a propòsit: la fan servir formatters.ts i engineSnowfall.ts.

/** cm de neu per mm d'aigua: la relació que fa servir Open-Meteo per al seu `snowfall` (7 cm = 10 mm). */
export const SNOW_CM_PER_MM = 0.7;

export type PrecipKind = 'rain' | 'snow';

const amountOf = (v: number | null | undefined): number => (typeof v === 'number' && Number.isFinite(v) && v > 0 ? v : 0);

/**
 * De què és una quantitat: `precipMm` és la precipitació total (mm d'aigua, neu inclosa) i `snowCm` la neu (cm).
 * null si no en cau res.
 */
export const precipKind = (precipMm: number | null | undefined, snowCm: number | null | undefined): PrecipKind | null => {
    const total = amountOf(precipMm);
    const snow = amountOf(snowCm);
    if (total === 0 && snow === 0) return null;
    if (snow === 0) return 'rain';
    const snowWater = snow / SNOW_CM_PER_MM;
    const rainWater = Math.max(0, total - snowWater);
    return snowWater >= rainWater ? 'snow' : 'rain';
};

/** cm de neu d'una quantitat d'aigua que se sap que és neu (mm × 0,7). */
export const snowCmFromWater = (mm: number): number => mm * SNOW_CM_PER_MM;
