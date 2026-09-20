// src/utils/temperatureColors.ts
// MOTOR DE COLOR ABSOLUT (Spatial UI Tàctic): cada temperatura té sempre el mateix color, sigui quina sigui
// la setmana. Abans vivia dins TrendChartModal, on la càpsula d'un dia era un degradat lineal entre el color
// de la màxima i el de la mínima: al mig barrejava tons que no són de la paleta (p. ex. taronja -> llima
// donava un marró) i el color d'una alçada concreta no corresponia a la seva temperatura.

interface Band {
    /** Límit superior de la banda (inclòs), en °C. */
    upTo: number;
    color: string;
    /** Temperatura representativa de la banda: el degradat hi passa pel color net. */
    center: number;
}

const BANDS: ReadonlyArray<Band> = [
    { upTo: -5, color: '#3b82f6', center: -10 },   // Blau profund (Glaç)
    { upTo: 5, color: '#06b6d4', center: 0 },      // Cian (Molt fred)
    { upTo: 12, color: '#10b981', center: 8.5 },   // Maragda (Fresc)
    { upTo: 20, color: '#a3e635', center: 16 },    // Llima (Suau)
    { upTo: 26, color: '#fbbf24', center: 23 },    // Ambre (Càlid)
    { upTo: 32, color: '#f97316', center: 29 },    // Taronja (Molt càlid)
    { upTo: Infinity, color: '#ef4444', center: 36 } // Vermell (Calor extrema)
];

export const getAbsoluteColor = (temp: number): string =>
    (BANDS.find(b => temp <= b.upTo) ?? BANDS[BANDS.length - 1]).color;

/**
 * Degradat vertical (de dalt a baix) d'una càpsula que va de `max` a `min`: comença amb el color de la
 * màxima, acaba amb el de la mínima i passa pel color net de cada banda de la paleta que hi ha entremig.
 */
export const buildCapsuleGradient = (max: number, min: number): string => {
    const top = getAbsoluteColor(max);
    const bottom = getAbsoluteColor(min);
    if (!(max > min)) return top;

    const stops = [`${top} 0%`];
    // Les bandes van de fred a calor; el degradat va de calor (dalt) a fred (baix).
    for (const band of [...BANDS].reverse()) {
        if (band.center < max && band.center > min) {
            const pct = ((max - band.center) / (max - min)) * 100;
            stops.push(`${band.color} ${Number(pct.toFixed(2))}%`);
        }
    }
    stops.push(`${bottom} 100%`);
    return `linear-gradient(to bottom, ${stops.join(', ')})`;
};
