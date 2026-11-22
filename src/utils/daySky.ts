// src/utils/daySky.ts
// La "franja del cel" de la previsió setmanal (ForecastSection): el cel de cada hora d'un dia, de 00 a 24 h, en una
// barra de colors (sol, clarianes, núvol, boira, pluja, neu, tempesta, i la variant de nit de cadascun).
//
// Surt dels MATEIXOS codis del motor que trien la icona del dia i l'evolució horària (getHourCodesByDate): la franja
// no pot dir "pluja" a una hora que el motor ha filtrat. El dia o la nit és l'`is_day` de l'API (resolveIsDay).
import { resolveIsDay, type HourlySeries } from './hourlyWeatherCode';
import { isFreezingPrecipCode, isSleetCode, isSnowCode } from './rules/winterRules';

export type SkyKind = 'clear' | 'partly' | 'cloudy' | 'fog' | 'rain' | 'snow' | 'storm';

/** Una hora de la franja. `kind` null = hora sense codi (sense temperatura real): la franja hi deixa el fons. */
export interface SkyHour {
    /** Hora local, 0-23 (de la data de la sèrie, no de l'índex: un dia de canvi d'hora no en té 24). */
    hour: number;
    kind: SkyKind | null;
    isDay: boolean;
}

/** Colors de la franja, de dia i de nit. Són els tons del cel de l'app (columna del cel, «Cel viu»), apagats de nit. */
export const SKY_COLORS: Record<SkyKind, { day: string; night: string }> = {
    clear: { day: '#e9b949', night: '#1c2542' },
    partly: { day: '#b39d6a', night: '#2a3349' },
    cloudy: { day: '#687387', night: '#3a4356' },
    fog: { day: '#8d96a6', night: '#4a5263' },
    rain: { day: '#3b82f6', night: '#2f62c9' },
    snow: { day: '#e2e8f0', night: '#9aa6b8' },
    storm: { day: '#a855f7', night: '#7c3aed' },
};

const PRECIP_KINDS: ReadonlySet<SkyKind> = new Set(['rain', 'snow', 'storm']);

/**
 * Tipus de cel d'un codi WMO del motor. L'aiguaneu compta com a neu (és el que cal veure d'un cop d'ull) i el plugim
 * i la pluja engelant, com a pluja. null si no hi ha codi.
 */
export const skyKindOfCode = (code: number | null | undefined): SkyKind | null => {
    if (typeof code !== 'number' || Number.isNaN(code)) return null;
    if (code >= 95) return 'storm';
    if (isSnowCode(code) || isSleetCode(code)) return 'snow';
    if ((code >= 51 && code <= 67) || (code >= 80 && code <= 82) || isFreezingPrecipCode(code)) return 'rain';
    if (code === 45 || code === 48) return 'fog';
    if (code === 3) return 'cloudy';
    if (code === 2) return 'partly';
    if (code === 0 || code === 1) return 'clear';
    return null;
};

/**
 * La franja de cada dia de la sèrie ("YYYY-MM-DD" → hores). `codesByDate` és el de getHourCodesByDate (calculations.dayHourCodes):
 * les hores de cada data hi van en el mateix ordre que a `hourly.time`.
 */
export const buildDaySky = (
    hourly: HourlySeries | null | undefined,
    codesByDate: Record<string, ReadonlyArray<number | null>> | null | undefined
): Record<string, SkyHour[]> => {
    const out: Record<string, SkyHour[]> = {};
    const times: unknown = hourly?.time;
    if (!hourly || !Array.isArray(times)) return out;

    const seen: Record<string, number> = {};
    for (let i = 0; i < times.length; i++) {
        const t: unknown = times[i];
        if (typeof t !== 'string' || t.length < 13) continue;
        const date = t.slice(0, 10);
        const hour = Number.parseInt(t.slice(11, 13), 10);
        if (!Number.isFinite(hour)) continue;
        const nth = seen[date] ?? 0;
        seen[date] = nth + 1;
        if (!out[date]) out[date] = [];
        out[date].push({
            hour,
            kind: skyKindOfCode(codesByDate?.[date]?.[nth]),
            // Sense is_day de l'API (no hauria de passar: es demana sempre), una aproximació de dia de 7 a 19 h.
            isDay: resolveIsDay(hourly, i, () => hour >= 7 && hour < 19),
        });
    }
    return out;
};

const colorOf = (h: SkyHour): string | null => (h.kind ? SKY_COLORS[h.kind][h.isDay ? 'day' : 'night'] : null);

/**
 * Imatge de fons CSS de la franja: un degradat amb talls nets, una franja de 1/24 per hora a la seva posició (les hores
 * que falten i les que no tenen codi queden transparents i hi surt el fons de la pista). Les hores seguides del mateix
 * color es fusionen. 'none' si el dia no té cap hora.
 */
export const skyStripBackground = (hours: ReadonlyArray<SkyHour>): string => {
    const step = 100 / 24;
    const pct = (v: number) => `${Number((v * step).toFixed(3))}%`;
    const runs: Array<{ color: string; from: number; to: number }> = [];
    const sorted = [...hours].sort((a, b) => a.hour - b.hour);
    for (const h of sorted) {
        const color = colorOf(h) ?? 'transparent';
        const last = runs[runs.length - 1];
        if (last && last.color === color && last.to === h.hour) last.to = h.hour + 1;
        else runs.push({ color, from: h.hour, to: h.hour + 1 });
    }
    if (runs.length === 0) return 'none';
    const stops = runs.map(r => `${r.color} ${pct(r.from)} ${pct(r.to)}`);
    return `linear-gradient(90deg, ${stops.join(', ')})`;
};

/**
 * On cau la precipitació del dia: el tram d'hores seguides de pluja, neu o tempesta més llarg (el primer, si n'hi ha
 * d'iguals). Retorna el centre en fracció del dia (0-1), o null si cap hora en té.
 */
export const mainPrecipCenter = (hours: ReadonlyArray<SkyHour>): number | null => {
    const precipHours = hours
        .filter(h => h.kind !== null && PRECIP_KINDS.has(h.kind))
        .map(h => h.hour)
        .sort((a, b) => a - b);
    if (precipHours.length === 0) return null;
    let best = { from: precipHours[0], to: precipHours[0] };
    let cur = { ...best };
    for (let i = 1; i < precipHours.length; i++) {
        if (precipHours[i] === cur.to + 1) cur.to = precipHours[i];
        else cur = { from: precipHours[i], to: precipHours[i] };
        if (cur.to - cur.from > best.to - best.from) best = { ...cur };
    }
    return (best.from + best.to + 1) / 2 / 24;
};

/** Els tipus de cel que surten en algun dia (per a la llegenda: només s'hi explica el que es veu). */
export const skyKindsPresent = (days: ReadonlyArray<ReadonlyArray<SkyHour>>): Set<SkyKind> => {
    const kinds = new Set<SkyKind>();
    for (const day of days) for (const h of day) if (h.kind) kinds.add(h.kind);
    return kinds;
};
