// src/utils/engineSnowfall.ts
// Neu acumulada (cm) a partir de la MATEIXA pluja i el MATEIX motor que decideixen la icona de cada hora.
//
// ABANS: la icona sortia del motor de l'app (utils/hourlyWeatherCode.ts: pluja de la sèrie combinada —model regional on
// n'hi ha—, temperatura i cota de gel), però els centímetres eren els del model global (`snowfall`, `snowfall_sum`), que
// fa la seva pròpia partició pluja/neu. Hivern 2025-26 (nov.–mar.), 30 aeroports europeus, previsió de curt termini
// d'Open-Meteo (arxiu de passades anteriors, "dia 0"), 4.529 dies-estació: 94 dies amb icona de neu o aiguaneu i la xifra
// en mm, i 14 dies amb centímetres de neu al costat d'una icona que no era de neu (108 dels 234 dies amb neu en joc).
//
// ARA: cada hora de neu (codi 71-77, 85-86) aporta la seva pluja × SNOW_CM_PER_MM, cada hora d'aiguaneu (68/69) la meitat,
// i la resta 0 (també la pluja engelant: és gel, no neu). Amb això: 0 dies amb centímetres i icona que no és de neu, i els
// 57 dies de neu amb xifra en mm són tots traces (< 0,2 cm, < 0,3 mm d'aigua). Com a predicció de "dia de neu" (es mostren
// centímetres) contra la neu o aiguaneu observada als METAR (276 dies), queda igual que el model global: CSI 0,468 contra
// 0,460 (diferència +0,009, IC 95 % per blocs estació-mes [-0,055, +0,066]), POD 0,51 contra 0,48 i FAR 0,14 contra 0,06
// (els dies de més són els que la icona ja pintava de neu). El canvi és de coherència, no d'encert.
//
// Una hora sense codi del motor (sense temperatura real) o sense pluja conserva la dada del model: no s'inventa cap zero.
// El total diari només se substitueix si totes les hores del dia (23-25, pel canvi d'hora) tenen dada; si no, queda el
// diari del model (mateixa regla que el total de pluja, vegeu regionalModelEngine.injectDailyPrecipitationTotal).
import type { ExtendedWeatherData } from '../types/weatherLogicTypes';
import { getHourlyWeatherCode, type HourlySeries } from './hourlyWeatherCode';
import { isSleetCode } from './rules/winterRules';
import { extractValidArrayNum } from './weatherMath';

/** cm de neu per mm d'aigua: la relació que fa servir Open-Meteo per al seu `snowfall` (7 cm = 10 mm). */
export const SNOW_CM_PER_MM = 0.7;

/** L'aiguaneu és pluja i neu barrejades: només en compta la meitat com a neu. */
export const SLEET_SNOW_FRACTION = 0.5;

const isSnowCode = (code: number): boolean => (code >= 71 && code <= 77) || code === 85 || code === 86;

/** Neu (cm) d'una hora amb el codi del motor i la pluja (mm) d'aquella hora; null si falta alguna de les dues. */
export const snowfallCmForHour = (code: number | null, precipMm: number | null): number | null => {
    if (code === null || precipMm === null) return null;
    if (isSnowCode(code)) return precipMm * SNOW_CM_PER_MM;
    if (isSleetCode(code)) return precipMm * SNOW_CM_PER_MM * SLEET_SNOW_FRACTION;
    return 0;
};

const MIN_DAY_HOURS = 23;
const MAX_DAY_HOURS = 25;

/** Substitueix `hourly.snowfall` i `daily.snowfall_sum` per la neu del motor. No muta les dades d'entrada. */
export const injectEngineSnowfall = (data: ExtendedWeatherData): ExtendedWeatherData => {
    const hourly = data?.hourly as unknown as HourlySeries | undefined;
    if (!hourly || !Array.isArray(hourly.time)) return data;

    const times = hourly.time as unknown[];
    const elevation = typeof data.elevation === 'number' ? data.elevation : 0;
    const original = Array.isArray(hourly.snowfall) ? (hourly.snowfall as Array<number | null>) : [];

    const perDate = new Map<string, { sum: number; hours: number; complete: boolean }>();
    const snowfall = times.map((t, i) => {
        const engine = snowfallCmForHour(
            getHourlyWeatherCode(hourly, i, elevation, data.hourlyComparison),
            extractValidArrayNum(hourly.precipitation, i)
        );

        const date = String(t).slice(0, 10);
        const entry = perDate.get(date) ?? { sum: 0, hours: 0, complete: true };
        entry.hours += 1;
        if (engine === null) entry.complete = false;
        else entry.sum += engine;
        perDate.set(date, entry);

        return engine ?? (typeof original[i] === 'number' ? original[i] : null);
    });

    const target: ExtendedWeatherData = {
        ...data,
        hourly: { ...data.hourly, snowfall } as ExtendedWeatherData['hourly']
    };

    const daily = data.daily;
    if (daily && Array.isArray(daily.time)) {
        const current = Array.isArray(daily.snowfall_sum) ? daily.snowfall_sum : [];
        const totals = daily.time.map((day, i) => {
            const entry = perDate.get(String(day).slice(0, 10));
            if (entry && entry.complete && entry.hours >= MIN_DAY_HOURS && entry.hours <= MAX_DAY_HOURS) {
                return Math.round(entry.sum * 10) / 10;
            }
            const existing = current[i];
            return typeof existing === 'number' && !isNaN(existing) ? existing : null;
        });
        target.daily = { ...daily, snowfall_sum: totals };
    }

    return target;
};
