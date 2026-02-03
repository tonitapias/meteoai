import { calculateDewPoint } from '../physics';
import { WEATHER_THRESHOLDS } from '../../constants/weatherConfig';

const { HUMIDITY, VISIBILITY, PRECIPITATION } = WEATHER_THRESHOLDS;

/** Detecta condicions de boira o humitat extrema */
export const checkForFog = (code: number, temp: number, humidity: number, cloudCover: number): number => {
    if (code >= 48) return code;

    const dewPoint = calculateDewPoint(temp, humidity);
    const spread = temp - dewPoint;

    if (code < 45 && spread < HUMIDITY.DEW_SPREAD && humidity > HUMIDITY.FOG_BASE && cloudCover > 50) {
        return 45;
    }
    if (code === 0 && humidity > HUMIDITY.HIGH) {
        return 1;
    }
    return code;
};

/** Força el codi de mala visibilitat si és crític i no plou */
export const checkCriticalVisibility = (code: number, visibility: number, precipAmount: number): number => {
    if ((code === 45 || code === 48 || visibility < VISIBILITY.POOR) && precipAmount < PRECIPITATION.TRACE) {
        return 45;
    }
    return code;
};