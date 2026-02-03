import { WEATHER_THRESHOLDS } from '../../constants/weatherConfig';

const { CAPE, CLOUDS, PRECIPITATION } = WEATHER_THRESHOLDS;

/** Ajusta per tempestes si hi ha molta energia (CAPE) */
export const adjustForStorms = (code: number, cape: number, cloudCover: number, precipAmount: number): number => {
    if (cape <= CAPE.MIN_STORM) return code; 

    const isPrecipitating = precipAmount >= PRECIPITATION.TRACE || (code >= 51 && code <= 82);

    if (cloudCover > CLOUDS.STORM_BASE) {
        if (isPrecipitating) {
            if (code < 95) return 95;
        } else if (cape > CAPE.HIGH_STORM) {
            return 2; 
        }
    }
    return code;
};