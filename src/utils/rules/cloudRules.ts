import { WEATHER_THRESHOLDS } from '../../constants/weatherConfig';

const { CLOUDS } = WEATHER_THRESHOLDS;

/** Calcula el % de núvols efectiu ponderant els baixos (més impacte), mitjans i alts */
export const calculateEffectiveCloudCover = (low: number, mid: number, high: number): number => {
    return Math.min(100, (low * 1.0) + (mid * 0.6) + (high * 0.3));
};

/** Ajusta el codi de cel (serè/ennuvolat) basant-se en el % de cobertura */
export const adjustBaseSkyCode = (code: number, cloudCover: number): number => {
    if (code > 3) return code;

    if (cloudCover > CLOUDS.OVERCAST) return 3; 
    if (cloudCover > CLOUDS.SCATTERED) return 2; 
    if (cloudCover > CLOUDS.FEW) return 1; 
    return 0; 
};