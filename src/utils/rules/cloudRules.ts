import { WEATHER_THRESHOLDS } from '../../constants/weatherConfig';

const { CLOUDS } = WEATHER_THRESHOLDS;

/** Calcula el % de núvols efectiu ponderant els baixos (més impacte), mitjans i alts */
export const calculateEffectiveCloudCover = (low: number, mid: number, high: number): number => {
    return Math.min(100, (low * 1.0) + (mid * 0.6) + (high * 0.3));
};

/**
 * Dins del codi 2 (parcialment ennuvolat, 45-85 % de núvols), l'estat "molt ennuvolat": a partir de
 * CLOUDS.MOSTLY_CLOUDY el cel es pinta amb la icona de dos núvols i no amb el sol entre núvols.
 * `cloudCover` és el mateix % que va decidir el codi (efectiu a hores i a "ara", mitjana diürna al
 * diari); si falta (null/undefined) no fingim cap variant i queda el codi 2 de sempre.
 */
export const isMostlyCloudy = (code: number | null | undefined, cloudCover: number | null | undefined): boolean =>
    code === 2 && typeof cloudCover === 'number' && cloudCover > CLOUDS.MOSTLY_CLOUDY;

/** Ajusta el codi de cel (serè/ennuvolat) basant-se en el % de cobertura */
export const adjustBaseSkyCode = (code: number, cloudCover: number): number => {
    if (code > 3) return code;

    if (cloudCover > CLOUDS.OVERCAST) return 3; 
    if (cloudCover > CLOUDS.SCATTERED) return 2; 
    if (cloudCover > CLOUDS.FEW) return 1; 
    return 0; 
};