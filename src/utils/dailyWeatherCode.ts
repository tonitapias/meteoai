// src/utils/dailyWeatherCode.ts
// Codi WMO que pinta la targeta d'UN dia de la previsió setmanal (ForecastSection) i el
// gràfic de tendència (TrendChartModal). Abans les dues pantalles duplicaven aquesta lògica.
import { adjustBaseSkyCode } from './rules/cloudRules';

/**
 * `rawCode` és el weather_code DIARI d'Open-Meteo, que és el codi de l'hora MÉS SEVERA del
 * dia. Per a la boira això vol dir que una sola hora (típicament l'alba) pinta la icona de
 * boira de tot el dia — i més enllà de l'horitzó d'AROME (~45 h) ningú la confirma: la
 * política de boira (visibilityRules.resolveFog) exigeix saturació de superfície, i aquí
 * no n'hi ha a escala diària. Per això un codi diari 45/48 es resol com el cel diürn real
 * (mateixa regla que els codis 0-3), no com una condició de tot el dia. Les hores concretes
 * amb boira confirmada continuen sortint a l'evolució horària i a "Previsió per hores".
 *
 * `avgDaylightClouds`: mitjana de núvols (%) de les hores de sol del dia, o null si no hi
 * ha dades horàries — en aquest cas no es toca res (no inventem un cel).
 */
export const resolveDailyCode = (rawCode: number, avgDaylightClouds: number | null): number => {
    if (avgDaylightClouds === null) return rawCode;

    const isFogCode = rawCode === 45 || rawCode === 48;
    if (rawCode <= 3 || isFogCode) return adjustBaseSkyCode(isFogCode ? 0 : rawCode, avgDaylightClouds);

    return rawCode;
};
