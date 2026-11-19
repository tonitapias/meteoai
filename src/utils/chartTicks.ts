// src/utils/chartTicks.ts
// Línies guia de l'eix vertical dels gràfics (els modals de detall i el giny i el modal de Temperatura): de 2 a 4
// valors "rodons" estrictament dins del rang que es dibuixa, perquè es pugui llegir una xifra sense arrossegar.
// Abans només el modal de Temperatura en tenia (temperatureDomain, amb una llista de passos pròpia); la resta de
// gràfics no tenien cap valor a l'eix.
//
// El pas és 1, 2, 2,5 o 5 × 10ⁿ: el més petit que no passa de `maxTicks` línies. El 2,5 fa que entre un pas i el
// següent no es perdin més de la meitat de les línies (de 5 a 2 com a molt); amb `integer` (xifres que es mostren
// arrodonides a l'enter, com els graus o els hPa), els passos amb decimals (0,5, 2,5...) no hi entren: un "7,5°" es
// llegiria "8°".
//
// El rang és el que decideix cada gràfic (el seu domini real): aquí no s'hi afegeix cap zero.

const MULTIPLIERS = [1, 2, 2.5, 5] as const;

export interface NiceTicksOptions {
    /** Màxim de línies (per defecte, 4). */
    maxTicks?: number;
    /** Només passos enters (per defecte, no). */
    integer?: boolean;
}

/** Treu el soroll de coma flotant (0.30000000000000004 → 0.3). */
const clean = (v: number): number => Number(v.toPrecision(12));

/** Els múltiples de `step` estrictament dins de (min, max). */
const multiplesInside = (min: number, max: number, step: number): number[] => {
    const out: number[] = [];
    for (let k = Math.floor(min / step) + 1; k * step < max; k++) {
        const v = clean(k * step);
        if (v > min && v < max) out.push(v);
    }
    return out;
};

/**
 * Línies guia rodones dins de (min, max), de petit a gran. Sense un rang vàlid (no finit, buit o al revés), cap.
 * Normalment en surten 2-4; amb un rang molt estret respecte del pas mínim (p. ex. 0,4 hPa amb `integer`), en pot
 * sortir una o cap, i el gràfic es queda sense línies abans que amb unes línies inventades.
 */
export function niceTicks(min: number, max: number, { maxTicks = 4, integer = false }: NiceTicksOptions = {}): number[] {
    if (!Number.isFinite(min) || !Number.isFinite(max) || !(max > min) || maxTicks < 1) return [];
    // Es comença un ordre de magnitud per sota del pas "just" i es puja fins que hi caben.
    let exp = Math.floor(Math.log10((max - min) / (maxTicks + 1))) - 1;
    for (let guard = 0; guard < 30; guard++, exp++) {
        for (const m of MULTIPLIERS) {
            const step = clean(m * 10 ** exp);
            if (integer && !Number.isInteger(step)) continue;
            const ticks = multiplesInside(min, max, step);
            if (ticks.length <= maxTicks) return ticks;
        }
    }
    return [];
}

/** Punt (en % de l'amplada i de l'alçada del gràfic) que porta una etiqueta pròpia, com la màxima o la mínima. */
export interface ChartLabelledPoint { x: number; y: number }

// Les etiquetes de l'eix van a la dreta (vegeu components/widgets/ChartTicks.tsx). Una etiqueta pròpia a la franja de la
// dreta (des del 78 % de l'amplada) i a menys del 14 % d'alçada d'una línia guia trepitjaria l'etiqueta d'aquesta línia
// (la de la màxima va a sota del seu punt i la de la mínima, a sobre).
const AVOID_FROM_X = 78;
const AVOID_DY = 14;

/** Si l'etiqueta d'una línia guia (a `topPct` % d'alçada) quedaria sota l'etiqueta d'algun dels punts `avoid`. */
export const tickLabelCollides = (topPct: number, avoid: ReadonlyArray<ChartLabelledPoint>): boolean =>
    avoid.some(p => p.x >= AVOID_FROM_X && Math.abs(p.y - topPct) < AVOID_DY);

/**
 * On s'ancora l'etiqueta d'un punt (la màxima, la mínima) segons on és el punt: centrada al mig i, a prop d'una vora,
 * començant o acabant al punt, cap a dins. Abans es centrava amb la x retallada: a la vora dreta l'etiqueta no hi cabia,
 * es partia en dues línies ("Màx" / "19°") i la segona trepitjava l'etiqueta de l'eix.
 */
export const pointLabelAnchor = (xPct: number): 'start' | 'center' | 'end' =>
    xPct < 15 ? 'start' : xPct > 85 ? 'end' : 'center';

/** La classe de translació de cada ancoratge (l'etiqueta va a `left: x%`). */
export const POINT_LABEL_TRANSLATE: Record<ReturnType<typeof pointLabelAnchor>, string> = {
    start: '',
    center: '-translate-x-1/2',
    end: '-translate-x-full',
};
