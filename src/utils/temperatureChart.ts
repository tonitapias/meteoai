// src/utils/temperatureChart.ts
// Geometria compartida pels dos gràfics de temperatura (el del giny i el del modal): domini i línies guia "rodones",
// el degradat del traç amb la paleta absoluta de temperatures (temperatureColors.ts: cada grau té sempre el mateix
// color), els traços amb els forats tallats, les franges de nit i els canvis de dia. Coordenades en un viewBox de
// 0-100 d'ample; l'alçada (i on comença i acaba la zona útil) la decideix cada gràfic.
import { getAbsoluteColor } from './temperatureColors';
import { niceTicks } from './chartTicks';
import type { TemperaturePoint } from './temperatureDetail';

/** Centre de cada banda de la paleta (vegeu BANDS a temperatureColors.ts): el degradat hi passa pel color net. */
const BAND_CENTERS = [-10, 0, 8.5, 16, 23, 29, 36] as const;

/** Per sota d'aquí (°C), el valor més baix de la finestra és prou a prop de 0 °C per dibuixar-ne la isoterma. */
export const FREEZING_LINE_NEAR_C = 2;

export interface TemperatureDomain {
    min: number;
    max: number;
    /** El valor més baix i el més alt de les dades (sense el marge). */
    dataMin: number;
    dataMax: number;
    /** Línies guia (°C), múltiples d'un pas rodó, estrictament dins del domini. */
    ticks: number[];
    /** Si cal la línia de 0 °C: les dades s'hi acosten i hi cap. */
    showFreezing: boolean;
}

/**
 * Domini (°C) que inclou totes les temperatures i sensacions de la finestra amb un marge (sense arrodonir-lo a un pas:
 * un domini "rodó" deixava mig gràfic buit), i les línies guia a un pas rodó perquè n'hi càpiguen 2-4 (niceTicks).
 * Sense cap valor, null.
 */
export const temperatureDomain = (points: ReadonlyArray<TemperaturePoint>, includeFeels = true): TemperatureDomain | null => {
    const values: number[] = [];
    points.forEach(p => {
        if (p.temp !== null) values.push(p.temp);
        if (includeFeels && p.feels !== null) values.push(p.feels);
    });
    if (values.length === 0) return null;
    const lo = Math.min(...values);
    const hi = Math.max(...values);
    const pad = Math.max(1, (hi - lo) * 0.12);
    // A prop de 0 °C, el domini baixa fins a incloure la isoterma: és la referència que importa (gelada o no).
    const nearFreezing = lo <= FREEZING_LINE_NEAR_C;
    const min = nearFreezing ? Math.min(lo - pad, -Math.max(0.5, pad / 2)) : lo - pad;
    const max = hi + pad;
    // Les línies guia, amb el mateix criteri que la resta de gràfics (utils/chartTicks.ts); enteres: "7,5°" es llegiria "8°".
    const ticks = niceTicks(min, max, { integer: true });
    return { min, max, dataMin: lo, dataMax: hi, ticks, showFreezing: nearFreezing && max > 0 };
};

/** y (0 = dalt) d'una temperatura dins la zona útil [top, bottom] del viewBox. */
export const makeYScale = (domain: TemperatureDomain, top: number, bottom: number) =>
    (celsius: number): number => {
        const range = domain.max - domain.min || 1;
        const clamped = Math.max(domain.min, Math.min(domain.max, celsius));
        return bottom - ((clamped - domain.min) / range) * (bottom - top);
    };

/** x (0-100) de la posició i d'una finestra de n punts. */
export const makeXScale = (n: number) => (i: number): number => (n > 1 ? (i / (n - 1)) * 100 : 0);

/**
 * Parades d'un degradat vertical (userSpaceOnUse, de y = top a y = bottom) perquè cada alçada del traç tingui el
 * color de la seva temperatura: el color de dalt, el centre de cada banda que hi cap i el color de baix.
 */
export const temperatureGradientStops = (domain: TemperatureDomain): { offset: number; color: string }[] => {
    const range = domain.max - domain.min || 1;
    const offsetOf = (c: number) => Number(((domain.max - c) / range).toFixed(4));
    const stops = [{ offset: 0, color: getAbsoluteColor(domain.max) }];
    [...BAND_CENTERS].reverse().forEach(c => {
        if (c < domain.max && c > domain.min) stops.push({ offset: offsetOf(c), color: getAbsoluteColor(c) });
    });
    stops.push({ offset: 1, color: getAbsoluteColor(domain.min) });
    return stops;
};

type XY = { x: number; y: number };

/** Trams continus d'una sèrie: una hora sense dada talla la línia (no s'inventa el tros que falta). */
export const segmentsOf = (
    points: ReadonlyArray<TemperaturePoint>,
    key: 'temp' | 'feels',
    xOf: (i: number) => number,
    yOf: (c: number) => number
): XY[][] => {
    const segments: XY[][] = [];
    let current: XY[] = [];
    points.forEach((p, i) => {
        const v = p[key];
        if (v === null) {
            if (current.length) segments.push(current);
            current = [];
            return;
        }
        current.push({ x: xOf(i), y: yOf(v) });
    });
    if (current.length) segments.push(current);
    return segments;
};

const fmt = (n: number) => n.toFixed(2);

export const linePathOf = (segments: ReadonlyArray<ReadonlyArray<XY>>): string =>
    segments.map(seg => seg.map((p, i) => `${i === 0 ? 'M' : 'L'}${fmt(p.x)},${fmt(p.y)}`).join(' ')).join(' ');

/** Àrea sota cada tram fins a `bottom` (un tram d'un sol punt no fa àrea). */
export const areaPathOf = (segments: ReadonlyArray<ReadonlyArray<XY>>, bottom: number): string =>
    segments
        .filter(seg => seg.length > 1)
        .map(seg => `M${fmt(seg[0].x)},${bottom} ${seg.map(p => `L${fmt(p.x)},${fmt(p.y)}`).join(' ')} L${fmt(seg[seg.length - 1].x)},${bottom} Z`)
        .join(' ');

/** Franges de nit [x1, x2] (cada hora de nit ocupa mitja hora a banda i banda del seu punt). */
export const nightBandsOf = (points: ReadonlyArray<TemperaturePoint>, xOf: (i: number) => number): { x1: number; x2: number }[] => {
    const n = points.length;
    if (n < 2) return [];
    const half = (xOf(1) - xOf(0)) / 2;
    const bands: { x1: number; x2: number }[] = [];
    let start: number | null = null;
    points.forEach((p, i) => {
        if (!p.isDay && start === null) start = i;
        const endsHere = start !== null && (i === n - 1 || points[i + 1].isDay);
        if (endsHere && start !== null) {
            bands.push({ x1: Math.max(0, xOf(start) - half), x2: Math.min(100, xOf(i) + half) });
            start = null;
        }
    });
    return bands;
};

/** Canvis de dia (mitjanit) dins la finestra, amb l'etiqueta "dd/mm". */
export const dayChangesOf = (points: ReadonlyArray<TemperaturePoint>, xOf: (i: number) => number): { x: number; label: string }[] => {
    const marks: { x: number; label: string }[] = [];
    let prevDay = points[0]?.time.slice(8, 10) ?? '';
    points.forEach((p, i) => {
        const day = p.time.slice(8, 10);
        if (i > 0 && day && day !== prevDay) marks.push({ x: xOf(i), label: `${day}/${p.time.slice(5, 7)}` });
        prevDay = day;
    });
    return marks;
};
