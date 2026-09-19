import { calculateDewPoint } from '../weatherMath';
import { WEATHER_THRESHOLDS } from '../../constants/weatherConfig';
import { adjustBaseSkyCode } from './cloudRules';

const { HUMIDITY, VISIBILITY, PRECIPITATION, TEMP, CLOUDS } = WEATHER_THRESHOLDS;

/** Diferència T − Td (°C): com de prop de la saturació és l'aire de superfície. */
export const getDewPointSpread = (temp: number, humidity: number): number =>
    temp - calculateDewPoint(temp, humidity);

/**
 * El model prediu boira: codi WMO 45/48, o visibilitat per sota de 1 km.
 * Ho poden aportar el model regional o el global de la sèrie combinada — AROME HD,
 * per exemple, no publica ni weather_code ni visibility, i el senyal li arriba del
 * model global (vegeu utils/hourlyWeatherCode.ts).
 */
export const hasFogSignal = (code: number, visibility: number): boolean =>
    code === 45 || code === 48 || visibility < VISIBILITY.POOR;

/**
 * POLÍTICA DE BOIRA: només hi ha icona de boira si
 *   1. un model en dona senyal (hasFogSignal), I
 *   2. la temperatura i la humitat de la sèrie confirmen la saturació
 *      (T − Td <= HUMIDITY.FOG_MAX_SPREAD), I
 *   3. no plou (precipitació < TRACE) i el codi no és ja de precipitació/tempesta, I
 *   4. hi ha prou nuvolositat BAIXA (>= CLOUDS.FOG_MIN_LOW): la boira és un núvol a nivell de
 *      terra i, sense cap capa baixa al model, el senyal de boira és majoritàriament fals.
 *      Si la dada de núvols baixos falta (null) NO s'aplica: mai convertim una dada absent
 *      en un 0 % que descartaria la boira.
 *
 * Abans qualsevol senyal de visibilitat < 1 km (o codi 45) bastava, i es fabricava
 * boira només amb HR alta + núvols. Verificat contra observacions METAR, això
 * sobreprevenia la boira ~4,3 vegades i el 10,8 % de les hores que marcava eren
 * físicament impossibles (T−Td >= 1,5 °C mesurat). El senyal d'un sol model no basta:
 * quan un model diu "saturat" només ~1 de cada 5 vegades hi ha boira real. Vegeu el
 * llindar a weatherConfig.ts (HUMIDITY.FOG_MAX_SPREAD) per a les xifres.
 *
 * Un codi de boira entrant que la saturació no confirma es rebaixa a l'estat de cel
 * segons la nuvolositat real (mateix criteri que abans per a la calitja a > 20 ºC).
 * Un senyal només de visibilitat que no es confirma no toca el codi.
 *
 * TIPUS DE BOIRA: la boira confirmada a T <= 0 ºC és sempre gebradora (48): són gotetes
 * d'aigua subrefredades que dipositen gebre en tocar objectes (FZFG als METAR). Es
 * decideix aquí i no només amb el codi del model: un senyal de boira per visibilitat
 * (o un 45 d'un model que no distingeix el gebre) a -4 °C és igual de gebradora. Per
 * sobre de 0 °C, en canvi, no pot ser-ho i sempre és boira normal (45).
 */
export const resolveFog = (
    code: number,
    temp: number,
    humidity: number,
    cloudCover: number,
    visibility: number,
    precipAmount: number,
    lowCloudCover: number | null = null
): number => {
    // Precipitació o tempesta ja decidides: no fabriquem ni mantenim boira a sobre.
    if (code > 48) return code;

    // Boira gebradora impossible a > 0 ºC: rebaixem a boira normal.
    const safeCode = (code === 48 && temp > 0) ? 45 : code;
    const isFogCode = safeCode === 45 || safeCode === 48;

    const confirmed =
        hasFogSignal(safeCode, visibility) &&
        precipAmount < PRECIPITATION.TRACE &&
        getDewPointSpread(temp, humidity) <= HUMIDITY.FOG_MAX_SPREAD &&
        (lowCloudCover === null || lowCloudCover >= CLOUDS.FOG_MIN_LOW);

    let result = safeCode;
    if (confirmed) {
        result = temp <= TEMP.FREEZING ? 48 : 45;
    } else if (isFogCode) {
        // Boira del model no confirmada (saturació o núvols baixos): restaurem el cel real.
        result = adjustBaseSkyCode(0, cloudCover);
    }

    // Ajust d'humitat alta per forçar lleugera nuvolositat si tot estava esclarit
    if (result === 0 && humidity > HUMIDITY.HIGH) return 1;

    return result;
};
