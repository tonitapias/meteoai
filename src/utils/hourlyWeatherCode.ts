// src/utils/hourlyWeatherCode.ts
// FONT ÚNICA DE VERITAT per calcular l'icona (codi WMO) d'UNA hora de previsió.
//
// Abans, Forecast24h, DayDetailModal i RegionalModelModal muntaven cadascun per
// compte propi les entrades de getRealTimeWeatherCode i, quan una dada faltava,
// la substituïen de maneres diferents. Amb AROME HD això es notava molt: Open-Meteo
// NO publica per a AROME `weather_code`, `visibility` ni `freezing_level_height`
// (verificat en viu, 0 valors), de manera que el modal (només AROME) omplia els
// forats amb marcadors ("cel serè", "10 km de visibilitat", extrapolació de la
// temperatura) mentre la resta de l'app heretava els valors del model global
// (p.ex. ICON, que marcava boira). La mateixa hora acabava amb dues icones.
//
// Ara tothom cala les entrades d'aquí, sobre la MATEIXA sèrie horària combinada
// (model regional on en té, model global on no), amb la mateixa cadena de reserva.

import { getRealTimeWeatherCode } from './weatherLogic';
import { calculateEffectiveCloudCover } from './rules/cloudRules';
import { getInversionCorrectedTemp } from './rules/temperatureCorrections';
import { extractValidArrayNum, getSafeArrayNum, getSafeMonthFromIso } from './weatherMath';
import type { StrictCurrentWeather } from '../types/weatherLogicTypes';

/** Sèries horàries en brut: cada clau és un array indexat per hora. */
export type HourlySeries = Record<string, unknown>;

/** `hourlyComparison` de l'app: { ecmwf: [{...}], gfs: [{...}], icon: [{...}] } per hora. */
export type HourlyComparison = Record<string, Record<string, unknown>[] | undefined> | null | undefined;

/**
 * Cota de gel (isoterma 0 °C) d'una hora, amb una única cadena de reserva:
 *   1. la sèrie horària pròpia (model regional si en té, si no el model base);
 *   2. algun model de comparació (ecmwf → gfs → icon), en aquest ordre;
 *   3. extrapolació amb el gradient estàndard (6,5 °C/km) des de la temperatura
 *      de superfície. Sense clamp: si fa prou fred, la isoterma queda per sota
 *      de l'elevació pròpia, i això és exactament el que cal reflectir.
 * Les tres primeres opcions són valors reals d'un model; l'última només és una
 * aproximació (la nocturna sol quedar >1 km per sota de la real).
 */
export const resolveFreezingLevel = (
    hourly: HourlySeries,
    idx: number,
    elevation: number,
    rawTemp: number | null,
    comparison?: HourlyComparison
): number => {
    const own = extractValidArrayNum(hourly.freezing_level_height, idx);
    if (own !== null) return own;

    for (const model of ['ecmwf', 'gfs', 'icon'] as const) {
        const v = comparison?.[model]?.[idx]?.freezing_level_height;
        if (typeof v === 'number' && !isNaN(v)) return v;
    }

    return elevation + ((rawTemp ?? 0) / 0.0065);
};

/**
 * Codi WMO final d'una hora. `hourly` ha de ser la sèrie combinada de l'app
 * (o, com a últim recurs, la sèrie crua d'un model si no n'hi ha d'altra).
 * Retorna null si l'hora no té temperatura real (vegeu getRealTimeWeatherCode).
 */
export const getHourlyWeatherCode = (
    hourly: HourlySeries,
    idx: number,
    elevation: number,
    comparison?: HourlyComparison
): number | null => {
    const rawTemp = extractValidArrayNum(hourly.temperature_2m, idx);
    const precip = getSafeArrayNum(hourly.precipitation, idx, 0);

    const timeArr = hourly.time;
    const time = Array.isArray(timeArr) ? String(timeArr[idx] ?? '') : '';

    // [NOTA] temperature_2m és la crua (no la corregida per inversió): la
    // correcció només s'aplica a la temperatura MOSTRADA. rawTemp null fa que
    // getRealTimeWeatherCode torni null en lloc de fingir un 0 °C que podria
    // fabricar neu en ple estiu.
    const simulatedCurrent = {
        time,
        weather_code: getSafeArrayNum(hourly.weather_code ?? hourly.weathercode, idx, 0),
        temperature_2m: rawTemp,
        apparent_temperature: rawTemp,
        wind_speed_10m: getSafeArrayNum(hourly.wind_speed_10m, idx, 0),
        visibility: getSafeArrayNum(hourly.visibility, idx, 10000),
        relative_humidity_2m: getSafeArrayNum(hourly.relative_humidity_2m, idx, 70),
        // null (no 0) si falta: la porta de boira (resolveFog) només s'aplica amb dada real.
        cloud_cover_low: extractValidArrayNum(hourly.cloud_cover_low, idx),
        cloud_cover_mid: getSafeArrayNum(hourly.cloud_cover_mid, idx, 0),
        cloud_cover_high: getSafeArrayNum(hourly.cloud_cover_high, idx, 0),
        cloud_cover: getSafeArrayNum(hourly.cloud_cover, idx, 0),
        precipitation: precip,
        cape: getSafeArrayNum(hourly.cape, idx, 0),
        is_day: getSafeArrayNum(hourly.is_day, idx, 1)
    } as unknown as StrictCurrentWeather;

    return getRealTimeWeatherCode(
        simulatedCurrent,
        [precip],
        getSafeArrayNum(hourly.precipitation_probability, idx, 0),
        resolveFreezingLevel(hourly, idx, elevation, rawTemp, comparison),
        elevation
    );
};

