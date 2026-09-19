// src/utils/dailyWeatherCode.ts
// Codi WMO que pinta la targeta d'UN dia de la previsió setmanal (ForecastSection) i el
// gràfic de tendència (TrendChartModal). Abans les dues pantalles duplicaven aquesta lògica.
import { adjustBaseSkyCode } from './rules/cloudRules';
import { isFreezingPrecipCode, isSleetCode } from './rules/winterRules';

/**
 * Classe de severitat d'un codi de precipitació o tempesta (0 = no n'és). De més a menys:
 * tempesta > pluja/plugim engelant > neu > aiguaneu > ruixats > pluja > plugim. Dins de cada classe
 * mana el codi més alt (més intens). La boira (45/48) i el cel (0-3) no en tenen: no són precipitació.
 */
const precipClass = (code: number): number => {
    if (code >= 95) return 7;
    if (isFreezingPrecipCode(code)) return 6;
    if ((code >= 71 && code <= 77) || code === 85 || code === 86) return 5;
    if (isSleetCode(code)) return 4;
    if (code >= 80 && code <= 82) return 3;
    if (code >= 61 && code <= 65) return 2;
    if (code >= 51 && code <= 55) return 1;
    return 0;
};

/**
 * El codi de precipitació o tempesta més sever d'entre les hores donades, o null si cap hora en té.
 * Ignora les hores sense codi (null): una dada absent no és cap precipitació.
 */
export const worstPrecipCode = (hourCodes: ReadonlyArray<number | null | undefined>): number | null => {
    let worst: number | null = null;
    let worstRank = 0;
    for (const c of hourCodes) {
        if (typeof c !== 'number' || isNaN(c)) continue;
        const rank = precipClass(c) * 100 + c;
        if (precipClass(c) > 0 && rank > worstRank) { worst = c; worstRank = rank; }
    }
    return worst;
};

/**
 * `rawCode` és el weather_code DIARI d'Open-Meteo, que és el codi de l'hora MÉS SEVERA del
 * dia. Per a la boira això vol dir que una sola hora (típicament l'alba) pinta la icona de
 * boira de tot el dia — i més enllà de l'horitzó d'AROME (~45 h) ningú la confirma: la
 * política de boira (visibilityRules.resolveFog) exigeix saturació de superfície, i aquí
 * no n'hi ha a escala diària. Per això un codi diari 45/48 es resol com el cel diürn real
 * (mateixa regla que els codis 0-3), no com una condició de tot el dia. Les hores concretes
 * amb boira confirmada continuen sortint a l'evolució horària i a "Previsió per hores".
 *
 * PRECIPITACIÓ: el codi diari passava CRU. A l'evolució horària, en canvi, cada hora passa pel
 * motor (bloqueig tèrmic, sincronització amb els mm reals, virga, aiguaneu, pluja engelant), així
 * que la mateixa jornada podia dir "pluja" a la setmana i cap pluja a les hores. Mesurat amb 24 mesos
 * de previsions de 20 ubicacions (14.600 dies): el 8 % dels dies de "pluja" del model cru (411 dies, el
 * 2,8 % del total) eren dies secs (mediana 0,00 mm) que les hores ja filtraven, i unes 50 vegades el
 * tipus canviava (pluja → aiguaneu, neu → pluja per bloqueig tèrmic).
 *
 * Ara el model manté la decisió de SI el dia és de precipitació (el seu codi diari ja és un judici
 * a escala de dia) i el motor decideix QUINA: si el model diu precipitació, es mostra la més severa de
 * les hores del motor; si el motor les ha filtrades totes, el dia és sec i es pinta el cel. Al revés NO:
 * un dia que el model no marca de precipitació no en passa a tenir perquè el motor forci "pluja feble"
 * amb 0,1 mm en una hora (això afegiria 535 dies de "pluja" amb 0,27 mm de mitjana).
 *
 * `avgDaylightClouds`: mitjana de núvols (%) de les hores de sol del dia, o null si no hi
 * ha dades horàries — en aquest cas no es toca res (no inventem un cel).
 * `hourCodes`: codis del motor (getHourlyWeatherCode) de les hores d'aquest dia, o absent si no hi
 * ha dades horàries — llavors la precipitació queda tal com la dona el model.
 */
export const resolveDailyCode = (
    rawCode: number,
    avgDaylightClouds: number | null,
    hourCodes?: ReadonlyArray<number | null | undefined> | null
): number => {
    const isFogCode = rawCode === 45 || rawCode === 48;

    if (rawCode <= 3 || isFogCode) {
        if (avgDaylightClouds === null) return rawCode;
        return adjustBaseSkyCode(isFogCode ? 0 : rawCode, avgDaylightClouds);
    }

    // El model diu que el dia porta precipitació o tempesta.
    const hours = (hourCodes ?? []).filter((c): c is number => typeof c === 'number' && !isNaN(c));
    if (hours.length === 0) return rawCode;

    const worst = worstPrecipCode(hours);
    if (worst !== null) return worst;

    // El motor ha filtrat la precipitació de totes les hores (0 mm, aire sec...): dia sec, es pinta el cel.
    if (avgDaylightClouds !== null) return adjustBaseSkyCode(0, avgDaylightClouds);
    const skyHours = hours.filter(c => c <= 3);
    return skyHours.length > 0 ? Math.max(...skyHours) : 3;
};