/**
 * Temperatura MOSTRADA d'una hora: la del model amb la correcció d'inversió tèrmica (nits serenes i en calma
 * de la temporada freda, fins a -3,5 °C). És la xifra que veuen l'evolució horària i el detall del dia, i la que
 * ha de citar la IA: amb la crua, una nit d'inversió amb -1 °C a l'app sortia al text de la IA com "2 graus,
 * cap fenomen advers". null si l'hora no té temperatura real (mai un 0 fals).
 */
export const getHourlyDisplayTemp = (
    hourly: HourlySeries,
    idx: number,
    latitude?: number
): number | null => {
    const rawTemp = extractValidArrayNum(hourly.temperature_2m, idx);
    if (rawTemp === null) return null;

    const timeArr = hourly.time;
    const time = Array.isArray(timeArr) && typeof timeArr[idx] === 'string' ? (timeArr[idx] as string) : undefined;

    return getInversionCorrectedTemp(
        {
            temperature_2m: rawTemp,
            is_day: resolveIsDay(hourly, idx, () => true) ? 1 : 0,
            wind_speed_10m: getSafeArrayNum(hourly.wind_speed_10m, idx, 0),
            cloud_cover_low: getSafeArrayNum(hourly.cloud_cover_low, idx, 0),
            cloud_cover_mid: getSafeArrayNum(hourly.cloud_cover_mid, idx, 0),
            cloud_cover_high: getSafeArrayNum(hourly.cloud_cover_high, idx, 0),
        } as unknown as StrictCurrentWeather,
        getSafeMonthFromIso(time),
        latitude
    );
};

/**
 * Codis del motor (getHourlyWeatherCode) de TOTES les hores de la sèrie, agrupats per dia ("YYYY-MM-DD",
 * la data local de la sèrie). Serveix perquè la previsió setmanal triï la icona del dia amb els mateixos
 * codis filtrats que veu l'evolució horària (vegeu resolveDailyCode). Una hora sense temperatura real
 * dona null; el motor no s'inventa mai un codi.
 */
export const getHourCodesByDate = (
    hourly: HourlySeries,
    elevation: number,
    comparison?: HourlyComparison
): Record<string, Array<number | null>> => {
    const times = hourly.time;
    const out: Record<string, Array<number | null>> = {};
    if (!Array.isArray(times)) return out;

    for (let i = 0; i < times.length; i++) {
        const t = times[i];
        if (typeof t !== 'string' || t.length < 10) continue;
        const date = t.slice(0, 10);
        if (!out[date]) out[date] = [];
        out[date].push(getHourlyWeatherCode(hourly, i, elevation, comparison));
    }
    return out;
};

/**
 * % efectiu de núvols d'una hora (mateixa ponderació que decideix el codi de cel: baixos x1,0 + mitjans x0,6
 * + alts x0,3). Serveix perquè les pantalles triïn la variant "molt ennuvolat" de la icona (isMostlyCloudy) amb
 * el mateix valor que va decidir el codi. null si cap de les tres capes porta dada (no es fingeix un cel).
 */
export const getHourlyEffectiveCloudCover = (hourly: HourlySeries, idx: number): number | null => {
    const low = extractValidArrayNum(hourly.cloud_cover_low, idx);
    const mid = extractValidArrayNum(hourly.cloud_cover_mid, idx);
    const high = extractValidArrayNum(hourly.cloud_cover_high, idx);
    if (low === null && mid === null && high === null) return null;
    return calculateEffectiveCloudCover(low ?? 0, mid ?? 0, high ?? 0);
};

/**
 * Dia/nit d'una hora. L'`is_day` que porta l'API (astronòmic, exacte al minut de
 * sortida/posta) mana; només si falta recorrem a l'aproximació per hora sencera
 * de sortida/posta del dia. Aquesta aproximació és sempre errònia a les hores
 * frontera (p.ex. amb sortida a les 07:35 dona "dia" a les 07:00, encara de nit).
 */
export const resolveIsDay = (
    hourly: HourlySeries,
    idx: number,
    fallback: () => boolean
): boolean => {
    const apiIsDay = extractValidArrayNum(hourly.is_day, idx);
    return apiIsDay !== null ? apiIsDay >= 1 : fallback();
};
